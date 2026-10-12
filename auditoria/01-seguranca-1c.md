# 01-seguranca-1c.md — Segredos, superfície web e integridade financeira

> Parte **1C** da Fase 1. Somente leitura. Evidência no formato `arquivo:linha`.
> **Todos os valores de segredo aparecem MASCARADOS** (padrão `xxxx` + tamanho), conforme a
> regra 6 da auditoria. Nenhum teste dinâmico executado.
>
> Numeração: `F1C-0xx` = segredos · `F1C-1xx` = web · `F1C-2xx` = dinheiro.
> A remessa de segredos rederivei o item `F1C-001` que **já é** o `F1A-001` (middleware fora do
> build) — mantido aqui por integridade da remessa, contabilizado **uma vez** no consolidado.

---

# A. SEGREDOS E CREDENCIAIS (F1C-001 … F1C-021)

**Repositório:** `github.com/NanioEUX/FlowOS` (**PÚBLICO**) · branch `main` · 1.280 commits.

| ID | Sev. | Título | Evidência |
|---|---|---|---|
| F1C-001 | CRÍT | *Igual a F1A-001* — `middleware.ts` fora do build (auth global morta) | `middleware.ts:1-66`; `src/middleware.ts` não existe; `.next/server/middleware-manifest.json` → `"middleware": {}` |
| F1C-002 | CRÍT | `GET /api/establishments?id=`/`?slug=` **sem auth** devolve 17 credenciais do tenant (`interCertificate` .p12, `efiCertificate` .p12, `asaasApiKey`, `pagarmeApiKey`, `metaAccessToken`, `evolutionApiKey`, `ifoodAccessToken/RefreshToken`, `api99Key`, `password=$2b$…`) | `src/app/api/establishments/route.ts:110-151` (retorno em `:130-131`, `:149-150`) |
| F1C-003 | CRÍT | `GET/PATCH /api/establishments/[id]` devolve o registro completo ao navegador (o `SAFE_FIELDS` só existe em outra rota) | `src/app/api/establishments/[id]/route.ts:17-35` (GET), `:75-79` (PATCH), `SAFE_FIELDS` `:38-53` |
| F1C-004 | CRÍT | OTP **sempre** devolvido na resposta (`devCode`); a flag `showDevCode` é calculada e nunca usada | `src/app/api/verification/route.ts:243`, `:255-259`, `:261-268` |
| F1C-005 | ALTO | Senha admin fixa no repo e documentada | `prisma/seed-admin.ts:7-8`, impressão em `:41`; `docs/ADMIN_SAAS.md:19` |
| F1C-006 | ALTO | Fallbacks de segredo literais em **6 arquivos** (`\|\| "flowos-secret"`, `flowoshub-saas-admin-…`, `flowos-meta-verify`, `dev-secret`) | `establishments/me/route.ts:6`, `…/location/route.ts:6`, `…/delivery-zones/route.ts:6`, `…/delivery-config/route.ts:7`, `lib/saas-admin-auth.ts:7`, `saas-admin/login/route.ts:9`, `webhooks/whatsapp/route.ts:17`, `cron/reset-ai-usage/route.ts:7` |
| F1C-007 | ALTO | `prisma/dev.db` (212 KB) **versionado** com 5 hashes de senha e e-mails reais | trackeado desde `701766a` (2026-06-21), blob `c81e6b0…` no HEAD |
| F1C-008 | ALTO | Segredos/códigos em logs de produção (`access_token` integral da Meta, OTP, token de reset, `Bearer` de webhook) | `meta-discover/route.ts:57,79,190`, `verification/route.ts:138,155,260`, `auth/forgot/route.ts:47`, `orders/ifood-webhook/route.ts:33`, `orders/route.ts:587` |
| F1C-009 | ALTO | Crons com auth **fail-open** (`if (cronSecret && …)`, `Bearer undefined` aceito) | `cron/meta-quota/route.ts:11`, `cron/reset-ai-usage/route.ts:7`, `cron/sync-ifood-status/route.ts:62`, `cron/sync-payments/route.ts:34`, `cron/verify-reminder/route.ts:13` |
| F1C-010 | ALTO | **9 rotas Meta sem autenticação** lendo/escrevendo `metaAccessToken` | `establishments/[id]/meta-{connect,consumption-reset,create-template,discover,embedded-signup,profile-picture,profile-picture-sync,quota,status}/route.ts` (`grep -c verifyAuth` = 0) |
| F1C-011 | ALTO | Endpoints de teste públicos com credenciais reais | `test-dispatch/route.ts:6,37` (aciona iFood real), `asaas-test/route.ts:3-34` (oráculo de API key da Asaas) |
| F1C-012 | MÉD | IDOR em `delivery-config` expondo `api99Key` | `establishments/[id]/delivery-config/route.ts:20-40,44-81` |
| F1C-013 | MÉD | **16 colunas de credencial em texto puro** no schema, sem criptografia campo-a-campo e **sem RLS** | `prisma/schema.prisma:16,30,34,35,128,130,131,133,135,137,138,139,140,142,144,172,173,178,182` |
| F1C-014 | MÉD | Senha padrão `123456` + hash **SHA-256 sem salt** no seed; política de senha inexistente no `POST /api/users` | `prisma/seed.ts:8,26,46,55,56,68,188`; `usuarios/page-content.tsx:82`; `users/route.ts:46-61` |
| F1C-015 | MÉD | `.env.production` commitado em `2d760c6` e removido em `863b501` (blob permanece no histórico; valores vazios, exceto `VERCEL_OIDC_TOKEN` len 1144) | `git show 2d760c6:.env.production` |
| F1C-016 | MÉD | `SHOW_DEV_CODE=tr****` ativo no `.env:31` | `.env:31`; `verification/route.ts:245` |
| F1C-017 | MÉD | Chave Pagar.me gravada em `SystemConfig` (JSON de DB) e devolvida pela API | `lib/pagarme-config.ts:20-49`; `saas-admin/pagamentos/route.ts:16-17,37-56` |
| F1C-018 | MÉD | JWT de sessão em `localStorage` | `cadastro/page.tsx:80-89`, `kds/page.tsx:33-34`, `kds/(auth)/layout.tsx:36-37`, `lib/fetch-auth.ts` |
| F1C-019 | BAIX | `console.log` de bodies completos de webhook | `integrations/pagarme.ts:172`, `integrations/ifood-catalog-write.ts:212,218`, `whatsapp/meta.ts:100`, `webhooks/efi/route.ts:22`, `payments/inter/webhook/route.ts:7` |
| F1C-020 | BAIX | Telefones em bypass de rate-limit hardcoded (PII) | `verification/route.ts:10` (`BYPASS_PHONES`) |
| F1C-021 | INFO | Segredos reais **só** no `.env` local (não versionados) — inventário com tamanho e máscara | `.env:1,2,4,5,6,11,13,14,15,16,27,28,32,35`, `.env.local:3`, `.env.backup:29` |

