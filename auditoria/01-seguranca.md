# FASE 1 — SEGURANÇA E LGPD (relatório consolidado)

**Status: CONCLUÍDA** · Modo: somente leitura · Nenhum teste dinâmico executado ·
Nenhum comando executado contra banco/produção · Segredos sempre mascarados.

| Parte | Arquivo | Escopo | Achados |
|---|---|---|---|
| **1A** | `01-seguranca-1a.md` | Autenticação e autorização (equipe da loja + SaaS admin) | **F1A-001 … F1A-022** |
| **1B** | `01-seguranca-1b.md` (+ `testes/1b-0*.sh`) | Isolamento multi-tenant: IDOR, tenant via query, webhooks, storage, cache | **F1B-001 … F1B-012** |
| **1C** | `01-seguranca-1c.md` | Segredos · superfície web · integridade de dinheiro | **F1C-001…021 · 101…124 · 201…213** |
| **1D** | `01-seguranca-1d.md` | LGPD: direitos, retenção, base legal, divergências da política | **F1D-001 … F1D-029** |

**Totais brutos:** 22 + 12 + 58 + 29 = **121 itens mapeados**, dos quais ~8 são duplicações
explícitas entre remessas (marcadas como "igual a …") → **≈113 achados únicos**.

| Severidade | 1A | 1B | 1C-seg | 1C-web | 1C-dinheiro | 1D |
|---|---|---|---|---|---|---|
| CRÍTICO | 5 | 2 | 4 | 3 | 2 | 3 |
| ALTO | 7 | 4 | 7 | 8 | 7 | 8 |
| MÉDIO | 8 | 5 | 7 | 12 | 4 | 15 |
| BAIXO | 2 | 1 | 2 | 1 | 0 | 3 |
| INFO | 0 | 0 | 1 | 0 | 0 | 0 |

---

## 1. Causa raiz única

**O `middleware.ts` está fora do build.** O projeto usa `src/app`, o Next só procura
`middleware.*` dentro de `src/` (`node_modules/next/dist/build/index.js:476-486`), e o arquivo
está na **raiz**. Prova: `.next/server/middleware-manifest.json` → `{"version":3,"middleware":{},"functions":{}}`.

Consequência: **nenhum controle de acesso perimetral roda em produção** — `PUBLIC_ROUTES`, a
injeção de `x-user-id`/`x-establishment-id`/`x-user-role` e o `jwtVerify` centrais estão mortos.
A única barreira é o `verifyAuth` de cada rota, e **87 das 148 rotas não têm nenhuma**
(`F1A-001` = `F1C-001` = `F1C-101`).

**Alerta de disponibilidade:** basta mover o arquivo para `src/` **sem antes** revisar a
allowlist (`F1A-012`) para o app quebrar (OTP, cadastro, painel SaaS e avaliações passam a
devolver 401) mantendo expostas as rotas perigosas.

---

## 2. Os 15 achados mais graves

| ID | Sev. | Título | Evidência principal |
|---|---|---|---|
| F1A-001 / F1C-001 / F1C-101 | CRÍT | Middleware fora do build → perímetro inteiro desligado | `middleware.ts`; `middleware-manifest.json` |
| F1A-002 | CRÍT | Escalonamento vertical: `PATCH /api/users/[id]` aceita `role: "saas_admin"` | `users/[id]/route.ts:24-32` |
| F1A-003 | CRÍT | `POST /api/delivery-persons` cria conta em **qualquer tenant**, sem auth | `delivery-persons/route.ts:43-53` |
| F1A-004 / F1D-001 | CRÍT | `GET /api/orders` anônimo devolve todos os pedidos + `trackingToken` + PII | `orders/route.ts:690-757` |
| F1A-005 / F1B-002 | CRÍT | ~57 rotas "de equipe" anônimas lendo `establishmentId` da query do cliente | `dashboard`, `financial/*`, `stock`, `categories`, `expenses`… |
| F1A-011 / F1D-002 | CRÍT | `GET`/`PUT /api/customers` anônimos: CPF e endereço legíveis e editáveis | `customers/route.ts:15-49,116-152` |
| F1C-002 / F1D-003 | CRÍT | `GET /api/establishments` sem auth devolve **17 credenciais** (certificados .p12, API keys) | `establishments/route.ts:110-151` |
| F1C-119 | CRÍT | Token de reset impresso em `console.log`; e-mail nunca enviado → takeover | `auth/forgot/route.ts:46-54` |
| F1B-001 | CRÍT | `PATCH`/`DELETE /api/products/[id]` sem checagem de dono (IDOR de escrita) | `products/[id]/route.ts:33-37,95-101` |
| F1C-004 / F1A-020 | CRÍT | OTP devolvido em `devCode` na resposta + `Math.random` + log | `verification/route.ts:243-268` |
| F1C-201 / F1C-202 | CRÍT | Preço, desconto e cupom vêm do body; cupom **nunca validado** (rota `coupons/validate` não existe) | `orders/route.ts:75,94-98` |
| F1A-002 … F1A-012 | ALTO | **A matriz de permissões só existe no front** — 1 checagem de papel em toda a API | grep negativo |
| F1A-010 / F1A-018 | ALTO | Logout não revoga nada; `isActive`/`role` nunca revalidados → acesso por 24h/7d | `fetch-auth.ts:37-41`; `lib/auth.ts` |
| F1D-006 / F1D-007 / F1D-008 | ALTO | Sem direitos do titular, sem retenção, sem Termos/DPA/aceite; política órfã | grep negativos |
| F1C-211 / F1C-212 / F1C-213 | ALTO | Webhooks Efi/Inter/assinatura **sem validação** → marcam PIX como pago, alteram plano de qualquer loja | `webhooks/efi/route.ts:7-19` etc. |

