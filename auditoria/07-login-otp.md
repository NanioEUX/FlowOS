# FASE 7 — LOGIN DO CLIENTE POR CÓDIGO NO WHATSAPP

**Saída:** `auditoria/07-login-otp.md` · Somente leitura · Nenhum comando executado contra
banco/produção · Scripts em `auditoria/testes/7-0*.sh` com **obtido = NÃO EXECUTADO**.

Escopo: seção 7 do termo (`AUDITORIA-SAAS-FOOD.txt:427-488`), itens 7.0 a 7.8.

---

## 1. Resumo

**Não é Supabase Auth, não é Edge Function e não é JWT de cliente.** O login é **100% lógica
customizada** numa tabela Prisma (`VerificationCode`, `schema.prisma:287-301`), com rota própria
(`src/app/api/verification/route.ts`) e "sessão" = uma **flag em `localStorage`** sem expiração
(`menu-page.tsx:594-599`). O `src/lib/supabase.ts` só cria um client de Storage — nada de auth.

O coração do fluxo tem acertos reais: o código é guardado em **hash bcrypt**, expira em 5 min, é
de **uso único**, invalida códigos anteriores, tem 3 tentativas e os limites de envio (60 s / 5/h
/ 10/dia) são **persistidos em banco** — melhor que o `Map` em memória usado no login da equipe.

Mas **a autenticação é decorativa**: a resposta da API devolve o código para quem pediu
(`devCode` em **todos** os caminhos de retorno, inclusive com envio bem-sucedido), o código vai
para os logs, o gerador usa `Math.random`, não há rate limit por IP, o template usado não é de
categoria `AUTHENTICATION` (é `UTILITY`, com texto de "protocolo de atendimento") e — o mais
grave — **nenhuma rota de cliente exige a sessão**: `orders/customer`, `addresses`, `customers` e
`payment-request` continuam abertos a qualquer um que saiba um telefone.

**Nota da área: 3,5/10.** A UX do OTP é boa; a segurança do OTP é contornável em uma linha.

| Severidade | Qtd |
|---|---|
| CRÍTICO | 10 |
| ALTO | 12 |
| MÉDIO | 9 |
| BAIXO | 5 |
| **Total** | **36 únicos** (46 linhas brutas F7A+F7B, 10 duplicatas internas unificadas) |

Dos 36: **22 novos** e **14 repetições/detalhes** de fases anteriores (coluna `Origem`).

---

## 2. Tabela de achados

