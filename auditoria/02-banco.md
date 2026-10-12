# FASE 2 — BANCO DE DADOS E INTEGRIDADE

**Saída:** `auditoria/02-banco.md` · Somente leitura · Nenhum comando executado contra banco/produção.

---

## 1. Resumo

O banco é **Prisma + PostgreSQL (Supabase)** com **47 modelos** e **61 relações `@relation`**
(59 FKs com `fields:` declarados) — não há RLS, nem funções, nem triggers, nem views: **toda a proteção e toda a regra de negócio
vivem no código** (a única barreira é o `verifyAuth`, que a Fase 1 mostrou desligado). O schema
tem pontos maduros (`@@unique([establishmentId, orderNumber])`, `@@unique([establishmentId,
externalId])`, 39 `@@index`, 51 relações com `onDelete: Cascade`), mas **o versionamento de DDL
praticamente não existe**: as 4 migrations do repositório contêm 31 `ALTER TABLE` e **zero**
`CREATE TABLE`, enquanto `prisma migrate diff --from-empty` gera **47** — ou seja, o schema inteiro
entrou por `db push` e **não é reproduzível por `migrate deploy`**. Na aplicação, o problema mais
grave é **mass assignment**: `prisma.product.update({ data: await req.json() })` escreve
qualquer coluna do modelo, incluindo `establishmentId` e `price`. Há ainda corrida na numeração
de pedidos, dia de fechamento calculado em **UTC** (0 usos de `America/Sao_Paulo`), **53 campos
`Float` e nenhum `Decimal`**, 83 de 111 `findMany` sem `take`, N+1 no cálculo de CMV que roda a
cada pedido, e 16 modelos sem **nenhum** índice.

**Nota da área: 5,5/10.**

| Severidade | Qtd |
|---|---|
| CRÍTICO | 1 |
| ALTO | 9 |
| MÉDIO | 9 |
| BAIXO | 3 |
| **Total** | **22** |

---

## 2. Tabela de achados

| ID | Sev. | Módulo | Título | Esforço |
|---|---|---|---|---|
| **F2-001** | **CRÍTICO** | Integridade/escrita | Mass assignment: corpo bruto vira `data` do Prisma em produtos, opções e estoque — qualquer coluna editável, incl. `establishmentId` e `price` | P |
| **F2-002** | ALTO | Migrations | Schema inteiro fora do versionamento: 0 `CREATE TABLE` nas migrations vs 47 modelos | M |
| **F2-003** | ALTO | Concorrência | `MAX(orderNumber)+1` sem trava → requisição perde o pedido no pico (500) | P |
| **F2-004** | ALTO | Fuso horário | Dia de caixa/relatório e horário de funcionamento calculados em **UTC** (0 usos de `America/Sao_Paulo`) | M |
| **F2-005** | ALTO | Tipos monetários | 53 `Float`, **0 `Decimal`**, 13+ campos de dinheiro, nenhum `CHECK` | M |
| **F2-006** | ALTO | Queries | 83 de 111 `findMany` sem `take`; `GET /api/orders` devolve **todos** os pedidos do tenant com `include` completo | M |
| **F2-007** | ALTO | N+1 | N+1 no cálculo de CMV (roda a cada pedido), em alerts, catálogo iFood, compras e atualização de preços | M |
| **F2-008** | ALTO | Transações | Escritas multi-etapa **fora** de transação (produto, opções, estoque, fechamento de mesa, snapshot de CMV) | M |
| **F2-009** | ALTO | Conexões | `PrismaClient` não é cacheado em produção → 1 pool por cold start | P |
| **F2-010** | ALTO | Índices | 16 modelos sem **nenhum** índice ou restrição de unicidade (Product, StockItem, Category, Coupon…) | M |
| **F2-011** | MÉDIO | FK | 13 campos estrangeiros reais sem constraint (`CashMovement.orderId`, `FinancialTransaction.orderId`, `Review.orderId`…) | M |
| **F2-012** | MÉDIO | Cascata | 10 relações sem `onDelete` → comportamento padrão não intencional ao excluir | P |
| **F2-013** | MÉDIO | Auditoria | 28 de 47 modelos sem `updatedAt` (8 também sem `createdAt`) → sem trilha de alteração | M |
| **F2-014** | MÉDIO | Exclusão | Sem soft delete e sem `AuditLog`; exclusões são definitivas | M |
| **F2-015** | MÉDIO | Modelagem | JSON em coluna `TEXT` (`Order.items`, `loyaltyConfig`, `permissions`) e 79 `JSON.parse` sem `try` | M |
| **F2-016** | MÉDIO | Concorrência | **Zero** `SELECT … FOR UPDATE` no projeto inteiro | M |
| **F2-017** | MÉDIO | Crescimento | 8 tabelas que inflam sem particionamento, arquivamento ou expurgo | M |
| **F2-018** | MÉDIO | Banco | Nenhuma função, trigger ou view no banco — regras invisíveis para o DBA/auditoria | P |
| **F2-019** | MÉDIO | Ambientes | Um único `DATABASE_URL` (produção); sem staging; sem separação dev/prod | M |
| **F2-020** | BAIXO | Repositório | `schema.prisma.bak3` versionado → fonte de drift silencioso | P |
| **F2-021** | BAIXO | Multi-tenant | `User.email @unique` global impede o mesmo e-mail em lojas diferentes | P |
| **F2-022** | BAIXO | Numeração | Pedidos de iFood/poll são criados **sem** `orderNumber` → numeração por loja com buracos | P |

