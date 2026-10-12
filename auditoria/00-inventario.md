# FASE 0A — INVENTÁRIO DO SISTEMA

**Data:** 08/10/2026 · **Escopo:** mapeamento completo de superfície (código, banco, endpoints, env, dependências) · **Regras:** seção 2 do arquivo de auditoria (somente leitura).

---

## 1. Checklist de entradas (seção 3)

| # | Entrada exigida | Status | Evidência / limitação |
|---|---|---|---|
| 1 | Código-fonte completo | ✅ PRESENTE | Repo git local (`/Users/mac/Projetos/Atendimento`), 333 arquivos `.ts/.tsx` em `src/`, 64.555 linhas |
| 2 | Dump do schema com policies/RLS (`supabase db dump --schema-only`) | ❌ NÃO APLICÁVEL | **Não existe pasta `supabase/` nem `config.toml`** (`ls -d supabase` → "sem pasta supabase"). O banco é **Prisma + PostgreSQL** (`prisma/schema.prisma:6-8`). RLS não é gerenciável por migrations locais. → Limitação registrada |
| 3 | Migrations versionadas | ✅ PRESENTE (divergente) | `prisma/migrations/` com 4 migrations: `20260622_add_pickup_delivery_messages`, `20260730_bot_v2_features`, `20260730_scheduled_orders`, `20260825_add_pagarme_split_receiver_id` |
| 4 | Lista de variáveis de ambiente (só nomes) | ✅ PRESENTE | `.env` (28 nomes), `.env.local` (3), `.env.backup`. Ver §5 |
| 5 | `package.json`, lockfile, `vercel.json`, `next.config.*`, `supabase/config.toml` | ⚠️ PARCIAL | `package.json`, `package-lock.json`, `vercel.json`, `next.config.js`, `tsconfig.json`, `.eslintrc.json`, `vitest.config.ts` presentes. **`supabase/config.toml` NÃO EXISTE** |
| 6 | Security/Performance Advisor do Supabase | ❌ FALTA | Não fornecido; além disso o projeto não usa Supabase Postgres como banco (só Storage) |
| 7 | Plano atual Vercel e Supabase | ❌ FALTA | Não fornecido. Existe `.vercel/project.json` (`prj_SNsjui3QZmpt9zzrNLjTmMk50ji3`, org `team_xCQcMFUQ8ccOKruHrkLre5Bk`), mas sem tier/plano |
| 8 | Estimativa de uso (lojas, pedidos/dia, pico) | ❌ FALTA | Não fornecido |
| 9 | Status de cada integração (homologada/em teste/não iniciada) | ❌ FALTA | Não fornecido. Só é possível afirmar o que **existe no código** (§4.4) |
| 10 | Emissão fiscal (NFC-e/SAT/TEF) | ❌ FALTA | Não fornecido. `grep -ri "nfc-e\|sat\|tef"` não encontrado no código |
| 11 | Dois usuários/lojas de teste (loja A e B) | ❌ NÃO CONFIRMADO | Existe `scripts/seed-test-establishment.ts`, `prisma/seed.ts`, `prisma/dev.db`, mas **não foi confirmado ambiente de teste** nem credenciais fictícias. Nenhum teste dinâmico executado (regra 2.5) |

**Conclusão:** 3 de 11 entradas presentes (sendo 1 divergente do formato esperado), 8 ausentes. Segue-se com o que existe; todas as lacunas acima limitam as fases 1 (RLS/Advisor), 3 (plano/custo), 5 (status de integrações) e 9 (fiscal).

---

## 2. Divergência de stack (informativo para todas as fases)

O arquivo de auditoria descreve: *"Vercel + Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)"*.

O que o código realmente mostra:

