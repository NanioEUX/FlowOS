# FASE 6 — CARDÁPIO ONLINE PÚBLICO

**Saída:** `auditoria/06-cardapio-publico.md` · Somente leitura · Nenhum comando executado contra
banco/produção · Scripts em `auditoria/testes/6-0*.sh` com **obtido = NÃO EXECUTADO**.

Escopo conforme seção 6 do termo (`AUDITORIA-SAAS-FOOD.txt:372-426`): o cardápio é tratado como
superfície **totalmente não confiável** — visitante anônimo, sem sessão, contra um servidor que
aceita o que o navegador manda.

---

## 1. Resumo

A superfície pública do cardápio (página `/<slug>`, `/pedido/[token]`, checkout e ~25 rotas de API)
**não valida nada no servidor**: preço, desconto, cupom, fidelidade, status, `method`, quantidade,
produto, loja aberta e agendamento vêm todos do body. O servidor funciona hoje como um
**gravador de JSON confiante**, e as poucas regras que existem (mínimo, geolocalização, esgotado,
cupom, verificação WhatsApp) estão implementadas **só no cliente**, onde qualquer `curl` ignora.

Do lado da exposição, a página pública do cardápio passa o **registro completo do estabelecimento
como prop de um client component** — removendo apenas `password`, `paymentConfig` e `orderConfig`
(`src/app/[slug]/page.tsx:86`) —, o que serializa as 32 credenciais de pagamento/WhatsApp/iFood
dentro do HTML entregue a qualquer visitante. `/pedido/[id]` e o `POST /api/orders` repetem o
mesmo padrão com `include: { establishment: true }`.

Três ações financeiras ficaram **sem autenticação nenhuma**: `POST /api/pix-generate` (cria
cobrança de valor arbitrário na conta Asaas do lojista), `POST /api/delivery/dispatch-99`
(dispara corrida real e devolve `rideId`+`pinCode`) e `PATCH /api/payment-request` (marca pedidos
como pagos/entregues).

**Nota da área: 4,0/10.** O cardápio é bonito, completo e tem fluxo de compra real — mas a regra
de negócio inteira vive no navegador.

| Severidade | Qtd |
|---|---|
| CRÍTICO | 18 |
| ALTO | 18 |
| MÉDIO | 25 |
| BAIXO | 15 |
| **Total** | **76** |

Dos 76: **47 são novos** e **29 são repetições/detalhes** de achados das Fases 0/1/2 (coluna
"Origem" = `Novo` ou `Rep. F1A/F1C/F2`). A Fase 1 já tinha mapeado o middleware morto e as rotas
anônimas; a Fase 6 traz o **porquê funcional** — o que quebra no fluxo de compra e no dinheiro.

---

## 2. Tabela de achados

### 6.1 — Segurança da superfície pública (F6A)

