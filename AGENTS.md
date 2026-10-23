# AGENTS.md — Contexto do projeto (auditoria FlowOS)

## Validação obrigatória (antes de cada commit/push)
```bash
rm -rf .next/types && npx tsc --noEmit && npx vitest run && npm run build
```
Aspas em paths com `[slug]`/`[id]` no zsh. Atual: tsc limpo, 123 testes, build OK.

## Sequência da auditoria (não seguir ordem H1 cegamente)
Fase 1 ✅ → Fase 2 ✅ → **Fase 6 (cardápio público) EM ANDAMENTO** → Fase 5/3/4/7/8/9/10 pendentes.

Auditoria: `auditoria/PROGRESSO.md`, `auditoria/RELATORIO-FINAL.md` (H1 = linhas 375-396; ordem sugerida `0→1→2→6→7→5→3→4→8→9→10`).

## Diretriz do usuário
**NÃO quebrar o que funciona.** Correções conservadoras; strip apenas de credenciais; nunca remover dados públicos operacionais do cardápio.

## O que já foi feito (commits em main)
- `4713b04` — Bug ficha técnica (stockLinks/stockItem) + bug preço iFood (computeIfoodPrice).
- `4e5b0a9` — Regressão iFood orders (HMAC só se header presente) + ifood-poll aceita JWT.
- `fbcc73e` — Evolution webhook (apikey só se presente).
- `4498048` — prisma/dev.db desversionado; seed sem senha impressa; icon allowlist; delivery-persons senha≥6 + não devolve em claro; /api/users só admin + whitelist.
- `2191735` — H1#3 OTP (devCode/verifyLink só c/ SHOW_DEV_CODE=true; crypto.randomInt; BYPASS_PHONES removido; logs redigidos).
- `7124a2a` — H1#12 CI (.github/workflows/ci.yml) + db:reset exige DB_ALLOW_RESET=1.
- `64f2277` — Fase 6 pend.1: GET /api/establishments?id/slug não devolve credenciais sem JWT próprio.
- `315d53c` — Fase 6 pend.1 cont.: strip credenciais em [slug]/page.tsx (HTML) e POST /api/orders.
- `98b5dc3` — Fase 6 pend.1 cont.: strip credenciais em pedido/[id] (tracking público).
- `0b8d2ee` — Headers de segurança globais em next.config.js (sem CSP ainda).
- `eb3d50e` — XSS escaping nos 3 cupons de impressão (caixa, pedidos, KDS).

## F6B concluído (não commitado ainda — working tree)
Servidor virou fonte de verdade do `POST /api/orders` (F6B-001/002/003/004 + 013/014/018):
- `src/lib/order-input.ts` — `buildOrderInput()`: whitelist de status/method, validação de produto
  por tenant + `isAvailable`/`availableOnline`, recálculo de preço (promo/destaque/adicionais),
  taxa de entrega, mínimo, agendamento, cupom (dono/disponibilidade/limite — desconto do body
  ignorado), `changeFor` só em dinheiro, fidelidade e primeira compra no servidor.
- `src/lib/store-hours.ts` — `isEstablishmentOpen()` com `isOpenOverride` (true/false/null) e
  horário que cruza meia-noite; gates de plano/`isActive` alinhados ao `[slug]/page.tsx`.
- Canais: público = site/bot/whatsapp; staff (JWT) = caixa/manual; tablet de mesa anônimo aceita
  só `status:"new"`; item `custom-*` só staff. `total` do body é opcional (corrige o bot).
- Testes: `src/lib/__tests__/order-input.test.ts` (48) + `store-hours.test.ts` (9).
- Também no working tree: **F6B-005** (`isOpen` com tick de 60s + `isOpenOverride` no
  `menu-page.tsx`) e **F6B-007** (`GeolocationButton` reativado no checkout de delivery quando
  a loja tem GPS → taxa por zona/distância + `customerLat/Lng` fluindo pro pedido).
- **Regressão corrigida**: `staff-page.tsx` chamava `GET/PATCH /api/payment-request` sem JWT
  (401 desde o hardening `6559fb5`) → agora usa `fetchAuth` (opera com sessão do dashboard).