| Componente esperado | Realidade no código | Evidência |
|---|---|---|
| Supabase Postgres (com RLS) | **Prisma + PostgreSQL** via `DATABASE_URL` | `prisma/schema.prisma:6-8`, `src/lib/prisma.ts` |
| Supabase Auth | **JWT próprio** com `jose` + `bcryptjs` | `middleware.ts:4`, `src/lib/auth.ts:13-41`, `src/app/api/auth/login/route.ts` |
| Supabase Realtime | **NENHUM uso** — `grep "\.channel(\|postgres_changes\|realtime"` → 0 ocorrências | — |
| Supabase Edge Functions | **NENHUMA** — rotas são Next.js `route.ts` (148 arquivos) | — |
| Supabase Storage | ✅ USADO (buckets `images` e `Imagens`) | `src/lib/image-upload.ts:29,39,67,77`; `src/app/api/ifood-catalog/import/route.ts:103,110` |

**Consequência:** os achados de "Tabela sem RLS = CRÍTICO" da Fase 1B devem ser traduzidos para **"isolamento multi-tenant feito por código na aplicação"** — o que é uma superfície muito maior (148 endpoints) do que policies em SQL. A Fase 1B fica **ainda mais crítica** que o previsto.

---

## 3. Tabela de módulos

Cobertura conforme exigido: entregas, dashboard, pedidos, cardápio, caixa gerencial, PDV, estoque, financeiro, KDS, configurações, iFood, 99 Food, Pedidos 10, Meta/WhatsApp, cardápio online público, login do cliente.

