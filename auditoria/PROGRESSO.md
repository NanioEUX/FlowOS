# PROGRESSO DA AUDITORIA — SaaS Food

Arquivo de comando do agente: `AUDITORIA-SAAS-FOOD.txt` · Regras vigentes: seção 2.

| Fase | Data | Arquivo(s) | Status | Achados (C/A/M/B) | Limitações |
|---|---|---|---|---|---|
| **0 — Mapeamento e qualidade** | 08/10/2026 | `00-inventario.md`, `00-arquitetura.md`, `00-qualidade.md`, `00-er-completo.mmd` | **CONCLUÍDA** | 0 / 5 / 7 / 4 (16 em `00-qualidade.md`; inventário e arquitetura registram achados estruturais sem ID, remetidos às fases seguintes) | 8 das 11 entradas da seção 3 ausentes; stack divergente (Prisma+JWT, não Supabase Auth/RLS); `gitleaks` indisponível; nenhum teste dinâmico executado |
| **1 — Segurança e LGPD** | 08/10/2026 | `01-seguranca.md` + `01-seguranca-1a.md` (F1A-001…022), `01-seguranca-1b.md` (F1B-001…012 + `testes/1b-0*.sh`), `01-seguranca-1c.md` (F1C-001…021 / 101…124 / 201…213), `01-seguranca-1d.md` (F1D-001…029) | **CONCLUÍDA** | 19 / 41 / 51 / 9 + 1 INFO (121 itens, ≈113 únicos) | **Nenhum teste dinâmico** (1B escrito e não executado); `gitleaks`/`trufflehog` ausentes (varredura manual); banco = produção; dump, planos, status de integrações e lojas de teste seguem ausentes |
| **2 — Banco e integridade** | 08/10/2026 | `02-banco.md` + `testes/2-01…04.sh` | **CONCLUÍDA** | 1 / 9 / 9 / 3 (22) | **Nenhum EXPLAIN, nenhum tamanho de tabela, nenhum `migrate status`** (sem ambiente de banco de teste — `DATABASE_URL` = produção); backups/PITR e RLS fora do alcance do repositório |
| **3 — Desempenho** | 09/10/2026 | `03-desempenho.md` (F3A-001…061 / F3B-001…024 / F3C-001…040 / F3D-001…025 → **106 únicos**) + `testes/3-01-desempenho-estatico.sh` | **CONCLUÍDA** | 10 / 43 / 39 / 8 (106; **73 novos** + 33 repetições de Fases 0/1/2/6/7, marcadas `Rep.`) | **Nenhuma medição executada** (sem APM, sem `EXPLAIN`, sem `next build` novo, banco = produção); projeção de custo 10/50/200 lojas é **premissa, confirmar** (preços de plano não verificados); valores de `DATABASE_URL`/plano atuais não lidos. `3-01` (estático) **executado: 30/30 CONFIRMADO** |
| **4 — Confiabilidade** | 09/10/2026 | `04-confiabilidade.md` (F4A-001…027 / F4B-001…043 / F4C-001…039 / F4D-001…025 → **103 únicos**) + `testes/4-01-confiabilidade-estatico.sh` | **CONCLUÍDA** | 15 / 58 / 24 / 6 (103; **58 novos** + 45 repetições de Fases 0/1/2/5/6/7, marcadas `Rep.`) | **Nenhum teste dinâmico** (sem ambiente; banco = produção). Estado real da Vercel/Supabase (plano, crons agendados no painel, backups/PITR, RLS, logs) e dono/SLO da Evolution/Storage **fora do repo**. `4-01` (estático) **executado: 57/57 CONFIRMADO** |
| **5 — Regras de negócio** | 09/10/2026 | `05-negocio.md` (F5A-001…044 / F5B-001…041 / F5C-001…045 / F5D-001…025 → **131 únicos**) + `testes/5-01…02.sh` | **CONCLUÍDA** | 25 / 52 / 47 / 7 (131; **78 novos** + 53 repetições de Fases 0/1/2/6/7, marcadas `Rep.`) | **Nenhum teste dinâmico** — `5-01` tem `obtido = NÃO EXECUTADO` (é destrutivo: cria pedidos e disputa estoque); `5-02` (estático) **executado: 33/33 CONFIRMADO**. Doc oficial iFood/99, homologação, rate limit dos marketplaces, fechamento mensal/imutabilidade e conciliação de repasses **fora do alcance do repo** |
| **6 — Cardápio público** | 08/10/2026 | `06-cardapio-publico.md` (F6A-001…047 / F6B-001…030) + `testes/6-01…05` | **CONCLUÍDA** | 18 / 18 / 25 / 15 (76; **47 novos** + 29 repetições de Fases 0/1/2, marcadas `Rep.`) | **Nenhum teste dinâmico** — os 4 scripts e o roteiro manual têm `obtido = NÃO EXECUTADO`; `6-02` é destrutivo (só ambiente de teste); headers/CSP e buckets do Storage fora do repo; LCP/CLS em 4G não medidos |
| **7 — Login OTP** | 08/10/2026 | `07-login-otp.md` (F7A-001…023 / F7B-001…023 → **36 únicos**) + `testes/7-01…03.sh` | **CONCLUÍDA** | 10 / 12 / 9 / 5 (36; **22 novos** + 14 repetições, marcadas `Rep.`) | **Nenhum teste dinâmico** — os 3 scripts têm `obtido = NÃO EXECUTADO` (`7-01` dispara mensagens reais, só ambiente de teste); RLS/logs da Vercel/categorias dos templates Meta/behavior do deploy não verificados; coluna Supabase Auth da tabela comparativa é conhecimento geral |
| **8 — Frontend/UX/Acessibilidade** | 09/10/2026 | `08-frontend-ux.md` (F8A-001…021 / F8B-001…025 / F8C-001…027 / F8D-001…030 → **98 únicos**) + `testes/8-01-frontend-ux-estatico.sh` | **CONCLUÍDA** | 7 / 31 / 40 / 20 (98; **74 novos** + 24 repetições de Fases 1/4/5/6/7, marcadas `Rep.`) | **Nenhum teste dinâmico** (nenhuma resolução real renderizada; geometrias do PDV são cálculo de CSS — confirmar em dispositivo). Contrastes são **estimativas** por valores Tailwind padrão (validar com axe/Lighthouse). `8-01` (estático) **executado: 40/40 CONFIRMADO** |
| **9 — Produto/jurídico** | 10/10/2026 | `09-produto-juridico.md` (F9A-001…009 / F9B-001…013 / F9C-001…012 / F9D-001…011 → **45 únicos**) + `testes/9-01-produto-juridico-estatico.sh` | **CONCLUÍDA** | 17 / 12 / 16 / 0 (45; **24 novos** + 21 repetições de Fases 1/4/5/6/7, marcadas `Rep.`) | **Nenhum teste dinâmico** (sem ambiente; banco = produção). Planos reais cobrados, emails transacionais, DPA/SLA fora do repo → "Não verificado". `9-01` (estático) **executado: 53/53 CONFIRMADO** |
| **10 — Consolidado** | 10/10/2026 | `RELATORIO-FINAL.md` | **CONCLUÍDA** | **254 C/A únicos** (59 CRÍT + 195 ALT) consolidados de ~746 achados; nota geral ponderada **2,3/10**; **recomendação: NO-GO**; checklist go-live **0/30 verdes** | Compilado 100% dos relatórios de fases 0-9; dedup via `Rep.` + remoção de F1C-001/F1C-101 (≡F1A-001); áreas sem nota declarada (Multi-tenant, Integrações, KDS, LGPD, geral) marcadas † como derivadas |