---

## 3. Detalhamento

### F2-001 — CRÍTICO — Integridade — Mass assignment no `data` do Prisma

**Evidência**
- `src/app/api/products/[id]/route.ts:68` → `data = await req.json()`; `:75-78` →
  `prisma.product.update({ where: { id }, data })`. Nenhuma allowlist.
- `src/app/api/additional-options/route.ts:89-95` → `const { id, ...data } = body` →
  `additionalOption.update({ where: { id }, data })`.
- `src/app/api/stock/[id]/route.ts:12-13,21-23,33-35` → `const { type, ...data } = body` →
  `stockFamily/stockCategory/stockItem.update({ data })`.
- Contraponto (padrão correto já existente): `src/app/api/establishments/[id]/route.ts:38,71-75`
  usa `SAFE_FIELDS` e copia campo a campo.

**Impacto no negócio** — Quem conseguir um token (ou ninguém, com o middleware morto — F1A-001)
escreve **qualquer coluna**: troca `establishmentId` (move produto/opção/-item de estoque para
outra loja), altera `price`/`promoPrice`/`ifoodPrice` (fraude de preço), `active`/`available`
(mercadinho invisível), `createdAt` (distorce relatórios) e `id` (renomeia a PK). É
simultaneamente falha de integridade e vetor de fraude financeira.

**Como reproduzir** — `PATCH /api/products/<id>` com `{ "establishmentId": "<outro-tenant>",
"price": 0.01 }` e observar a resposta: os dois campos vêm alterados.

**Correção** — Allowlist por rota (copiar o padrão de `establishments/[id]:38`):
```ts
const SAFE = ["name","price","promoPrice","description","active","available","categoryId", ...] as const
const body = await req.json()
const data = Object.fromEntries(Object.entries(body).filter(([k]) => (SAFE as readonly string[]).includes(k)))
```
Complementar com `zod` (instalado, **0 usos** — F1C-115) e com a checagem de dono (F1B-001).

**Esforço:** P

---

### F2-002 — ALTO — Migrations — O schema inteiro está fora do versionamento de DDL

**Evidência**
- `prisma/migrations/` tem exatamente **4** diretórios; varredura de todas as `migration.sql`:
  `31 ALTER TABLE` e **`1 CREATE INDEX`** — **`0 CREATE TABLE`**.
- `npx prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema.prisma --script`
  gera **47 `CREATE TABLE`** (+ índices e constraints).
- Migrations manuais fora do gerador: `prisma/migrations/20260730_scheduled_orders/migration.sql:4`
  usa `TIMESTAMP` enquanto o Prisma geraria `TIMESTAMP(3)` (confirmado no mesmo `migrate diff`);
  idem `20260730_bot_v2_features/migration.sql:38`.
- `prisma/schema.prisma.bak3` (14/09) versionado ao lado do `schema.prisma` (05/10).

**Impacto no negócio** — Um banco novo (staging, restore, novo ambiente do cliente) **não sobe**
com `prisma migrate deploy`: nenhuma tabela é criada. O estado real do banco é irreconstruível a
partir do repositório, e qualquer `migrate dev` no futuro vai tentar recriar 47 tabelas que já
existem, gerando divergência. Quem restaurar um backup não sabe se o schema corresponde ao código.

**Como reproduzir** — Rodar `prisma migrate deploy` num Postgres vazio e verificar que `public`
fica sem tabelas; ou comparar a saída do `migrate diff` com as migrations.

**Correção** — Criar uma migration baseline com o DDL completo do `migrate diff --from-empty`
(`prisma migrate resolve --applied 0_init` no ambiente existente) e passar a gerar **toda**
alteração por `prisma migrate dev`. Remover `schema.prisma.bak3` (F2-020).

**Esforço:** M

---

### F2-003 — ALTO — Concorrência — Número de pedido calculado por `MAX` sem trava

**Evidência** — `src/app/api/orders/route.ts:408-414`:
```ts
const order = await prisma.$transaction(async (tx) => {
  const result: any[] = await tx.$queryRawUnsafe(
    `SELECT COALESCE(MAX("orderNumber"), 0) + 1 as next FROM "Order" WHERE "establishmentId" = $1`, ...)
  const orderNumber = Number(result[0]?.next || 1)
```
- Não há `FOR UPDATE` (grep `for update` → **0** no projeto, F2-016).
- Não há retry em `P2002`: o `catch` de criação de pedido devolve 500
  (`orders/route.ts` bloco externo).
