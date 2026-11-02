# FlowOS — Documentação do Sistema

> Documento técnico de referência do **FlowOS** (nome do repositório: `atendimento`).
> Descreve stack, arquitetura, fluxos de negócio, modelo de dados, API, segurança,
> observabilidade, operação e desenvolvimento.
>
> Documentos relacionados:
> - `docs/RUNBOOK.md` — incidentes (5 cenários) + rotação de chaves
> - `docs/ADMIN_SAAS.md` — painel administrativo do SaaS
> - `docs/WHATSAPP_BOT.md` — bot de WhatsApp (detalhado)
> - `AGENTS.md` — contexto operacional do projeto/auditoria
> - `auditoria/` — relatórios das 10 fases de auditoria + `PROGRESSO.md`

---

## 1. Visão geral

**FlowOS** é um SaaS multi-tenant para restaurants e lanchonetes: cardápio digital
público, PDV, KDS (cozinha), WhatsApp bot com IA, delivery, estoque/ficha técnica,
financeiro e um painel SaaS para o operador da plataforma.

| | |
|---|---|
| **Stack** | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind 3 · Prisma 5 · PostgreSQL (Supabase) · Vercel |
| **Multi-tenant** | Isolamento por `establishmentId` em **todas** as tabelas e rotas de API |
| **Integrações** | WhatsApp (Meta Cloud API / Evolution API) · OpenAI (bot) · Pagar.me (PIX/cartão/split) · Inter (PIX) · iFood · 99Food · 99Entrega · Web Push (VAPID) · ViaCEP · Supabase Storage |
| **Deploy** | Vercel (build automático no push em `main`) · CI em GitHub Actions |

### Superfícies do produto

| Superfície | Rota | Quem usa |
|---|---|---|
| Cardápio público | `/[slug]` | Cliente final (pede, acompanha, paga) |
| Cardápio do cliente (autent.) | `/[slug]` + OTP | Cliente final logado (endereços, pedidos, fidelidade) |
| Mesa (QR na mesa) | `/[slug]/mesa/[number]` | Cliente na mesa |
| Acompanhamento | `/pedido/[id]` | Cliente final (tracking público por token) |
| Entrega (motoboy) | `/[slug]/entregas/[token]` | Entregador (handshake, PIN) |
| Operação da loja | `/dashboard/*` | Lojista/equipe (pedidos, cardápio, estoque, financeiro, chat, clientes, config) |
| PDV (balcão) | `/caixa` | Operador de balcão (venda, mesas, caixa, impressão) |
| Cozinha (KDS) | `/kds` | Cozinha (fila, status, mensagens) |
| Operação da loja (backoffice leve) | `/[slug]/staff` | Equipe da loja (KDS/pedidos simplified) |
| Painel SaaS | `/admin-saas/*` | Time FlowOS (tenants, planos, templates, custos de IA) |
| Admin técnico | `/admin` | Suporte técnico |

---

