# 01-seguranca-1b.md — Isolamento multi-tenant (IDOR, tenant confusion, storage, cache)

> Parte **1B** da Fase 1 da auditoria. Somente leitura. Evidência no formato `arquivo:linha`.
> **Nenhum teste dinâmico foi executado**: `DATABASE_URL` (`/.env:1`) aponta para o pooler de
> produção (`aws-1-us-east-1.pooler.supabase.com`) e a regra 2.5 proíbe tocar em produção.
> Os scripts de prova estão em `auditoria/testes/1b-0*.sh` com **resultado esperado vs. obtido =
> NÃO EXECUTADO** (falta ambiente com 2 lojas de teste — ver `PROGRESSO.md`, pendência da Fase 0).

---

## 1. Metodologia

1. Varredura estática dos **148** arquivos `src/app/api/**/route.ts` verificando, por rota:
   presença de `verifyAuth`/`getAuth`/`requireSaasAdmin`, acesso por `params.id` e se
   `auth.establishmentId` é comparado com o recurso.
2. Leitura do `prisma/schema.prisma` (47 modelos) para mapear coluna de tenant e relações.
3. Revisão de resolução de tenant nos webhooks (iFood, 99Food, 99, WhatsApp) e no Storage.
4. Revisão de `export const revalidate`/ISR para risco de mistura de tenant por cache.

**Contagem por varredura:** 148 rotas · **61** com alguma checagem de autenticação · **87** sem
nenhuma (destas, ~30 são legitimamente públicas: `auth/*`, `webhooks/*`, `cron/*`, `tracking`,
`verification`, `icon`, `manifest`, `push/vapid-key`, `delivery/calculate`, `table-status`);
as demais (~57) são rotas "de equipe" expostas — cruzar com **F1A-005**.

---

## 2. Tabela de achados

| ID | Severidade | Tema | Título | Evidência | Esforço |
|---|---|---|---|---|---|
| **F1B-001** | **CRÍTICO** | IDOR de escrita | `PATCH`/`DELETE /api/products/[id]` autentica mas **não compara** `establishmentId` → qualquer usuário altera/apaga produtos de qualquer loja | `src/app/api/products/[id]/route.ts:33-37` (só `if (!authUser)`), `:95-101` (DELETE `product.delete({ where: { id } })`) | Pequeno |
| **F1B-002** | **CRÍTICO** | Tenant via query | ~57 rotas "de equipe" anônimas aceitam `establishmentId` na **query string do cliente** → leitura e escrita em qualquer tenant sem credencial | `src/app/api/orders/route.ts:690-697` (sem `verifyAuth`, lê `searchParams.get("establishmentId")`), `src/app/api/dashboard/route.ts:20+`, `financial/cmv/route.ts:6-12`, `financial/cash-flow`, `financial/dre`, `financial/revenues`, `stock`, `categories`, `expenses`, `suppliers`, `cash-register`, `customers`, `delivery-persons` | Pequeno |
| **F1B-003** | **ALTO** | IDOR de escrita | `PATCH`/`DELETE /api/admin/banners/[id]` e `/api/admin/stories/[id]` autenticam mas atualizam/apagam por `id` puro, sem checar o dono | `src/app/api/admin/banners/[id]/route.ts:13-41` (`banner.update({ where: { id: params.id } })`), `:45-48` (`banner.delete`); `src/app/api/admin/stories/[id]/route.ts` (mesmo padrão). `Banner.establishmentId` = `prisma/schema.prisma:1014`; `Story.establishmentId` = `schema.prisma:985` | Pequeno |
| **F1B-004** | **ALTO** | IDOR de escrita | `GET`/`PUT` `/api/establishments/[id]/delivery-config` e `/location` só exigem que o cookie seja um JWT válido — **não** comparam `auth.establishmentId` com `params.id` → qualquer loja lê/escreve raio e coordenadas de qualquer outra | `src/app/api/establishments/[id]/delivery-config/route.ts:19-27` (`getAuth()` → `findUnique({ where: { id: params.id } })`), `:44-81` (PUT sem checagem); `src/app/api/establishments/[id]/location/route.ts:18-41` (`establishment.update({ where: { id: params.id } })`) | Pequeno |
| **F1B-005** | **ALTO** | Webhook / tenant | Fallback `|| establishments[0]` nos webhooks de pedido: evento externo que não casa com pedido/loja é gravado no **primeiro tenant da base** → escrita cross-tenant por via de webhook | `src/app/api/orders/ifood-webhook/route.ts:89` e `:91`; `src/app/api/orders/99food-webhook/route.ts:107` e `:111` | Pequeno |
| **F1B-006** | **ALTO** | IDOR leitura | `GET /api/products/[id]` sem `verifyAuth` → produto, preço e configurações de qualquer loja acessíveis por `id` (cuid é enumerável em lista pública de cardápio) | `src/app/api/products/[id]/route.ts:8-24` (nenhuma checagem; `NextResponse.json(product)` com `include`) | Pequeno |
| **F1B-007** | **MÉDIO** | Webhook / tenant | Webhook WhatsApp resolve a loja/cliente por telefone/instância com `findFirst` global — busca sem âncora de tenant pode casar com cadastro homônimo de outra loja | `src/app/api/webhooks/whatsapp/route.ts:139`, `:174`, `:199-210`, `:354-362` | Médio |
| **F1B-008** | **MÉDIO** | Storage | Buckets `images` e `Imagens` **públicos** (`getPublicUrl`), com nome de arquivo `${Date.now()}-${rand}.webp` **sem prefixo de tenant** → sem isolamento por path, sem como revogar acesso, URL derrubável só por sobrescrever o objeto | `src/lib/image-upload.ts:26-41` (`upload(fileName…)` + `getPublicUrl`), `:38`; usos: `src/app/api/upload/route.ts`, `src/app/api/establishments/[id]/meta-profile-picture*`; bucket `Imagens` em `src/app/api/…` (2 usos) | Pequeno |
| **F1B-009** | **MÉDIO** | Cliente × tracking | `POST/PUT /api/orders/[id]/payment-status` sem `verifyAuth`, autorizado só por `trackingToken` — portador do link força reconsulta ao provedor e **mutação** de `status/paymentStatus` | `src/app/api/orders/[id]/payment-status/route.ts:20-44` (`trackingToken` comparison), `:63-71`, `:83-89` (`order.update`) | Pequeno |
| **F1B-010** | **MÉDIO** | Modelo | 19 dos 47 modelos **não têm coluna `establishmentId`**. 15 derivam o tenant por relação (ok se a query subir a relação), **4 não têm nenhuma relação de tenant**: `SystemConfig`, `CategoryTemplate`, `GlobalQuickReply`, `LogWebhook99` | `prisma/schema.prisma` (varredura dos 47 blocos `model`); `LogWebhook99` = `schema.prisma:966-973` (payload Json bruto, sem `establishmentId`) | Médio |
| **F1B-011** | **MÉDIO** | Cliente final | O cliente final **não tem JWT**: "sessão" = flag `localStorage` por slug; o `trackingToken` é a única credencial de cliente, entregue sem verificação de identidade | `src/app/[slug]/menu-page.tsx:594,599,629` (`localStorage["flowos-session-verified-<slug>"]`); `src/app/api/orders/route.ts:170,433` (emissão do token); nenhum `SignJWT` para cliente (8 pontos de emissão são todos de equipe: `establishments/route.ts:91,97`, `login:86,92`, `refresh:37,44`, `kds-login:40`, `saas-admin/login:38`) | Médio |
| **F1B-012** | **BAIXO** | Padrão de auth | 3 implementações paralelas de leitura de token com **fallbacks de segredo diferentes** — torna impossível aplicar uma checagem de tenant única e central | `src/lib/auth.ts` (`verifyAuth`), `src/app/api/establishments/[id]/delivery-config/route.ts:6` (`process.env.JWT_SECRET \|\| "flowos-secret"`), `src/lib/saas-admin-auth.ts:7` | Médio |

