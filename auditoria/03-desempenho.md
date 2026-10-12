# FASE 3 — DESEMPENHO E ESCALABILIDADE

**Data:** 09/10/2026 · **Saída:** `auditoria/03-desempenho.md` · **Termo:** `AUDITORIA-SAAS-FOOD.txt:232-247`
**Regra central da fase:** ler o código e projetar o comportamento sob carga — **nenhuma medição executada** (banco = produção; nenhum curl, nenhum `EXPLAIN`, nenhum teste remoto).

## Escopo e método

- **Leitura 100% estática** + análise dos manifests do build já presentes no repo (`.next/` local, gerado em 08/10).
- Varredura em 4 blocos (3A backend/API/Prisma · 3B frontend/painel/PDV/KDS · 3C realtime/latência · 3D infra/limites/custo) por sub-agentes de leitura, com **conferência pessoal de 15 âncoras** pelo auditor (marcadas ✅ — todas relidas com `sed -n` na fonte).
- Deduplicação contra **Fases 0/1/2/6/7** (coluna *Origem*: `Novo` ou `Rep. Fxx-xxx`) e **dentro da própria fase** (duplicados entre blocos unificados — ver ao final).
- Nenhum arquivo do produto foi modificado. Nenhum segredo impresso (só **nomes** de variáveis de ambiente).

## Resumo

| Seção | Achados | C | A | M | B | Novos/Rep. | Nota |
|---|---|---|---|---|---|---|---|
| 3.1 Rotas principais (payload e queries) | 25 | 2 | 6 | 15 | 1 | 21 / 4 | **2,0** |
| 3.2 Bundle e code splitting | 5 | 0 | 2 | 1 | 2 | 5 / 0 | **2,5** |
| 3.3 Renderização, cache e invalidação | 10 | 0 | 5 | 4 | 0 | 8 / 2 | **1,5** |
| 3.4 Cold start e limites de execução | 9 | 0 | 6 | 3 | 0 | 6 / 3 | **2,5** |
| 3.5 Connection pooling | 4 | 1 | 1 | 2 | 0 | 2 / 2 | **2,0** |
| 3.6 Realtime | 5 | 1 | 2 | 2 | 0 | 2 / 3 | **1,0** |
| 3.7 Polling, re-renders e duplicação | 18 | 3 | 5 | 5 | 4 | 14 / 4 | **1,5** |
| 3.8 Imagens | 5 | 1 | 2 | 1 | 1 | 3 / 2 | **1,5** |
| 3.9 Listas longas | 1 | 0 | 1 | 0 | 0 | 0 / 1 | **2,0** |
| 3.10 PDV rápido | 8 | 0 | 3 | 3 | 0 | 5 / 3 | **3,0** |
| 3.11 Pico / 10x (ordem de quebra) | 1 | 1 | 0 | 0 | 0 | 1 / 0 | **2,0** |
| 3.12 Filas e jobs | 9 | 0 | 6 | 3 | 0 | 4 / 5 | **2,0** |
| 3.13 Limites de plano e custo (10/50/200) | 0* | — | — | — | — | — | **2,5** |
| 3.14 Latência ponta a ponta (meta < 2 s) | 6 | 1 | 4 | 0 | 0 | 2 / 4 | **1,5** |
| **Total (únicos)** | **106** | **10** | **43** | **39** | **8** | **73 / 33** | **2,1** |

\* A seção 3.13 é análise de premissa (tabelas de consumo e custo), sem achado de código próprio — seus drivers são F3A-021, F3A-001, F3D-010 e F3D-013.

- **73 achados novos** e **33 repetições** (Fases 0/1/2/6/7, coluna *Origem* = `Rep.`). As linhas com *Origem* `(3.x)` são **remissões** (o achado conta na seção indicada) — fora elas, os 106 IDs são únicos.
- **30 dos achados foram confirmados por script estático** (`testes/3-01-desempenho-estatico.sh`, executado nesta auditoria: **30 CONFIRMADO / 0 a rever**) e **15 âncoras críticas** foram relidas linha a linha pelo auditor (marcadas ✅).

---

## 3.1 Tempo de resposta das rotas principais

> Sem APM não há p50/p95 medidos (**NÃO VERIFICADO**); abaixo está o custo derivado do código — o que *necessariamente* é lido/escrito por chamada.

### O endpoint mais caro do sistema

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3A-001** | **CRÍTICO** | Rep. F2-004 | `GET /api/orders` devolve **todos** os pedidos do tenant (histórico inteiro, com `customer` e `establishment` anexos, sem `take` nem janela de data) — é a base de 9 chamadores com polling de 5–30 s. Payload O(histórico) que cresce para sempre. | `orders/route.ts:748-755` ✅ |
| **F3A-002** | **CRÍTICO** | Novo | **Toda leitura de pedidos executa uma ESCRITA antes**: `updateMany` de expiração de `abandoned` em cada GET ("Expire old pending orders on each dashboard poll") → com KDS aberto, **1 escrita em WAL a cada 5 s por loja**, além de lock concorrente entre KDS+caixa+painel lendo juntos. | `orders/route.ts:699-713` ✅ |
| **F3A-003** | **ALTO** | Novo | O GET **público** do cliente (`/api/orders/customer`, chamado pelo cardápio a cada 15 s) também roda `updateMany` de expiração — escrita-por-leitura em rota anônima. | `orders/customer/route.ts:24-34` |
| **F3C-013** | (3.9) | — | ver listas longas | — |
| **F3C-012** | (3.1) | — | *unificado em F3A-002* | — |

### Leituras ilimitadas por endpoint (mesma classe, evidências distintas)

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3A-004** | MÉDIO | Novo | `GET /api/customers` sem `take`: tela de clientes transfere o histórico completo de clientes com todas as colunas. | `customers/route.ts:57-62` |
| **F3A-005** | MÉDIO | Novo | DRE lê **linhas inteiras de `Order`** (`findMany` sem `select`) só para somar 6 valores em JS. | `financial/dre/route.ts:34-36` |
| **F3A-006** | MÉDIO | Novo | CMV faz **dois** `findMany` ilimitados (pedidos + custos por item) e agrega tudo na RAM da função. | `financial/cmv/route.ts:28-36,51-63` |
| **F3A-007** | MÉDIO | Novo | `/financial/revenues` embute todos os pedidos na resposta de agregação diária → payload O(n). | `financial/revenues/route.ts:25-37,55,63-72` |
| **F3A-008** | MÉDIO | Novo | `/financial/cash-flow` recalcula o período inteiro em JS a cada abertura da tela. | `financial/cash-flow/route.ts:24-27` |
| **F3A-009** | ALTO | Novo | `GET /api/dashboard` dispara **18 queries em `Promise.all`** (9 sem limite) — custo fixo alto por home aberta, multiplicado pelo retry (F3A-036). | `dashboard/route.ts:43-128` |
| **F3A-010** | MÉDIO | Rep. F2-010 | Relatórios baixam o histórico todo e **filtram o período no navegador**. | `relatorios/page-content.tsx:31-37,52-65` |
| **F3A-011** | MÉDIO | Novo | `/api/table-status` lê **pedidos inteiros** (coluna `items`) por mesa a cada 10 s. | `table-status/route.ts:36-44`; `mesa-page.tsx:149` |
| **F3A-012** | MÉDIO | Novo | `/api/alerts` varre **todas** as despesas e **todo** o estoque do tenant por carga de painel. | `alerts/route.ts:16-19,36-39` |
| **F3A-013** | MÉDIO | Novo | `/api/expenses` sem `take` **e** com cleanup de migração serial (N `update`) dentro de uma leitura. | `expenses/route.ts:26-45,71-74` |
| **F3A-014** | MÉDIO | Novo | Lote de endpoints do caixa sem `take`: `delivery-payments`, `partial-payment`, `cash-register/[id]/movements` — cada tela repaga leitura ilimitada. | `delivery-payments/route.ts:11-18`; `partial-payment/route.ts:17-20`; `cash-register/[id]/movements/route.ts:19-22` |
| **F3A-015** | MÉDIO | Novo | `/api/payment-request` faz `findMany` **por mesa em loop serial** (N round-trips a cada 10 s no caixa), trazendo pedidos inteiros. | `payment-request/route.ts:32-43` |
| **F3A-023** | MÉDIO | Novo | Includes profundos sem projeção: `categories` (produtos+estoque), `stock`, `establishments` transferem colunas que a tela não usa. | `categories/route.ts:15-27`; `stock/route.ts:13-39`; `establishments/route.ts:116-124` |
| **F3A-053** | MÉDIO | Novo | Dashboard carrega a coluna `items` (JSON do pedido) em 3 das 18 queries — 3 transferências do maior campo de `Order` por home aberta. | `dashboard/route.ts:65,81,158-169` |
| **F3A-060** | BAIXO | Novo | `GET /api/establishments` sem `slug`/`id` devolve **todos os tenants ativos**, sem limite — e não é chamado por nenhum componente (endpoint ocioso que cresce com o nº de lojas). | `establishments/route.ts:153-159` |

