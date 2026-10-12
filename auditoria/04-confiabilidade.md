# FASE 4 — CONFIABILIDADE E OPERAÇÃO

**Data:** 09/10/2026 · **Saída:** `auditoria/04-confiabilidade.md` · **Termo:** `AUDITORIA-SAAS-FOOD.txt:251-266`
**Regra central da fase:** a pergunta é *"quando algo falhar, o sistema avisa, se recupera ou perde dinheiro em silêncio?"* — leitura 100% estática, nenhum comando contra remoto/banco, nenhum segredo impresso (só nomes de variáveis).

## Escopo e método

- Varredura em 4 blocos (4A erros/logs/monitoramento · 4B idempotência/webhooks · 4C offline/impressão/CI · 4D runbook/backup/doc) por sub-agentes de leitura, com **conferência pessoal de 23 âncoras** pelo auditor (marcadas ✅ — relidas com `sed -n`/`grep` na fonte).
- Deduplicação contra **Fases 0/1/2/6/7** (coluna *Origem*: `Novo`/`Rep.`) e **dentro da fase** (unificados listados ao final).
- Nenhum arquivo do produto foi modificado.
- **Validação estática executada:** `bash auditoria/testes/4-01-confiabilidade-estatico.sh` → **57/57 CONFIRMADO, 0 a rever** (estático, seguro; rodar da raiz do projeto).

## Resumo

| Seção | Achados | C | A | M | B | Novos/Rep. | Nota |
|---|---|---|---|---|---|---|---|
| 4.1 Erros que somem | 12 | 4 | 6 | 2 | 0 | 7/5 | **1,5** |
| 4.2 Retries, timeouts, circuit breaker | 4 | 1 | 2 | 1 | 0 | 2/2 | **1,5** |
| 4.3 Idempotência de webhooks/pedidos | 14 | 2 | 11 | 1 | 0 | 9/5 | **1,5** |
| 4.4 Fila de webhooks / dead-letter | 11 | 1 | 7 | 3 | 0 | 6/5 | **1,0** |
| 4.5 Comportamento com dependência fora | 11 | 0 | 6 | 5 | 0 | 7/4 | **2,0** |
| 4.6 Modo degradado/offline PDV e KDS | 11 | 1 | 6 | 4 | 0 | 4/7 | **1,5** |
| 4.7 Impressão de comanda/cupom | 4 | 0 | 3 | 1 | 0 | 4/0 | **1,5** |
| 4.8 Logs, correlação e dados sensíveis | 7 | 2 | 4 | 0 | 1 | 3/4 | **1,5** |
| 4.9 Monitoramento e alertas | 2 | 1 | 0 | 0 | 1 | 1/1 | **1,0** |
| 4.10 Health checks e heartbeat | 2 | 0 | 2 | 0 | 0 | 0/2 | **1,0** |
| 4.11 Ambientes, CI/CD, rollback, flags | 12 | 1 | 5 | 3 | 3 | 10/2 | **1,5** |
| 4.12 Testes automatizados | 2 | 0 | 1 | 1 | 0 | 1/1 | **2,0** |
| 4.13 Backup/DR e runbook | 11 | 2 | 5 | 3 | 1 | 4/7 | **1,5** |
| **Total (únicos)** | **103** | **15** | **58** | **24** | **6** | **58/45** | **1,5** |

- **Diagnóstico em uma frase:** o sistema **falha calado** — 144 `catch {}` vazios, webhooks que respondem 200 antes de processar (e perdem o pagamento), zero fila/dead-letter/replay, zero APM/health/heartbeat, zero pipeline de CI, 6 testes cobrindo 1 das ~10 integrações, e nenhum runbook: o incidente só chega ao conhecimento do time quando o cliente reclama.
- **Três modos de perder dinheiro sem sinal:** (1) webhook de pagamento fire-and-forget + crons de compensação mortos; (2) falha ao gerar cobrança **apaga o pedido sem devolver estoque** nem desfazer o cliente; (3) retry humano do PDV sem idempotência key duplica pedido e cobrança.

---

## 4.1 Tratamento de erros — os erros que "somem"

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4A-024** | **CRÍTICO** | Rep. F1A-031 | **144 `catch {}` realmente vazios** (20 em rotas de API) + 48 contendo só `console.*` — falhas que desaparecem sem rastro. Piores: transferência de mesa com sucesso falso, sync de pagamentos (`catch { errors++ }` sem motivo), restauração de estoque, toda a UI de caixa/cardápio. | `cron/sync-payments/route.ts:100-102`; `payments/sync/route.ts:221-223`; `orders/route.ts:289,293,319,345,368,404`; `caixa-page.tsx:176,357,446,607,1780,2672`; `fetch-auth.ts:34`; `kds/(auth)/layout.tsx:26,44` (contagem validada por varredura) |
| **F4A-001** | **CRÍTICO** | Novo | Webhook iFood **responde `200 ok:true` mesmo quando todos os eventos falham** (`create_error`/`fetch_error`/`auth_error` só entram no array `results`) → iFood considera entregue e **não reenvia**: pedido/placar perdido, sem retry, sem dead-letter, sem alerta. | `orders/ifood-webhook/route.ts:139,148,204,290` ✅ |
| **F4A-002** | **CRÍTICO** | Rep. F1A-028 | Webhooks de pagamento (Asaas, Pagar.me, Efi) fazem **fire-and-forget**: `processWebhook(...).catch(log)` + `return 200` imediato — se o banco falhar, o evento de pagamento **confirmado é perdido para sempre** (sem outbox/retry). Pedido fica `pending`; o cliente paga e o pedido nunca entra em produção. | `webhooks/asaas/route.ts:42-46` ✅; `webhooks/pagarme/route.ts:41-45`; `webhooks/efi/route.ts:14-18` |
| **F4A-005** | **CRÍTICO** | Rep. F5A-009 | Falha ao gerar pagamento **apaga o pedido sem devolver estoque**: o `deductOrderStock` já commitou (transação do POST); nos 3 catches de falha de pagamento é feito `order.delete` — e `restoreOrderStock` **nem é importado** nesse arquivo → **estoque fantasma permanentemente decrementado**, quebrando ficha técnica/CMV. | `orders/route.ts:7,451,539,576,670` ✅ (import só com `deductOrderStock`; 0 ocorrências de restore) |
| **F4A-007** | **ALTO** | Novo | Transferência de mesa no caixa mostra **toast de sucesso mesmo se a API falhar**: o `fetchAuth` está em `catch {}`, o estado local da mesa já foi limpo antes e o toast é incondicional → pedidos "somem" da tela e divergem do banco. | `caixa/caixa-page.tsx:2661-2674` |
| **F4A-006** | MÉDIO | Novo | Falha na criação de pedido pelo bot WhatsApp é **invisível** (sem `console.error`, sem métrica, sem alerta) — só `{ error }` para a IA; o cliente perde o pedido. | `webhooks/whatsapp/route.ts:445-456` |
| **F4A-008** | ALTO | Novo | Webhook 99Food descarta cancelamento/status de **pedido inexistente** sem rastro: `if (existing) {...}` **sem `else`**, resposta `ok:true` — evento (ex.: cancel que chegou antes do create) é ignorado para sempre. | `orders/99food-webhook/route.ts:178-209,212-240` |
| **F4A-009** | ALTO | Novo | Webhook 99 (corridas): falha ao atualizar o pedido vira só `statusProcessamento: "erro"` numa tabela que **ninguém relê**; o pedido fica preso em `out_for_delivery` para sempre e o `poll-99` que cobriria também só faz `console.error`. | `webhooks/99/route.ts:79-85`; `delivery/poll-99/route.ts:78-79` |
| **F4A-026** | **ALTO** | Rep. F5A-011 | `restoreOrderStock` engole **qualquer** erro dentro de um `try` com só `console.error` — a transação do chamador segue e o estoque fica permanentemente inconsistente, sem métrica nem alerta. | `lib/stock.ts:322-331` ✅ |
| **F4A-023** | MÉDIO | Novo | Push: `logPush` engole erro com `catch {}` e `sendPush` não tem retry nem fila; o chamador também descarta o log com `.catch(() => {})` → impossível auditar por que o cliente não foi notificado. | `lib/push.ts:119-131,146-167`; `orders/[id]/route.ts:512-523` |
| **F4A-025** | **ALTO** | Novo | **`JSON.parse(order.items)` sem guarda** no render do KDS e do painel: um `items` corrompido derruba a tela inteira da cozinha — e **não existe `error.tsx`/`global-error.tsx`/ErrorBoundary em lugar nenhum do App Router** (contagem = 0 ✅). Mesmo parse sem try em APIs públicas de tracking e na geração de PIX Efi. | `kds/.../screen/page.tsx:430`; `pedidos/page-content.tsx:556`; `tracking/[id]/route.ts:31`; `payments/efi/route.ts:48` ✅ |
| **F4A-027** | ALTO | Rep. F5D-005 | Poll do painel de pedidos **sem `try/catch` e sem estado de erro**: rede cai ou a API devolve não-JSON → spinner nunca sai, dados ficam obsoletos e as rejeições ficam não tratadas no `setInterval`. | `pedidos/page-content.tsx:112-114,128` |