---

## 3. Inventário: quem tem (e quem não tem) coluna de tenant

**28 modelos COM `establishmentId`** — isolamento direto.

**19 modelos SEM `establishmentId`** (derivam o tenant pela relação indicada):

| Modelo | Relação que ancora o tenant | Risco |
|---|---|---|
| `CashMovement`, `CashTransfer` | `cashRegister → Establishment` | query que parta do id da movimentação sem subir a relação |
| `StockMovement` | `item → StockItem → Establishment` | idem (2 saltos) |
| `PurchaseItem` | `purchase → StockItem` (e `stockItem`) | idem |
| `OrderItemCost`, `OrderMessage` | `order → Establishment` | idem |
| `CustomerAddress`, `CustomerNotification`, `VerificationCode` | `customer → Establishment` | idem (e lookup por telefone é global) |
| `ProductLike`, `ProductStockLink`, `StoryItem`, `DailyComboItem` | `product/story/combo → Establishment` | idem |
| `PasswordResetToken` | `user → Establishment` | baixo |
| **`SystemConfig`** | **nenhuma** | config global por chave — ok se só `saas_admin` escreve |
| **`CategoryTemplate`**, **`GlobalQuickReply`** | **nenhuma** | templates compartilhados entre lojas — dados de uma loja podem irradiar para outra |
| **`LogWebhook99`** | **nenhuma** | payload bruto de terceiro sem dono: impossível apagar/isolar por tenant (agrava F1D-006/007) |

---

## 4. Pontos verificados **sem** risco de mistura de tenant

- **Cache / ISR**: todas as rotas que exportam `revalidate` (`orders:70`, `dashboard:4`,
  `financial/*:4`, `stock:4`, `categories:5`, `establishments:10`, `alerts:5`) recebem o objeto
  `Request`/`NextRequest` e portanto são **dinâmicas** — o `revalidate` é inerte e **não** há
  resposta estática servida a outro `establishmentId`. Nenhuma página usa `generateStaticParams`
  ou `revalidate` (`grep` negativo em `src/app`).