### N+1 de Prisma dentro do request

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3A-016** | ALTO | Rep. F2-011 | CMV executa **um `findMany` por item** em todo checkout (`src/lib/cmv.ts` chamado do POST /api/orders) — carrinho maior = checkout mais lento. | `lib/cmv.ts:50-53`; chamada em `orders/route.ts:461` |
| **F3A-017** | ALTO | Novo | `POST /api/purchases` roda **3 operações por item, em série, sem `$transaction`**: compra com 20 insumos = 60 round-trips e risco de parar no meio (estoque inconsistente). | `purchases/route.ts:92-124` |
| **F3A-018** | MÉDIO | Novo | `update-prices` atualiza **produto por produto** (N `update` sequenciais) em vez de `updateMany`. | `products/update-prices/route.ts:94-99` |
| **F3A-019** | ALTO | Novo | Importação de cardápio iFood: **download + upload de imagem + `create` por item**, serial, dentro de uma função serverless — cardápio grande = quase certo timeout. | `ifood-catalog/import/route.ts:81-140,157-160` |
| **F3A-020** | ALTO | Novo | `/api/push/diagnose` faz **4 queries por estabelecimento em `Promise.all` global** — fan-out de conexões simultâneas que esgota o pool do Postgres. | `push/diagnose/route.ts:76-112` |
| **F3A-036** | MÉDIO | Novo | `withRetry` do dashboard reexecuta as **18 queries até 3×** — em pico de conexão o efeito é multiplicativo (18→54), amplificando a saturação que tenta evitar (mesmo padrão no cardápio público). | `dashboard/route.ts:6-18,29`; `[slug]/page.tsx:6-18` |

---

## 3.2 Tamanho do bundle e code splitting

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3B-012** | **ALTO** | Novo | O cardápio público é **um único componente `"use client"` de 7.360 linhas com 146 `useState`** — carrinho, checkout, PIX, chat, stories, carrosséis e OTP num só módulo hidratado no celular do cliente. Qualquer tick de estado re-renderiza a árvore monolítica. | `[slug]/menu-page.tsx:1,166,239-298` (146 `useState`; arquivo termina na 7360) |
| **F3D-024** | **ALTO** | Novo | Bundle medido no manifest: `/[slug]/page` = **7 chunks, 587 KB brutos / 153 KB gzip** (maior rota do app; `/dashboard/cardapio` = 473 KB, `/` = 296 KB). | `.next/app-build-manifest.json` ✅ |
| **F3B-019** | MÉDIO | Novo | Code splitting quase inexistente: **apenas 2 usos de `next/dynamic`** no repo inteiro (stories/destaques); `qrcode` importado no topo do bundle do PDV e da Mesa; nenhuma separação de modais/pagamentos. | `stories/page.tsx:5`; `destaques/page.tsx:5`; `caixa/caixa-page.tsx:12`; `mesa-page.tsx:8` |
| **F3D-005** | BAIXO | Novo | `next.config.js`: `compress` e `reactStrictMode` são no-ops; **sem** `output`, **sem** bundle analyzer (nenhum script `analyze` no `package.json`). `optimizePackageImports: ["lucide-react"]` está correto. | `next.config.js:3,5-8`; `package.json:8` |
| **F3D-006** | BAIXO | Novo | **Positivo:** só 17 deps; sem chart.js/recharts/moment/axios/pdf — gráficos são SVG feitos à mão; peso real em next/lucide/date-fns/openai. Mas o `build` faz `rm -rf .next` a cada build (perde incrementalidade). | `package.json:8,24-42`; `src/components/charts/*.tsx` |

---

## 3.3 Estratégia de renderização, cache e invalidação

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3A-028** | **ALTO** | Novo | `export const revalidate` declarado em **11 rotas que leem `req`/`searchParams`** (orders, dashboard, table-status, categories, stock, alerts, establishments + 3 financeiras) — **config morta**: tudo recomputa a cada request. | `orders/route.ts:70` vs `:691`; `dashboard/route.ts:4` vs `:21`; `table-status/route.ts:5` vs `:9`; `categories/route.ts:5`; `stock/route.ts:4`; `alerts/route.ts:5`; `establishments/route.ts:10` |
| **F3C-017** | — | — | *unificado em F3A-028* (o `revalidate = 5` do `/api/orders` não se realiza porque o cliente força `no-store`) | — |
| **F3A-029** | **ALTO** | Novo | `fetchAuth` envia **`cache: "no-store"` em todas** as chamadas do painel — desativa qualquer cache de navegador/fetch/CDN para os dados mais requisitados do sistema. | `lib/fetch-auth.ts:83` ✅ |
| **F3A-030** | ALTO | Novo | **Zero** `unstable_cache`/`revalidateTag` no projeto; os **únicos 2** `Cache-Control` do repo estão em `manifest` e `icon`. Cardápio, stories, banners, destaques e reviews recalculam por request. | `manifest/[slug]/route.ts:47`; `icon/[slug]/route.ts:62` |
| **F3A-031** | MÉDIO | Novo | Endpoints públicos de leitura coletiva (tracking, categorias, stories, banners, destaques) sem nenhum cache — cada visitante reprocessa o mesmo dado. | `tracking/[id]/route.ts:8-17`; `categories/route.ts:15`; `stories/route.ts:4` |
| **F3A-024** | **ALTO** | Rep. F6-006 | Página pública do cardápio: **SSR por visita** (prerender-manifest não tem `[slug]`), executando `generateMetadata` do layout + da page + a query do menu (3 `findUnique` do mesmo `establishment`) + 2 invocações (`manifest`, `icon`) — nenhuma rota declara ISR. | `[slug]/page.tsx:25-30,64-74`; `[slug]/layout.tsx:5-8,17,20-21`; `.next/prerender-manifest.json` |
| **F3B-013** | (3.3) | — | *unificado em F3A-024* | — |
| **F3D-013** | (3.8) | — | ver imagens (HTML com fotos base64) | — |
| **F3A-025** | ALTO | Novo | A carga do cardápio dispara **7 endpoints por visita** (menus, likes, stories, banners, destaques, reviews…), nenhum cacheado. | `menu-page.tsx:644,852,880,962,1071-1073` |
| **F3A-026** | MÉDIO | Novo | `/api/stories` recalcula **best-sellers com todos os pedidos de 30 dias** inline, a cada visita ao cardápio. | `stories/route.ts:4,21-34` |
| **F3A-027** | MÉDIO | Novo | `/api/products/likes` carrega **todos os produtos do tenant** para responder um boolean por dispositivo. | `products/likes/route.ts:20-29` |
| **F3A-032** | MÉDIO | Novo | `/api/establishments?id=` devolve loja + **categorias + produtos** (cardápio inteiro) a cada página do painel (o layout refaz a cada navegação — ver F3B-009). | `establishments/route.ts:115-131`; `dashboard/(auth)/layout.tsx:89` |