| ID | Sev. | Origem | Título | Evidência | Esforço |
|---|---|---|---|---|---|
| **F7A-001 / F7B-001** | **CRÍTICO** | Rep. F1C-004 | A API entrega o OTP: `devCode` em **todos** os retornos (sem provedor, falha e envio OK) + `verifyLink` com o código na query; `showDevCode` é dead code | `verification/route.ts:156,250-257,261-267,136,243-246` | P |
| **F7A-002 / F7B-013** | **CRÍTICO** | Rep. F1C-008 | OTP em `console.log` de produção + payload do template (com o código) logado + prefixo do `metaAccessToken` logado | `verification/route.ts:155,138,260`; `whatsapp/meta.ts:100` | P |
| **F7A-003 / F7B-018** | **CRÍTICO** | Rep. F0 | Código gerado com `Math.random` (não criptográfico), 6 dígitos | `verification/route.ts:99` | P |
| **F7A-004 / F7B-003** | **CRÍTICO** | Rep. F1A-004 / F6A-008 | `GET /api/orders/customer` anônimo: histórico de qualquer telefone em qualquer loja, com `pixPayload`, `trackingToken`, `deliveryCode` e endereço | `orders/customer/route.ts:4-11,42-78`; `middleware.ts:14` | P |
| **F7A-005** | **CRÍTICO** | Novo (det. F6A-025) | `GET/POST/PATCH/DELETE /api/addresses` por `customerId` vindo do cliente, **e o front já busca os endereços antes do OTP** | `addresses/route.ts:4-11,14-37,40-178`; `menu-page.tsx:1213-1236,1479-1506` | P |
| **F7A-006 / F7B-004** | **CRÍTICO** | Rep. F1A-011 | `GET/POST/PUT /api/customers` públicos: enumeração por telefone/CPF, adulteração de PII e **troca do `phone` de qualquer `customerId`** (sequestro de cadastro) | `customers/route.ts:16-49,65-114,116-147`; `verifyAuth` só em `:52` (inalcançável) | P |
| **F7A-007** | **CRÍTICO** | Rep. F6A-004 | `PATCH /api/payment-request` anônimo marca pedidos como `paid`/`delivered` de qualquer loja; `GET` devolve as mesas | `payment-request/route.ts:48-83,4-46` | P |
| **F7B-002** | **CRÍTICO** | Rep. F1A-004 | `GET /api/orders` público devolve todos os pedidos + `customer` de qualquer tenant | `orders/route.ts:690-748`; `middleware.ts:14` | P |
| **F7A-013 / F7B-005** | **CRÍTICO** | **Novo** | OTP vai em template **UTILITY** (`atualizacao_suporte_v1`, texto de "protocolo de atendimento") e `findApprovedTemplate` escolhe **qualquer** template aprovado `pt_BR`, sem checar categoria — a Meta exige `AUTHENTICATION` | `whatsapp/meta.ts:300-303,416-419`; `verification/route.ts:165,187-192` | M |
| **F7B-006** | **CRÍTICO** | Rep. F1C-003 | `GET /api/establishments/[id]` devolve o registro **inteiro** (32 segredos + pedidos + catálogo) a qualquer role autenticado da própria loja — `verifyAuth` não checa `role`/`permissions` | `establishments/[id]/route.ts:9-35`; `lib/auth.ts:12-30` | P |
| **F7A-008 / F7B-023** | ALTO | **Novo** | `GET` com efeito colateral: `/api/orders` e `/api/orders/customer` marcam pedidos `abandoned` via `updateMany` dentro de um GET público | `orders/customer/route.ts:24-34`; `orders/route.ts:703-712` | P |
| **F7A-009 / F7B-011** | ALTO | **Novo** | Rate limit **só por número**: nenhum teto por IP, dispositivo ou loja; `checkRateLimit` não é usado nesta rota; `BYPASS_PHONES` é ilimitado | `verification/route.ts:14,60-90` (imports `:1-4` sem `rate-limit`) | M |
| **F7A-010** | ALTO | **Novo** | Normalização fraca: `>= 10` dígitos, **sem teto** e sem strip de `55` (API) vs 11 (front) → contas duplicadas e **bypass do rate limit** por variação do mesmo número | `verification/route.ts:32-35,288`; `whatsapp/meta.ts:24-32`; `menu-page.tsx:3617,3624` | M |
| **F7A-011** | ALTO | **Novo** | Respostas distintas para errado/expirado/inexistente, `remaining` exposto e **race** no contador de tentativas (lê → compara → incrementa) | `verification/route.ts:318-320,322-336` | P |
| **F7A-012** | ALTO | **Novo** | Sem cota por loja antes do envio; sem provedor cai no **fallback Meta do SaaS** (custo da plataforma); `trackMessageCost` não tem categoria `authentication`; cron `meta-quota` **não está agendado** | `verification/route.ts:141-149`; `whatsapp/index.ts:61-69`; `meta-quota.ts:4-8,129-142`; `vercel.json:1-9` | M |
| **F7A-014** | ALTO | **Novo** | Troca de telefone no perfil **sem re-OTP do novo número** e **sem fluxo de recuperação** (perdeu o chip = perdeu a conta) | `menu-page.tsx:3866-3877,3917-3942`; `customers/route.ts:137-145` | M |
| **F7A-015 / F7B-008** | ALTO | **Novo** | Não existe sessão de servidor: flag `localStorage` sem TTL/renewal/revogação, `whatsappVerified=true` para sempre e **nenhuma rota de cliente exige a verificação** — os gates (carrinho/pedido/perfil) são só de front | `menu-page.tsx:594-610,627-640,1551,1938,3920,4356`; `schema.prisma:251-253`; `verification/route.ts:347-355` | G |
| **F7A-016 / F7B-007** | ALTO | Rep. F1C-001 + **detalhe novo** | `middleware.ts` fora do build **e** `PUBLIC_ROUTES` **não contém** `/api/verification` nem `/api/addresses` → ao religar o middleware sem ajuste, o próprio login do cliente recebe 401 | `middleware.ts:10-21`; ausência de `src/middleware.ts`; `.next/…/middleware-manifest.json` = `{}` | P |
| **F7B-009** | ALTO | Rep. F1C-010 (corrigido) | As 9 rotas `meta-*` **não** exigem tenant: qualquer JWT de staff opera na WABA de outra loja (criar template, resetar consumo, ler quota) | `establishments/[id]/meta-create-template/route.ts:10-28`; `meta-consumption-reset/route.ts:4-21`; `middleware.ts:45-49` | M |
| **F7B-010** | ALTO | **Novo** | Webhook WhatsApp forjável: sem `X-Hub-Signature-256`, verify token com fallback `"flowos-meta-verify"`, apikey do Evolution validada **só se o header existir** | `webhooks/whatsapp/route.ts:17,72,80-151,197-207` | M |
| **F7B-012** | ALTO | **Novo** | Sem fallback de canal (SMS/e-mail) e sem correlação do webhook de status com `VerificationCode`; WhatsApp da loja fora ⇒ o "fallback" é **exibir o código na tela** | `webhooks/whatsapp/route.ts:102-151`; `menu-page.tsx:3642-3652` | M |
| **F7B-016** | ALTO | Rep. F6A-004/005/025 | `payment-request` e `addresses` sem checagem de tenant no handler: qualquer JWT lê/edita dados de outra loja | `payment-request/route.ts:4-45`; `addresses/route.ts:4-32` | M |
| **F7A-017** | MÉD | **Novo** | Enumeração: `customers?phone=`/`?cpf=` (registro vs `notFound`) e `PUT /api/verification` (404 "Cliente não encontrado" vs 400 "Código expirado") | `customers/route.ts:23,33,48`; `verification/route.ts:294-296,318-320` | P |
| **F7A-018** | MÉD | **Novo** | Criação irrestrita de `Customer` e `VerificationCode` para qualquer número **antes** de validar tenant/limites, e auto-criação de template Meta sob demanda | `verification/route.ts:42-51,103-110,113-130,196-225` | P |
| **F7A-019** | MÉD | **Novo** | Zero captcha/Turnstile em porta de entrada; `POST /api/establishments` (cadastro de loja) público, sem rate limit e devolve o objeto **com hash de senha** | grep `turnstile\|captcha\|hcaptcha` = 0; `cadastro/page.tsx:67`; `establishments/route.ts:12,103` vs `:136,149` | M |
| **F7A-020** | MÉD | **Novo** | Cron de lembrete amplia o assédio: +1 mensagem para todo código não usado (inclusive os pedidos para número de terceiro) | `cron/verify-reminder/route.ts:56-90`; default `false` em `schema.prisma:25-27` | P |
| **F7B-014** | MÉD | Rep. F1D | LGPD: nenhum `prisma.customer.delete` no repo — direito ao esquecimento só "entre em contato por e-mail" | grep = 0; `politica-de-privacidade/page.tsx:102,112` | M |
| **F7B-015** | MÉD | **Novo** | Sem aviso de privacidade/consentimento na tela OTP; `/politica-de-privacidade` **não é linkada em lugar nenhum**; sem opt-in de marketing separado | `menu-page.tsx:3613`; grep `politica-de-privacidade` = só o próprio arquivo | P |
| **F7B-017** | MÉD | Rep. F1A escalonamento | `PATCH /api/users/[id]` aceita `role` sem checar a permissão do editor | `users/[id]/route.ts:11-28` | P |
| **F7B-019** | MÉD | **Novo** | Sem temporizador visual de reenvio (só "Reenviando…" + 429 do servidor) | `menu-page.tsx:3708-3716`; `verification/route.ts:69-71` | P |
| **F7B-020** | MÉD | **Novo** | `MetaCloudProvider.sendVerificationCode` (interativo `cta_copy` com `copy_code_text` — a implementação **correta** para OTP) é **código morto**; o fluxo usa template/texto | `whatsapp/meta.ts:125-167`; grep `sendVerificationCode` = só definição | P |
| **F7A-021** | BAIXO | Rep. F1C-020 | `BYPASS_PHONES` hardcoded (2 telefones reais) isento dos limites diários | `verification/route.ts:14,62,79,88,300` | P |
| **F7A-022** | BAIXO | **Novo** | `VerificationCode` nunca é podado e `purpose` não escopa a validação | `schema.prisma:287-301`; `verification/route.ts:309-316` | P |
| **F7A-023** | BAIXO | **Novo** | Zero testes automatizados para `/api/verification` | `vitest.config.ts:14-24`; 6 arquivos `*.test.*` existentes são de entrega/99 | M |
| **F7B-021** | BAIXO | **Novo** | Nenhum tratamento de navegador embutido (Instagram/WhatsApp/webview) | grep `navigator.userAgent` em `src` = 0 | M |
| **F7B-022** | BAIXO | **Novo** | `verify-reminder` documentado "de hora em hora", agendado **diário 02:00**; lembrete enviado como texto simples (fora de template) | `cron/verify-reminder/route.ts:8-9,77`; `vercel.json:4-8` | P |

