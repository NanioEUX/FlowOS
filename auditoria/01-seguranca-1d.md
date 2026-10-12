# 01-seguranca-1d.md — LGPD, privacidade e dados pessoais

> Parte **1D** da Fase 1. Somente leitura. Evidência no formato `arquivo:linha`.
> Nenhum teste dinâmico executado; nenhuma consulta a banco de produção.
> Política analisada: `src/app/politica-de-privacidade/page.tsx` (155 linhas,
> "Última atualização: 19 de agosto de 2026", editora "FlowOS").

---

## 1. Tabela de achados

| ID | Sev. | Tema | Título | Evidência | Esforço |
|---|---|---|---|---|---|
| **F1D-001** | **CRÍTICO** | Controle de acesso | `GET /api/orders` público devolve nome/telefone/endereço/GPS/`pixPayload`/`paymentId` de todos os pedidos de qualquer tenant | `middleware.ts:10-20` (`/api/orders` em `PUBLIC_ROUTES`), `:24,34`; `src/app/api/orders/route.ts:690-697` (sem `verifyAuth`), `:748-757` (sem `select`) | S |
| **F1D-002** | **CRÍTICO** | Controle de acesso | `GET` **e `PUT` `/api/customers`** sem autenticação: CPF, nascimento e endereço legíveis **e editáveis** por qualquer um | `middleware.ts:13`; `api/customers/route.ts:15-25` (lookup por CPF), `:27-49` (por telefone), `:116-152` (`PUT` sem `verifyAuth`) | S |
| **F1D-003** | **CRÍTICO** | Art. 46 | Credenciais de pagamento/WhatsApp do lojista expostas ao cliente público (RSC do cardápio, resposta do `POST /api/orders`, `GET /api/establishments`) | `src/app/[slug]/page.tsx:64-74,86,118`; `api/orders/route.ts:678-683`; `api/establishments/route.ts:110-151`; `prisma/schema.prisma:30,34,128,131,133,139-140,142,172-173,178,182` | M |
| **F1D-004** | ALTO | Minimização | `GET /api/orders/customer?phone=` público → histórico de 20 pedidos de qualquer telefone | `middleware.ts:14`; `api/orders/customer/route.ts:4-14,40-75` | S |
| **F1D-005** | ALTO | Controle de acesso | `/api/customers/notifications` público por `phone` → lê e apaga notificações de terceiros | `middleware.ts:13`; `api/customers/notifications/route.ts:5-37` (GET), `:39-74` (PATCH) | S |
| **F1D-006** | ALTO | Direitos do titular | **Não existe** exportação, exclusão ou anonimização de cliente (nem endpoint, nem UI) | grep `customer.delete\|deleteMany\|Customer.delete` → **0**; `dashboard/(auth)/clientes/page-content.tsx:35` (sem DELETE) | M |
| **F1D-007** | ALTO | Retenção | **Não existe** job de retenção; a política de "5 anos" é letra morta; OTPs e logs crescem sem limite | `vercel.json:3-11` (só `verify-reminder` e `sync-ifood-status`); nenhum `deleteMany` com expurgo por idade em `VerificationCode`, `AIUsageLog`, `CancellationLog`, `LogWebhook99`, `PushLog`, `Customer` | M |
| **F1D-008** | ALTO | Base legal | **Sem Termos de Uso, sem DPA, sem aceite no cadastro**; política de privacidade **órfã** (nenhum link aponta para ela) | grep `termos\|dpa\|consentimento` → 0 docs; `cadastro/page.tsx:291-294` (sem checkbox); `api/establishments/route.ts:14` (sem campo de aceite); grep `politica-de-privacidade` em `src/`, `public/`, `docs/` → **0** | M |
| **F1D-009** | ALTO | Terceiros/IA | Conversas vão para a **OpenAI** e ficam em `AIUsageLog`; a política não menciona IA nem OpenAI | `lib/whatsapp/ai/openai.ts:107-114,135-142`; `api/webhooks/whatsapp/route.ts:439-460,474-486`; `prisma/schema.prisma:851-872` | M |
| **F1D-010** | ALTO | Minimização (motoboy) | `/api/delivery-persons/deliveries?all=true` devolve o pedido **inteiro** sem `select` (`paymentId`, `pixPayload`, GPS) | `delivery-page.tsx:134`; `api/delivery-persons/deliveries/route.ts:7,23-30,39` | S |
| **F1D-011** | ALTO | WhatsApp/Meta | **Sem opt-out** (`STOP`/`SAIR`) no bot; notificações de status saem por `sendText` livre fora da janela de 24h | grep `STOP\|SAIR\|opt-out\|unsubscribe` em `src/lib/whatsapp/*` e `webhooks/whatsapp` → **0**; `api/orders/[id]/route.ts:462,572` | M |
| **F1D-012** | MÉDIO | Minimização (KDS) | KDS recebe endereço, lat/lng, `paymentId`, `pixPayload` (CPF **não** é exposto) | `kds/(auth)/screen/page.tsx:110,474-475,499-500`; `api/orders/route.ts:748-755` | S |
| **F1D-013** | MÉDIO | Auditoria | **Sem `AuditLog`/log de acesso**; a página "Logs & Auditoria" é um `Placeholder` | grep `AuditLog\|accessLog` → 0; `admin-saas/(auth)/logs/page.tsx:1-3` | M |
| **F1D-014** | MÉDIO | Logs | OTP em claro e CPF/nome/e-mail logados | `verification/route.ts:155,260`; `orders/route.ts:596`; `payments/asaas/card/route.ts:12`; `webhooks/whatsapp/route.ts:251,363` | S |
| **F1D-015** | MÉDIO | Incidente | **Sem plano/runbook/`security.txt`** (art. 48) | grep `incident\|runbook\|breach\|security.txt` → 0; sem `public/.well-known/security.txt` | M |
| **F1D-016** | MÉDIO | Coerência | 15 divergências concretas política × sistema (ver §4) | ver §4 | M |
| **F1D-017** | MÉDIO | Integridade | Webhook 99 sem assinatura → qualquer um grava em `LogWebhook99` e altera status de pedido | `middleware.ts:19`; `webhooks/99/route.ts:6-22,64-73` | S |
| **F1D-018** | MÉDIO | Transferência int'l | Dados em **US-East**; nada declarado sobre transferência internacional | `.env:1-2` (host `aws-1-us-east-1`); grep `us-east-1\|region` em `src/`, `docs/` → 0 | S (jurídico) |
| **F1D-019** | MÉDIO | Multi-tenant | Webhook WhatsApp faz fallback de cliente **em todos os tenants** por telefone | `webhooks/whatsapp/route.ts:354-362` | S |
| **F1D-020** | MÉDIO | Minimização (admin) | Admin SaaS busca 10 pedidos **completos** (PII das lojas) ainda que a UI não os exiba | `admin-saas/(auth)/dashboard/page.tsx:34-38` vs `:141-148` | S |
| **F1D-021** | MÉDIO | WhatsApp/Meta | OTP com template **`UTILITY` enganoso** em vez de `AUTHENTICATION` | `lib/whatsapp/meta.ts:292-307`; `verification/route.ts:165,187-192` | S |
| **F1D-022** | BAIXO | Controle de acesso | `DELETE /api/orders/delete-all` exige JWT mas **não valida papel** | `api/orders/delete-all/route.ts:7-16` | XS |
| **F1D-023** | MÉDIO | Criptografia | CPF, certificados (.p12), senha de certificado e chaves em **texto puro**; sem cifra campo-a-campo | `schema.prisma:128,133,139,140,237`; grep `pgcrypto\|encrypt\|cipher` → 0 | L |
| **F1D-024** | BAIXO | Minimização | `GET /api/customers` devolve CPF/nascimento mesmo sem a UI exibir | `api/customers/route.ts:57-62`; UI `clientes/page-content.tsx:137-139,192-236` | XS |
| **F1D-025** | MÉDIO | Controle de acesso | `GET /api/establishments?slug=`/`?id=` exige apenas qualquer JWT → usuário de outro tenant lê credenciais da loja | `api/establishments/route.ts:110-151` | S |
| **F1D-026** | BAIXO | Minimização | `GET /api/delivery-persons` devolve `token` e 50 pagamentos de qualquer tenant a qualquer usuário autenticado | `api/delivery-persons/route.ts:6-30` | S |
| **F1D-027** | MÉDIO | Aviso de coleta | Aviso de 10 px no OTP, sem finalidade nem link; cadastro criado **antes** do consentimento | `menu-page.tsx:3613`; `verification/route.ts:42-51,235` | S |
| **F1D-028** | MÉDIO | Opt-in marketing | **Sem opt-in de marketing** (mas `type: "promo"` já existe pronto) | `schema.prisma:1027`; grep no front → 0 | S |
| **F1D-029** | MÉDIO | Headers | Sem config de HSTS/CSP/X-Frame no código (100% dependente do painel Vercel) | `next.config.js` (sem `headers()`); `vercel.json` (só `crons`) | S |