## Ordem de execução
0 → 1 → 2 → 6 → 7 → 5 → 3 → 4 → 8 → 9 → 10

## Pendências da Fase 0 para o responsável
1. Fornecer as 8 entradas da seção 3 que faltam (dump do banco, Advisor, planos, uso, status das integrações, fiscal, lojas de teste).
2. Instalar `gitleaks` (ou `trufflehog`) para a Fase 1C.
3. Confirmar ambiente de teste com 2 lojas para a Fase 1B.
4. Atenção: `auditoria/` **não** está no `.gitignore` (regra de somente-leitura impediu alterá-lo) — não committar esta pasta em repositório público (`github.com/NanioEUX/FlowOS`).

## Pendências da Fase 1 para o responsável
1. **ROTACIONAR segredos já tratados como comprometidos** (repo público + endpoints abertos): senhas `Admin@…` e do `prisma/dev.db`, `JWT_SECRET`, `CRON_SECRET`, `IFOOD_CLIENT_SECRET`, `META_APP_SECRET`, `ASAAS_API_KEY`, `PAGARME_API_KEY`, `INTER/EFI_CLIENT_SECRET` **+ novos certificados `.p12`**, e por loja `metaAccessToken`, `evolutionApiKey`, `asaasApiKey`, `pagarmeApiKey`, `api99Key`, `ifoodAccessToken`.
2. Executar `auditoria/testes/1b-01/02/03.sh` quando existir ambiente com 2 lojas (hoje `obtido = NÃO EXECUTADO`).
3. `git rm --cached prisma/dev.db` (+ `*.db` no `.gitignore`) e remover `Admin@…` de `prisma/seed-admin.ts:8` — a regra de somente-leitura impediu fazer isso aqui.
4. Verificar no painel: RLS/cripto em repouso do Supabase, políticas dos buckets `images`/`Imagens`, headers HSTS/CSP na Vercel, env vars reais (`JWT_SECRET`, `CRON_SECRET`, `SHOW_DEV_CODE`).

## Pendências da Fase 2 para o responsável
1. **Criar ambiente de banco de teste** (restauração ou schema separado) — sem ele não há `EXPLAIN`, nem `migrate status`, nem testes das Fases 1B/2 (`testes/2-01…04.sh` estão escritos, `obtido = NÃO EXECUTADO`).
2. **Baseline de migrations**: gerar `0_init` com `prisma migrate diff --from-empty`, resolver como aplicado no ambiente existente e proibir `db push` (F2-002).
3. **Fechar mass assignment** em `products/[id]`, `additional-options` e `stock/[id]` (F2-001, CRÍTICO) — ver também F1B-001.
4. Conferir no painel Supabase: **backups/PITR e data da última restauração testada**.
5. Decidir política de **retensão/arquivamento** das 8 tabelas que inflam (F2-017, cruza com F1D-007).

