# Passagem de bastão — FlowOS (onboarding de dev)

> Documento de **entrada** para quem vai assumir o projeto. Estático: aponte para
> `docs/SISTEMA.md` (o sistema), `docs/RUNBOOK.md` (incidentes),
> `docs/ADMIN_SAAS.md` (painel SaaS) e `docs/WHATSAPP_BOT.md` (bot).
>
> Última atualização: **28/10/2026** · branch `main` · remoto `flowos` →
> `https://github.com/NanioEUX/FlowOS.git`

---

## 1. O que é o FlowOS (2 min)

SaaS multi-tenant para restaurants/lanchonetes. Um **estabelecimento** (tenant)
com cardápio digital público, PDV de balcão, KDS de cozinha, bot de WhatsApp com
IA, delivery (próprio ou 99Entrega), estoque com ficha técnica, financeiro e um
painel SaaS para o operador da plataforma.

Três públicos distintos, um mesmo código:

| Público | Onde entra | Como autentica |
|---|---|---|
| **Cliente final** | `/[slug]` (cardápio), `/[slug]/mesa/[n]`, `/pedido/[id]` | OTP por WhatsApp → cookie `flowos_customer`; pedidos futuros via `trackingToken` |
| **Equipe da loja** | `/dashboard/*`, `/caixa` (PDV), `/kds` | JWT (`Authorization: Bearer`) + refresh; KDS tem sessão própria |
| **Time FlowOS** | `/admin-saas/*` | Cookie `saas_admin_token`, role `saas_admin` |

---

## 2. Estado atual do repositório

| | |
|---|---|
| Branch | `main` (sem PR aberto) |
| Último commit | `5153bf4` — Fase 8 (feedback honesto nos toasts) |
| **Working tree** | **117 arquivos modificados/novos, NÃO commitado** (Fase 8 + Fase 4 + docs) |
| Testes | `npx vitest run` → **165 passando** (15 arquivos) |
| Typecheck | `npx tsc --noEmit` → limpo |
| Build | `npm run build` → OK |
| Banco | Prisma + Postgres (Supabase). **Produção usa `db push`** (sem `_prisma_migrations`) |

### ⚠️ `auditoria/` NÃO é versionada

O `.gitignore` ignora `auditoria/` — os 10 relatórios de auditoria, o
`PROGRESSO.md` e o `RELATORIO-FINAL.md` existem **só nesta máquina**. Se o dev
precisa do histórico do que foi corrigido (e dos achados abertos), decisa com o
dono: **versionar `auditoria/`** (recomendado) ou copiar os arquivos para ele.
O `AGENTS.md` (raiz) e `docs/` **são** versionados e carregam o resumo.

### ⚠️ Primeira tarefa do dev: fechar o working tree

O lote atual (Fase 8 + Fase 4 + docs) está pronto e validado, mas **não commitado**.
Opções sugeridas (nenhuma foi feita — o dono decide):

```bash
git status                       # 117 arquivos
git add -A && git commit -m "fix(auditoria Fase 8+4): UX/a11y, confiabilidade, health check, runbook e docs"
# ou, em blocos:
git add docs/ AGENTS.md auditoria/ && git commit -m "docs: documentação do sistema + runbook"
```

**Antes de qualquer push**, rode o gate:

```bash
rm -rf .next/types && npx tsc --noEmit && npx vitest run && npm run build
```

---

## 3. Ambiente local (15 min)

```bash
npm install            # postinstall já roda `prisma generate`
cp .env.example .env   # modelo no repo (placeholders, sem segredo)
# edite o .env com os valores reais — a lista completa está em docs/SISTEMA.md §10
npm run setup          # db push + generate + seed
npm run dev            # http://localhost:3000
```

### `.env.example`

O modelo de env vars está no repo (`.env.example`, com placeholders). O
`.gitignore` foi ajustado para permitir o versionamento dele (antes `*.env*`
bloqueava o arquivo).

### Cuidados

- **`DATABASE_URL` do `.env` local aponta para o Supabase de produção** em algumas
  máquinas. **Nunca** rode `db:push`, `db:reset` ou seed contra produção. Para
  ambiente local, use um Postgres/SQLite próprio.
- `npm run db:reset` é destrutivo e exige `DB_ALLOW_RESET=1`.
- Se aparecer `column Establishment.asaasApiKey does not exist`: o client do Prisma
  local está defasado → `npx prisma generate` (não escreve no banco).
- `npx prisma studio` para inspecionar dados.

---

## 4. Mapa rápido do código