---

## 2. Inventário de dados pessoais tratados

### 2.1 Principais tabelas

| Tabela | Campos relevantes | Acesso | Sensível? |
|---|---|---|---|
| **Customer** (`schema:233-266`) | `name`, `phone`, **`cpf`**, `birthDate`, `email`, `address`, `cep`, `totalSpent`, `loyaltyPoints`, `cancellationCount`, `blockedUntil` | cliente; equipe; **público sem login (F1D-002)** | **CPF = financeiro** |
| **CustomerAddress** (`:268-285`) | rua, nº, bairro, cidade, CEP, complemento | cliente; entregador; loja | pessoal |
| **Order** (`:441-509`) | `customerName/Phone/Address`, **`customerLat/Lng`**, `changeFor`, `paymentId`, `pixPayload`, `notes`, `trackingToken` | **público (F1D-001)**; KDS; caixa; motoboy; admin | **GPS sensível**; financeiro. **Sem CPF/IP no Order** |
| **Review** (`:809-825`), **OrderMessage** (`:774-782`) | comentário, `customerPhone` | cliente; loja | pessoal |
| **PushSubscription** (`:915-929`) | `customerKey` (**= telefone**), `endpoint`, `userAgent` | cliente; SaaS | pessoal + dispositivo |
| **DeliveryPerson** (`:303-317`) | nome, telefone, **`token`** | motoboy; dono | credencial. Sem CNH/documento |
| **User** (`:647-664`) | e-mail, hash, `role`, `permissions` | equipe; admin | credencial |
| **VerificationCode** (`:287-301`) | `codeHash`, expiração | sistema | credencial (hash ok, log em claro — F1D-014) |
| **LogWebhook99** (`:966-973`) | **payload Json bruto** sem dono | sistema/loja | conteúdo de terceiro, sem expurgo |
| **CancellationLog** (`:827-849`) | `customerName`, `customerPhone`, `total` | loja | pessoal + financeiro, sem expurgo |
| **AIUsageLog** (`:851-872`) | **`customerPhone`**, **`userMessage`** (500 chars da conversa), custo | loja; admin | **conteúdo de conversa** |
| **CustomerNotification** (`:1025-1037`) | `type` (inclui `promo`), `title`, `message` | cliente (**público**, F1D-005) | pessoal |
| **FinancialTransaction** (`:1039-1060`), **DeliveryPayment** (`:676-690`), **PartialPayment** (`:797-807`) | valores, `metadata Json` | dono; SaaS | financeiro. **Sem PAN/CVV** |
| **Supplier** (`:573-585`) | CNPJ, telefone, e-mail | dono | PJ |
| **Establishment** (`:11-231`) | contatos + **16 colunas de segredo** | dono; admin; público (F1D-003) | segredo |
| **ProductLike** (`:380-391`) | `deviceKey` = **IP + User-Agent** | público | pseudonímizado, **não declarado** |

