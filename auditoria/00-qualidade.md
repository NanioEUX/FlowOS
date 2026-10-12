# FASE 0C — QUALIDADE DO CÓDIGO

**Data:** 08/10/2026 · **Regras:** seção 2 · **Nota da área: 5,5/10** (compila e passa em testes, mas concentra 28% do código em 4 arquivos, tem duplicação com impacto financeiro e zero testes nas rotas críticas).

---

## 1. Resumo

O projeto **compila limpo** (tsc 0 erros), **passa no lint** (0 erros / 103 warnings), **builda** (64 rotas, First Load 87,6 kB) e **62 testes verdes** — sinais de que a base é mantida. Porém a qualidade estrutural é baixa: **64.555 linhas em 333 arquivos**, com **40 arquivos >300 linhas** e **170 funções/blocos >50 linhas**; só `menu-page.tsx` tem **7.360 linhas** (uma função `MenuPage` com 6.475). Existe **duplicação de regra de negócio entre front e back com divergência real de dinheiro** (subtotal `first_only`, cashback `||1` vs `||0`, descontos aceitos do cliente sem revalidação), **1.112 ocorrências de `any`**, **337 `console.log`** (13 deles dentro de `/api/verification`, que loga o código OTP), **7 arquivos `.bak` versionados**, `/ui-review` e `/demo` publicados no build, e a **recuperação de senha não envia e-mail nenhum**. Os testes cobrem apenas 6 arquivos de 148 endpoints — todos de entregas/99.

| Métrica | Valor |
|---|---|
| Linhas de código (`src/`) | 64.555 (333 arquivos `.ts/.tsx`) |
| Arquivos > 300 linhas | **40** |
| Funções/blocos > 50 linhas | **170** |
| `tsc --noEmit` | ✅ 0 erros |
| `next lint` | ✅ 0 erros / **103 warnings** |
| `next build` | ✅ sucesso (64 rotas, First Load 87,6 kB) |
| `vitest` | ✅ 6 arquivos / **62 testes** (449 ms) |
| `npm audit` | ⚠️ **24 vulns (4 críticas, 15 altas)** |
| `any` (tipos) | **1.112** |
| `@ts-ignore` / `@ts-expect-error` | **0** |
| `console.log` | **337** (mais 251 `console.error`, 21 `console.warn`) |
| TODO/FIXME/HACK reais | **3 TODO**, 0 FIXME, 0 HACK |
| `dangerouslySetInnerHTML` / `eval(` | **0** |
| `Math.random` em segurança | 3 ocorrências críticas (OTP e PIN de entrega) |

---

## 2. Tabela de achados

| ID | Severidade | Módulo/Área | Título | Esforço |
|---|---|---|---|---|
| F0-001 | **ALTO** | pedidos/financeiro | Duplicação front↔back com divergência de valor no subtotal (`first_only`) e descontos aceitos do cliente | G |
| F0-002 | **ALTO** | auth | "Esqueci a senha" nunca envia o e-mail — link só no `console.log` do servidor | P |
| F0-003 | **ALTO** | login OTP | Código OTP gerado com `Math.random` e logado em `console.log` (13× em `/api/verification`) | P |
| F0-004 | **ALTO** | segredos/build | Vite `next` crítico + `remotePatterns: hostname "**"` no `next.config.js` | M |
| F0-005 | **ALTO** | web/erros | 140 `catch` que só fazem `console.error` (erros somem); 165 respostas 500 genéricas | M |
| F0-006 | **MÉDIO** | arquitetura | God files: 4 arquivos = 18.224 linhas (28% do código) | G |
| F0-007 | **MÉDIO** | arquitetura | 170 funções/blocos >50 linhas (topo: `MenuPage` 6.475, `refreshPreview` 4.261) | G |
| F0-008 | **MÉDIO** | consistência | 1.112 `any`; regras de negócio reimplementadas em cada tela | G |
| F0-009 | **MÉDIO** | código morto | 7 arquivos `.bak`/`.backup` versionados; `/ui-review` e `/demo` publicados; 7 envs sem uso | P |
| F0-010 | **MÉDIO** | duplicação | `isOpenNow()` com 4 implementações (2 com semântica oposta) e `getNextOpeningTime` ×2 | P |
| F0-011 | **MÉDIO** | testes | 62 testes em 6 arquivos; **0 testes** em pedidos, caixa, estoque, financeiro, OTP | M |
| F0-012 | **MÉDIO** | dependências | 24 vulnerabilidades (4 críticas); 2 libs de JWT coexistindo; Next 14 vs 16 | M |
| F0-013 | **BAIXO** | logs | 337 `console.log`, sendo 42 num único endpoint (`meta-discover`) | P |
| F0-014 | **BAIXO** | inconsistência | Datas/moedas: 549 `formatCurrency` (bom), mas 33 `toLocaleDateString` misturados com 2 usos de `date-fns` | P |
| F0-015 | **BAIXO** | duplicação | Componentes/auxiliares duplicados (`StatusBadge` ×2, `OrderCard` ×2, `Field` ×2, `timeAgo` ×2, `urlBase64*` ×2) | P |
| F0-016 | **BAIXO** | UX/prod | "Em breve" em botões reais do painel (`planos/page-content.tsx:218,225`) | P |