| ID | Sev. | Origem | Título | Evidência | Esforço |
|---|---|---|---|---|---|
| **F6A-001** | **CRÍTICO** | Novo | Registro completo da loja (32 credenciais) serializado como prop do cardápio no HTML | `src/app/[slug]/page.tsx:64-74,86,118` | P |
| **F6A-002** | **CRÍTICO** | Rep. F1C-102 | `/pedido/[id]` entrega a linha completa do estabelecimento (com `password`) ao client component | `src/app/pedido/[id]/page.tsx:76,89,110` | P |
| **F6A-003** | **CRÍTICO** | Rep. F1C-102 | `POST /api/orders` responde com `include: { establishment: true }` (linha inteira) | `src/app/api/orders/route.ts:677-683` | P |
| **F6A-004** | **CRÍTICO** | Novo | `PATCH /api/payment-request` **sem auth** marca pedidos como `paid`/`delivered` | `src/app/api/payment-request/route.ts:48-83` | P |
| **F6A-005** | **CRÍTICO** | Novo | `GET /api/payment-request` sem auth devolve pedidos inteiros (PII + `trackingToken`) | `src/app/api/payment-request/route.ts:33-41` | P |
| **F6A-006** | **CRÍTICO** | Rep. F1A-011 | `GET /api/customers` por telefone/CPF devolve a ficha completa do cliente | `src/app/api/customers/route.ts:16-48` | P |
| **F6A-007** | **CRÍTICO** | Rep. F1A-011 | `POST/PUT /api/customers` sem auth altera telefone/endereço de qualquer cliente | `src/app/api/customers/route.ts:65-114,116-151` | P |
| **F6A-008** | **CRÍTICO** | Rep. F1A-004 | `GET /api/orders/customer` devolve histórico + `trackingToken` + `pixPayload` só com telefone | `src/app/api/orders/customer/route.ts:56-78` | P |
| **F6A-009** | **CRÍTICO** | Rep. F1C-004 | OTP devolvido na resposta (`devCode: code` mesmo com `whatsappSent: true`) | `src/app/api/verification/route.ts:243,255-268` | P |
| **F6A-010** | **CRÍTICO** | Novo | `GET /api/categories` e `GET /api/products/[id]` expõem `unitCost`, estoque e ficha técnica | `src/app/api/categories/route.ts:15-29`; `products/[id]/route.ts:12-22` | P |
| **F6A-011** | **CRÍTICO** | Novo | `PATCH/DELETE /api/products/[id]` autentica mas não checa dono → edição de produto de outra loja | `src/app/api/products/[id]/route.ts:33-36,73-76,95-106` | P |
| **F6A-012** | **CRÍTICO** | Novo | Path traversal em `/api/icon/[slug]`: `logo="/../.env"` lê arquivo arbitrário | `src/app/api/icon/[slug]/route.ts:44-51` + `establishments/[id]/route.ts:38` (`logo` ∈ SAFE_FIELDS) | P |
| **F6A-013** | **CRÍTICO** | Rep. F1A-005/F1B-002 | Financeiro/estoque/dashboard sem auth, `establishmentId` vindo do cliente | `financial/cmv/route.ts:6`; `stock/route.ts:6-41`; `dashboard/route.ts:20` | M |
| **F6A-014** | **CRÍTICO** | Rep. F1A-003 | `POST /api/delivery-persons` sem auth cria motoboy com senha `123456` em qualquer tenant | `src/app/api/delivery-persons/route.ts:30-59` | P |
| **F6A-015** | ALTO | Rep. F1C-103 | XSS nas 3 telas de impressão via `document.write` → roubo do JWT do operador | `kds/(auth)/screen/page.tsx:476`; `caixa/caixa-page.tsx:951`; `dashboard/(auth)/pedidos/page-content.tsx:738` | M |
| **F6A-016** | — | *(mesmo que F6A-035)* | *duplicado interno, unificado abaixo* | — | — |
| **F6A-017** | ALTO | Rep. F1C-002 | `GET /api/establishments?id=`/`?slug=` devolve **32** credenciais + catálogo completo | `src/app/api/establishments/route.ts:115-131,134-150` | P |
| **F6A-018** | ALTO | Rep. F1C-112 | Zero headers de segurança no código (CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS) | `next.config.js:1-16`; `vercel.json:1-12`; `src/app/layout.tsx:9-34` | P |
| **F6A-019** | ALTO | Rep. F1A-020 | `daily-combos` POST/PATCH/DELETE sem auth (apaga combos de qualquer loja) | `src/app/api/daily-combos/route.ts:23-102` | P |
| **F6A-020** | MÉD | Rep. F1A-020 | `GET /api/table-status` devolve itens/totais de todas as mesas abertas da loja | `src/app/api/table-status/route.ts:36-64` | P |
| **F6A-021** | MÉD | Novo | `GET /api/partial-payment` sem auth devolve todos os pagamentos parciais | `src/app/api/partial-payment/route.ts:5-23` | P |
| **F6A-022** | MÉD | Novo | `POST /api/reviews` sem auth e sem prova de compra; `GET` devolve `customerPhone` | `src/app/api/reviews/route.ts:4-44,54-73` | P |
| **F6A-023** | MÉD | Novo | Produto com `availableOnline=false` **continua aparecendo** no cardápio público | `[slug]/page.tsx:69` (filtra só `isAvailable`) vs `cardapio/page-content.tsx:3294` | P |
| **F6A-024** | MÉD | Novo | Loja suspensa/plano vencido não é bloqueada em `POST /api/orders` | `src/app/api/orders/route.ts:83-89` (só 404) | P |
| **F6A-025** | MÉD | Novo | `/api/addresses`: "ownership" só confirma que o cliente pertence ao tenant — não que o **chamador** é o cliente (rota anônima) | `src/app/api/addresses/route.ts:4-11,23,49,102,148` | P |
| **F6A-026** | MÉD | Novo | `additional-options` autentica mas não valida o dono do `productId` (0 checagens de tenant) | `src/app/api/additional-options/route.ts:30,84,110` | P |
| **F6A-027** | MÉD | Novo | `POST /api/push/subscribe` sem auth sequestra push de outro cliente pelo telefone | `src/app/api/push/subscribe/route.ts:4-49` | P |
| **F6A-028** | MÉD | Rep. F1A-005 | `POST /api/stock` sem auth cria/edita estoque (com custo) de qualquer loja | `src/app/api/stock/route.ts:44-96` | P |
| **F6A-029** | BAIXO | Novo | Enumeração de loja: oráculo 404/200 em `establishments?slug=` e `table-status?slug=` | `establishments/route.ts:145-147`; `table-status/route.ts:27-29` | P |
| **F6A-030** | BAIXO | Rep. F1A-020 | `/api/coupons/validate` não existe → cupom validado só no client | `[slug]/menu-page.tsx:1864` vs `api/orders/route.ts:96-98` | M |
| **F6A-031** | BAIXO | Rep. F1A-020 | `BYPASS_PHONES` hardcoded e `metaAccessToken` prefixado em log | `src/app/api/verification/route.ts:14,138` | P |
| **F6A-032** | BAIXO | Novo | `POST /api/push` executa DDL (`CREATE TABLE IF NOT EXISTS`) sem auth e devolve `e.message` | `src/app/api/push/route.ts:18-58` | P |
| **F6A-033** | BAIXO | Rep. F1A | Rate limit existe só no login → flood de pedidos/avaliações/clientes | `src/lib/rate-limit.ts:16`; único uso em `auth/login/route.ts:31` | M |
| **F6A-034** | **CRÍTICO** | Novo | `POST /api/delivery/dispatch-99` **sem nenhum import de auth** dispara corrida real e devolve `rideId` + `pinCode` | `src/app/api/delivery/dispatch-99/route.ts:11-77` | P |
| **F6A-035** | **CRÍTICO** | Novo | `POST /api/pix-generate` sem auth cria cobrança Asaas com `value: amount` do body | `src/app/api/pix-generate/route.ts:5-37` | P |
| **F6A-036** | ALTO | Novo | `GET /api/push/order-details` sem auth: com `establishmentId` + telefone devolve nome, itens e total da vítima | `src/app/api/push/order-details/route.ts:10-40,66-74` | P |
| **F6A-037** | ALTO | Rep. F1C-205 | `GET/POST /api/cash-register` sem auth (rotas irmãs `summary`/`history`/`[id]` **têm** `verifyAuth`) | `cash-register/route.ts:4-39` vs `summary/route.ts:6` | P |
| **F6A-038** | ALTO | Rep. F1A-005 | CRUD completo de `suppliers` (CNPJ, telefone, e-mail) sem auth | `src/app/api/suppliers/route.ts:4-40` | P |
| **F6A-039** | ALTO | Rep. F1A-005 | `GET /api/expenses` sem auth **e** com `?cleanup=fix-dates` que dispara `updateMany` (mutação via GET) | `src/app/api/expenses/route.ts:4-30` | P |
| **F6A-040** | ALTO | Rep. F1C-010/012 | Escrita de configuração em qualquer tenant: `delivery-config`, `delivery-zones`, `location` e 8 rotas `meta-*` | `establishments/[id]/{delivery-config,delivery-zones,location,meta-*}/route.ts` (`verifyAuth` = 0) | M |
| **F6A-041** | MÉD | Rep. F1C-006 | Fallback hardcoded do segredo do admin SaaS (`|| "flowoshub-saas-admin-secret-change-me"`) | `src/lib/saas-admin-auth.ts:6-8`; `saas-admin/login/route.ts:8-10` | P |
| **F6A-042** | MÉD | Rep. F1C-009/116 | Auth de cron **fail-open** (`if (cronSecret && …)`, `Bearer undefined`) | `cron/meta-quota/route.ts:9-11`; `cron/reset-ai-usage/route.ts:6-9`; `cron/sync-payments/route.ts:33-34` | P |
| **F6A-043** | MÉD | Rep. F1A-020 | `POST/GET /api/delivery-payments` sem auth → repasses a entregadores de qualquer loja | `src/app/api/delivery-payments/route.ts` | P |
| **F6A-044** | BAIXO | Rep. F1C-011 | Rotas de teste/debug públicas em produção: `asaas-test`, `test-dispatch` | `src/app/api/asaas-test/route.ts`; `src/app/api/test-dispatch/route.ts` | P |
| **F6A-045** | BAIXO | Novo | Webhooks **sem assinatura detectada**: `efi`, `whatsapp`, `subscription/webhook`, `payments/inter/webhook` | `grep hmac\|signat\|timingSafeEqual` = 0 nesses arquivos | M |
| **F6A-046** | BAIXO | Novo | `requireSaasAdmin()` lança erro e o `catch` devolve **500** em vez de 401 | `saas-admin/establishments/[id]/whatsapp-tech/route.ts:51-53,102-104` | P |
| **F6A-047** | BAIXO | Novo | `push/order-details` seleciona `trackingToken` (`:36`) — vazamento latente se o response crescer | `src/app/api/push/order-details/route.ts:36,66-74` | P |