| Módulo | Pastas principais | Telas/rotas | Endpoints | Tabelas (Prisma) | Integrações |
|---|---|---|---|---|---|
| **Pedidos** | `src/app/api/orders/**`, `src/app/dashboard/(auth)/pedidos/`, `src/components/orders-screen.tsx` | `/dashboard/pedidos`, `/pedido/[id]` | `POST/GET /api/orders`, `PATCH /api/orders/[id]`, `/orders/customer`, `/orders/sync`, `/orders/transfer`, `/orders/delete-all`, `/orders/[id]/messages`, `/orders/[id]/payment-status` | Order, OrderItem, OrderMessage, PaymentRequest, PartialPayment, CancellationLog | iFood, 99Food, push |
| **Cardápio (admin)** | `src/app/api/{products,categories,additional-options,daily-combos}/**`, `dashboard/(auth)/cardapio/`, `destaques/`, `stories/` | `/dashboard/cardapio`, `/dashboard/destaques`, `/dashboard/stories` | `/api/products/*`, `/api/categories/*`, `/api/additional-options`, `/api/daily-combos`, `/api/admin/banners*`, `/api/admin/stories*` | Product, Category, AdditionalOption, DailyCombo, ProductLike, Banner, Story, StoryItem, CategoryTemplate | iFood catalog push/sync/import |
| **Cardápio online público** | `src/app/[slug]/**` (7.360 linhas em `menu-page.tsx`) | `/[slug]`, `/[slug]/mesa/[number]`, `/[slug]/staff`, `/pedido/[id]` | públicos: `/api/products/featured`, `/api/banners`, `/api/stories`, `/api/reviews`, `/api/addresses`, `/api/table-status`, `/api/verification` | Product, Category, Review, Banner, Story | — |
| **Login do cliente (OTP WhatsApp)** | `src/app/api/verification/route.ts` | dentro de `/[slug]` (`menu-page.tsx:527,2620`) | `POST/PUT /api/verification` | VerificationCode, Customer | Evolution API / Meta WhatsApp |
| **PDV / frente de caixa** | `src/app/caixa/caixa-page.tsx` (3.088 ln) | `/caixa` | `/api/cash-register/*` (6), `/api/orders/*`, `/api/partial-payment`, `/api/payment-request`, `/api/pix-generate` | CashRegister, CashMovement, CashTransfer, Order | Asaas, Inter, Pagar.me, Efi |
| **Caixa gerencial** | `dashboard/(auth)/caixa-gerencial/`, `financeiro/caixa/` | `/dashboard/caixa-gerencial`, `/dashboard/financeiro/caixa` | `/api/cash-register/{history,summary,[id],close-table}` | CashRegister, CashMovement | — |
| **Estoque** | `src/app/api/{stock,suppliers,purchases}/**`, `lib/stock.ts`, `dashboard/(auth)/estoque/` | `/dashboard/estoque` | `/api/stock`, `/api/stock/[id]`, `/api/stock/links`, `/api/suppliers`, `/api/purchases`, `/api/products/[id]/stock-links/reset` | StockFamily, StockCategory, StockItem, StockMovement, Supplier, Purchase, PurchaseItem, ProductStockLink | — |
| **Financeiro** | `src/app/api/{financial,expenses}/**`, `lib/cmv.ts`, `dashboard/(auth)/financeiro/**` | `/dashboard/financeiro/{visao-geral,caixa,cmv,despesas,fluxo-caixa,receitas,relatorios}` | `/api/financial/{cash-flow,cmv,dre,revenues}`, `/api/expenses`, `/api/expenses/[id]` | FinancialTransaction, Expense | — |
| **Entregas / motoboys** | `src/app/api/{delivery,delivery-persons,tracking}/**`, `components/delivery/`, `[slug]/entregas/[token]/` | `/dashboard/entregas`, `/dashboard/delivery-zones`, `/[slug]/entregas/[token]` | `/api/delivery/{calculate,dispatch-99,poll-99}`, `/api/delivery-persons*`, `/api/tracking/[id]` | DeliveryPerson, DeliveryPayment, DeliveryZone | 99Food (dispatch/poll) |
| **Dashboard** | `src/app/api/dashboard`, `dashboard/(auth)/{layout,home,relatorios,alertas}` | `/dashboard`, `/dashboard/home`, `/dashboard/relatorios` | `/api/dashboard`, `/api/alerts` | Order, Product, FinancialTransaction (leituras agregadas) | — |
| **KDS** | `src/app/kds/**`, `api/kds/establishment` | `/kds`, `/kds/screen` | `/api/kds/establishment` + consome `/api/orders` | Order, Establishment | — |
| **Configurações** | `dashboard/(auth)/config/`, `api/establishments/**`, `usuarios/`, `cupons/`, `fidelidade/` | `/dashboard/config`, `/dashboard/usuarios`, `/dashboard/cupons`, `/dashboard/fidelidade` | `/api/establishments/*` (13), `/api/users*` (3), `/api/coupons` (via orders) | Establishment, User, Coupon, SystemConfig, PasswordResetToken | iFood toggle, Meta/WhatsApp connect |
| **iFood** | `src/lib/integrations/{ifood,ifood-catalog-write,ifood-customer,ifood-merchant,ifood-status}.ts` | — | `/api/ifood-catalog{,/import,/push,/sync}`, `/api/orders/{ifood-webhook,ifood-poll}`, `/api/orders/[id]/ifood-handshake` | Establishment (credenciais), Order | OAuth client id/secret, webhooks |
| **99 Food** | `src/lib/integrations/{nine-nine,nine-food,nine-food-customer,nine-food-status}.ts` | — | `/api/webhooks/99`, `/api/orders/99food-webhook`, `/api/delivery/{dispatch-99,poll-99}` | LogWebhook99, Order | Webhooks + dispatch |
| **Pedidos 10** | **NÃO EXISTE NO CÓDIGO** | — | — | — | `grep -ri "pedidos10\|pedidos-10"` → 0 ocorrências |
| **Meta / WhatsApp** | `src/lib/whatsapp/**`, `src/lib/meta-quota.ts`, `components/meta-embedded-signup.tsx` | `/dashboard/config` (conexão) | `/api/establishments/[id]/meta-{embedded-signup,discover,connect,status,quota,create-template,profile-picture*}`, `/api/webhooks/whatsapp`, `/api/bot/create-order`, `/api/cron/meta-quota` | Establishment, SystemConfig | Embedded Signup Facebook, Evolution API, OpenAI (bot) |
| **Pagamentos (PSPs)** | `src/lib/integrations/{asaas,pagarme,inter,efi}.ts`, `lib/pagarme-config.ts` | checkout em `/[slug]` | `/api/payments/{asaas,pagarme,inter,efi}/*`, `/api/webhooks/{asaas,pagarme,efi}`, `/api/pix-generate`, `/api/subscription/*` | Order, PaymentRequest, PartialPayment, FinancialTransaction | Asaas, Pagar.me, Inter, Efi |
| **SaaS admin (super)** | `src/app/admin-saas/**`, `api/saas-admin/**`, `lib/saas-admin-auth.ts` | `/admin-saas/{dashboard,estabelecimentos,planos,pagamentos,instancias,templates,respostas-rapidas,ia-custos,logs,financeiro,whatsapp-tech}` | `/api/saas-admin/*` (11) | Establishment, SystemConfig, AIUsageLog | Meta, Asaas |
| **Push (PWA)** | `src/lib/push.ts`, `api/push/**`, `components/pwa/**` | — | `/api/push{,/subscribe,/test,/diagnose,/cleanup,/order-details,/vapid-key}` | PushSubscription, PushLog | Web Push (VAPID) |