---

## 4.2 Retries com backoff, timeouts e circuit breaker

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4A-010** | **CRÍTICO** | Rep. F3A-044 | **1 único `AbortSignal.timeout` em todo o repo** (catálogo iFood); iFood, 99, Meta, Evolution, Asaas, Pagar.me, Inter, Efi e os syncs usam `https.request`/`fetch` **sem timeout** → requisição pendurada segura o serverless até o kill da Vercel, sem erro tratável. | `integrations/ifood.ts:21,56,69`; `nine-nine.ts:36,94,162,217`; `whatsapp/meta.ts:50,102`; `evolution.ts:138`; `asaas.ts:62,82,112`; `pagarme.ts:174,347`; `payments/sync/route.ts:76,183`; único timeout: `ifood-catalog/import/route.ts:39` ✅ (grep global = 1 ✅) |
| **F4B-036** | — | — | *unificado em F4A-010* | — |
| **F4C-005** | — | — | *unificado em F4A-010* (ângulo: `fetchAuth` do PDV sem timeout → spinner infinito) | — |
| **F4A-011** | **ALTO** | Novo | **Não existe retry genérico nem circuit breaker** (grep `circuit\·breaker` = 0 ✅): o único retry é específico e **só para HTTP 429** (catálogo iFood); `fetch-auth` só retenta em 401 com refresh. Falha transitória de rede/5xx = falha permanente para o usuário. | `integrations/ifood-catalog-write.ts:11-47`; `fetch-auth.ts:85-93` |
| **F4A-012** | ALTO | Rep. F5C-027 | Polling iFood **não faz acknowledge** de eventos (`DELETE /events` nunca chamado; grep `acknowledg` = 0) e erros viram só `errors++` — os mesmos eventos são rebaixados em loop e falhas definitivas ficam sem rastro. | `ifood-poll/route.ts:34-35,218-225`; `integrations/ifood.ts:53` |
| **F4B-028** | — | — | *unificado em F4A-012* | — |
| **F4B-010** | MÉDIO | Novo | Webhook Pagar.me: `timingSafeEqual` com buffers de tamanhos diferentes lança `RangeError` e a rota **não tem try/catch em volta** → 500 e o provedor reenvia em loop. | `integrations/pagarme.ts:414`; `webhooks/pagarme/route.ts:18` |

---

## 4.3 Idempotência de pedidos vindos de integrações

### Inventário dos 10 webhooks do projeto