### 6.2–6.5 — Pagamento, regras de negócio, desempenho/SEO e UX (F6B)

| ID | Sev. | Origem | Título | Evidência | Esforço |
|---|---|---|---|---|---|
| **F6B-001** | **CRÍTICO** | Novo | `body.status` e `body.method` aceitos do cliente: contorna o gate "cozinha só após pagar" e grava status arbitrário | `src/app/api/orders/route.ts:179`, `:432`, filtro `:727-746` | P |
| **F6B-002** | **CRÍTICO** | Novo | Fidelidade/cashback (`loyaltyDiscount`/`loyaltyPointsUsed`) do body sem validar saldo → pedido por R$ 0 e pontos negativos | `orders/route.ts:95-98,250-251,330,444` | M |
| **F6B-003** | ALTO | Novo | Nenhuma validação de `productId`/adicionais contra a loja, `isAvailable` ou `availableOnline`; estoque/CMV de outro tenant acessíveis | `orders/route.ts:408-455`; `lib/stock.ts:77-88`; `lib/cmv.ts:50-51` | M |
| **F6B-004** | ALTO | Novo | Servidor não valida horário da loja, `isOpenOverride`, `isActive` nem assinatura | `orders/route.ts:83-89` (só `findUnique` + 404) | P |
| **F6B-005** | ALTO | Novo | `isOpen` calculado **uma única vez** (`useMemo`) — a loja fecha e a página aberta continua vendendo | `[slug]/menu-page.tsx:754-769` | P |
| **F6B-006** | ALTO | Novo | Sem idempotência no servidor: timeout/retry gera 2 pedidos; `trackingToken` novo a cada request | `orders/route.ts:170`; guard só no front `menu-page.tsx:1914-1915` | M |
| **F6B-007** | ALTO | Novo | Zonas de entrega/raio/geolocalização **mortas no cardápio**: `GeolocationButton` importado e nunca renderizado | `[slug]/menu-page.tsx:18` (única ocorrência); existia em `menu-page.tsx.backup:3232` | M |
| **F6B-008** | ALTO | Novo | 99Entrega nunca despachada para pedidos do site (`customerLat/Lng` sempre nulos) | `orders/[id]/route.ts:300-309`; origem única `orders/route.ts:423` | M |
| **F6B-009** | ALTO | Novo | PAN+CVV do cartão atravessa o backend sem tokenização; `/api/payments/{asaas,pagarme}/card` sem `verifyAuth` | `payments/asaas/card/route.ts:9,73-79`; `pagarme/card/route.ts:9,125`; `menu-page.tsx:6896-6912` | G |
| **F6B-010** | ALTO | Rep. F1C-001/101 | Middleware de auth não registrado no build (arquivo na raiz, app em `src/`) | `middleware.ts:1`; `.next/server/middleware-manifest.json` → `"middleware": {}` | P |
| **F6B-011** | ALTO | Rep. F1C-211/212 | Webhooks Efi, Inter e 99 (corridas) sem assinatura; `efiWebhookToken` existe mas nunca é conferido | `webhooks/efi/route.ts:7-19`; `payments/inter/webhook/route.ts:4-46`; `webhooks/99/route.ts:5-10` | P |
| **F6B-012** | MÉD | Novo | Cupons: `/api/coupons/**` **não existe** — validação do cliente e CRUD do dashboard dão 404; schema, UI e front usam 3 shapes diferentes | `menu-page.tsx:1864`; `cupons/page-content.tsx:51,72,101`; `schema.prisma:692-704`; glob `src/app/api/coupons/**` = 0 | M |
| **F6B-013** | MÉD | Novo | Cupom aceito por `couponId` cru, sem conferir `establishmentId`, expiração, limite ou inatividade | `orders/route.ts:435`, `:479-484` | P |
| **F6B-014** | MÉD | Novo | Assinatura expirada/trial vencido bloqueada **só no front**; a API cria pedido normalmente | `[slug]/page.tsx:80-116` vs `api/orders/route.ts` (0 refs) | P |
| **F6B-015** | MÉD | Novo | Comissão SaaS por tenant (`saasCommissionPercentage`) é aceita e **ignorada**; split existe só no Pagar.me | `orders/route.ts:19,31,616-622` | P |
| **F6B-016** | MÉD | Novo | Financeiro conta pedido **não pago** como receita (`cash-flow` exclui só `cancelled`) | `financial/cash-flow/route.ts:21,33,56` | P |
| **F6B-017** | MÉD | Novo | Estoque nunca bloqueia venda (aceita saldo negativo) e o cliente nunca vê "esgotado" | `lib/stock.ts:84-88,111-115`; grep `esgotado` em `menu-page.tsx` = 0 | M |
| **F6B-018** | MÉD | Novo | Agendamento (`isScheduled`/`deliveryDate`) aceito cru, sem UI e sem checar `scheduledMinHours` (validação existe só no bot) | `orders/route.ts:75,438-439`; `bot/create-order/route.ts:100-133` | P |
| **F6B-019** | MÉD | Novo | Gate de verificação WhatsApp é flag de `localStorage` — pedidos direto na API pulam a verificação | `menu-page.tsx:594-599,1938-1947`; `orders/route.ts` sem checagem | M |
| **F6B-020** | MÉD | Novo | Polling duplicado: `/api/orders/customer` 2× idênticas a cada 15 s; 2 pollers de `payment-status` a cada 3 s | `menu-page.tsx:2356-2372,2734-2769,6814-6839` | P |
| **F6B-021** | MÉD | Novo | SEO incompleto: sem `robots`/`sitemap`/`canonical`/JSON-LD; OG fixo em 1200×630 | `[slug]/page.tsx:42-56`; `ls src/app/robots.ts sitemap.ts` → inexistentes | M |
| **F6B-022** | MÉD | Novo | `menu-page.tsx` = **7.360 linhas / 397 KB** → chunk da rota ~266 KB; 13 `<img>` e **0** `next/image` | `wc -l`; `.next/static/chunks/app/[slug]/page-84175929c7654a93.js` | G |
| **F6B-023** | BAIXO | Novo | `changeFor` gravado sem limite; `paymentConfig`/`orderConfig` não validados no servidor | `orders/route.ts:426-427`; grep = 0 | P |
| **F6B-024** | BAIXO | Rep. Fase 2 | Corrida no `MAX(orderNumber)+1` → 500 em pico (PK única derruba o pedido) | `orders/route.ts:410-414`; `schema.prisma:500` | M |
| **F6B-025** | BAIXO | Novo | `DailyCombos` sem nenhum consumidor na UI (API existe, estado nunca é renderizado) | `api/daily-combos/route.ts:11`; `menu-page.tsx:309,313` | P |
| **F6B-026** | BAIXO | (= F6A-023) | Flag `availableOnline` anunciada no painel mas não lida em nenhum lugar do cardápio | `cardapio/page-content.tsx:3294`; grep em `src/app/[slug]` = 0 | P |
| **F6B-027** | BAIXO | Novo | iFood: disponibilidade sincroniza, **preço não** (só push manual); 99Food sem catálogo | `cardapio/page-content.tsx:863-877` vs `:892` | M |
| **F6B-028** | BAIXO | Novo | Notificação de status lê antes de gravar (TOCTOU) → WhatsApp+push podem duplicar | `api/orders/[id]/route.ts:16,181,405,444-526` | P |
| **F6B-029** | BAIXO | Novo | A11y rasa: 5 `aria-*`, 0 `role`, 0 `aria-hidden`/`sr-only` em 7.360 linhas | grep em `menu-page.tsx` | M |
| **F6B-030** | BAIXO | Novo | Sem detecção de webview (Instagram/WhatsApp) nem aviso "abra no navegador" | grep `instagram\|fbav\|userAgent` em `src` = 0 (fora de `push/*`) | P |