- Existe a rede de segurança `@@unique([establishmentId, orderNumber])`
  (`prisma/schema.prisma:500`) — ela **impede duplicidade**, convertendo o problema em
  **requisição recusada**.

**Impacto no negócio** — Sob concorrência real (pico de almoço/jantar, 2 pedidos simultâneos no
mesmo milissegundo), a segunda transação lê o mesmo `MAX`, tenta inserir o mesmo número, esbarra
na unique e **aborta**: o cliente vê erro e **o pedido não é criado**. Critério de CRÍTICO da
seção 2 é "pedido perdido em produção"; classifico como ALTO porque depende de concorrência
efetiva — mas é exatamente o cenário de pico.

**Como reproduzir** — Script em `auditoria/testes/2-01-order-race.sh` (escrito, **não executado**):
duas `POST /api/orders` simultâneas para a mesma loja com `curl --parallel`.

**Correção** — Sequência por loja em vez de `MAX`:
```sql
CREATE SEQUENCE "Order_orderNumber_<tenant>" ; -- ou tabela OrderSequence(establishmentId, next)
SELECT nextval(...) FOR UPDATE
```
ou, mais simples: manter o `MAX` mas **adicionar retry com backoff em `P2002`** (3 tentativas).

**Esforço:** P

---

### F2-004 — ALTO — Fuso horário — "Dia" calculado em UTC

**Evidência**
- `grep -rn "America/Sao_Paulo" src prisma` → **0 ocorrências**; nenhum campo de fuso no schema
  (`grep timezone|timeZone` em `schema.prisma` e `src/` → 0).
- `src/app/api/dashboard/route.ts:37-41` — `todayStart = new Date(now.getFullYear(),
  now.getMonth(), now.getDate())` (meia-noite do relógio do servidor = **UTC** na Vercel).
- `src/app/api/cash-register/summary/route.ts:16-17` e
  `cash-register/history/route.ts:21` — mesmo padrão + `"T23:59:59.999Z"`.
- `src/app/api/expenses/route.ts:77,129` — `new Date().toLocaleDateString("en-CA")` (fuso do
  servidor).
- `financial/{cmv,revenues,dre,cash-flow}/route.ts:13-17` — `new Date(to + "T23:59:59")`.
- **Horário de funcionamento**: `establishments/[id]/toggle-open/route.ts:13-50` e
  `cron/sync-ifood-status/route.ts:18-50` comparam `now.getHours()` (UTC) contra `businessHours`
  da loja (horário brasileiro).

**Impacto no negócio** — Entre **21h e 23h59 (Brasil)** o UTC já está no dia seguinte:
o dashboard mostra "hoje" com os pedidos do dia seguinte, o **fechamento de caixa do dia errado**,
as despesas de "hoje" aparecem atrasadas e o resumo financeiro diário está deslocado em 3h. Em
horário de funcionamento, uma loja que abre às 18h é considerada **aberta às 21h** no servidor —
afeta aceitação automática de pedidos e o cron do iFood.

**Como reproduzir** — `auditoria/testes/2-02-timezone.sh` (**não executado**): criar um pedido às
22h00 BRT e conferir se ele cai em `todayStart` do `/api/dashboard`.

**Correção** — Definir o fuso do tenant (`Establishment.timezone`, default
`America/Sao_Paulo`) e calcular as fronteiras com `Intl.DateTimeFormat("en-CA", { timeZone })`
ou `date-fns-tz`; guardar o "dia" como coluna derivada (`orderDay DATE`) para relatórios.

**Esforço:** M

---

### F2-005 — ALTO — Tipos monetários — `Float` em dinheiro, nenhum `Decimal`, nenhum `CHECK`

**Evidência**
- `grep -c " Float"` em `prisma/schema.prisma` → **53**; `grep -c " Decimal"` → **0**;
  `grep -c " CHECK"` nas migrations → **0**.
- Campos de dinheiro em `Float` (amostra): `Product.price`, `DailyCombo.price`,
  `AdditionalOption.price`, `Order.total`, `Order.deliveryFee`, `Order.changeFor`,
  `DeliveryPayment.amount`, `CashTransfer.amount`, `CashMovement.amount`, `Expense.amount`,
  `PartialPayment.amount`, `CancellationLog.total`, `DeliveryZone.fee`, `Customer.totalSpent`
  (`schema.prisma:243,339,458-459,606,630,678,696,708-710,730,739,751,801,953`).
- Já mapeado como F1C-209 na Fase 1; aqui o ângulo é **modelagem/precisão**.

**Impacto no negócio** — `0.1 + 0.2 !== 0.3` em ponto flutuante: somatórios de DRE, CMV, split de
pagamento e fechamento de caixa acumulam erro de centavos. Sem `CHECK (price >= 0)`, preço
negativo é aceito pelo banco (e pelo F2-001, escrito pelo cliente).