---

## 3.4 Cold start e limites de execução das funções

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3D-001** | **ALTO** | Rep. F1C-101 | `vercel.json` tem **12 linhas e só crons**: sem `functions` (memória/maxDuration), sem `regions`, sem `headers` — **149 rotas `/api`** rodam com os defaults do plano; nenhuma função declara `maxDuration` (grep = 0). | `vercel.json:1-12` ✅; `.next/app-path-routes-manifest.json` (149 `/api`) |
| **F3A-037** | (3.4) | — | *unificado em F3D-001* | — |
| **F3D-002** | **ALTO** | Rep. F5C-012 | **5 rotas `/api/cron` existem no código, só 2 estão agendadas** (`verify-reminder` 1×/dia e `sync-ifood-status` */5). `sync-payments`, `meta-quota` e `reset-ai-usage` nunca rodam agendados → o custo migra para polling do navegador. `cron/expire-orders/` está **vazio** (a expiração virou efeito colateral do GET — F3A-002). Bônus: o comentário do `verify-reminder` diz "hora em hora" mas ele roda 1×/dia. | `vercel.json:4-9`; `cron/meta-quota/route.ts:5`; `cron/sync-payments/route.ts:30`; `cron/reset-ai-usage/route.ts:4`; dir `cron/expire-orders/` vazio; `cron/verify-reminder/route.ts:9` |
| **F3A-038** | (3.4) | — | *unificado em F3D-002* | — |
| **F3A-059** | (3.4) | — | *unificado em F3D-002* (meta-quota morto) | — |
| **F3D-003** | **ALTO** | Rep. F5C-012 | Cron `sync-ifood-status` (288×/dia) varre **todas** as lojas iFood em loop **sequencial** com HTTP externo + `update` por loja, sem `maxDuration` — com dezenas de lojas estoura o timeout e o `catch` engole o erro por loja. | `cron/sync-ifood-status/route.ts:66,85,94,108,121`; `vercel.json:8-9` |
| **F3A-042** | (3.4) | — | *unificado em F3D-003* | — |
| **F3C-035** | (3.4) | — | *unificado em F3D-003* | — |
| **F3A-043** | MÉDIO | Novo | Cron `verify-reminder` faz **até 50 envios seriais por tenant** na mesma invocação — clássico corte por timeout. | `cron/verify-reminder/route.ts:56-90` |
| **F3A-044** | **ALTO** | Novo | **Chamadas externas sem `timeout`** em iFood, 99 e Inter: um provedor lento segura a função até o limite de duração e trava o loop inteiro no primeiro endpoint mudo (só `ifood-catalog-write` tem timeout). | `integrations/ifood.ts:21-47`; `ifood-status.ts:60-71`; `nine-nine.ts:36-58`; exceção `ifood-catalog-write.ts:35` |
| **F3A-045** | ALTO | Novo | `ifood-catalog/push` usa loops seriais com **backoff de 429 por item** — cardápio grande × latência × backoff excede a duração da função e devolve catálogo pela metade. | `ifood-catalog/push/route.ts:160,191,199`; `ifood-catalog-write.ts:40-43` |
| **F3A-046** | **ALTO** | Novo | `PATCH /api/orders/[id]` refaz a **mesma loja 5 vezes** (`:203,252,289,408,535`) e ainda **aguarda delay aleatório** antes do envio de WhatsApp — um clique de status custa 2–5+ s, dos quais 1,5–3,5 s são espera morta. | `orders/[id]/route.ts:203,252,289,408,457-462,504-511,535` |
| **F3D-022** | MÉDIO | Novo | **250 `console.log` + 189 `console.error`** em API/lib, alguns serializando payloads inteiros (PATCH de produto loga `data` **com a foto base64**; `meta-discover` loga o token da Meta). | `products/[id]/route.ts:71`; `establishments/[id]/meta-discover/route.ts:57` |
| **F3D-023** | MÉDIO | Novo | `sharp` é **`devDependency`** mas é importada em runtime de produção (`image-upload.ts:1`) — funciona porque a Vercel instala devDeps no build; quebra com `npm ci --omit=dev`. | `package.json:56`; `lib/image-upload.ts:1`; `api/upload/route.ts:3,25` |

---

## 3.5 Connection pooling e risco de esgotar conexões

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3A-033** | **CRÍTICO** | Rep. F2-009 | `PrismaClient` só é memoizado em `globalThis` **fora de produção**: em produção, **cada isolamento/cold start cria um client com pool próprio**. Conexões simultâneas ≈ `(isolamentos quentes) × (connection_limit)`; com 50 instâncias × 5 = 250 conexões. O código **já trata** `P1001`/"pool" no dashboard e no cardápio — sinal de que o limite já foi atingido em produção. | `lib/prisma.ts:16-20` ✅; tratamento: `dashboard/route.ts:12`; `[slug]/page.tsx:12` |
| **F3D-008** | (3.5) | — | *unificado em F3A-033* | — |
| **F3C-008** | ALTO | Novo | **Prova vivida:** o painel de pedidos tem **jitter manual** com comentário literal "para não estourar o limite de conexões do pooler" — aplicado em só 1 dos ~12 timers do projeto. | `pedidos/page-content.tsx:667-675` ✅ |
| **F3A-034** | MÉDIO | Rep. F2-009 | Nenhuma configuração de pool versionada no código: parâmetros (`connection_limit`, `pgbouncer`) só existem (se existirem) embutidos na URL da env; existe `DIRECT_URL` usada só por script. **Se o runtime fala com pooler ou com o Postgres direto: NÃO VERIFICADO** (não li valores de env). | `lib/prisma.ts:8-12`; `schema.prisma:5-8`; `scripts/add-waiter-column.ts:4` |
| **F3D-007** | — | — | *unificado em F3A-034* | — |
| **F3D-021** | MÉDIO | Novo | Rate limiter em **`Map` por instância de lambda**: com N instâncias o limite efetivo multiplica-se por N e **zerar a cada cold start** — não contém sobretormento real. | `lib/rate-limit.ts:6,9` ✅ |

---

