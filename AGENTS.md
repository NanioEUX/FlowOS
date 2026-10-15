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

## Pendências imediatas (próxima sessão)
1. **Commit do F6B** (arquivos novos + `orders/route.ts` + CSP/middleware/print/docs) quando o
   usuário pedir — avisar que a working tree está madura para commit.
2. **Introspecção feita (SELECT read-only em produção,14/10)**: prod é **`db push`** (sem
   tabela `_prisma_migrations`; 47 tabelas); colunas Efi/Asaas **já não existem** em prod;
   `Coupon` está no **shape novo** (`name/type/conditionValue/usageLimit/timesUsed/available`)
   com **0 linhas**; `Order` não tem `clientRequestId`. Decisões pendentes: commitar
   `schema.prisma` (diff de formatação) e manter/remover a migration `20261012` (é só
   documentação — nada usa `migrate deploy`).
3. Testar fluxo real: pedido PIX/cartão + mesa + PDV balcão + bot WhatsApp em ambiente de teste.
4. F6B restantes: **ADIADOS pelo usuário (14/10)** — idempotência (F6B-006) e `/api/coupons`
   CRUD+validate (F6B-012; prod tem o shape novo `name/type/conditionValue` com 0 linhas, mas
   menu e dashboard esperam o antigo `code/value`). Retomar só se ele pedir.

## Lista de credenciais stripadas (padrão em todos os pontos públicos)
`password`, `evolutionApiKey`, `metaAccessToken`, `metaWebhookVerifyToken`, `asaasApiKey`, `efiClientSecret`, `efiCertificate`, `efiWebhookToken`, `interClientSecret`, `interCertificate`, `interCertificatePassword`, `pagarmeApiKey`, `pagarmeWebhookKey`, `api99Key`, `ifoodAccessToken`, `ifoodRefreshToken`, `nineFoodApiKey`.

Mantidos no público (conservador): pix keys, GPS (`addressLat/Lng`), horários, cores, taxa.

## Testes do usuário (pendentes)
- Pedido PIX/cartão: testado, OK.
- Abrir link de acompanhamento (tracking) e verificar que carrega normal.
- Confirmar `SHOW_DEV_CODE` **não** setado no Vercel (só local `.env`).
- Definir `META_APP_SECRET` e `ADMIN_SEED_PASSWORD` no Vercel quando for criar app Meta/rodar seed.
- **Novo (pós-F6B)**: pedido no cardápio com preço adulterado via DevTools deve gravar o preço do banco; cupom inválido deve dar 400; loja pausada (`isOpenOverride=false`) deve recusar pedido do site mas PDV/mesa continuam funcionando.