**Como reproduzir** — `SELECT SUM(total)::text FROM "Order" LIMIT 1` somado linha a linha em JS
e comparado com `SUM(total)` no Postgres.

**Correção** — `Decimal @db.Decimal(10,2)` (ou `BigInt` em centavos) nos campos monetários +
`CHECK` por tabela; para `Order`, migrar para `totalCents INTEGER`.

**Esforço:** M (migração de dados + ajuste em ~40 pontos de leitura)

---

### F2-006 — ALTO — Queries sem limite nem paginação

**Evidência**
- Varredura de todos os `.findMany(` de `src/`: **111** ocorrências, **83 sem `take`** nas 16
  linhas seguintes. Exemplos: `financial/dre/route.ts:34`, `financial/cmv/route.ts:28`,
  `financial/revenues/route.ts:25`, `cash-register/summary/route.ts:19`,
  `delivery-persons/deliveries/route.ts:23`, `customers/route.ts:57`,
  `payments/sync/route.ts:157`, `payment-request/route.ts:33`.
- O pior: `src/app/api/orders/route.ts:748-757` — `order.findMany({ where, include: {
  establishment: {...}, customer: {...} }, orderBy: { createdAt: "desc" } })` **sem `take`**,
  devolvendo **todos** os pedidos (histórico completo) com joins.
- `src/app/api/alerts/route.ts:16-45` — carrega **todos** os `Expense` e **todos** os
  `StockItem` do tenant para calcular um alerta em JavaScript, a cada poll.

**Impacto no negócio** — Latência crescente linearmente com o tamanho da loja; payload do KDS e
do dashboard infla (MBs de JSON); risco de timeout da função serverless e de esgotar conexões do
pooler (ver F2-009).

**Como reproduzir** — Contar bytes de `GET /api/orders?establishmentId=X` numa loja com 10 mil
pedidos (script `2-03-unbounded.sh`, **não executado**).

**Correção** — `take` + `cursor`/`skip` em toda listagem; agregações via `aggregate`/`groupBy`
em vez de `findMany` + `reduce` (alerts, DRE, CMV).

**Esforço:** M

---

### F2-007 — ALTO — N+1 e consultas por item

**Evidência**
- **CMV (roda a cada pedido):** `src/lib/cmv.ts:34-52` — `for (const item of items) { … await
  prisma.productStockLink.findMany({ where: { productId }, … }) }`; chamado por
  `api/orders/route.ts:460` (`computeOrderItemCosts`) em toda criação de pedido.
- **Catálogo iFood:** `api/ifood-catalog/import/route.ts:86,160` (`category.create` e
  `additionalOption.create` dentro de loop), `ifood-catalog/push/route.ts:171,332`
  (`update` por item), `ifood-catalog/route.ts:114,157`.
- **Outros:** `api/purchases/route.ts:93` (`stockItem.findUnique` por item),
  `api/products/update-prices/route.ts:95` (`product.update` por produto),
  `api/expenses/route.ts:33,43` (`expense.update` por linha),
  `api/alerts/route.ts:36,49`, `cron/sync-ifood-status/route.ts:66,96`.
- Contraponto: `dashboard/route.ts:49-…` usa `Promise.all` com 19 consultas — padrão bom.

**Impacto no negócio** — 10 itens no pedido = 10 idas ao banco só para CMV, dentro do caminho
crítico de criação de pedido (soma ao F1C-203). Importações de catálogo com 200 produtos geram
centenas de round-trips e podem estourar o timeout da função.

**Como reproduzir** — Log de `Prisma` em desenvolvimento (`log: ["query"]`) contando queries
por requisição.

**Correção** — Uma única consulta com `where: { productId: { in: ids } }` (como já faz
`stories/route.ts:37` com `id: { in: topIds }`) e `updateMany` com `where` composto nos lotes.

**Esforço:** M

---

### F2-008 — ALTO — Escritas multi-etapa fora de transação

**Evidência**
- `products/[id]/route.ts:101-106` — `productStockLink.deleteMany()` **em seguida**
  `product.delete()` (duas operações, `$transaction` ausente).
- `products/[id]/route.ts:75-78` — um único `update` que pode alterar preço + estoque +
  vinculação; sem transação.
- `products/update-prices/route.ts:95` — loop de `product.update` sem transação (falha no meio
  deixa preços pela metade).
- `api/orders/route.ts:460-470` — `orderItemCost.createMany` usa o `prisma` **global**, fora da
  `$transaction` de `:408`; erro só é logado (`catch` com `console.error`), deixando pedido sem
  snapshot de CMV.
- `cash-register/close-table/route.ts` — fechamento sem transação (já apontado em F1C-207).
- Contraponto: `orders/[id]/route.ts:78`, `99food-webhook/route.ts:162,185`,
  `webhooks/whatsapp/route.ts:466` **usam** `$transaction` corretamente (11 usos no total).

**Impacto no negócio** — Estado intermediário gravado: produto sem vínculos de estoque, tabela de
preços meio atualizada, pedido sem CMV (fecha errado o DRE), caixa parcialmente fechado.

