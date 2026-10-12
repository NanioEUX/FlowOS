# FASE 5 — REGRAS DE NEGÓCIO POR MÓDULO

**Data:** 09/10/2026 · **Saída:** `auditoria/05-negocio.md` (5.1–5.11) · **Termo:** `AUDITORIA-SAAS-FOOD.txt:270-371`
**Regra central da fase:** *se uma regra existir só na tela e não no servidor, é achado.*

## Escopo e método

- **Leitura 100% estática** (regra 2.5 — `DATABASE_URL` aponta para produção; nenhum `curl`, nenhum script executado contra remoto/banco).
- Varredura em 4 blocos (5A pedidos/estoque/financeiro/dashboard · 5B cardápio/entregas/caixa · 5C config/integrações/Meta · 5D KDS) por sub-agentes de leitura, com **conferência pessoal das âncoras críticas** pelo auditor (`sed -n` de 47 trechos — todos os achados marcados ✅ abaixo foram relidos na fonte; os demais trazem a linha indicada pela varredura).
- Deduplicação contra **Fases 0/1/2/6/7** (coluna *Origem*: `Novo` ou `Rep. Fxx-xxx`) e **dentro da própria fase** (duplicados entre blocos unificados — ver ao final).
- Nenhum arquivo do produto foi modificado. Nenhum segredo impresso.

## Resumo

| Módulo | Achados | C | A | M | B | Novos/Rep. | Nota |
|---|---|---|---|---|---|---|---|
| 5.1 Pedidos | 17 | 6 | 8 | 3 | 0 | 11 / 6 | **3,0** |
| 5.2 Cardápio (admin) | 14 | 6 | 4 | 4 | 0 | 5 / 9 | **3,5** |
| 5.3 Entregas/motoboys | 9 | 4 | 4 | 1 | 0 | 5 / 4 | **3,0** |
| 5.4 Caixa/PDV | 14 | 0 | 3 | 8 | 3 | 12 / 2 | **4,0** |
| 5.5 Estoque | 7 | 2 | 2 | 3 | 0 | 3 / 4 | **3,5** |
| 5.6 Financeiro | 10 | 1 | 4 | 3 | 2 | 5 / 5 | **3,5** |
| 5.7 Dashboard | 5 | 0 | 0 | 5 | 0 | 4 / 1 | **4,5** |
| 5.8 Configurações | 9 | 2 | 7 | 0 | 0 | 3 / 6 | **3,0** |
| 5.9 Integrações (iFood/99/10) | 14 | 4 | 7 | 3 | 0 | 8 / 6 | **2,5** |
| 5.10 Meta/WhatsApp | 10 | 0 | 5 | 5 | 0 | 5 / 5 | **3,5** |
| 5.11 KDS | 22 | 0 | 8 | 12 | 2 | 17 / 5 | **3,0** |
| **Total (únicos)** | **131** | **25** | **52** | **47** | **7** | **78 / 53** | **3,3** |

- **78 achados novos** e **53 repetições** já registrados nas Fases 0/1/2/6/7 (coluna *Origem* = `Rep.`). A repetição é informativa: os mesmos buracos atravessam vários módulos.
- As **6 linhas** marcadas com *Origem* `(5.x)` são **remissões** (o achado já conta na seção indicada) — fora delas, os 131 IDs são únicos.
- **33 dos achados** foram ainda **confirmados por script estático** (`testes/5-02-regras-so-na-tela.sh`, executado: 33 CONFIRMADO / 0 a rever) e **47 âncoras críticas** foram relidas linha a linha pelo auditor (marcadas ✅).
- **Origem estrutural de quase tudo:** (1) `middleware.ts` fora do build → as rotas sem `verifyAuth` ficam totalmente abertas; (2) **a máquina de estados do pedido não existe no servidor** — qualquer `status` é gravável por qualquer caminho; (3) regras de preço/estoque/permissão implementadas só em React.

---

## 5.1 Pedidos

### Máquina de estados (como está HOJE)

| De → Para | Quem pode | O que dispara | Evidência ✅ | Risco |
|---|---|---|---|---|
| — → `body.status` (qualquer) | anônimo, `POST /api/orders` | baixa de estoque + snapshot CMV | `orders/route.ts:179` | cliente escolhe o estado inicial |
| `pending/new` → `payment_pending` | servidor (3 PSPs) | cria cobrança | `orders/route.ts:534` | ok |
| `payment_pending` → `confirmed` | anônimo + `trackingToken` (polling do gateway) | liquidação | `orders/[id]/payment-status/route.ts:84` | token portador muta estado |
| **qualquer** → `confirmed` | `payments/sync`, webhook Asaas | liquidação | `payments/sync/route.ts:100` | **regride pedido em `preparing/ready`** |
| **qualquer** → `cancelled` | webhook Asaas (`OVERDUE`) | cobrança vencida | `webhooks/asaas/route.ts:90` | **sem estorno de estoque nem log** |
| **qualquer** → **qualquer** | qualquer JWT da loja (sem papel, sem transição) | botão do painel/KDS | `orders/[id]/route.ts:181` | **não há máquina de estados** |
| `pending/payment_pending` → `cancelled` | anônimo + `trackingToken` | cancel self-service | `orders/[id]/route.ts:53` | única trava real |
| não-final → `cancelled` | autenticado da loja | cancel painel | `orders/[id]/route.ts:147` | **único ramo com estorno + `CancellationLog`** ✅ |
| `pending/new/payment_pending` → `abandoned` | **leitura** (`GET /api/orders`) | expurgo por `createdAt` | `orders/route.ts:706-713` | sem estorno; atinge agendados |
| mesa → `delivered` | `POST close-table` (JWT) | fechamento | `cash-register/close-table/route.ts:76-83` | pula estados; sem `paymentStatus` |
| mesa → `delivered+paid` | **anônimo** `PATCH payment-request` | conta paga | `payment-request/route.ts:63` | sem caixa, sem auth (Rep. F6A-004) |
| qualquer → livre | **anônimo** webhook 99Food | `statusMap[status] \|\| status` | `webhooks/99/route.ts:62` | string arbitrária em coluna `String` |
| `pending` → `preparing/ready/…` | iFood (webhook/poll) | eventos do marketplace | `ifood-poll/route.ts:98-101` | sem baixa de estoque no placeholder |
| qualquer → `delivered` | token do motoboy (8 bytes) | app do entregador | `delivery-persons/deliveries/route.ts:81` | sem auto-confirmação de pagamento |

**Quem NÃO pode (mas pode):** o servidor não checa `role` em nenhuma transição — o token `kds` cancela, entrega e volta estado (ver 5.11); o token `motoboy` escreve qualquer status; não existe nenhum guard de downgrade (`delivered` → `preparing` passa).