---

## 3. Detalhamento

### F0-001 — Duplicação com divergência de dinheiro (ALTO)
**Evidência:**
- Front: `src/app/[slug]/menu-page.tsx:1383-1386` → `discountedUnit + fullUnit * (quantity - 1)` (desconto só na 1ª unidade).
- Back: `src/app/api/orders/route.ts:93` → `subtotal = Σ i.price * i.quantity`, onde `i.price` já vem descontado do cliente (`menu-page.tsx:1764`) → desconto aplicado a **todas** as unidades.
- `src/app/api/orders/route.ts:75,94-98` aceita do **body** `deliveryFee`, `loyaltyDiscount`, `couponDiscount`, `firstPurchaseDiscount` sem revalidar `minOrder`, saldo de pontos nem limite de cupom — apesar do comentário `// never trust client-sent total` (`:91`).
- Cashback: `menu-page.tsx:2126` usa `cashbackPercent || pointsPerReal || 0`; `api/orders/route.ts:261` usa `|| 1` e `:396` usa `|| 0` (**mesmo arquivo, dois fallbacks**).

**Impacto:** cliente com cupom/desconto "1ª unidade" vê um total e o servidor grava outro; qualquer pessoa pode POSTar descontos arbitrários em `/api/orders`.
**Correção:** recalcular no servidor todos os descontos a partir do banco (cupom, fidelidade, primeira compra) e validar `minOrder`/saldo; manter do cliente apenas `items[]` (produto, qtd, adicionais) e `notes`.
**Esforço:** G — *bloqueia Fase 5.1 (pedidos) e Fase 6 (cardápio público).*

### F0-002 — Recuperação de senha não funciona (ALTO)
**Evidência:** `src/app/api/auth/forgot/route.ts:44-55` — `console.log("[PASSWORD RESET] ${user.email}: ${resetUrl}")` e bloco `// TODO: Send email with Resend/SendGrid` **comentado** (`:49-55`), seguido de resposta genérica (`:57-59`).
**Impacto:** nenhum usuário recebe o link; a senha só pode ser alterada por quem tem acesso ao console de produção. Na prática, "esqueci a senha" é uma tela morta.
**Correção:** integrar provedor de e-mail e enviar; nunca logar a URL de reset em produção.
**Esforço:** P.

### F0-003 — OTP gerado e logado de forma insegura (ALTO)
**Evidência:** `src/app/api/verification/route.ts:99` (`Math.floor(100000 + Math.random()*900000)`), `:155` e `:260` (`console.log(...: ${code})`), `:156,:252,:266` (`devCode: code` na resposta), `:245` (`SHOW_DEV_CODE`).
**Impacto:** previsibilidade do código + vazamento em logs/resposta = bypass de autenticação do cliente final. *(Detalhamento completo na Fase 7.)*
**Correção:** `crypto.randomInt`, nunca retornar `devCode` fora de dev, mascarar log.
**Esforço:** P. *Bloqueia Fase 7.*