- **F6B-010 / F6A-018 / document.write (14/10)**: `middleware.ts` movido para `src/middleware.ts`
  (registrado no build) com `PUBLIC_ROUTES` ampliado — `/api/payments` (checkout do cardápio),
  `/api/bot` (self-fetch do webhook WhatsApp), `/api/establishments` (cadastro + GET público),
  `/api/subscription/webhook` e `/api/saas-admin` (cookie) senão quebrariam. Testado com
  `next start`: públicas passam, `/api/kds/establishment|stock|users|financial` dão 401 do
  middleware. Os 3 `document.write` de impressão viraram `src/lib/print-html.ts`
  (`printHtmlPopup` — popup via Blob URL, imprime e fecha como antes).
- **CSP aplicada (14/10, no working tree)**: `next.config.js` ganhou `Content-Security-Policy`
  (enforce) em `/:path*` junto dos headers de `0b8d2ee`, a partir de inventário estático dos
  recursos do browser: `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com`
  (nenhum script externo no código; inline do Next + analytics Vercel),
  `connect-src 'self' https://viacep.com.br` (único fetch externo), `img-src 'self' data:
  blob: https:` (Supabase Storage é externo e não passa por `next/image`),
  `frame-src 'self' https:` (iframe `paymentLink` no tracking), `worker-src 'self' blob:`
  (`/sw.js`), `frame-ancestors 'self'`, `object-src 'none'`, `base-uri/form-action 'self'`,
  `upgrade-insecure-requests`. Verificado com `next start` + `curl`: 6 headers em qualquer
  rota (página, API, `sw.js`); tsc/123 testes/build OK. **Atenção**: se houver script
  injetado via dashboard da Vercel, adicionar o domínio em `script-src`.
- **Fase 7 parcial (15/10, no working tree)**: **sessão de cliente** — cookie httpOnly
  `flowos_customer` (JWT 30d, `src/lib/customer-auth.ts`) emitido no `PUT /api/verification`
  e exigido em `orders/customer`, `addresses` (4 métodos, PATCH agora escopo por customerId) e
  `customers` PUT (id vem do token; troca de telefone bloqueada sem re-OTP); `GET
  /api/customers` público devolve subset sem PII (address/cep/cpf/birthDate/email — completo
  só com sessão própria); OTP: normalização única (`lib/phone.ts`, strip 55/0055, 10-11
  dígitos), tentativa consumida **antes** do compare atômico (máx 3 bcrypt.compare), resposta
  unificada p/ errado/expirado/inexistente (sem `remaining`), rate limit por IP (memória, 20/h)
  + poda de códigos >7d, logout via `DELETE /api/verification`; front: contagem de reenvio 60s,
  link da Política de Privacidade no OTP, modal de re-login automático em 401, re-fetch de
  endereços pós-OTP; `findApprovedTemplate` prefere categoria AUTHENTICATION. Fechados:
  F7A-004/005/006/009*/010/011/015/016/017/021/022, F7B-003/004/007/015/016/017*/019/010*
  (*parcial). Testes novos: customer-auth (5) + phone (7) → 135.
- **Fase 7 parcial cont. (15/10, no working tree)**: **F7B-009** — as 9 rotas `meta-*` de
  `establishments/[id]` já usavam `requireEstablishment(req, id)` (403 em divergência), só
  precisava ser confirmado; **F7B-006** — `GET /api/establishments/[id]` agora guarda as 17
  credenciais (`SECRET_FIELDS` = lista padrão + `password`) e só as devolve para
  `admin`/`saas_admin`/permissão `config` (quem pode editar no form — evita wipe por omissão);
  **F7A-012/F7A-018** — `POST /api/verification` valida estabelecimento (existe? cancelado/
  suspenso?) e cota (`currentUsage >= messagingLimit` → 429) **antes** de criar
  Customer/VerificationCode (fetch movido pro topo; fetch duplicado no meio do handler e o
  re-fetch do template removidos), cron `meta-quota` agendado `0 * * * *` em `vercel.json`.
  Smoke: `estId` inexistente → 404 sem registro. Restam da fase: F7A-013/019, F7B-012/014.