### Achados

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5A-002** | **CRÍTICO** | Novo | **PATCH sem máquina de estados:** grava `...(status && {status})` sem validar estado de origem, `role` nem valor do enum — qualquer autenticado da loja faz `delivered → preparing`. | `orders/[id]/route.ts:181` ✅ |
| **F5A-012** | **CRÍTICO** | Rep. F6B-001 | Status inicial vem do cliente (`body.status \|\| …`): cria pedido já `accepted`/`delivered`. | `orders/route.ts:179` ✅ |
| **F5A-009** | **CRÍTICO** | Novo | **Falha ao gerar PIX/cartão apaga o pedido** (`order.delete`, `:539`) depois da transação que já debitou estoque — sem `restoreOrderStock`. | `orders/route.ts:539` ✅ |
| **F5A-010** | **CRÍTICO** | Novo | **`OVERDUE` → `cancelled` sem estorno**: `payments/sync:33` e `webhooks/asaas:90` só fazem `order.update` — `restoreOrderStock` só existe em 4 arquivos (grep), nenhum deles financeiro. | `payments/sync/route.ts:33`; `webhooks/asaas/route.ts:90` ✅ |
| **F5A-011** | **CRÍTICO** | Novo | Cancelamento vindo do iFood **devolve estoque mesmo já devolvido** (nenhum guard de `status === "cancelled"`) e depois `order.delete` — estoque inflado + hard delete. | `ifood-poll/route.ts:138-140` ✅ |
| **F5A-022** | **ALTO** | Rep. F1C-106 | **Expiração de abandonados roda dentro de um GET** (`updateMany` a cada poll) e **não devolve o estoque** já debitado. | `orders/route.ts:706-713` ✅ |
| **F5A-013** | **ALTO** | Novo | Placeholder iFood preenchido com os itens reais via `order.update` **sem `deductOrderStock`** — o pedido maior nunca baixa estoque. | `ifood-poll/route.ts:165` ✅ |
| **F5A-017** | **ALTO** | Rep. F1A-012 | `close-table` marca tudo como `delivered` por `updateMany` — pula `preparing/ready`, não seta `paymentStatus`, inclui `payment_pending`. | `close-table/route.ts:76-83` ✅ |
| **F5B-018** | **ALTO** | Novo | **Reatribuição de motoboy é regra só da tela:** a UI envia `deliveryPersonId` no PATCH, o handler destructura só `status, paymentStatus, cancellationReason, cancelledBy` — a troca falha em silêncio. | `orders/[id]/route.ts:17,181` ✅ (UI: `dashboard/(auth)/entregas/page-content.tsx:164-172`) |
| **F5A-016** | **ALTO** | Rep. F1A-012 | Entregador grava qualquer `status` pelo token e **não executa o `autoConfirmPayment`** que o PATCH merchant roda — `cash/card_delivery` fica divergente. | `delivery-persons/deliveries/route.ts:81-90` ✅ |
| **F5A-023** | **ALTO** | Novo | Chargeback/estorno muda só `paymentStatus`: o pedido segue contabilizado como venda, sem devolver estoque nem fidelidade. | `webhooks/asaas/route.ts:90-97` ✅ |
| **F5A-031** | **ALTO** | Novo | **Pedido agendado expira como `abandoned`**: o expurgo filtra `createdAt < threshold` e ignora `isScheduled/deliveryDate`. | `orders/route.ts:706-713` ✅ |
| **F5C-030** | **ALTO** | Novo | Push de status ao iFood: `result.success` é só logado — **sem rollback, sem reprocesso**, painel e marketplace divergem. | `orders/[id]/route.ts:193-246` ✅ |
| **F5A-032** | **MÉDIO** | Novo | Estoque do agendado é debitado **na criação**, semanas antes da entrega, sem janela nem revalidação. | `orders/route.ts:451` ✅ |
| **F5D-020** | **MÉDIO** | Novo | Sem idempotência no PATCH: botão não desabilitado durante o request; dois dispositivos (caixa + KDS) empilham transições contraditórias. | `orders/[id]/route.ts:181` ✅ |
| **F5A-037** | **MÉDIO** | Rep. F1A-012 | `orders/delete-all` não checa papel: apaga pedidos e snapshots de CMV. | `orders/delete-all/route.ts:13` (varredura) |
| **F5A-003** | **CRÍTICO** | Rep. F1A-004 | `GET /api/orders` **anônimo** (nenhum `verifyAuth`) devolve a linha inteira — `trackingToken` (autoriza cancelamento), `paymentId` — e **sem `take`**. | `orders/route.ts:690,748-757` ✅ |

**Mesclagem de canais:** ✅ o campo `method` distingue `site/caixa/bot/ifood/99food` e o `CancellationLog.source` preserva a origem no cancelamento (`orders/[id]/route.ts:152`) — **o que falta é a origem no fluxo único de estados**: cada marketplace tem o seu próprio escritor (webhook/poll/99) com regras diferentes (ver 5.9), e não há tabela de reconciliação.

---

## 5.2 Cardápio (administração)

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5B-003** | **CRÍTICO** | Rep. F6A-010 | `GET /api/categories` (público, sem auth) devolve `stockLinks` + `stockItem` completos — `unitCost`, fornecedor, saldo — para qualquer visitante. | `categories/route.ts:15-29` ✅ |
| **F5B-002** | **CRÍTICO** | Novo | **`POST /api/categories` sem `verifyAuth`**: cria categoria/produto em qualquer `establishmentId` do body. | `categories/route.ts:32-42` ✅ |
| **F5B-013** | **CRÍTICO** | Novo | **Subtotal calculado com `i.price` do cliente**; `deliveryFee`, descontos de fidelidade/cupom/primeira compra também vêm do body e só são somados. | `orders/route.ts:91-98` ✅ |
| **F5B-011** | **CRÍTICO** | Rep. F6A-011 / F2-001 | `PATCH products/[id]` sem checagem de dono + mass assignment (JSON e multipart passam ao `update`). | `products/[id]/route.ts:73-76` |
| **F5B-012** | **CRÍTICO** | Rep. F6A-011 | `DELETE products/[id]` remove produto de qualquer tenant com token válido. | `products/[id]/route.ts:103-106` |
| **F5B-015** | **CRÍTICO** | Rep. F6A-026 / F2-001 | `additional-options` com IDOR cross-tenant (`{...data}` arbitrário em PATCH, DELETE por id). | `additional-options/route.ts:36-72,96-99,122` |
| **F5B-005** | **ALTO** | Rep. F6A-019 | `daily-combos` GET/POST/PATCH/DELETE sem auth e sem ownership. | `daily-combos/route.ts:23-52,94-101` |
| **F5B-016** | **ALTO** | Novo | `products/update-prices` recalcula e grava preços **em lote de `categoryId`/`stockItemId` vindos do body**, sem conferir dono. | `products/update-prices/route.ts:33-53,94-99` |
| **F5B-017** | **ALTO** | Rep. F2-001 | Ficha técnica (`stock/links`) aceita `productId` alheio; DELETE desvincula qualquer par. | `stock/links/route.ts:15-24,42-44` |
| **F5B-030** | **MÉDIO** | Novo | **Sem disponibilidade por horário no servidor** — `Product` só tem `newUntil` (banner "novo"); nenhuma rota filtra por janela. | `schema.prisma:335-378,349` ✅ |
| **F5B-031** | **MÉDIO** | Rep. F6B-026 | Flags `availableOnline/Presencial/Whatsapp` existem mas **o `POST /api/orders` não confere o canal** contra elas. | `orders/route.ts:75-98` ✅ (flags: `schema.prisma:343-345`) |
| **F5B-032** | **MÉDIO** | Novo | Limites `minSelection`/`maxSelection` de adicionais nunca validados na criação do pedido. | `schema.prisma:424-425`; `orders/route.ts:450-451` |
| **F5B-024** | **ALTO** | Rep. F6B-013 | **Cupom não validado**: só `timesUsed++` — sem `usageLimit`, `available`, `conditionValue`, expiração nem dono. | `orders/route.ts:478-483` ✅ |
| **F5B-029** | **MÉDIO** | Rep. F6B-027 | Sync de catálogo existe **só para iFood**; 99Food não recebe preço/disponibilidade e **"Pedidos 10" não existe no código**. | `ifood-catalog/sync/route.ts:23-41`; grep `pedidos10` = 0 |