| Webhook | Assinatura | Idempotência | Estado |
|---|---|---|---|
| iFood (pedidos) | **fail-open** | dedup `externalId` check-then-create fora de transação | **parcial** (F4B-001/002) |
| 99Food (pedidos) | **fail-open duplo** | dedup `externalId`; `eventId` documentado e **nunca lido** | **parcial** (F4B-003/004) |
| 99 (entrega) | **nenhuma** ✅ | nenhum | **ausente** (F4B-005) |
| Asaas (pagamentos) | **fail-closed** (único do repo) | idempotente por igualdade de status | **idempotente**, mas sem fila/log (F4A-002) |
| Pagar.me | fail-open | status idempotente; `FinancialTransaction` **sem chave** | **parcial** — duplica financeiro (F4B-009) |
| Efi (PIX) | **nenhuma** | igualdade de status, mas **regride** `delivered→confirmed` | **ausente** (F4B-011) |
| Inter (PIX) | **nenhuma** | checa `paymentStatus==="paid"`; valor vem do corpo | **ausente** (F4B-012) |
| Asaas (assinatura SaaS) | **nenhuma** | replay estende vencimento | **ausente** (F4B-013) |
| Meta/WhatsApp | **nenhuma** (`X-Hub-Signature-256` verificado **só** no Pagar.me ✅) | `msg.id` capturado e ignorado | **ausente** (F4B-014/015) |
| Evolution WhatsApp | opcional (omitir header contorna) | não | **ausente** (F4B-018) |

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4B-016** | **CRÍTICO** | Rep. F1A-030 | Webhook WhatsApp processa **síncrono** OpenAI + `create_order` + `sendText` dentro do request: se exceder o timeout do Meta, o Meta **reenvia** e a tool roda de novo → **pedido + cobrança duplicados, tokens OpenAI pagos 2×**. | `webhooks/whatsapp/route.ts:442,453,522` |
| **F4B-017** | MÉDIO | Novo | O mesmo webhook **retorna 500 quando o envio falha**, mesmo com toda a lógica (incluindo criação de pedido) já executada — garante reprocessamento completo no retry do Meta. | `webhooks/whatsapp/route.ts:529` |
| **F4B-019** | **CRÍTICO** | Rep. F3C-021 | `POST /api/orders` **não aceita nem valida chave de idempotência** (grep `idempoten\·clientRequestId` = 0 ✅): duplo clique, timeout ou retry humano do operador cria **2 pedidos e 2 cobranças**. | `orders/route.ts:75`; `caixa-page.tsx:832-846` |
| **F4C-008** | — | — | *unificado em F4B-019* | — |
| **F4B-020** | **ALTO** | Novo | Em falha do provedor, o pedido é **deletado mas o cliente já foi criado/incrementado** (`totalOrders`, `totalSpent`, `loyaltyPoints`) — cada retry infla fidelidade e "gasto total" sem pedido correspondente. | `orders/route.ts:321,328,539,576,670` |
| **F4B-002** | ALTO | Novo | Dedup iFood é **check-then-create fora de transação**: a corrida vira `P2002` e o fallback **grava o pedido no primeiro tenant da lista**. | `orders/ifood-webhook/route.ts:91,119,126` |
| **F4B-009** | **ALTO** | Novo | Webhook Pagar.me grava `FinancialTransaction` **sem chave de idempotência e sem `@@unique`** — reenvio de `order.paid` duplica taxa/valor líquido no relatório financeiro. | `webhooks/pagarme/route.ts:148`; `schema.prisma:1059` |
| **F4B-011** | **ALTO** | Novo | Webhook Efi: **nenhuma autenticação e nenhuma verificação de txid** — qualquer POST força `paymentStatus=paid` e o update **regride** `delivered→confirmed`. | `webhooks/efi/route.ts:7,54,59` |
| **F4B-012** | **ALTO** | Novo | Webhook Inter: **nenhuma autenticação**; o "valor pago" vem do corpo do payload, sem verificação contra a cobrança criada. | `payments/inter/webhook/route.ts:4,32` |
| **F4B-013** | **ALTO** | Rep. F5C-003 | Webhook de assinatura SaaS **sem token/HMAC** e replay de `PAYMENT_RECEIVED` recalcula `nextPaymentAt = agora+1m` — reenvio estende a assinatura indefinidamente. | `subscription/webhook/route.ts:4,29` |
| **F4B-030** | **ALTO** | Novo | `dispatch-99` **não verifica se já existe corrida** antes de despachar (o guarda existe só no PATCH do operador) — retry/duplo clique **paga 2 corridas** na 99. | `delivery/dispatch-99/route.ts:49,64`; guarda: `orders/[id]/route.ts:308` |
| **F4B-031** | ALTO | Rep. F5A-031 | **Nenhuma trava por pedido** entre escritores concorrentes: sem `SELECT FOR UPDATE`, sem coluna de versão — webhook, poll e PATCH disputam com *last-write-wins*. | `schema.prisma:441,509`; grep `FOR UPDATE\·optimistic\·lockVersion` = 0 |
| **F4B-032** | **ALTO** | Novo | PATCH do operador grava o status **local antes de empurrar ao iFood**; se o iFood falhar, a falha só é logada — **divergência permanente** entre cozinha e marketplace, sem flag de dessincronização. | `orders/[id]/route.ts:181,193,244` |
| **F4B-041** | **ALTO** | Rep. F5A-048 | `/api/bot/create-order` **sem autenticação e sem idempotência**, e a tool `create_order` pode rodar até 3 iterações no mesmo webhook — combinado com retry do Meta, multiplica pedidos. | `bot/create-order/route.ts:31`; `ai/openai.ts:122`; `webhooks/whatsapp/route.ts:445` |
| **F4B-037** | **ALTO** | Novo | Pagamento recebido **sem pedido correspondente** é descartado em silêncio: `/api/pix-generate` cria cobrança Asaas sem `orderId` e o webhook só loga "Order not found" — **dinheiro entra sem pedido e sem registro financeiro**. | `pix-generate/route.ts:24`; `webhooks/asaas/route.ts:60` |

---