---

## 3. 7.0 — Mapear o fluxo real

```
[1] Visitante em /<slug>  ── botão "Enviar código" (menu-page.tsx:3614-3628)
     ⚠ grava `phone` em state ANTES do OTP (:3618) e persiste (:422-426)
        │  POST /api/verification {phone, establishmentId, name?}   :527
        ▼
[2] Geração + limites   (api/verification/route.ts — LÓGICA CUSTOMIZADA)
     normaliza: replace(/\D/g,""), só exige >=10 dígitos        :32-35
     find-or-create Customer (phone + establishmentId)          :38-58
     limites POR NÚMERO, persistidos em DB: 60s / 5/h / 10/d    :64-90
     invalida códigos anteriores                                :93-96
     code = Math.random (6 dígitos)  ⚠                          :99
     codeHash = bcrypt(cost 10) · expiresAt = +5 min            :100-101
     INSERT VerificationCode {codeHash, purpose, attempts:0}     :103-110
        │  getWhatsAppProvider(): loja → fallback Evolution SaaS → fallback Meta SaaS
        ▼
[3] Envio
     1º TEMPLATE: qualquer template aprovado pt_BR  (meta.ts:416-419)
        ou auto-cria "atualizacao_suporte_v1" UTILITY (meta.ts:300-303)
     2º texto livre com o código                (route.ts:233-241)
     ⚠ console.log do código (:155, :260) e do payload (meta.ts:100)
        │
        ▼
[4] RESPOSTA — 200 em TODOS os caminhos:
     { success, verifyLink: "...?code=NNNNNN&phone=...", devCode }
     :156 (sem provedor) · :250-257 (falha) · :261-267 (envio OK)
     showDevCode (:243) é DEAD CODE — SHOW_DEV_CODE/`?debug=1` não fazem efeito
        │
        ▼
[5] Front: PUT /api/verification {phone, establishmentId, code}  :560, :2620
     → 404 se sem cliente (:294-296) · 5 verificações/dia (:298-306)
       → busca código usado/expirado (:309-316) · attempts>=3 → 429 (:322)
       → bcrypt.compare (:326) · used=true (:339) · whatsappVerified=true (:347-355)
     → menu-page grava flag de sessão
        │
        ▼
[6] "SESSÃO" = localStorage  flowos-session-verified-<slug> = "1"
     sem TTL, sem renewal, sem revogação (:594-599, :627-640, :4356)
     + flag permanente no banco: Customer.whatsappVerified/verifiedAt
     establishmentId entra só como parâmetro de request e na CHAVE da flag —
     NUNCA é assinado.
```