### F0-004 — Vulnerabilidade crítica do Next + host aberto (ALTO)
**Evidência:** `npm audit` → pacote `next` **crítico** (DoS via Image Optimizer); `next.config.js:13-15`:
```js
images: { remotePatterns: [{ protocol: "https", hostname: "**" }] }
```
**Impacto:** qualquer host remoto pode ser usado pelo Image Optimizer (SSRF/DoS), que é exatamente o vetor do advisory.
**Correção:** restringir aos hosts de imagens usados (ex.: supabase storage) e atualizar `next` (14.2.35 → 15.x/patch).
**Esforço:** M.

### F0-005 — Erros que somem (ALTO)
**Evidência:** 263 `catch` em `src/app/api/**`; **140** contêm apenas `console.error` antes de continuar/retornar sucesso; 165 respostas `{ status: 500 }`; 556 respostas no padrão `{ error: ... }` e 86 `{ success: ... }` (dois formatos convivendo).
**Impacto:** falha de pagamento/webhook/estoque vira "sucesso" silencioso; suporte não consegue diagnosticar sem acesso aos logs da Vercel.
**Correção:** helper único de erro com `requestId`, `console.error` + monitoramento, e padronizar `{ error: { code, message } }`.
**Esforço:** M. *Alimenta Fase 4.*

### F0-006 — God files (MÉDIO)
**Evidência:** ranking (arquivos de produção):
| # | Arquivo | Linhas |
|---|---|---|
| 1 | `src/app/[slug]/menu-page.tsx` | **7.360** |
| 2 | `src/app/dashboard/(auth)/cardapio/page-content.tsx` | **4.598** |
| 3 | `src/app/dashboard/(auth)/config/page-content.tsx` | **3.178** |
| 4 | `src/app/caixa/caixa-page.tsx` | **3.088** |
| 5 | `src/app/dashboard/(auth)/estoque/page-content.tsx` | 1.279 |
| 6 | `src/app/dashboard/(auth)/pedidos/page-content.tsx` | 1.249 |
| 7 | `src/app/ui-review/page.tsx` (não deveria estar em prod) | 1.077 |
| 8 | `src/app/[slug]/mesa/[number]/mesa-page.tsx` | 905 |
| 9 | `src/components/orders-screen.tsx` | 808 |
| 10 | `src/app/[slug]/entregas/[token]/delivery-page.tsx` | 781 |
| 11 | `src/app/api/orders/route.ts` | 758 |
| 12 | `src/app/dashboard/(auth)/caixa-gerencial/page-content.tsx` | 711 |
| 13 | `src/app/kds/(auth)/screen/page.tsx` | 685 |
| 14 | `src/app/dashboard/(auth)/layout.tsx` | 631 |
| 15 | `src/app/api/webhooks/whatsapp/route.ts` | 593 |

**Impacto:** qualquer mudança no cardápio toca um arquivo de 7 mil linhas; review, teste e rollback se tornam inviáveis.
**Esforço:** G. *Bloqueia Fase 8 (UX) e encarece todas as fases de negócio.*

### F0-007 — Funções longas (MÉDIO)
**Evidência (blocos >50 linhas, top 8):** `MenuPage` 6.475 (`menu-page.tsx:166`), `refreshPreview` 4.261 (`cardapio/page-content.tsx:338`), `SaasOnly` 2.464 (`config/page-content.tsx:715`), `stockItems` 930 (`estoque/page-content.tsx:350`), `MesaPage` 826 (`mesa-page.tsx:80`), `buildSplitRules` 744 (`api/orders/route.ts:16`), `OrderCard` 695 (`pedidos/page-content.tsx:555`), `OrdersScreen` 680 (`orders-screen.tsx:129`), `POST` de `webhooks/whatsapp` 468 (`route.ts:80`). **Total: 170 blocos >50 linhas.**
**Esforço:** G.