## 4.4 Fila de webhooks, dead-letter e reprocessamento manual

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4B-021** | **CRÍTICO** | Rep. F5C-012 | **Não existe nenhum model de Inbox/DeadLetter/WebhookEvent no schema**; o único log é `LogWebhook99` e **nada o relê** (só `create`/`updateMany` na própria rota ✅) — dead letter inútil. | `schema.prisma:966-973`; `webhooks/99/route.ts:15,75,81` ✅; grep `replay\·reprocess\·dead.?letter` em `src/` = 0 |
| **F4B-022** | **ALTO** | Novo | **Nenhum endpoint de replay/reprocessamento manual** de webhooks — quando o evento se perde (F4A-001/002), a única recuperação é abrir o dashboard e torcer pelo sync manual. | grep `replay\·reprocess` = 0 ✅ |
| **F4B-006** | MÉDIO | Novo | `LogWebhook99` marca "pendente/processado/erro", mas nenhum cron, endpoint ou UI **relê** para reprocessar. | `webhooks/99/route.ts:15,75,81` |
| **F4D-015** | MÉDIO | Novo | Webhooks iFood **não têm log persistente** (só `console.log` — logs efêmeros da Vercel); não há equivalente de `LogWebhook99` para iFood/99Food/Asaas/Pagar.me. | `orders/ifood-webhook/route.ts:33,70` ✅ |
| **F4B-023** | (4.4) | — | *crons mortos — ver F4D-007* | — |
| **F4D-007** | **ALTO** | Rep. F3D-002 | **3 dos 6 crons existentes nunca rodam**: `sync-payments`, `meta-quota`, `reset-ai-usage` não estão no `vercel.json` (que agenda só 2 ✅) — e a rede de segurança de pagamentos justamente nunca executa. `cron/expire-orders/` é pasta **vazia**. O próprio código mente: `meta-quota` diz "called by Vercel Cron every hour" e roda 0×. | `vercel.json:2-12` ✅; `cron/{sync-payments,meta-quota,reset-ai-usage}/route.ts`; dir `cron/expire-orders/` vazio; `meta-quota/route.ts:5` |
| **F4A-003** | (4.4) | — | *unificado em F4D-007* | — |
| **F4C-025** | (4.4) | — | *unificado em F4D-007* | — |
| **F4A-004** | **ALTO** | Novo | Mesmo que o cron rodesse: o reconciliador de pagamentos **só olha pedidos criados nos últimos 15 minutos** — webhook perdido com pedido >15 min **nunca é resgatado**; pagamentos Asaas órfãos permanecem `pending` eternamente. | `cron/sync-payments/route.ts:40-48` ✅ |
| **F4B-025** | (4.5) | — | *unificado em F4A-004* (o sync manual cobre 7 dias, mas exige dashboard aberto) | — |
| **F4B-024** | **ALTO** | Novo | O sync de compensação cobre **apenas Asaas**: estabelecimentos em Pagar.me/Efi/Inter ficam **sem nenhuma rede de segurança server-side**. | `payments/sync/route.ts:69,76`; `cron/sync-payments/route.ts:75` |
| **F4B-026** | **ALTO** | Novo | A compensação pública `/payment-status` **não cobre Efi**: o `paymentId` da Efi é um txid puro sem prefixo, cai no branch Asaas e consulta a **API errada em silêncio**. | `orders/[id]/payment-status/route.ts:48,73,96`; `payments/efi/route.ts:69` |
| **F4D-014** | **ALTO** | Rep. F5A-022 | Trilha de auditoria incompleta: só 4 arquivos gravam `CancellationLog` (painel, iFood×2, 99Food) — os caminhos **financeiros que cancelam sozinhos** (`OVERDUE` do Asaas via cron/sync/webhook) **não logam nada**. Incidente "por que virou cancelled?" fica sem resposta. | `orders/[id]/route.ts:150`; `ifood-webhook:224`; `ifood-poll:121`; `99food-webhook:186`; sem log: `cron/sync-payments:27`, `payments/sync:33`, `webhooks/asaas:83`; modelo base bom: `schema.prisma:827-849` |
| **F4B-035** | **ALTO** | Rep. F5A-022 | A expiração para `abandoned` **não restaura estoque nem cancela a cobrança online** (Asaas/Inter/Efi/Pagar.me segue viva) — cobrança pode ser **paga por um pedido já abandonado**. | `orders/route.ts:706,712`; `restoreOrderStock` ausente nesse caminho ✅ |
| **F4D-016** | MÉDIO | Rep. F5C-023 | Mensagens de WhatsApp **não são persistidas**: a IA é chamada com histórico **vazio** a cada mensagem e nada grava entrada/saída — reclamação de cliente não é auditável ("o que o bot disse?"). | `webhooks/whatsapp/route.ts:442,474`; grep `messageLog\·conversation` = só `aIUsageLog` |

---

## 4.5 Comportamento quando a dependência está fora do ar

Mapeamento verificado no código (**o que acontece hoje**):

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4D-021** | **ALTO** | Novo | **iFood fora:** `getIfoodAuth` devolve `null` em qualquer erro e `getIfoodEvents` devolve `[]` — falha vira vazio; o cron devolve 502 que ninguém lê; **nenhum estado degradado visível** para o lojista. | `integrations/ifood.ts:27-31,41-44,47,59-61`; `cron/sync-ifood-status/route.ts:78-80` |
| **F4B-042** | MÉDIO | Novo | 99Food `ORDER_STATUS_CHANGED` com `CANCELLED` só seta `status` via mapa, **sem `CancellationLog` e sem restaurar estoque** — difere do branch `ORDER_CANCELLED` do mesmo arquivo (que loga). | `orders/99food-webhook/route.ts:177,224,233` |
| **F4B-007** | **ALTO** | Rep. F5A-011 | Webhook 99 cancela **sem `CancellationLog`, sem restaurar estoque e sem estornar fidelidade** — inconsistente com o caminho de cancel do painel. | `webhooks/99/route.ts:64,71` |
| **F4B-029** | **ALTO** | Rep. F5C-016 | `poll-99` (sem autenticação) com `statusMap` que **regride** o pedido (`driver_arriving → "ready"` sobrescreve `out_for_delivery`). | `delivery/poll-99/route.ts:11,45,54` |
| **F4B-034** | MÉDIO | Rep. F5A-034 | Pedidos presos em `payment_pending`/`pending` **não geram alerta** (`/api/alerts` só cobre despesa/estoque/chat) — a expiração só roda quando o dashboard abre. | `alerts/route.ts:13,60`; `orders/route.ts:706` |
| **F4B-038** | MÉDIO | Novo | Asaas/Efi/Inter **nunca escrevem `FinancialTransaction`** (só o Pagar.me) — conciliação de taxas desses provedores é impossível a partir do banco. | `webhooks/asaas:93`; `webhooks/efi:61` |
| **F4B-039** | MÉDIO | Rep. F6B-038 | Import de catálogo iFood: falha do Supabase Storage cria o produto **sem imagem** (só incrementa contador) e **sem dedup por `ifoodItemId`** — reimportar duplica produtos e grupos. | `ifood-catalog/import/route.ts:114,125,137` |
| **F4A-021** | **ALTO** | Novo | `/api/alerts` **não cobre saúde de integrações**: a falha de cota Meta (erro 131048) vira só um card no painel — **sem push/e-mail/admin** quando o WhatsApp de um tenant para ou a cota estoura. | `alerts/route.ts:14-58`; `webhooks/whatsapp/route.ts:136-148`; `components/meta-quota-card.tsx:23-33` |
| **F4D-017** | MÉDIO | Novo | Custo/cota de IA: contadores e `AIUsageLog` existem e funcionam, mas **o reset mensal não está agendado** (F4D-007) e **não há alerta de % de cota** (o doc prevê 80%/90%, sem implementação); mensagens WhatsApp e Storage sem qualquer teto. | `webhooks/whatsapp:381,470,474`; `schema.prisma:96-97,865`; `docs/WHATSAPP_BOT.md:218-224` |
| **F4D-004** | **ALTO** | Novo | As proteções anti-ban documentadas **não existem no código**: o doc descreve `DAILY_LIMIT`, `isRateLimited()`, `isBanned()` etc.; grep em `src/` = **0**. O operador acredita ter teto de mensagens que não existe. | `docs/WHATSAPP_BOT.md:163-195`; grep `DAILY_LIMIT\·HOURLY_LIMIT\·isRateLimited\·isBanned` = 0 |
| **F4D-009** | **ALTO** | Novo | Os "Monitores de serviço" do painel SaaS são **hardcode `ok: true`** (Vercel, OpenAI, Evolution) — só o banco tem check real (`SELECT 1`). Painel mostra verde com iFood/Evolution/OpenAI caídos. | `admin-saas/(auth)/dashboard/page.tsx:58-69` ✅ |

---