> **Combos, variações e limites mín./máx.:** a estrutura existe no schema (adicionais com `min/maxSelection`, `daily-combos`) — o que falta é a validação no servidor (acima). **Ficha técnica ligada ao estoque:** existe (`stockLinks` + `deductOrderStock`), mas é **exposta ao público** (F5B-003) e **não sincroniza preço com o iFood** na reprecificação (F5B-034 → 5.9).

---

## 5.3 Entregas e motoboys

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5B-006** | **CRÍTICO** | Rep. F6A-014 | `POST /api/delivery-persons` sem auth: cria usuário `role: "motoboy"` com **senha padrão `123456`** (devolvida na resposta) em qualquer tenant. | `delivery-persons/route.ts:37-59` ✅ |
| **F5B-007** | **CRÍTICO** | Rep. F6A-043 | `delivery-payments` sem auth: cria repasses e lista o histórico de qualquer loja. | `delivery-payments/route.ts:4-44` |
| **F5B-009** | **CRÍTICO** | Rep. F6A-034 | `dispatch-99` anônimo: dispara corrida real gastando crédito da loja e devolve `pinCode`. | `delivery/dispatch-99/route.ts:11-77` |
| **F5B-010** | **CRÍTICO** | Rep. F1A-005 | `GET /delivery/poll-99` anônimo **percorre todos os tenants** e grava `delivered/cancelled` nos pedidos a cada chamada. | `delivery/poll-99/route.ts:11-26,54-62` |
| **F5B-019** | **ALTO** | Novo | Auth do entregador = **token hex de 8 bytes na query string** (`?token=`) + `status` livre, sem máquina de estados. | `delivery-persons/deliveries/route.ts:42-90`; token em `delivery-persons/route.ts:37` ✅ |
| **F5B-020** | **ALTO** | Novo | `deliveryCode` = **últimos 4 dígitos do telefone do cliente** e é devolvido a qualquer portador do `trackingToken`. | `orders/route.ts:440-441,187` ✅; `tracking/[id]/route.ts:38` |
| **F5B-021** | **ALTO** | Novo | Handshake de entrega valida código de 4 dígitos **sem limite de tentativas** (10k combinações); 1 erro já grava `delivered`. | `orders/[id]/delivery-handshake/route.ts:13-18,65-76` |
| **F5B-033** | **MÉDIO** | Novo | **Sem GPS, sem turno, sem recusa:** `DeliveryPerson` não tem lat/lng nem modelo de turno; não há endpoint de rastreio nem de recusa — só auto-atribuição por `createdAt`. | `schema.prisma:303-317`; `orders/[id]/route.ts:345-348` |
| **F5C-016** | **ALTO** | Novo | 99Food roda com endpoints que o próprio código declara **estimativa pendente de documentação oficial**, sem homologação. | `lib/integrations/nine-food-status.ts:3-16,97` |
| **F5A-016** | **ALTO** | (5.1) | Entregador sem auto-confirmação de pagamento ao concluir. | ver 5.1 |
| **F5B-026** | — | (5.1) | *unificado em F5A-016* | — |

**Privacidade/dados ao motoboy:** ✅ a lista de entregas filtra por `deliveryPersonId: person.id` (`deliveries/route.ts:76-79`) — o entregador só vê os próprios pedidos; **porém** o token é reutilizável e não expira, a comanda impressa (F5D-019) e o `GET /api/orders` anônimo entregam PII completa a qualquer um.

---

## 5.4 Caixa gerencial e frente de caixa (PDV)

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5B-008** | **ALTO** | Rep. F6A-037 | `GET/POST /api/cash-register` **sem `verifyAuth`** (as irmãs `summary/history/[id]` têm): abre caixa com valor arbitrário e lê todos os movimentos de qualquer loja. | `cash-register/route.ts:4-39` ✅ |
| **F5A-015** | **ALTO** | Novo | **Despesa grava `cashMovement.amount` positivo** e o fechamento soma `m.amount` direto → `expected = opening + Σmov` superestima o caixa em **2× o valor da despesa**. | `expenses/route.ts:209-217` ✅; `cash-register/[id]/route.ts:29-30` ✅ |
| **F5B-022** | **ALTO** | Novo | **`canCloseRegister` só esconde o botão**: o PATCH fecha o caixa com qualquer token autenticado (sem checar papel/permissão). | `cash-register/[id]/route.ts:5-43` ✅ (UI: `caixa/caixa-page.tsx:1150`) |
| **F5A-017** | **ALTO** | (5.1) | Fechamento de mesa: pedido criado com `price` do body, **sem baixa de estoque**, `serviceTax` do cliente no total lançado. | `close-table/route.ts:23-37,66` ✅ |
| **F5A-024** | ALTO | Rep. F6A-037 | *unificado em F5B-008* | — |
| **F5B-027** | **MÉDIO** | Novo | Fechamento **não checa `status === "open"`** (dá para reabrir caixa fechado) e usa `closingAmount ?? expected` — se o cliente não enviar o valor contado, **a divergência some**. | `cash-register/[id]/route.ts:27-41` ✅ |
| **F5B-028** | **MÉDIO** | Novo | Movimentos aceitam `type` arbitrário (sem enum `sale/expense/withdrawal/injection/refund`), poluindo a conferência por tipo. | `cash-register/[id]/movements/route.ts:45-62` |
| **F5A-036** | **MÉDIO** | Novo | *idem F5B-028 (type livre permite forjar receita esperada)* | `movements/route.ts:45` |
| **F5A-035** | **MÉDIO** | Novo | **O caixa só recebe movimento `sale` no fechamento de mesa** — delivery, PIX e online ficam de fora de `totalSales`/`salesByPayment`. | `close-table/route.ts:96-105`; `summary/route.ts:37-45` ✅ |
| **F5B-038** | **MÉDIO** | Novo | Abertura/fechamento **não registra o operador** (sem `currentUserId`/quem fechou): multioperador só por `transfer`, sem trilha de auditoria. | `cash-register/route.ts:31-36` ✅; `[id]/route.ts:32-41` |
| **F5B-035** | **MÉDIO** | Novo | **Sem NFC-e/SAT/TEF:** grep em `src/`+`prisma/` = 0; `CashMovement` não tem campos fiscais; só há gateways online. | `schema.prisma:736-746` ✅ (grep auditor) |
| **F5B-036** | **MÉDIO** | Novo | **Sem gorjeta (tip):** grep `gorjeta\|tip` = 0 no schema e nas rotas. | grep auditor ✅ |
| **F5B-037** | **MÉDIO** | Novo | **Sem offline/contingência:** o PDV guarda mesas só em `localStorage` (`pedefacil-tables-*`), sem fila offline nem reconciliação. | `caixa/caixa-page.tsx:291-302` |
| **F5B-041** | **BAIXO** | Novo | `transfer` aceita `amount` negativo (sem `> 0`). | `cash-register/[id]/transfer/route.ts:15-18,59-67` |
| **F5B-040** | **BAIXO** | Novo | Despesas categorizadas por **prefixo do texto** (`description.split(":")[0]`) — conferência contábil frágil. | `summary/route.ts:45-48` ✅ |
| **F5B-039** | **BAIXO** | Rep. F6B-023 | `changeFor` aceito sem exigir `paymentMethod` em dinheiro nem `>= total`. | `orders/route.ts:427` |