| Precisa mexer em… | Vá para… |
|---|---|
| Criar/validar pedido, preço, cupom, fidelidade | `src/lib/order-input.ts` (+ `__tests__/order-input.test.ts`) |
| Estados do pedido | `src/lib/order-transitions.ts` |
| Estoque / ficha técnica | `src/lib/stock.ts`, `src/lib/cmv.ts` |
| Horário de funcionamento | `src/lib/store-hours.ts` |
| Fuso/limites do financeiro | `src/lib/finance-dates.ts` |
| Autenticação (operador/KDS/cliente/SaaS) | `src/lib/auth.ts`, `require-auth.ts`, `customer-auth.ts`, `saas-admin-auth.ts` |
| WhatsApp (Evolution/Meta), bot e IA | `src/lib/whatsapp/*` (`evolution.ts`, `meta.ts`, `bot.ts`, `ai/`) |
| Pagamentos | `src/lib/integrations/pagarme.ts`, `inter.ts`; rotas `src/app/api/payments/*` |
| Marketplaces | `src/lib/integrations/ifood*.ts`, `nine-*.ts`; `src/app/api/orders/*webhook*` |
| Cardápio público | `src/app/[slug]/page.tsx` (Server Component) + `menu-page.tsx` |
| PDV | `src/app/caixa/caixa-page.tsx` |
| KDS | `src/app/kds/(auth)/screen/page.tsx` |
| Backoffice | `src/app/dashboard/(auth)/*/page-content.tsx` |
| Painel SaaS | `src/app/admin-saas/(auth)/*` + `src/lib/saas-admin-auth.ts` |
| API (143 rotas) | `src/app/api/**/route.ts` |
| Modelo de dados | `prisma/schema.prisma` (47 models) |
| UI compartilhada | `src/components/ui/`, `toast.tsx`, `charts/` |

Convenções do projeto:
- Rotas de API sempre autenticam com `requireAuth`/`requireEstablishment`
  (401 sem token, **403** quando o `establishmentId` diverge).
- Toda query de pedido/catálogo filtra por `establishmentId`.
- Erro de API no front = **verificar `res.ok`** antes de toast de sucesso.
- Comentários no código marcam o finding da auditoria: `F8C-016`, `F4A-025`…
  (grep por `F[0-9][A-D]-` para localizar a origem da mudança).

---

## 5. Regras que não podem ser quebradas

1. **Preço é do servidor.** `total` enviado pelo cliente é ignorado; `buildOrderInput`
   recalcula tudo (produto ativo, promo/destaque, adicionais, cupom, taxa, mínimo,
   fidelidade, bônus de 1ª compra). Nunca reintroduza preço vindo do front.
2. **Credenciais não vazam.** Em qualquer resposta pública, remova `password`,
   `evolutionApiKey`, `metaAccessToken`, `metaWebhookVerifyToken`,
   `interClientSecret`, `interCertificate(+Password)`, `pagarmeApiKey`,
   `pagarmeWebhookKey`, `api99Key`, `ifoodAccessToken/RefreshToken`, `nineFoodApiKey`.
   Use `src/lib/redact.ts` ao logar.
3. **Segredo/OTP nunca em log.** Link de reset e código de verificação só com
   `SHOW_DEV_CODE=true` (dev).
4. **Máquina de estados.** Use `canTransition()`; não grave string arbitrária em
   `Order.status` (fora do mapa do provedor).
5. **Estorno de estoque em todo cancelamento.** Use `restoreOrderStock`; se ele
   falhar, a falha é contada e aparece em `/api/health` → `alerts.stockRestoreFailures`.
6. **Pagamento tardio não ressuscita pedido morto.** `cancelled`/`abandoned` são
   terminais (ver `isClosedOrderStatus()`).
7. **Não quebrar o que funciona.** Correções conservadoras; se mexer em preço,
   pedido, estoque ou pagamento, rode os testes de `order-input`, `stock` e o gate.
8. **Filtro de data do financeiro** passa por `src/lib/finance-dates.ts` (fuso
   `BUSINESS_TZ`) — nunca `new Date()` cru no relatório.

---

## 6. O que já foi feito (resumo das 10 fases de auditoria)

| Fase | Tema | Estado |
|---|---|---|
| 0–2 | Fundação, segurança, cardápio público | ✅ |
| 3 | Performance (polls, índices, crons, timeouts) | ✅ parcial (Realtime adiado) |
| 4 | Confiabilidade (webhooks, health, retry, runbook) | 🟡 em andamento (lote no working tree) |
| 5 | Máquina de estados, financeiro, KDS, entregas | ✅ (código) |
| 6 | Servidor como fonte de verdade do pedido + CSP | ✅ |
| 7 | Sessão de cliente + OTP endurecido | ✅ parcial (SMS/e-mail fallback pendente) |
| 8 | UX/a11y/PWA/feedback honesto | 🟡 quase tudo (design system pendente) |
| 9 | Plataforma/SaaS | 🟡 parcial (jurídico, planos, LGPD) |

Detalhe item a item: `auditoria/PROGRESSO.md` (status) e `auditoria/RELATORIO-FINAL.md`
(achados originais). O resumo do lote atual está no topo da seção "Fase 4" do
`PROGRESSO.md` e no `AGENTS.md`.

---

## 7. Segredos e variáveis (checklist do dev)