---

## 3. 6.1 — Segurança

### 3.1 Causa raiz

Não há **nenhuma** camada que considere a superfície pública hostil:

1. **O cliente é a fonte de verdade.** `POST /api/orders` lê `body.status` (`:179`),
   `body.method` (`:432`), `body.subtotal` (`:93`), `body.deliveryFee` (`:94`),
   `body.loyaltyDiscount` (`:95-98`), `body.couponDiscount` e `body.firstPurchaseDiscount`
   (`:96-97`). Ele recalcula apenas `calculatedTotal` somando o que veio pronto.
2. **Nenhuma rota do cardápio chama `verifyAuth`.** A autenticação real é o `middleware.ts` que o
   Next **não compila** (arquivo em `<repo>/middleware.ts`, app em `src/app` → o build procura em
   `src/`; `.next/server/middleware-manifest.json` = `{"middleware": {}}`). Mesmo que compilasse,
   a lista `PUBLIC_ROUTES` dele já inclui `/api/orders`, `/api/customers`, `/api/tracking`,
   `/api/push` — exatamente as rotas mais sensíveis (`middleware.ts:10-21`).
3. **Não existe sessão de cliente.** O "cliente logado" é uma flag
   `sessionVerified` em `localStorage` (`menu-page.tsx:594-599`) + `customerId` vindo da query.
   Por isso `verifyCustomerOwnership` em `/api/addresses` só prova que o cliente pertence ao
   tenant — **não** que o chamador é aquela pessoa (F6A-025).

### 3.2 Vazamento de campos internos (confirmado por leitura)

| Ponto | O que sai | Evidência |
|---|---|---|
| `GET /[slug]` | `findUnique` **sem `select`**, com `categories: { products: { include: additionalOptions } }`; depois `const { password, paymentConfig, orderConfig, ...rest } = establishment` e `<MenuPage establishment={rest} …>` | `[slug]/page.tsx:64-74,86,118` |
| `GET /pedido/[id]` | `include: { establishment: true }` na linha inteira, passada a `<TrackingPage order={…}>` | `pedido/[id]/page.tsx:76,89,110` |
| `POST /api/orders` | `findUnique({ include: { establishment: true } })` devolvido em `NextResponse.json({ order: fullOrder, … })` | `orders/route.ts:677-683` |
| `GET /api/categories` | `include: { stockLinks: true, stockItem: true }` → custo e saldo | `categories/route.ts:15-29` |
| `GET /api/establishments?id=`/`?slug=` | remove **só `password`**; ficam Asaas(4), EFI(5), Inter(5), Pagar.me(3), Flow(1), Evolution(3), Meta(4), iFood(3), 99(4) = **32 campos**, + `email`, `botSystemPrompt` e o catálogo (`categories`+`products`) | `establishments/route.ts:115-131,134-150` |