**Pagamento misto:** ✅ existe e funciona (`partialPayment` + `close-table` desconta `partialPaidTotal` — `close-table/route.ts:66-71` ✅), mas os parciais podem ser lidos sem auth (F6A-021) e são apagados sem backup no fechamento.

---

## 5.5 Estoque

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5B-004** | **CRÍTICO** | Rep. F6A-028 | `GET/POST /api/stock` **sem `verifyAuth`**: lê custos e movimentos e **cria itens/movimenta estoque** de qualquer loja via `establishmentId` do body. | `stock/route.ts:6-13,44-56,99-155` ✅ |
| **F5A-020** | **ALTO** | Rep. F6B-017 | **Baixa do pedido faz read-modify-write sem trava e sem piso** (`quantity - qty` gravado direto) — perde atualização sob concorrência e aceita saldo negativo; a saída manual (`stock/route.ts:114`) **bloqueia** `newQty < 0` ✅, o que mostra a assimetria. | `lib/stock.ts:84-90` ✅ |
| **F5A-008** | **CRÍTICO** | Rep. F6A-039 / F1A-005 | `POST /api/expenses` sem auth cria despesa **e movimenta estoque** (`stockLink`) em qualquer tenant. | `expenses/route.ts:222` (grep `verifyAuth` = 0) ✅ |
| **F5A-014** | **ALTO** | Novo | **Snapshot de CMV (`OrderItemCost`) só é gravado no `POST /api/orders`** — pedidos iFood/99/WhatsApp/mesa entram com custo 0. | `lib/cmv.ts:28`; `orders/route.ts:462-477` ✅ |
| **F5A-043** | **MÉDIO** | Novo | O snapshot roda **fora da transação**, N+1 por item e com `catch` só logando — pedido pode ficar com CMV 0 e contaminar a margem. | `orders/route.ts:462-477` ✅ |
| **F5A-033** | **MÉDIO** | Rep. F2-008 | Compra soma `quantity` **sem converter unidade** e **sem checar `stockItem.establishmentId`**; custo médio recalculado fora de transação. | `purchases/route.ts:93-115` ✅ |
| **F5A-034** | **MÉDIO** | Novo | Movimento de compra grava `type: "entrada"` enquanto todo o resto usa `entry/exit` — compras aparecem como saída na consolidação. | `purchases/route.ts:116` ✅ |
| **F5A-009/010/011/022** | — | (5.1) | Cancelamentos/estornos sem devolução (ou com devolução em dobro). | ver 5.1 |

**Concorrência (2 pedidos do último item):** o `deductOrderStock` roda dentro de `$transaction`, mas a leitura é `findUnique` sem `SELECT … FOR UPDATE` → sob `READ COMMITTED` os dois leem o mesmo valor e o segundo sobrescreve (lost update). Não executado em ambiente de teste (F2-008/F6-02): **`testes/5-01` cobre o cenário**.

---

## 5.6 Financeiro

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5A-006** | **CRÍTICO** | Rep. F6A-013 | `financial/{dre,cmv,revenues,cash-flow}` **sem `verifyAuth`** (grep = 0 em todos): qualquer visitante lê o financeiro de qualquer `establishmentId`. | `financial/dre/route.ts:5` ✅ |
| **F5A-018** | **ALTO** | Novo | **A DRE não tem linha de CMV:** `lucroBruto = receitaLiquida − custoEntregas` — o módulo `/api/financial/cmv` existe e nunca é consultado. | `financial/dre/route.ts:87-92` ✅ |
| **F5A-019** | **ALTO** | Rep. F6B-016 | DRE/receitas/fluxo filtram só `status: { not: "cancelled" }` → **contam `pending`, `payment_pending`, `abandoned` e agendados** como faturamento realizado. | `dre/route.ts:17` ✅; `cash-flow/route.ts:21` ✅ |
| **F5A-044** | **ALTO** | Rep. F2-004 | Agrupamento por dia usa `toISOString()` (**UTC**) e o fim do período usa `new Date(to + "T23:59:59")` no fuso do servidor — pedidos das 21h–24h caem no dia seguinte. | `cash-flow/route.ts:15,33` ✅ |
| **F5A-030** | **MÉDIO** | Novo | Em `expenses`, o `where.OR` do filtro de data (lancamento/agendada/recorrente) é **sobrescrito** pelo `where.OR` do filtro de busca → o período some quando há busca. | `expenses/route.ts:54-67` ✅ |
| **F5A-029** | **MÉDIO** | Novo | O "Dinheiro" da DRE filtra `paymentMethod === "money"` mas o sistema grava `cash` → **sempre R$ 0,00**; `byPayment` do `/revenues` descarta `cash/delivery/pickup`. | `dre/route.ts:114-118` ✅ |
| **F5A-039** | **BAIXO** | Novo | `descontos` da DRE **fica sempre 0**: o bloco do cupom está comentado ("funcionalidade em implementação"). | `dre/route.ts:50-60` ✅ |
| **F5A-025** | **ALTO** | Rep. F1C-206 | Transferência de caixa busca por id **sem comparar `cashRegister.establishmentId`** com o do JWT. | `cash-register/[id]/transfer/route.ts:22` |
| **F5A-026** | **MÉDIO** | Rep. F6B-024 | `orderNumber` = `MAX+1` sem trava → dois pedidos simultâneos disputam o mesmo número (PK derruba com 500). | `orders/route.ts:410-414` |
| **F5A-040** | **BAIXO** | Novo | "Receita líquida" do relatório do painel é `online + presencial` — **exclui `delivery` e `pickup`**. | `dashboard/(auth)/relatorios/page-content.tsx:72` |