### F0-008 — `any` e regra reimplementada (MÉDIO)
**Evidência:** 1.112 `any` (top: `menu-page.tsx` 156, `cardapio/page-content.tsx` 95, `caixa-page.tsx` 68, `api/orders/route.ts` 19). ESLint **não** tem regra `@typescript-eslint/no-explicit-any` (`.eslintrc.json` só estende `next/core-web-vitals` + 1 regra off). Apesar disso: **0 `@ts-ignore`**.
**Impacto:** o typecheck "passa limpo" parcialmente porque os tipos são afrouxados — o sinal de 0 erros é menos confiável do que parece.
**Esforço:** G.

### F0-009 — Código morto e lixo no build (MÉDIO)
**Evidência:**
- `.bak` **versionados no git**: `prisma/schema.prisma.bak3`, `src/app/[slug]/menu-page.tsx.{backup,bak,bak2,bak3}`, `src/app/api/categories/route.ts.bak3`, `src/app/dashboard/(auth)/cardapio/page-content.tsx.bak3` (`git ls-files`).
- Rotas de desenvolvimento **no build**: `/ui-review` (1.077 linhas de mocks, `ui-review/page.tsx:207-900`), `/demo` (`next build` listou ambas).
- 7 envs definidas sem uso: `INTER_CERTIFICATE`, `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET`, `NEXT_PUBLIC_INTER_SANDBOX`, `NEXT_PUBLIC_PAGARME_ENCRYPTION_KEY` (é `NEXT_PUBLIC_`!), `PAGARME_SPLIT_RECEIVER_ID`, `SAAS_META_BUSINESS_ACCOUNT_ID`.
- Export morto: `verifyEfiWebhook` (`src/lib/integrations/efi.ts:187`) — **definido e nunca chamado**; `src/app/api/webhooks/efi/route.ts:7-21` não valida assinatura.
- 2 libs de JWT: `jsonwebtoken` (5 arquivos: `api/auth/{login,refresh,kds-login}`, `api/establishments`, `lib/auth.ts`) e `jose` (7: `middleware.ts`, `lib/saas-admin-auth.ts`, 4 rotas de establishment, `saas-admin/login`).
**Esforço:** P.

### F0-010 — `isOpenNow` duplicado 4× (MÉDIO)
**Evidência:** `lib/whatsapp/bot-rules.ts:32-57`, `dashboard/(auth)/layout.tsx:502-524`, `api/cron/sync-ifood-status/route.ts:8-28`, `menu-page.tsx:750`. Sem horário configurado: **bot → ABERTO** (`bot-rules.ts:36`), **layout → FECHADO** (`layout.tsx:503`); overnight inclusivo num e exclusivo no outro.
**Impacto:** a loja aparece aberta no WhatsApp e fechada no painel (ou vice-versa) no mesmo instante.
**Correção:** função única em `lib/business-hours.ts` consumida por todos.
**Esforço:** P. *Bloqueia Fase 5.8/5.9.*

### F0-011 — Cobertura de testes (MÉDIO)
**Evidência:** 6 arquivos de teste: `delivery/{calculate,dispatch-99,poll-99}`, `webhooks/99`, `establishments/[id]/delivery-config`, `lib/integrations` (99) — **62 testes, todos passam**. Cobertura configurada em `vitest.config.ts:14`. **0 testes** para `api/orders` (758 ln), `api/orders/[id]` (586), `api/verification`, `api/cash-register`, `lib/cmv`, `lib/stock`.
**Impacto:** os fluxos com dinheiro (pedido, caixa, estoque, OTP) dependem 100% de verificação manual.
**Esforço:** M.