`rest` é prop de **client component**, logo o Next o serializa no flight payload embutido no HTML —
basta `curl /<slug> | grep asaasApiKey`.

Contagem de credenciais conferida contra a lista de `SAFE_FIELDS` em
`establishments/[id]/route.ts:38-53` (que **também** lista `asaasApiKey`, `efiClientSecret`,
`interCertificatePassword`, `metaAccessToken`, `api99Key`, `pagarmeApiKey`…, ou seja, o próprio
`SAFE_FIELDS` não é seguro — ele só é usado em `GET`, enquanto o `PATCH` valida por ele).

### 3.3 Ações financeiras sem autenticação

| Rota | Efeito | Evidência |
|---|---|---|
| `POST /api/pix-generate` | `amount` do body → `createPaymentLink({ value: amount })` na conta Asaas do lojista | `pix-generate/route.ts:5-37` |
| `POST /api/delivery/dispatch-99` | 0 imports de auth; lê `api99Key`/`api99EmployeeId` e devolve `rideId` + `pinCode` | `delivery/dispatch-99/route.ts:11-77` |
| `PATCH /api/payment-request` | `updateMany` → `paymentStatus: "paid"`, `status: "delivered"` para todos os pedidos presenciais da mesa | `payment-request/route.ts:48-83` |
| `POST /api/expenses?…` | `GET ?cleanup=fix-dates` dispara `updateMany` (mutação via GET anônima) | `expenses/route.ts:26-29` |

### 3.4 Enumeração

- **Lojas**: `GET /api/establishments` sem parâmetro devolve `id,name,slug,category` de **todo**
  tenant com `isActive: true` (`establishments/route.ts:153-159`); com `?slug=` vira oráculo
  200/404 (`:145-147`) + 32 credenciais.
- **Pedidos**: `/api/orders` e `/api/orders/customer` devolvem `trackingToken` (F6A-008),
  o que equivale a abrir o acompanhamento de qualquer pedido.
- **Clientes**: `GET /api/customers?phone=`/`?cpf=` (`:16-48`).
- **Token de acompanhamento**: `randomBytes(12)` = **96 bits**, `@unique` (`orders/route.ts:170`);
  `/api/tracking/[id]` e `/pedido/[id]` buscam **só** por ele (`tracking/[id]/route.ts:8-17`).
  O cuid não é usado como credencial — **isso está correto**. O problema não é adivinhar o token:
  é que ele é devolvido em massa por `/api/orders` e `/api/orders/customer`.

### 3.5 Slug, loja inexistente e loja suspensa

- Slug inexistente → `notFound()` (`[slug]/page.tsx:76-78`); **não existe** `src/app/not-found.tsx`
  → 404 genérico do Next, sem stack vazada. Oráculo 404/200 permanece (F6A-029).
- Plano vencido/trial expirado → tela "Cardápio temporariamente indisponível" no **server
  component** (`[slug]/page.tsx:89-110`) — bom. Mas `POST /api/orders` **não** revalida
  (`:83-89`), então a API continua aceitando pedido daquela loja (F6A-024/F6B-014).
- `isOpen=false` e `isOpenOverride` (pausa manual) **não são lidos** no cardápio nem no servidor
  (F6B-004/005).
- **Não existe domínio próprio/subdomínio**: grep por `customDomain|domain|subdomain` = 0 em todo
  o repositório → não há superfície de *subdomain takeover*.
- **Sem redirecionamento aberto**: grep de `redirect(`/`Location:` com input do usuário = 0 no
  `[slug]`.
- `/api/icon/[slug]` é proxy de logo: `logo.startsWith("http")` → `fetch(logo)` (SSRF para
  arquivo/pasta interna se o logo for editável — e **é**, `logo` está em `SAFE_FIELDS`) e
  `path.join(process.cwd(), "public", logo)` sem normalização → `logo = "/../.env"` lê `.env`
  (F6A-012).

### 3.6 Headers, CORS, clickjacking

Nenhum bloco `headers()` em `next.config.js` (arquivo tem 16 linhas, só `images.remotePatterns`
com `hostname: "**"` e `poweredByHeader: false`), nenhum header em `vercel.json` (só `crons`), nenhum
`Access-Control-Allow-*` em lugar nenhum (**CORS bem configurado por ausência**) e nenhuma
definição de CSP. F1C-112 permanece: CSP/HSTS/X-Frame só existiriam se configurados no painel da
Vercel — **fora do repositório**.

---

## 4. 6.2 — Pagamento e dados do cliente

| Item | Situação | Evidência |
|---|---|---|
| Dados de cartão pelo servidor? | **SIM — problema PCI.** `creditCard.number`/`cvv` vão do navegador ao Next e de lá ao gateway | `payments/asaas/card/route.ts:73-79`; `integrations/pagarme.ts:267-275`; front `menu-page.tsx:6896-6912` (sem Bearer) |
| Auth nas rotas de cartão | **AUSENTE** em `payments/asaas/card` e `payments/pagarme/card` (`verifyAuth` = 0) | idem |
| Webhook Asaas | Valida token (`webhooks/asaas:10-29`) | ok |
| Webhook Pagar.me | Valida **se** houver `pagarmeWebhookKey` (senão aceita) | `webhooks/pagarme:16-22` |
| Webhook Efi | Sem assinatura; `efiWebhookToken` existe no modelo e **nunca é conferido** | `webhooks/efi/route.ts:7-19` |
| Webhook Inter | Sem assinatura, mas **compara o valor pago** (≥ 99% do total) | `payments/inter/webhook/route.ts:4,32` |
| Webhook 99 (corridas) | Sem assinatura e sem conferir valor | `webhooks/99/route.ts:5-10` |
| Cozinha só depois de pagar? | **Parcial**: há filtro que esconde pedido online não pago (`orders/route.ts:727-746`), mas `body.method` (`:432`) permite burlar (F6B-001) | |
| Comissão/repasse | `saasCommissionPercentage` lido e **não usado** (`:19`); split só no Pagar.me (`:31`); Asaas/Inter/Efi sem split | F6B-015 |
| Receita | `cash-flow` soma `order.total` de todo pedido não cancelado — inclui não pagos | `financial/cash-flow/route.ts:21,33,56` |
| Dados do cliente | Nome, telefone, CPF, endereço trafegam em clara por API anônima (F6A-006/007/008) | |
| Troco (`changeFor`) | Gravado sem limite e sem checar `maxPayOnDeliveryAmount` no valor | `orders/route.ts:426-427` |