**Correção** — `await prisma.$transaction([...])` (array) para sequências simples e
`$transaction(async tx => …)` para as que dependem uma da outra; passar o `tx` para
`computeOrderItemCosts`.

**Esforço:** M

---

### F2-009 — ALTO — Conexões — `PrismaClient` não é singleton em produção

**Evidência** — `src/lib/prisma.ts:19-21`:
```ts
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== "production") { globalForPrisma.prisma = prisma }
```
O cache em `globalThis` só acontece **fora** de produção; em produção cada cold start (e cada
instância de módulo isolada) cria um cliente novo com seu próprio pool. `process.on("beforeExit")`
(`:25-27`) **não dispara** em ambiente serverless. `.env` tem `connection_limit` presente
(confirmando que o pool é configurado por URL) e existe `DIRECT_URL`.

**Impacto no negócio** — Com `db push`/migrations e vários lambdas simultâneos, o número de
conexões no pooler do Supabase escala por instância → erros `P1001`/"too many connections" no
pico (o próprio código já trata `P1001` em `dashboard/route.ts:12-14`, sinal de que já aconteceu).

**Correção** — Cache incondicional: `globalForPrisma.prisma ??= createPrismaClient()` (padrão
oficial da Prisma) e remover o `beforeExit` em produção.

**Esforço:** P

---

### F2-010 — ALTO — Índices ausentes

**Evidência** — Modelos **sem nenhum** `@@index`/`@@unique`/`@unique` (16):
`Category`, `Product`, `DailyCombo`, `DailyComboItem`, `AdditionalOption`, `StockFamily`,
`StockCategory`, `StockItem`, `Supplier`, `PurchaseItem`, `Coupon`, `CashTransfer`,
`CashMovement`, `OrderMessage`, `LogWebhook99`, `SystemConfig`.
Com apenas `@unique` de coluna e **zero índice composto** (5): `Establishment`, `DeliveryPerson`,
`User`, `PasswordResetToken`, `CategoryTemplate`.

Consequência prática: toda busca por `establishmentId` nessas tabelas é **sequential scan**:
`Product` (42 colunas, usada em cada cardápio), `StockItem` (usada em `alerts/route.ts:36` e no
decremento de estoque), `Category` (montagem do cardápio), `OrderMessage` (já filtrada por
`order.establishmentId`, sem índice próprio).

Contraponto: `Order` está bem servido — 7 `@@index` (`schema.prisma:502-508`) + 2 `@@unique`.

**EXPLAIN** — **NÃO EXECUTADO**: `DATABASE_URL` aponta para produção (regra 2.5). Comando
pronto em `auditoria/testes/2-04-explain.sh`.

**Correção** — `@@index([establishmentId])` em `Product`, `Category`, `StockItem`,
`StockMovement`, `OrderMessage`; `@@index([establishmentId, createdAt])` em `CashMovement`,
`FinancialTransaction` (já tem), `AIUsageLog`.

**Esforço:** M

---

### F2-011 — MÉDIO — Campos estrangeiros sem constraint

**Evidência** — 13 campos que referenciam outra tabela mas **não** têm `@relation`
(varredura comparando campos `*Id` com `fields: [...]` declarados):
`ProductLike.customerId`, `OrderItemCost.productId`, `Purchase.supplierId`,
`CashRegister.currentUserId`, `CashTransfer.fromUserId`, `CashTransfer.toUserId`,
`CashMovement.orderId`, `Expense.cashRegisterId`, `Review.orderId`, `CancellationLog.orderId`,
`FinancialTransaction.orderId`, `FinancialTransaction.paymentId`,
`CustomerNotification.couponId`, `PushLog.establishmentId`.
(Os demais `*Id` sem relação são IDs externos legítimos: `externalId`, `paymentId` de gateway,
`ifoodProductId`, `asaasCustomerId`, `metaPhoneNumberId` etc.)

**Impacto no negócio** — Nada impede gravar `orderId` inexistente em `CashMovement` ou
`establishmentId` de outra loja em `PushLog` → linhas órfãs, relatórios que não batem,
impossibilidade de join confiável. Agravado pelo F2-001 (cliente escreve essas colunas).

**Correção** — Adicionar `@relation` onde a tabela-alvo existe (`CashMovement.order`,
`FinancialTransaction.order`, `Review.order`, `CancellationLog.order`, `PushLog.establishment`…)
e `prisma migrate dev` para gerar as FKs.

**Esforço:** M

---

### F2-012 — MÉDIO — Relações sem `onDelete`

**Evidência** — 61 `@relation`, 51 com `onDelete`, **10 sem**:
`DeliveryPerson.userId`, `Product.stockItemId` (×3 relações), `Order.customerId`,
`Order.deliveryPersonId`, `Order.establishmentId`, `DeliveryPayment.paidById`,
`Coupon.establishmentId`, `Review.customerId`.