### Varreduras que deram **negativo** (regra 3: seções obrigatórias)

| Padrão | Working tree | Histórico git (1.280 commits) |
|---|---|---|
| `sk_live_` / `sk_test_` / `sk-proj` / `pk_live_` / `whsec_` / `ghp_` / `gho_` / `AKIA…` / `AIza…` / `xoxb-` / `SG.` / `rzp_` | **0** | **0** |
| `-----BEGIN … PRIVATE KEY-----` (RSA/EC/OPENSSH) | **0** | **0** |
| JWT colado `eyJ….` em código/docs | **0** | só blob do `.env.production` |
| URL com credencial embutida (`://user:pass@`) | **0** | **0** |
| `SUPABASE_SERVICE_ROLE` / `service_role` com valor | **0** (só `process.env` em 2 commits) | **0** com valor |
| Arquivos sensíveis já adicionados ao git | `prisma/dev.db` | **apenas 2**: `.env.production` e `prisma/dev.db` |
| Alta entropia `["'][A-Za-z0-9+/=_-]{40,}["']` em arquivos trackeados | 1 falso positivo (nome de tabela) | — |
| `INSERT INTO` em migrations/scripts | **0** | — |
| RLS (`CREATE POLICY`/`ENABLE ROW`) | **0** — não existe pasta `supabase/` | — |
| Bundle de cliente (`.next/static`, `public/`) por `service_role`, `eyJhbGciOi`, `supabase.co` | **0** | — |