**Consistência financeiro ↔ caixa ↔ pedidos:** ✅ os números **não** batem por construção — o financeiro conta pedidos não pagos (F5A-019), o caixa só vê o `sale` do fechamento de mesa (F5A-035) e a despesa entrou positiva (F5A-015). **Fechamento mensal, imutabilidade de períodos e exportação para contador: não encontrados** (ver "Não verificado"). **Conciliação de repasses de marketplace (taxas/comissões/estornos): inexistente** — só existe o split Pagar.me (F6B-015).

---

## 5.7 Dashboard

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5A-027** | **MÉDIO** | Novo | Definição de "venda" = **todo pedido não-cancelado** (inclui `payment_pending`, `abandoned`, agendados). | `dashboard/route.ts:64` ✅ |
| **F5A-028** | **MÉDIO** | Novo | "Pago/pendente" é heurística de forma de pagamento (`paymentMethod !== "online" \|\| status === "delivered"`) em vez de `paymentStatus`. | `dashboard/route.ts:138` ✅ |
| **F5A-041** | **MÉDIO** | Novo (auditor) | Métrica de **pedidos ativos** conta só `preparing/ready/out_for_delivery` — esconde `new`, `pending`, `confirmed`, `accepted`, `dispatched`. | `dashboard/route.ts:71-73` ✅ |
| **F5A-042** | **MÉDIO** | Novo (auditor) | `todayProfit = todayTotal − totalExpenses`: **não desconta CMV**, só despesas do dia. | `dashboard/route.ts:137` ✅ |
| **F5A-044** | **ALTO** | (5.6) | Fuso (UTC) nos agrupamentos diários afeta também os gráficos do painel. | ver 5.6 |
| **F5A-038** | **MÉDIO** | Rep. F2-006 | Relatórios carregam `findMany` **sem `take`/agregação** (DRE, receitas, CMV, `GET /api/orders`) e calculam tudo no cliente. | `dre/route.ts:34`; `orders/route.ts:748` ✅ |

**Origem dos números:** os cards vêm de 5 `findMany` sobre `Order` + `Expense` (`dashboard/route.ts:60-75` ✅) — sem cache, sem índice dedicado de período (ver Fase 2).

---

## 5.8 Configurações (inclui planos e assinatura)

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5C-001** | **CRÍTICO** | Novo | **`POST /api/subscription/create` sem auth:** qualquer visitante troca o plano de qualquer loja e, **sem `ASAAS_API_KEY`, o handler grava `subscriptionStatus: "active"` direto** (sandbox). | `subscription/create/route.ts:17-19,37-55` ✅ |
| **F5C-003** | **CRÍTICO** | Rep. F6A-045 | `POST /api/subscription/webhook` **sem assinatura e sem idempotência**: `externalReference` do corpo → qualquer POST marca qualquer loja `active` ou `expired`. | `subscription/webhook/route.ts:4-50` ✅ |
| **F5C-011** | **ALTO** | Rep. F6B-014 | **Inadimplência bloqueia só a tela:** o redirect do layout só dispara para `role === "admin"` e ignora `pending_payment`. | `dashboard/(auth)/layout.tsx:95-104` |
| **F5C-012** | **ALTO** | Novo | **Cobrança recorrente não existe:** pagamento único gravado em `asaasSubscriptionId`, **nenhum cron de cobrança no `vercel.json`** (só `verify-reminder` + `sync-ifood-status` ✅). | `subscription/create/route.ts:116-123`; `vercel.json` ✅ |
| **F5C-021** | **ALTO** | Novo | **Limites por plano nunca aplicados** — `subscriptionPlan`/limites não aparecem em nenhuma rota de escrita (usuários e recursos ilimitados). | `users/route.ts:38-63` |
| **F5C-022** | **ALTO** | Rep. F1A-002 | Qualquer staff autenticado altera `role`/`permissions` de outro usuário; a proteção do "último admin" existe só no cliente. | `users/[id]/route.ts:26-27,56-72` ✅ |
| **F5C-029** | **ALTO** | Rep. F1A-008 | Troca de plano é client-side puro: `subscribe()` chama `/api/subscription/create` **sem token** e sem checagem de papel. | `dashboard/(auth)/planos/page-content.tsx:87-99` |
| **F5C-010** | **ALTO** | Rep. F1A-008 | `POST /establishments/[id]/recipient` checa só login (nenhum papel) e cria subconta Pagar.me com `transfer_enabled: true, transfer_interval: "Daily"` — qualquer funcionário aponta a varredura diária para conta própria. | `establishments/[id]/recipient/route.ts:66-76,114-123` |
| **F5C-028/032** | **ALTO** | Rep. F6A-040 | `delivery-config`, `location` e `delivery-zones` gravam sem comparar `params.id` com o do JWT; `zones` aceita `minKm > maxKm` e `fee` negativo. | `establishments/[id]/delivery-config/route.ts:19-27,44-81`; `delivery-zones/route.ts:51-79` |

**Horários/impressoras/usuários:** horários existem e têm sync para o iFood **mas só no cliente** (F5C-041 → 5.9); impressoras **não têm configuração no servidor** (0 ocorrências — as telas usam `document.write`, Rep. F6A-015); permissões de usuário existem no schema mas **não são conferidas nas rotas** (F5B-022, F5C-022, F5D-008).

---