### 2.2 Localização (GPS)

- Cliente: `Order.customerLat/Lng` — captura em `menu-page.tsx:2048-2049`, gravação em
  `orders/route.ts:75,423-424`, despacho à 99 em `delivery/dispatch-99/route.ts:43,54-55`.
- Loja: `Establishment.addressLat/Lng` (`schema:107-108`).
- Motoboy: **não há** rastreamento GPS no schema.

### 2.3 Retenção — **não implementada**

Únicos crons: `verify-reminder` (`0 2 * * *`) e `sync-ifood-status` (`*/5 * * *`) (`vercel.json:3-11`).
Limpezas existentes são **operacionais**, nunca temporais: dedupe de push (`lib/push.ts:89-94`,
`push/cleanup/route.ts:24-34`), tokens de reset expirados (`auth/forgot/route.ts:31`) e o wipe
de teste `orders/delete-all/route.ts:13`. **Não há** expurgo de `VerificationCode`, `AIUsageLog`,
`CancellationLog`, `LogWebhook99`, `PushLog`, `OrderMessage`, `Review` ou `Customer`.

### 2.4 Subprocessadores identificados no código

| Subprocessador | Evidência | Dados |
|---|---|---|
| **Vercel** | `vercel.json`, `.env:25` | app inteiro + logs |
| **Supabase (Postgres)** | `.env:1-2` (host `aws-1-us-east-1`), `:3` | base inteira: CPF, GPS, segredos |
| **OpenAI** | `.env:6`; `ai/openai.ts:107-114` (gpt-4o-mini); prompt com último pedido em `ai/prompt.ts:98-129,167-174` | **conteúdo de conversa**; tool `create_order` (`openai.ts:46-54`) envia nome, telefone, endereço, bairro, CEP, referência, **CPF** |
| **Meta / WhatsApp Cloud** | `whatsapp/meta.ts:73-121`; `schema:33-38` | telefone + texto |
| **Evolution API** (não oficial, URL por tenant) | `whatsapp/evolution.ts:18-46`; `schema:29-31` | telefone + texto |
| **iFood** | `integrations/ifood.ts:111,131-133`; `.env:27-28` | nome, telefone, endereço |
| **99 (99Entrega/99Food)** | `delivery/dispatch-99/route.ts:48-56`; `schema:182` | **GPS origem/destino**, PIN |
| **Asaas** | `integrations/asaas.ts:53-54,106-107` | **CPF/CNPJ**, nome, telefone |
| **Pagar.me** | `integrations/pagarme.ts:323-324` | **CPF, IP, dados de cartão em trânsito** |
| **Banco Inter / Efí** | `schema:130-141` | CPF, PIX, **certificado + senha** |
| **Google Maps** | `delivery-page.tsx:561` | endereço do cliente |
| **Web Push (VAPID)** | `.env:10-11` | endpoint do dispositivo + telefone |