## 3.6 Realtime: conexões e canais por loja/plano

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3C-001** | **CRÍTICO** | Novo | **Não existe camada de realtime**: zero `supabase.channel`, zero `postgres_changes`, zero socket.io/SSE/presence em `src/**`. O único uso do Supabase é Storage. **Todo "tempo real" do produto é HTTP polling** — e nenhum push/fan-out dispara quando um pedido é criado (`sendPush` só roda em PATCH de status e em mensagens). | `lib/supabase.ts:5-6` ✅; grep `channel(`/`postgres_changes` = 0 ✅ |
| **F3D-009** | — | — | *unificado em F3C-001* | — |
| **F3C-006** | **ALTO** | Novo | Inventário de timers por loja: **KDS 5 s, chat 5 s, caixa 10 s, staff 10 s, motoboy 10 s, mesa 10 s, caixa-gerencial 15 s, cardápio 15 s, painel 30 s, entregas 30 s, tracking 10/30 s, config 3 s → até 12 loops simultâneos** por estabelecimento, **nenhum pausa com aba oculta** (`visibilitychange` só existe no cardápio, 1 ocorrência real). Ordem de grandeza: **2.500–4.000 req/h por loja** com 3–4 telas abertas. | `kds/.../screen/page.tsx:289`; `chat/page-content.tsx:201`; `caixa-page.tsx:334`; `staff-page.tsx:40`; `delivery-page.tsx:152`; `mesa-page.tsx:149`; `caixa-gerencial/page-content.tsx:91`; `menu-page.tsx:2372`; `pedidos/page-content.tsx:128`; `entregas/page-content.tsx:162`; `tracking-page.tsx:121,169`; `config/page-content.tsx:67-71`; `visibilitychange` só em `menu-page.tsx` ✅ |
| **F3A-058** | (3.6) | — | *unificado em F3C-006* | — |
| **F3B-020** | (3.6) | — | *unificado em F3C-006* | — |
| **F3C-007** | MÉDIO | Rep. F5D-002 | KDS exibe "Modo Serviço: Ativo" com **ponto verde fixo**, sem checagem de conexão: falha de rede no poll vira `console.error` silencioso — o operador acha que a tela está viva. | `kds/.../screen/page.tsx:130-131,339-341` |
| **F3C-037** | ALTO | Rep. F5D-010 | KDS **sem fila local, sem retry, sem backoff**: falha no poll **e** falha no PATCH de status são engolidas — ação do operador perdida silenciosamente durante queda de rede. | `kds/.../screen/page.tsx:130-131,137-149` |
| **F3C-038** | MÉDIO | Rep. F5D-023 | PDV: único estado resiliente é carrinho/mesas em `localStorage`; **sem fila de pedidos offline** (único retry do repo é refresh de JWT e catálogo iFood) — POST falho = venda devolvida ao carrinho com `alert`. | `caixa-page.tsx:292-300,849-855`; grep `retry\|backoff\|offline\|navigator.onLine` = só `fetch-auth.ts:85-93` e `ifood-catalog-write.ts:5` |

---

## 3.7 Polling desnecessário, re-renders e requisições duplicadas

### N+1 de HTTP (o pior multiplicador do projeto)

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3A-021** | **CRÍTICO** | Rep. F2-013 | **Chat do dashboard: a cada 5 s busca todos os pedidos e depois UMA requisição por pedido, serial** (sem janela de datas, sem `take`). N=50 pedidos elegíveis → 51 requests × 12/min = **36.720 req/h só desta aba**, cada uma = 1 função + middleware + 2 queries, e `OrderMessage` **sem índice** (seq scan). | `chat/page-content.tsx:84-86,117-130,199-203` ✅ |
| **F3B-005** | (3.7) | — | *unificado em F3A-021* | — |
| **F3C-009** | (3.7) | — | *unificado em F3A-021* | — |
| **F3D-018** | (3.7) | — | *unificado em F3A-021* | — |
| **F3B-001** | **CRÍTICO** | Rep. F5D-003 | **KDS: poll de `/api/orders` a cada 5 s** (720 req/h por tela) **e, a cada tick, busca as mensagens de TODOS os pedidos em loop serial** — 5 pedidos ativos ≈ 4.320 req/h de uma tela de cozinha. | `kds/.../screen/page.tsx:104-132,169-178,289` ✅ |
| **F3A-022** | (3.7) | — | *unificado em F3B-001* | — |
| **F3C-003** | (3.7) | — | *unificado em F3B-001* | — |
| **F3B-003** | **ALTO** | Novo | Painel de Pedidos: **cada `OrderCard` monta um polling individual de mensagens de 30 s** → N requisições/30 s + N `setState` no pai re-renderizando a lista inteira (50 pedidos = 50 GETs/30 s + 50 re-renders). | `pedidos/page-content.tsx:548,671-680,717-719` |

### Cadeias de sincronização e duplicação

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3B-004** | **ALTO** | Novo | Cada tick de 30 s do painel dispara **em cascata serial**: `POST ifood-poll` (sync externo iFood no servidor) → `GET poll-99` → `GET /api/orders` → (condicional) `POST payments/sync` — um iFood lento atrasa a lista de pedidos. E o `syncInterval` tem `orders` nas dependências, sendo **destruído/recriado a cada poll** (período efetivo imprevisível). | `pedidos/page-content.tsx:103-124,128,139-151` ✅ |
| **F3C-004** | (3.7) | — | *unificado em F3B-004* | — |
| **F3C-025** | MÉDIO | Novo | **2 timers independentes de 30 s para `payments/sync`** (um dentro do `loadOrders`, outro no `syncInterval`) — até 2 syncs externos por ciclo para o mesmo trabalho. | `pedidos/page-content.tsx:123,141-149` ✅ |
| **F3A-055** | **ALTO** | Novo | Cardápio: o tick de 15 s faz **DUAS chamadas idênticas** a `/api/orders/customer` (`loadCustomerOrders` + fetch direto), ambas com cache-buster `_=${Date.now()}` e ambas rodando o `updateMany` de expiração. | `menu-page.tsx:2336-2372` ✅ |
| **F3B-014** | (3.7) | — | *unificado em F3A-055* | — |
| **F3C-026** | (3.7) | — | *unificado em F3A-055* | — |
| **F3A-054** | **CRÍTICO** | Novo | Cardápio: enquanto o **modal de verificação OTP está aberto, poll a cada 2 SEGUNDOS** (1.800 req/h por visitante) em `/api/customers`, que faz `findFirst` + `aggregate` sobre `Order.customerId` — coluna **sem índice** → seq scan da tabela `Order` de **todos os tenants** a cada 2 s. Pior densidade de carga por usuário do projeto. | `menu-page.tsx:2565,2585-2590` ✅; `customers/route.ts:33-48`; `schema.prisma:502-508` (sem `customerId`) |
| **F3A-056** | **ALTO** | Novo | Tela de pagamento do cardápio mantém **3 loops concorrentes**: tracking 10 s + mensagens 10 s + **`payment-status` a cada 3 s** (que faz `findUnique` do pedido e **até 2 chamadas externas ao gateway** por tick). | `menu-page.tsx:2218-2278,6820-6836`; `payment-status/route.ts:24,75,104-112` |
| **F3B-016** | (3.7) | — | *unificado em F3A-054/056* (inventário de ≥5 intervalos no cardápio) | — |
| **F3C-027** | (3.7) | — | *unificado em F3A-056* (dois loops de 3 s para o mesmo pedido) | — |
| **F3A-057** | ALTO | Novo | Caixa gerencial baixa **todos** os pedidos do tenant a cada 15 s e filtra o período **no cliente** — mais um consumidor persistente do endpoint mais caro. | `caixa-gerencial/page-content.tsx:76-91` ✅ |
| **F3B-024** | MÉDIO | Novo | Home do dashboard dispara `payments/sync` em **todo mount** da tela, com retry duplo embutido — mesmo trabalho do sync periódico do painel de pedidos. | `home/page-content.tsx:27-44` |