## 2. Arquitetura

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Cardápio    │   │  Dashboard   │   │    PDV       │   │     KDS      │
│  público     │   │  /caixa      │   │  /kds        │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │                  │
       └──────────────────┴──────────┬───────┴──────────────────┘
                                     │  Next.js 14 (App Router)
                          ┌──────────▼───────────┐
                          │  Route Handlers      │  src/app/api/**
                          │  (middleware → auth  │
                          │   → controller → lib) │
                          └──────────┬───────────┘
         ┌───────────────┬───────────┼────────────┬──────────────┐
         ▼               ▼           ▼            ▼              ▼
   ┌──────────┐   ┌───────────┐ ┌────────┐ ┌────────────┐ ┌───────────┐
   │  Prisma  │   │  WhatsApp │ │  IA    │ │ Pagamentos │ │ Market-   │
   │ Postgres │   │ Meta/Evo  │ │ OpenAI │ │Pagar.me/Inter│ │place iFood│
   └──────────┘   └───────────┘ └────────┘ └────────────┘ └───────────┘
```

### Organização do código

```
src/
├─ app/                    # rotas (App Router): páginas + API
│  ├─ [slug]/              # cardápio público + mesa + staff + entregas
│  ├─ dashboard/(auth)/    # backoffice da loja
│  ├─ admin-saas/(auth)/   # painel do SaaS
│  ├─ caixa/               # PDV
│  ├─ kds/(auth)/screen/   # tela de cozinha
│  └─ api/                 # 143 route handlers
├─ components/             # UI compartilhada (ui/, toast, charts, PWA)
├─ hooks/                  # use-submit-guard, use-visibility-refresh, ...
├─ lib/                    # regras de negócio (ver §6)
└─ middleware.ts           # autenticação por rota + request-id
prisma/schema.prisma       # 47 models
docs/                      # documentação
auditoria/                 # relatórios de auditoria (10 fases)
```

### Fluxo de uma requisição

1. **`src/middleware.ts`** — para `/api/*`: injeta `x-request-id`, valida o JWT
   (`Authorization: Bearer`), repassa `x-user-id`/`x-establishment-id`/`x-user-role`.
   Rotas em `PUBLIC_ROUTES` passam sem token.
2. **Route handler** — valida entrada, chama `requireAuth` / `requireEstablishment`
   (401 sem token, **403** se o `establishmentId` divergir).
3. **Regra de negócio** em `src/lib/*` (preço, estoque, horário, estado do pedido).
4. **Prisma** — acesso a dados; toda query de pedido é filtrada por `establishmentId`.
5. **Resposta** — JSON; erros no formato `{ "error": "..." }`.

---

## 3. Modelo de dados (47 models)

### Núcleo

| Model | Papel |
|---|---|
| `Establishment` | Tenant. Configuração (horários, temas, taxas, fidelity, IA, integrações, plano) |
| `User` | Operador da loja. `role` + `permissions` (JSON) + `canCloseRegister` |
| `Customer` | Cliente final do tenant (telefone, pontos, total gasto) |
| `CustomerAddress` | Endereços do cliente |
| `VerificationCode` | OTP de verificação (bcrypt, expira, max. 3 tentativas) |
| `PasswordResetToken` | Token de redefinição de senha (1h) |

### Cardápio

`Category` · `Product` · `ProductLike` · `AdditionalOption` (opções com adicional e
consumo de estoque) · `DailyCombo` + `DailyComboItem` · `Story`/`StoryItem` ·
`Banner` · `Coupon` · `CategoryTemplate` · `GlobalQuickReply`

### Pedidos

`Order` (itens em JSON, cupom, fidelidade, taxa, janela de entrega, endereço, canal
`method`: `site`/`bot`/`whatsapp`/`pdv`/`mesa`) · `OrderItemCost` (snapshot de CMV) ·
`OrderMessage` (chat pedido↔loja) · `CancellationLog` · `PaymentRequest` ·
`PartialPayment` · `FinancialTransaction` · `Review`

**Estados do pedido** (máquina em `src/lib/order-transitions.ts`):

```
payment_pending → pending → new → confirmed → accepted → preparing → ready
                 → dispatched → out_for_delivery → delivered
                 ↘ cancelled / abandoned  (terminais — sem volta)
```

- Progresso **só para frente**; cancelamento permitido de qualquer estado não-final.
- `kds` só grava `accepted|preparing|ready`; `motoboy` não muda status.
- Pagamento **tardio** em pedido `cancelled`/`abandoned` não ressuscita o pedido
  (`isClosedOrderStatus()`).

### Operação

`StockFamily` · `StockCategory` · `StockItem` · `StockMovement` · `Supplier` ·
`Purchase`/`PurchaseItem` · `ProductStockLink` (ficha técnica: insumo → produto) ·
`CashRegister` · `CashTransfer` · `CashMovement` · `Expense` · `DeliveryPerson` ·
`DeliveryPayment` · `DeliveryZone` · `PushSubscription`/`PushLog` ·
`CustomerNotification` · `AIUsageLog` · `LogWebhook99` · `SystemConfig`

### Índices relevantes

`Order`: `(establishmentId, orderNumber)` **único**, `(establishmentId, externalId)`
**único**, `establishmentId+createdAt`, `establishmentId+status`,
`establishmentId+tableNumber+orderType`, `establishmentId+deliveryPersonId`,
`establishmentId+isScheduled+deliveryDate`, `paymentId`, `customerId`.

> **Produção usa `prisma db push`** (sem tabela `_prisma_migrations`). Alterar
> schema exige decisão do dono + backup.

---

## 4. Autenticação e autorização

| Ator | Mecanismo | Onde |
|---|---|---|
| **Operador da loja** | JWT (`jsonwebtoken`), `Authorization: Bearer`, expiração 24h | `src/lib/auth.ts`, `src/app/api/auth/*` |
| **Refresh do operador** | Refresh token rotativo → access token | `POST /api/auth/refresh` |
| **KDS** | Login próprio (`/api/auth/kds-login`) → access 24h + refresh 30d em cookie httpOnly `kds_refresh` (path `/api/auth/kds-refresh`) | `src/app/api/auth/kds-*` |
| **Cliente final** | OTP por WhatsApp → cookie httpOnly `flowos_customer` (JWT 30d) | `src/lib/customer-auth.ts`, `POST/PUT/DELETE /api/verification` |
| **Admin SaaS** | Cookie httpOnly `saas_admin_token` | `src/lib/saas-admin-auth.ts` |

### Papéis do operador

`admin` · `atendente` (padrão) · `caixa` · `kds` · `motoboy` · `saas_admin`

`permissions` (JSON, ex.: `["caixa","config"]`) controlam acesso às telas do
dashboard; `requireEstablishment()` garante que o token só enxerga o próprio tenant.

### Rotas públicas (`PUBLIC_ROUTES` do middleware)

`/api/auth` · `/api/customers` · `/api/orders` · `/api/verification` ·
`/api/tracking` · `/api/push` · `/api/reviews` · `/api/addresses` ·
`/api/payment-request` · `/api/pix-generate` · `/api/coupons` · `/api/icon` ·
`/api/manifest` · `/api/products` · `/api/categories` · `/api/banners` ·
`/api/stories` · `/api/daily-combos` · `/api/additional-options` · `/api/delivery` ·
`/api/table-status` · `/api/partial-payment` · `/api/delivery-persons/deliveries` ·
`/api/users/change-password` · `/api/webhooks` · `/api/cron` · `/api/payments` ·
`/api/bot` · `/api/establishments` · `/api/subscription/webhook` · `/api/saas-admin` ·
`/api/health`

> `PUBLIC_ROUTES` é o **allowlist do middleware** (a requisição passa sem JWT).
> Isso **não** significa "rota sem proteção": cada handler aplica a sua própria
> regra — token de tracking (`?token=`), cookie de sessão do cliente
> (`flowos_customer`), assinatura de webhook ou segredo de cron. A "publicidade"
> é do *canal*, não da *autorização*.
>
> Nota: `/api/products` e `/api/coupons` constam no allowlist, mas **não têm rota
> implementada** (`/api/products` responde pelo establishment + sub-rotas
> `featured|likes|[id]/like`; coupons é pendência adiada — F6B-012).

### Regras de segurança implementadas

- **Strip de credenciais** em todo endpoint público: `password`, `evolutionApiKey`,
  `metaAccessToken`, `metaWebhookVerifyToken`, `interClientSecret`,
  `interCertificate(+Password)`, `pagarmeApiKey`, `pagarmeWebhookKey`, `api99Key`,
  `ifoodAccessToken`, `ifoodRefreshToken`, `nineFoodApiKey`.
- **Preço no servidor**: o `total` enviado pelo cliente é ignorado
  (`buildOrderInput` recalcula preço, cupom, taxa, mínimo e fidelidade).
- **OTP**: bcrypt, 3 tentativas, resposta unificada (não revela se o número existe),
  rate limit por IP (20/h), código nunca em log (apenas com `SHOW_DEV_CODE=true`).
- **Senhas**: bcrypt; reset por token de 1h; link **nunca** vai para o log.
- **Segredos**: `src/lib/redact.ts` redige tokens/chaves antes de logar.
- **CSP + headers**: `next.config.js` define `Content-Security-Policy`,
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS e
  `Permissions-Policy`.
- **XSS**: cupons de impressão usam `printHtmlPopup` (Blob URL + escape).
- **Rate limit** por pedido/IP no handshake de entrega (8/5min e 12/5min).

---

## 5. API (resumo por área)

> Sufixos: `route.ts` em `src/app/api/**`. `🔓` = público, `🔒` = exige JWT,
> `👑` = admin SaaS.

### Autenticação e sessão
`POST /api/auth/login` 🔓 · `POST /api/auth/refresh` 🔓 · `POST /api/auth/kds-login` 🔓 ·
`POST /api/auth/kds-refresh` 🔓 · `POST /api/auth/change-password` 🔓 ·
`POST /api/auth/forgot` 🔓 · `POST /api/auth/reset` 🔓

### Verificação do cliente (OTP)
`POST /api/verification` 🔓 (inicia; valida tenant, plano e cota Meta) ·
`PUT /api/verification` 🔓 (confirma; emite cookie `flowos_customer`) ·
`DELETE /api/verification` 🔓 (logout)

### Pedidos
`POST /api/orders` 🔓 (criação; servidor é a fonte do preço) · `GET /api/orders` 🔒
(lista com `status`, `since`, `take`) · `PATCH /api/orders/[id]` 🔒 (máquina de
estados) · `GET /api/orders/customer` 🔓+sessão cliente ·
`GET|POST|PATCH /api/orders/messages` 🔒 · `GET|POST|PATCH /api/orders/[id]/messages` 🔒 ·
`PATCH /api/orders/transfer` 🔒 (transferência de mesa) ·
`GET /api/orders/[id]/payment-status` 🔓+token do pedido ·
`POST /api/orders/[id]/delivery-handshake` · `POST /api/orders/[id]/ifood-handshake` ·
`POST /api/orders/sync` · `POST /api/orders/ifood-poll` · `DELETE /api/orders/delete-all`

### Pagamentos
`POST /api/payments/pagarme/qr-code` 🔓 (PIX) · `POST /api/payments/pagarme/card` 🔓
(cartão) · `POST /api/payments/inter/qr-code` 🔓 (PIX Inter) ·
`POST /api/webhooks/pagarme` 🔓 (webhook do gateway, assinatura) ·
`GET|POST|DELETE /api/partial-payment` · `GET|POST|PATCH /api/payment-request` ·
`POST /api/pix-generate` 🔓 · `POST /api/delivery-payments`

### Cardápio (público)
`GET /api/establishments?id=|slug=` 🔓 (dados da loja **+ cardápio**
`categories→products`, sem credenciais) · `GET /api/products/featured` 🔓 ·
`GET /api/products/likes` 🔓 · `POST /api/products/[id]/like` 🔓 ·
`GET /api/categories` 🔓 · `GET /api/daily-combos` 🔓 ·
`GET /api/additional-options` 🔓 · `GET /api/banners` 🔓 · `GET /api/stories` 🔓 ·
`GET /api/manifest/[slug]` 🔓 · `GET /api/icon/[slug]` 🔓 ·
`GET /api/reviews` 🔓 · `POST /api/reviews` 🔓

> A página `/[slug]` é um **Server Component**: lê a loja e o cardápio direto do
> Prisma e renderiza o HTML já com os preços (sem round-trip no primeiro load).

> ⚠️ `/api/coupons` ainda **não existe** (CRUD + validate adiado — F6B-012),
> embora a rota esteja listada em `PUBLIC_ROUTES` do middleware.

### Operação da loja
`GET|PATCH|DELETE /api/products/[id]` 🔒 · `POST /api/products/update-prices` 🔒 ·
`POST /api/products/[id]/stock-links/reset` 🔒 ·
`GET|POST|PATCH|DELETE /api/categories` 🔒 (cria **categoria ou produto** —
`type: "category" | "product"`) ·
`GET|POST|PATCH|DELETE /api/additional-options` 🔒 ·
`GET|POST|PATCH|DELETE /api/daily-combos` 🔒 ·
`GET|POST /api/admin/stories` 🔒 · `PATCH|DELETE /api/admin/stories/[id]` 🔒 ·
`GET|POST /api/admin/banners` 🔒 · `PATCH|DELETE /api/admin/banners/[id]` 🔒 ·
`GET|POST /api/stock` 🔒 ·
`GET|POST|DELETE /api/stock/links` 🔒 (ficha técnica) · `GET|POST|PATCH|DELETE /api/suppliers` 🔒 ·
`GET|POST /api/purchases` 🔒 · `GET|POST /api/users` 🔒 (admin) ·
`PATCH|DELETE /api/users/[id]` 🔒 · `GET /api/dashboard` 🔒 ·
`GET /api/financial/{dre,cash-flow,revenues,cmv}` 🔒 · `GET|POST /api/expenses` 🔒 ·
`GET|POST /api/cash-register` 🔒 · `PATCH /api/cash-register/[id]` 🔒 ·
`POST /api/cash-register/close-table` 🔒 · `POST /api/cash-register/[id]/transfer` 🔒

### Entregas
`GET /api/delivery/calculate` 🔓 (taxa por zona/distância) ·
`GET|POST|PUT|DELETE /api/establishments/[id]/delivery-zones` 🔒 ·
`GET|POST /api/delivery-persons` 🔒 · `PATCH|DELETE /api/delivery-persons/[id]` 🔒 ·
`GET|PATCH /api/delivery-persons/deliveries` 🔓+token do entregador ·
`POST /api/delivery/dispatch-99` 🔒 · `GET /api/delivery/poll-99` 🔒

### WhatsApp, bot e IA
`POST /api/webhooks/whatsapp` 🔓 (Evolution/Meta; ACK imediato + `waitUntil`) ·
`GET /api/webhooks/whatsapp` 🔓 (verificação do webhook Meta) ·
`POST /api/bot/create-order` 🔓 (criação de pedido pelo bot) ·
`POST /api/establishments/[id]/meta-*` 🔒 (connect, discover, embedded signup,
profile picture, template, quota, status) ·
`POST /api/establishments/[id]/whatsapp-connect|disconnect` 🔒 ·
`GET /api/establishments/[id]/whatsapp-status` 🔒

### Marketplace
`POST /api/orders/ifood-webhook` 🔓 · `POST /api/orders/99food-webhook` 🔓 ·
`POST /api/webhooks/99` 🔓 (99Entrega, assinatura) ·
`GET /api/ifood-catalog` 🔒 · `POST /api/ifood-catalog/{sync,push,import}` 🔒

### Plataforma
`GET /api/health` 🔓 (`?deep=1` consulta o banco) · `GET /api/alerts` 🔒 ·
`POST /api/subscription/create` 🔒 · `POST /api/saas-admin/login|logout` 👑 ·
`GET|POST /api/saas-admin/pagamentos` 👑 · `GET|POST|PUT|DELETE /api/saas-admin/templates` 👑 ·
`GET|PUT|DELETE /api/saas-admin/quick-replies` 👑 · `PUT /api/saas-admin/establishments/[id]/*` 👑

### Push e uploads
`POST /api/push` · `POST|DELETE /api/push/subscribe` · `GET /api/push/vapid-key` ·
`GET /api/push/diagnose|cleanup|order-details` · `POST /api/upload` (Supabase Storage)

### Crons (ver §8)

---

## 6. Regras de negócio (`src/lib`)

| Módulo | Responsabilidade |
|---|---|
| `order-input.ts` | **Fonte de verdade do pedido**: valida itens (tenant, disponibilidade), recalcula preço/promo/destaque/adicionais, taxa, mínimo, agendamento, cupom, fidelidade e bônus de 1ª compra. Ignora `total` do cliente. |
| `order-transitions.ts` | Máquina de estados do pedido; `isClosedOrderStatus()` (pagamento tardio) |
| `store-hours.ts` | `isEstablishmentOpen()` — horário commercial, `isOpenOverride`, horário que cruza meia-noite |
| `stock.ts` | `deductOrderStock` / `restoreOrderStock` (ficha técnica + opções), contador de falhas |
| `cmv.ts` | Custo de mercadoria vendida por item (snapshot no pedido) |
| `finance-dates.ts` | Fuso `BUSINESS_TZ` (America/Sao_Paulo) para agrupamentos e limites do financeiro |
| `customer-auth.ts` | Sessão do cliente (cookie httpOnly 30d) |
| `auth.ts` / `require-auth.ts` | JWT, `requireAuth`, `requireEstablishment` (401/403) |
| `rate-limit.ts` | Rate limit em memória (janela deslizante) |
| `redact.ts` | Redação de segredos/PII nos logs |
| `logger.ts` | Log estruturado JSON + request-id |
| `items.ts` | `parseOrderItems` — parse seguro de `Order.items` |
| `fetch-external.ts` | Timeout 15s + retry exponencial (só método idempotente) |
| `webhook-99.ts` | Processamento de eventos da 99 (compartilhado entre webhook e replay) |
| `webhook-signature.ts` | Comparação em tempo constante de assinaturas |
| `meta-quota.ts` | Cota e custo da Meta Cloud API |
| `push.ts` | Web Push (VAPID) |
| `phone.ts` | Normalização de telefone BR (55/0055) |
| `units.ts` | Conversão de unidades de medida |
| `storage.ts` | `localStorage` versionado + migração sem perda |
| `theme.ts` | Tema claro/escuro (classe no `<html>`) |
| `print-html.ts` | `printHtmlPopup` — impressão via Blob URL, com status |
| `cmv.ts`, `payment-notifications.ts` | CMV e notificações de pagamento |
| `integrations/*` | Adaptadores: `pagarme`, `inter`, `ifood*`, `nine-nine`, `nine-food*` |

---

## 7. Fluxos principais

### 7.1 Pedido no cardápio público
1. Cliente escolhe itens → **preço exibido** vem do servidor (GET público).
2. `POST /api/orders` → `buildOrderInput()` revalida tudo (produto ativo, disponível
   online, preço, cupom, taxa por zona/distância, mínimo, fidelidade).
3. Transação: cria `Order` + debita estoque (`deductOrderStock`) + grava CMV.
4. Se pagamento online → gera cobrança (Pagar.me/Inter); status `payment_pending`.
5. Webhook/polling confirma → `paymentStatus=paid` e o pedido segue a máquina de
   estados. Se o pedido já estava `cancelled`/`abandoned`, o pagamento **não**
   ressuscita (reembolso manual).
6. Cliente acompanha em `/pedido/[id]` (token de tracking) e recebe push.

### 7.2 PDV (balcão)
`/caixa` → produtos (grade) → carrinho (drawer no celular, FAB) → adicional/troco →
`ConfirmDialog` → `POST /api/orders` (canal `pdv`, `status=new`) → impressão do cupom
→ fecha/abre caixa (`/api/cash-register`). Reentrância bloqueada por
`use-submit-guard` (client-side) e `res.ok` antes de todo toast de sucesso.

### 7.3 KDS (cozinha)
`/kds` → login (`kds-login`) → poll de 5s (`GET /api/orders?status=ativos,cancelled&take=300`).
Cada card avança status (accepted → preparing → ready) via `PATCH /api/orders/[id]`
(restrito a `kds`). Sessão: access 24h + refresh 30d (`kdsFetch()` renova e repete 1×).
"Modo TV" (zoom 1×/2×) e colunas responsivas. Relógio calibrado pelo header `Date`.

### 7.4 WhatsApp bot
`POST /api/webhooks/whatsapp` (Evolution ou Meta) → valida assinatura (Meta) →
**ACK imediato** → processamento em background (`waitUntil`):
status do pedido → bot determinístico (`bot.ts`) ou **IA** (OpenAI com até 3
iterações de tool-calling e tool `create_order`) → envio da resposta.
Inatividade → transferências para atendente; templates de status por pedido.

### 7.5 Entrega
Taxa por zona/distância (`/api/delivery/calculate`) → motoboy recebe pedido
(`/api/delivery-persons/deliveries`) → handshake na entrega (PIN de 4 dígitos
criptográfico, rate limited) → `delivered`. Com `tipoEntregaAtiva=99entrega`:
`dispatch-99` cria a corrida (recusa duplicidade) e o webhook da 99 atualiza o status.

### 7.6 Financeiro
Receitas, despesas, DRE, fluxo de caixa e CMV agregados por **`finance-dates.ts`**
(fuso do negócio). `CashMovement` recebe sinal (venda/expense/withdrawal/injection/refund).
CMV vem do snapshot `OrderItemCost`. Pedidos `cancelled`/`abandoned`/`payment_pending`
ficam fora das métricas.

---

## 8. Crons e tarefas agendadas

Definidos em `vercel.json` (`functions.maxDuration: 60`):

| Cron | Schedule | O que faz |
|---|---|---|
| `/api/cron/verify-reminder` | `0 * * * *` | Lembrete de OTP não confirmado (15 envios/tenant/hora) |
| `/api/cron/meta-quota` | `0 * * * *` | Consulta cota e custo da Meta |
| `/api/cron/sync-ifood-status` | `*/5 * * * *` | Reconcilia status de pedidos iFood (ignora lojas em pausa manual) |
| `/api/cron/expire-orders` | `*/5 * * * *` | Expira pedidos não aceitos → `abandoned` + estorno de estoque + reversão de fidelidade |
| `/api/cron/replay-webhooks` | `*/10 * * * *` | Reprocessa eventos 99 "pendente"/"erro" (>2 min, máx. 50) |
| `/api/cron/reset-ai-usage` | `0 0 1 * *` | Zera contador mensal de mensagens de IA |

Autenticação: `Authorization: Bearer $CRON_SECRET` (se `CRON_SECRET` não estiver
definido, a rota aceita chamada manual — **configure em produção**).

---

## 9. Observabilidade

- **Health check**: `GET /api/health` → `{ status, checks: { database, env }, alerts, uptimeSeconds }`.
  `?deep=1` executa `SELECT 1` no banco. 503 se algo essential falhar.
  `alerts.stockRestoreFailures` expõe falhas de estorno de estoque.
- **Request-id**: `x-request-id` gerado no middleware (ou propagado do proxy),
  devolvido na resposta e incluído nos logs.
- **Log estruturado**: `src/lib/logger.ts` → JSON `{ level, scope, message, time, ...contexto }`.
  Contextos redigidos automaticamente.
- **Scopes ativos**: `webhook-ifood`, `webhook-99`, `webhook-99food`, `webhook-pagarme`,
  `orders-post`, `orders-patch`, `payment-status`, `verification`.
- **Alertas**: `GET /api/alerts` (estoque baixo, falhas).
- **Auditoria de cancelamento**: `CancellationLog` (origem, motivo, quem cancelou).
- **Incidentes**: ver `docs/RUNBOOK.md`.

---

## 10. Variáveis de ambiente

### Obrigatórias
| Variável | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL (Supabase) |
| `JWT_SECRET` | Assinatura de JWT (operador, KDS, cliente, admin SaaS) |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_BASE_URL` | URL pública (links de tracking, bot) |
| `CRON_SECRET` | Autenticação dos crons |