---

## 5. 6.3 — Regras de negócio do cardápio

### Checklist obrigatório (item 6.6 do termo)

| # | Requisito | Feito? | Evidência |
|---|---|---|---|
| 1 | Recalcula preço do produto, adicionais, taxa, desconto e total **no servidor** | **NÃO** | `orders/route.ts:93-98` (`subtotal = Σ i.price*qtd` com `price` do body); `:94-98` (entrega/fidelidade/cupom/1ª compra do body); front monta `item.price = basePrice+optionsPrice` (`menu-page.tsx:1804-1811`) e envia `total` (`:2054-2061`) |
| 2 | Valida que `productId`/adicionais pertencem à loja e estão `isAvailable`/`availableOnline` | **NÃO** | `orders/route.ts:408-455` — **nenhuma consulta a `Product`**; só grava `items` como JSON (`:429`) |
| 3 | Valida loja aberta (horário, `isOpen`, `isOpenOverride`, fuso, plano) | **NÃO** | `:83-89` só `findUnique`+404; grep `businessHours\|isOpen` no route = 0 |
| 4 | Valida quantidade, cupom, CEP/área/raio, mínimo, agendamento | **NÃO** (0 de 5) | qtd sem piso/teto no server (`:93`); cupom só `timesUsed++` (`:479-484`) e rota de validação **inexistente**; `/api/delivery/calculate` existe mas nunca é chamado no checkout; mínimo só no front (`menu-page.tsx:1468-1472,5321-5326`); agendamento cru (`:438-439`) |
| 5 | Idempotência contra duplo clique/retry | **PARCIAL** | trava só no front (`menu-page.tsx:1914-1915` + `finally :2162-2166`); servidor gera `trackingToken` novo por request (`orders/route.ts:170`); grep `idempoten` = 0 |
| 6 | Meios de pagamento e `changeFor` vs limite | **NÃO** | `:426-427` grava cru; grep `paymentConfig\|orderConfig` no route = 0. *Positivo:* bloqueio de cliente (`:108-127`), teto (`:130-142`) e concorrência (`:144-168`) **são** checados |

### Estados da loja

| Estado | Front | Servidor |
|---|---|---|
| Fechada por horário | `isOpen` em `useMemo` (`menu-page.tsx:754-769`) — **nunca reavaliado** (F6B-005) | não checa |
| Pausada (`isOpenOverride`) | **0 referências** | não checa |
| Plano expirado | tratado no server component (`[slug]/page.tsx:89-110`) | API aceita pedido (F6A-024) |
| Agendado | sem UI; aceito cru pelo servidor (`:438-439`) | sem janela (`scheduledMinHours` validado só no bot, `bot/create-order:100-133`) |

### Outras regras

- **Estoque**: `deductProductStock` grava `quantity - qty` **sem piso** e nunca rejeita o pedido
  (`lib/stock.ts:84-88,111-115`); cliente nunca vê "esgotado" (grep `esgotado` = 0).
- **Taxa de entrega**: `DeliveryZone`, `deliveryFeeAmount`, `deliveryFreeAbove` e
  `GET /api/delivery/calculate` **existem**, mas o checkout não os usa — `GeolocationButton` foi
  removido do render (F6B-007), logo `geoDeliveryInfo` fica sempre `null`.
- **Combos/variações/adicionais obrigatórios**: `DailyCombos` nunca é renderizado (F6B-025);
  adicionais obrigatórios validados **só na tela**.
- **iFood/99Food**: disponibilidade sincroniza, preço não (F6B-027); pedido do site entra no mesmo
  fluxo (KDS lê `/api/orders` — `kds/screen/page.tsx:110` —, estoque é deduzido `orders/route.ts:451`,
  auto-assign de entregador em `ready` `orders/[id]/route.ts:344`).
- **Notificações**: disparam só quando o status muda, com sino deduplicado
  (`orders/[id]/route.ts:372-402`), mas a leitura é feita **antes** do `update` (TOCTOU → duplica,
  F6B-028).

---

## 6. 6.4 — Desempenho e SEO (4G)

| Verificação | Resultado | Evidência |
|---|---|---|
| Renderização | **SSR dinâmico, sem ISR** — Prisma lido a cada request por `slug`; **não há mistura de cache entre lojas** | `[slug]/page.tsx:64-74`; nenhum `export const dynamic/revalidate` na rota |
| Peso do código | `menu-page.tsx` = **7.360 linhas / 397 KB** → chunk da rota **~266.588 B** | `wc -l`; `.next/static/chunks/app/[slug]/page-84175929c7654a93.js` |
| Imagens | 13 `<img>`, **0** `next/image`; só `loading="lazy"` em 3 | grep no `menu-page.tsx` |
| Requisições por visita | ≥ 12 chamadas de catálogo + polling duplicado: `/api/orders/customer` 2× a cada 15 s e **2** pollers de `payment-status` a cada 3 s | `menu-page.tsx:2356-2372,2734-2769,6814-6839` |
| `generateMetadata` | **Presente**, com OG/Twitter por loja | `[slug]/page.tsx:20-57` |
| `robots.ts` / `sitemap.ts` | **Inexistentes** | `ls src/app/robots.ts src/app/sitemap.ts` → não existe |
| `canonical` | Ausente | grep = 0 |
| JSON-LD / schema.org (`Restaurant`) | **Ausente** | grep `ld+json\|schema.org` = 0 |
| OG image | Fixo 1200×630 mesmo para logo retrato | `[slug]/page.tsx:42-56` |
| `manifest`/ícone/tema por loja | **Presente** e com `Cache-Control` | `layout.tsx:4-32`; `api/manifest/[slug]:20-47` |
| URL amigável | Sim, `/<slug>` | — |
| WAF/CDN/edge | Não verificável no repo | — |