### Re-renders, estado e efeitos

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3B-002** | MÉDIO | Rep. F5D-012 | KDS re-renderiza o **kanban inteiro a cada 1 s** (tick de cronômetro em `setState`, com `deps [orders]` → o efeito é recriado a cada poll) e faz `JSON.parse(order.items)` **no render de cada card**. | `kds/.../screen/page.tsx:293-306,430,308-311` |
| **F3C-029** | (3.7) | — | *unificado em F3B-002* | — |
| **F3C-024** | (3.10) | — | ver PDV | — |
| **F3B-009** | MÉDIO | Novo | Layout do dashboard **re-busca `/api/establishments?id=` (cardápio inteiro) a cada navegação interna** (effect com `deps [router, pathname]`) e `setUser` com objeto novo → re-render de toda a árvore. | `dashboard/(auth)/layout.tsx:74-108` |
| **F3B-015** | MÉDIO | Novo | `ProductCard` **sem `React.memo`** com callbacks inline por produto; `sortedCategories`/`filteredProducts` recalculados a cada render; scroll-spy chama `setState` durante o scroll → cada micro-interação re-renderiza todo o catálogo. | `menu-page.tsx:989-1016,1051-1062,3310,3317,3342,7261` |
| **F3B-021** | BAIXO | Novo | Modal "Meus Pedidos": intervalo de chat de 10 s com `deps [chatOpen, orders, …]` é **destruído/recriado a cada poll de 15 s** do menu — cronômetro resetado continuamente. | `components/orders-screen.tsx:181-188` |
| **F3B-022** | BAIXO | Novo | `ToastProvider` cria o objeto de contexto **novo a cada render** (sem `useMemo`) → cada toast re-renderiza todos os consumidores da página monolítica. | `components/toast.tsx:62` |
| **F3B-023** | BAIXO | Novo | `key` por **índice** nas listas de itens do KDS, do painel e do tracking — reordenação remonta nós e perde estado local (checkbox de item pronto). | `kds/.../screen/page.tsx:542`; `pedidos/page-content.tsx:1009`; `tracking-page.tsx:291` |
| **F3C-030** | BAIXO | Novo | `window.location.reload()` global após sincronizar 1 pagamento — recarrega o app inteiro em vez do item. | `pedidos/page-content.tsx:949` |

---

## 3.8 Imagens: otimização, formatos, CDN, tamanhos

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3D-010** | **CRÍTICO** | Rep. F2-018 | **Fotos de produto são gravadas em base64 DENTRO do Postgres** (`Product.image` é `String?`): o cliente comprime para 600 px/JPEG q0.7 (correto), mas o servidor faz `Buffer.from(bytes).toString("base64")` e persiste data-URI — cada SELECT de cardápio lê megabytes; `db size`, backup e PITR crescem com fotos. | `products/[id]/route.ts:62-65` ✅; `schema.prisma:340`; compressão client `cardapio/page-content.tsx:3230-3241` |
| **F3D-013** | **CRÍTICO** | Novo | Consequência direta: o SSR do cardápio **serializa todas as fotos dentro do HTML** (`<MenuPage establishment={rest}/>`), estimativa **~3,6 MB de HTML por visita** (60 produtos × ~60 KB). `/[slug]` não é ISR, então é 3,6 MB × pageviews, batendo no egress da Vercel. | `[slug]/page.tsx:64-74,118`; `.next/prerender-manifest.json` |
| **F3D-004** | **ALTO** | Rep. F6-008 | `images.remotePatterns` com `hostname: "**"` (qualquer host https) e **zero usos de `next/image`** no app inteiro (grep = 0) — o otimizador fica exposto e ninguém usa; saem **97 `<img>` cru**, só 15 com `loading="lazy"`. | `next.config.js:9-13` ✅; grep `next/image` = 0 ✅; `.next/images-manifest.json` |
| **F3B-017** | (3.8) | — | *unificado em F3D-004* | — |
| **F3D-011** | MÉDIO | Novo | **O caminho certo existe e está morto**: `/api/upload` + `compressAndUploadImage` (WebP 1200 px q80 → bucket `images` com `cacheControl: "31536000"`) não tem **nenhum chamador** no repo (grep = 0). Único uso real de Storage é o import iFood (até 5 MB/ item, **sem `cacheControl`**). | `api/upload/route.ts:25`; `lib/image-upload.ts:46-77`; chamadores = 0 ✅; `ifood-catalog/import/route.ts:99-111` |
| **F3D-012** | **ALTO** | Novo | **Logo/capa/`confirmationImage` entram sem nenhuma compressão client-side** (`FileReader.readAsDataURL` direto) e são persistidas porque estão em `SAFE_FIELDS` — o `/api/icon` confirma em produção: "Data URI base64 (logo enviada sem upload)". | `cardapio/page-content.tsx:2543-2545`; `establishments/[id]/route.ts:38`; `icon/[slug]/route.ts:27` |
| **F3D-014** | BAIXO | Novo | `/public` = 3,7 MB, sendo **~3,2 MB órfãos** (`pedido.png` 1,55 MB, `Fotos/` 1,7 MB — grep em `src/` = 0) e o `og-default.png` referenciado no metadata **não existe**. | `public/pedido.png`; `[slug]/page.tsx:37` |

---

## 3.9 Listas longas: virtualização e paginação

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3A-001** | (3.1) | — | *a base do problema — ver 3.1* | — |
| **F3B-006** | **ALTO** | Rep. F1A-041 | **Nenhuma tela pagina**: KDS, chat, caixa, pedidos, entregas e caixa-gerencial consomem a lista completa e **filtram/iteram no cliente**; **zero virtualização** (nenhuma react-window/virtuoso no `package.json`) e nenhuma tela usa `since`/delta — todo tick substitui a lista inteira (`setOrders(data)`). | `kds/.../screen/page.tsx:110,125`; `pedidos/page-content.tsx:112-114`; `caixa-page.tsx:363,367-368`; `entregas/page-content.tsx:154-157`; `package.json:24-42` |
| **F3C-013** | (3.9) | — | *unificado em F3A-001 + F3B-006* | — |
| **F3C-028** | (3.9) | — | *unificado em F3B-006* | — |
| **F3D-019** | (3.9) | — | *unificado em F3A-001* | — |
| **F3A-010** | (3.1) | — | *relatórios: período filtrado no cliente* | — |

---