**Resposta direta:** lógica customizada em tabela Prisma; sessão = flag de `localStorage`.
Não há cookie assinado, nem JWT de cliente, nem Supabase Auth (`src/lib/supabase.ts` só cria
client de Storage, usado por `api/ifood-catalog/import/route.ts:4`).

### Fluxo próprio × Supabase Auth (para decidir manter vs migrar)

| Capacidade | Fluxo próprio (verificado) | Supabase Auth (phone OTP)¹ |
|---|---|---|
| Aleatoriedade forte | ❌ `Math.random` (`route.ts:99`) | ✅ |
| Hash do código | ✅ bcrypt cost 10 (`route.ts:100`) | ✅ |
| Texto puro no banco | ✅ só `codeHash` (`schema.prisma:291`) | ✅ |
| Expiração | ✅ 5 min fixo (`route.ts:7,101`) | ✅ configurável |
| Uso único | ✅ invalida anteriores (`:93-96`) + `used` (`:339-342`) | ✅ |
| Tentativas | ⚠ 3 por código, **com race** (`:322-333`), sem por IP | ✅ |
| Rate limit de envio | ✅ 60 s/5 h/10 d **em banco** (`:64-90`) — melhor que o `Map` | ✅ |
| Rate limit por IP/loja | ❌ nenhum | ⚠ parcial |
| Sessão pós-validação | ❌ flag `localStorage` sem TTL | ✅ `access_token`+`refresh_token` revogáveis |
| Fallback SMS/e-mail | ❌ só WhatsApp | ✅ |
| Custo/cota por loja | ❌ não verifica; paga o fallback do SaaS | ⚠ cobrado, com cota do projeto |
| Isolamento multi-tenant | ✅ `Customer` por `establishmentId` + `@@unique` | ⚠ auth é global por telefone |
| Entrega de OTP em template certo | ❌ usa `UTILITY` (F7A-013) | ✅ provider gere |

¹ Coluna baseada em conhecimento geral do produto — **NÃO VERIFICADA** nesta auditoria.

**Recomendação: manter e corrigir (~4 dias), não migrar (2-3 semanas).** Os CRÍTICO desta fase
estão **fora** da validação de OTP: `orders/customer`, `addresses`, `customers` e
`payment-request` confiam em `phone`/`customerId` do request. Migrar para Supabase Auth **não**
resolveria — ainda seria preciso trocar "telefone no body" por "token de cliente". O que falta ao
fluxo próprio e o Supabase entregaria pronto (sessão revogável, fallback de canal, lockout) pode
ser feito com `jose`, que já é dependência do projeto.

---

## 4. 7.1 — Geração e armazenamento do código

| Requisito | Situação | Evidência |
|---|---|---|
| Fonte criptográfica | ❌ `Math.floor(100000 + Math.random()*900000)` | `verification/route.ts:99` |
| Mínimo 6 dígitos | ✅ 6 dígitos (900 mil combinações) | `:99` |
| Validade curta (5-10 min) | ✅ 5 min | `:7`, `:101` |
| Uso único | ✅ invalida anteriores e marca `used` no sucesso | `:93-96`, `:339-342` |
| Armazenado em hash | ✅ bcrypt cost 10; só `codeHash` no banco | `:100`; `schema.prisma:291` |
| Quem lê a tabela | ❌ **sem RLS** (nenhuma política no repo; `grep policy` = 0) — mas a validação lê por `customerId`, não por id arbitrário | `:309-316` |
| Código em logs | ❌ `console.log` em `:155` e `:260` + payload do template em `meta.ts:100` | |
| Código em resposta da API | ❌ **sempre**: `devCode` nos 3 retornos de sucesso + `verifyLink` com `?code=` | `:156`, `:250-257`, `:261-267`, `:136` |
| Modo debug/dev | ⚠ `showDevCode` (`:243`) é **dead code** (1 ocorrência, nunca lido) → `SHOW_DEV_CODE=true` no `.env:31` está **inerte**; o vazamento é incondicional | `:243-246` |

Detalhe importante: o `verifyLink` também sai em **todos** os 200 e **nenhum consumidor existe**
(`grep -rn "verifyLink" src` fora da rota → 0) — é vazamento sem função de produto.