### F0-012 — Dependências (MÉDIO)
**Evidência:** `npm audit` → 24 vulns (4 críticas: `next`, `vitest`, `@vitest/coverage-v8`, `tinypool`; 15 altas incl. `sharp`, `postcss`, `glob`). `npm outdated`: `next 14.2.35→16`, `react 18→19`, `prisma 5.22→7`, `vitest 1.6→5`, `eslint 8→10`, `tailwind 3→4`. Patch pendente hoje: `jose 6.2.3→6.2.12`, `openai 7.2.0→7.30.1`.
**Esforço:** M (a maioria das altas é cadeia de build/dev; o crítico do `next` é de runtime).

### F0-013 — Logs excessivos (BAIXO)
**Evidência:** 337 `console.log` — `api/establishments/[id]/meta-discover/route.ts` **42**, `menu-page.tsx` 39, `meta-embedded-signup.tsx` 27, `api/webhooks/whatsapp/route.ts` 20, `api/orders/[id]/route.ts` 14, **`api/verification/route.ts` 13 (inclui o código OTP)**.
**Esforço:** P (exceto F0-003, que é ALTO).

### F0-014 — Datas e moedas (BAIXO)
**Evidência:** moeda centralizada em `src/lib/utils.ts:8 formatCurrency` (**549 usos** — bom), mas 3 `Intl.NumberFormat` e 16 `toLocaleString("pt-BR")` avulsos. Datas: 33 `toLocaleDateString` × 2 importações de `date-fns` — mistura de abordagens; todos os `toLocaleDateString()` usam locale `pt-BR` (0 sem locale).
**Esforço:** P.

### F0-015 — Componentes/auxiliares duplicados (BAIXO)
**Evidência:** `StatusBadge` em `admin-saas/(auth)/dashboard/page.tsx:189` e `admin-saas/(auth)/estabelecimentos/page.tsx:108`; `OrderCard` em `pedidos/page-content.tsx:555` e `[slug]/entregas/[token]/delivery-page.tsx:468`; `Field` em `respostas-rapidas/novo/page.tsx:170` e `edit-whatsapp-tech.tsx:223`; `urlBase64ToUint8Array`, `urlBase64Encode`, `timeAgo`, `isInRange`, `getDateRange` ×2 cada.
**Esforço:** P.

### F0-016 — Recursos "Em breve" em produção (BAIXO)
**Evidência:** `dashboard/(auth)/planos/page-content.tsx:218` (`alert("Em breve: alteração de forma de pagamento via Asaas")`), `:225` (portal de faturas), `menu-page.tsx:4048` (cadastro de cartões). 1 `onClick={() => {}}` vazio.
**Esforço:** P.

---

## 4. Código incompleto (varredura sistemática)

| Padrão | Qtde | Comentário |
|---|---|---|
| `TODO` reais | **3** | `api/auth/forgot/route.ts:49` (e-mail não enviado → F0-002), `[slug]/mesa/[number]/mesa-page.tsx:165` (modal de opções), `menu-page.tsx:5701` (token de tracking não persistido) |
| `FIXME` / `HACK` | **0** | — |
| `console.log` | 337 | ver F0-013 |
| `@ts-ignore` / `@ts-expect-error` | **0** | — |
| `any` | 1.112 | ver F0-008 |
| `dangerouslySetInnerHTML` / `eval(` | **0** | — |
| `Math.random` | 20 (3 em segurança) | `api/verification/route.ts:99` (OTP), `api/orders/route.ts:441` e `api/orders/[id]/route.ts:187,310` (`deliveryCode` = últimos 4 dígitos do telefone ou aleatório), `api/delivery/dispatch-99/route.ts:47` (PIN) |
| Botões sem ação | 1 | + 3 `alert("Em breve")` |
| Mocks/dados falsos | só em `/ui-review` (que está no build) | — |
| Rotas sem implementação | 0 | todas as 148 têm corpo |

---

## 5. Inconsistências