## Pendências da Fase 6 para o responsável
1. **ROTACIONAR as 32 credenciais do tenant** (`GET /api/establishments?id=`/`?slug=` sem auth,
   `saasApiKey`, `efiClientSecret`, `interCertificatePassword`, `metaAccessToken`, `evolutionApiKey`,
   `pagarmeApiKey`, `api99Key`, `ifood*`) **e o `password`** — além de `JWT_SECRET` e `DATABASE_URL`.
   Causa: `src/app/[slug]/page.tsx:86` passa `rest` (tudo menos 3 campos) como prop de client
   component → serializado no HTML; idem `pedido/[id]/page.tsx:76,89` e `orders/route.ts:680`.
2. **Fechar as 3 ações financeiras anônimas hoje**: `POST /api/pix-generate`
   (`pix-generate/route.ts:5-37`), `POST /api/delivery/dispatch-99` (`dispatch-99/route.ts:11-77`)
   e `PATCH /api/payment-request` (`payment-request/route.ts:48-83`).
3. **Recalcular o pedido no servidor** (F6B-001/002/003/004) — hoje `body.status`, `body.method`,
   preços, fidelidade, cupom e `productId` vêm do navegador.
4. **Mover `middleware.ts` para `src/`** + headers de segurança em `next.config.js` +
   substituir os 3 `document.write` das impressões (F6A-012/015/018, F6B-010).
5. **Executar `auditoria/testes/6-01…04.sh` + roteiro `6-05`** em ambiente com 2 lojas de teste
   (uma `subscriptionStatus="expired"`, uma `isOpen=false`); `6-02` cria pedidos — nunca em produção.
6. Verificar no painel: CSP/HSTS/X-Frame-Options na Vercel, políticas dos buckets `images`/`Imagens`,
   `ASAAS_WEBHOOK_TOKEN` e `pagarmeWebhookKey` preenchidos (sem eles o Pagar.me aceita webhook sem
   assinatura — `webhooks/pagarme:16-22`).

## Pendências da Fase 7 para o responsável
1. **URGENTE — o OTP é devolvido a quem pediu**: `devCode` e `verifyLink` nos 3 retornos de
   `POST /api/verification` (`route.ts:156,250-257,261-267,136`), `showDevCode` morto (`:243`),
   `Math.random` (`:99`) e `console.log` do código (`:155,260` + `whatsapp/meta.ts:100`).
   Corrigir **antes** de qualquer outra coisa desta fase.
2. **Criar sessão de cliente** (JWT em cookie `httpOnly`, emitido no `PUT` da verificação) e
   exigi-la em `orders/customer`, `addresses`, `customers` (POST/PUT) e `payment-request` — hoje
   nenhuma rota de cliente verifica identidade (F7A-004/005/006/007/015).
3. **Template de OTP com categoria `AUTHENTICATION`** (a implementação correta com `copy_code`
   existe morta em `whatsapp/meta.ts:125-167`); parar de usar `atualizacao_suporte_v1` (UTILITY)
   e de aceitar "qualquer template aprovado pt_BR" (`meta.ts:416-419`).
4. **Rate limit por IP + teto diário por loja** em `/api/verification` antes de criar o código;
   normalização única de telefone (`55` + 11/12 dígitos); remover `BYPASS_PHONES` (`route.ts:14`);
   checar cota Meta e **agendar `/api/cron/meta-quota`** no `vercel.json` (hoje só `verify-reminder`
   e `sync-ifood-status`).
5. **ATENÇÃO ao religar o middleware**: `PUBLIC_ROUTES` (`middleware.ts:10-21`) **não contém**
   `/api/verification` nem `/api/addresses` — mover para `src/middleware.ts` sem antes incluí-las
   **quebraria o login do cliente**. Acrescentar e, em paralelo, proteger as rotas com o cookie.
6. Executar `auditoria/testes/7-01…03.sh` em ambiente de teste (**`7-01` dispara mensagens reais
   via Meta — nunca contra produção/número de loja real**). RLS do Supabase e logs da Vercel
   (retenção dos `console.log`) continuam fora do alcance do repositório.

## Pendências da Fase 5 para o responsável
1. **Máquina de estados no servidor** (F5A-002, CRÍTICO): whitelist de transições por `role` em
   `PATCH /api/orders/[id]` (`:181` grava `status` direto) — hoje qualquer JWT da loja faz
   `delivered → preparing`, o token `kds` cancela (F5D-008) e o entregador escreve qualquer
   estado sem `autoConfirmPayment` (F5A-016). Inclui idempotência (F5D-020).
2. **Unificar o estorno de estoque** num único helper chamado pelos 6 caminhos que não devolvem
   (ou devolvem em dobro): falha de pagamento `order.delete` (`orders/route.ts:539`), `OVERDUE`
   (`webhooks/asaas:90` + `payments/sync:33`), `abandoned` no GET (`:706`), placeholder iFood
   (`ifood-poll:165`), cancel iFood em dobro (`ifood-poll:138`) e 99Food sem estorno.