---

## 4. Superfície

### 4.1 Telas/páginas — 64 rotas `page.tsx`

**Públicas (visitante sem login):**
`/` (landing), `/[slug]` (cardápio), `/[slug]/mesa/[number]`, `/[slug]/entregas/[token]`, `/[slug]/staff`, `/pedido/[id]`, `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`, `/trocar-senha`, `/kds`, `/politica-de-privacidade`, `/marketing/coupons`, `/demo`, `/ui-review`

**Painel do lojista (exige JWT — `dashboard/(auth)/layout.tsx`):**
`/dashboard` (+ `home`, `pedidos`, `cardapio`, `caixa`, `caixa-gerencial`, `chat`, `clientes`, `config`, `cupons`, `delivery-zones`, `destaques`, `entregas`, `estoque`, `fidelidade`, `planos`, `relatorios`, `stories`, `usuarios`), `/dashboard/financeiro/{caixa,cmv,despesas,fluxo-caixa,receitas,relatorios,visao-geral}`

**Outros:** `/caixa` (PDV), `/kds/screen`, `/admin` (rota legada), `/admin-saas/*` (22 rotas, grupo `(auth)` + `login`), `/ui-review` (**página de desenvolvimento exposta em produção** — build a inclui: `next build` listou `/ui-review`).

**Controle de acesso por tela:** feito no cliente/layout. Evidência: `middleware.ts:46-48` — `if (!pathname.startsWith("/api/")) { return NextResponse.next() }` → **nenhuma rota de página é verificada no servidor**; a proteção de `/dashboard/**` depende de `dashboard/(auth)/layout.tsx` (client-side). Achado detalhado na Fase 1.

### 4.2 Endpoints — 148 arquivos `route.ts`

- **Total de handlers:** 90 POST, 76 GET, 23 PATCH, 21 DELETE, 9 PUT (algumas rotas exportam vários métodos).
- **Proteção:** `middleware.ts:10-21` libera **sem JWT** tudo que começa com: `/api/auth`, `/api/customers`, `/api/orders`, `/api/tracking`, `/api/push`, `/api/delivery-persons/deliveries`, `/api/users/change-password`, `/api/webhooks`, `/api/cron`.
- **Nenhuma rota lê `x-user-role`** injetado pelo middleware; só 1 rota lê `x-establishment-id` (`src/app/api/alerts/route.ts:8`).
- **Validação de role em apenas 5 pontos do código:** `users/change-password:20`, `cash-register/[id]/transfer:43`, `auth/kds-login:22`, `saas-admin/login:25`, `lib/saas-admin-auth.ts:22`.
- **Rate limit:** implementado em `src/lib/rate-limit.ts` (Map em memória — zera a cada cold start da Vercel). Usado **apenas** em `/api/auth/login:31` (15/min) e `/api/verification:64-70,322-335`.

Tabela completa (auth interna / tenant / role / chamador) foi produzida na varredura dos 148 endpoints e alimenta a **Fase 1**. Resumo quantitativo aqui:

