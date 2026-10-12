# FASE 9 — SAAS, PRODUTO E JURÍDICO

**Data:** 10/10/2026 · **Saída:** `auditoria/09-produto-juridico.md` · **Termo:** `AUDITORIA-SAAS-FOOD.txt:507-518`
**Regra central da fase:** o produto cumpre o que promete (planos, trial, bloqueio, onboarding, suporte, LGPD/jurídico, exportação, terceiros, fiscal) — leitura 100% estática, nenhum comando contra remoto/banco, nenhum segredo impresso (só nomes de variáveis).

## Escopo e método

- Varredura em 4 blocos (9A cadastro/onboarding/multi-loja/permissões · 9B planos/cobrança/métricas · 9C suporte/jurídico/offboarding · 9D terceiros/contingência/fiscal) por sub-agentes de leitura, com **conferência pessoal de 23 âncoras** pelo auditor (marcadas ✅ — relidas com `sed -n`/`grep` na fonte).
- Deduplicação contra **Fases 1/4/5/6/7** (coluna *Origem*: `Novo`/`Rep.`) e **dentro da fase** (unificados listados ao final).
- Nenhum arquivo do produto foi modificado.
- **Validação estática executada:** `bash auditoria/testes/9-01-produto-juridico-estatico.sh` → **53/53 CONFIRMADO, 0 a rever** (estático, seguro; rodar da raiz do projeto).

## Resumo

| Seção | Achados | C | A | M | B | Novos/Rep. | Nota |
|---|---|---|---|---|---|---|---|
| 9.1 Cadastro e onboarding | 5 | 1 | 3 | 1 | 0 | 4/1 | **1,5** |
| 9.2 Multi-loja e permissões | 4 | 3 | 0 | 1 | 0 | 3/1 | **1,0** |
| 9.3 Planos, cobrança, trial e bloqueio | 10 | 5 | 2 | 3 | 0 | 4/6 | **1,0** |
| 9.4 Métricas e telemetria de negócio | 3 | 0 | 0 | 3 | 0 | 1/2 | **2,0** |
| 9.5 Suporte ao cliente | 3 | 0 | 1 | 2 | 0 | 2/1 | **2,0** |
| 9.6 Jurídico: termos, privacidade, SLA, DPA | 6 | 3 | 2 | 1 | 0 | 5/1 | **1,0** |
| 9.7 Exportação de dados e offboarding | 3 | 3 | 0 | 0 | 0 | 1/2 | **1,0** |
| 9.8 Terceiros e contingência | 9 | 2 | 3 | 4 | 0 | 2/7 | **1,5** |
| 9.9 Conformidade fiscal | 2 | 0 | 1 | 1 | 0 | 2/0 | **1,5** |
| **Total (únicos)** | **45** | **17** | **12** | **16** | **0** | **24/21** | **1,3** |

- **Diagnóstico em uma frase:** o SaaS vende três planos (R$ 49/99/199), trial de 7 dias e "multi-unidade", mas **não existe backend de assinatura** — planos são literais duplicados em dois arquivos, o webhook de pagamento é público e forja `active`, o sandbox ativa plano sem pagar, nenhum recurso é bloqueado por plano no servidor, e o jurídico (termos, aceite, DPA, exportação, cancelamento) é **inexistente** no repositório.
- **Três eixos de risco:** (1) **receita forjável** — qualquer POST em `/api/subscription/create` (sem auth) e qualquer POST em `/api/subscription/webhook` (sem assinatura) gravam `subscriptionStatus: "active"` em qualquer `establishmentId`; (2) **escala de permissões** — usuário `atendente` cria usuário `admin` via body (`users/route.ts`), e o PATCH de comissão do backoffice SaaS não tem `verifyAuth`; (3) **LGPD sem base** — sem termos, sem registro de consentimento, sem exportação, sem delete, sem cancelamento; PAN/CVV transitam pelo servidor.

---