**Impacto no negócio** — O padrão do Prisma/Postgres assume `RESTRICT` para relação obrigatória
e `SETNull` para opcional. Excluir um `Order` com `Review` associada, ou um `User` com
`DeliveryPayment`, pode falhar com violação de FK (500) ou, no caso opcional, **apagar
silenciosamente** a referência (`customerId` → `null`), perdendo o vínculo de histórico.

**Correção** — Definir `onDelete` explicitamente em todas as 10 (provavelmente `Cascade` para
`Order.establishmentId` e `Restrict` para histórico).

**Esforço:** P

---

### F2-013 — MÉDIO — Sem trilha de alteração

**Evidência** — 28 de 47 modelos sem `updatedAt`; 8 deles também sem `createdAt`:
`Category`, `DailyComboItem`, `PurchaseItem`, `ProductStockLink`, `StoryItem` (sem ambos) e
`VerificationCode`, `ProductLike`, `OrderItemCost`… (com `createdAt` só). Nenhum `AuditLog`
(F1D-013).

**Impacto no negócio** — Impossível responder "quem mudou este preço/estoque e quando"; em caso
de divergência de caixa ou fraude interna não há como reconstruir a linha do tempo.

**Correção** — `@updatedAt` global (`@default(now())` + `@updatedAt`) e, para auditoria forte,
uma tabela `AuditLog(entity, entityId, actorId, action, diff, createdAt)`.

**Esforço:** M

---

### F2-014 — MÉDIO — Exclusão definitiva, sem soft delete

**Evidência** — `grep -ri "deletedAt|softDelete|isDeleted"` → **0**. Exclusões reais:
`products/[id]/route.ts:106`, `expenses/[id]/route.ts:57`,
`admin/banners/[id]/route.ts:48`, `admin/stories/[id]/route.ts:46-47`,
`suppliers/route.ts:79`, `daily-combos/route.ts:100`, `orders/delete-all/route.ts:13`.
O único "snapshot" que sobrevive é `CancellationLog` (`schema.prisma:827-849`), só para
cancelamento.

**Impacto no negócio** — Apagar um produto apaga o histórico de vendas vinculado (CMV por
`OrderItemCost` fica órfão — F2-011); apagar despesa apaga evidência contábil; não há como
recuperar sem backup.

**Correção** — Soft delete (`deletedAt`) para `Product`, `Expense`, `Supplier`, `Category`;
exclusão real apenas para dados operacionais efêmeros (`VerificationCode`, `LogWebhook99`).

**Esforço:** M

---

### F2-015 — MÉDIO — JSON em coluna de texto

**Evidência** — `schema.prisma:457` `Order.items String`; `:122` `loyaltyConfig String`;
`:653` `permissions String`. Só 2 campos usam o tipo `Json` (`LogWebhook99.payload`,
`FinancialTransaction.metadata`). `grep -rn "JSON.parse" src --include='*.ts'` → **79**
ocorrências, várias sem `try`, ex.: `api/payments/efi/route.ts:48`,
`api/orders/route.ts:92`, `kds/(auth)/screen/page.tsx:430`,
`pedido/[id]/tracking-page.tsx:80`.

**Impacto no negócio** — Uma linha corrompida (escrita parcial, bug, edição manual) quebra a
renderização do pedido inteiro (KDS, caixa, tracking) com erro de parsing; o banco **não** valida
a estrutura, não consegue consultar itens (`WHERE items->>'productId'` não existe em TEXT) e não
impede JSON inválido.

**Correção** — Migrar `Order.items` para `Json` (Prisma suporta) ou para tabela
`OrderItem` (elimina também o F2-011 de `OrderItemCost.productId`); envolver os `JSON.parse` em
`try` com fallback.

**Esforço:** M

---

### F2-016 — MÉDIO — Nenhuma trava de concorrência

**Evidência** — `grep -rniE "for update"` → **0** em `src/` e `prisma/`. Os 11 `$transaction`
existentes usam o modo callback sem isolamento customizado (padrão `READ COMMITTED` do Postgres).
Estoque é decrementado com read-modify-write (`lib/stock.ts:77-88,104-115`, F1C-204).

**Impacto no negócio** — Dois caixas fechando a mesa ao mesmo tempo, ou pedido + webhook
concorrendo no estoque, podem aplicar perdas de atualização (venda sem baixar estoque) ou
deadlock não tratado.

**Correção** — `SELECT … FOR UPDATE`/`UPDATE … SET quantity = quantity - $1 WHERE id=$2 AND
quantity >= $1` (atômico) nos pontos de estoque e de caixa.

**Esforço:** M

---

### F2-017 — MÉDIO — Crescimento sem estratégia

**Evidência** — Tabelas que crescem sem parar e **sem** particionamento, arquivamento ou expurgo:
`Order` (+`OrderItemCost`, `OrderMessage`), `CancellationLog`, `AIUsageLog`, `PushLog`,
`VerificationCode`, `LogWebhook99`, `FinancialTransaction`, `StockMovement`.
Nenhum cron de retenção existe (F1D-007); `vercel.json:3-11` só tem 2 crons.