3. **Fechar as rotas de negócio sem `verifyAuth`**: `stock`, `cash-register`, `categories`,
   `daily-combos`, `delivery-persons`, `delivery-payments`, `expenses`, `payment-request`,
   `subscription/create|webhook`, `orders/sync`, `orders/ifood-poll`, `kds/establishment`,
   `financial/*` e `dashboard` (F5A-006/007/008/024, F5B-002/004/005/006/007, F5C-001/003/004/005).
   Causa raiz e ordem de execução: pendências 6.2 e 6.4.
4. **Recalcular no servidor**: subtotal/preços (`orders/route.ts:91-98`), cupom (sem
   `usageLimit`/condição, só `timesUsed++`), taxa por zona, limites de adicionais e canal.
5. **Financeiro**: incluir CMV na DRE (`dre:87`), filtrar por `paymentStatus` (`:17`),
   `money`→`cash` (`:114`), agrupamento em fuso local (`cash-flow:33`), descomentar cupons
   (`:50`) e **corrigir o sinal da despesa** no fechamento de caixa (`expenses:210` positivo +
   `cash-register/[id]:29` soma direto → caixa superestimado).
6. **Assinatura/cobrança**: hoje não há recorrência (sem cron no `vercel.json`), o webhook é
   forjável (`subscription/webhook:4-50`) e o sandbox ativa plano sem pagamento
   (`subscription/create:37-55`) — decidir o modelo antes de vender plano.
7. **KDS**: `GET /api/orders` precisa de auth (F5D-001); tratar `res.ok` + indicador de conexão
   real + som ligado por padrão + `visibilitychange`/Notification + Wake Lock (F5D-002/003/005/010/004/015).
8. **Executar `auditoria/testes/5-01-transicoes-e-estoque.sh`** em ambiente de teste
   (não-produção) — `obtido = NÃO EXECUTADO`; é destrutivo. O estático `5-02` já rodou (33/33).
9. **Confirmar itens "Não verificado"**: fechamento mensal/imutabilidade e exportação contábil,
   conciliação de repasses de marketplace, comparação com a doc oficial iFood/99 e homologação.

## Pendências da Fase 3 para o responsável
1. **`GET /api/orders`**: exigir `take` (default 50) + `status` + janela `since`, enxugar `include` para `select` e **migrar a expiração de `abandoned` para o cron `expire-orders`** (diretório hoje vazio) — remove escrita-por-leitura em 9 telas (F3A-001/002/003 + F3D-002).
2. **Endpoint em lote de mensagens** (`GET /api/orders/messages?ids=`) e matar o polling por `OrderCard` — derruba o maior multiplicador do sistema (chat ≈36 mil req/h com N=50; KDS ≈4,3 mil req/h) (F3A-021, F3B-001/003).
3. **`PrismaClient` singleton em produção** (guardar sempre em `globalThis`) + `@@index` em `Category`, `Product`, `OrderMessage`, `StockItem`, `User`, `DeliveryPerson` e `Order(customerId)`; confirmar com o DBA se os índices do schema existem em produção (`db push`) (F3A-033/061).
4. **Realtime Supabase** para KDS/painel/caixa (pedido novo → evento) ou, no mínimo, `visibilitychange` + delta/`since` nos 12 timers; eliminar o duplo poll de 15 s do cardápio e o poll de 2 s do modal OTP (F3C-001/006, F3A-054/055).
5. **Imagens**: ativar `/api/upload` + bucket `images` (WebP, `cacheControl` — caminho pronto e morto), migrar `Product.image`/`logo` do base64 do Postgres para URL, restringir `remotePatterns` e adotar `next/image` (F3D-010/011/012/004/013).
6. **Funções**: declarar `maxDuration` e região, `timeout` em todas as chamadas externas (iFood/99/Inter/gateway), tirar `CREATE TABLE` do `POST /api/push` e desacoplar o webhook do WhatsApp (fila/`waitUntil`) em vez de cascata OpenAI→HTTP próprio (F3D-001, F3A-044/048/050, F3D-015).
7. **Crons**: agendar `sync-payments` e `meta-quota` (ou apagar as rotas mortas), corrigir a frequência do `verify-reminder` (código diz "hora em hora", agenda 1×/dia) e lotar o `sync-ifood-status` com checkpoint em vez de loop global serial (F3D-002/003, F3A-043).
8. **Orçamento**: refazer a projeção de custo com números reais (plano atual, nº de lojas, pageviews) antes de escalar — a diferença entre cenário A e B é ~25× e vem quase toda do N+1 do chat (seção 3.13).
9. **Executar `auditoria/testes/3-01-desempenho-estatico.sh`** após as correções (estático, seguro, hoje 30/30); medições de latência/bundle (Lighthouse, APM, `EXPLAIN`) ficam pendentes de ambiente de teste.