---

## 3. Direitos do titular

**Existe:** leitura por telefone/CPF (`api/customers/route.ts:15-49`), lista autenticada
(`:51-62`), correção (`PUT :116-152` — porém **sem auth**, F1D-002), endereço
(`addresses/route.ts:70-155` com checagem de dono), exclusão de notificação
(`notifications/route.ts:59-69`).

**Não existe (grep negativo):**
1. Exclusão/anonimização de `Customer` — `customer.delete*` = **0**; não há `api/customers/[id]`.
2. Exportação/portabilidade — os únicos `exportCSV` são financeiros
   (`financeiro/despesas/page-content.tsx:308`, `financeiro/relatorios/page-content.tsx:44`).
3. Consentimento (`acceptTerms`/`privacyAccepted` ausentes do schema e do cadastro).
4. Revogação de consentimento; opt-in de marketing (F1D-028).
5. Canal automatizado de direitos; encarregado/DPO nomeado (só `admin@flowoshub.com`).
6. Exclusão da conta do estabelecimento.

---

## 4. Divergências política × sistema (15)

| # | A política declara | O código faz | Evidência |
|---|---|---|---|
| 1 | Dados: nome, telefone, endereço, CPF, e-mail (`:34-39`) | também `birthDate`, **GPS**, `cancellationCount`, `blockedUntil`, `deviceKey` (IP+UA), `endpoint`/`userAgent` de push | `schema:238,453-454,244-247,384,915-929`; `menu-page.tsx:2048-2049` |
| 2 | **Não menciona IA** | conversas → OpenAI e `userMessage` persistido | `ai/openai.ts:107-114`; `webhooks/whatsapp/route.ts:483` |
| 3 | Só WhatsApp Cloud da Meta (`:72-79`) | também **Evolution API** (URL por tenant) | `schema:29-31`; `whatsapp/evolution.ts:18-46` |
| 4 | "exclusivamente transacionais… não para marketing" (`:77`) | existe `consumoMarketing` e categoria `marketing`; `type: "promo"` pronto | `schema:47,1027`; `webhooks/whatsapp/route.ts:113` |
| 5 | Declara Meta, pagamentos, entrega, hosting (`:85-88`) | **não declara** OpenAI, Evolution, iFood, 99, Efí, Inter, Google Maps, Supabase, Vercel | §2.4 |
| 6 | "acesso restrito a dados pessoais e monitoramento" (`:95`) | `/api/customers` e `/api/orders` **públicos**; sem log de acesso; painel de logs = `Placeholder` | `middleware.ts:13-14`; `admin-saas/(auth)/logs/page.tsx:1-3` |
| 7 | Retenção "pedidos até 5 anos" (`:102`) | **nenhum job** de retenção | `vercel.json:3-11` |
| 8 | Direitos de acessar/corrigir/excluir/portar/revogar (`:108-116`) | só correção parcial | §3 |
| 9 | "sem cookies de rastreamento" (`:120-123`) | JWT em `localStorage`, `deviceKey` = IP+UA, push com `endpoint`+`userAgent` | `cadastro/page.tsx:80`; `api/products/likes/route.ts:6-7`; `schema:915-929` |
| 10 | Contato `admin@flowoshub.com` (`:141-149`) | sem DPO, sem canal de direitos, sem `security.txt` | grep `DPO\|encarregado` → 0 |
| 11 | "notificaremos alterações significativas" (`:136`) | nenhum mecanismo no código | — |
| 12 | "solicite a exclusão pelo canal" (`:102`) | 100% manual, sem prazo/registro | — |
| 13 | Não define controladora × operadora | relação FlowOS × restaurante indocumentada; **DPA inexistente** | grep `controlador\|dpa` → 0 |
| 14 | — | **política órfã**: 0 links para `/politica-de-privacidade` | grep em `src/`, `public/`, `docs/` → 0 |
| 15 | "não direcionado a menores de 18" (`:127-131`) | nenhuma checagem de idade | grep → 0 |