## 3.10 PDV rápido: tempo de lançar um pedido e hardware modesto

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3C-019** | **ALTO** | Novo | **1 venda balcão = 7–8 requisições HTTP**: `POST /api/orders` + `POST movements` + **5 refetches completos** (produtos, pedidos, caixa, usuários, estabelecimento) — refetch redundante de `products`/`users`/`establishments` que não mudam com a venda. | `caixa-page.tsx:832-846,859-868,938,386-397` ✅ |
| **F3C-020** | ALTO | Novo | O caixa é **bloqueado até a resposta completa + 2,5 s de diálogo modal** de sucesso (`closing=true` antes do POST, só libera no `finally` + `setTimeout(2500)`) — próxima venda fisicamente impossível; fila implícita de 1 item. | `caixa-page.tsx:796,832,931-943`; `confirm-dialog.tsx:50-64` |
| **F3B-007** | ALTO | Rep. F5B-034 | PDV busca a lista completa de pedidos + payment-request **a cada 10 s**, e o **relógio de 10 s re-renderiza o POS inteiro** (página de **3.088 linhas com 65 `useState`**) — incluindo grade de produtos e mesas, mesmo ocioso. | `caixa-page.tsx:65,306-318,334-336,360-384,386-397` ✅ |
| **F3C-024** | (3.10) | — | *unificado em F3B-007* | — |
| **F3B-008** | MÉDIO | Novo | O PDV grava o **estado completo de mesas/carrinho em `localStorage` (JSON.stringify síncrono) a cada mudança de carrinho** — bloqueia a thread no momento da digitação; e gera QR codes de todas as mesas em loop sequencial (`QRCode.toDataURL`) na abertura e a cada evento `storage`. | `caixa-page.tsx:292-300,338-341,451-455` ✅ |
| **F3C-023** | MÉDIO | Novo | Cada venda dispara evento `storage` e **qualquer outra aba de caixa refaz os 5 endpoints completos** → N abas = 5×N requisições por venda. | `caixa-page.tsx:338-343,902` |
| **F3C-021** | MÉDIO | Novo | Travas de double-submit incompletas: o botão "Confirmar" do diálogo **não tem `disabled`** e `finalizeSale` não checa `closing` — clique duplo rápido pode disparar `executeSale` 2× (depende de timing de React). | `confirm-dialog.tsx:88-94`; `caixa-page.tsx:762-763,1572` |
| **F3C-018** | (3.10) | — | **Positivo:** pré-carregamento de 5 endpoints em paralelo na abertura (`:386-397`) — mas os mesmos 5 são re-executados após cada venda | — |
| **F3C-022** | (3.10) | — | **Positivo:** otimismo bem usado (pedido temporário antes do POST, rollback em erro) — mas sem reenvio automático | — |

---

## 3.11 Horário de pico: o que quebra primeiro com 10× o uso atual?

Ordem de quebra derivada do código (**sem medição — projeção estática**):

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **1º** | — | — | **Conexões Postgres** — `PrismaClient` sem singleton em produção (F3A-033) × instâncias concorrentes; o código já trata `P1001`/"pool" (limiar já vivido). Não depende de nº de lojas, depende de concorrência. | `lib/prisma.ts:16-20`; `dashboard/route.ts:12` |
| **2º** | — | — | **Seq scans sem índice** nas tabelas do caminho quente: **21 de 47 modelos sem nenhum `@@index`/`@@unique`**, incluindo `Category`, `Product`, `OrderMessage`, `StockItem`, `User`, `DeliveryPerson` (e `Order.customerId` sem índice — F3A-054). Contraste: `Order` tem 7 índices compostos — **o padrão existe, só não foi aplicado nas tabelas novas.** | `schema.prisma:319,335,774,548,647,303` ✅ (contagem por script) |
| **F3A-061** | **CRÍTICO** | Novo | *(é a evidência acima)* — refino de F3A-035/F3D-020 | `schema.prisma:502-508` vs `:319,335,548,774,623,635,736,692,303` |
| **3º** | — | — | **N+1 do chat + `findMany` sem `take`** (F3A-021 + F3A-001) — estoura duração de função (sem `maxDuration`) e payload. | — |
| **4º** | — | — | **Egress da Vercel** — HTML do cardápio com base64 embutido (F3D-013), ~3,6 MB/visita × pageviews. | — |
| **5º** | — | — | **Cron `sync-ifood-status` sequencial** (F3D-003) — começa a estourar timeout por volta de dezenas de lojas iFood; erros engolidos por loja. | — |
| **6º** | — | — | **Tamanho do banco Supabase** — base64 das fotos no Postgres (F3D-010), só depois de ~50–100 lojas. | — |

---

## 3.12 Filas e jobs para tarefas pesadas

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3D-015** | **ALTO** | Novo | **Não existe fila nenhuma**: zero inngest/bullmq/trigger.dev/pg-boss/`waitUntil`/`after()` (grep = 0 em código e lockfile). IA do WhatsApp, push em lote, sync de pagamento e expiração de pedidos rodam **dentro do request**. | `package.json:24-42`; `webhooks/whatsapp/route.ts:442-458`; `push.ts:104-118` |
| **F3A-048** | ALTO | Rep. F1A-030 | Webhook do WhatsApp chama a **OpenAI (até 3 iterações de tool-calling)** e depois **a própria API por HTTP** (`/api/bot/create-order`) — duas funções serverless ocupadas em cascata, síncronas, sem timeout, por mensagem de cliente. | `webhooks/whatsapp/route.ts:442-458`; `lib/whatsapp/ai/openai.ts:107-145` |
| **F3A-049** | MÉDIO | Novo | `bot/create-order` consome `/api/orders` **via HTTP** em vez de função interna — duplica rede, serialização e cold start por pedido do WhatsApp. | `bot/create-order/route.ts:152` → `orders/route.ts:72` |
| **F3A-050** | ALTO | Novo | `POST /api/push` executa **`CREATE TABLE IF NOT EXISTS` a cada gravação** — DDL em rota de alta frequência toma lock de catálogo e bloqueia leituras concorrentes por instantes. | `push/route.ts:18-28` |
| **F3A-039** | **ALTO** | Rep. F5C-012 | `payments/sync` varre **todos os pedidos não pagos dos últimos 7 dias** e faz **1 chamada externa ao gateway por pedido, serial**, sem timeout — e é disparado **até 2× por ciclo de 30 s** pelo navegador. 50 pendentes → até 12.000 chamadas externas/h potenciais. | `payments/sync/route.ts:157-165,181-218` ✅; gatilhos `pedidos/page-content.tsx:123,147` ✅ |
| **F3C-033** | (3.12) | — | *unificado em F3A-039* | — |
| **F3A-040** | **ALTO** | Rep. F5C-012 | `POST /api/orders/ifood-poll` (chamado a cada 30 s pelo painel) **varre TODOS os tenants iFood** em loop serial com auth + 2 HTTP externos por loja — **amplificação quadrática**: 10 painéis abertos × 10 lojas = 13.200 chamadas/h à API iFood. | `ifood-poll/route.ts:12-34,41,161,181` ✅; gatilho `pedidos/page-content.tsx:104,128` ✅ |
| **F3C-031** | (3.12) | — | *unificado em F3A-040* | — |
| **F3A-041** | ALTO | Rep. F5C-012 | `GET /api/delivery/poll-99` **não filtra por tenant** (cada loja paga pelo custo das corridas das outras) e consulta a 99 por corrida em loop serial. | `delivery/poll-99/route.ts:13-26,30-39,54-62` |
| **F3C-032** | (3.12) | — | *unificado em F3A-041* | — |
| **F3D-017** | MÉDIO | Novo | **`/api/delivery/poll-99` está pré-renderizada estaticamente** (`initialRevalidateSeconds: false` no prerender-manifest, handler sem `req`) → o handler **nunca executa depois do build**. Meio bug, meio milagre: a rota mais cara do sync 99 está congelada. | `.next/prerender-manifest.json`; `poll-99/route.ts:11-26` |
| **F3A-052** | MÉDIO | Rep. F5A-031 | Syncs externos e PATCH do operador **escrevem na mesma linha `Order` em paralelo** (sem trava) — lost update gera retrabalho e novo poll. | `payments/sync/route.ts:208-211`; `poll-99/route.ts:54-62`; `ifood-poll/route.ts:98-101` |