**Ferramentas dedicadas ausentes:** `gitleaks` e `trufflehog` não estão instalados → a detecção
foi manual por regex; segredos em formatos exóticos podem ter passado.

### Histórico git — o que **não** resolve "apagando o arquivo"

| Artefato | Commit | Estado | O que fica |
|---|---|---|---|
| `prisma/dev.db` | `701766a` (2026-06-21) | **ainda no HEAD** | blob único com 5 hashes + e-mails reais |
| `.env.production` | `2d760c6` add / `863b501` rem | fora do índice | blob acessível via `git show` (valores vazios + `VERCEL_OIDC_TOKEN`) |
| `prisma/seed-admin.ts` | `b731282` | **no HEAD** | senha `Admin@…` literal |
| Fallbacks `flowos-secret`… | 6 commits | 5 no HEAD | literais preservados |

Conclusão: **apagar não basta** → rotacionar o material (ou `git filter-repo`, se a política exigir).

---

# B. SUPERFÍCIE WEB (F1C-101 … F1C-124)

| ID | Sev. | Módulo | Título | Evidência | Esforço |
|---|---|---|---|---|---|
| F1C-101 | CRÍT | Infra/Auth | Middleware não carregado → 81 rotas API sem perímetro | `middleware.ts`; `.next/server/middleware-manifest.json`; `node_modules/next/dist/build/index.js:476-486` | Pequeno |
| F1C-102 | CRÍT | Estabelecimentos | Segredos + PII sem `select` explícito (mesma raiz de F1C-002/003) | `establishments/route.ts:112-145`; `orders/route.ts:678-683`; `pedido/[id]/page.tsx:72-77,87-90` | Pequeno |
| F1C-103 | ALTO | KDS/Dashboard/Caixa | XSS via `document.write` com dados do cliente | `kds/(auth)/screen/page.tsx:476`; `dashboard/(auth)/pedidos/page-content.tsx:738`; `caixa/caixa-page.tsx:951` | Pequeno |
| F1C-104 | ALTO | ifood-catalog | **SSRF**: URL de imagem baixada pelo servidor sem allowlist | `ifood-catalog/import/route.ts:34-47,97-112` | Pequeno |
| F1C-105 | MÉD | WhatsApp Evolution | **SSRF**: URL de webhook configurável pelo usuário | `lib/whatsapp/evolution.ts:53-57`; `establishments/[id]/route.ts:38` | Médio |
| F1C-106 | ALTO | Pedidos/Tracking | Tracking/PII sem token; `updateMany` abandonado | `orders/route.ts:690-757` (`:706-713`) | Pequeno |
| F1C-107 | MÉD | Push | `diagnose/test/cleanup/order-details` abertos | `api/push/*/route.ts`; `middleware.ts:16` | Pequeno |
| F1C-108 | ALTO | Meta picture-sync | Rota sem auth + chamada externa pelo servidor | `establishments/[id]/meta-profile-picture-sync/route.ts:36` | Pequeno |
| F1C-109 | ALTO | Delivery config | IDOR: não compara cookie × `params.id` | `establishments/[id]/delivery-config/route.ts` (idem `delivery-zones`, `location`) | Pequeno |
| F1C-110 | ALTO | Endpoints de teste | `/api/test-dispatch` dispara ações reais no iFood; `/api/asaas-test` vira oráculo de API key | `test-dispatch/route.ts:6-37`; `asaas-test/route.ts:3-27` | Pequeno |
| F1C-111 | MÉD | Verificação | `devCode` retornado sempre | `verification/route.ts:243-246,261-267` | Pequeno |
| F1C-112 | MÉD | Headers | Nenhum header de segurança (CSP/HSTS/X-Frame) no código | `next.config.js` (sem bloco `headers()`); `vercel.json` (só `crons`) | Pequeno |
| F1C-113 | ALTO | Auth/CSRF | Cookies bons, mas sem token CSRF nem checagem de Origin em form nativo | `auth/login/route.ts:108-114`; `kds-login:46-52`; `saas-admin/login:48-54`; `admin-saas/(auth)/layout.tsx:60` | Médio |
| F1C-114 | MÉD | Segredos | Fallbacks hardcoded em 6 arquivos (= F1C-006) | grep `flowos-secret` → 6 arquivos | Pequeno |
| F1C-115 | MÉD | Validação | **Zero validação de schema**: `zod` instalado (`package.json:41`) com **0 usos**; 148 corpos passam direto ao Prisma | grep `from "zod"` → 0 em `src/` | Grande |
| F1C-116 | ALTO | Crons | Auth fail-open nos crons (mesma raiz de F1C-009) | `cron/meta-quota/route.ts:10-13`; `cron/reset-ai-usage/route.ts:7-10` | Pequeno |
| F1C-117 | MÉD | Info leak | `error.message` e stack devolvidos em ~44 rotas (`catch` → 500) | `orders/ifood-poll/route.ts:228` (`stack: err?.stack`); `admin/stories/route.ts:73,110`; `payments/inter/qr-code/route.ts:96`; `bot/create-order/route.ts:204` | Pequeno |
| F1C-118 | MÉD | Supply chain | `next ^14.0.0` (24 vulns / 4 críticas no `npm audit`), `vitest` 1.6 EOL puxando `tinypool` crítico | `package.json:34,50,60` | Pequeno |
| F1C-119 | CRÍT | Auth/Reset | Token de reset impresso em log e **e-mail nunca enviado** (takeover) | `auth/forgot/route.ts:46-54` (link em `console.log`, e-mail comentado) | Pequeno |
| F1C-120 | ALTO | Webhook 99 | Sem assinatura: cancela/altera qualquer pedido | `webhooks/99/route.ts:6-12,41-45,64-73` | Pequeno |
| F1C-121 | MÉD | Webhooks | Validação de assinatura **condicional** (fail-open) em 4 rotas | `webhooks/pagarme/route.ts:15-22`; `orders/ifood-webhook/route.ts:42-52`; `orders/99food-webhook/route.ts:62-74`; `webhooks/whatsapp/route.ts:80-100` | Pequeno |
| F1C-122 | MÉD | Rate limit | Em memória e só no login principal | `lib/rate-limit.ts:6-14`; `auth/login/route.ts:31` | Médio |
| F1C-123 | MÉD | Logs | Headers completos e payloads em log de produção | `orders/ifood-webhook/route.ts:33`; `webhooks/pagarme/route.ts:31`; `webhooks/efi/route.ts:22`; `inter/webhook/route.ts:7` | Pequeno |
| F1C-124 | BAIX | Repositório | 4 backups versionados (~1,2 MB de código morto) | `src/app/[slug]/menu-page.tsx.{bak,bak2,bak3,backup}` | Pequeno |