## 9.1 Cadastro e onboarding

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9A-001** | **CRÍTICO** | Novo | **Cadastro público sem rate limit cria tenant + admin + produtos em 1 request.** `POST /api/establishments` é anônimo, valida só presença de campos, não tem captcha/limite/verificação de e-mail, cria `Establishment` (trial 7d), `User` admin com `permissions` de 11 módulos, categoria e 2 produtos de exemplo — abuso permite spam de tenants e emails de trial. | `src/app/api/establishments/route.ts:12-103` ✅ (sem `verifyAuth`, sem rate limit — grep de `rate\·limit\·throttle` = 0 ✅); `:38-60` trial/plan hardcoded |
| **F9A-002** | **ALTO** | Novo | **Pós-cadastro: zero onboarding.** Usuário é auto-login e cai direto no dashboard vazio; não há wizard de 1º pedido, checklist, import de cardápio nem guia de configuração. O único "wizard" do produto é o de catálogo iFood (`IfoodCatalogWizard`), acionado manualmente na tela de cardápio. | `src/app/api/establishments/route.ts:91-103` (jwt + retorno imediato) ✅; grep `onboarding\·wizard\·boas-vindas` → só `cardapio/page-content.tsx:9,176,1682,3000-3001` (iFood) ✅ |
| **F9A-003** | **ALTO** | Rep. F6-021 | **`POST /api/establishments` devolve o objeto `establishment` completo sem `select`** — inclui hash `password` da loja e todos os campos internos; o model tem `password String` (schema:16). Diferente do GET público (que já foi marcado na Fase 6), aqui é a rota de criação. | `src/app/api/establishments/route.ts:55-73` (create sem select) + `:103` (`return NextResponse.json({ establishment, token, refreshToken })`) ✅; `prisma/schema.prisma:16` |
| **F9A-004** | **ALTO** | Novo | **`delivery-persons` aberto: lista e cria motoboy de qualquer tenant + senha default `123456` em claro.** GET aceita qualquer `establishmentId` sem auth; POST cria `User` role `motoboy` com `defaultPassword \·\· "123456"` e devolve a senha no JSON. | `src/app/api/delivery-persons/route.ts:5-26` (GET sem verifyAuth) ✅; `:28-63` POST `const password = defaultPassword \·\· "123456"` e `return ... defaultPassword: password` ✅ |
| **F9A-005** | **MÉDIO** | Novo | **Frontend grava `id` errado no localStorage pós-cadastro.** O payload salvo em `pedefacil-user` usa `id: data.establishment.id` (id do estabelecimento) onde se espera id do usuário — qualquer leitura futura de "meu id" lê o id do tenant. | `src/app/cadastro/page.tsx:80-86` ✅ |

## 9.2 Multi-loja e permissões

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9A-006** | **CRÍTICO** | Novo | **Escalada de privilégio: qualquer usuário autenticado cria usuário `admin`.** `POST /api/users` exige auth, mas aceita `role`/`permissions` do body sem checar o role do chamador (`role: role \·\· "atendente"`). `atendente` pode criar outro `admin` ou promover a si via PATCH. | `src/app/api/users/route.ts:40-68` ✅ (`const { ... role, permissions ... } = body` → `role: role \·\· "atendente"`); `src/app/api/users/[id]/route.ts:24-27` ✅ (`if (body.role) data.role = body.role`) |
| **F9A-007** | **CRÍTICO** | Novo | **Backoffice SaaS: PATCH de comissão sem `verifyAuth`.** Rota em `admin-saas` altera `saasCommissionPercentage` de qualquer estabelecimento só com `establishmentId` no path — sem checar admin SaaS, sem sessão. | `src/app/admin-saas/(auth)/estabelecimentos/[id]/api/route.ts:5-22` ✅ (grep `verifyAuth` = 0 ✅; `prisma.establishment.update` direto) |
| **F9A-008** | **CRÍTICO** | Novo | **Sem multi-loja real: 0 telas de troca de estabelecimento.** O plano Enterprise promete "Múltiplas filiais" na landing e nos cards, mas não existe seletor de tenant, nem convite de filial, nem vínculo usuário→N establishments — um login = 1 estabelecimento fixo no JWT. | `src/app/page.tsx:20` (feature "Multi-unidade") ✅; grep `switch.*estabelecimento\·trocar.*loja\·meus estabelecimentos` = 0 ✅; JWT fixo em `src/lib/auth.ts` (Fase 1) |
| **F9A-009** | **MÉDIO** | Rep. F5-041 | **`POST /api/orders` não valida assinatura/trial.** Nenhuma checagem de `subscriptionStatus` ou `trialEndsAt` na rota de criação de pedido — o bloqueio existe só no `layout.tsx` do dashboard (client-side). Pedido pode ser criado por API direta com assinatura expirada. | grep `subscriptionStatus\·trialEndsAt` em `src/app/api/orders/route.ts` = 0 ✅; bloqueio client-only em `src/app/dashboard/(auth)/layout.tsx:98-99` ✅ |