## 4.6 Modo degradado/offline do PDV e do KDS

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4C-001** | **CRÍTICO** | Rep. F5B-034 | PDV **limpa carrinho e mesa ANTES de confirmar no servidor**: em rede caída o `fetch` rejeita (não é `!res.ok`), então **nenhum restore roda** — e o estado vazio é persistido no `localStorage` pelo efeito de persistência. **Venda perdida em silêncio**, sem toast, sem rastro. | `caixa/caixa-page.tsx:804-810,846-858,936-942` ✅ (catch só `console.error`) |
| **F4C-002** | **ALTO** | Novo | Boot do PDV **sem `try/catch`**: falha em 1 das 5 requisições do `Promise.all` congela o caixa **no spinner para sempre**, sem mensagem nem retry (a home do dashboard trata isso; o caixa, não). | `caixa-page.tsx:386-397,400,470,1087-1093`; contraste `home/page-content.tsx:47` |
| **F4C-003** | **ALTO** | Rep. F3C-038 | **Nenhuma fila de pedidos offline nem replay**: com 50 clientes na fila e internet caindo, o operador não acumula vendas; o Service Worker **recusa cache de API** (`/api/` → sempre `fetch`, sem fallback). | `caixa-page.tsx:832-846`; `public/sw.js:82-85` |
| **F4C-004** | **ALTO** | Rep. F3C-037 | **Zero `navigator.onLine`/listener de `offline` em todo o código** — nenhum indicador de modo offline no PDV; o operador continua vendendo achando que está online. | grep `navigator.onLine` = 0 ✅ |
| **F4C-006** | MÉDIO | Novo | Movimento de caixa da venda balcão é gravado **sem checar resposta** — pedido criado mas o caixa financeiro pode não registrar, sem aviso; fechamento dessincronizado do faturamento. | `caixa-page.tsx:858-869` |
| **F4C-007** | MÉDIO | Novo | Abatimento/pagamento parcial **anunciado como sucesso mesmo se a API retornar erro** (POST sem `res.ok` + toast incondicional) — mesa aparece como paga sem registro no servidor. | `caixa-page.tsx:684-693,707-709` |
| **F4C-009** | MÉDIO | Rep. F1A-044 | Falha no refresh de token **derruba o operador para `/login` no meio do turno** (`clearAuth` + `window.location.href`) — inclusive por **falha de rede** no refresh (`catch { return null }`), destruindo o estado React da venda em andamento. | `fetch-auth.ts:37-41,45-66,85-93` |
| **F4C-010** | **ALTO** | Rep. F5D-002 | KDS mantém **dados antigos na tela sem qualquer aviso** quando o poll falha: erro vai só para o console; sem banner, sem fila de ações pendentes, sem reenvio na volta da rede. Cozinha produz com base em pedidos desatualizados. | `kds/.../screen/page.tsx:105-135,287-291` ✅ |
| **F4C-011** | **ALTO** | Rep. F5D-008 | Ações do KDS (aceitar/iniciar/concluir) **não verificam resposta nem reenfileiram**: clique perdido em silêncio; sem otimismo nem rollback. | `kds/.../screen/page.tsx:137-149,664-669` |
| **F4C-012** | **ALTO** | Rep. F5D-017 | Token KDS expira em **24h sem refresh** (o KDS usa `fetch` cru, não `fetchAuth`): após expirar, a tela **congela com pedidos antigos e indicador verde "Ativo"** — display de fim de semana fica mudo sem relogin. | `auth/kds-login/route.ts:40-52`; `kds/.../screen/page.tsx:106-115,339-340` ✅ |
| **F4C-013** | MÉDIO | Novo | Falha ao buscar mensagens **zera o mapa de chats local** (`catch {}` por pedido, depois `setOrderMessages` sobrescreve com mapa vazio) — histórico em cache some do KDS num blip de rede. | `kds/.../screen/page.tsx:165-179` |
| **F4D-022** | — | — | *síntese unificada em F4C-010/F4A-022* | — |

---

## 4.7 Impressão de comanda/cupom

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4C-015** | **ALTO** | Novo | Impressão é **100% nativa do navegador** (`window.open` + `document.write` + `print()` + `close()` imediato): **popup bloqueado = falha absolutamente silenciosa** — nada impresso, nenhum aviso, e o sistema não registra que a impressão falhou. | `caixa-page.tsx:949-951,988-991` ✅; `kds/.../screen/page.tsx:471-472,521-524`; `pedidos/page-content.tsx:736-737,788-791` |
| **F4C-016** | **ALTO** | Novo | **Nenhuma lib/SDK de impressão térmica, nenhum ESC/POS, nenhum fallback para PDF, nenhum retry** — sem papel/driver/permissão não há plano B; existe página de marketing prometendo "Impressão de cupom" (`demo/page.tsx:53`) sem engenharia correspondente. | `package.json:24-47` (só `qrcode`); `caixa-page.tsx:990` |
| **F4C-017** | **ALTO** | Novo | Reimpressão limitada ao **último pedido em memória** (`lastOrder`/`lastClosedOrder`): recarregar a página apaga a capacidade de reimprimir — **sem histórico de cupons no servidor nem endpoint de reemissão**. | `caixa-page.tsx:90-91,904-913,1394-1419` |
| **F4C-018** | MÉDIO | Novo | Cupom só é oferecido **2,5 s após a confirmação** e exige toque manual; fechar o modal = sem cupom; não há auto-impressão configurável por estabelecimento. | `caixa-page.tsx:84-89,931-936,1904-1933` |

---

## 4.8 Logs estruturados, correlação e dados sensíveis

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4A-018** | **ALTO** | Rep. F1A-033 | **586 `console.*` soltos** (384 em API), **zero logger estruturado** (sem pino/winston), **zero request-id/correlação** (orderId/establishmentId) — impossível reconstruir uma requisição ou medir taxa de erro por integração. | `package.json:26-46`; grep `requestId\·correlationId` = 1 ocorrência de negócio |
| **F4A-013** | **ALTO** | Novo | Webhook iFood loga **todos os headers integrais** (`Object.fromEntries(req.headers)`) a cada chamada → credencial de webhook persistida nos logs da Vercel. | `orders/ifood-webhook/route.ts:33` ✅ |
| **F4B-043** | — | — | *unificado em F4A-013* | — |
| **F4A-014** | **CRÍTICO** | Rep. F1A-034 | Resposta da troca de token Meta é logada **inteira** (`JSON.stringify(tokenData)`) — inclui o `access_token` de longa duração do WhatsApp de todos os tenants; idem `debug_token`. | `establishments/[id]/meta-discover/route.ts:57,79,190` ✅ |
| **F4A-015** | ALTO | Novo | Fragmentos de credenciais logados: primeiros 10 chars da API key Pagar.me e 20 chars do access token Meta em rotas de pedido/verificação. | `orders/route.ts:587`; `verification/route.ts:138` |
| **F4A-016** | **CRÍTICO** | Rep. F1B-008 | **OTP de verificação e link de reset de senha impressos em texto plano** nos logs (`Code sent ... <código>`, `[PASSWORD RESET] ... <resetUrl com token>`) — qualquer acesso aos logs da Vercel permite assumir contas. | `verification/route.ts:155,260` ✅ (fallback loga o código); `auth/forgot/route.ts:47` |
| **F4A-017** | **ALTO** | Rep. F1A-032 | Logs com **PII e payloads de pagamento/webhook completos** (telefones, e-mails, CPF, bodies inteiros) sem redação/máscara. | `orders/route.ts:596`; `payments/asaas/card/route.ts:12,96`; `orders/[id]/route.ts:406,461,503`; `whatsapp/meta.ts:37,100`; `webhooks/efi/route.ts:22`; `payments/inter/webhook/route.ts:7` |
| **F4C-037** | BAIXO | Novo | Log de queries do Prisma é um **ternário morto** (ambas as ramificações `["error"]`) → zero log de SQL em produção; depurar incidente de banco depende de reproduzir localmente. | `lib/prisma.ts:7` |