---

## 5. 7.2 — Força bruta e abuso

| Requisito | Situação | Evidência |
|---|---|---|
| Tentativas de validação por número | ✅ 3 (`MAX_ATTEMPTS`) | `:6`, `:322-324` |
| Tentativas por IP | ❌ nenhum | imports `:1-4` sem `rate-limit`; grep `x-forwarded-for` não usado aqui |
| Comparação em tempo constante | ✅ `bcrypt.compare` usa `safeStringCompare` | `node_modules/batch…/bcryptjs/index.js:205,211` |
| Resposta igual para errado/expirado | ❌ 3 respostas distintas: 404 "Cliente não encontrado" (`:294-296`), 400 "Código expirado ou não encontrado" (`:318-320`), 400 "Código incorreto. **N tentativa(s) restante(s)**" (`:328-335`) | |
| Race no contador | ❌ lê `attempts` (`:322`) → compara (`:326`) → incrementa (`:330-333`) — requisições paralelas leem `attempts=0` e todas comparam | |
| Rate limit de ENVIO no servidor | ✅ por número: cooldown 60 s, 5/h, 10/dia, 5 verificações/dia — **persistido em banco** | `:64-90`, `:298-306` |
| Por IP/dispositivo/loja | ❌ nenhum → 20 números distintos do mesmo IP = 20 envios | `:60-90` |
| Trava de reenvio só no botão? | ⚠ **não** — o servidor devolve 429 com o tempo de espera (`:69-72`); o botão só tem `disabled={verifySending}` (`menu-page.tsx:3711`) | ok aqui |
| Captcha/Turnstile | ❌ grep = 0 em `src` | `F7A-019` |
| **Custo** Meta / teto por loja | ❌ a rota nunca consulta `messagingLimit`/`currentUsage`/`isBlocked`; `trackMessageCost` não tem categoria `authentication` e não é chamado; cron `meta-quota` diz "hourly" mas `vercel.json` agenda **só** `verify-reminder` e `sync-ifood-status` | `verification/route.ts:141-149`; `meta-quota.ts:4-8,129-142`; `vercel.json:1-9` |
| Quem paga o envio | ⚠ sem provedor na loja cai no **fallback do SaaS** (`SAAS_META_*`) → custo de OTP de qualquer tenant sai da plataforma | `whatsapp/index.ts:61-69` |
| Spam/assédio a terceiros | ❌ a vítima recebe até **10/dia por loja** (+ até 10 lembretes se `verifyReminderEnabled`); `BYPASS_PHONES` é ilimitado | `:83-90`; `cron/verify-reminder:56-90`; `:14` |
| Enumeração | ❌ respostas distintas (ver acima) | `F7A-017` |

---

## 6. 7.3 — Identidade e tomada de conta

| Requisito | Situação | Evidência |
|---|---|---|
| Nome é só rótulo (não sobrescreve antes de autenticar) | ✅ **no OTP**: só preenche se vazio e o input fica `readonly` quando há nome | `verification/route.ts:52-58,353`; `menu-page.tsx:3597` |
| …mas sobrescreve **por outra rota** | ❌ `POST /api/customers` anônimo grava nome/endereço/CEP/CPF de quem já existe só com `phone` | `customers/route.ts:91-102` |
| Número de outra pessoa dá acesso sem código? | ❌ **sim, indiretamente**: `devCode` na resposta (`F7A-001`) — bastando saber o telefone | |
| Normalização (+55, DDD, nono dígito, espaços) | ❌ `replace(/\D/g,"")` + `>=10` sem teto e sem strip de `55`; front exige 11 → API aceita 10 → mesmas contas distintas = **limite dobrado** | `verification/route.ts:32-35,288`; `menu-page.tsx:3617,3624` |
| Número reciclado pela operadora | ❌ sem mascaramento na exibição; o novo dono com o código vê histórico e endereços do antigo | `F7A-004/005` |
| Troca de número / recuperação | ❌ sem re-OTP do número novo e **sem fluxo de recuperação**; "Sair" só apaga `localStorage` | `menu-page.tsx:3866-3877,3917-3942,4356`; `customers/route.ts:137-145` |
| Isolamento (só seus pedidos/endereços) | ❌ `orders/customer` aceita `phone`+`establishmentId` livres; `addresses` aceita `customerId` livre | `F7A-004/005` |
| Sessão da loja A vale na loja B? | **Não vale** — a flag é por `slug` (`menu-page.tsx:594`) e o `Customer` é por `establishmentId` (`schema.prisma:264`); **mas é irrelevante**, porque nenhuma rota exige a flag | `F7A-015` |

---

## 7. 7.4 — Sessão