| Situação | Qtde (dos 148) |
|---|---|
| Valida auth internamente (`verifyAuth`) | ~70 |
| Valida tenant (compara com token) | ~45 |
| Valida role | 5 |
| **Públicos por prefixo do middleware E sem auth interna** | **~40** (grupo: `/api/orders/*`, `/api/customers*`, `/api/push/*`, `/api/tracking`, `/api/users/change-password`, `/api/webhooks/{99,efi}`, cron) |

### 4.3 Banco de dados — 48 modelos Prisma (`prisma/schema.prisma`, 1.067 linhas)

**Modelos COM coluna de tenant (`establishmentId`):** Establishment, Customer, DeliveryPerson, Category, Product, DailyCombo, AdditionalOption, Order, StockFamily, StockCategory, StockItem, Supplier, Purchase, User, DeliveryPayment, Coupon, CashRegister, Expense, PaymentRequest, PartialPayment, Review, CancellationLog, AIUsageLog, PushSubscription, DeliveryZone, Story, Banner, FinancialTransaction (28).

**Modelos SEM coluna de tenant (19)** — risco de isolamento a validar na Fase 1B/2:

`CustomerAddress, VerificationCode, ProductLike, DailyComboItem, OrderItemCost, StockMovement, PurchaseItem, ProductStockLink, PasswordResetToken, CashTransfer, CashMovement, OrderMessage, PartialPayment*, CategoryTemplate, GlobalQuickReply, LogWebhook99, StoryItem, CustomerNotification, SystemConfig`

> \* `PartialPayment` tem `establishmentId` (confirmado na varredura); `OrderMessage`, `CashMovement`, `CashTransfer`, `StockMovement`, `PurchaseItem`, `ProductStockLink`, `CustomerAddress`, `VerificationCode`, `OrderItemCost`, `StoryItem`, `DailyComboItem`, `ProductLike`, `PasswordResetToken`, `LogWebhook99`, `CustomerNotification`, `CategoryTemplate`, `GlobalQuickReply`, `SystemConfig` não têm — a maioria se resolve por relação com o pai, mas **precisa ser provado** com teste de isolamento (Fase 1B).

- **Views:** nenhuma (`grep "@@view\|CREATE VIEW"` → 0).
- **Funções RPC/Triggers SQL:** nenhum no schema Prisma; triggers seriam criados fora do versionamento (não verificáveis sem dump — **NÃO VERIFICADO**).
- **Buckets Supabase Storage:** `images` (`src/lib/image-upload.ts:29`) e `Imagens` (`src/app/api/ifood-catalog/import/route.ts:103`) — ambos usam `getPublicUrl` (**bucket público**).
- **Canais Realtime:** nenhum (não usado).
- **Banco local:** `prisma/dev.db` presente (arquivo SQLite) apesar de `provider = "postgresql"` no schema — artefato antigo; **não usado em runtime** (`DATABASE_URL` aponta para Postgres). `prisma/schema.prisma.bak3` também versionado.

### 4.4 Integrações externas — presença no código vs. status real

| Integração | Existe código? | Credenciais no `.env` | Status (homologada?) |
|---|---|---|---|
| iFood | ✅ 5 libs + 8 endpoints | `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET`, `IFOOD_WEBHOOK_SECRET` (usada, **não definida no .env**) | **NÃO VERIFICADO** (entrada 9 ausente) |
| 99 Food | ✅ 4 libs + 5 endpoints | nenhuma env própria | **NÃO VERIFICADO** |
| Pedidos 10 | ❌ inexistente | — | não iniciada / fora de escopo |
| Meta (Embedded Signup) | ✅ `components/meta-embedded-signup.tsx`, 8 endpoints | `NEXT_PUBLIC_META_APP_ID`, `META_APP_SECRET` (.env.local), `SAAS_META_ACCESS_TOKEN`, `SAAS_META_PHONE_NUMBER_ID` | **NÃO VERIFICADO** |
| Evolution API (WhatsApp) | ✅ `lib/whatsapp/evolution.ts` | `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `SAAS_EVOLUTION_*` — **usadas mas não definidas no .env** | **NÃO VERIFICADO** |
| Asaas | ✅ | `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT` | **NÃO VERIFICADO** |
| Pagar.me | ✅ | `PAGARME_API_KEY`, `PAGARME_ENVIRONMENT`, `PAGARME_WEBHOOK_KEY`, `PAGARME_SAAS_RECIPIENT_ID` — as 3 primeiras **não definidas** | **NÃO VERIFICADO** |
| Inter | ✅ `lib/integrations/inter.ts` | `INTER_CLIENT_ID/SECRET/CERTIFICATE` (definidas, **sem uso no código**) | **NÃO VERIFICADO** |
| Efi | ✅ `lib/integrations/efi.ts` | nenhuma env | **NÃO VERIFICADO** |
| OpenAI (bot) | ✅ | `OPENAI_API_KEY` | — |
| Supabase (só Storage) | ✅ | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_URL` (fallback) | — |
| Fiscal (NFC-e/SAT/TEF) | ❌ inexistente | — | inexistente (entrada 10 ausente) |