Variáveis por tenant (Evolution, Meta, Pagar.me, Inter, iFood, 99) ficam **no
banco**, por estabelecimento. As de ambiente estão listadas em `docs/SISTEMA.md` §10.

**Checklist de produção (falando com o dono/infra):**

- [ ] `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` definidos
- [ ] `WEBHOOK_99_SECRET` — **sem ele o webhook 99 é fail-open** (aceita sem assinatura)
- [ ] `IFOOD_WEBHOOK_SECRET` — idem para o iFood
- [ ] `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` (Meta Cloud API)
- [ ] `OPENAI_API_KEY` (bot com IA), `VAPID_*` (push), `SUPABASE_*` (Storage)
- [ ] `SHOW_DEV_CODE` **não** definido em produção
- [ ] Crons da Vercel: 6 agendamentos de `vercel.json` ativos no painel
- [ ] Monitor sintético apontando para `GET /api/health?deep=1`

---

## 8. Deploy e operação

- **Vercel**: build automático no push em `main`; `vercel.json` define crons e
  `maxDuration: 60`.
- **CI** (`.github/workflows/ci.yml`): lint → typecheck → `npm test` → build.
  Falta configurar o *gate de status check* no painel da Vercel (decisão do dono).
- **Banco**: produção usa `db push`. Alterar schema exige backup + decisão do dono.
- **PWA**: `public/sw.js` versionado por `NEXT_PUBLIC_BUILD_ID`; banner de nova
  versão (`src/components/pwa/update-banner.tsx`).
- **Incidente**: `docs/RUNBOOK.md` (5 cenários + rotação de chaves).
- **Logs**: JSON estruturado com `scope` + `x-request-id`
  (`src/lib/logger.ts`). Escopes: `webhook-ifood`, `webhook-99`, `webhook-99food`,
  `webhook-pagarme`, `orders-post`, `orders-patch`, `payment-status`, `verification`.

---

## 9. Pendências abertas (com dono)

**Bloqueiam decisão do dono**
1. `Idempotency-Key` no `POST /api/orders` — exige coluna `clientRequestId` + `db push`
2. APM/error tracking (Sentry) — dependência nova
3. Gate de status check do CI no painel da Vercel
4. Ativação de plano sem pagamento (sandbox) — decisão de produto
5. LGPD: delete de `Customer` e base legal de retenção

**Pode fazer sem decisão (sprint)**
6. Fase 8: `ui/Button`/`ui/Input` no PDV e dashboard + remover hex hardcoded
   (F8C-013/F8C-014) — refactor visual, fazer por tela
7. Fase 8: 2ª via de impressão em PDF (feature)
8. Fase 4: migrar os ~570 `console.*` restantes para `src/lib/logger.ts`
9. Fase 4: webhook de eventos **idempotente por `eventId`** (tabela `WebhookEvent`
   com `@@unique([provider, eventId])`) + dead-letter
10. Fase 7: fallback SMS/e-mail no OTP (F7B-012)

**Testes manuais que o dono ainda precisa rodar**
- Pedido PIX/cartão no cardápio real · abertura do link de tracking
- Pedido via bot de WhatsApp · PDV de balcão · pedido por mesa (QR)
- Preço adulterado via DevTools **não** pode prevalecer · cupom inválido → 400
- Loja pausada (`isOpenOverride=false`) recusa pedido do site, mas PDV/mesa seguem

---

## 10. Checklist do primeiro dia

1. Ler `docs/SISTEMA.md` (§2 arquitetura, §3 dados, §4 auth) e `AGENTS.md`.
2. Rodar o projeto localmente (`npm run setup`, `npm run dev`) e abrir `/login`,
   `/dashboard`, `/caixa`, `/kds` e um `/[slug]` de teste.
3. Rodar o gate: `rm -rf .next/types && npx tsc --noEmit && npx vitest run && npm run build`.
4. Ler `auditoria/PROGRESSO.md` (o que já foi corrigido) e escolher **1 pendência
   pequena** da §9 (não mexer em preço/estoque/pagamento no primeiro dia).
5. Commitar o working tree atual (com o dono) antes de começar trabalho novo.

---

## 11. Glossário

| Termo | Significado |
|---|---|
| **tenant / estabelecimento** | loja isolada; toda query filtra por `establishmentId` |
| **PDV** | ponto de venda de balcão (`/caixa`) |
| **KDS** | kitchen display system — tela da cozinha (`/kds`) |
| **cardápio** | página pública `/[slug]` |
| **mesa** | pedido por QR na mesa (`/[slug]/mesa/[n]`) |
| **trackingToken** | token que dá acesso ao pedido/tracking sem login |
| **scope** | identificador do subsistema nos logs (`webhook-pagarme`, …) |
| **finding / F4A-025** | item da auditoria; o ID aparece em comentário no código |
| **gate** | `tsc + vitest + build` — obrigatório antes de commit/push |