## 5.9 Integrações (iFood, 99 Food, Pedidos 10)

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5C-008** | **CRÍTICO** | Rep. F1C-121 | Webhook iFood valida HMAC **só se a env existir** (fail-open) e, quando o pedido não casa, **cai em `establishments[0]`** — injeta pedido de uma loja na outra. | `orders/ifood-webhook/route.ts:40-44,84-91` ✅ |
| **F5C-009** | **CRÍTICO** | Rep. F1C-121 | Webhook 99Food (pedido): valida só se houver segredo **e** assinatura (fail-open duplo) e cai em `establishments[0]`; o segredo sai do `nineFoodApiKey` de qualquer loja. | `orders/99food-webhook/route.ts:55-73,102-111` |
| **F5C-007** | **CRÍTICO** | Rep. F6B-011 | `webhooks/99` (corridas) **sem nenhuma assinatura**: altera status de qualquer pedido buscado só por id interno, sem escopo de tenant. | `webhooks/99/route.ts:6-12,41-73` |
| **F5C-019** | **ALTO** | Rep. F6B-011 | Webhook Efi sem qualquer validação: qualquer POST força `paid` + `confirmed`. | `webhooks/efi/route.ts:7-19,54-65` |
| **F5C-020** | **ALTO** | Rep. F1C-121 | Pagar.me valida assinatura **só se a key estiver configurada** (fail-open) e grava `financialTransaction` **sem chave de idempotência** → crédito duplicado. | `webhooks/pagarme/route.ts:16-18,148` |
| **F5C-013** | **ALTO** | Novo | **Nenhum evento iFood é confirmado** (`getIfoodEvents` só faz GET, 0 `acknowledgment`) e o cancelamento **apaga** o pedido → a fila reentrega e o poll recria, debitando estoque de novo. | `lib/integrations/ifood.ts:53-64` |
| **F5C-014** | **ALTO** | Novo | O poll **descarta silenciosamente** (`skipped++`) todo código fora de 3 listas fixas — sem log, sem ack, sem dead-letter. | `ifood-poll/route.ts:42-48` ✅ |
| **F5C-015** | **ALTO** | Novo | iFood usa **credenciais de OAuth da plataforma** + `ifoodMerchantId` digitado livremente no painel e nunca homologado → é possível ler pedidos de outra loja. | `ifood-poll/route.ts:12-13,23-34` |
| **F5C-017** | **ALTO** | Novo | **Abrir/fechar a loja só afeta `direto` e `ifood`** — o 99Food nunca recebe a mudança e segue aceitando pedido com a loja fechada. | `establishments/[id]/toggle-open/route.ts:69-72` ✅ (canais: `:70`) |
| **F5C-018** | **ALTO** | Novo | O cron `sync-ifood-status` trata `businessHours` nulo/inválido como **fechado** (auto-pausa indevida) e **não checa** o retorno de `delete/createInterruption`. | `cron/sync-ifood-status/route.ts:9,87,91-116` |
| **F5C-042** | **MÉDIO** | Novo | **Três `isOpenNow` com semântica oposta** (nulo = fechado num lugar, lista vazia = aberto noutro) → canais abrindo e fechando ao mesmo tempo. | `cron/sync-ifood-status/route.ts:9`; `whatsapp/bot-rules` (varredura) |
| **F5C-004/005** | CRÍTICO | Rep. F1A-005 | `orders/sync` e `orders/ifood-poll` anônimos (sem `verifyAuth` nem `CRON_SECRET`); o poll com `?detail` devolve `stack`. | `orders/sync/route.ts:5-7`; `ifood-poll/route.ts:7-14,225-228` |
| **F5C-035** | **MÉDIO** | Novo | `LogWebhook99` registra erro mas **nada relê `statusProcessamento: "erro"`** — evento com falha nunca reprocessa. | `webhooks/99/route.ts:20,77-83` |
| **F5C-037** | **MÉDIO** | Novo | Webhook Asaas responde **200 antes de processar** e processa em background sem fila/retry → falha = evento perdido para sempre. | `webhooks/asaas/route.ts:26-45` |
| **F5B-029** | **MÉDIO** | (5.2) | Sync de catálogo só iFood; **99Food sem catálogo** e **"Pedidos 10" inexistente** (grep `pedidos10` = 0). | ver 5.2 |
| **F5A-004** | **ALTO** | Rep. F6B-011 | *unificado em F5C-007* | — |

**O que a fase pede e não existe:** comparação item a item com a doc oficial **não foi possível executar** (nenhuma credencial/homologação no repositório; nenhuma chamada feita — regra 2.5). Rate limits por endpoint, política de reprocessamento e checklist de homologação do iFood ficam em **"não verificado"**.

---

## 5.10 Meta / WhatsApp

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5C-023** | **ALTO** | Rep. F7B-009 / F6A-040 | Todas as rotas `meta-*` não chamam `verifyAuth` → consulta e mutação de qualquer loja só com o id na URL. | `establishments/[id]/meta-quota/route.ts:5-21` (grep = 0) ✅ |
| **F5C-024** | **ALTO** | Rep. F7B-010 / F6A-045 | Webhook do WhatsApp **não verifica `X-Hub-Signature-256`** (grep: só `webhooks/pagarme` tem — ✅) e o token de verificação tem fallback literal `flowos-meta-verify`. | `webhooks/whatsapp/route.ts:17,80-92` ✅ |
| **F5C-025** | **ALTO** | Novo | `metaAccessToken` fica em **texto puro** no schema, **sem `expiresAt` e sem job de renovação** — só a nova captura manual evita token expirado (loja muda para "sem WhatsApp" sem aviso). | `schema.prisma:34` |
| **F5C-027** | **ALTO** | Novo | **`cron/reset-ai-usage` existe mas não está agendado** — atingido o limite mensal de IA, o bot fica mudo para sempre. | `cron/reset-ai-usage/route.ts:6-25`; `vercel.json` ✅ |
| **F5C-026** | **ALTO** | Rep. F7A-012 | Cota Meta com janelas erradas: `currentUsage` de 24h comparado ao limite **mensal** do tier; `estimatedCostMonth` nunca zera no mês. | `lib/meta-quota.ts:91-97,144-150` |
| **F5C-034** | **MÉDIO** | Novo | Ao não achar o telefone **na própria loja**, o webhook busca o cliente em **todas as lojas** e usa nome/PII de outro tenant na resposta. | `webhooks/whatsapp/route.ts:354-362` |
| **F5C-039** | **MÉDIO** | Novo | Embedded Signup troca o `code` com `redirect_uri` inconsistente e o discover tenta 4 URIs (inclusive a vazia) → troca de token falha/perde. | `establishments/[id]/meta-embedded-signup/route.ts:7-36` |
| **F5C-040** | **MÉDIO** | Novo | `meta-connect` registra o webhook no Meta com **`pin: "123456"` fixo** no código. | `establishments/[id]/meta-connect/route.ts:60` |
| **F5C-038** | **MÉDIO** | Rep. F1C-008 | `meta-discover` aceita um access token enviado pelo chamador no lugar do `code` e loga a resposta completa. | `establishments/[id]/meta-discover/route.ts:31-36,57` |
| **F5C-043** | **MÉDIO** | Rep. F1D-011 | Sem opt-out (`STOP`/`SAIR`) e sem checagem da **janela de 24h** antes de responder. | `webhooks/whatsapp/route.ts:80-92` |

**Tokens:** guarda o token no DB do tenant (⚠️ criptografia em repouso = fora do repo, ver Fase 1), mas **não há expiração/renovação automática** (F5C-025). **Templates:** resolvido na Fase 7 (`atualizacao_suporte_v1` UTILITY, `AUTHENTICATION` morto — ver pendência 7.3), daí não repetido aqui. **Qualidade do número, limites de envio e custo por conversa:** cota parcialmente calculada com janelas erradas (F5C-026); **custo real por conversa e risco de banimento: não verificados**.

---

## 5.11 KDS (tela da cozinha)