---

## 3.13 Limites dos planos (Vercel/Supabase) e projeção de custo

> ⚠️ **Todo o bloco de custo é análise de premissa**: valores de plano e preços são **estimativa, confirmar** no painel da Vercel/Supabase. O que é fato de código está marcado ✅; premissa, ◽.

### Consumo real por loja (fórmula a partir do código) ✅

`req/h = (3600 / intervalo_s) × endpoints_por_tick` — com os intervalos verificados em F3C-006/F3A-054/F3A-056:

| Cenário | Composição | **req/h por loja** |
|---|---|---|
| **A — Conservador** | pedidos 30 s + KDS 5 s + caixa 10 s | **1.680** |
| **B — Realista** | A + chat N=50 (F3A-021) + caixa-gerencial + config 25% do tempo | **39.180** |
| **C — B + 10 clientes no cardápio** | + 480 req/h por cliente (F3A-055) | **43.980** |

A diferença A→B é **~25×** e vem quase toda do **N+1 do chat**. Conclusão: **a economia de custo nº 1 deste SaaS não é negociar plano, é matar o N+1.**

### Tabela 10 / 50 / 200 lojas (mensal, 12 h/dia de telas)

| Métrica | 10 lojas | 50 lojas | 200 lojas | Base |
|---|---|---|---|---|
| Chamadas API — cen. A | 6,05 M | 30,2 M | 121 M | 1.680×12×30 |
| Chamadas API — cen. B/C | 141–158 M | 705–792 M | **2,8–3,2 B** | F3A-021 domina |
| Conexões Prisma simultâneas | 15–50 (A) / 150–500 (B) | idem | idem | F3A-033 — cresce com **concorrência**, não com lojas |
| Realtime (canais) | **0** | **0** | **0** | F3C-001 |
| Armazenamento Postgres (base64) | 40–80 MB | 200–400 MB | **0,9–2,0 GB** | F3D-010 |
| Egress Vercel (HTML com fotos) | 20–60 GB | 100–300 GB | **0,4–4,3 TB** | F3D-013 |
| Cron executions | 8.700/mês | 8.700/mês | 8.700/mês | 2 agendados ✅ |

### Custo mensal — **estimativa, confirmar**

| Cenário | Vercel Hobby | Vercel Pro | Enterprise | Supabase |
|---|---|---|---|---|
| 10 lojas, A | provavelmente cabe | ~US$45–70/mês (compute) | desnecessário | Free |
| 10 lojas, B/C (~158 M invoc.) | ❌ estoura | ~US$1.200–1.500/mês | avaliar | Free/Pro |
| 50 lojas, A | ❌ | ~US$225–300/mês | não | Free (borderline) |
| 50 lojas, B/C | ❌ | ~US$6.000/mês | sim | Pro (~US$25) |
| 200 lojas, A | ❌ | ~US$900–1.500 + egress | recomendado | Pro |
| 200 lojas, B/C (2,8–3,2 B invoc.) | ❌ | **US$20–25 mil/mês** (ordem de grandeza) | **obrigatório** | Pro |

**Premissas ◽ (todas a confirmar):** preços Vercel (Hobby ~US$0/100 GB-h/100 GB; Pro ~US$20/usuário + ~US$0,18/GB-h + ~US$0,15/GB egress) e Supabase (Free 500 MB DB; Pro ~US$25/8 GB); 150 ms e 1 GB por invocação; `connection_limit` default 5; 60 produtos × 60 KB; 200 vistas/dia; N=50 no chat. **Custo extra confirmável no repo:** servidor WhatsApp (Railway/VPS) previsto em `docs/WHATSAPP_BOT.md:110-116` (R$25–200+/mês) + tokens OpenAI por uso.

---

## 3.14 Latência ponta a ponta: pedido criado → KDS (meta < 2 s)

**Caminho real no código** ✅:

1. `POST /api/orders` — cadeia serial no servidor: `findUnique` da loja (`:83`) → transação com ~5 round-trips (`:408-455`) → CMV com N `findMany` (`:461`) → 2 chamadas externas (gateway/QR) → re-fetch do pedido (`:678-683`).
2. **Nada mais acontece**: não há fan-out (F3C-001), `sendPush` não roda no POST.
3. O KDS só "descobre" o pedido no **próximo tick de 5 s** (`kds/.../screen/page.tsx:289` ✅) e então refaz a lista completa + N chamadas de mensagens serial.

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F3C-011** | **CRÍTICO** | Novo | **p50 ≈ 2,5 s, p95 ≈ 5 s + duração do GET** (derivado do código, não medido): a meta < 2 s **não é garantida por construção** — o pior caso balcão/mesa passa 5 s só esperando o tick. | `kds/.../screen/page.tsx:289` ✅; `orders/route.ts:83,408-455,461,678-683` ✅ |
| **F3C-014** | **ALTO** | Novo | Pior para pagamento online: pedidos ficam **invisíveis ao KDS até `paymentStatus="paid"`** (`orders/route.ts:727-746`), e quem pode confirmar cedo é o **poll de 3 s do próprio cliente** → +3 s (poll) +5 s (tick) no caminho para o fluxo PIX/cartão. | `orders/route.ts:727-746`; `menu-page.tsx:2743-2767` |
| **F3C-015** | **ALTO** | Rep. F5C-027 | Pedido iFood só é descoberto quando o **painel de Pedidos está aberto** (único chamador do `ifood-poll`, a cada 30 s) → latência iFood→KDS de até 30 s; **sem painel aberto, nenhum pedido iFood entra.** | `pedidos/page-content.tsx:104,128` ✅; `ifood-poll/route.ts:12` |
| **F3C-016** | ALTO | Rep. F5A-046 | Caminho inverso (KDS muda status → PATCH) **bloqueia a resposta** em envio de WhatsApp (`await sendText`), push e `pushLog.create` antes de retornar — ação do operadora 2–5+ s (com delay aleatório de F3A-046). | `orders/[id]/route.ts:457-462,504-523` |
| **F3A-047** | ALTO | Rep. F6-002 | `POST /api/orders` é uma **cadeia serial com dois `aggregate` idênticos** (~15 round-trips + 2 externas + download de QR em base64) no pior momento possível (pico de pedidos). | `orders/route.ts:83,193,231,276-284,306-314,410-414,461,553,632-636,678` |
| **F3C-017** | (3.3) | — | o `revalidate = 5` que "reduces DB load" não se realiza (no-store) | — |

---

## O que está bom