### Pagamentos
`PAGARME_API_KEY` · `PAGARME_ENVIRONMENT` (`sandbox`/`production`) ·
`PAGARME_WEBHOOK_KEY` · `PAGARME_SAAS_RECIPIENT_ID` (split do SaaS) ·
`INTER_CLIENT_ID`/`INTER_CLIENT_SECRET`/`INTER_CERTIFICATE`/`INTER_CERTIFICATE_PASSWORD`
(também por tenant, no banco)

### WhatsApp / IA
`META_APP_ID` · `META_APP_SECRET` · `META_WEBHOOK_VERIFY_TOKEN` ·
`NEXT_PUBLIC_META_APP_ID` · `NEXT_PUBLIC_META_CONFIG_ID` ·
`SAAS_EVOLUTION_BASE_URL` · `SAAS_EVOLUTION_API_KEY` · `SAAS_EVOLUTION_INSTANCE` ·
`SAAS_META_ACCESS_TOKEN` · `SAAS_META_PHONE_NUMBER_ID` · `OPENAI_API_KEY`

### Marketplaces
`IFOOD_CLIENT_ID` · `IFOOD_CLIENT_SECRET` · `WEBHOOK_99_SECRET` ·
`IFOOD_WEBHOOK_SECRET` (por tenant no banco)