---

## 5. Variáveis de ambiente (apenas nomes)

### 5.1 Definidas em `.env` (28) + `.env.local` (3) e onde são usadas

| Nome | Onde é usada | Exposta ao navegador? |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | `src/lib/prisma.ts`, `prisma/schema.prisma` | não |
| `JWT_SECRET` | `middleware.ts:3`, `src/lib/auth.ts`, 9 rotas de auth/establishment | não |
| `CRON_SECRET` | 5 rotas `src/app/api/cron/*` | não |
| `SHOW_DEV_CODE` | `src/app/api/verification/route.ts:245` | não |
| `NEXT_PUBLIC_APP_URL` | 5 arquivos (rota verification, bot, icon, webhook whatsapp, pagarme-config) | **SIM** |
| `NEXT_PUBLIC_BASE_URL` | usada no código, **não definida no .env** | **SIM** |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | **SIM** |
| `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID` | `components/meta-embedded-signup.tsx` + 4 rotas | **SIM** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `lib/push.ts`, rotas `/api/push/*` | **SIM** |
| `NEXT_PUBLIC_PAGARME_ENCRYPTION_KEY` | **sem uso no código** | **SIM (se exposta, é inútil + risco)** |
| `NEXT_PUBLIC_INTER_SANDBOX` | **sem uso no código** | **SIM** |
| `META_APP_SECRET` (.env.local) | — | não |
| `SAAS_META_ACCESS_TOKEN`, `SAAS_META_PHONE_NUMBER_ID`, `SAAS_META_BUSINESS_ACCOUNT_ID` (sem uso) | `src/lib/whatsapp/index.ts` | não |
| `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT` | `lib/integrations/asaas.ts` + 7 rotas | não |
| `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET` | 10 arquivos (rotas iFood) | não |
| `OPENAI_API_KEY` | `src/lib/whatsapp/ai/openai.ts` | não |
| `PAGARME_SAAS_RECIPIENT_ID`, `PAGARME_SPLIT_RECEIVER_ID` (sem uso) | `lib/pagarme-config.ts`, webhook | não |
| `INTER_CERTIFICATE`, `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET` (sem uso) | — | não |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `lib/push.ts`, `/api/push/{test,diagnose}` | não |

### 5.2 Usadas no código mas **NÃO definidas** em `.env`/`.env.local` (17)