## 9.3 Planos, cobrança, trial e bloqueio

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9B-001** | **CRÍTICO** | Rep. F4B-001 | **`POST /api/subscription/webhook` é público e forja assinatura ativa.** Sem validação de token/HMAC/assinatura (diferente de `/api/webhooks/asaas`, que tem `verifyAsaasSignature`); qualquer POST com `{event, payment}` grava `subscriptionStatus: "active"` ou `"expired"` no `externalReference` escolhido pelo atacante. | `src/app/api/subscription/webhook/route.ts:4-50` ✅ (sem header check; `event === "PAYMENT_RECEIVED"` → `update subscriptionStatus: "active"`); positivo: `src/app/api/webhooks/asaas/route.ts:7-17` |
| **F9B-002** | **CRÍTICO** | Novo | **`POST /api/subscription/create` sem auth e com "sandbox mode" que ativa plano sem pagar.** Aceita qualquer `establishmentId`; se `ASAAS_API_KEY` estiver vazia, comenta "Sandbox mode — activate directly" e grava `subscriptionStatus: "active"` + `nextPaymentAt` sem criar cobrança. | `src/app/api/subscription/create/route.ts:20-55` ✅ (sem `verifyAuth`; `if (!PLATFORM_API_KEY) { ... subscriptionStatus: "active" }`) |
| **F9B-003** | **CRÍTICO** | Rep. F4B-002 | **Planos hardcoded em dois arquivos, fora de sincronia por construção.** `starter: 49 / pro: 99 / enterprise: 199` estão no array do front (`planos/page-content.tsx:8-60`) e num `Record` do back (`subscription/create/route.ts:11-15`); qualquer alteração de preço exige editar 2 lugares e não há model `Plan`/`Subscription`/`Invoice` no schema (grep = 0). | `src/app/dashboard/(auth)/planos/page-content.tsx:8-60` ✅; `src/app/api/subscription/create/route.ts:11-15` ✅; grep `model Plan\·model Subscription\·model Invoice` em `prisma/schema.prisma` = 0 ✅ |
| **F9B-004** | **CRÍTICO** | Rep. F5-030 | **Cobrança é pagamento único, não assinatura.** Usa `POST /payments` com `billingType: "UNDEFINED"`, não `POST /subscriptions` do Asaas — não há recorrência automática, dunning nem cartão salvo; `nextPaymentAt` é só um campo que ninguém cobra. | `src/app/api/subscription/create/route.ts:93-111` ✅ (`/payments`, `billingType: "UNDEFINED"`) |
| **F9B-005** | **CRÍTICO** | Novo | **Zero enforcement de plano no backend.** Único limite por estabelecimento em todo o código é `aiMessagesLimit` (IA); nada bloqueia Multi-unidade/API/relatórios avançados do Enterprise para quem está em `starter` — features do card são só cosméticas no front. | grep `subscriptionPlan` em `src/app/api/**` → só `login` (select) e `subscription/create` (update) ✅; nenhum `if (plan === "starter")` em rotas de negócio |
| **F9B-006** | **ALTO** | Rep. F5-031 | **Trial de 7 dias é automático, sem cartão e sem upgrade guiado.** `POST /establishments` grava `subscriptionStatus: "trial"` + `trialEndsAt = now+7d` e `subscriptionPlan: "starter"`; o único `upgrade` é a página de planos que chama o fluxo quebrado de 9B-002. | `src/app/api/establishments/route.ts:38-60` ✅; `prisma/schema.prisma:201-203` ✅ |
| **F9B-007** | **ALTO** | Rep. F4A-014 | **Sem cron de expiração de trial/assinatura.** `vercel.json` só agenda `verify-reminder` (1×/dia) e `sync-ifood-status` (*/5); `trialEndsAt` e `nextPaymentAt` nunca são varridos — estabelecimento expirado só é detectado quando o layout client-side compara datas, sem corte de API. | `vercel.json:1-14` ✅ (só 2 crons); grep `trialEndsAt` em `src/app/api/cron/**` = 0 ✅ |
| **F9B-008** | **MÉDIO** | Novo | **Backoffice "Planos & Billing" é Placeholder "Em construção".** Admin SaaS não emite cobrança, não vê MRR por plano, não pode marcar pago manualmente. | `src/app/admin-saas/(auth)/planos/page.tsx:1-4` ✅ (`<Placeholder title="Planos & Billing" />`) |
| **F9B-009** | **MÉDIO** | Rep. F4D-001 | **Status de assinatura só muda por webhook forjável ou sandbox** — não há UI nem endpoint admin para "marcar como pago", gerar boleto manual ou estender trial. | `src/app/api/subscription/webhook/route.ts:31-50` (único caminho de mudança, sem auth) ✅; grep `subscriptionStatus.*update` fora de webhook/create = 0 |
| **F9B-010** | **MÉDIO** | Novo | **Sem reconciliação: pagamento Asaas não é consultado de volta.** Fluxo é fire-and-forget (cria payment, guarda id); se o webhook nunca chegar, a assinatura fica `pending` para sempre — sem poll, sem "verificar status", sem idempotência de reativação. | `src/app/api/subscription/create/route.ts:113-130` (grava `asaasPaymentId` sem poll) ✅; sem rota `subscription/status` |