### Outros
`SUPABASE_URL` · `SUPABASE_ANON_KEY` (Storage) · `VAPID_PRIVATE_KEY` ·
`VAPID_PUBLIC_KEY` · `NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_SUBJECT` ·
`BUSINESS_TZ` (default `America/Sao_Paulo`) · `SHOW_DEV_CODE` (exibe OTP/link de
reset em dev — **nunca** em produção) · `NEXT_PUBLIC_BUILD_ID` (versão do PWA)

> **Segredos por tenant** (Evolution, Meta, Pagar.me, Inter, iFood, 99) ficam no
> banco, por estabelecimento, e são **stripados** de qualquer resposta pública.

---

## 11. Desenvolvimento

```bash
npm install                # postinstall: prisma generate
npm run dev                # http://localhost:3000 (mata a porta 3000 antes)
npm run setup              # db push + generate + seed (ambiente novo)

npm run lint               # next lint
npx tsc --noEmit           # typecheck
npm test                   # vitest run (165 testes)
npm run build              # build de produção
```

### Banco
```bash
npm run db:generate        # regenera o client (não toca o banco)
npm run db:push            # aplica o schema (PRODUÇÃO: exige decisão do dono)
npm run db:studio          # Prisma Studio
npm run db:seed            # seed (não imprime senha)
npm run db:reset           # reset destrutivo — exige DB_ALLOW_RESET=1
```