- **Formato de resposta:** 556 `{ error }` vs 86 `{ success }`; 2 status codes diferentes para o mesmo erro.
- **Duas libs de JWT** (`jsonwebtoken` × `jose`) — F0-009.
- **Dois formatos de unidade de dinheiro** na fórmula de CMV: centavos (`lib/cmv.ts:50-76`) vs reais (`cardapio/page-content.tsx:229-245`).
- **Nomes para o mesmo conceito:** `establishmentId` (Prisma/`x-establishment-id`) vs `est` (`api/delivery/calculate/route.ts:12`); `whatsappProvider` (`evolution|meta`) vs "Meta/WhatsApp tech".
- **Role como texto livre:** `User.role String @default("atendente")`, `permissions String @default("[\"caixa\"]")` (`prisma/schema.prisma:651-652`); `Order.status String @default("pending")` (`:460`) — nenhum enum.

---

## 6. Código morto

- 7 arquivos `.bak`/`.backup` **versionados** (F0-009).
- `/ui-review` (1.077 ln) e `/demo` no build de produção.
- 7 envs sem uso; export `verifyEfiWebhook` nunca chamado.
- `prisma/dev.db` (SQLite) no repo apesar de `provider = "postgresql"`.
- `src/scripts/{create-recipient,create-saas-recipient}.ts` — scripts one-off versionados.
- `backups/` com 4 pastas de cópia de módulos (`motoboy-module-*`, `pedidos-module-*`, `security-hotfix-*`).
- `.postman/` + `postman/` (duas pastas duplicadas).

---

## 7. Acoplamento

Detalhado em `00-arquitetura.md` §2: **2 ciclos de módulo** (`auth↔infra-ui`, `auth↔whatsapp-bot`), **17 módulos escrevendo em tabela alheia**, **14 `page.tsx` com `prisma.*` direto**, regra de negócio em UI (cupom, cashback, CMV, `isOpenNow`, transições de status). Nenhum ciclo ESM.

---

## 8. Testes — o que existe e o que está quebrado

| Existe | Cobre | Status |
|---|---|---|
| `src/app/api/delivery/calculate/__tests__` (8) | cálculo de taxa | ✅ passa |
| `.../dispatch-99/__tests__` (8) | despacho 99 | ✅ passa |
| `.../poll-99/__tests__` (6) | polling 99 | ✅ passa |
| `src/app/api/webhooks/99/__tests__` (13) | webhook 99 | ✅ passa (loga erro esperado em stderr) |
| `.../delivery-config/__tests__` (9) | config de entrega | ✅ passa |
| `src/lib/integrations/__tests__/nine-nine.test.ts` (18) | client 99 | ✅ passa |

**Nada quebrado.** Lacunas: pedidos, pagamento, caixa, estoque, OTP, isolamento multi-tenant (Fase 1B precisará criar os testes em `/auditoria/testes/`).

---

## 9. Execução real dos comandos (seção 4)

| Comando | Saída resumida |
|---|---|
| `npx tsc --noEmit` | exit 0, **0 erros** |
| `npm run lint` | exit 0, **0 erros / 103 warnings** (`react-hooks/exhaustive-deps`, `@next/next/no-img-element`) |
| `npm run build` | exit 0 — 64 rotas; `/dashboard/cardapio` 32,1 kB / 127 kB; First Load compartilhado **87,6 kB** |
| `npm test` | exit 0 — **6/6 arquivos, 62/62 testes**, 449 ms |
| `npm audit` | **24 vulnerabilidades (5 moderate, 15 high, 4 critical)** |
| `npm outdated --depth=0` | 24 pacotes desatualizados (9 com mudança de major) |
| `gitleaks detect` / `trufflehog` | ❌ **não instalados** → varredura de segredos **NÃO VERIFICADA** (Fase 1C) |

---

## 10. Os 10 maiores riscos estruturais