---

## 4.9 Monitoramento e alertas

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4A-019** | **CRÍTICO** | Rep. F1C-108 | **Nenhum APM/error tracking** (Sentry/Datadog/OTel/PostHog = 0 em `package.json` e `src/`) e nenhuma `instrumentation.ts`/`global-error.tsx` — erros 500, unhandled rejections e crashes de renderização em produção são **invisíveis**. Incidentes só chegam por reclamação de cliente. | `package.json:26-56`; ausência de `src/instrumentation.ts`; grep `sentry\·datadog\·posthog` = 0 ✅ |
| **F4D-010** | — | — | *unificado em F4A-019* | — |
| **F4A-021** | (4.5) | — | *alertas de integração — ver acima* | — |
| **F4D-018** | BAIXO | Novo | **Ferramentas de diagnóstico existem mas são invisíveis**: `PushLog`, `/api/push/diagnose` e `/api/check-orders` não aparecem em doc nem no painel — o time não sabe que têm. | `push/diagnose/route.ts:10-60`; `check-orders/route.ts:6-25`; grep `diagnose` em `docs/` = 0 |

---

## 4.10 Health checks e heartbeat de dispositivos

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4A-020** | **ALTO** | Rep. F3D-001 | **Nenhum endpoint de health check** (`/api/health`, `/healthz`, `/ping` = 0 — os `*-status` existentes são de negócio: WhatsApp, pagamento, mesa, iFood) — nenhum synthetic monitor pode ser configurado e não há baseline de "boot ok + banco responde". | `find src/app/api -iname "*health*"` = 0 ✅ |
| **F4C-034** | — | — | *unificado em F4A-020* | — |
| **F4A-022** | **ALTO** | Rep. F5D-002 | **KDS sem heartbeat/presença**: não há rota de presença (`/api/kds` só expõe `establishment`), o poll de 5 s engole falha e o **ponto verde "Modo Serviço: Ativo" é estático** — o operador só descobre que a tela caiu quando os pedidos param de aparecer. | `kds/.../screen/page.tsx:130-131,339-340` ✅; `api/kds/` só `establishment/route.ts` |
| **F4C-014** | — | — | *unificado em F4A-022* | — |

---