## 9.4 Métricas e telemetria de negócio

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9B-011** | **MÉDIO** | Rep. F4D-009 | **"Monitores de Serviço" do admin-saas são 3/4 hardcoded `ok: true`.** `checkMonitors()` só consulta `SELECT 1` no Supabase; Vercel/OpenAI/Evolution ficam verde fixo — painel mente sobre saúde dos serviços. | `src/app/admin-saas/(auth)/dashboard/page.tsx:58-70` ✅ (`supabase/vercel/openai/evolution: { ok: true }` literal) |
| **F9B-012** | **MÉDIO** | Novo | **Zero telemetria de produto.** Nenhum analytics (PostHog/Mixpanel/Umami/Plausible) em `src/`; não há evento de ativação de trial→paid, churn ou funil de onboarding. | grep `analytics\·posthog\·mixpanel\·umami\·plausible` em `src/**` = 0 ✅ |
| **F9B-013** | **MÉDIO** | Rep. F4D-010 | **Backoffice "Logs & Auditoria" é Placeholder.** Ações sensíveis do SaaS (troca de comissão, mudança de plano) não são auditadas em lugar nenhum. | `src/app/admin-saas/(auth)/logs/page.tsx:1-4` ✅ |

## 9.5 Suporte ao cliente

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9C-001** | **ALTO** | Novo | **CTA "Falar com vendas" (Enterprise) é `<span>` sem link.** O card Enterprise promete "Gerente de conta dedicado" e "SLA garantido", mas o botão é span decorativo dentro de um `Link` genérico para `/cadastro` — não abre WhatsApp, email nem formulário de vendas. | `src/app/page.tsx:20` (features Enterprise) ✅; `:305-307` (`<Link href="/cadastro"><span ...>{plan.cta}</span></Link>`) ✅ |
| **F9C-002** | **MÉDIO** | Novo | **Sem canal de suporte no produto.** Grep de `mailto:`, `tel:`, `wa.me`, `suporte@`, `contato@` em landing/cadastro/login/dashboard = 0 (o único `contato@` é placeholder de formulário de fornecedor no estoque). | grep `mailto\·tel:\·wa.me\·suporte@` em `src/app/{page,cadastro,login}/**` = 0 ✅; `estoque/page-content.tsx:1216` (placeholder de fornecedor) |
| **F9C-003** | **MÉDIO** | Rep. F6-030 | **Sem helpdesk/ticketing; FAQ da landing é array estático de marketing.** Plano Starter vende "Suporte por e-mail" e Pro "Suporte prioritário", mas não existe artigo, helpdesk nem ticketing; o único "FAQ" é um `const faq = [...]` hardcoded na landing. Agravante: o FAQ promete "Posso cancelar quando quiser? Sim!" — **afirmação falsa**, hoje não há fluxo de cancelamento no produto (ver F9C-011). | features em `planos/page-content.tsx:18,42` ✅; `src/app/page.tsx:23-30` (`const faq = [...]`, inclui promessa de cancelamento) ✅; grep `helpdesk\·ticketing\·zendesk` = 0 ✅ |