---

# C. INTEGRIDADE DE DINHEIRO (F1C-201 … F1C-213)

| ID | Sev. | Módulo | Título | Evidência | Esforço |
|---|---|---|---|---|---|
| F1C-201 | CRÍT | Preços | Preço vem do **body**, não recalculado no servidor | `orders/route.ts:91-98`; `cash-register/close-table/route.ts:24`; `bot/create-order/route.ts:64-66` | Médio |
| F1C-202 | CRÍT | Descontos/Cupons | Desconto e `loyaltyPointsUsed` do body; cupom **nunca validado**; `/api/coupons/validate` **não existe** (404) | `orders/route.ts:75,94-98,428,435,480,250-252`; chamada em `menu-page.tsx:1864` | Médio |
| F1C-203 | ALTO | Estoque | Decremento fora da transação com `.catch(()=>{})` | `orders/route.ts:479-485` | Pequeno |
| F1C-204 | ALTO | Estoque | Read-modify-write sem `establishmentId` e sem trava de negativo | `lib/stock.ts:77-88,104-115` | Médio |
| F1C-205 | ALTO | Caixa | **Abertura de caixa sem autenticação** | `cash-register/route.ts:4-40` | Pequeno |
| F1C-206 | ALTO | Caixa | Re-fecha caixa já fechado; `transfer` sem checagem de tenant | `cash-register/[id]/route.ts:27-41`; `[id]/transfer/route.ts:24-41,59-73` | Pequeno |
| F1C-207 | MÉD | Close-table | Fechamento sem transação; taxa pode ficar negativa | `cash-register/close-table/route.ts` | Médio |
| F1C-208 | MÉD | Financeiro | Movimentações manuais sem RBAC | `cash-register/[id]/movements/route.ts` | Médio |
| F1C-209 | MÉD | Schema | Dinheiro em **`Float`** em 16+ campos → erro de arredondamento | `prisma/schema.prisma:243,339,458-459,606,630,678,696,708-710,730,739,751,801,953` | Médio |
| F1C-210 | MÉD | RBAC | Controle de papel em **só uma** rota de caixa | `cash-register/[id]/transfer/route.ts:43` | Pequeno |
| F1C-211 | ALTO | Webhook Efi | PIX marcado como pago **sem validar** (a função de validação existe e não é chamada) | `webhooks/efi/route.ts:7-19`; `lib/integrations/efi.ts:187-196` | Pequeno |
| F1C-212 | ALTO | Webhook Inter | Sem assinatura; **valor aceito vem do corpo** do payload | `payments/inter/webhook/route.ts:4-44` | Pequeno |
| F1C-213 | ALTO | Webhook assinatura | Sem assinatura: ativa/expira plano de **qualquer** estabelecimento | `subscription/webhook/route.ts:4-50` | Pequeno |