---

## 7. 6.5 — UX e conversão

**O que está bom:** checkout anônimo completo (sem login para comprar); carrinho persistido por
loja em `localStorage` (`menu-page.tsx:244-255`); service worker registrado
(`components/pwa/service-worker-register.tsx:12`); limites de 3 endereços
(`api/addresses/route.ts:52-55`); máscaras de telefone/CEP/cartão (`menu-page.tsx:429-432`,
`:6935-6938`, `:7163-7188`); `generateMetadata` por loja; bloqueio de loja expirada com mensagem
clara (`[slug]/page.tsx:89-110`).

**O que trava a conversão:**

1. Loja pausada/fechada em segundo plano não desliga o checkout (F6B-004/005) → **pedido que a
   cozinha não consegue atender**.
2. Cupom com rota inexistente → erro silencioso ou 404 no momento mais sensível (F6B-012).
3. Sem "esgotado" no cliente (F6B-017) e sem zona de entrega/taxa calculada (F6B-007) → surpresa
   no total e carrinho abandonado.
4. Polling duplicado (F6B-020) + 266 KB de JS (F6B-022) → página lenta em 4G.
5. A11y rasa (5 `aria-*` em 7.360 linhas) e nenhum sniff de webview (F6B-029/030) → embaixo do
   Instagram/WhatsApp o comportamento não é testado.

---

## 8. 6.6 — Testes

Roteiros e scripts gravados; **todos NÃO EXECUTADOS** (regra 2.5 — `DATABASE_URL` = produção;
proibido executar contra produção).

| Arquivo | Cobertura | Obtido |
|---|---|---|
| `auditoria/testes/6-01-vazamento-cardapio.sh` | Vazamento de credenciais/custo/`trackingToken` no HTML e nas APIs de catálogo (F6A-001/002/003/010/017) | **NÃO EXECUTADO** |
| `auditoria/testes/6-02-criacao-pedido.sh` | 9 casos de criação de pedido: preço adulterado, `body.status`, produto cross-tenant, fidelidade sem saldo, quantidade absurda, agendamento no passado, cupom inválido, idempotência (F1C-201/202, F6B-001/002/003/006/013/018) | **NÃO EXECUTADO** (destrutivo — só em ambiente de teste) |
| `auditoria/testes/6-03-superficie-anonima.sh` | 26 rotas públicas: 15 de leitura + 11 de escrita, esperando 401/403 (F6A-004…008, 016/035, 019, 020, 022, 027, 034, 036, 037, 039, 043) | **NÃO EXECUTADO** |
| `auditoria/testes/6-04-headers-seo.sh` | Headers (CSP/X-Frame/nosniff/Referrer/HSTS), `robots.txt`, `sitemap.xml`, canonical, JSON-LD, peso de HTML/chunk (F6A-018, F6B-021/022) | **NÃO EXECUTADO** |
| `auditoria/testes/6-05-roteiro-xss-ux.md` | Roteiro manual: 7 casos de XSS armazenado, 4 de vazamento HTML, 10 de criação de pedido, 10 de estados da loja/conversão, 8 de UX/a11y, 6 verificações estáticas já executadas por leitura | **NÃO EXECUTADO** (exceto bloco F, feito por leitura) |

**Bloco executado (estático):** ausência de `robots.ts`/`sitemap.ts`, presença de
`generateMetadata`, 7.360 linhas do `menu-page.tsx`, 0 `next/image`, 0 JSON-LD — todos registrados
na seção 6.4.

**Ambiente mínimo para executar:** 2 lojas de teste (uma `subscriptionStatus="expired"`, uma
`isOpen=false`), `ESTAB_ID`, `OUTRO_ESTAB_ID`, `PROD_ID`, `PROD_OUTRO_ID`, um `TRACKING_TOKEN`
válido e um banco **não** de produção.

---

## 9. 6.7 — XSS

| Vetor | Entrada | Onde é renderizado | Sanitização | Evidência |
|---|---|---|---|---|
| Nome do produto | painel → cardápio | `/<slug>` (JSX, **seguro**), comandas KDS/caixa/dashboard | **nenhuma nas 3 impressões** | `kds/screen/page.tsx:476`, `caixa/caixa-page.tsx:951`, `dashboard/pedidos/page-content.tsx:738` — todos `document.write(\`…${…}\`)` |
| Descrição do produto | idem | idem | idem | idem |
| Observação do pedido | checkout → cozinha | 3 impressões | idem | idem |
| Nome do cliente / endereço | checkout → tracking + comandas | `/pedido/[id]` (JSX, seguro) + 3 impressões | idem | idem |
| Logo da loja | painel (`logo` editável, ∈ SAFE_FIELDS) | `/api/icon/[slug]` serve como imagem | permite `http` (proxy) e caminho local | `icon/[slug]/route.ts:38-51` |

**Conclusões:**

- **Não há XSS refletido/armazenado nas telas React** — todo o cardápio, `/pedido/[id]` e a mesa
  renderizam por JSX; grep por `dangerouslySetInnerHTML` e `innerHTML` em `src/app` = **0**.
- O XSS está **nas 3 rotas de impressão**, que montam HTML por `document.write` com interpolação
  direta. Como o JWT de operador fica em `localStorage` (F1C-018), o payload executa **com a sessão
  da equipe** → roubo de token (F6A-015, já reportado como F1C-103).
- **`Content-Type: image/svg+xml`** em `/api/icon/[slug]` (`:50`) torna SVG hospedado um vetor
  executável na origem.
- CSP **inexistente** (F6A-018) → nada conteria a execução mesmo com XSS.

---

## 10. O que está bom

1. **Token de acompanhamento forte**: `randomBytes(12)` (96 bits), `@unique`, e as rotas de
   tracking/busca consultam **só** por ele — cuid não é credencial (`orders/route.ts:170`;
   `tracking/[id]/route.ts:8-17`).
2. **`payment-status` e `messages` token-gated**, sem vazar chaves (`payment-status/route.ts:19-46`;
   `messages/route.ts:16-32`).