- **Fase 5 parcial (18/10, no working tree) — Top 1 e Top 2 do relatório**: **máquina de
  estados no servidor** em `PATCH /api/orders/[id]` via `src/lib/order-transitions.ts`
  (whitelist de 12 statuses, progresso só para frente, terminais sem volta, cancel de
  qualquer não-final; papel `kds` só aceita/preparing/ready; `motoboy` não muta; testes em
  `order-transitions.test.ts`) — fecha **F5A-002/F5D-008**; **F5B-018** — `deliveryPersonId`
  agora é aceito no PATCH (validado contra o tenant) em vez de falhar em silêncio. **Estorno
  unificado**: F5A-009 (falha de PSP → `restoreOrderStock` antes do delete, Inter + Pagar.me),
  F5A-022 (expurgo `abandoned` estorna + F5A-031 não atinge mais agendado futuro), F5A-010
  (`webhooks/99` cancel estorna; fora do mapa não grava string arbitrária — idem
  `99food-webhook` STATUS_CHANGED), F5A-011 (ifood/99food: guard anti duplo-estorno e
  **sem hard delete** — pedido fica `cancelled`; evento atrasado não ressuscita), F5A-013
  (placeholder iFood preenchido debita estoque). Testes webhook-99 atualizados (+2) → **144**.
  **Top 3 verificado**: as rotas do relatório (`cash-register`, `expenses`, `financial/*`,
  `stock`, `categories`, `daily-combos`, `delivery-*`, `subscription/create`, `orders/sync`,
  `ifood-poll`) **já usam `requireEstablishment`/`requireAuth`** (hardening pós-auditoria —
  o relatório 5.x estava defasado); F5C-003 sumiu junto do Asaas (rota `subscription/webhook`
  não existe mais). **5.6/5.7 Financeiro (18/10)**: **F5A-015** (despesa grava `cashMovement`
  negativo; fechamento e "valor esperado" do caixa somam por tipo com sinal — fecha o 2×),
  **F5B-028** (`type` de movimento com enum `sale|expense|withdrawal|injection|refund`),
  **F5A-018** (CMV na DRE: `custoMercadorias` via `OrderItemCost` + linha na tela e no CSV;
  `lucroBruto = receitaLíquida − CMV`), **F5A-019** (dre/cash-flow/revenues/cmv + cards do
  dashboard descartam `cancelled/abandoned/payment_pending`), **F5A-029** (bucket `money`
  aceita `cash`/`money`, `card_*`→card, `delivery/pickup` viram bucket em vez de sumirem),
  **F5A-044** (`src/lib/finance-dates.ts`: agrupamento e limites no fuso
  `BUSINESS_TZ`/America_Sao_Paulo — fecha o bug das 21h–24h e o corte às 20h59; usado em
  dre/cash-flow/revenues/cmv/dashboard), **F5A-030** (busca de despesas não sobrescreve mais
  o filtro de data — AND de ORs), **F5A-027/028/041** (vendas do dia sem
  abandoned/pagamento pendente, "pago" por `paymentStatus`, pedidos ativos com todo o
  fluxo). Testes novos finance-dates (4) → **148**. **KDS front (18/10)**: **F5D-002** (401/403
  no polling → overlay "Sessão expirada" + polling para; 5xx/rede → offline), **F5D-003**
  (indicador "Modo Serviço" agora reflete o último poll OK — vermelho "Sem conexão" com
  pulse), **F5D-005** (som ligado por padrão + unlock do AudioContext ampliado para
  touch/mouse/pointer/key), **F5D-010** (baseline `null` — primeiro pedido da sessão e o
  primeiro após fila zerada bipam), **F5D-006** (pedido ativo que vira `cancelled` → card
  vermelho "CANCELADO" + som, some em 60s). **Entregas (18/10)**: **F5B-019** —
  `delivery-persons/deliveries` com whitelist `out_for_delivery|delivered` + `canTransition`
  (mesma máquina de `order-transitions.ts`; status livre virava `delivered` de qualquer
  estado), token aceita `Authorization: Bearer` (front migrado, query/body como fallback);
  **F5B-020** — `deliveryCode` agora é `crypto.randomInt` (nunca os 4 últimos dígitos do
  telefone) nos 3 pontos de geração e só sai no `/api/tracking` e nas props de
  `pedido/[id]` quando o status é `ready|dispatched|out_for_delivery`; **F5B-021** —
  handshake com rate limit por pedido (8/5min) e por IP (12/5min, →429) + comparação em
  tempo constante, contador zera no acerto (teste `rate-limit.test.ts` → **150 testes**).
  **F5A-023 obsoleto**: `webhooks/asaas` foi removido junto com o Asaas.
  **Fechamento da Fase 5 (18/10)**: **F5C-022** já estava fechado (whitelist de role/
  permissions em `users/[id]` + só admin cria em `users/POST` — relatório defasado);
  **F5C-011** (bloqueio por assinatura no layout: `expired`/trial vencido redireciona
  **todos** os papéis a não ser `saas_admin`, `pending_payment` manda só o admin para
  planos — equipe segue operando na carência); **F5C-021** (`POST /api/users` respeita
  limite por plano: starter 3 / pro 10 / enterprise ilimitado, plano desconhecido sem
  limite); **F5A-026** (corrida do `MAX+1` → retry de 3× no P2002 de
  `@@unique([establishmentId, orderNumber])`, limpa `lowStockItems` no replay);
  **F5A-038 parcial** (GET `/api/orders` aceita `status` em lista `,` e `take` opcional;
  KDS polla `status=ativos,cancelled&take=300` — **restante virou item 1 da Fase 3**:
  `take` default + agregação server-side + cron do `abandoned`, pois `take` cego quebraria
  a tela de Relatórios que agrega no cliente). **F5C-012 (cobrança recorrente) é decisão
  do usuário** — `subscription/create` já exige auth mas ainda ativa plano sem pagamento.
  **Fase 5 encerrada no código.**