## Pendências da Fase 4 para o responsável
1. **Inbox de webhooks idempotente + dead-letter com replay** (`WebhookEvent` com `@@unique([provider, eventId])`, gravar **antes** de responder 2xx, fila de retry, endpoint de replay manual) — cobre iFood, 99Food, 99, Asaas, Pagar.me, Efi, Inter, assinatura, Meta e Evolution; hoje só Asaas tem assinatura fail-closed (F4A-001/002, F4B-016/021/022).
2. **Não responder 200 com falha**: o handler do iFood deve responder erro (ou 2xx só após persistir) para o marketplace reenviar; o WhatsApp deve responder rápido e processar em background com dedup por `msg.id` (F4A-001, F4B-016/017).
3. **Reconciliação de pagamentos agendada e multi-gateway** (`sync-payments` ≥7 dias no `vercel.json`, Pagar.me/Efi/Inter incluídos), com alerta de pedido preso >30 min e `CancellationLog` em todo cancelamento automático (F4D-007, F4A-004, F4B-024, F4D-014).
4. **Estoque**: `restoreOrderStock` obrigatório em todo `order.delete`/`abandoned`/cancel financeiro (hoje nem é importado em `orders/route.ts`); o `catch` do helper deve alertar, não engolir (F4A-005/026, F4B-035).
5. **Idempotência no `POST /api/orders`** (header `Idempotency-Key` com `@@unique` + lock por pedido para escritores concorrentes) e trava de corrida no `dispatch-99` (F4B-019/030/031).
6. **Observabilidade**: Sentry/error tracking, `error.tsx`/`global-error.tsx`, `/api/health`, log estruturado com `orderId/establishmentId` e **remover dos logs** headers de webhook, tokens Meta, OTP e reset URL (F4A-013/014/016/018/019/020/025).
7. **PDV/KDS**: banner de offline (`navigator.onLine`), não limpar carrinho antes do ACK do servidor, fila local com replay, ações do KDS com `res.ok` + retry, indicador de conexão real e refresh do token de 24h do KDS (F4C-001/003/004/010/011/012).
8. **Impressão**: detectar falha de `window.open`/`print`, oferecer PDF/segunda via no servidor (histórico de cupons) e auto-impressão configurável (F4C-015…018).
9. **Engenharia de release**: CI com lint+typecheck+test, `npm test` no gate do deploy, `.env.example` completo, kill-switch/feature flag, `engines`/`.nvmrc`, `prisma migrate` (não só `db push`) e runbook de rollback; remover `delete-all` e `test-dispatch` de produção (F4C-019/021/022/023/027/030, F4D-011/025).
10. **Runbooks**: doc de incidente para os 5 cenários (iFood, gateway, pool, WhatsApp, KDS) + política de rotação de chaves + dono/SLO para Evolution/Storage; atualizar `WHATSAPP_BOT.md` (está desatualizado e descreve proteções inexistentes) (F4D-001…004/019/020).
11. **Confirmar itens "Não verificado"**: estado real na Vercel/Supabase (plano, crons agendados no painel, backups/PITR, RLS, logs), se os 3 crons não agendados rodam por runbook manual, e dono/SLO da Evolution/Storage.

## Pendências da Fase 8 para o responsável
1. **Re-entrância do PDV (CRÍTICO)**: hook `useSubmitGuard` + `disabled`/`loading` em fechar mesa, abrir/fechar caixa, abater, pagar externo e `ConfirmDialog`; idempotência em `POST /api/cash-register/close-table` (lock por mesa ou `Idempotency-Key`) — F8C-001/003/004/005/006.
2. **XSS no cupom de impressão**: escapar/`textContent` no `printReceiptPopup` (`caixa-page.tsx:951-987`) — F8C-008.
3. **OTP não pode aparecer na tela do cliente** quando o WhatsApp falha (esconder `verifyDevCode` em produção; depende de F7A-001) — F8C-007.
4. **Feedback honesto**: `res.ok` antes de todo toast de sucesso; `Array.isArray` antes de `setOrders`; relatórios com estado de erro (não "R$ 0,00"); login não expulsa por 500/offline (distinguir 401 de rede); banner de offline — F8B-002/004/005/006/012.
5. **Responsividade dos 3 devices**: PDV com drawer mobile (padrão da mesa), KDS com modo TV (breakpoints + fonte ≥16px + alvos ≥44px), CTA do motoboy ≥44px — F8A-001/002/003/016.
6. **Acessibilidade de base**: remover `userScalable: false`; `<button>` no card de produto e card de mesa; `role="dialog"`+`aria-modal`+Escape nos 76 overlays; `aria-label` em botões só-ícone; `htmlFor`/`id` em inputs (inclusive `ui/Input`); `focus-visible`; `aria-live` no toast — F8D-001…004/006/007/016/017/018/027.
7. **PWA seguro**: banner "nova versão disponível" em vez de `navigate()` forçado; deduplicar notificação por URL (não navegar a primeira janela); versionar localStorage; corrigir `start_url` do manifest global e `orientation: portrait` — F8A-004/005/008/009/010/014/019.
8. **Contraste**: criar `.badge-fire` com fundo; trocar `text-white` sobre `bg-yellow-400`/`green-500`; elevar `textMutedMore` para alpha ≥0,60; revisar `text-zinc-400`/`text-white/30-40` em telas operacionais — F8D-013/014/015/019/020.
9. **Design system**: adotar `ui/Button`/`ui/Input` no PDV e dashboard; eliminar hex hardcoded e ternários `darkMode` duplicados; unificar tema via classe no `<html>` (não estado JS + `media`); unificar moeda no `formatCurrency` — F8C-013/014/015/017, F8D-026.
10. **Impressão**: tratar `window.open` bloqueado com aviso + retry; estado "Imprimindo..."; XSS (item 2) — F8C-016/008.
11. **KDS**: refresh token ou sessão longa; checar `res.ok`/401 em `updateStatus`/`fetchOrders` com aviso visível; relógio do servidor para timers — F8B-007, F8C-012.
12. **Confirmar em dispositivo**: geometria do PDV em tablet retrato (F8A-001), KDS em TV real, e validar contraste com ferramenta (axe/Lighthouse) em ambiente de teste.