1. **Pré-carregamento do caixa**: 5 endpoints em paralelo na abertura da tela (`caixa-page.tsx:386-397` ✅) — pensado para o hardware modesto do PDV.
2. **Otimismo no PDV**: pedido temporário inserido antes do POST, com rollback em erro (`caixa-page.tsx:812-855`) — boa percepção de latência.
3. **Gráficos em SVG à mão** (nenhuma lib de charts no bundle) e `optimizePackageImports` do lucide configurado — dieta de dependências correta (`components/charts/*.tsx`; `next.config.js:7`).
4. **Compressão client-side de fotos de produto** (600 px, JPEG q0.7) já existe (`cardapio/page-content.tsx:3230-3241`) — falta só mover o destino para o Storage.
5. **`Order` tem 7 índices compostos** e `Customer` tem `@@unique([establishmentId, phone])` — o padrão de indexação **existe no projeto**, só não foi aplicado às tabelas novas (`schema.prisma:502-508`).

## Não verificado / fora do alcance deste repositório

- **Latência real (p50/p95), QPS e bundle de runtime**: nenhuma medição executada (sem APM, sem `next build --profile`, sem Lighthouse); todos os valores são derivados de código/manifest.
- **`EXPLAIN`/tamanho real das tabelas** e se os `@@index` do schema existem **na base de produção** (o projeto usa `db push`; migrations não contêm `CREATE INDEX`).
- **Plano atual da Vercel/Supabase**, valores de `DATABASE_URL`/`DIRECT_URL` (pooler vs direta, `connection_limit`) — **só nomes de variáveis foram observados**; a projeção de custo é premissa.
- **Configurações do painel** (memória, maxDuration, regions, concurrency) definidas fora do repo.
- Se `/api/orders/ifood-poll`, `/api/delivery/poll-99` e `/api/check-orders` são chamados por **sistemas externos** (nenhum chamador no repo).
- **Comportamento de rede real do KDS/PDV** (queda de Wi-Fi, 10 h de tela) — só análise estática; os backups `menu-page.tsx.bak*` (~28 mil linhas) não entram no build e não foram auditados.

## Prioridades desta fase (Top 5)

1. **Consertar o `GET /api/orders`**: `take` + janela de data + filtro de status obrigatório, `select` enxuto, e **mover a expiração de `abandoned` para o cron `expire-orders`** (hoje vazio) — derruba payload, escrita-por-leitura e é pré-requisito de tudo (F3A-001/002/003 + F3D-002).
2. **Matar os N+1 de HTTP**: endpoint de **mensagens em lote** (`?ids=a,b,c`) para chat (F3A-021, 36 mil req/h) e KDS (F3B-001); e parar o polling por `OrderCard` (F3B-003).
3. **Realtime no lugar de polling** — o Supabase já está no projeto: `postgres_changes` no KDS/painel/caixa reduz 5–30 s de polling para fan-out; no mínimo, **pausar todos os timers com `visibilitychange`** e implementar `since`/delta (F3C-001/006/028).
4. **Imagens para o Storage**: ligar o `/api/upload` que já existe (WebP + `cacheControl`), tirar base64 do Postgres e do HTML, e usar `next/image` com `remotePatterns` restrito (F3D-010/011/012/004/F3D-013).
5. **Plano de execução do banco**: `PrismaClient` singleton em produção (F3A-033) + `@@index` em `Category`, `Product`, `OrderMessage`, `StockItem`, `User`, `DeliveryPerson` e `Order(customerId)` (F3A-061) + `maxDuration`/timeout em todas as chamadas externas (F3D-001/F3A-044).

## Duplicados removidos nesta fase

| Descartado | Unificado em |
|---|---|
| F3C-012, F3D-016, F3C-013, F3D-019 | F3A-001 (sem take) e F3A-002 (updateMany no GET) |
| F3B-006, F3C-028 | F3A-001 + lista sem paginação |
| F3B-005, F3C-009, F3D-018 | F3A-021 (N+1 chat) |
| F3A-022, F3C-003 | F3B-001 (N+1 KDS + poll 5 s) |
| F3D-008 | F3A-033 (Prisma sem singleton) |
| F3D-007 | F3A-034 (pooling NÃO VERIFICADO) |
| F3D-020, F3A-035 | F3A-061 (índices) |
| F3A-037 | F3D-001 (vercel.json mínimo) |
| F3A-038, F3A-059 | F3D-002 (crons mortos) |
| F3A-042, F3C-035 | F3D-003 (sync-ifood sequencial) |
| F3C-031 | F3A-040 (ifood-poll varre todos os tenants) |
| F3C-032 | F3A-041 (poll-99 sem tenant) |
| F3C-033 | F3A-039 (payments/sync serial) |
| F3B-014, F3C-026, F3D-025(parcial) | F3A-055 (duplo poll 15 s do cardápio) |
| F3B-016, F3C-027, F3A-056(parcial) | F3A-054/F3A-056 (inventário de timers do cardápio) |
| F3A-058, F3B-020 | F3C-006 (inventário de 12 timers) |
| F3B-005 já acima; F3D-009 | F3C-001 (zero realtime) |
| F3B-017 | F3D-004 (next/image nunca usado) |
| F3B-013 | F3A-024 (SSR do cardápio) |
| F3C-017 | F3A-028 (revalidate morto) |
| F3C-029 | F3B-002 (cronômetros do KDS) |
| F3C-024 | F3B-007 (relógio re-renderiza o PDV) |
| F3D-025(parcial) | F3A-055 + F3A-056 |

## Pendências da Fase 3 para o responsável

1. **`GET /api/orders`**: exigir `take` (default 50) + `status` + janela `since`, enxugar `include` para `select`, e migrar a expiração de pedidos para `cron/expire-orders` (diretório hoje vazio) — remove escrita por leitura em 9 telas.
2. **Endpoint em lote de mensagens** (`GET /api/orders/messages?ids=`) e matar o polling por `OrderCard` — derruba o maior multiplicador do sistema (chat 36 mil req/h em N=50).
3. **`PrismaClient` singleton em produção** (guardar sempre em `globalThis`) + `@@index` nas 6 tabelas quentes + `Order(customerId)`; confirmar com o DBA se os índices do schema existem em produção (`db push`).
4. **Realtime Supabase** para KDS/painel (pedido novo → evento) ou, no mínimo, `visibilitychange` + delta/`since` em todos os 12 timers; eliminar o duplo poll de 15 s e o poll de 2 s do modal OTP.
5. **Imagens**: ativar `/api/upload` + bucket `images` (WebP, `cacheControl`), migrar `Product.image`/`logo` para URL, restringir `remotePatterns` e adotar `next/image`.
6. **Funções**: declarar `maxDuration` e região, adicionar `timeout` em todas as chamadas externas (iFood/99/Inter/gateway), tirar `CREATE TABLE` do `POST /api/push` e desacoplar o webhook do WhatsApp (fila/`waitUntil`) em vez de cascata OpenAI→HTTP próprio.
7. **Crons**: agendar `sync-payments` e `meta-quota` (ou apagar as rotas mortas), corrigir a frequência do `verify-reminder`, e fazer o `sync-ifood-status` processar por lote com checkpoint em vez de loop global serial.
8. **Orçamento**: refazer a projeção de custo com números reais (plano atual, nº de lojas, pageviews) antes de escalar — o cenário B (hoje) joga US$ milhares/mês de diferença vs. o cenário A.
9. **Executar `auditoria/testes/3-01-desempenho-estatico.sh`** (estático, seguro) para revalidar os achados após correções; medições de latência/bundle (Lighthouse, APM, `EXPLAIN`) ficam pendentes de ambiente de teste.