**Mecanismo (confirmado):** polling HTTP puro — `setInterval(fetchOrders, 5000)` (`kds/(auth)/screen/page.tsx:289` ✅), 1 `GET /api/orders` + 1 `GET /orders/{id}/messages` **por pedido** a cada ciclo. **Sem WebSocket, sem EventSource, sem Supabase Realtime** (grep `.channel(|postgres_changes|rls` = 0; Supabase só em Storage). RLS não existe — o isolamento depende só do `establishmentId` vindo do `localStorage` (F5D-001/F5A-003).

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|
| **F5D-001** | **CRÍTICO** | Rep. F1A-004 | `GET /api/orders` anônimo: trocando o `establishmentId` da query **um KDS lê os pedidos de outra loja** (PII, `trackingToken`, `paymentId`). | `orders/route.ts:690,748` ✅ (unificado com F5A-003) |
| **F5D-002** | **ALTO** | Rep. F1A-010 | **Sessão expirada não derruba nem avisa:** o layout checa a presença do token **uma única vez no mount** e `fetchOrders` só age dentro de `if (res.ok)` — após o JWT de 24h expirar, a tela fica congelada na última lista. | `kds/(auth)/screen/page.tsx:110-127` ✅; `layout.tsx:13` |
| **F5D-003** | **ALTO** | Novo | **Indicador de conexão decorativo:** o ponto verde "Modo Serviço: Ativo" é estático no JSX; o `catch` do polling só faz `console.error` — sem estado offline, sem backoff, sem aviso. | `screen/page.tsx:337-341` ✅ |
| **F5D-004** | **ALTO** | Novo | **Aba em segundo plano não gera alerta confiável:** só `setInterval` (throttled a ≥1/min quando oculta), **0** `visibilitychange`/`Notification` em `src/app/kds` ✅ — enquanto o dashboard já usa `useNewOrderAlerts`. | `screen/page.tsx:289` ✅ |
| **F5D-005** | **ALTO** | Novo | **Alerta sonoro mudo por padrão** (sem `kds_sound` salvo, estado inicial `false`) e o `AudioContext` só desbloqueia no primeiro clique/touch → tablet/kiosk que abre direto não emite o primeiro som do dia. | `screen/page.tsx:50-55,121` ✅ |
| **F5D-010** | **MÉDIO** | Novo | O bip exige `lastCountRef.current > 0` — **o primeiro pedido da sessão (e o primeiro após a fila zerar) não toca som.** | `screen/page.tsx:120-123` ✅ |
| **F5D-006** | **ALTO** | Novo | **Pedido cancelado depois de chegar some sem aviso** (sem card vermelho, sem som): o filtro aceita só 6 statuses e `cancelled` apaga o card em até 5 s — a cozinha já o estava produzindo. | `screen/page.tsx:117` ✅ |
| **F5D-007** | **ALTO** | Novo | **Pedido agendado entra na cozinha na hora** e o expurgo de `abandoned` (que ignora `isScheduled`) o faz **desaparecer** antes da data. | `orders/route.ts:706-713` ✅ |
| **F5D-008** | **ALTO** | Rep. F1A-012 | **Perfil "cozinha" não existe no servidor:** qualquer JWT do tenant passa e o PATCH não valida transição — o token `kds` cancela, entrega e volta `ready → preparing`. | `orders/[id]/route.ts:17,181` ✅ |
| **F5D-009** | **ALTO** | Novo | **N+1 a cada 5 s:** 1 `GET /api/orders` + 1 `GET /orders/{id}/messages` **sequencial por pedido** (20 pedidos = 21 chamadas/ciclo; 4 telas ≈ 84/5 s) e o `GET` ainda roda `updateMany` (F5D-025). | `screen/page.tsx:165-180` ✅ |
| **F5D-025** | **BAIXO** | Rep. F1C-106 | **Endpoint de leitura com efeito colateral:** cada poll dispara o `updateMany` de `abandoned`. | `orders/route.ts:706-713` ✅ |
| **F5D-011** | **MÉDIO** | Novo | **Conclusão item a item é estado só local** (`useState` por índice) — F5 ou outro dispositivo zera; se a lista mudar, os checks apontam para o item errado. | `screen/page.tsx:148-158` ✅ |
| **F5D-012** | **MÉDIO** | Novo | `updateStatus` **não trata `res.ok`**: clique com token expirado falha em silêncio e a tela volta ao status antigo. | `screen/page.tsx:139-147` ✅ |
| **F5D-013** | **MÉDIO** | Novo | Coluna "Prontos" **não tem ação de saída** (`getNextAction` só trata `preparing`) — o card só sai quando outro módulo muda o status, inflando a fila e a "Média". | `screen/page.tsx:278-284` ✅ |
| **F5D-014** | **MÉDIO** | Novo | **Sem divisão por estação** (grill/bar/sobremesa): grep `station\|estação\|grill` = 0 em `src/app/kds` ✅ e 0 no schema ✅ — só as 3 colunas de status. | `screen/page.tsx:41` |
| **F5D-015** | **MÉDIO** | Novo | **Sem Wake Lock, sem tela cheia, sem kiosk:** grep `wakeLock\|requestFullscreen\|visibilitychange` = 0 ✅ — tablet apaga em turno de 10 h. | `screen/page.tsx:322` |
| **F5D-016** | **MÉDIO** | Novo | Cronômetro conta desde `createdAt` (não do início do preparo), régua de atraso fixa em 15 min e "Média" = idade da fila — **não existe `preparingAt`/`readyAt`** em nenhum lugar. | `screen/page.tsx:260-266` ✅; grep no schema |
| **F5D-017** | **MÉDIO** | Rep. F1A-010 | Auth do dispositivo = e-mail+senha; **sem PIN/QR/revogação**, JWT de 24 h em `localStorage`, e o layout **copia o token de admin para `kds_token`**. | `kds/(auth)/layout.tsx:31-44` ✅ |
| **F5D-018** | **MÉDIO** | Rep. F1A-005 | `GET /api/kds/establishment` sem auth (nome/logo de qualquer tenant) e a tela confia no `establishmentId` do `localStorage` como fonte do tenant. | `api/kds/establishment/route.ts:4-16` ✅ |
| **F5D-019** | **MÉDIO** | Rep. F1D-012 | **Minimização quebrada:** a comanda impressa exige telefone, endereço, forma de pagamento, taxa e total — e a `interface Order` já traz tudo isso para o perfil `kds`. | `screen/page.tsx:516-530` |
| **F5D-021** | **MÉDIO** | Novo | **Push é indexado por `customerKey` (telefone do cliente final)** — não há canal de push para o dispositivo da cozinha; nada sobrevive a aba fechada. | `push/subscribe/route.ts:6-8` ✅ |
| **F5D-022** | **MÉDIO** | Novo | Ruptura de estoque (`lowStockItems`) e motoboy atribuído no `ready` **não são renderizados** no card — a cozinha não vê item esgotado. | `screen/page.tsx:429` |
| **F5D-023** | **BAIXO** | Novo | **Spinner infinito possível:** o `return` por token ausente está **antes** do `try`, então o `finally { setLoading(false) }` nunca executa. | `screen/page.tsx:106-113` ✅ |
| **F5D-024** | **BAIXO** | Novo | `completedItems` e `lastMsgCountRef` crescem por pedido e **nunca são podados** ao sair do filtro (turno de 10 h+). | `screen/page.tsx:74-80` |

**Positivos do KDS:** o filtro de status garante que a cozinha só vê o que é dela *visualmente*; a impressão da comanda existe como contingência; os estados da coluna são coerentes com o `flowOrder` do painel; e a lista é ordenada por `createdAt` (fila correta).