---

## 3. Respostas de referência (perguntas da seção 5 do termo de auditoria)

1. **Sessão:** access 24h (3 emissores), refresh 7d, cookie 24h, reset 1h, OTP 5min; **sem
   rotação, sem denylist, sem logout servidor** — `F1A-010`.
2. **Política de senha:** mínimos divergentes (0/4/6), default `123456`, `mustChangePassword`
   só no front — `F1A-014`.
3. **Força bruta:** rate limit em `Map` por instância, **só** no login principal, por IP
   spoofável; 3 logins + `forgot`/`reset`/`refresh`/`change-password` sem limite — `F1A-006/007`.
4. **MFA:** **não existe**; verificação de e-mail no cadastro também não — `F1A-013`.
5. **Matriz de permissões:** 100% client-side — `F1A-008`.
6. **Escalonamento:** sim, vertical (`role`/`permissions` aceitos pelo corpo) e horizontal
   (tenant alheio via `delivery-persons`) — `F1A-002/003`. `establishmentId` de usuário **não**
   é alterável por nenhuma rota.
7. **Dispositivos:** KDS = JWT 24h em cookie **e** `localStorage`, sem revogação; motoboy =
   `randomBytes(8)` que **não expira**; PDV = checagem de papel só no cliente — `F1A-016`.
8. **Cliente final × equipe:** cliente **não recebe JWT** (flag de `localStorage` por slug);
   a separação está rompida no sentido oposto: sem token nenhum se lê PII — `F1B-011`.
9. **Cookies:** 5 cookies, todos `httpOnly` + `Secure` + `SameSite=Lax` — **mas nenhum é lido
   nem apagado**, e a sessão real vive em `localStorage` — `F1A-017`.
10. **Logout:** só `localStorage.removeItem` no front; tokens seguem válidos 24h/7d — `F1A-010`.

---

## 4. Top 5 global (ordem de execução sugerida)

1. **Semana 1 — perímetro**: mover `middleware.ts` → `src/middleware.ts` **depois** de revisar
   `PUBLIC_ROUTES`, e colocar gate de CI que falhe se `middleware-manifest.json` vier com
   `"middleware": {}`. Em paralelo, **rotacionar** todos os segredos (repo público): senhas
   `Admin@…` e do `dev.db`, `JWT_SECRET`, `CRON_SECRET`, `IFOOD_CLIENT_SECRET`, `META_APP_SECRET`,
   `ASAAS_API_KEY`, `PAGARME_API_KEY`, `INTER/EFI_CLIENT_SECRET` **+ novos .p12**, e por loja
   `metaAccessToken`, `evolutionApiKey`, `asaasApiKey`, `pagarmeApiKey`, `api99Key`.
   *(F1A-001, F1C-001…011, F1C-015, F1B-002.)*
2. **Semana 1-2 — autorização**: allowlist de `role`/`permissions` em `users` (proibir
   auto-promoção e `saas_admin` com tenant); exigir `verifyAuth` + `establishmentId` do token em
   todas as rotas de equipe (prioridade `orders`, `dashboard`, `financial/*`, `cash-register`,
   `stock`, `categories`, `expenses`, `suppliers`, `customers`, `delivery-persons`); fechar os
   IDOR de escrita (`products/[id]`, `admin/banners/[id]`, `admin/stories/[id]`,
   `establishments/[id]/{delivery-config,location,delivery-zones}`).
   *(F1A-002…005, F1A-011, F1B-001/003/004/006.)*
