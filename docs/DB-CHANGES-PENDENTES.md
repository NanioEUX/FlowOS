# Mudanças de banco pendentes de aprovação

> **Estado:** preparado, **NÃO aplicado**. Nada aqui foi rodado contra o banco
> de produção. Os SQLs são idempotentes e podem ser aplicados pelo dono (ou pelo
> dev, com o `DATABASE_URL` de produção) **antes** do deploy do código que usa
> as colunas.
>
> **Por que não foi aplicado:** o projeto usa `db push` (sem
> `_prisma_migrations`) e o `.env` local aponta para o **Supabase de produção**.
> Mudar o schema sem o dono decidir é o tipo de erro que derruba a produção.

Preparado em: 01/11/2026 · itens: **F4B-019** (idempotência) e **F9C-005**
(aceite/consentimento LGPD).

---

## 1. F4B-019 — Idempotência do `POST /api/orders`

### Problema

O cardápio (e o bot) podem reenviar o mesmo pedido: duplo clique, retry de
rede, retry do proxy. Hoje cada reenvio **cria um pedido novo** — e, quando o
pagamento é online (PIX/cartão), **cobra o cliente duas vezes**.

### Arquivos

| Arquivo | O que é |
|---|---|
| `scripts/migration_client_request_id.sql` | SQL da coluna + índice único (idempotente) |
| `src/lib/order-idempotency.ts` | Helper **já implementado e testado** (normaliza/valida a chave) |
| `src/lib/__tests__/order-idempotency.test.ts` | 10 testes do helper (rodam sem banco) |

### Passo 1 — aplicar o SQL

```bash
# Supabase SQL Editor (ou psql):
psql "$DATABASE_URL" -f scripts/migration_client_request_id.sql
```

O que ele faz:

```sql
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_establishmentId_clientRequestId_key"
  ON "Order" ("establishmentId", "clientRequestId")
  WHERE "clientRequestId" IS NOT NULL;
```

> No Postgres, NULLs são distintos entre si num índice único — os pedidos
> antigos (sem chave) não conflitam entre si. O índice é **parcial** para não
> penalizar a tabela `Order` (que é a mais escrita do banco).

### Passo 2 — `prisma/schema.prisma`

```diff
 model Order {
   id                 String          @id @default(cuid())
+  clientRequestId    String?         // chave de idempotência (header Idempotency-Key)
   orderNumber        Int?
   ...
+  @@unique([establishmentId, clientRequestId])
 }
```

> ⚠️ **Ordem importa.** Não rode `npx prisma generate`/`db push` com o campo
> novo no schema **antes** do SQL: o Prisma Client passaria a referenciar uma
> coluna inexistente e **todas** as queries de `Order` passariam a falhar.
> Aplique o SQL primeiro (ou rode `db push`, que faz os dois).

### Passo 3 — ligar no `POST /api/orders`

`src/app/api/orders/route.ts` — três pontos:

**(a) Ler a chave e devolver o pedido já criado** — logo depois de resolver o
`establishment` (antes de qualquer cobrança):

```ts
import { extractClientRequestId, idempotencyLookup } from "@/lib/order-idempotency"

// dentro do POST, antes de criar o pedido:
const clientRequestId = extractClientRequestId(req)

if (clientRequestId) {
  const existing = await prisma.order.findFirst({
    where: idempotencyLookup(establishmentId, clientRequestId)!,
    include: { establishment: true },
  })
  if (existing) {
    // Replay: devolve o MESMO pedido, sem cobrar de novo
    return NextResponse.json({
      order: existing,
      paymentLink: existing.paymentLink,
      pixPayload: existing.pixPayload || "",
      trackingUrl: `/pedido/${existing.trackingToken}`,
      lowStockItems: [],
    })
  }
}
```

**(b) Gravar a chave no create** — dentro do `tx.order.create({ data: { … } })`:

```ts
...(clientRequestId ? { clientRequestId } : {}),
```

**(c) Tratar a corrida** — hoje o `catch` de `P2002` só refaz o
`orderNumber`. Com a nova chave, o mesmo `P2002` pode ser do índice de
idempotência (duas requisições simultâneas com a mesma chave). O
`e.meta.target` distingue os dois casos:

```ts
} catch (e: any) {
  if (e?.code !== "P2002") throw e
  // P2002 na chave de idempotência → outra requisição criou o pedido;
  // devolve o existente em vez de tentar de novo.
  const target = String(e?.meta?.target ?? "")
  if (clientRequestId && target.includes("clientRequestId")) {
    const existing = await prisma.order.findFirst({
      where: idempotencyLookup(establishmentId, clientRequestId)!,
      include: { establishment: true },
    })
    if (existing) {
      return NextResponse.json({
        order: existing,
        paymentLink: existing.paymentLink,
        pixPayload: existing.pixPayload || "",
        trackingUrl: `/pedido/${existing.trackingToken}`,
        lowStockItems: [],
      })
    }
  }
  lowStockItems.length = 0  // P2002 do orderNumber → tenta o próximo número
}
```