---

# D. O QUE ESTÁ BOM

- Cookies de sessão `httpOnly` + `Secure` + `SameSite=Lax` nos 3 logins (`login:108-114`,
  `kds-login:46-52`, `saas-admin/login:48-54`); nenhum `document.cookie`.
- **Upload**: auth + allowlist de MIME + limite 2 MB + re-encode por `sharp` (elimina
  poliglotos) + nome aleatório (`upload/route.ts:9-23`, `image-upload.ts:51-64`).
- **Webhook Asaas**: comparação em tempo constante e **fail-closed** (`webhooks/asaas/route.ts:10-29`) — melhor padrão do repo.
- Prisma com queries parametrizadas; o único `$executeRawUnsafe` usa mapa de literais fechado
  (`webhooks/whatsapp/route.ts:112-127`).
- **Zero** `dangerouslySetInnerHTML`/`innerHTML` — XSS depende só dos 3 `document.write`.
- Sem open redirect (`redirect`/`router.push` sempre com caminho interno literal).
- Reset de senha resiste a enumeração; token 32 bytes, 1h, uso único, hash no DB
  (`forgot:20-42`, `reset:27-33`); bcrypt cost 12 (`reset:36`, `change-password:35`).
- OTP com hash bcrypt, 3 tentativas, 5 min, cooldown **persistido em banco** (sobrevive a cold start).
- Nenhuma chave de formato industry-standard nem chave privada PEM em código **nem** nos 1.280 commits.
- `.env`, `.env.local`, `.env.backup` **nunca** commitados; `.gitignore` cobre `.env*`.
- Nenhuma `service_role`/chave Supabase no bundle de cliente.
- `package-lock.json` versionado; `postinstall` só `prisma generate`.
- Criação/cancelamento 99Food mexe em estoque **dentro** de `$transaction`
  (`99food-webhook/route.ts:162-167,185-205`).
