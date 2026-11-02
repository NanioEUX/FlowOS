# RUNBOOK — incidentes do FlowOS

> F4D-001 (auditoria Fase 4). Runbook de incidente para os 5 cenários críticos
> + política de rotação de chaves. Complementa `docs/WHATSAPP_BOT.md` e
> `docs/ADMIN_SAAS.md`.
>
> **Princípio**: o sistema falha calado. Antes de "reiniciar e torcer", confirme
> o estado real: `GET /api/health?deep=1` (banco + env), depois o log do
> provedor (Vercel → Logs) buscando pelo **request-id** (`x-request-id`).

---

## 0._primeiro response (qualquer incidente)

```bash
# 1. Saúde do serviço (200 = ok, 503 = degraded)
curl -s "https://<app>/api/health?deep=1" | jq

# 2. Crons (todos exigem Authorization: Bearer $CRON_SECRET)
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/replay-webhooks" | jq
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/expire-orders" | jq
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/sync-ifood-status" | jq

# 3. Logs da Vercel: filtrar por request-id (header x-request-id) ou por
#    scope no log estruturado: webhook-ifood | webhook-99 | webhook-99food |
#    webhook-pagarme
```

| Sintoma | Onde olhar primeiro |
|---|---|
| Pedido some do painel | `GET /api/orders` (KDS/dashboard) → status do pedido no banco |
| Estoque não volta ao cancelar | log `restoreOrderStock` + `alerts.stockRestoreFailures` no `/api/health` |
| Pagamento pago e pedido parado | `paymentStatus` vs `status` (ver §2) |
| Mensagem do WhatsApp não chega | §4 |

---

## 1. iFood — pedidos não chegam / status travado

**Sintoma**: o iFood não lista pedidos novos; ou o pedido fica em `out_for_delivery` para sempre.

1. **Signature/token**: se o iFood não recebe 2xx, ele reenvia. O handler
   devolve **500** quando falha (F4A-001) — o evento fica registrado.
2. **Replay manual**: o webhook da iFood grava os eventos; se um evento falhou,
   rode o polling: `GET /api/cron/sync-ifood-status` (roda a cada 5 min).
3. **Loja sem iFood habilitado**: o webhook responde `unknown_establishment` e
   **não duplica** o pedido em outra loja (F4B-002).
4. **Duplicata**: `P2002` = pedido já existe (mesmo `externalId`) — **não** é bug,
   é o reenvio do marketplace.
5. **Status travado**: o webhook só avança para frente (máquina de estados em
   `src/lib/order-transitions.ts`). Para destravar, use o PATCH autenticado
   `/api/orders/[id]` (papel `admin`) — nunca edite o banco direto.

---

## 2. Gateway de pagamento — PIX não confirma / dinheiro sem pedido

**Sintoma**: o cliente pagou, mas o pedido continua `payment_pending`.

1. **Webhook do Pagar.me**: `POST /api/webhooks/pagarme` → devolve 500 em falha
   (o Pagar.me reenvia). Busque no log `webhook-pagarme`.
2. **Inter**: não há webhook — a confirmação é por polling em
   `GET /api/orders/[id]/payment-status?token=<trackingToken>` (o cardápio faz
   isso a cada poucos segundos). Se o cardápio não está aberto, a confirmação
   só acontece quando alguém reabre o pedido.
3. **Pagamento tardio** (pedido já `cancelled`/`abandoned`): o log traz
   `"pagamento tardio em pedido cancelado/abandonado"` → **reembolso manual**
   no painel do gateway. O pedido **não** volta (F4B-035).
4. **Pagamento sem pedido correspondente**: log `"pagamento recebido sem pedido
   correspondente"` → conferir `paymentId` gravado no pedido (Pagar.me grava
   `ch_...` ou `or_...`).
5. **Duplicidade financeira**: o registro em `FinancialTransaction` é checado
   antes de criar (F4B-009) — reenvio do webhook não duplica taxa no relatório.

---

## 3. Banco / pool de conexões

**Sintoma**: erro `P2024` (pool exhausted) ou timeouts do Prisma; o app fica
"mudo" mesmo com `/api/health` 200.

1. `/api/health?deep=1` mostra a latência do banco (`checks.database.ms`).
2. **Origem**: funções serverless long-running (poll do KDS, cron, webhooks) +
   `DATABASE_URL` com pool pequeno. Ao aumentar o pool no Supabase, reinicie
   as instâncias da Vercel.