## 9.6 Jurídico: termos, privacidade, SLA, DPA

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9C-004** | **CRÍTICO** | Novo | **Sem Termos de Uso.** Nenhuma página, rota ou string `termos-de-uso` em `src/` (grep = 0). Plataforma que processa pedidos, pagamentos e dados de consumidores opera sem contrato de adesão. | grep `termos-de-uso\·terms-of-service\·termsOfUse` em `src/**` = 0 ✅; `ls src/app \· grep -i termo` = 0 ✅ |
| **F9C-005** | **CRÍTICO** | Novo | **Cadastro sem aceite de termos e sem consentimento registrado.** `cadastro/page.tsx` não tem checkbox de termos/privacidade (grep `termsAccepted\·aceite\·checkbox` = 0); schema sem campos de consentimento (`termsAccepted\·acceptedTerms\·consent\·dpaAccepted` = 0). | `src/app/cadastro/page.tsx` grep = 0 ✅; `prisma/schema.prisma` grep = 0 ✅ |
| **F9C-006** | **CRÍTICO** | Novo | **Sem DPA nem registro de subcontratados.** Não há documento de tratamento de dados nem lista de subprocessadores (Asaas, Pagar.me, OpenAI, Meta, Evolution) no repositório — obrigação para controlador/operador sob LGPD art. 39. | ls de `docs/` = só `ADMIN_SAAS.md`, `WHATSAPP_BOT.md` ✅; grep `dpa\·subprocessor\·tratamento de dados` = 0 ✅ |
| **F9C-007** | **ALTO** | Novo | **Política de Privacidade é página órfã.** Existe em `/politica-de-privacidade` e cita WhatsApp Cloud API/Meta, mas **0 links internos** apontam para ela (nem rodapé de cadastro, nem login, nem dashboard). | `src/app/politica-de-privacidade/page.tsx` existe ✅; grep `politica-de-privacidade` em `src/app` fora da própria página = 0 ✅ |
| **F9C-008** | **ALTO** | Rep. F5-036 | **Sem SLA publicado.** Landing vende "SLA garantido" no Enterprise; nenhum `sla`, uptime ou RTO documentado no repo. | `src/app/page.tsx:20` ✅; grep `sla` em `src/**` (case-insensitive, fora features) = 0 ✅ |
| **F9C-009** | **MÉDIO** | Novo | **Marca "FlowOS" e "PedeFácil" coexistem sem política clara.** Landing e cadastro usam "FlowOS"; sistema de billing e emails internos usam "PedeFácil" (`subscription/create` descreve "PedeFácil - Plano ..."); termos (se existirem) precisariam definir qual é o controlador. | `src/app/page.tsx` (FlowOS) vs `subscription/create/route.ts:106` (`PedeFácil - Plano`) ✅ |

## 9.7 Exportação de dados e offboarding

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9C-010** | **CRÍTICO** | Novo | **Sem exportação de dados do estabelecimento (portabilidade LGPD art. 18, V).** Nenhum endpoint de dump/export de pedidos, clientes, cardápio ou config; grep de `export.*dados\·portability` = 0 funcional. | grep `export\·download\·backup\·portab` em `src/app/api/establishments/**` → só `export const revalidate` e `export async function` ✅ |
| **F9C-011** | **CRÍTICO** | Rep. F4D-021 | **Sem cancelamento de assinatura no produto.** Grep de `cancelar assinatura\·cancel subscription\·cancelar conta` = 0; usuário expirado não tem caminho de downgrade, portabilidade ou encerramento — só fica bloqueado. | grep = 0 ✅; bloqueio client-only em `layout.tsx:98-99` |
| **F9C-012** | **CRÍTICO** | Rep. F5-040 | **Sem delete de estabelecimento (right to erasure).** `api/establishments/[id]` só expõe `GET` e `PATCH`; grep `prisma.establishment.delete` e `customer.delete` = 0 no código de produto. | `src/app/api/establishments/[id]/route.ts:5,55` (só GET/PATCH) ✅; grep `establishment.delete\·customer.delete` em `src/**` = 0 ✅ |