## Pendências da Fase 9 para o responsável
1. **BLOQUEAR forja de assinatura (CRÍTICO)**: exigir validação de assinatura em `POST /api/subscription/webhook` (modelo já existe em `webhooks/asaas/route.ts:7-17`) e auth + ownership em `POST /api/subscription/create`; **remover** o branch "Sandbox mode — activate directly" (`subscription/create/route.ts:38-55`) — hoje qualquer um grava `subscriptionStatus: "active"` em qualquer `establishmentId`.
2. **Fechar escalada de privilégio**: `POST/PATCH /api/users` aceitam `role`/`permissions` do body sem checar o role do chamador (`users/route.ts:68`, `users/[id]/route.ts:26`) — whitelist server-side + exigir `role === "admin"`.
3. **Fechar rota anônima de comissão**: `PATCH admin-saas/(auth)/estabelecimentos/[id]/api` não tem `verifyAuth` — qualquer visitante altera `saasCommissionPercentage`.
4. **Remover senha default `123456`** e `defaultPassword` em claro em `delivery-persons/route.ts:9,63`; exigir auth nessa rota (GET/POST).
5. **Jurídico mínimo antes de cobrar**: publicar Termos de Uso; checkbox de aceite no cadastro + campo de consentimento no schema; linkar a Política de Privacidade existente; publicar DPA/subcontratados. A FAQ da landing promete "cancelar quando quiser" — hoje é **falso** (F9C-003/011).
6. **PCI**: parar de receber PAN/CVV no servidor (`payments/asaas/card/route.ts:68-73`) — usar hosted checkout/tokenização client-side.
7. Model `Plan`/`Subscription` único (hoje preços hardcoded em 2 arquivos) + enforcement de features por plano nas rotas de negócio (hoje zero).
8. Webhooks Efi/Inter/WhatsApp/99 sem assinatura (só Asaas e Pagar.me verificam) — ver F4B-011/012.
9. Cancelamento, exportação e delete de dados (LGPD art. 18) inexistentes — criar fluxos antes de escala.

## Correção pós-Fase 1 (levantada na Fase 7)
O `F1C-010` dizia que as 9 rotas `meta-*` estão "sem autenticação". Conferido: elas **exigem**
JWT (`middleware.ts:34-49`), mas os handlers **não comparam** o `establishmentId` do token com o
`params.id` → o problema real é **acesso cross-tenant por qualquer staff autenticado**, não
acesso anônimo. Registrado como `F7B-009` no `07-login-otp.md`.

## Correção pós-Fase 0
O schema tem **47 modelos** (`grep -c "^model "`) — os relatórios da Fase 0 citam "48"; corrigido em `01-seguranca-1b.md`, e `02-banco.md` usa 47. Relações: **61** `@relation` (o 00-arquitetura cita 50).

## Comandos de verificação executados

**Fase 0:** `tsc --noEmit` 0 erros · `npm run lint` 0 erros/103 warnings · `npm run build` OK · `npm test` 62/62 · `npm audit` 24 vulns (4 críticas) · `npm outdated` 24 pacotes.

**Fase 1:** nenhum. A fase foi 100% estática (regra 2.5 — `DATABASE_URL` aponta para produção). Varreduras de segredo por `grep`/`git log -p --all` (ferramentas dedicadas indisponíveis).

**Fase 2:** `npx prisma validate` OK · `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` → **47 CREATE TABLE** (vs 0 nas migrations) · varreduras de schema/índices/FK/transações/N+1 por script. Nada conectado ao banco.

**Fase 6:** leitura de código + verificações estáticas: `wc -l` (7.360 linhas em `menu-page.tsx`) · `ls src/app/robots.ts sitemap.ts src/app/api/coupons` → inexistentes · `python3 -c "json.load(open('.next/server/middleware-manifest.json'))"` → `{"middleware": {}}` · greps de `verifyAuth`, `document.write`, `innerHTML`, `dangerouslySetInnerHTML`, `next/image`, `ld+json`, `GeolocationButton`, `availableOnline`, `isOpenOverride`, `customDomain` · conferência de cada achado-âncora lendo as linhas citadas (`sed -n`). Nenhum `curl`, nenhum comando contra banco/produção. `bash -n` nos 4 scripts: OK.

**Fase 7:** leitura de código: `sed -n` de `verification/route.ts` (geração, limites, 3 retornos, validação), `middleware.ts` (`PUBLIC_ROUTES`), `whatsapp/meta.ts` (template `UTILITY`, `findApprovedTemplate`, `sendVerificationCode` morto), `orders/customer`, `customers`, `establishments/[id]`, `lib/auth.ts` (sem checagem de `role`) · greps de `devCode`, `verifyLink`, `showDevCode`, `console.log`, `one-time-code`, `sendVerificationCode`, `turnstile|captcha`, `navigator.userAgent`, `prisma.customer.delete`, `politica-de-privacidade` · conferência de que `showDevCode` (1 ocorrência) e `sendVerificationCode` (só definição) são dead code. Nenhum `curl`, nenhum comando contra banco/produção. `bash -n` nos 3 scripts: OK.