`ASAAS_WEBHOOK_TOKEN`, `EVOLUTION_API_KEY`, `EVOLUTION_BASE_URL`, `IFOOD_WEBHOOK_SECRET`, `META_APP_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `NEXT_PUBLIC_BASE_URL`, `PAGARME_API_KEY`, `PAGARME_ENVIRONMENT`, `PAGARME_WEBHOOK_KEY`, `SAAS_EVOLUTION_API_KEY`, `SAAS_EVOLUTION_BASE_URL`, `SAAS_EVOLUTION_INSTANCE`, `SUPABASE_URL`, `WEBHOOK_URL`, `WEBHOOK`/`NODE_ENV`, `VERCEL_URL` (2 últimas provisionadas pela Vercel).

> **Risco:** segredos de webhook (`IFOOD_WEBHOOK_SECRET`, `PAGARME_WEBHOOK_KEY`, `ASAAS_WEBHOOK_TOKEN`) só existem no ambiente de produção (Vercel) — **NÃO VERIFICADO** aqui e não auditáveis pelo código. Se estiverem ausentes em prod, a validação de assinatura é pulada (evidência parcial: `src/app/api/orders/99food-webhook/route.ts:62-73` pula a validação quando não há secret).

### 5.3 Definidas mas sem uso (7)

`INTER_CERTIFICATE`, `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET`, `NEXT_PUBLIC_INTER_SANDBOX`, `NEXT_PUBLIC_PAGARME_ENCRYPTION_KEY`, `PAGARME_SPLIT_RECEIVER_ID`, `SAAS_META_BUSINESS_ACCOUNT_ID`.

> `NEXT_PUBLIC_PAGARME_ENCRYPTION_KEY` é a mais problemática: variável `NEXT_PUBLIC_` que **vai para o bundle do cliente** se importada (aqui está sem uso, mas permanece como lixo perigoso).

---

## 6. Dependências principais e situação

**Runtime:** `next@14.2.35`, `react@18.3.1`, `@prisma/client@5.22.0`, `@supabase/supabase-js@2.112.2`, `jose@6.2.3`, `jsonwebtoken@9.0.3` (**duas libs de JWT coexistindo**), `bcryptjs@3.0.3`, `zod@3.25.76`, `openai@7.2.0`, `web-push@3.6.7`, `lucide-react@0.400.0`, `date-fns@4.4.0`, `sharp@0.35.3`.

**Dev:** `typescript@5.9.3`, `vitest@1.6.1`, `eslint@8.57.1` + `eslint-config-next@14.2.35`, `tailwindcss@3.4.19`.

### 6.1 `npm audit` — 24 vulnerabilidades (**4 críticas, 15 altas, 5 moderadas**)

| Severidade | Pacote | Nota |
|---|---|---|
| **CRÍTICA** | `next` | DoS via Image Optimizer — e `next.config.js:13-15` tem `remotePatterns: [{protocol:"https", hostname:"**"}]` (qualquer host), que é exatamente o vetor |
| **CRÍTICA** | `vitest`, `@vitest/coverage-v8`, `tinypool` | Vitest UI server lê/executa arquivos arbitrários; Tinypool prototype pollution → RCE (dev only) |
| ALTA | `sharp` | libheif (2 advisories) — usado no processamento de imagem |
| ALTA | `postcss` | XSS via `</style>` não escapado |
| ALTA | `glob`, `braces`, `bracket-expansion`, `micromatch`, `fast-glob`, `chokidar`, `js-yaml`, `browserslist`, `source-map-js`, `vite`, `tailwindcss`, `eslint-config-next`, `@next/eslint-plugin-next` | cadeia de build/lint (dev) |

**Detalhe do crítico do Next:** `npm audit` sugere `npm audit fix` (sem breaking) para parte; o crítico do Next exige upgrade de major (Next 14 → 15/16) ou patch disponibilizado.

### 6.2 Pacotes desatualizados (`npm outdated --depth=0`)

Divergências de major relevantes: `next 14.2.35 → 16.4.0`, `react 18 → 19`, `prisma 5.22 → 7.10`, `vitest 1.6 → 5.0`, `eslint 8 → 10`, `tailwindcss 3 → 4`, `zod 3 → 4`, `typescript 5.9 → 7.0`. `jose` e `openai` têm patch/minor disponíveis hoje (`6.2.3→6.2.12`, `7.2.0→7.30.1`).

### 6.3 Pacotes abandonados / suspeitos

- `jsonwebtoken@9.0.3` **+** `jose@6.2.3` — mesma responsabilidade em dois pacotes (o `jsonwebtoken` é usado onde? `grep` → confirmar na Fase 1C).
- `sharp` é `devDependency` mas aparece em audit de build — ok.
- Nenhum pacote efetivamente abandonado detectado; `@types/*` desatualizados apenas.

---

## 7. Ferramentas da seção 4 — execução real

| Ferramenta | Comando | Resultado |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ **exit 0, 0 erros** |
| Lint | `npm run lint` | ✅ exit 0 — **0 erros, 103 warnings** (react-hooks/exhaustive-deps, `no-img-element`) |
| Build | `npm run build` (next build) | ✅ **exit 0** — 64 rotas compiladas, First Load JS compartilhado **87,6 kB** |
| Testes | `npm test` (vitest) | ✅ **6 arquivos, 62 testes — todos passam** (449 ms) |
| Dependências | `npm audit` | ⚠️ **24 vulnerabilidades (4 críticas, 15 altas)** |
| Segredos | `gitleaks` / `trufflehog` | ❌ **não instalados** (`which` → vazio) → **NÃO VERIFICADO** (pendente Fase 1C) |
| Bundle analyzer | — | ❌ não configurado no `next.config.js` → parcial pelo tamanho das rotas do build |

---

## 8. O que está bom

- Typecheck limpo em 64.555 linhas sem nenhum `@ts-ignore`/`@ts-expect-error` (0 ocorrências).
- Build de produção passa sem erro e com bundle compartilhado enxuto (87,6 kB).
- 62 testes automatizados existentes, todos verdes, cobrindo 99Entrega/99Food e cálculo de entrega.
- `.env` **não está rastreado** no git (`git ls-files | grep .env` → vazio) e o `.gitignore` cobre `.env*`.
- Rate limit e cooldown existem em `/api/verification` (60 s, 3 tentativas) e em `/api/auth/login` (15/min).
- Códigos de OTP armazenados com hash bcrypt (`src/app/api/verification/route.ts:100`).
- Migrations do Prisma versionadas e ordenadas por data.

---

## 9. NÃO VERIFICADO (Fase 0)

1. **Estado do banco em produção** (schema real, índices, policies, triggers) — sem dump e sem acesso; só `prisma/schema.prisma` + migrations.
2. **RLS/Security Advisor** — não aplicável/não fornecido (ver §2).
3. **Planos Vercel/Supabase e custos** — entrada 7 ausente.
4. **Estimativa de uso e pico** — entrada 8 ausente (impede Fase 3 real).
5. **Status de homologação das integrações** — entrada 9 ausente (só sei que o código existe).
6. **Emissão fiscal** — entrada 10 ausente; nenhum código encontrado.
7. **Ambiente de teste com 2 lojas** — entrada 11 não confirmada; nenhum teste dinâmico executado (regra 2.5: nada contra produção).
8. **Segredos no histórico do git** — `gitleaks`/`trufflehog` indisponíveis; deixado para Fase 1C.
9. **Variáveis definidas apenas na Vercel** — 17 envs usadas no código mas ausentes do `.env` local (§5.2); conteúdo real só no painel.
10. **Realtime/Storage policies do Supabase** — sem `supabase/config.toml` nem acesso ao painel, as policies dos buckets `images`/`Imagens` não puderam ser lidas.
11. **Funções >50 linhas (contagem exata)** — análise por arquivo concluída; análise por função não automatizada (os 4 maiores arquivos concentram 18.224 linhas — ver `00-qualidade.md`).

---

## 10. Top 5 ações imediatas desta sub-fase

1. **Fornecer as 8 entradas que faltam** (§1) — sobretudo dump do banco, planos e status das integrações — antes das fases 3, 5 e 9.
2. **Corrigir o `remotePatterns: "**"` do `next.config.js:13-15`** e atualizar o `next` (vulnerabilidade crítica).
3. **Decidir a estratégia de tenant**: hoje o isolamento é 100% por código em 148 endpoints — priorizar Fase 1B imediatamente após a Fase 1A.
4. **Instalar `gitleaks`** e rodar no repositório + histórico antes da Fase 1C.
5. **Remover do build** `/ui-review`, `/demo` e os arquivos `.bak*` de `src/` (lixo de produção).