| # | Risco | Achado | Fases que dependem de refatoração prévia |
|---|---|---|---|
| 1 | **Cálculo de pedido duplicado e divergente** entre front e back | F0-001 | **5.1, 6** (bloqueante) |
| 2 | **Sem camada de serviço**: toda regra vive em `route.ts`/`page.tsx` (17 módulos escrevem tabela alheia) | `00-arquitetura.md` §2.1 | 4, 5 (todas), 2 |
| 3 | **Isolamento multi-tenant por código em 148 endpoints** (sem RLS, sem enum de status, ~40 endpoints públicos) | inventário §4.2 | **1B** (bloqueante), 2, 6, 7 |
| 4 | **God files** (4 arquivos = 28% do código; `MenuPage` com 6.475 linhas) | F0-006/007 | 8, 5, 6 |
| 5 | **Recuperação de senha inoperante** | F0-002 | 1A |
| 6 | **OTP com `Math.random` + log em texto** | F0-003 | **7** (bloqueante) |
| 7 | **Erros silenciosios** (140 `catch` só logam) e ausência de fila/idempotência | F0-005 | **4** (bloqueante) |
| 8 | **Testes só em entregas/99** — fluxo de dinheiro sem cobertura | F0-011 | 4, 5 |
| 9 | **Vulnerabilidades de dependência** (Next crítico + `hostname "**"`) | F0-004/012 | 1.4 |
| 10 | **`any` sistêmico + lint sem regras de tipo** — typecheck limpo é enganoso | F0-008 | todas (qualquer refatoração pode passar sem erro) |

**Recomendação de ordem (alinhada à ordem sugerida do arquivo):** a Fase 0 indica que **as fases 5 (negócio), 4 (confiabilidade) e 8 (UX) exigirão refatoração prévia** para produzir achados confiáveis; as fases 1, 2, 6 e 7 **podem ser executadas agora** e de fato se tornam mais urgentes.

---

## 11. O que está bom

- `tsc --noEmit` **limpo** em 64.555 linhas com **zero `@ts-ignore`**.
- Lint sem erros; build de produção passa com bundle compartilhado enxuto (87,6 kB).
- 62 testes automatizados **todos verdes**, com cobertura configurada.
- Moeda centralizada em `formatCurrency` (549 usos) e `toLocaleDateString` sempre com `pt-BR`.
- Nenhum `dangerouslySetInnerHTML`, `eval(` ou `innerHTML`.
- Transação atômica com rollback de estoque na criação do pedido (`api/orders/route.ts:408-451`).
- `.env` fora do versionamento.

---

## 12. NÃO VERIFICADO (Fase 0C)

1. **Varredura de segredos no código e no histórico** — `gitleaks`/`trufflehog` indisponíveis (Fase 1C).
2. **Cobertura real de linhas** — `vitest --coverage` não executado para não alterar artefatos; só a contagem de arquivos de teste.
3. **Tamanho de bundle por rota além do print do build** — bundle analyzer não configurado.
4. **Performance em runtime** (LCP/INP, tempo de API) — sem ambiente de teste (entrada 11 ausente); nada dinâmico executado (regra 2.5).
5. **Duplicação por similaridade exata de código** — feita por nome de função/auxiliar e pelas regras conhecidas (D1-D8), não por ferramenta tipo `jscpd` (não instalada).
6. **Funções >50 linhas: contagem exata por função** — 170 blocos medidos por heurítica de aninhamento; componentes React contam o corpo inteiro (ex.: `MenuPage` = componente de 6.475 linhas).

---

## 13. Top 5 ações imediatas (Fase 0C)

1. **F0-002 + F0-003**: fazer a recuperação de senha enviar e-mail e trocar `Math.random` do OTP por `crypto.randomInt` removendo `devCode`/log (esforço pequeno, impacto direto em segurança).
2. **F0-004**: restringir `remotePatterns` e atualizar `next` (fecha vulnerabilidade crítica).
3. **F0-001**: recalcular descontos/taxa/cupom **no servidor** antes de qualquer cliente real (depende da Fase 1B/5.1).
4. **F0-009**: remover `.bak`, `/ui-review`, `/demo`, envs mortas e unificar as duas libs de JWT.
5. **F0-010**: criar `lib/business-hours.ts` único para `isOpenNow`/`getNextOpeningTime`.