- Nenhum dado de cartão persistido (PAN/CVV só em trânsito).

---

# E. NÃO VERIFICADO (1C)

- Variáveis reais da **Vercel/produção** (se `JWT_SECRET`, `CRON_SECRET`, `SHOW_DEV_CODE` estão lá).
- Estado do middleware **no deploy** (evidência estrutural local, não confirmada em produção).
- **RLS** no Postgres de produção (conclusão de ausência baseia-se no repositório).
- **Nenhum `curl`/request executado** — todas as reproduções estão descritas, não executadas.
- `gitleaks`/`trufflehog` indisponíveis → varredura manual.
- Conteúdo de `public/Fotos/` (28 arquivos) e `backups/` (26 arquivos) — varridos por padrões, não revisados linha a linha.
- Headers efetivamente servidos no CDN/WAF da Vercel.
- Políticas de bucket (`images`, `Imagens`) e cripto em repouso no painel Supabase.
- Rotas `/api/cron/*` e crons do `vercel.json` — autenticação parcialmente coberta (F1C-009), runtime não.
- RBAC por papel nas rotas que **já** têm auth (só foi mapeada presença de auth).
- `npm audit` (24 vulns / 4 críticas) reportado na Fase 0, não reproduzido aqui.

---

# F. TOP 5 AÇÕES (1C)

1. **Religar o perímetro com prova em CI**: `middleware.ts` → `src/middleware.ts`, revisar
   `PUBLIC_ROUTES` antes, e gate que falha se `.next/server/middleware-manifest.json` vier com
   `"middleware": {}`. *(F1C-001/101 — causa raiz.)*
2. **Cortar o vazamento de credenciais por API**: `select` explícito em
   `GET /api/establishments` e no `[slug]`/`POST /api/orders`, nunca serializar `*Certificate*`,
   `*ApiKey*`, `*Secret*`, `*Token*`, `password`; fechar IDOR em `delivery-config`; exigir auth
   nas 9 rotas `meta-*`; remover `test-dispatch`/`asaas-test`. *(F1C-002/003/010/011/012/102/108/110.)*
3. **ROTACIONAR tudo** (repo público + endpoints abertos): senhas de `Admin@…` e dos usuários do
   `dev.db`, `JWT_SECRET`, `CRON_SECRET`, `IFOOD_CLIENT_SECRET`, `META_APP_SECRET`,
   `ASAAS_API_KEY`, `PAGARME_API_KEY`, `INTER/EFI_CLIENT_SECRET` **+ novos certificados .p12**,
   e por loja `metaAccessToken`, `evolutionApiKey`, `asaasApiKey`, `pagarmeApiKey`, `api99Key`,
   `ifoodAccessToken`. Remover `Admin@…` do seed e o `.env.production` do histórico.
4. **Parar de imprimir segredo**: apagar `devCode` e os `console.log` de OTP/reset/token/Meta;
   desligar `SHOW_DEV_CODE`; falhar-closed nos crons. *(F1C-004/008/009/111/116/119/123.)*
5. **Fechar dinheiro**: recalcular preço/desconto/cupom no servidor (criar
   `/api/coupons/validate`), envolver estoque em `$transaction`, exigir auth em
   `POST /api/cash-register`, validar assinatura dos webhooks Efi/Inter/99/assinatura e trocar
   `Float` por `Decimal`. *(F1C-201…213.)*