- **Fase 3 itens 1–2 (18/10, no working tree)**: **F3A-001/F3D-002** — expurgo de
  `abandoned` saiu do `GET /api/orders` (escrita-por-leitura em todo poll) e virou o cron
  `src/app/api/cron/expire-orders` (agendado `*/5 min` no `vercel.json`; agrupa por
  `abandonedOrderMinutes`, mantém estorno de estoque + reversão de fidelidade; auth igual
  `meta-quota`: só valida se `CRON_SECRET` estiver setado); GET ganhou `since` (ISO) e já
  tinha `status` em lista/`take` opcional; **`take` default e agregação server-side dos
  relatórios adiados** — `relatorios` e `caixa-gerencial` agregam histórico no cliente e
  um `take` cego mudaria os números das telas. **F3A-021/F3B-001/003** — novo
  `GET /api/orders/messages?ids=` (staff via `verifyAuth`, máx 300 ids, devolve
  `{orderId: Message[]}`); tela de **pedidos** passou a pollar 1 lote/30s no pai
  (`messagesByOrder`) e os cards perderam o polling próprio (badge de msg nova mantida;
  `sendMessage`/`markAsRead` atualizam via callbacks); **KDS** faz 1 chamada em lote por
  poll em vez do loop sequencial N+1. `orders-screen` (tracking público, 1 pedido) ficou
  como estava. Gate: tsc + **150 testes** + build OK. **Item 3** — `lib/prisma.ts` agora
  memoiza o `PrismaClient` **sempre** em `globalThis` (antes só fora de produção, F3A-033)
  e `schema.prisma` ganhou 7 `@@index` aditivos exatos do relatório (F3A-061):
  `DeliveryPerson/Category/Product/StockItem/User(establishmentId)`, `OrderMessage(orderId)`,
  `Order(customerId)` — `prisma validate` OK, diff só aditivo; **  `db push` em produção é
  pendência do usuário** (só `CREATE INDEX`; confirmar com o DBA quais já existem). **Item 4**
  — hook `useVisibilityRefresh` (`src/hooks/`) + guard `document.hidden` em todos os polls:
  KDS 5s, pedidos 30s (+sync de pagamentos), chat 5s (conversas+mensagens), caixa-gerencial
  15s, entregas 30s e no cardápio (tracking/mensagens 10s, pedidos do cliente 15s — este
  também **perdeu o duplo poll**: reusa a resposta do `loadCustomerOrders` em vez de 2ª
  chamada ao mesmo endpoint); poll de 2s do modal OTP só roda com o modal aberto e pausa
  com a aba oculta. **Realtime Supabase adiado** (sem `.channel(` no código; stack é
  Prisma+Postgres direto). Gate: tsc + **150 testes** + build OK. **Item 6** — **F3A-050**
  (`POST /api/push`): raw SQL com `CREATE TABLE IF NOT EXISTS` por gravação (DDL com
  sintaxe SQLite que nem roda no Postgres da prod) virou `prisma.pushSubscription.upsert`
  (mesma tabela do push PWA; `customerKey` = deliveryPersonId, como busca o sender em
  `lib/push.ts`; establishmentId resolvido via DeliveryPerson quando o front manda "").  
  **F3A-044/F4A-010 (timeouts externos)**: helper `src/lib/fetch-external.ts`
  (`AbortSignal.timeout(15s)`) trocando `fetch` em pagarme (3) + meta (8) + evolution (5)
  + rota `pagarme/qr-code` (2); `req.setTimeout(15s)`+destroy nos 15 `https.request` de
  ifood/ifood-merchant/ifood-status/nine-nine/nine-food-status/inter; OpenAI SDK com
  `{ timeout: 15000 }` nas 2 chamadas (fecha o loop de tool-calling sem teto). Mock do
  teste `nine-nine` ganhou `setTimeout` (150 testes verdes). **F3A-048/F3D-015**
  (webhook WhatsApp): POST agora valida JSON + assinatura Meta (401 real) e responde
  **ACK imediato**; o fluxo inteiro (status/consumo, bot, **OpenAI com até 3 iterações
  de tool-calling + self-fetch em `/api/bot/create-order`**, envio) roda depois da
  resposta via `waitUntil` de `@vercel/functions` (novo dependency). **F3D-001**:
  `vercel.json` com `functions.maxDuration: 60` para as 4 rotas de cron + `orders/sync`
  + `ifood-catalog/sync`; **`regions` NÃO setada** — decidir com o usuário (precisa
  saber a região do Supabase; errar = latência extra). Gate: tsc + 150 testes + build OK.
  **Item 7** — **F3D-002/F3A-043**: `verify-reminder` agendado `0 * * * *` (código dizia
  "hora em hora", estava 1×/dia) e `take` 50→15 envios seriais por tenant por invocação
  (cabe na janela de 60s; backlog drena nas próximas horas); `reset-ai-usage` ganhou
  **GET que executa o reset** (antes GET só respondia `{status:"ok"}` — o cron mensal
  `0 0 1 * *` nunca zerava `aiMessagesUsed`; nada no código zera esse contador);
  diretório vazio `cron/sync-payments/` removido (rota morta, sem rota dentro);
  **F3D-003**: `sync-ifood-status` tira do scan as lojas em pausa manual
  (`ifoodPaused && !ifoodAutoPaused` sempre dariam skipped — filtro em SQL) e para de
  engolir erro por loja (log com id + `errorDetails` capped na resposta do cron).
  **Item 9** — `auditoria/testes/3-01-desempenho-estatico.sh` reexecutado: 18
  CONFIRMADO / 12 REVER; todos os REVER de correção nossa batem (expiração fora do GET,
  globalThis sempre, maxDuration, 5 crons, @@index ×4+Order 8º, strings de literal do
  script que mudaram de forma — `take` como variável, `tick` vs `setInterval`). Restantes
  da Fase 3: itens 5 e 8 (imagens e orçamento — decisão do usuário).