## 9.8 Terceiros e contingência

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9D-001** | **CRÍTICO** | Novo | **PAN/CVV processados no servidor (PCI DSS scope).** Rota Asaas de cartão recebe `creditCard.number` e `creditCard.cvv` do client e repassa ao gateway com logs de holder/CPF — a plataforma fica no escopo PCI-DSS nível 1 sem qualquer controle documentado. | `src/app/api/payments/asaas/card/route.ts:11,68-73` ✅ (`creditCardNumber`, `creditCardCvv`); `:12` log de `creditCardHolderInfo` |
| **F9D-002** | **ALTO** | Rep. F4B-011/012 | **Webhooks Efi, Inter, WhatsApp e 99 sem validação de assinatura.** Só Asaas (`asaas-access-token`) e Pagar.me (`x-hub-signature-256`) verificam; Efi/Inter/WhatsApp/99 processam body cego. | grep `verifyAuth\·hmac\·signature` em `webhooks/efi/route.ts`, `payments/inter/webhook`, `webhooks/whatsapp/route.ts` = 0 ✅; positivo: `webhooks/asaas/route.ts:11-17`, `webhooks/pagarme/route.ts:15-19` |
| **F9D-003** | **CRÍTICO** | Rep. F5-033 | **SaaS é merchant of record de pedidos via Pagar.me com chave global em `SystemConfig`.** Chave do gateway fica em config compartilhada; split para o lojista depende de `pagarmeSplitReceiverId` por estabelecimento — se ausente, recebimento é da plataforma (risco fiscal + responsabilidade). | `src/lib/pagarme-config.ts:22` (`SELECT value FROM SystemConfig WHERE key = 'pagarme_config'`); campos em `prisma/schema.prisma` (`pagarmeApiKey`, `pagarmeSplitReceiverId`) ✅ |
| **F9D-004** | **ALTO** | Rep. F4D-020 | **iFood com credencial global única.** Poll/catalogo usam `IFOOD_CLIENT_ID`/`IFOOD_CLIENT_SECRET` de env para **todos** os estabelecimentos; token de acesso fica em `establishment.ifoodAccessToken` — um vazamento de env derruba/compromete todas as contas iFood. | `src/app/api/orders/ifood-poll/route.ts:24-25` ✅ (`process.env.IFOOD_CLIENT_ID!`); `prisma/schema.prisma:172` (`ifoodAccessToken`) |
| **F9D-005** | **ALTO** | Novo | **99Food integrada por API especulativa.** `nine-food-status.ts` mapeia endpoints "Will be refined once we receive actual API documentation" — paths (`/orders/{id}/confirm` etc.) não são oficiais; risco de breaking change e de operação silenciosamente errada. | `src/lib/integrations/nine-food-status.ts:4-6,18-21` ✅ (comentário explícito ×2) |
| **F9D-006** | **MÉDIO** | Rep. F4A-010 | **Zero timeout/AbortSignal em fetchs de integrações.** Grep de `AbortSignal\·signal:` em `src/lib/integrations/` e `src/app/api/orders/` = 0 — chamada lenta a iFood/Asaas/OpenAI segura o request do cliente indefinidamente. | grep = 0 ✅ (corrobora F4A-010) |
| **F9D-007** | **MÉDIO** | Rep. F4A-011 | **Sem circuit breaker em nenhuma integração.** Falha repetida de Asaas/iFood/Evolution continua sendo retry por request, sem half-open nem fallback de UI. | grep `circuit\·breaker` em `src/**` = 0 ✅ |
| **F9D-008** | **MÉDIO** | Rep. F4D-030 | **Sem doc de contingência por terceiro.** Não há runbook "iFood fora", "Asaas fora", "WhatsApp banido"; os únicos MDs do repo são `ADMIN_SAAS.md` e `WHATSAPP_BOT.md` (setup, não contingência). | ls `docs/` e `*.md` na raiz ✅; grep `contingência\·runbook` em `*.md` → só relatórios da auditoria |
| **F9D-009** | **MÉDIO** | Rep. F4B-014 | **WhatsApp Cloud API: webhook sem verificação de assinatura Meta** (corrobora achado da Fase 4; ver 9.8 F9D-002). | `src/app/api/webhooks/whatsapp/route.ts` grep signature = 0 ✅ |

## 9.9 Conformidade fiscal

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F9D-010** | **ALTO** | Novo | **Zero módulo fiscal real.** Grep de `CFOP`, `NF-e`, `NFe`, `DANFE`, `SPED`, `NFSe`, `certificado digital`, `eSocial`, `CST` em `src/**` = 0 ocorrências relevantes (só falsos positivos de "permission"/"commission"). O SaaS calcula faturamento mas não emite nem valida documento fiscal. | grep fiscal = 0 ✅ (filtrado); KPI de faturamento só soma `order.total` em `admin-saas/dashboard/page.tsx:24-30` |
| **F9D-011** | **MÉDIO** | Novo | **Comprovante de pagamento é apenas flag de status.** Fluxo Asaas devolve `paid: true/false` em JSON; não há geração de recibo, danfe de serviço nem integração com emissor — lojista que precisa de NFSe para o consumidor final fica sem saída no produto. | `src/app/api/subscription/create/route.ts:49-53` (`paid: true` em sandbox) ✅; grep `recibo\·receipt\·nfse\·danfe` em `src/**` = 0 ✅ |