**Fase 5:** leitura de código + verificações estáticas: conferência pessoal (`sed -n`) de 47 âncoras — `orders/[id]` (PATCH/`autoConfirmPayment`/cancel), `orders/route.ts` (`:179`, `:539`, `:706-713`, `:91-98`, `:451-477`), `lib/stock.ts:75-100`, `financial/{dre,cash-flow}`, `dashboard`, `expenses:200-225`, `cash-register/{route,[id],close-table,summary}`, `delivery-persons/{route,deliveries}`, `categories:1-50`, `subscription/{create,webhook}`, `ifood-poll:40-170,220-230`, `ifood-webhook:35-95`, `webhooks/{asaas,whatsapp}`, `users/[id]`, `toggle-open:60-80`, `kds/{screen,layout}`, `kds/establishment`, `purchases:85-120`, `stock:40-120`, `partial-payment`, `delivery/calculate` · greps de `verifyAuth` (14 rotas de negócio com contagem 0), `restoreOrderStock` (só 4 arquivos), `X-Hub-Signature-256` (só Pagar.me), `pedidos10|gorjeta|tip|nfc-e|station|wakeLock|visibilitychange` (= 0), `subscriptionStatus` (só login/webhook), crons do `vercel.json` (2) · **script estático executado**: `testes/5-02-regras-so-na-tela.sh` → **33 CONFIRMADO / 0 a rever**. Nenhum `curl`, nenhum comando contra banco/produção. `bash -n` nos 2 scripts: OK.

**Fase 3:** leitura de código + análise de manifests do build local (`.next/`): conferência pessoal (`sed -n`) de 15 âncoras — `lib/prisma.ts:14-24`, `api/orders/route.ts:697-755`, `kds/(auth)/screen/page.tsx:104-132,286-292`, `chat/page-content.tsx:84-131,199-203`, `api/products/[id]/route.ts:60-66`, `menu-page.tsx:2353-2374`, `pedidos/page-content.tsx:100-152`, `payments/sync/route.ts:155-190`, `ifood-poll/route.ts:12-34`, `lib/fetch-auth.ts:80-86`, `lib/rate-limit.ts:1-12`, `vercel.json` (inteiro), `next.config.js:1-16` · greps: `setInterval` (29 em src compilável; `visibilitychange` só em `menu-page`), `next/image` = 0, `.channel(`/`postgres_changes` = 0, `maxDuration` = 0, `unstable_cache` = 0, `inngest|bullmq|trigger.dev` = 0, `@@index` por modelo (21 de 47 sem nenhum) · leitura de `.next/app-build-manifest.json` (bundle `/[slug]` = 587 KB brutos / 153 KB gzip), `.next/prerender-manifest.json` e `images-manifest.json` · contagem de `package.json` (17+17 deps). **Script estático executado**: `testes/3-01-desempenho-estatico.sh` → **30 CONFIRMADO / 0 a rever**. Nenhum `curl`, nenhum `EXPLAIN`, nenhum comando contra banco/produção; nenhum arquivo do produto modificado.

**Fase 4:** leitura de código + conferência pessoal (`sed -n`/grep) de 23 âncoras — `orders/ifood-webhook/route.ts:139,148,204,290` (200 com falha), `webhooks/asaas/route.ts:42-46` (fire-and-forget), `orders/route.ts:7,451,539,576,670` (`restoreOrderStock` ausente), `cron/sync-payments/route.ts:40-48` (janela 15 min), `lib/stock.ts:322-331` (catch engole erro), `vercel.json` (2 crons), `admin-saas/dashboard/page.tsx:58-69` (monitores `ok: true`), `meta-discover:55-59` (token logado), `verification:153-157` (OTP em claro), `ifood-webhook:31-35` (headers logados), `orders/delete-all:8-18`, `kds-login:43` (token 24h), `kds/screen:105-135` (fetch sem `res.ok`), `caixa-page:804-810,846-858,936-942` (limpa carrinho antes do ACK), `public/sw.js:54-78` (navigate clients), `webhooks/99:1-30` (sem auth), `webhooks/efi/inter/subscription` (sem HMAC) · greps: `AbortSignal.timeout` = 1, `circuit|breaker` = 0, `error.tsx|global-error` = 0, `*.test.ts` = 6, `.github|Dockerfile` = 0, `navigator.onLine` = 0, `X-Hub-Signature` só Pagar.me, `LogWebhook99` write-only, `restoreOrderStock` em orders = 0, `idempoten|clientRequestId` em orders = 0, migrations = 4 pastas vs 47 models, `find` por health = 0 · contagens: `catch {}` vazios = 142, `console.*` = 586, `@@index` ausentes confirmados · **script estático executado**: `testes/4-01-confiabilidade-estatico.sh` → **57 CONFIRMADO / 0 a rever**. Nenhum `curl`, nenhum comando contra banco/produção; nenhum arquivo do produto modificado.