3. **Mitigação**: reduza o `take` dos polls (KDS pede `status=ativos,cancelled&take=300`)
   e mantenha os crons em janela curta (`maxDuration: 60` no `vercel.json`).
4. **Nunca** rode `prisma db push`/`migrate` em produção sem backup (a prod usa
   `db push`, sem tabela `_prisma_migrations`).

---

## 4. WhatsApp (Evolution / Meta) — mensagens não chegam

**Sintoma**: cliente não recebe a confirmação do pedido.

1. **Meta (WABA oficial)**: o token tem TTL e cota. O cron
   `GET /api/cron/meta-quota` (de hora em hora) avisa quando o limite estourar
   (`currentUsage >= messagingLimit` → 429 no `/api/verification`).
2. **Evolution (API não oficial)**: dependência externa — checar o servidor da
   Evolution (`/instance`/health da API) antes de culpar o FlowOS. Erros de
   rede agora têm **retry exponencial** nos GETs (`fetchExternalWithRetry`).
3. **Bot (OpenAI)**: o webhook do WhatsApp responde **ACK imediato** e processa
   em background (`waitUntil`) — o bot pode demorar; o pedido criado pelo bot
   aparece em `/api/orders` com `orderType` de bot.
4. **Timeout**: todo fetch externo tem teto de 15s (`AbortSignal.timeout`).
5. **Fallback**: o OTP por SMS/e-mail ainda não existe (F7B-012) — nesse cenário
   o lojista precisa liberar o pedido manualmente.

---

## 5. KDS — tela não atualiza / cai sozinha

**Sintoma**: o KDS mostra "Sessão expirada" ou "Sem conexão".

1. **Sessão**: o access token dura 24h; o refresh token (cookie httpOnly
   `kds_refresh`) dura 30d. `POST /api/auth/kds-refresh` reemite o token. Se o
   refresh também falhar, o operador precisa logar de novo (`/kds`).
2. **Rede**: o KDS faz poll a cada 5s; 401/403 → overlay de sessão expirada;
   5xx/rede → modo serviço (vermelho, sem sumir o card).
3. **Tela travada**: o cron `sync-ifood-status` não afeta o KDS; reinicie a
   função se o poll não voltar (deploy).
4. **Relógio**: o KDS calibra o relógio pelo header `Date` do servidor — se o
   relógio do celular está errado, os atrasos exibidos ficam estranhos.

---

## 6. Política de rotação de chaves

| Chave | Onde vive | Como rotacionar |
|---|---|---|
| `JWT_SECRET` | Vercel env | Trocar invalida todas as sessões (operadores e KDS voltam a logar). |
| `CRON_SECRET` | Vercel env | Trocar e reiniciar os crons (o header `Authorization: Bearer` precisa bater). |
| `WEBHOOK_99_SECRET` / `IFOOD_WEBHOOK_SECRET` | Vercel env | **Fail-open**: sem a variável a rota aceita chamadas sem assinatura. Definir em produção. |
| `META_APP_SECRET` | Vercel env | Trocar exige reconfigurar o app Meta (redirect URIs). |
| Token da WABA (`metaAccessToken`) | banco (por estabelecimento) | Reconectar via `meta-connect`/`meta-embedded-signup`; o valor **nunca** aparece em log (F4A-014). |
| `PAGARME_WEBHOOK_KEY` / `INTER_*` | banco + env | Rotacionar no painel do gateway e atualizar na loja. |
| Senhas de operador | banco | Troca pelo próprio usuário; **nunca** registrar senha em log. |
| Link de reset de senha | banco | Não aparece em log (só com `SHOW_DEV_CODE=true`, em dev). |

**Regras**:
- Segredo nunca vai para o log (use `src/lib/redact.ts` ao logar objetos).
- Todo token/segredo de terceiro tem dono (a loja) — a rotação é disparada pelo
  dono e registrada no incidente.
- Ao trocar `JWT_SECRET`/`CRON_SECRET` em produção, avisar os operadores
  (KDS e dashboard caem juntos).

---

## 7. Comandos de verificação (gate local)

```bash
rm -rf .next/types && npx tsc --noEmit && npx vitest run && npm run build
```