| Item | Situação | Evidência |
|---|---|---|
| Armazenamento | ❌ `localStorage` (`flowos-session-verified-<slug>` = `"1"`) — não é cookie, logo não é `httpOnly`/`secure`/`sameSite` | `menu-page.tsx:594-599` |
| Expiração | ❌ nenhuma; restaurada sem prazo | `:627-640` |
| Logout efetivo | ❌ só apaga o `localStorage` local; nada é invalidado no servidor; `whatsappVerified` fica `true` para sempre | `:4356`; `schema.prisma:251-253` |
| Invalidação de sessões antigas | ❌ inexistente | — |
| Claims do JWT | ⚠ o cliente final **não recebe JWT algum** (nenhum endpoint de auth para cliente) → não consegue alterar `role`/`tenant` | — |
| …mas a equipe pode | ❌ `PATCH /api/users/[id]` aceita `role` sem checar o editor; `verifyAuth` não valida `role`/`permissions` (0 checagens de permissão na API) | `users/[id]/route.ts:11-28`; `lib/auth.ts:12-30` |
| Separação cliente × equipe | ✅ tabelas distintas (`Customer` × `User`), rotas distintas; não há `verifyCustomerAuth` | `schema.prisma:233-266,647-664` |
| JWT da equipe em `localStorage` | ❌ (F1C-018) — e o login **também** seta cookie httpOnly `auth_token` que **nenhuma rota usa** | `fetch-auth.ts:1-11`; `auth/login/route.ts:108-114` vs `lib/auth.ts:14` |

---

## 8. 7.5 — Entrega pelo WhatsApp (API oficial da Meta)

| Item | Situação | Evidência |
|---|---|---|
| Template `AUTHENTICATION` | ❌ **não**: usa `atualizacao_suporte_v1` com `category: "UTILITY"` e texto de protocolo; `findApprovedTemplate` aceita **qualquer** template `APPROVED` em `pt_BR` sem checar categoria | `whatsapp/meta.ts:300-303,416-419`; `verification/route.ts:165,187-192` |
| Implementação correta existe mas está morta | ⚠ `MetaCloudProvider.sendVerificationCode` usa interativo `cta_copy` com `copy_code_text` — nunca é chamado | `whatsapp/meta.ts:125-167` |
| Qual número envia | por loja (`metaPhoneNumberId`/`whatsappNumber`/`evolutionInstanceName`) com **fallback para o número do SaaS** se a loja não tiver provedor → abuso afeta a loja vítima **e** a plataforma | `whatsapp/index.ts:23-69` |
| Webhook de status | ⚠ processa só pricing/erro 131048; **nunca** é correlacionado com `VerificationCode`; sem `X-Hub-Signature-256` | `webhooks/whatsapp/route.ts:80-151` |
| Mensagem se não chegar | ❌ o front **exibe o próprio código na tela** em caixa âmbar ("WhatsApp não entregou — código visível") — funciona só porque `devCode` vem na resposta | `menu-page.tsx:540-541,3645-3656` |
| Fallback SMS/e-mail | ❌ inexistente | — |
| Limite de reenvios | ✅ cooldown 60 s no servidor; ❌ sem temporizador visual | `verification/route.ts:69-72`; `menu-page.tsx:3708-3716` |
| Cliente avisado de que receberá mensagens | ❌ tela só diz "Verificaremos seu WhatsApp antes do primeiro pedido." | `menu-page.tsx:3613` |
| Token Meta no navegador | ⚠ nunca via chamada direta (grep `graph.facebook` só em `src/app/api/**` e `src/lib/**` ✅) — **mas** devolvido pelo `GET /api/establishments/[id]` a qualquer role da loja | `establishments/[id]/route.ts:9-35` |

---

## 9. 7.6 — LGPD

| Item | Situação | Evidência |
|---|---|---|
| Finalidade/retenção declaradas | ⚠ existe `politica-de-privacidade/page.tsx` (retenção "até 5 anos", direitos, WhatsApp/Meta declarado) | `politica-de-privacidade/page.tsx:72-116` |
| Exclusão/consulta pelo cliente | ❌ **nenhum** `prisma.customer.delete` no repo; direito ao esquecimento = "entre em contato por e-mail" | grep = 0 |
| Aviso na tela de login | ❌ sem consentimento, sem finalidade, sem link para a política | `menu-page.tsx:3613` |
| Política linkada no app | ❌ grep `politica-de-privacidade` = só o próprio arquivo | — |
| Opt-in de marketing separado | ❌ não existe fluxo de marketing ao cliente final neste escopo (a política afirma não usar WhatsApp para marketing) | `politica-de-privacidade/page.tsx:77` |
| Logs de autenticação | ❌ guardam o **código completo** e o telefone **integral** (sem mascaramento) | `verification/route.ts:155,260` |

---

## 10. 7.7 — UX e confiabilidade

| Item | Situação | Evidência |
|---|---|---|
| `autocomplete="one-time-code"` | ✅ no 1º input (`i === 0 ? "one-time-code" : "off"`) | `menu-page.tsx:3676` |
| `inputmode` numérico | ✅ `inputMode="numeric"` | `:3675` |
| Colar o código | ✅ `onPaste` + botão "Colar" com fallback de clipboard | `:3681`; `:684-712` |
| Mensagens de erro claras | ✅ em pt-BR, com tentativas restantes | `:3697-3716` |
| Temporizador de reenvio | ❌ só "Reenviando…" + 429 do servidor | `:3708-3716` |
| Estado de carregamento | ✅ spinners de envio/validação | `:3697-3716` |
| Navegador embutido (Instagram/WhatsApp) | ❌ grep `navigator.userAgent` = 0 em `src` | `F7B-021` |
| WhatsApp da loja fora / token expirado | ⚠ o cliente **não fica impedido**: o envio cai em fallback, e se falhar o próprio código é exibido na tela — mas esse é o comportamento errado (expõe o OTP) | `menu-page.tsx:540-541,3645-3656` |
| Limpar a URL após o link | ✅ `replaceState` remove `?code=`/`?phone=` | `menu-page.tsx:2602-2604` |