3. **Semana 2 — dinheiro**: recalcular preço/desconto/cupom no servidor (criar
   `/api/coupons/validate`), `$transaction` no estoque, auth em `POST /api/cash-register`,
   validação de assinatura **fail-closed** nos webhooks 99/Efi/Inter/assinatura/ifood/pagarme,
   `Decimal` no lugar de `Float`. *(F1C-201…213, F1C-120/121.)*
4. **Semana 2-3 — segredo e logs**: `select` explícito em tudo que serializa `Establishment`;
   remover `devCode`, token de reset e tokens Meta dos `console.log`; desligar `SHOW_DEV_CODE`;
   falhar-closed nos crons; `git rm --cached prisma/dev.db`; remover `Admin@…` do seed;
   eliminar fallbacks `flowos-secret`. *(F1C-002…009, 016, 019, F1A-022, F1B-012.)*
5. **Semana 3-4 — sessão e LGPD**: logout servidor (`tokenVersion` checado em `verifyAuth`),
   tirar JWT do `localStorage`, política de senha 8+ sem defaults, rate limit distribuído;
   e o pacote jurídico: Termos + aceite com timestamp, direitos do titular (export/delete),
   cron de retenção, opt-out `SAIR`/`STOP`, reescrita da política (OpenAI, Evolution, iFood, 99,
   GPS, US-East, DPO) e link para `/politica-de-privacidade`.
   *(F1A-010/013/014/017/018, F1D-006/007/008/009/011/016.)*

---

## 5. O que está bom (consolidado)

- Cookies com flags corretas nos 5 pontos de emissão; zero `document.cookie`.
- Upload com auth, allowlist MIME, re-encode `sharp` e nome aleatório.
- **Webhook Asaas fail-closed com `timingSafeEqual`** — melhor padrão do repo, servir de modelo.
- Prisma parametrizado; único `$executeRawUnsafe` com mapa de literais fechado.
- Zero `dangerouslySetInnerHTML`/`innerHTML`; sem open redirect.
- Reset de senha resistente a enumeração (token 32B, 1h, single-use, hash no DB).
- OTP com hash bcrypt, 3 tentativas, cooldown **persistido em banco**.
- Isolamento de tenant forçado em `POST /api/users`, `orders/[id]`, `addresses` e todas as
  `/api/saas-admin/*`.
- Nenhuma chave de formato industry-standard, nenhum PEM e nenhuma `service_role` em código
  **nem** nos 1.280 commits; `.env` nunca commitado.
- Nenhum dado de cartão persistido; admin SaaS lê PII mas não a envia ao browser.
- `revalidate` nas rotas é inerte (todas usam `Request`) → **sem mistura de tenant por cache**;
  Realtime não existe (não aplicável).

---

## 6. NÃO VERIFICADO (consolidado)

Nenhum `curl`/request executado · comportamento do middleware no **deploy** · env vars reais da
Vercel · estado do banco (papéis, `saas_admin` ativos, senhas fracas) · RLS/cripto em repouso e
políticas de bucket no Supabase · headers servidos pelo CDN · spoofabilidade de
`x-forwarded-for` · templates Meta em produção · residência da Evolution/OpenAI/DPA da Meta ·
RBAC completo nas rotas que já têm auth · crons em runtime · `gitleaks`/`trufflehog`
indisponíveis (varredura manual) · conteúdo de `public/Fotos/` e `backups/` linha a linha ·
resultado do `npm audit` não reproduzido aqui.

**Bloqueios estruturais da Fase 0 continuam de pé:** dump do banco, planos/uso do SaaS, status
das integrações, dados fiscais e 2 lojas de teste multi-tenant — sem isso, a Fase 1 **não pode
ser executada dinamicamente** (`auditoria/testes/1b-0*.sh` estão escritos e aguardam ambiente).

---

## 7. Conclusão

Nota de segurança: **2/10** (estática) — a combinação `middleware fora do build` + `51 rotas
anônimas` + `credenciais de pagamento expostas por API` + `repo público com histórico de banco`
significa que, hoje, **qualquer visitante pode ler pedidos e PII de qualquer loja, alterar
produtos de qualquer concorrente e obter as chaves de cobrança de qualquer estabelecimento**,
sem autenticação. O código, isoladamente, tem bons padrões (bcrypt, cookies httpOnly, Prisma
parametrizado, webhook Asaas fail-closed) — o que falta é **aplicação consistente** da camada de
autorização e a rotação do material já exposto.