---

## O que está bom

- **Webhook de pagamentos Asaas (rota antiga) valida `asaas-access-token` com comparação em buffer e rejeita se nenhum lado configurou token** — modelo que as outras 4 integrações deveriam seguir (`src/app/api/webhooks/asaas/route.ts:7-17` ✅).
- **Webhook Pagar.me verifica HMAC (`x-hub-signature-256`)** quando `pagarmeWebhookKey` está configurada (`src/app/api/webhooks/pagarme/route.ts:15-19` ✅).
- **Tenant isolation no `POST /api/users`** — `establishmentId` do body é ignorado e o do JWT é forçado (`src/app/api/users/route.ts:52-54` ✅), mitigando parte do risco de F9A-006.
- **Dashboard admin-saas tem KPIs reais** (estabelecimentos, pedidos do mês, faturamento somado, custo IA) com `force-dynamic` e agregações Prisma (`admin-saas/(auth)/dashboard/page.tsx:1-40` ✅).
- **Política de Privacidade existe e menciona WhatsApp Cloud API/Meta** (`politica-de-privacidade/page.tsx:74` ✅) — falta só linkar e complementar com base legal.
- **Cadastro força senha mínima 6 e `bcrypt` 12 rounds; usuários novos têm `mustChangePassword: true`** (`establishments/route.ts:20,35` e `users/route.ts:72` ✅).
- **`users/[id]` PATCH checa tenant do chamador** antes de editar (`users/[id]/route.ts:12-16` ✅).

## Não verificado (honestidade)

- Planos reais cobrados / preços publicados fora do repo → NÃO VERIFICADO.
- Emails transacionais de trial/boleto (existência e conteúdo) → NÃO VERIFICADO.
- Status page, SLA contratual, DPA assinado com clientes → NÃO VERIFICADO (fora do repositório, se existirem).
- Chaves e configurações reais de Asaas/Pagar.me/iFood em produção → NÃO VERIFICADO (só nomes de variáveis).
- Comportamento do Asaas em sandbox vs produção além do código lido → NÃO VERIFICADO.
- Se existe emissão fiscal por terceiro fora do repo (ex.: ERP do lojista) → NÃO VERIFICADO.

## Top 5 prioridades

1. **F9B-001/F9B-002** — exigir assinatura no webhook e auth no `subscription/create`; remover o branch "sandbox activate directly" (qualquer um forja assinatura ativa hoje).
2. **F9A-006** — bloquear escalada: `role`/`permissions` só alteráveis por admin do mesmo tenant (whitelist no server).
3. **F9C-004 a F9C-006** — publicar Termos + checkbox de aceite + campo de consentimento no schema antes de qualquer outro growth.
4. **F9D-001** — parar de tocar em PAN/CVV no servidor (tokenização client-side / hosted checkout Asaas) para sair do escopo PCI.
5. **F9B-003 a F9B-005** — model `Plan`/`Subscription` único + enforcement de features por plano nas rotas de negócio.

## Duplicados unificados nesta fase

- F9A-006 ↔ users PATCH role (mesmo achado, 2 endpoints) — mantidos 1 linha de evidência cada.
- F9D-009 ⊂ F9D-002 (WhatsApp assinatura) — F9D-009 vira remissão.
- F9B-009/F9B-010 são desdobramentos de F9B-001/F9B-004 (mesmo fluxo de assinatura quebrado), mantidos separados por serem ações distintas de correção.

## Pendências da Fase 9

| ID | Pendência |
|---|---|
| F9B-001/F9B-002 | Teste dinâmico de forja de webhook (bloqueado: produção) |
| F9D-001 | Validação de tokenização Asaas (hosted) vs payload atual |
| F9C-006 | Confirmar se DPA existe fora do repo (contratos) |
| F9D-004 | Confirmar se iFood por-merchant usa outro mecanismo em produção |