---

## 11. 7.8 — Testes a executar (roteiro + resultado)

| # | Teste | Conclusão **estática** (com evidência) | O que exige execução | Obtido |
|---|---|---|---|---|
| 1 | 1.000 códigos para o mesmo número | **Contido a 10/dia** (5/h, cooldown 60 s), códigos antigos invalidados a cada emissão (`verification/route.ts:64-96`) — **exceto** se o número estiver em `BYPASS_PHONES` (`:14`), aí só o cooldown de 60 s limita (~1.440/dia) | Medir se requisições simultâneas passam do cooldown (sem lock/transação) e o consumo de cota/custo | **NÃO EXECUTADO** |
| 2 | 20 envios/1 min — mesmo número e números diferentes do mesmo IP | **Mesmo número: bloqueado** (cooldown 60 s, `:69-72`). **Números diferentes do mesmo IP: PASSA** — rate limit é só por `customerId`, sem checagem de IP (`:60-90`) | Confirmar 20/20 aceitos e reação da Meta (erro 131047/quality rating) | **NÃO EXECUTADO** |
| 3 | Reutilizar código usado/expirado | **Protegido estaticamente**: busca exige `used:false` e `expiresAt > now` (`:309-316`); sucesso marca `used` (`:339-342`); nova emissão derruba os anteriores (`:93-96`); 3 tentativas (`:322-324`) | Testar race de `used` (2 validações paralelas do mesmo código) | **NÃO EXECUTADO** |
| 4 | Código do número A validado na sessão do número B | **No servidor: impossível** — o código é atrelado ao `customerId` do A (`:290-316`). **Mas irrelevante**: o POST devolve `devCode` (`:261-267`) e o `verifyLink` aceita `?code=&phone=` em qualquer navegador (`menu-page.tsx:2595-2624`) | Confirmar que `devCode` trafega em produção | **NÃO EXECUTADO** |
| 5 | Código aparece na resposta/logs/Network | **CONFIRMADO por código — falha severa**: `devCode` nos 3 retornos (`:156,:250-257,:261-267`), `verifyLink` na query (`:136`), logs em `:155,:260` e payload do template em `meta.ts:100` | Só para registrar a evidência na aba Network | **NÃO EXECUTADO** (falha já provada por leitura) |
| 6 | Loja A lê pedidos da loja B e de outro cliente | **Possível sem logar**: `GET /api/orders?establishmentId=<B>` (`orders/route.ts:690-748`, pública via `middleware.ts:14`) · `GET /api/orders/customer?phone=<vítima>` (`:42-78`) · `GET /api/customers?phone=` (`customers/route.ts:28-48`) · `addresses`/`payment-request` aceitam qualquer JWT sem checar tenant | Confirmar o comportamento do middleware no deploy da Vercel | **NÃO EXECUTADO** |

**Scripts gravados** (todos `obtido = NÃO EXECUTADO`):

| Arquivo | Cobre |
|---|---|
| `auditoria/testes/7-01-otp-brute-force.sh` | Testes 1 e 2 — **destrutivo/caro** (dispara mensagens reais), só ambiente de teste |
| `auditoria/testes/7-02-codigo-reuso-e-sessao.sh` | Testes 3, 4 e 5 — reuso, código de outro número, vazamento na resposta + enumeração |
| `auditoria/testes/7-03-isolamento-lojas.sh` | Teste 6 — 12 chamadas GET de leitura cruzada loja A × loja B × outro cliente |

---

## 12. O que está bom

1. **Hash do OTP**: bcrypt cost 10 (`verification/route.ts:100`) e comparação via `bcrypt.compare`
   com `safeStringCompare` → **não** há timing leak de string.
2. **Código nunca em texto puro**: só `codeHash` (`schema.prisma:291`).
3. **Uso único + invalidação na renovação** (`:93-96`, `:339-342`).
4. **Rate limit de envio persistido em banco** (`:64-90`), não em `Map` — sobrevive a cold start
   (melhor que o `rate-limit.ts:6` do login da equipe).
5. **Expiração 5 min, 3 tentativas, 5 logins/dia** (`:7`, `:322`, `:298-306`) — desenhados certo.
6. **Identidade por loja**: `establishmentId` em toda consulta e `@@unique([establishmentId,
   phone])` (`schema.prisma:264`); a sessão é por `slug` (`menu-page.tsx:594`) → não vaza entre
   lojas do SaaS.
7. **O nome digitado não sobrescreve dado existente no OTP** (`:52-58,353`) e o input fica
   `readonly` quando há nome (`menu-page.tsx:3597`).