**Impacto no negócio** — Em 12 meses com 50 lojas, `Order` e `AIUsageLog` dominam o tamanho do
banco; queries com `ORDER BY createdAt` ficam lentas mesmo com índice (tabela grande demais);
custo do plano Supabase sobe; `LogWebhook99` guarda payload bruto de terceiro indefinidamente
(risco LGPD, F1D-007).

**Correção** — Cron de expurgo por tabela (OTP 30d, logs 6 meses, `LogWebhook99` 90d), e
particionamento mensal de `Order` por `createdAt` quando ultrapassar ~5M de linhas.

**Esforço:** M

---

### F2-018 — MÉDIO — Nenhuma função, trigger ou view

**Evidência** — Nas migrations: só `ALTER TABLE` (31) e `CREATE INDEX` (1); `grep -ri
"CREATE FUNCTION|CREATE TRIGGER|CREATE VIEW|SECURITY DEFINER"` → 0 no repositório inteiro.

**Impacto no negócio** — Não é necessariamente ruim (regras em código são testáveis), mas hoje
**não existe nenhuma garantia no nível do banco**: nada impede escrita direta fora das regras,
não há trigger de auditoria, nem view de relatório, nem função de fechamento atômico. Com
`DATABASE_URL` de produção nas mãos de quem desenvolve, um `psql` manual corrompe dados sem
qualquer trilha.

**Correção** — Ao mínimo: trigger de auditoria em `Order`/`Establishment` e constraint `CHECK`.
Reavaliar triggers de negócio só se houver múltiplos escritores.

**Esforço:** P

---

### F2-019 — MÉDIO — Ambientes

**Evidência** — `.env` expõe apenas **um** `DATABASE_URL` (+ `DIRECT_URL`), apontando para o
pooler de produção (`aws-1-us-east-1.pooler.supabase.com`, host apurado na Fase 0).
Não há `staging`/`dev` URL, nem `supabase/config.toml`, nem separação de banco por ambiente.

**Impacto no negócio** — Todo teste de migração, seed e restauração acontece contra produção.
É o motivo direto de a Fase 1B não ter podido ser executada e de nenhum `EXPLAIN` ter sido
rodado.

**Correção** — Criar projeto Supabase separado (ou schema) para staging, com `DATABASE_URL` de
staging no `.env.local` e produção só em secrets da Vercel.

**Esforço:** M

---

### F2-020 — BAIXO — `schema.prisma.bak3` versionado

**Evidência** — `prisma/schema.prisma.bak3` (45 KB, 14/09) ao lado de `prisma/schema.prisma`
(47 KB, 05/10); `diff` mostra 1 modelo de diferença (`ProductLike`).
Também `src/app/[slug]/menu-page.tsx.{bak,bak2,bak3,backup}` (F1C-124).

**Impacto** — Ferramentas que varrem `prisma/*.prisma` (e revisores) podem ler o schema errado.

**Correção** — `git rm` dos `.bak` e regra no `.gitignore` (pendência de autorização).

**Esforço:** P

---

### F2-021 — BAIXO — `User.email` único global

**Evidência** — `prisma/schema.prisma:650` `email String @unique` (sem `@@unique([establishmentId,
email])`).

**Impacto** — Um funcionário que trabalha em duas lojas da plataforma **não pode** ter a mesma
e-mail nas duas contas; hoje força a criar e-mails fictícios (`loja1+x@`).

**Correção** — Trocar para `@@unique([establishmentId, email])` (mantendo `email` não nulo).

**Esforço:** P

---

### F2-022 — BAIXO — Pedidos externos sem número

**Evidência** — `api/orders/route.ts:411-436` é o **único** ponto que atribui `orderNumber`;
`api/orders/ifood-webhook/route.ts:126,158,194` e `ifood-poll/route.ts:186` criam `Order`
**sem** `orderNumber` (campo opcional, `schema.prisma:443`), preservando-o apenas em atualização
(`ifood-webhook:231`, `99food-webhook:193`).

**Impacto** — A loja vê `#null`/`#—` para pedidos do iFood no KDS e no caixa; a numeração da
loja tem buracos; `@@unique` não cobre esses casos (nulos são distintos no Postgres).

**Correção** — Atribuir o mesmo `MAX+1` (ou `nextval`) na criação vinda de webhook, dentro da
mesma transação.

**Esforço:** P

---

## 4. O que está bom

- **`@@unique([establishmentId, orderNumber])`** (`schema.prisma:500`) e
  **`@@unique([establishmentId, externalId])`** (`:501`) — protegem contra duplicidade de pedido
  e de sincronização externa (é o que transforma a corrida do F2-003 em erro, não em pedido
  duplicado).
- **`Order` bem indexado**: 7 `@@index` compostos por tenant + data/status/tipo/motoboy
  (`schema.prisma:502-508`), exatamente o padrão recomendado.