**Fase 8:** leitura de código + conferência pessoal (`sed -n`/grep) de 20 âncoras — `caixa-page.tsx:1366` (`flex w-80`), `public/sw.js:51-72` (skipWaiting + navigate clients), `caixa-page.tsx:386-397,470` (`Promise.all` sem try + `setLoading` inalcançável), `dashboard/(auth)/layout.tsx:89-107` (catch → `/login`), `layout.tsx:30-32` (`maximumScale: 1`, `userScalable: false`), `menu-page.tsx:7269-7275` (`<div onClick>` no card de produto), `caixa-page.tsx:1629-1643` (`<div onClick>` no card de mesa), grep `role=|aria-modal` = 0, `menu-page.tsx:3642-3654` (OTP visível), `caixa-page.tsx:951-960` (print interpolado), `menu-page.tsx` + `globals.css` (`badge-fire` = 0), KDS breakpoints = 0 + 14× `text-[10px]`, `caixa-page.tsx:2480-2514` (close-table disabled só split), grep `focus:outline-none` sem ring = 16, `pedidos/page-content.tsx:112-115` (`setOrders` sem `Array.isArray`), `caixa-page.tsx:1961-1987` (abrir/fechar caixa sem disabled), fechar caixa sem `res.ok` = 0, `<main>` = 3, `htmlFor` = 13, `sw.js:223-240` (notificação navega primeira janela) · **script estático executado**: `testes/8-01-frontend-ux-estatico.sh` → **40 CONFIRMADO / 0 a rever**. Nenhum `curl`, nenhum comando contra banco/produção; nenhum arquivo do produto modificado.

**Fase 9:** leitura de código + conferência pessoal (`sed -n`/grep) de 23 âncoras — `cadastro/page.tsx:80-92` (localStorage `id: establishment.id`), `api/establishments/route.ts:12-103` (POST público, trial 7d, retorna `establishment` completo + jwt), `users/route.ts:40-68` (`role: role || "atendente"`), `users/[id]/route.ts:24-27` (`body.role`), `admin-saas/.../api/route.ts:5-22` (PATCH comissão sem `verifyAuth`; grep = 0), `delivery-persons/route.ts:5-63` (GET/POST sem auth; `defaultPassword || "123456"`; retorna senha em claro), `subscription/create/route.ts:11-15,20-55,93-111` (planos hardcoded, sem auth, sandbox activate, `/payments` + `billingType: "UNDEFINED"`), `subscription/webhook/route.ts:4-50` (sem assinatura; grava `active`/`expired`), `planos/page-content.tsx:8-60` (planos duplicados no front), `prisma/schema.prisma` (sem `model Plan/Subscription/Invoice`; `password String` em Establishment; `ifoodAccessToken`), `admin-saas/(auth)/planos|logs/page.tsx` (Placeholders), `dashboard/page.tsx:58-70` (monitores hardcoded `ok: true`), `page.tsx:20,23-30,305-307` (features Enterprise, FAQ com promessa falsa de cancelamento, CTA span → `/cadastro`), greps negativos `termsAccepted|checkbox.*termo` em cadastro (= 0), `termos-de-uso|termsOfUse` em src (= 0), `consent` no schema (= 0), `cancelar assinatura|cancel subscription` (= 0), `establishment.delete|customer.delete` (= 0), `mailto|tel:|wa.me` na landing (= 0), `impersonat` (= 0), `analytics|posthog|mixpanel` (= 0), `CFOP|NFe|DANFE|SPED|NFSe` (= 0 reais), `AbortSignal|signal:` em integrations (= 0), `circuit|breaker` (= 0); `vercel.json` (só 2 crons); `webhooks/{asaas,pagarme}` têm assinatura (positivo), `{efi,whatsapp}` não; `nine-food-status.ts:4-6,18-21` (API especulativa); `asaas/card/route.ts:68-73` (PAN/CVV); `pagarme-config.ts:22` (SystemConfig); `establishments/[id]/route.ts:5,55` (só GET/PATCH); `politica-de-privacidade` órfã (0 links internos) · **script estático executado**: `testes/9-01-produto-juridico-estatico.sh` → **53 CONFIRMADO / 0 a rever**. Nenhum `curl`, nenhum comando contra banco/produção; nenhum arquivo do produto modificado.

**Fase 10:** consolidação 100% estática dos relatórios 0-9. Extração programática de CRÍTICO/ALTO com filtro `Origem != Rep.` via script Python (parse de tabelas markdown, dedup por ID, remoção de F1C-001/F1C-101 explícitos ≡ F1A-001) → **254 achados únicos (59C/195A)** agrupados em 14 áreas. Notas por área: 6 declaradas nos fase-relatórios (segurança 2,0; banco 5,5; desempenho 2,1; confiabilidade 1,5; negócio 3,3; cardápio 4,0; OTP 3,5; qualidade 5,5; UX 1,5; produto 1,3) + 5 derivadas † (multi-tenant, LGPD, integrações, KDS, geral). Checklist go-live 30 itens → 0 verdes. Roadmap H1 (14 itens bloqueantes) / H2 (18) / H3 (12) com grafo de dependências. Nenhum comando contra banco/produção; nenhum arquivo do produto modificado. Auditoria das 10 fases **ENCERRADA**.