---

## 5. Criptografia e transporte (detalhe)

- **Trânsito:** HTTPS da Vercel, **sem** `headers()` custom (F1D-029).
- **Senhas:** bcrypt sempre, mas **custos mistos** — 12 em `establishments/route.ts:35`,
  `auth/change-password:40`, `users/change-password:35`, `auth/reset:36`; **10** em
  `users/route.ts:61`, `users/[id]:31`, `delivery-persons:39`, `verification:100`.
- **CPF:** texto puro (`schema:237`), sem `pgcrypto`.
- **Cartão:** não persistido (bom); IP do titular enviado à Pagar.me (`pagarme/card/route.ts:15,21-24`).
- **Admin SaaS:** a query lê pedidos completos (`dashboard/page.tsx:34-38`), mas a UI (Server
  Component) só exibe nº/loja/total/status/data (`:141-148`) → PII não chega ao browser.

---

## 6. O que está bom

1. **Nenhum dado de cartão persistido** — `PaymentRequest`/`PartialPayment` guardam mesa, valor e método.
2. **bcrypt em 100% dos fluxos de senha.**
3. OTP com hash + 5 min + 3 tentativas + limites por número persistidos em banco
   (`verification/route.ts:6-11,60-90,100`).
4. Unicidade `@@unique([establishmentId, phone])` em `Customer` (`schema:264-265`) e checagem de
   dono no `GET` autenticado (`customers/route.ts:52-55`).