- **Fase 9 parcial (18/10, no working tree)**: **F9A-003** — rota
  `admin-saas/estabelecimentos/[id]/api` era anônima (middleware só casa `/api/:path*`)
  → agora `getSaasAdmin()` com 401; **F9-001** — `subscription/webhook` era diretório
  vazio (removido) e `subscription/create` já tinha ownership (`requireEstablishment`);
  sandbox de ativação sem pagamento **permanece = decisão F5C-012**; **F9-002/004/008
  verificados já fechados** (whitelist users, delivery senha≥6+auth, webhooks com
  verificação — **envs pendentes: `WEBHOOK_99_SECRET` e `IFOOD_WEBHOOK_SECRET`** sem
  eles é fail-open). Restam da Fase 9 só decisões/feature: jurídico (#5), model
  Plan/Subscription (#7), LGPD (#9) e PCI do `pagarme/card` (PAN/CVV no servidor =
  hosted checkout, decisão). Gate: tsc + 150 testes + build OK.

## Pendências imediatas (próxima sessão)
1. **Commit da Fase 7 + Fase 5 parcial** (sessão de cliente + hardening OTP + máquina de
   estados + estorno unificado + pacote financeiro 5.6) quando o usuário pedir — working
   tree madura (~25 arquivos); gate verde (tsc, **150 testes**, build).
2. **Introspecção feita (SELECT read-only em produção,14/10)**: prod é **`db push`** (sem
   tabela `_prisma_migrations`; 47 tabelas); colunas Efi/Asaas **já não existem** em prod;
   `Coupon` está no **shape novo** (`name/type/conditionValue/usageLimit/timesUsed/available`)
   com **0 linhas**; `Order` não tem `clientRequestId`. Decisões pendentes: commitar
   `schema.prisma` (diff de formatação) e manter/remover a migration `20261012` (é só
   documentação — nada usa `migrate deploy`). **Atenção**: a working tree de schema já foi
   regenerada 1x com Efi/Asaas de volta (provável `db pull` do SQLite local antigo) — foi
   revertida; não regenerar sem conferir contra o prod.
3. Testar fluxo real: pedido PIX/cartão + mesa + PDV balcão + bot WhatsApp em ambiente de teste.
4. F6B restantes: **ADIADOS pelo usuário (14/10)** — idempotência (F6B-006) e `/api/coupons`
   CRUD+validate (F6B-012; prod tem o shape novo `name/type/conditionValue` com 0 linhas, mas
   menu e dashboard esperam o antigo `code/value`). Retomar só se ele pedir.
5. Fase 7 restantes (após 15/10): **F7B-009 fechado** (as 9 rotas `meta-*` já usam
   `requireEstablishment(req, id)` → 403 em divergência); **F7B-006 fechado** (`GET
   /api/establishments/[id]` agora só devolve as 17 credenciais para `admin`/`saas_admin`/permissão
   `config` — kds/motoboy/atendente sem essa permissão recebem o registro limpo); **F7A-012
   fechado** (cota Meta conferida antes de criar Customer/VerificationCode → 429 se
   `currentUsage >= messagingLimit`; cron `meta-quota` agendado `0 * * * *` em `vercel.json`;
   validação de estabelecimento movida para o topo do `POST /api/verification` — inexistente/
   cancelado não gera registro nem custo). Abertos: F7A-013 completo (template AUTHENTICATION
   real nas WABAs — o código já prefere, mas depende do painel Meta), F7A-019
   (captcha/Turnstile — decisão de produto), F7B-012 (fallback SMS/e-mail), F7B-014 (LGPD
   delete de Customer).

## Lista de credenciais stripadas (padrão em todos os pontos públicos)
`password`, `evolutionApiKey`, `metaAccessToken`, `metaWebhookVerifyToken`, `asaasApiKey`, `efiClientSecret`, `efiCertificate`, `efiWebhookToken`, `interClientSecret`, `interCertificate`, `interCertificatePassword`, `pagarmeApiKey`, `pagarmeWebhookKey`, `api99Key`, `ifoodAccessToken`, `ifoodRefreshToken`, `nineFoodApiKey`.

Mantidos no público (conservador): pix keys, GPS (`addressLat/Lng`), horários, cores, taxa.

## Testes do usuário (pendentes)
- Pedido PIX/cartão: testado, OK.
- Abrir link de acompanhamento (tracking) e verificar que carrega normal.
- Confirmar `SHOW_DEV_CODE` **não** setado no Vercel (só local `.env`).
- Definir `META_APP_SECRET` e `ADMIN_SEED_PASSWORD` no Vercel quando for criar app Meta/rodar seed.
- **Novo (pós-F6B)**: pedido no cardápio com preço adulterado via DevTools deve gravar o preço do banco; cupom inválido deve dar 400; loja pausada (`isOpenOverride=false`) deve recusar pedido do site mas PDV/mesa continuam funcionando.