- **`@@unique([establishmentId, phone])` em `Customer`** (`:264`) e
  `@@unique([productId, deviceKey])`, `@@unique([productId, stockItemId])`, `@@unique([orderId])`
  em `Review` — unicidade onde importa.
- **51 de 61 relações com `onDelete` explícito** — maioria `Cascade`, evitando órfãos.
- **11 pontos com `$transaction`** nos fluxos críticos: criação de pedido + baixa de estoque
  (`orders/route.ts:408`), cancelamento (`orders/[id]:78`), webhooks iFood/99
  (`99food-webhook:162,185`), mensagens (`whatsapp/route.ts:466`).
- **Prisma parametrizado**; os `$queryRawUnsafe`/`$executeRawUnsafe` usam mapa de literais
  fechado (`whatsapp/route.ts:112-127`) ou parâmetros `$1` (`orders/route.ts:411`).
- **`connection_limit` e `DIRECT_URL` configurados** no `.env`.
- **Seed e `prisma generate`** separados (`postinstall` só gera o client).
- **Alerta de consistência**: o próprio código trata `P1001`/pool em
  `dashboard/route.ts:12-14` — sinal de monitoramento existente.
- **`Promise.all`** nas 19 consultas do dashboard (`dashboard/route.ts:49+`) — bom padrão de
  paralelismo.

---

## 5. NÃO VERIFICADO

| Item | O que faltou |
|---|---|
| **`EXPLAIN`/`ANALYZE`** nas queries pesadas | Requer banco; `DATABASE_URL` = produção (regra 2.5). Comando pronto em `testes/2-04-explain.sh` |
| **Tamanhos reais das tabelas** e taxas de crescimento | Sem acesso ao banco; não há dump (pendência da Fase 0) |
| **Backups e PITR** — configurados? restauração testada? | Painel Supabase → Database → Backups; fora do alcance do repositório |
| **`prisma migrate status`** (drift real entre migrations e banco de produção) | Executa consulta ao banco |
| **Índices existentes de fato no banco** (criados por `db push` podem divergir do schema) | Requer `pg_indexes` |
| **RLS/roles/grants** no Postgres | Sem acesso; no repositório não há `CREATE POLICY` |
| **Deadlocks reais** em produção | Sem logs do banco |
| **Estado do `VerificationCode`/`LogWebhook99`** (volume, expurgo) | Sem consulta |
| **Função/trigger criado fora do repositório** (direto no painel) | Sem acesso ao banco |
| **Plano Supabase e limites de conexão** | Entrada da seção 3 ausente |

---

## 6. Top 5 ações imediatas

1. **Fechar mass assignment (1 dia):** allowlist em `products/[id]`, `additional-options` e
   `stock/[id]` (copiar `SAFE_FIELDS` de `establishments/[id]:38`) + `zod` nos corpos. É a
   correção de maior retorno: fecha F2-001 e reduz o alcance do F1B-001.
2. **Baseline de migrations (meio dia):** gerar `0_init` com o DDL do `migrate diff
   --from-empty`, marcar como aplicado no ambiente existente e proibir `db push` a partir daí;
   remover `schema.prisma.bak3`. *(F2-002, F2-020.)*
3. **Fuso + dinheiro (2 dias):** coluna `timezone` no `Establishment`, fronteiras de dia via
   `Intl` com fuso do tenant, e migração dos campos monetários para `Decimal(10,2)`/centavos com
   `CHECK >= 0`. *(F2-004, F2-005.)*
4. **Pico sem perder pedido (1 dia):** retry em `P2002` na criação de pedido (ou sequência por
   loja com `FOR UPDATE`) + `take`/paginação em `GET /api/orders` e nas rotas financeiras.
   *(F2-003, F2-006, F2-016.)*
5. **Banco sustentável (1 semana):** `@@index` nos 16 modelos sem índice, `updateMany` no lugar
   de loops (CMV, catálogo, preços), `$transaction` nas escritas multi-etapa, cache global do
   `PrismaClient`, FKs nas 13 relações órfãs e cron de expurgo para as 8 tabelas que inflam.
   *(F2-007 a F2-017.)*

---

## 7. Scripts preparados (NÃO EXECUTADOS)

| Script | Objetivo | Obtido |
|---|---|---|
| `auditoria/testes/2-01-order-race.sh` | 2 `POST /api/orders` simultâneos → espera 1 sucesso + 1 retry | **NÃO EXECUTADO** |
| `auditoria/testes/2-02-timezone.sh` | Pedido às 22h BRT deve contar no "hoje" do dashboard | **NÃO EXECUTADO** |
| `auditoria/testes/2-03-unbounded.sh` | Tamanho do payload de `GET /api/orders` sem paginação | **NÃO EXECUTADO** |
| `auditoria/testes/2-04-explain.sh` | `EXPLAIN ANALYZE` das 10 queries mais pesadas | **NÃO EXECUTADO** |

Bloqueio único e repetido: **não existe ambiente de banco de teste** (só produção).