## 4.11 Ambientes, CI/CD, rollback e feature flags

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4C-022** | **CRÍTICO** | Rep. F1C-101 | **Zero pipeline de CI/CD**: sem `.github/workflows`, `.gitlab-ci.yml`, `Dockerfile`, `netlify.toml` (contagem = 0 ✅) — deploy é o build automático da Vercel no push; **commit quebrado vai direto para produção**. | `ls` da raiz; `.vercel/project.json` |
| **F4C-023** | **ALTO** | Novo | **Testes não rodam no build nem no deploy**: `build` = `rm -rf .next && next build` sem `npm test`; `vercel.json` sem etapa de teste — os 6 arquivos de teste são **inúteis como gate** (lado bom: `next build` roda lint/typecheck porque não há `ignoreBuildErrors`). | `package.json:8,17`; `vercel.json:1-12`; `next.config.js:1-15` |
| **F4C-019** | **ALTO** | Novo | **Sem `.env.example`** e **drift real código↔env**: variáveis obrigatórias usadas no código não existem no `.env` (`PAGARME_API_KEY`, `PAGARME_WEBHOOK_KEY`, `ASAAS_WEBHOOK_TOKEN`, `IFOOD_WEBHOOK_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `SAAS_EVOLUTION_*`…) — montar ambiente novo quebra de forma não óbvia (pagamento/iFood/webhook silenciosamente inoperantes). | ausência de `.env.example` ✅; `integrations/pagarme.ts` |
| **F4D-023** | — | — | *unificado em F4C-019* | — |
| **F4C-020** | MÉDIO | Novo | **Zero uso de `VERCEL_ENV`** e nenhuma diferenciação de ambiente: dev/staging/prod rodam o mesmo comportamento (inclusive IA e webhooks caros). | grep `VERCEL_ENV` = 0 ✅ |
| **F4C-021** | MÉDIO | Novo | **Nenhum mecanismo de feature flag** (grep = 0): qualquer mudança de comportamento exige deploy; **não há kill-switch** para bug em produção. | grep `featureFlag\·FF_\·flags\.` = 0 |
| **F4C-024** | **ALTO** | Novo | **Sem runbook de deploy/rollback**: `docs/` tem só 2 arquivos funcionais; tags git existem mas sem convenção operacional; recuperar de incidente depende do conhecimento de uma pessoa. | `ls docs/` = `ADMIN_SAAS.md`, `WHATSAPP_BOT.md` ✅ |
| **F4C-030** | **ALTO** | Novo | **Working tree sujo desde 26/09**: 20+ arquivos modificados e não commitados (incl. `schema.prisma`, `sw.js`, `caixa-page.tsx`, `kds/screen`, `orders/route.ts`) — o que roda em produção **não é rastreável por commit**; impossível saber o que um rollback restauraria. *(Pré-existente — não decorre desta auditoria.)* | `git status` ✅; `git log -1` = `42ea19c` (26/09/2026) |
| **F4C-029** | MÉDIO | Novo | Sem `engines`, sem `.nvmrc`/`.node-version`: a versão de Node em build/prod é indeterminada (builds não reprodutíveis; `sharp` é sensível). `package-lock.json` versionado: ponto positivo. | ausência confirmada ✅; `package-lock.json:4` |
| **F4C-032** | BAIXO | Novo | SQLite `prisma/dev.db` (217 KB) **commitado** no repositório. | `git ls-files` |
| **F4C-031** | BAIXO | Rep. F3D-006 | `build` faz `rm -rf .next` a cada build, descartando o cache incremental. | `package.json:8` |
| **F4C-028** | BAIXO | Novo | Script `dev` mata incondicionalmente qualquer processo na porta 3000. | `package.json:6` |
| **F4D-012** | (4.11) | — | *`db:reset` — ver F4C-027* | — |
| **F4C-027** | **ALTO** | Novo | **`db:reset` = `prisma db push --force-reset` sem guarda de ambiente** — com `DATABASE_URL` de produção no `.env`, um `npm run db:reset` apaga o banco inteiro; sem doc nem trava. | `package.json:15` ✅ |

---

## 4.12 Testes automatizados

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4C-038** | **ALTO** | Rep. F1C-101 | **6 arquivos de teste no produto inteiro** (1.185 linhas, todos Vitest, `environment: "node"`) — **todos da integração 99app/delivery**; **zero** testes para `/api/orders`, PDV, KDS, caixa/fechamento, pagamentos, auth e impressão. Os fluxos críticos do termo (criar pedido, pagar, fechar caixa) mudam sem nenhum gate. | `find src -name "*.test.ts"` = 6 ✅; `vitest.config.ts:13,14,17-24` |
| **F4C-039** | MÉDIO | Novo | Ambiente de teste é **só `node`** — nenhum componente/E2E (sem Cypress/Playwright/JSDOM/Testing Library): nada valida comportamento de navegador (impressão, popup, offline). | `vitest.config.ts:13`; `package.json:48-63` |

---

## 4.13 Plano de recuperação de desastre e runbook

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F4D-001** | **CRÍTICO** | Rep. F1C-101 | **Caixa de ferramentas operacional praticamente inexistente**: sem `README`, sem `CONTRIBUTING`, sem runbook, sem CHANGELOG — o repo tem exatamente **2 arquivos `.md`** (`docs/ADMIN_SAAS.md`, `docs/WHATSAPP_BOT.md`). Nenhum guia de setup/deploy/ambientes/owners. | `ls *.md` = 0 na raiz ✅; `find` por `runbook\·operat\·incident` = só `backups/` |
| **F4D-002** | **ALTO** | Novo | **Nenhum runbook de incidentes** — `grep ifood docs/` = 0 ocorrências. Os 5 cenários prováveis (iFood fora, gateway fora, pool Supabase esgotado, WhatsApp fora, KDS mudo) **não têm procedimento documentado**; o único doc de operação trata "Recuperação de Ban" do WhatsApp. | `docs/WHATSAPP_BOT.md:309-325`; `docs/ADMIN_SAAS.md:17-19` |
| **F4D-003** | MÉDIO | Novo | `docs/WHATSAPP_BOT.md` **descreve um sistema que não é o atual**: marca a IA como "Pendente" (ela está em produção), prevê models que **não existem** no schema e cita só Evolution enquanto há provider Meta Cloud. | `WHATSAPP_BOT.md:47-48,63,24-27`; `webhooks/whatsapp/route.ts:5`; grep `WhatsAppMessageLog` = 0 |
| **F4D-005** | **CRÍTICO** | Rep. F2-021 | **Zero capacidade de backup/restore versionada no repo**: `scripts/` tem só seeds/fixes pontuais; nenhum job de dump, nenhum doc de PITR, nenhum procedimento de restauração. | grep `pg_dump\·pg_restore\·barman\·snapshot` = 0 em `scripts/`, `src/`, `docs/` |
| **F4D-006** | **ALTO** | Rep. F2-018 | O schema contém **dados não reproducíveis** (fotos base64 no Postgres, eventos de marketplace descartados após `console.log`): perder o banco = perder cardápios fotográficos e evidências de pedidos, sem como regenerar por seed. | `products/[id]/route.ts:62-65` ✅ |
| **F4D-011** | **ALTO** | Rep. F2-005 | **Migrations não reproduzem o schema**: só **4 pastas** de migration (todas `ALTER TABLE Establishment ADD COLUMN`) vs **47 models** no schema — provisionamento real depende de `db push` manual, **sem `migrate deploy` no build**; rollback de schema é **impossível** (não há migration reversível). | `ls prisma/migrations` = 4 ✅; `schema.prisma` (47 models); `package.json:8,12` |
| **F4D-013** | — | — | *unificado em F4D-011* (última migration 25/08; schema modificado até 05/10 e ainda sujo) | — |
| **F4C-026** | — | — | *unificado em F4D-011* | — |
| **F4D-019** | **ALTO** | Novo | **Infraestrutura crítica fora do repo e sem dono/SLO/procedimento**: Evolution API ( Railway/VPS por tenant, credenciais em colunas, estado de conexão nunca monitorado), Meta Cloud, Supabase Storage (bucket público), Vercel. | `WHATSAPP_BOT.md:109-121`; `schema.prisma:20`; `evolution.ts:53-67`; `image-upload.ts:29,67` |
| **F4D-020** | MÉDIO | Novo | Credenciais iFood: **env global única, sem runbook de rotação**, e o schema prevê token por estabelecimento que **nunca é lido** (campos mortos); auth com cache em memória e sem refresh manual documentado. | grep `IFOOD_CLIENT_ID` = 10+ arquivos; `schema.prisma:171-174`; grep `ifoodAccessToken` em `src/` = 0; `integrations/ifood.ts:8-16` |
| **F4D-024** | BAIXO | Rep. F1A-002 | Segredos fora do git (bom: `.gitignore` cobre `.env*` e `git ls-files \· grep env` = 0 ✅), mas **sem política de rotação** de nenhuma chave e sem procedimento para revogar credencial de tenant desligado. | `.gitignore:33`; grep `rotação\·rotate` em `docs/` = 0 |
| **F4D-025** | **ALTO** | Rep. F1A-041 | **Ferramentas destrutivas/debug em produção sem trava**: `DELETE /api/orders/delete-all` apaga **todos** os pedidos da loja numa chamada (só `verifyAuth`, comentário "production-safe") e `POST /api/test-dispatch` fala com o iFood real usando merchant UUID hardcoded. | `orders/delete-all/route.ts:8-18` ✅; `test-dispatch/route.ts:13-20,36` |
| **F4C-036** | — | — | *unificado em F4D-025* | — |
| **F4C-035** | MÉDIO | Rep. F6-024 | O Service Worker, ao mudar de versão, **força `navigate` em todos os clients abertos** — pode reiniciar PDV/KDS no meio do expediente (perdendo ações em andamento e popup de impressão). | `public/sw.js:1,54-76` ✅ (ativate → `client.navigate`) |

---

## O que está bom

1. **Asinatura fail-closed existe e funciona** no webhook Asaas — prova de que o padrão é conhecido no projeto; falta aplicá-lo aos outros 9 webhooks.
2. **`CancellationLog` com snapshot completo** no cancel do painel (`orders/[id]/route.ts:150`; modelo `schema.prisma:827-849`) — sobrevive a `delete` do pedido; é o modelo que deveria valer para todos os escritores.
3. **`AIUsageLog` + limite por loja em runtime** (custo de IA auditável e teto respeitado) — falta só o cron de reset e o alerta de %.
4. **`package-lock.json` versionado** e `next build` roda lint/typecheck por padrão (sem `ignoreBuildErrors`).
5. **Segredos fora do git** (`.gitignore` cobre `.env*`; nenhum env versionado).

## Não verificado / fora do alcance deste repositório

- **Estado real na Vercel/Supabase**: plano, `maxDuration` configurado no painel, crons agendados fora do repo, histórico de deploys, **backups/PITR/restauração/RLS** (tudo no painel, não no código).
- Se os crons não agendados (`sync-payments`, `meta-quota`, `reset-ai-usage`) são disparados **manualmente por runbook fora do repo**.
- Conteúdo dos logs da Vercel em produção e se existe Sentry/monitoramento configurado só por env vars.
- Dono/SLO da VPS Railway da Evolution e dos buckets do Supabase.
- Homologação iFood/99/Pagar.me e comportamento real de rede/impressora (análise 100% estática).

## Prioridades desta fase (Top 5)

1. **Webhook→pedido confiável**: processar webhook **antes** de responder (ou responder 2xx só depois de gravar), com **inbox idempotente** (`eventId` + `@@unique`) e **dead-letter com replay** — fecha F4A-001/002, F4B-016/021/022 de uma vez.
2. **Reconciliação viva**: agendar `sync-payments` (janela ≥7 dias, multi-gateway) e `meta-quota`; restaurar estoque e cancelar cobrança em `delete`/`abandoned` (F4D-007, F4A-004/005, F4B-024/035).
3. **Observabilidade mínima**: Sentry (ou OTel) + `error.tsx` + health endpoint + log estruturado com `orderId/establishmentId` e **redação de token/OTP/PII** (F4A-014/016/018/019/020/025).
4. **PDV/KDS degradados**: banner de offline (`navigator.onLine`), **não limpar carrinho antes do ACK**, fila local de pedidos e ações do KDS com retry, indicador de conexão real e refresh do token KDS (F4C-001/003/004/010/011/012).
5. **Portão de release**: CI (lint+typecheck+test no PR), `npm test` no build, `.env.example`, feature flag/kill-switch e `prisma migrate` real (não só `db push`) (F4C-019/022/023/021, F4D-011).

## Duplicados removidos nesta fase

| Descartado | Unificado em |
|---|---|
| F4A-003, F4B-023, F4C-025 | F4D-007 (crons mortos; também Rep. F3D-002) |
| F4B-008 | F4A-002 (Asaas fire-and-forget) |
| F4B-036, F4C-005 | F4A-010 (timeouts ausentes) |
| F4B-028 | F4A-012 (iFood sem acknowledge) |
| F4B-043 | F4A-013 (log de headers) |
| F4D-010 | F4A-019 (sem APM) |
| F4C-034 | F4A-020 (sem health) |
| F4C-014 | F4A-022 (KDS sem heartbeat) |
| F4C-033 | F4A-025 (JSON.parse + zero error boundary) |
| F4C-008 | F4B-019 (POST /orders sem idempotência) |
| F4B-025 | F4A-004 (janela de 15 min) |
| F4D-012 | F4C-027 (`db:reset --force-reset`) |
| F4D-013, F4C-026 | F4D-011 (migrations vs schema) |
| F4D-023 | F4C-019 (sem `.env.example`) |
| F4D-022 | F4C-010 + F4A-022 (KDS/caixa mudos) |
| F4C-036 | F4D-025 (ferramentas destrutivas em prod) |
| F4C-039 | F4C-038 (testes só da 99) |

## Pendências da Fase 4 para o responsável

1. **Inbox de webhooks idempotente + dead-letter com replay** (`WebhookEvent` com `@@unique([provider, eventId])`, gravar **antes** de responder 2xx, fila/Fila de retry, endpoint de replay manual) — cobre iFood, 99Food, 99, Asaas, Pagar.me, Efi, Inter, assinatura, Meta e Evolution; hoje só Asaas tem assinatura fail-closed.
2. **Não responder 200 com falha**: o handler do iFood deve responder erro (ou 2xx só após persistir) para o marketplace reenviar; e o WhatsApp deve responder rápido e processar em background com dedup por `msg.id`.
3. **Reconciliação de pagamentos agendada e multi-gateway** (`sync-payments` ≥7 dias, Pagar.me/Efi/Inter incluídos), com alerta de pedido preso >30 min e `CancellationLog` em todo cancelamento automático.
4. **Estoque**: `restoreOrderStock` obrigatório em todo `order.delete`/`abandoned`/cancel financeiro + o `catch` do próprio helper deve alertar, não engolir.
5. **Idempotência no `POST /api/orders`** (header `Idempotency-Key` com `@@unique` + lock por pedido para escritores concorrentes) e trava de corrida no `dispatch-99`.
6. **Observabilidade**: Sentry/error tracking, `error.tsx`/`global-error.tsx`, `/api/health`, log estruturado com `orderId/establishmentId` e **remover dos logs** headers de webhook, tokens Meta, OTP e reset URL.
7. **PDV/KDS**: banner de offline, não limpar carrinho antes do ACK do servidor, fila local com replay, ações do KDS com `res.ok` + retry, indicador de conexão real e refresh/rotatividade do token de 24h do KDS.
8. **Impressão**: detectar falha de `window.open`/`print`, oferecer PDF/segunda via no servidor (histórico de cupons) e auto-impressão configurável.
9. **Engenharia de release**: CI com lint+typecheck+test, `npm test` no gate do deploy, `.env.example` completo, kill-switch/feature flag, `engines`/`.nvmrc`, `prisma migrate` (não só `db push`) e runbook de rollback; remover `delete-all` e `test-dispatch` de produção.
10. **Runbooks**: doc de incidente para os 5 cenários (iFood, gateway, pool, WhatsApp, KDS) + política de rotação de chaves + dono/SLO para Evolution/Storage; atualizar `WHATSAPP_BOT.md` (está desatualizado e descreve proteções inexistentes).
11. **Executar `auditoria/testes/4-01-confiabilidade-estatico.sh`** (estático, seguro) para revalidar após correções.