### Passo 4 — cliente

O cardápio (`src/app/[slug]/menu-page.tsx`) deve gerar uma chave por tentativa
de pedido (não por item do carrinho) e reenviá-la no retry:

```ts
const idempotencyKey = crypto.randomUUID()
// fetch("/api/orders", { headers: { "Idempotency-Key": idempotencyKey }, … })
```

> Sem isso, o servidor continua sem idempotência — o header é **opcional** e
> o comportamento atual (criar pedido novo) é preservado quando a chave não
> vem. É por isso que o passo 4 é seguro de adiar.

### Verificação

```bash
# 1. dois POSTs com a mesma chave → 1 pedido só
curl -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: teste-123' -d @payload.json
curl -X POST "$BASE/api/orders" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: teste-123' -d @payload.json

# 2. no banco
SELECT "orderNumber", "clientRequestId", "paymentStatus"
  FROM "Order" WHERE "clientRequestId" = 'teste-123';
```

Rollback: o bloco de `ROLLBACK` no fim do `.sql`.

---

## 2. F9C-005 — Aceite de termos e consentimento (LGPD)

### Problema

O cadastro da loja não tem aceite de Termos de Uso nem de Política de
Privacidade, e **nada disso é gravado**. O checklist de go-live (item 19)
exige: *"Termos publicados + aceite + consentimento gravado — cadastro com
checkbox; row com timestamp"*.

### O que este SQL **não** resolve

| Item | Quem resolve |
|---|---|
| Termos de Uso e DPA publicados | **Jurídico** (F9C-004/006) — não é código |
| Checkbox no cadastro + gravar o aceite | Código (abaixo) |
| Exportação/anonimização de dados | Feature futura (F9C-010/F1D-006) |

### Arquivo

`scripts/migration_lgpd_consent.sql` — adiciona 7 colunas (3 em
`Establishment`, 4 em `Customer`). Idempotente.

```sql
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "privacyPolicyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "dataDeletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);
```

> `marketingConsent` começa em `false`: sem consentimento explícito, não há
> marketing (opt-in, não opt-out).

### `prisma/schema.prisma`

```diff
 model Establishment {
   ...
+  termsAcceptedAt          DateTime?
+  privacyPolicyAcceptedAt  DateTime?
+  termsVersion             String?
 }

 model Customer {
   ...
+  marketingConsent      Boolean   @default(false)
+  marketingConsentAt    DateTime?
+  dataDeletionRequestedAt DateTime?
+  anonymizedAt          DateTime?
 }
```

### Código (aplicar depois do SQL)

1. `src/app/cadastro/page.tsx` — checkbox de aceite (obrigatório) + link para
   `/termos-de-uso` e `/politica-de-privacidade`.
2. `src/app/api/establishments/route.ts` (POST) — gravar
   `termsAcceptedAt`/`privacyPolicyAcceptedAt`/`termsVersion` **só** se o
   checkbox veio marcado; recusar o cadastro sem aceite.
3. `src/app/api/customers/route.ts` — gravar `marketingConsent` /
   `marketingConsentAt` a partir do consentimento explícito do cliente.
4. `src/app/politica-de-privacidade/page.tsx` — o texto atual já existe;
   falta o equivalente `/termos-de-uso` (conteúdo do jurídico).

---

## Ordem de aplicação sugerida

1. `scripts/migration_client_request_id.sql` → `scripts/migration_lgpd_consent.sql`
2. `npx prisma generate` (regenera o client — **não** escreve no banco)
3. `schema.prisma` com os campos acima
4. Código do `POST /api/orders` (idempotência) e do cadastro (aceite)
5. Deploy
6. `npx prisma db push` **não é necessário** se os SQLs acima já foram
   aplicados — rode só para conferir que o banco e o schema estão em sincronia
   (`npx prisma migrate diff` compara sem escrever).

## Checklist de verificação

```bash
npx prisma validate                       # schema OK
npx prisma generate                       # client OK
npx tsc --noEmit && npx vitest run && npm run build
```

No banco:

```sql
SELECT indexname FROM pg_indexes
 WHERE tablename = 'Order' AND indexname LIKE '%clientRequestId%';

SELECT column_name FROM information_schema.columns
 WHERE table_name IN ('Customer','Establishment')
   AND column_name LIKE '%Consent%' OR column_name LIKE '%AcceptedAt%';
```

## Decisões do dono que ainda faltam

- [ ] Aplicar os SQLs em produção? (e em qual janela)
- [ ] Onde ficam os Termos de Uso (domínio, empresa, jurisdição)? — F9C-004
- [ ] Consentimento de marketing é opt-in no cadastro do cliente ou só no
      dashboard da loja? — F9C-005
- [ ] A idempotência é ligada já no primeiro deploy ou depois de testar em
      homologação? — F4B-019