3. **Upload fechado para o visitante**: exige JWT, allowlist de MIME, limite 2 MB e re-encode com
   `sharp` (`upload/route.ts:9-25`; `image-upload.ts:4,51-62`).
4. **Transação atômica na criação**: número do pedido + dedução de estoque no mesmo
   `prisma.$transaction` (`orders/route.ts:408-455`).
5. **Regras anti-abuso de entrega** bem desenhadas: `blockedUntil` (`:108-127`), teto de pagamento
   na entrega (`:130-142`) e bloqueio de pedido concorrente (`:144-168`).
6. **Filtro cozinha × pagamento online** existe (`orders/route.ts:727-746`) — falha apenas porque
   `body.method` é aceito (F6B-001).
7. **Mesmo fluxo para pedido do site**: KDS, estoque, auto-assign de entregador e estorno de pontos
   no cancelamento (`orders/[id]/route.ts:74-105,344`).
8. **`mesa/[number]` usa allowlist de campos** (`mesa/[number]/page.tsx:29-52`) — é exatamente o
   padrão que falta em `[slug]/page.tsx` e `pedido/[id]`.
9. **Filtros de conteúdo corretos**: `isAvailable` (`[slug]/page.tsx:69`), `active` em
   stories/banners/combos.
10. **Verificação de WhatsApp completa**: bcrypt, 3 tentativas, 5 min, cooldown 60 s, 5/h e 10/d
    por número (`verification/route.ts:6,92-110,300-336`) — o defeito é o bypass de cliente.
11. **`saas-admin` autenticado de verdade** (`saas-admin-auth.ts:16-37` com `jwtVerify` + `role`) —
    falso positivo descartado durante a auditoria.
12. **Sem CORS mal configurado**, sem redirecionamento aberto, sem `customDomain`/subdomínio
    (logo, não há superfície de takeover), `poweredByHeader: false`.
13. **Sem mistura de cache entre lojas**: a página lê Prisma por `slug` a cada request e os GETs
    da API são dinâmicos.
14. **SEO base sólido**: `generateMetadata` + OG/Twitter + manifest/ícone/tema por loja.

---

## 11. NÃO VERIFICADO

- Nenhuma resposta HTTP capturada — todo vazamento é conclusão por leitura de código (flight
  payload confirmado pela semântica de props de client component, não por `curl`).
- Headers/CSP/HSTS podem estar no painel da Vercel ou no CDN (só auditei o repositório).
- Políticas dos buckets `images`/`Imagens` no Supabase Storage (só o código de upload).
- Se `ASAAS_WEBHOOK_TOKEN` e `pagarmeWebhookKey` estão preenchidos em produção — sem eles, Asaas
  recusa e Pagar.me **aceita sem assinatura** (`webhooks/pagarme:16-22`).
- Se o `cwd` do deploy é a raiz do projeto (F6A-012 pressupõe isso).
- LCP/CLS/TTFB reais em 4G e tamanho do HTML em runtime (sem dispositivo/rede controlados).
- Comportamento real nas webviews do Instagram/WhatsApp (não há sniffing no código, mas não testei
  em dispositivo).
- Concorrência real do `orderNumber` sob carga (dedução lógica).
- Contraste de cores WCAG e navegação por teclado (só evidência estatística de `aria-`).
- Se `prisma/seed.ts` (tokens `test-order-001/002`) já rodou em produção.
- Rotas fora do escopo desta fase: `webhooks/*`, `cron/*` e bot em profundidade.
- Quantas das 32 credenciais estão de fato preenchidas em produção.
- WAF/anti-bot/rate-limit na camada de borda.

---

## 12. Top 5 ações

1. **Tornar o servidor a única fonte de verdade no `POST /api/orders`** — recalcular preço,
   adicionais, entrega, desconto, cupom e fidelidade; validar `productId`+`isAvailable`+
   `availableOnline` **pertencente à loja**, loja aberta/plano ativo, mínimo, CEP/raio e janela de
   agendamento; e **remover `body.status`/`body.method`** (aceitando só `pending|payment_pending`).
   Fecha F6B-001/002/003/004/013/014/018 + F1C-201/202 com um único `buildOrderInput()`.
2. **Parar de serializar o estabelecimento inteiro** — trocar os 3 `include`/`findUnique` sem
   `select` por `select` whitelistado em `[slug]/page.tsx:64-74`, `pedido/[id]/page.tsx:76,89`,
   `orders/route.ts:680` e `establishments/route.ts:116-150`; **em seguida rotacionar as 32
   credenciais + `password` + `JWT_SECRET` + `DATABASE_URL`** (repo público + endpoint aberto).
   Fecha F6A-001/002/003/017.
3. **Fechar as 3 ações financeiras anônimas e as rotas de equipe** — `verifyAuth` +
   `establishmentId === authUser.establishmentId` em `pix-generate`, `delivery/dispatch-99`,
   `payment-request` (GET/PATCH/POST), `cash-register`, `suppliers`, `expenses`,
   `delivery-payments`, `customers`, `orders/customer`, `categories`, `products/[id]`,
   `stock`, `push/*` (F6A-004…008, 011, 013, 014, 028, 034–040, 043).
4. **Segurança base + XSS** — mover `middleware.ts` para `src/`, adicionar os headers
   (CSP/X-Frame/nosniff/Referrer/HSTS) em `next.config.js`, trocar os 3 `document.write` por
   montagem DOM segura (ou `textContent`) e corrigir `icon/[slug]` (allowlist de caminho +
   `Content-Type` não executável). Fecha F6A-012/015/018 + F6B-010.
5. **Fechar o ciclo de conversão** — `Idempotency-Key` no servidor (F6B-006), reativar
   geolocalização/zonas e checar `isOpen` com tick de 60 s (F6B-005/007), criar
   `/api/coupons/validate` real (F6B-012), assinar webhooks Efi/Inter/99 conferindo valor
   (F6B-011), tokenizar cartão no navegador (F6B-009) e partir `menu-page.tsx` + gerar
   `robots`/`sitemap`/JSON-LD (F6B-021/022).