---

## O que está bom

1. **Cancelamento do painel é o único caminho "certo"**: transação com `restoreOrderStock` + `CancellationLog` completo (snapshot de auditoria) — `orders/[id]/route.ts:140-165` ✅. É o modelo que deveria valer para todos os escritores.
2. **`deductOrderStock` roda dentro da transação do pedido** e falha derruba a criação inteira — `orders/route.ts:449-454` ✅.
3. **Saída manual de estoque bloqueia saldo negativo** (`newQty < 0` → 400) — `stock/route.ts:113-117` ✅ — prova que a regra é conhecida (falta aplicá-la na baixa de pedido).
4. **Identidade e tenant conferidos** em `close-table`, `cash-register/[id]`, `toggle-open`, `users/[id]` (DELETE), `purchases`, `partial-payment` (POST) e `deliveries` (entregador só enxerga os próprios pedidos) ✅.
5. **Pagamento misto funciona** (`partialPayment` descontado no fechamento) e o **resumo de caixa separa por tipo/forma de pagamento** — `summary/route.ts:37-50` ✅.

## Não verificado / fora do alcance deste repositório

- **Comparação com a doc oficial do iFood/99/Pedidos 10** (sem credenciais, sem homologação, nenhuma chamada executada) e **rate limit por endpoint** dessas APIs.
- **Fechamento mensal, imutabilidade de períodos fechados e exportação contábil** — não há código correspondente (nenhum modelo `financialClose` no schema); confirmar com o responsável se existe fora do repo.
- **Conciliação de repasses de marketplace** (taxas, comissões, cancelamentos, estornos) — inexistente no código; confirmar se é feita manualmente.
- **Custo por conversa Meta, qualidade do número e limite de envio real** (painel da Meta/Mercado Pago — fora do repo).
- **Execução dos testes dinâmicos**: `testes/5-01` (transições inválidas e corrida de estoque) fica com `obtido = NÃO EXECUTADO` — exige ambiente de teste com 2 lojas e banco não-produtivo. O estático `testes/5-02` **foi executado** (33/33 CONFIRMADO).
- **Comportamento real de rede do KDS** (queda de Wi-Fi, 10 h de tela ligada) — só roteiro estático.
- **Senhas/regras de permissão dos papéis** no painel: a matriz `role × ação` existe no front (escondendo botões) mas **não foi possível exercitá-la** sem ambiente multi-usuário.

## Prioridades desta fase (Top 5)

1. **Criar a máquina de estados no servidor** (F5A-002/F5D-008): whitelist de transições por `role` em `PATCH /api/orders/[id]`, recusando downgrade e papel `kds` para `cancelled/delivered`. Cai junto com F5D-020 (idempotência) e F5A-016 (auto-confirm do entregador).
2. **Unificar estorno de estoque** num único helper chamado por **todos** os caminhos que mudam para `cancelled/abandoned` (F5A-009/010/011/022/013) — hoje são 4 escritores com regras diferentes e 1 que devolve em dobro.
3. **Fechar as rotas de negócio abertas** (`stock`, `cash-register`, `categories`, `expenses`, `financial/*`, `subscription/*`, `delivery-persons`) — o `middleware` morto é a causa raiz (Rep. F6B-010) e várias já foram achadas nas Fases 1/6: executar a pendência 6.2/6.4 de uma vez.
4. **Recalcular no servidor**: subtotal/preços, cupom (`usageLimit`/condição), taxa por zona, limites de adicionais e canal (F5B-013/024/025/031/032).
5. **KDS confiável**: tratar `res.ok` + indicador de conexão real + som ligado por padrão + `visibilitychange` (F5D-002/003/005/010) — é a tela que o restaurante olha 10 h por dia.

## Duplicados removidos nesta fase

| Descartado | Unificado em |
|---|---|
| F5B-001 / F5A-001 | já registrado como **F6B-010** (middleware fora do build — nenhuma fase nova precisa repeti-lo) |
| F5C-006 | F5B-010 (poll-99 anônimo) |
| F5A-004 | F5C-007 (webhook 99 sem assinatura) |
| F5A-021 | F5C-009 (99food-webhook fail-open) |
| F5A-007 | F5B-004 (stock sem auth) |
| F5A-024 | F5B-008 (cash-register sem auth) |
| F5B-023 (GET/POST partial-payment "sem auth") | **corrigido**: GET sem auth (F6A-021), POST **tem** `verifyAuth` (`partial-payment/route.ts:27` ✅) |
| F5B-026 | F5A-016 (entregador sem auto-confirm) |
| F5A-038 | F5A-003 (GET /api/orders sem `take`) |
| F5D-025 | F5A-022 (expurgo dentro do GET) — mantidos os dois aspectos, 1 ID ativo em cada seção |
| F5A-015 (1º bloco) | F5A-015 (2º bloco) — mesma evidência |

## Pendências da Fase 5 para o responsável

1. **Escrever a máquina de estados no servidor** (F5A-002): tabela de transições válidas + checagem de `role` + idempotência; hoje qualquer JWT da loja faz qualquer coisa e o `kds` cancela pedido.
2. **Corrigir os 5 pontos de vazamento/duplicação de estoque**: falha de pagamento (F5A-009), `OVERDUE` (F5A-010), cancel iFood em dobro (F5A-011), `abandoned` (F5A-022) e placeholder iFood (F5A-013).
3. **Fechar as rotas de negócio sem `verifyAuth`** — lista: `stock`, `cash-register`, `categories`, `daily-combos`, `delivery-persons`, `delivery-payments`, `expenses`, `payment-request`, `subscription/create|webhook`, `orders/sync`, `ifood-poll`, `kds/establishment` e `financial/*` (F5A-006/007/008/024, F5B-002/004/005/006/007, F5C-001/003/004/005). Causa raiz e solução nas pendências 6.2 e 6.4.
4. **DRE/financeiro**: incluir CMV (F5A-018), filtrar por `paymentStatus` (F5A-019), corrigir `money`→`cash` e o agrupamento UTC (F5A-029, F2-004), descomentar cupons (F5A-039) e corrigir o sinal da despesa no caixa (F5A-015).
5. **Assinatura/cobrança**: decidir o modelo — hoje não há recorrência (F5C-012), o webhook é forjável (F5C-003) e o sandbox ativa plano sem pagamento (F5C-001).
6. **KDS**: itens 1–5 do Top 5 acima; além disso, `GET /api/orders` precisa de auth (F5D-001) — bloqueia qualquer coisa dependente do token do cozinha.
7. **Executar `auditoria/testes/5-01-transicoes-e-estoque.sh`** em ambiente de teste (não-produção) — hoje `obtido = NÃO EXECUTADO`; é destrutivo (cria pedidos e disputa estoque). O estático `5-02` já rodou: 33/33 confirmados.
8. **Confirmar com o responsável** os itens de "Não verificado": fechamento mensal/imutabilidade, conciliação de marketplaces e comparação com a doc do iFood/99.