5. KDS/cozinha/caixa **não vê CPF** (`orders/route.ts:752` limita o `include.customer`).
6. Rastreamento público devolve subconjunto **sem telefone e sem CPF**
   (`tracking/[id]/route.ts:24-41`).
7. Admin SaaS autenticado em layout **e** em todas as APIs `/api/saas-admin/*`.
8. **Sem** rastreamento GPS de motoboy no schema.
9. **Sem** motor de disparo de marketing implementado (reduz risco de spam sem consentimento).
10. `.env`, `.aider*`, `auditoria/` e o PDF do pedido **não** versionados.
11. `CancellationLog` preserva snapshot de PII para auditoria após exclusão do pedido.
12. Correção/exclusão de endereço com checagem de dono real (`addresses/route.ts:4-12,119-155`).

---

## 7. NÃO VERIFICADO (1D)

Criptografia em repouso do Postgres e política de backups (painel Supabase) · região efetiva dos
backups · HSTS/CSP configurados no painel Vercel · logs de acesso de Supabase/Vercel · estado
real dos templates na Meta Business Suite · residência de dados da Evolution e da OpenAI ·
contrato/DPA da Meta · política de cookies separada · **execução de teste dinâmico** (regra de
somente-leitura) · dump real do banco (pendência da Fase 0) · ambiente multi-loja (pendência da
Fase 0) · `gitleaks` indisponível · valores reais de `evolutionBaseUrl` em produção · uso efetivo
de `NEXT_PUBLIC_PAGARME_ENCRYPTION_KEY` (declarada, sem referência em `src/`).

---

## 8. Top 5 ações (1D)

1. **Tirar `/api/customers` e `/api/orders` de `PUBLIC_ROUTES`** e exigir checagem de dono dentro
   de cada handler, com exceção mínima somente-leitura para o lookup do cardápio (campos públicos
   apenas). *(Fecha F1D-001, 002, 004, 005.)*
2. **Parar de serializar `Establishment` inteiro** para o browser (select explícito em
   `[slug]/page.tsx:64-74`, `POST /api/orders:678-681` e bloqueio cross-tenant em
   `GET /api/establishments`). *(Fecha F1D-003, F1D-025 — mesmos vetores do F1C-002/003.)*
3. **Implementar os direitos do titular**: `GET /api/customers/[id]/export` e
   `DELETE /api/customers/[id]` com cascata/anonimização de `Order`, `Review`, `CancellationLog`,
   `AIUsageLog`, `PushSubscription`, `VerificationCode`. *(F1D-006.)*
4. **Cron de retenção** (`/api/cron/retention` + entrada em `vercel.json`) com prazo por tabela
   — hoje a política de "5 anos" não tem implementação. *(F1D-007.)*
5. **Pacote jurídico mínimo**: Termos de Uso + checkbox com timestamp, link para
   `/politica-de-privacidade` em `/login` e `/cadastro`, reescrita incluindo OpenAI, Evolution,
   iFood, 99, GPS, nascimento, transferência para US-East e encarregado/DPO; e **opt-out
   (`SAIR`/`STOP`)** no bot. *(F1D-008, 009, 011, 016, 018, 027.)*

---

## 9. Lacunas que exigem advogado / consultor de DPO

1. Papéis **controladora × operadora** (FlowOS e cada restaurante) e **DPA**.
2. **Termos de Uso + aceite vinculante** com registro (`acceptTerms` + timestamp/IP).
3. **Nomear e publicar o Encarregado/DPO** (art. 41).
4. **Bases legais por finalidade** e LIA para fidelidade e bloqueio por cancelamento
   (`blockedUntil`, `cancellationCount`).
5. **Transferência internacional** (Supabase US-East, OpenAI, Meta) — SCC/alçada da ANPD.
6. Lista pública de subprocessadores e política de suboperadores.
7. Documento de **retenção/expurgo** por categoria.
8. **Runbook de incidente** (art. 48) com prazos de comunicação.
9. **RIPD/DPIA** para GPS do cliente, IA generativa com conteúdo de conversa e bloqueio automático.
10. Adequar a política ao real (15 divergências) e torná-la acessível.