- **Realtime**: **não aplicável** — não há Supabase Realtime/Edge Functions no projeto
  (pasta `supabase/` inexistente; grep negativo por `realtime`/`supabase.channel`).
- **Mudança de tenant de usuário**: os únicos `prisma.user.update` do projeto
  (`auth/reset:39`, `auth/change-password:43`, `users/[id]:34`, `users/change-password:37`)
  **não** escrevem `establishmentId` → não existe via para mover usuário de tenant.
- **Rotas de detalhe autenticadas com checagem correta de dono**: `orders/[id]` (com
  documentação explícita em `orders/[id]/route.ts:28-44`), `users/[id]:16-19`,
  `categories/[id]`, `expenses/[id]`, `stock/[id]`, `cash-register/[id]` (inclui `movements`
  e `transfer`), `delivery-persons/[id]`, `establishments/[id]` (GET/PATCH) e todas as
  `/api/saas-admin/*` (`getSaasAdmin`/`requireSaasAdmin`).

---

## 5. Testes preparados (NÃO EXECUTADOS)

| Script | O que prova | Esperado | Obtido |
|---|---|---|---|
| `auditoria/testes/1b-01-idor-por-id.sh` | Token do tenant A sobre recursos do tenant B (produto, banner, story, delivery-config, location, categoria, estoque, despesa, caixa, usuário) | 401/403/404 em todas | **NÃO EXECUTADO** |
| `auditoria/testes/1b-02-rotas-anonimas.sh` | 18 rotas "de equipe" sem credencial | 401 em todas | **NÃO EXECUTADO** |
| `auditoria/testes/1b-03-webhook-tenant-fallback.sh` | Evento iFood/99 desconhecido não cai em `establishments[0]` | 400/404 e 0 linhas em `Order` | **NÃO EXECUTADO** |

Bloqueio: sem ambiente de teste multi-loja e com `DATABASE_URL` apontando para produção
(pendências já registradas na Fase 0). Os scripts são idempotentes e não escrevem nada no
repositório além de `/tmp`.

---

## 6. O que está bom

- Isolamento **forçado** no `POST /api/users` (`users/route.ts:52-54,72`) e checagem de dono no
  `GET` (`:15-18`) — hotfix `aae4530`.
- `orders/[id]` tem desenho de autorização documentado e restringe `trackingToken` a
  cancelamento com pagamento pendente (`orders/[id]/route.ts:28-44`).
- `@@unique([establishmentId, phone])` em `Customer` (`schema.prisma:264-265`) impede cadastro
  homônimo **dentro** do mesmo tenant.
- Endereços com checagem de dono real (`addresses/route.ts:4-12,70-110,119-155`) e limite de 3.
- Nenhuma página/módulo usa cache estático sobre dado de tenant → sem vetor de cache poisoning.

---

## 7. NÃO VERIFICADO

- **Comportamento em runtime** de todos os itens (nenhum `curl` executado).
- **Estado real do banco**: quantas lojas existem, se há `SystemConfig` com mais chaves, se
  `LogWebhook99` tem dados de produção.
- **Políticas de bucket no Supabase** (`images`, `Imagens`): se há escrita pública ou RLS no
  Storage — só o código do cliente foi inspecionado.
- **Escopo do fallback `establishments[0]`** depende do conteúdo real da tabela (só há 1 loja?
  então o efeito é "grava na loja errada"; com N lojas, é sempre a primeira).
- **Endpoints de pedidos/catálogo/cupons/pagamentos em profundidade** — cobertos nas fases 2 e 5
  (aqui só o aspecto de tenant).

---

## 8. Top 5 ações

1. **Tornar `establishmentId` não-injetável**: toda rota "de equipe" lê o tenant de
   `verifyAuth()`/`x-establishment-id` (injetado pelo middleware após F1A-001) e **ignora** query
   e body. Começar por `orders`, `dashboard`, `financial/*`, `stock`, `categories`, `expenses`,
   `suppliers`, `cash-register`, `customers`, `delivery-persons`. *(Fecha F1B-002 e o F1A-005.)*
2. **Fechar os 3 IDORs de escrita** com `auth.establishmentId !== recurso.establishmentId → 404`
   em `products/[id]`, `admin/banners/[id]`, `admin/stories/[id]` e em
   `establishments/[id]/{delivery-config,location,delivery-zones}`. *(F1B-001, F1B-003, F1B-004.)*
3. **Remover `|| establishments[0]`** dos webhooks iFood/99 e recusar eventos com loja não
   identificada (log + 200 com `ignored`, sem escrita). *(F1B-005.)*
4. **Exigir auth no `GET /api/products/[id]`** e no `payment-status` (ou assinar o
   `trackingToken` e torná-lo somente-leitura). *(F1B-006, F1B-009.)*
5. **Storage multi-tenant**: prefixar o path com `establishmentId/`, proibir `getPublicUrl`
   para material de cliente, considerar URL assinada de expiração; e adicionar
   `establishmentId` a `LogWebhook99` + expurgo. *(F1B-008, F1B-010.)*