### Testes
Vitest, sem banco real (Prisma mockado). Suites em `src/lib/__tests__/` e
`src/app/api/**/__tests__/`: regras de pedido, horários, estados, estoque, taxas,
fuso financeiro, rate limit, sessão de cliente, telefone, parse de items, redação
de segredos, retry externo, webhooks (99, iFood, Pagar.me).

### Gate obrigatório (antes de commit/push)
```bash
rm -rf .next/types && npx tsc --noEmit && npx vitest run && npm run build
```

### CI
`.github/workflows/ci.yml` — em push em `main` e em PR: `npm ci` → lint →
typecheck → `npm test` → build. Placeholders de env no CI (nenhum segredo real).

---

## 12. Deploy e operação

- **Vercel**: build automático no push em `main`; `vercel.json` define crons,
  `maxDuration: 60` e `functions` específicas.
- **Banco**: Supabase Postgres; produção usa `db push` (sem histórico de migrations).
- **PWA**: `public/sw.js` versionado por `NEXT_PUBLIC_BUILD_ID` (`/sw.js?v=<id>`);
  o app mostra banner "nova versão disponível" (`src/components/pwa/update-banner.tsx`).
- **Headers/CSP**: definidos em `next.config.js` (aplicados a `/:path*`).
- **Tema**: `darkMode: "class"` no Tailwind; script inline no layout raiz evita flash.
- **Backup/rollback**: ver `docs/RUNBOOK.md` §6 (rotação de chaves) e confirmar a
  política de backup com o responsável (fora do repositório).

### Riscos conhecidos / pendências do dono

1. `Idempotency-Key` no `POST /api/orders` (exige coluna + `db push`).
2. APM/error tracking (Sentry) — decisão de dependência.
3. Gate de status check do CI no deploy (config no painel da Vercel).
4. `WEBHOOK_99_SECRET` e `IFOOD_WEBHOOK_SECRET` — sem eles o webhook é *fail-open*.
5. Fechar a sandbox de ativação de plano sem pagamento (decisão de produto).
6. LGPD: delete de `Customer` e base legal de retenção.