8. **Reenvio travado no servidor**, não só no botão (`:69-72`).
9. **UX do OTP**: `inputMode="numeric"`, `autoComplete="one-time-code"`, `onPaste` + botão
   "Colar", spinners e erros em pt-BR (`menu-page.tsx:3670-3686,684-712`).
10. **O código da URL é removido logo após o auto-login** (`menu-page.tsx:2602-2604`).
11. **Auto-relogin pós-OTP revalida contra o servidor** com janela de 5 min (cross-tab `:2434-2484`,
    focus `:2492-2539`, polling `:2547-2591`) em vez de confiar só no `localStorage`.
12. **`/api/auth/forgot` e `/reset` não devolvem token** e respondem sempre igual (anti-enumeração);
    token é `crypto.randomBytes(32)` (`forgot:27`).
13. **Envio sempre pelo servidor**: nenhuma chamada direta do browser à API Meta.
14. **Cron `verify-reminder` protegido por `CRON_SECRET`** com `reminderSentAt` para não repetir.
15. **O cliente final nunca recebe JWT** → não explora `PATCH /api/users/[id]` diretamente.
16. **`.env` não é rastreado pelo git** (`git ls-files` sem `.env`).
17. **`trackingToken` com `crypto.randomBytes(12)`** (96 bits) — forte.

---

## 13. NÃO VERIFICADO

- **Deploy da Vercel**: se o middleware está ativo no ambiente (F7A-016/F7B-007 foi inferido do
  build local); se `PUBLIC_ROUTES` do build de produção é o mesmo do repo.
- Se os logs da Vercel retêm os `console.log` com código/telefone (muito provável, não confirmado).
- Se os templates existentes nas WABAs dos clientes estão `APPROVED` e em qual categoria.
- Qualidade do número, tier de messaging e bloqueios já aplicados pela Meta (exige painel Meta).
- Volume/custo real de mensagens e se há alerta de fatura no painel Meta.
- RLS no painel Supabase (fora do repo — não há nenhuma política escrita).
- Comportamento do template na caixa do usuário (só leitura de código).
- Coluna "Supabase Auth" da tabela comparativa — conhecimento geral, sem consulta à doc.
- Race do contador de tentativas (F7A-011) — conclusão de leitura, não medida.
- Processos manuais de LGPD fora do código (e-mails, planilhas) — a inexistência de endpoint é
  fato; a inexistência de processo, não.
- Conteúdo de `.env`/`.env.local` (não lidos — fora do escopo).
- Os 6 testes da 7.8 — todos exigem execução.

---

## 14. Top 5 ações

1. **Parar de entregar o OTP (P, 1 dia)** — remover `devCode` e `verifyLink` dos 3 retornos
   (`verification/route.ts:156,250-257,261-267`), apagar `showDevCode` morto (`:243`), trocar
   `Math.random` por `crypto.randomInt` (`:99`) e remover os `console.log` de código/token
   (`:138,155,260` + `whatsapp/meta.ts:100`). **Sem isto, todo o resto da fase é contorno.**
2. **Criar a sessão de cliente de verdade (P-M, 2-3 dias)** — JWT de cliente (`jose`, já é
   dependência, `type:"customer"`, `customerId`+`establishmentId`, TTL 15 min + refresh) em cookie
   `httpOnly`, emitido no `PUT /api/verification`, exigido em `orders/customer`, `addresses`,
   `customers` (POST/PUT) e `payment-request`, com o `customerId` vindo do token e não do request.
   Fecha F7A-004/005/006/007/015 e F7B-002/003/004/016.
3. **Limitar abuso e custo (M, 1-2 dias)** — rate limit por IP e teto diário por `establishmentId`
   **antes** de criar o código (`:42-96`), normalização única de telefone (`55` + 11/12 dígitos,
   `:32-35,288`), checar cota Meta (`meta-quota`) antes do envio e agendar o cron no `vercel.json`;
   remover `BYPASS_PHONES`. Fecha F7A-009/010/012/018/021.
4. **Corrigir a entrega (M, 1-2 dias)** — template próprio de categoria `AUTHENTICATION` com
   `copy_code` (a implementação já existe morta em `meta.ts:125-167`), parar de escolher "qualquer
   template aprovado" (`meta.ts:416-419`), assinar o webhook (`X-Hub-Signature-256`), exigir
   apikey no Evolution e correlacionar status de entrega com `VerificationCode`. Fecha F7A-013,
   F7B-005/010/012/020.
5. **Unificar resposta e religar o perímetro com cuidado (P+M, 1 dia)** — resposta única
   (`202 {success:true}`) para errado/expirado/inexistente, esconder `remaining` e contador
   atômico (`F7A-011/017`); mover `middleware.ts` → `src/middleware.ts` **adicionando
   `/api/verification` e `/api/addresses` a `PUBLIC_ROUTES`** (hoje estão fora: `middleware.ts:10-21`
   — religar sem ajuste quebraria o login do cliente) e, em paralelo, proteger essas rotas no
   handler com o novo cookie de cliente.
