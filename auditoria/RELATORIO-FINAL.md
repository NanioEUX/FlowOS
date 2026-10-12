# RELATÓRIO FINAL DE AUDITORIA — SaaS Food (FlowOS / PedeFácil)

**Data:** 10/10/2026 · **Saída:** `auditoria/RELATORIO-FINAL.md` · **Termo:** `AUDITORIA-SAAS-FOOD.txt:520-539`
**Base:** 10 fases concluídas (0→1→2→6→7→5→3→4→8→9), ~750 achados registrados, **254 CRÍTICOS/ALTOS únicos** após deduplicação (`Rep.` removidos). Todas as fases: **somente leitura**, `DATABASE_URL` = produção, nenhum teste dinâmico destrutivo executado.

---

## 1. Resumo executivo

**Estado geral: NO-GO para qualquer cliente real ou cobrança.** O produto é visualmente completo (cardápio, PDV, KDS, entregas, bot WhatsApp, painel SaaS) e a base compila/limpa lint/builda, mas **a camada de segurança multi-tenant está quebrada de raiz**: o `middleware.ts` está fora do build (`{"middleware": {}}` no manifest), então nenhuma rota tem perímetro — 51+ rotas ficam totalmente anônimas, e mesmo nas autenticadas o `role` é checado 1 vez em toda a API. Combinado com OTP devolvido na resposta, `Math.random`, credenciais do lojista (32 campos, incl. `.p12` e API keys) serializadas no HTML do cardápio, e preços/descontos aceitos do `body`, qualquer visitante pode ler PII/CPF de qualquer tenant, forjar pedidos pagos, alterar produtos concorrentes e **ativar assinatura SaaS sem pagar** (`subscription/create` sem auth + sandbox). LGPD: sem termos, sem consentimento, sem exportação, sem delete, sem DPA; PAN/CVV atravessa o servidor (PCI). Confiabilidade: webhooks que respondem 200 antes de processar, sem idempotência/dead-letter, sem CI, sem backup, sem APM. Desempenho: 0 realtime (tudo polling), `GET /orders` devolve histórico completo com `updateMany` a cada leitura, cardápio 7.360 linhas/587 KB com fotos base64 no HTML.

**Riscos principais (ordem):** (1) **takeover e vazamento cross-tenant** — F1A-001/004/005, F1C-002/102, F6A-001; (2) **dinheiro forjado** — F1C-201/202, F5B-013, F6B-001/002, F9B-001/002; (3) **assinatura SaaS sem backend** — F5C-001/003, F9B-002/004/005; (4) **LGPD/PCI não conformes** — F9C-004/005/006/010, F9D-001; (5) **perda silenciosa de pedidos/pagamentos** — F4A-001/002, F4B-019, F4C-001; (6) **KDS/PDV degradados sem feedback** — F4C-001/011, F5D-003/005; (7) **ausência total de operação** — sem CI, backup, runbook, APM, health (F4C-022, F4D-001/005).

**Recomendação:** **NO-GO imediato.** Não adicionar clientes reais, não cobrar, não publicar mais endpoints. Horizonte 1 (abaixo) é **bloqueante de lançamento**; sem ele o produto é indefensável e ilegal em LGPD/PCI.

---

## 2. Nota por área (0 a 10)

Notas marcadas com † são derivadas pelo consolidado (não constavam declaradas no fase-relatório).

| Área | Nota | Fonte | Síntese |
|---|---|---|---|
| Segurança | **2,0** | 01-seguranca.md | Middleware morto + 51 rotas anônimas + 1 checagem de papel na API |
| Multi-tenant | **1,5** † | F1A/F1B/F5C/F6 | Isolamento falha em leitura (orders/customers públicos) e escrita (IDOR products/categories/stock) |
| LGPD | **1,0** † | F1D/F9C | Sem termos/aceite/DPA/export/delete; CPF e GPS anônimos; política órfã |
| Banco | **5,5** | 02-banco.md | Compila e tem FKs, mas 0 migrations vs 47 models, Float em dinheiro, sem índices/transações |
| Desempenho | **2,1** | 03-desempenho.md | 0 realtime, polling massivo, updateMany em GET, fotos base64, bundle 587 KB |
| Confiabilidade | **1,5** | 04-confiabilidade.md | Falha calada: 144 catch vazios, webhooks 200-antes-de-processar, 0 CI/backup/APM |
| Negócio | **3,3** | 05-negocio.md | Fluxo operacional completo no front; servidor não valida preço, estado, estoque nem cupom |
| Integrações | **2,0** † | F5C/F9D | 4 webhooks sem assinatura, iFood credencial global, 99Food especulativa, sem timeout/breaker |
| KDS | **2,5** † | F5D/F4C/F8 | Polling N+1, sem realtime, som mudo, indicador fake, TV ilegível, token 24h congela |
| Cardápio público | **4,0** | 06-cardapio-publico.md | UX de compra funciona; servidor aceita status/preço/desconto do cliente |
| Login OTP | **3,5** | 07-login-otp.md | UX boa; OTP é devolvido, Math.random, template UTILITY, sem sessão de servidor |
| Qualidade de código | **5,5** | 00-qualidade.md | tsc/lint/build verdes; god files, 1.112 `any`, duplicação front↔back com divergência de dinheiro |
| UX/Acessibilidade | **1,5** | 08-frontend-ux.md | 3 devices-alvo ignorados; 76 modais sem role; zoom travado; feedback de erro mascarado |
| Produto/SaaS/Jurídico | **1,3** | 09-produto-juridico.md | Planos hardcoded, cobrança única, sem enforcement, jurídico inexistente |
| **Geral (ponderada)** | **2,3** † | — | Puxada para baixo por segurança/LGPD/confiabilidade; código "verde" não salva a operação |

---

## 3. Lista consolidada de CRÍTICOS e ALTOS (sem duplicatas)

**254 achados** (59 CRÍTICO + 195 ALTO). Deduplicação: removidos 155 `Rep.` de fases posteriores e 2 IDs explícitos (`F1C-001`/`F1C-101` ≡ `F1A-001`). Evidência completa em cada fase-relatório.


### Segurança — 41 achados (9C/32A)

| ID | Sev | Achado |
|---|---|---|
| F1A-001 | **CRÍTICO** | `middleware.ts` fora do build — nenhum controle de acesso perimetral executa |
| F1A-002 | **CRÍTICO** | Escalonamento vertical: qualquer usuário altera `role`/`permissions`/`isActive` e cria `saas_admin` via `/api/users` |
| F1B-001 | **CRÍTICO** | `PATCH`/`DELETE /api/products/[id]` autentica mas não compara `establishmentId` → qualquer usuário altera/apaga produtos de qualquer loja |
| F1C-003 | **CRÍTICO** | `GET/PATCH /api/establishments/[id]` devolve o registro completo ao navegador (o `SAFE_FIELDS` só existe em outra rota) |
| F1C-004 | **CRÍTICO** | OTP sempre devolvido na resposta (`devCode`); a flag `showDevCode` é calculada e nunca usada |
| F1C-102 | **CRÍTICO** | Segredos + PII sem `select` explícito (mesma raiz de F1C-002/003) |
| F1C-119 | **CRÍTICO** | Token de reset impresso em log e e-mail nunca enviado (takeover) |
| F1C-201 | **CRÍTICO** | Preço vem do body, não recalculado no servidor |
| F1C-202 | **CRÍTICO** | Desconto e `loyaltyPointsUsed` do body; cupom nunca validado; `/api/coupons/validate` não existe (404) |
| F1A-006 | **ALTO** | `/api/users/change-password`: rota pública + auth opcional + min 4 + sem rate limit = oráculo ilimitado |
| F1A-007 | **ALTO** | Rate limit só em `/api/auth/login`, em `Map` por instância (cold start) e por IP spoofável |
| F1A-008 | **ALTO** | Matriz de permissões só existe no front — 1 checagem de papel em toda a API |
| F1A-009 | **ALTO** | Chaves de pagamento/WhatsApp legíveis e graváveis por qualquer funcionário (`SAFE_FIELDS`) |
| F1A-010 | **ALTO** | Logout não revoga nada no servidor; tokens e cookies permanecem válidos 24h/7d |
| F1A-012 | **ALTO** | Allowlist `PUBLIC_ROUTES` incoerente (se/ quando o middleware for religado, quebra e expõe) |
| F1B-003 | **ALTO** | `PATCH`/`DELETE /api/admin/banners/[id]` e `/api/admin/stories/[id]` autenticam mas atualizam/apagam por `id` puro, sem checar o dono |
| F1B-004 | **ALTO** | `GET`/`PUT` `/api/establishments/[id]/delivery-config` e `/location` só exigem que o cookie seja um JWT válido — não comparam `auth.establishmentId` com `params.id` → qualquer loja lê/escreve raio e… |
| F1B-005 | **ALTO** | Fallback ` |
| F1B-006 | **ALTO** | `GET /api/products/[id]` sem `verifyAuth` → produto, preço e configurações de qualquer loja acessíveis por `id` (cuid é enumerável em lista pública de cardápio) |
| F1C-005 | **ALTO** | Senha admin fixa no repo e documentada |
| F1C-006 | **ALTO** | Fallbacks de segredo literais em 6 arquivos (`\ |
| F1C-007 | **ALTO** | `prisma/dev.db` (212 KB) versionado com 5 hashes de senha e e-mails reais |
| F1C-008 | **ALTO** | Segredos/códigos em logs de produção (`access_token` integral da Meta, OTP, token de reset, `Bearer` de webhook) |
| F1C-009 | **ALTO** | Crons com auth fail-open (`if (cronSecret && …)`, `Bearer undefined` aceito) |
| F1C-010 | **ALTO** | 9 rotas Meta sem autenticação lendo/escrevendo `metaAccessToken` |
| F1C-011 | **ALTO** | Endpoints de teste públicos com credenciais reais |
| F1C-103 | **ALTO** | XSS via `document.write` com dados do cliente |
| F1C-104 | **ALTO** | SSRF: URL de imagem baixada pelo servidor sem allowlist |
| F1C-106 | **ALTO** | Tracking/PII sem token; `updateMany` abandonado |
| F1C-108 | **ALTO** | Rota sem auth + chamada externa pelo servidor |
| F1C-109 | **ALTO** | IDOR: não compara cookie × `params.id` |
| F1C-110 | **ALTO** | `/api/test-dispatch` dispara ações reais no iFood; `/api/asaas-test` vira oráculo de API key |
| F1C-113 | **ALTO** | Cookies bons, mas sem token CSRF nem checagem de Origin em form nativo |
| F1C-116 | **ALTO** | Auth fail-open nos crons (mesma raiz de F1C-009) |
| F1C-120 | **ALTO** | Sem assinatura: cancela/altera qualquer pedido |
| F1C-203 | **ALTO** | Decremento fora da transação com `.catch(()=>{})` |
| F1C-204 | **ALTO** | Read-modify-write sem `establishmentId` e sem trava de negativo |
| F1C-205 | **ALTO** | Abertura de caixa sem autenticação |
| F1C-211 | **ALTO** | PIX marcado como pago sem validar (a função de validação existe e não é chamada) |
| F1C-212 | **ALTO** | Sem assinatura; valor aceito vem do corpo do payload |
| F1C-213 | **ALTO** | Sem assinatura: ativa/expira plano de qualquer estabelecimento |

### Multi-tenant — 7 achados (5C/2A)

| ID | Sev | Achado |
|---|---|---|
| F1A-003 | **CRÍTICO** | Criação de conta em outro tenant via `POST /api/delivery-persons` (sem auth, senha default) |
| F1A-004 | **CRÍTICO** | `GET /api/orders` anônimo devolve todos os pedidos de qualquer tenant com `trackingToken` + PII |
| F1A-005 | **CRÍTICO** | 51 rotas sem `verifyAuth`: leitura/escrita anônima cross-tenant (financeiro, caixa, estoque, despesas…) |
| F1B-002 | **CRÍTICO** | ~57 rotas "de equipe" anônimas aceitam `establishmentId` na query string do cliente → leitura e escrita em qualquer tenant sem credencial |
| F1C-002 | **CRÍTICO** | `GET /api/establishments?id=`/`?slug=` sem auth devolve 17 credenciais do tenant (`interCertificate` .p12, `efiCertificate` .p12, `asaasApiKey`, `pagarmeApiKey`, `metaAccessToken`, `evolutionApiKey`,… |
| F1A-011 | **ALTO** | `/api/customers` GET/POST/PUT anônimos: enumeração e adulteração de PII de qualquer tenant |
| F1C-206 | **ALTO** | Re-fecha caixa já fechado; `transfer` sem checagem de tenant |

### LGPD — 16 achados (7C/9A)

| ID | Sev | Achado |
|---|---|---|
| F1D-001 | **CRÍTICO** | `GET /api/orders` público devolve nome/telefone/endereço/GPS/`pixPayload`/`paymentId` de todos os pedidos de qualquer tenant |
| F1D-002 | **CRÍTICO** | `GET` e `PUT` `/api/customers` sem autenticação: CPF, nascimento e endereço legíveis e editáveis por qualquer um |
| F1D-003 | **CRÍTICO** | Credenciais de pagamento/WhatsApp do lojista expostas ao cliente público (RSC do cardápio, resposta do `POST /api/orders`, `GET /api/establishments`) |
| F9C-004 | **CRÍTICO** | Sem Termos de Uso. Nenhuma página, rota ou string `termos-de-uso` em `src/` (grep = 0). Plataforma que processa pedidos, pagamentos e dados de consumidores opera sem contrato de adesão. |
| F9C-005 | **CRÍTICO** | Cadastro sem aceite de termos e sem consentimento registrado. `cadastro/page.tsx` não tem checkbox de termos/privacidade (grep `termsAccepted\·aceite\·checkbox` = 0); schema sem campos de… |
| F9C-006 | **CRÍTICO** | Sem DPA nem registro de subcontratados. Não há documento de tratamento de dados nem lista de subprocessadores (Asaas, Pagar.me, OpenAI, Meta, Evolution) no repositório — obrigação para… |
| F9C-010 | **CRÍTICO** | Sem exportação de dados do estabelecimento (portabilidade LGPD art. 18, V). Nenhum endpoint de dump/export de pedidos, clientes, cardápio ou config; grep de `export.*dados\·portability` = 0 funcional. |
| F1D-004 | **ALTO** | `GET /api/orders/customer?phone=` público → histórico de 20 pedidos de qualquer telefone |
| F1D-005 | **ALTO** | `/api/customers/notifications` público por `phone` → lê e apaga notificações de terceiros |
| F1D-006 | **ALTO** | Não existe exportação, exclusão ou anonimização de cliente (nem endpoint, nem UI) |
| F1D-007 | **ALTO** | Não existe job de retenção; a política de "5 anos" é letra morta; OTPs e logs crescem sem limite |
| F1D-008 | **ALTO** | Sem Termos de Uso, sem DPA, sem aceite no cadastro; política de privacidade órfã (nenhum link aponta para ela) |
| F1D-009 | **ALTO** | Conversas vão para a OpenAI e ficam em `AIUsageLog`; a política não menciona IA nem OpenAI |
| F1D-010 | **ALTO** | `/api/delivery-persons/deliveries?all=true` devolve o pedido inteiro sem `select` (`paymentId`, `pixPayload`, GPS) |
| F1D-011 | **ALTO** | Sem opt-out (`STOP`/`SAIR`) no bot; notificações de status saem por `sendText` livre fora da janela de 24h |
| F9C-007 | **ALTO** | Política de Privacidade é página órfã. Existe em `/politica-de-privacidade` e cita WhatsApp Cloud API/Meta, mas 0 links internos apontam para ela (nem rodapé de cadastro, nem login, nem dashboard). |

### Banco — 10 achados (1C/9A)

| ID | Sev | Achado |
|---|---|---|
| F2-001 | **CRÍTICO** | Mass assignment: corpo bruto vira `data` do Prisma em produtos, opções e estoque — qualquer coluna editável, incl. `establishmentId` e `price` |
| F2-002 | **ALTO** | Schema inteiro fora do versionamento: 0 `CREATE TABLE` nas migrations vs 47 modelos |
| F2-003 | **ALTO** | `MAX(orderNumber)+1` sem trava → requisição perde o pedido no pico (500) |
| F2-004 | **ALTO** | Dia de caixa/relatório e horário de funcionamento calculados em UTC (0 usos de `America/Sao_Paulo`) |
| F2-005 | **ALTO** | 53 `Float`, 0 `Decimal`, 13+ campos de dinheiro, nenhum `CHECK` |
| F2-006 | **ALTO** | 83 de 111 `findMany` sem `take`; `GET /api/orders` devolve todos os pedidos do tenant com `include` completo |
| F2-007 | **ALTO** | N+1 no cálculo de CMV (roda a cada pedido), em alerts, catálogo iFood, compras e atualização de preços |
| F2-008 | **ALTO** | Escritas multi-etapa fora de transação (produto, opções, estoque, fechamento de mesa, snapshot de CMV) |
| F2-009 | **ALTO** | `PrismaClient` não é cacheado em produção → 1 pool por cold start |
| F2-010 | **ALTO** | 16 modelos sem nenhum índice ou restrição de unicidade (Product, StockItem, Category, Coupon…) |

### Desempenho — 33 achados (6C/27A)

| ID | Sev | Achado |
|---|---|---|
| F3A-002 | **CRÍTICO** | Toda leitura de pedidos executa uma ESCRITA antes: `updateMany` de expiração de `abandoned` em cada GET ("Expire old pending orders on each dashboard poll") → com KDS aberto, 1 escrita em WAL a cada… |
| F3A-054 | **CRÍTICO** | Cardápio: enquanto o modal de verificação OTP está aberto, poll a cada 2 SEGUNDOS (1.800 req/h por visitante) em `/api/customers`, que faz `findFirst` + `aggregate` sobre `Order.customerId` — coluna… |
| F3A-061 | **CRÍTICO** | *(é a evidência acima)* — refino de F3A-035/F3D-020 |
| F3C-001 | **CRÍTICO** | Não existe camada de realtime: zero `supabase.channel`, zero `postgres_changes`, zero socket.io/SSE/presence em `src/`. O único uso do Supabase é Storage. Todo "tempo real" do produto é HTTP polling… |
| F3C-011 | **CRÍTICO** | p50 ≈ 2,5 s, p95 ≈ 5 s + duração do GET (derivado do código, não medido): a meta < 2 s não é garantida por construção — o pior caso balcão/mesa passa 5 s só esperando o tick. |
| F3D-013 | **CRÍTICO** | Consequência direta: o SSR do cardápio serializa todas as fotos dentro do HTML (`<MenuPage establishment={rest}/>`), estimativa ~3,6 MB de HTML por visita (60 produtos × ~60 KB). `/[slug]` não é ISR,… |
| F3A-003 | **ALTO** | O GET público do cliente (`/api/orders/customer`, chamado pelo cardápio a cada 15 s) também roda `updateMany` de expiração — escrita-por-leitura em rota anônima. |
| F3A-009 | **ALTO** | `GET /api/dashboard` dispara 18 queries em `Promise.all` (9 sem limite) — custo fixo alto por home aberta, multiplicado pelo retry (F3A-036). |
| F3A-017 | **ALTO** | `POST /api/purchases` roda 3 operações por item, em série, sem `$transaction`: compra com 20 insumos = 60 round-trips e risco de parar no meio (estoque inconsistente). |
| F3A-019 | **ALTO** | Importação de cardápio iFood: download + upload de imagem + `create` por item, serial, dentro de uma função serverless — cardápio grande = quase certo timeout. |
| F3A-020 | **ALTO** | `/api/push/diagnose` faz 4 queries por estabelecimento em `Promise.all` global — fan-out de conexões simultâneas que esgota o pool do Postgres. |
| F3A-025 | **ALTO** | A carga do cardápio dispara 7 endpoints por visita (menus, likes, stories, banners, destaques, reviews…), nenhum cacheado. |
| F3A-028 | **ALTO** | `export const revalidate` declarado em 11 rotas que leem `req`/`searchParams` (orders, dashboard, table-status, categories, stock, alerts, establishments + 3 financeiras) — config morta: tudo… |
| F3A-029 | **ALTO** | `fetchAuth` envia `cache: "no-store"` em todas as chamadas do painel — desativa qualquer cache de navegador/fetch/CDN para os dados mais requisitados do sistema. |
| F3A-030 | **ALTO** | Zero `unstable_cache`/`revalidateTag` no projeto; os únicos 2 `Cache-Control` do repo estão em `manifest` e `icon`. Cardápio, stories, banners, destaques e reviews recalculam por request. |
| F3A-044 | **ALTO** | Chamadas externas sem `timeout` em iFood, 99 e Inter: um provedor lento segura a função até o limite de duração e trava o loop inteiro no primeiro endpoint mudo (só `ifood-catalog-write` tem timeout). |
| F3A-045 | **ALTO** | `ifood-catalog/push` usa loops seriais com backoff de 429 por item — cardápio grande × latência × backoff excede a duração da função e devolve catálogo pela metade. |
| F3A-046 | **ALTO** | `PATCH /api/orders/[id]` refaz a mesma loja 5 vezes (`:203,252,289,408,535`) e ainda aguarda delay aleatório antes do envio de WhatsApp — um clique de status custa 2–5+ s, dos quais 1,5–3,5 s são… |
| F3A-050 | **ALTO** | `POST /api/push` executa `CREATE TABLE IF NOT EXISTS` a cada gravação — DDL em rota de alta frequência toma lock de catálogo e bloqueia leituras concorrentes por instantes. |
| F3A-055 | **ALTO** | Cardápio: o tick de 15 s faz DUAS chamadas idênticas a `/api/orders/customer` (`loadCustomerOrders` + fetch direto), ambas com cache-buster `_=${Date.now()}` e ambas rodando o `updateMany` de… |
| F3A-056 | **ALTO** | Tela de pagamento do cardápio mantém 3 loops concorrentes: tracking 10 s + mensagens 10 s + `payment-status` a cada 3 s (que faz `findUnique` do pedido e até 2 chamadas externas ao gateway por tick). |
| F3A-057 | **ALTO** | Caixa gerencial baixa todos os pedidos do tenant a cada 15 s e filtra o período no cliente — mais um consumidor persistente do endpoint mais caro. |
| F3B-003 | **ALTO** | Painel de Pedidos: cada `OrderCard` monta um polling individual de mensagens de 30 s → N requisições/30 s + N `setState` no pai re-renderizando a lista inteira (50 pedidos = 50 GETs/30 s + 50… |
| F3B-004 | **ALTO** | Cada tick de 30 s do painel dispara em cascata serial: `POST ifood-poll` (sync externo iFood no servidor) → `GET poll-99` → `GET /api/orders` → (condicional) `POST payments/sync` — um iFood lento… |
| F3B-012 | **ALTO** | O cardápio público é um único componente `"use client"` de 7.360 linhas com 146 `useState` — carrinho, checkout, PIX, chat, stories, carrosséis e OTP num só módulo hidratado no celular do cliente.… |
| F3C-006 | **ALTO** | Inventário de timers por loja: KDS 5 s, chat 5 s, caixa 10 s, staff 10 s, motoboy 10 s, mesa 10 s, caixa-gerencial 15 s, cardápio 15 s, painel 30 s, entregas 30 s, tracking 10/30 s, config 3 s → até… |
| F3C-008 | **ALTO** | Prova vivida: o painel de pedidos tem jitter manual com comentário literal "para não estourar o limite de conexões do pooler" — aplicado em só 1 dos ~12 timers do projeto. |
| F3C-014 | **ALTO** | Pior para pagamento online: pedidos ficam invisíveis ao KDS até `paymentStatus="paid"` (`orders/route.ts:727-746`), e quem pode confirmar cedo é o poll de 3 s do próprio cliente → +3 s (poll) +5 s… |
| F3C-019 | **ALTO** | 1 venda balcão = 7–8 requisições HTTP: `POST /api/orders` + `POST movements` + 5 refetches completos (produtos, pedidos, caixa, usuários, estabelecimento) — refetch redundante de… |
| F3C-020 | **ALTO** | O caixa é bloqueado até a resposta completa + 2,5 s de diálogo modal de sucesso (`closing=true` antes do POST, só libera no `finally` + `setTimeout(2500)`) — próxima venda fisicamente impossível;… |
| F3D-012 | **ALTO** | Logo/capa/`confirmationImage` entram sem nenhuma compressão client-side (`FileReader.readAsDataURL` direto) e são persistidas porque estão em `SAFE_FIELDS` — o `/api/icon` confirma em produção: "Data… |
| F3D-015 | **ALTO** | Não existe fila nenhuma: zero inngest/bullmq/trigger.dev/pg-boss/`waitUntil`/`after()` (grep = 0 em código e lockfile). IA do WhatsApp, push em lote, sync de pagamento e expiração de pedidos rodam… |
| F3D-024 | **ALTO** | Bundle medido no manifest: `/[slug]/page` = 7 chunks, 587 KB brutos / 153 KB gzip (maior rota do app; `/dashboard/cardapio` = 473 KB, `/` = 296 KB). |

### Confiabilidade — 35 achados (1C/34A)

| ID | Sev | Achado |
|---|---|---|
| F4A-001 | **CRÍTICO** | Webhook iFood responde `200 ok:true` mesmo quando todos os eventos falham (`create_error`/`fetch_error`/`auth_error` só entram no array `results`) → iFood considera entregue e não reenvia:… |
| F4A-004 | **ALTO** | Mesmo que o cron rodesse: o reconciliador de pagamentos só olha pedidos criados nos últimos 15 minutos — webhook perdido com pedido >15 min nunca é resgatado; pagamentos Asaas órfãos permanecem… |
| F4A-007 | **ALTO** | Transferência de mesa no caixa mostra toast de sucesso mesmo se a API falhar: o `fetchAuth` está em `catch {}`, o estado local da mesa já foi limpo antes e o toast é incondicional → pedidos "somem"… |
| F4A-008 | **ALTO** | Webhook 99Food descarta cancelamento/status de pedido inexistente sem rastro: `if (existing) {...}` sem `else`, resposta `ok:true` — evento (ex.: cancel que chegou antes do create) é ignorado para… |
| F4A-009 | **ALTO** | Webhook 99 (corridas): falha ao atualizar o pedido vira só `statusProcessamento: "erro"` numa tabela que ninguém relê; o pedido fica preso em `out_for_delivery` para sempre e o `poll-99` que cobriria… |
| F4A-011 | **ALTO** | Não existe retry genérico nem circuit breaker (grep `circuit\·breaker` = 0 ✅): o único retry é específico e só para HTTP 429 (catálogo iFood); `fetch-auth` só retenta em 401 com refresh. Falha… |
| F4A-013 | **ALTO** | Webhook iFood loga todos os headers integrais (`Object.fromEntries(req.headers)`) a cada chamada → credencial de webhook persistida nos logs da Vercel. |
| F4A-015 | **ALTO** | Fragmentos de credenciais logados: primeiros 10 chars da API key Pagar.me e 20 chars do access token Meta em rotas de pedido/verificação. |
| F4A-021 | **ALTO** | `/api/alerts` não cobre saúde de integrações: a falha de cota Meta (erro 131048) vira só um card no painel — sem push/e-mail/admin quando o WhatsApp de um tenant para ou a cota estoura. |
| F4A-025 | **ALTO** | `JSON.parse(order.items)` sem guarda no render do KDS e do painel: um `items` corrompido derruba a tela inteira da cozinha — e não existe `error.tsx`/`global-error.tsx`/ErrorBoundary em lugar nenhum… |
| F4B-002 | **ALTO** | Dedup iFood é check-then-create fora de transação: a corrida vira `P2002` e o fallback grava o pedido no primeiro tenant da lista. |
| F4B-009 | **ALTO** | Webhook Pagar.me grava `FinancialTransaction` sem chave de idempotência e sem `@@unique` — reenvio de `order.paid` duplica taxa/valor líquido no relatório financeiro. |
| F4B-011 | **ALTO** | Webhook Efi: nenhuma autenticação e nenhuma verificação de txid — qualquer POST força `paymentStatus=paid` e o update regride `delivered→confirmed`. |
| F4B-012 | **ALTO** | Webhook Inter: nenhuma autenticação; o "valor pago" vem do corpo do payload, sem verificação contra a cobrança criada. |
| F4B-020 | **ALTO** | Em falha do provedor, o pedido é deletado mas o cliente já foi criado/incrementado (`totalOrders`, `totalSpent`, `loyaltyPoints`) — cada retry infla fidelidade e "gasto total" sem pedido… |
| F4B-022 | **ALTO** | Nenhum endpoint de replay/reprocessamento manual de webhooks — quando o evento se perde (F4A-001/002), a única recuperação é abrir o dashboard e torcer pelo sync manual. |
| F4B-024 | **ALTO** | O sync de compensação cobre apenas Asaas: estabelecimentos em Pagar.me/Efi/Inter ficam sem nenhuma rede de segurança server-side. |
| F4B-026 | **ALTO** | A compensação pública `/payment-status` não cobre Efi: o `paymentId` da Efi é um txid puro sem prefixo, cai no branch Asaas e consulta a API errada em silêncio. |
| F4B-030 | **ALTO** | `dispatch-99` não verifica se já existe corrida antes de despachar (o guarda existe só no PATCH do operador) — retry/duplo clique paga 2 corridas na 99. |
| F4B-032 | **ALTO** | PATCH do operador grava o status local antes de empurrar ao iFood; se o iFood falhar, a falha só é logada — divergência permanente entre cozinha e marketplace, sem flag de dessincronização. |
| F4B-037 | **ALTO** | Pagamento recebido sem pedido correspondente é descartado em silêncio: `/api/pix-generate` cria cobrança Asaas sem `orderId` e o webhook só loga "Order not found" — dinheiro entra sem pedido e sem… |
| F4C-002 | **ALTO** | Boot do PDV sem `try/catch`: falha em 1 das 5 requisições do `Promise.all` congela o caixa no spinner para sempre, sem mensagem nem retry (a home do dashboard trata isso; o caixa, não). |
| F4C-015 | **ALTO** | Impressão é 100% nativa do navegador (`window.open` + `document.write` + `print()` + `close()` imediato): popup bloqueado = falha absolutamente silenciosa — nada impresso, nenhum aviso, e o sistema… |
| F4C-016 | **ALTO** | Nenhuma lib/SDK de impressão térmica, nenhum ESC/POS, nenhum fallback para PDF, nenhum retry — sem papel/driver/permissão não há plano B; existe página de marketing prometendo "Impressão de cupom"… |
| F4C-017 | **ALTO** | Reimpressão limitada ao último pedido em memória (`lastOrder`/`lastClosedOrder`): recarregar a página apaga a capacidade de reimprimir — sem histórico de cupons no servidor nem endpoint de reemissão. |
| F4C-019 | **ALTO** | Sem `.env.example` e drift real código↔env: variáveis obrigatórias usadas no código não existem no `.env` (`PAGARME_API_KEY`, `PAGARME_WEBHOOK_KEY`, `ASAAS_WEBHOOK_TOKEN`, `IFOOD_WEBHOOK_SECRET`,… |
| F4C-023 | **ALTO** | Testes não rodam no build nem no deploy: `build` = `rm -rf .next && next build` sem `npm test`; `vercel.json` sem etapa de teste — os 6 arquivos de teste são inúteis como gate (lado bom: `next build`… |
| F4C-024 | **ALTO** | Sem runbook de deploy/rollback: `docs/` tem só 2 arquivos funcionais; tags git existem mas sem convenção operacional; recuperar de incidente depende do conhecimento de uma pessoa. |
| F4C-027 | **ALTO** | `db:reset` = `prisma db push --force-reset` sem guarda de ambiente — com `DATABASE_URL` de produção no `.env`, um `npm run db:reset` apaga o banco inteiro; sem doc nem trava. |
| F4C-030 | **ALTO** | Working tree sujo desde 26/09: 20+ arquivos modificados e não commitados (incl. `schema.prisma`, `sw.js`, `caixa-page.tsx`, `kds/screen`, `orders/route.ts`) — o que roda em produção não é rastreável… |
| F4D-002 | **ALTO** | Nenhum runbook de incidentes — `grep ifood docs/` = 0 ocorrências. Os 5 cenários prováveis (iFood fora, gateway fora, pool Supabase esgotado, WhatsApp fora, KDS mudo) não têm procedimento… |
| F4D-004 | **ALTO** | As proteções anti-ban documentadas não existem no código: o doc descreve `DAILY_LIMIT`, `isRateLimited()`, `isBanned()` etc.; grep em `src/` = 0. O operador acredita ter teto de mensagens que não… |
| F4D-009 | **ALTO** | Os "Monitores de serviço" do painel SaaS são hardcode `ok: true` (Vercel, OpenAI, Evolution) — só o banco tem check real (`SELECT 1`). Painel mostra verde com iFood/Evolution/OpenAI caídos. |
| F4D-019 | **ALTO** | Infraestrutura crítica fora do repo e sem dono/SLO/procedimento: Evolution API ( Railway/VPS por tenant, credenciais em colunas, estado de conexão nunca monitorado), Meta Cloud, Supabase Storage… |
| F4D-021 | **ALTO** | iFood fora: `getIfoodAuth` devolve `null` em qualquer erro e `getIfoodEvents` devolve `[]` — falha vira vazio; o cron devolve 502 que ninguém lê; nenhum estado degradado visível para o lojista. |

### Negócio — 20 achados (4C/16A)

| ID | Sev | Achado |
|---|---|---|
| F5A-002 | **CRÍTICO** | PATCH sem máquina de estados: grava `...(status && {status})` sem validar estado de origem, `role` nem valor do enum — qualquer autenticado da loja faz `delivered → preparing`. |
| F5A-009 | **CRÍTICO** | Falha ao gerar PIX/cartão apaga o pedido (`order.delete`, `:539`) depois da transação que já debitou estoque — sem `restoreOrderStock`. |
| F5B-002 | **CRÍTICO** | `POST /api/categories` sem `verifyAuth`: cria categoria/produto em qualquer `establishmentId` do body. |
| F5B-013 | **CRÍTICO** | Subtotal calculado com `i.price` do cliente; `deliveryFee`, descontos de fidelidade/cupom/primeira compra também vêm do body e só são somados. |
| F5A-015 | **ALTO** | Despesa grava `cashMovement.amount` positivo e o fechamento soma `m.amount` direto → `expected = opening + Σmov` superestima o caixa em 2× o valor da despesa. |
| F5A-016 | **ALTO** | Entregador sem auto-confirmação de pagamento ao concluir. |
| F5A-017 | **ALTO** | Fechamento de mesa: pedido criado com `price` do body, sem baixa de estoque, `serviceTax` do cliente no total lançado. |
| F5A-018 | **ALTO** | A DRE não tem linha de CMV: `lucroBruto = receitaLiquida − custoEntregas` — o módulo `/api/financial/cmv` existe e nunca é consultado. |
| F5A-023 | **ALTO** | Chargeback/estorno muda só `paymentStatus`: o pedido segue contabilizado como venda, sem devolver estoque nem fidelidade. |
| F5A-031 | **ALTO** | Pedido agendado expira como `abandoned`: o expurgo filtra `createdAt < threshold` e ignora `isScheduled/deliveryDate`. |
| F5A-044 | **ALTO** | Fuso (UTC) nos agrupamentos diários afeta também os gráficos do painel. |
| F5B-016 | **ALTO** | `products/update-prices` recalcula e grava preços em lote de `categoryId`/`stockItemId` vindos do body, sem conferir dono. |
| F5B-018 | **ALTO** | Reatribuição de motoboy é regra só da tela: a UI envia `deliveryPersonId` no PATCH, o handler destructura só `status, paymentStatus, cancellationReason, cancelledBy` — a troca falha em silêncio. |
| F5B-019 | **ALTO** | Auth do entregador = token hex de 8 bytes na query string (`?token=`) + `status` livre, sem máquina de estados. |
| F5B-020 | **ALTO** | `deliveryCode` = últimos 4 dígitos do telefone do cliente e é devolvido a qualquer portador do `trackingToken`. |
| F5B-021 | **ALTO** | Handshake de entrega valida código de 4 dígitos sem limite de tentativas (10k combinações); 1 erro já grava `delivered`. |
| F5B-022 | **ALTO** | `canCloseRegister` só esconde o botão: o PATCH fecha o caixa com qualquer token autenticado (sem checar papel/permissão). |
| F5C-014 | **ALTO** | O poll descarta silenciosamente (`skipped++`) todo código fora de 3 listas fixas — sem log, sem ack, sem dead-letter. |
| F5C-021 | **ALTO** | Limites por plano nunca aplicados — `subscriptionPlan`/limites não aparecem em nenhuma rota de escrita (usuários e recursos ilimitados). |
| F5C-027 | **ALTO** | `cron/reset-ai-usage` existe mas não está agendado — atingido o limite mensal de IA, o bot fica mudo para sempre. |

### Integrações — 16 achados (4C/12A)

| ID | Sev | Achado |
|---|---|---|
| F5A-010 | **CRÍTICO** | `OVERDUE` → `cancelled` sem estorno: `payments/sync:33` e `webhooks/asaas:90` só fazem `order.update` — `restoreOrderStock` só existe em 4 arquivos (grep), nenhum deles financeiro. |
| F5A-011 | **CRÍTICO** | Cancelamento vindo do iFood devolve estoque mesmo já devolvido (nenhum guard de `status === "cancelled"`) e depois `order.delete` — estoque inflado + hard delete. |
| F5C-001 | **CRÍTICO** | `POST /api/subscription/create` sem auth: qualquer visitante troca o plano de qualquer loja e, sem `ASAAS_API_KEY`, o handler grava `subscriptionStatus: "active"` direto (sandbox). |
| F9D-001 | **CRÍTICO** | PAN/CVV processados no servidor (PCI DSS scope). Rota Asaas de cartão recebe `creditCard.number` e `creditCard.cvv` do client e repassa ao gateway com logs de holder/CPF — a plataforma fica no escopo… |
| F5A-013 | **ALTO** | Placeholder iFood preenchido com os itens reais via `order.update` sem `deductOrderStock` — o pedido maior nunca baixa estoque. |
| F5A-014 | **ALTO** | Snapshot de CMV (`OrderItemCost`) só é gravado no `POST /api/orders` — pedidos iFood/99/WhatsApp/mesa entram com custo 0. |
| F5C-012 | **ALTO** | Cobrança recorrente não existe: pagamento único gravado em `asaasSubscriptionId`, nenhum cron de cobrança no `vercel.json` (só `verify-reminder` + `sync-ifood-status` ✅). |
| F5C-013 | **ALTO** | Nenhum evento iFood é confirmado (`getIfoodEvents` só faz GET, 0 `acknowledgment`) e o cancelamento apaga o pedido → a fila reentrega e o poll recria, debitando estoque de novo. |
| F5C-015 | **ALTO** | iFood usa credenciais de OAuth da plataforma + `ifoodMerchantId` digitado livremente no painel e nunca homologado → é possível ler pedidos de outra loja. |
| F5C-016 | **ALTO** | 99Food roda com endpoints que o próprio código declara estimativa pendente de documentação oficial, sem homologação. |
| F5C-017 | **ALTO** | Abrir/fechar a loja só afeta `direto` e `ifood` — o 99Food nunca recebe a mudança e segue aceitando pedido com a loja fechada. |
| F5C-018 | **ALTO** | O cron `sync-ifood-status` trata `businessHours` nulo/inválido como fechado (auto-pausa indevida) e não checa o retorno de `delete/createInterruption`. |
| F5C-025 | **ALTO** | `metaAccessToken` fica em texto puro no schema, sem `expiresAt` e sem job de renovação — só a nova captura manual evita token expirado (loja muda para "sem WhatsApp" sem aviso). |
| F5C-030 | **ALTO** | Push de status ao iFood: `result.success` é só logado — sem rollback, sem reprocesso, painel e marketplace divergem. |
| F9D-005 | **ALTO** | 99Food integrada por API especulativa. `nine-food-status.ts` mapeia endpoints "Will be refined once we receive actual API documentation" — paths (`/orders/{id}/confirm` etc.) não são oficiais; risco… |
| F9D-010 | **ALTO** | Zero módulo fiscal real. Grep de `CFOP`, `NF-e`, `NFe`, `DANFE`, `SPED`, `NFSe`, `certificado digital`, `eSocial`, `CST` em `src/` = 0 ocorrências relevantes (só falsos positivos de… |

### KDS — 6 achados (0C/6A)

| ID | Sev | Achado |
|---|---|---|
| F5D-003 | **ALTO** | Indicador de conexão decorativo: o ponto verde "Modo Serviço: Ativo" é estático no JSX; o `catch` do polling só faz `console.error` — sem estado offline, sem backoff, sem aviso. |
| F5D-004 | **ALTO** | Aba em segundo plano não gera alerta confiável: só `setInterval` (throttled a ≥1/min quando oculta), 0 `visibilitychange`/`Notification` em `src/app/kds` ✅ — enquanto o dashboard já usa… |
| F5D-005 | **ALTO** | Alerta sonoro mudo por padrão (sem `kds_sound` salvo, estado inicial `false`) e o `AudioContext` só desbloqueia no primeiro clique/touch → tablet/kiosk que abre direto não emite o primeiro som do dia. |
| F5D-006 | **ALTO** | Pedido cancelado depois de chegar some sem aviso (sem card vermelho, sem som): o filtro aceita só 6 statuses e `cancelled` apaga o card em até 5 s — a cozinha já o estava produzindo. |
| F5D-007 | **ALTO** | Pedido agendado entra na cozinha na hora e o expurgo de `abandoned` (que ignora `isScheduled`) o faz desaparecer antes da data. |
| F5D-009 | **ALTO** | N+1 a cada 5 s: 1 `GET /api/orders` + 1 `GET /orders/{id}/messages` sequencial por pedido (20 pedidos = 21 chamadas/ciclo; 4 telas ≈ 84/5 s) e o `GET` ainda roda `updateMany` (F5D-025). |

### Cardápio público — 18 achados (10C/8A)

| ID | Sev | Achado |
|---|---|---|
| F6A-001 | **CRÍTICO** | Registro completo da loja (32 credenciais) serializado como prop do cardápio no HTML |
| F6A-004 | **CRÍTICO** | `PATCH /api/payment-request` sem auth marca pedidos como `paid`/`delivered` |
| F6A-005 | **CRÍTICO** | `GET /api/payment-request` sem auth devolve pedidos inteiros (PII + `trackingToken`) |
| F6A-010 | **CRÍTICO** | `GET /api/categories` e `GET /api/products/[id]` expõem `unitCost`, estoque e ficha técnica |
| F6A-011 | **CRÍTICO** | `PATCH/DELETE /api/products/[id]` autentica mas não checa dono → edição de produto de outra loja |
| F6A-012 | **CRÍTICO** | Path traversal em `/api/icon/[slug]`: `logo="/../.env"` lê arquivo arbitrário |
| F6A-034 | **CRÍTICO** | `POST /api/delivery/dispatch-99` sem nenhum import de auth dispara corrida real e devolve `rideId` + `pinCode` |
| F6A-035 | **CRÍTICO** | `POST /api/pix-generate` sem auth cria cobrança Asaas com `value: amount` do body |
| F6B-001 | **CRÍTICO** | `body.status` e `body.method` aceitos do cliente: contorna o gate "cozinha só após pagar" e grava status arbitrário |
| F6B-002 | **CRÍTICO** | Fidelidade/cashback (`loyaltyDiscount`/`loyaltyPointsUsed`) do body sem validar saldo → pedido por R$ 0 e pontos negativos |
| F6A-036 | **ALTO** | `GET /api/push/order-details` sem auth: com `establishmentId` + telefone devolve nome, itens e total da vítima |
| F6B-003 | **ALTO** | Nenhuma validação de `productId`/adicionais contra a loja, `isAvailable` ou `availableOnline`; estoque/CMV de outro tenant acessíveis |
| F6B-004 | **ALTO** | Servidor não valida horário da loja, `isOpenOverride`, `isActive` nem assinatura |
| F6B-005 | **ALTO** | `isOpen` calculado uma única vez (`useMemo`) — a loja fecha e a página aberta continua vendendo |
| F6B-006 | **ALTO** | Sem idempotência no servidor: timeout/retry gera 2 pedidos; `trackingToken` novo a cada request |
| F6B-007 | **ALTO** | Zonas de entrega/raio/geolocalização mortas no cardápio: `GeolocationButton` importado e nunca renderizado |
| F6B-008 | **ALTO** | 99Entrega nunca despachada para pedidos do site (`customerLat/Lng` sempre nulos) |
| F6B-009 | **ALTO** | PAN+CVV do cartão atravessa o backend sem tokenização; `/api/payments/{asaas,pagarme}/card` sem `verifyAuth` |

### Login OTP — 11 achados (2C/9A)

| ID | Sev | Achado |
|---|---|---|
| F7A-005 | **CRÍTICO** | `GET/POST/PATCH/DELETE /api/addresses` por `customerId` vindo do cliente, e o front já busca os endereços antes do OTP |
| F7A-013 / F7B-005 | **CRÍTICO** | OTP vai em template UTILITY (`atualizacao_suporte_v1`, texto de "protocolo de atendimento") e `findApprovedTemplate` escolhe qualquer template aprovado `pt_BR`, sem checar categoria — a Meta exige… |
| F7A-008 / F7B-023 | **ALTO** | `GET` com efeito colateral: `/api/orders` e `/api/orders/customer` marcam pedidos `abandoned` via `updateMany` dentro de um GET público |
| F7A-009 / F7B-011 | **ALTO** | Rate limit só por número: nenhum teto por IP, dispositivo ou loja; `checkRateLimit` não é usado nesta rota; `BYPASS_PHONES` é ilimitado |
| F7A-010 | **ALTO** | Normalização fraca: `>= 10` dígitos, sem teto e sem strip de `55` (API) vs 11 (front) → contas duplicadas e bypass do rate limit por variação do mesmo número |
| F7A-011 | **ALTO** | Respostas distintas para errado/expirado/inexistente, `remaining` exposto e race no contador de tentativas (lê → compara → incrementa) |
| F7A-012 | **ALTO** | Sem cota por loja antes do envio; sem provedor cai no fallback Meta do SaaS (custo da plataforma); `trackMessageCost` não tem categoria `authentication`; cron `meta-quota` não está agendado |
| F7A-014 | **ALTO** | Troca de telefone no perfil sem re-OTP do novo número e sem fluxo de recuperação (perdeu o chip = perdeu a conta) |
| F7A-015 / F7B-008 | **ALTO** | Não existe sessão de servidor: flag `localStorage` sem TTL/renewal/revogação, `whatsappVerified=true` para sempre e nenhuma rota de cliente exige a verificação — os gates (carrinho/pedido/perfil) são… |
| F7B-010 | **ALTO** | Webhook WhatsApp forjável: sem `X-Hub-Signature-256`, verify token com fallback `"flowos-meta-verify"`, apikey do Evolution validada só se o header existir |
| F7B-012 | **ALTO** | Sem fallback de canal (SMS/e-mail) e sem correlação do webhook de status com `VerificationCode`; WhatsApp da loja fora ⇒ o "fallback" é exibir o código na tela |

### Qualidade — 5 achados (0C/5A)

| ID | Sev | Achado |
|---|---|---|
| F0-001 | **ALTO** | Duplicação front↔back com divergência de valor no subtotal (`first_only`) e descontos aceitos do cliente |
| F0-002 | **ALTO** | "Esqueci a senha" nunca envia o e-mail — link só no `console.log` do servidor |
| F0-003 | **ALTO** | Código OTP gerado com `Math.random` e logado em `console.log` (13× em `/api/verification`) |
| F0-004 | **ALTO** | Vite `next` crítico + `remotePatterns: hostname ""` no `next.config.js` |
| F0-005 | **ALTO** | 140 `catch` que só fazem `console.error` (erros somem); 165 respostas 500 genéricas |

### UX — 27 achados (4C/23A)

| ID | Sev | Achado |
|---|---|---|
| F8A-001 | **CRÍTICO** | PDV: coluna do carrinho fixa em 320px sem quebra responsiva. Corpo é `flex overflow-hidden` com produtos `flex-1` + carrinho `flex w-80`. Em celular (375px) restam ~55px para a grade de 4 colunas; em… |
| F8D-001 | **CRÍTICO** | Card de produto do cardápio digital é `<div onClick>` sem `role`/`tabIndex`/`onKeyDown` ✅ — abrir o detalhe do produto (passo central da compra) é impossível por teclado/leitor de tela. |
| F8D-002 | **CRÍTICO** | PDV: card de mesa é `<div onClick>` ✅ — `selectTable(num)` só por mouse/touch. Botões filhos (QR, Transferir, Conta) são `<button>` aninhados dentro do div clicável. |
| F8D-004 | **CRÍTICO** | 76 modais sem semântica de diálogo: `role=`, `role="dialog"`, `aria-modal` = 0 ✅ em todo `src`. Leitores de tela não anunciam abertura nem delimitam conteúdo; `aria-describedby` = 0. |
| F8A-005 | **ALTO** | Clique na notificação empurra a PRIMEIRA janela aberta para a URL do pedido, sem checar qual tela é — `clients.find(c => c.url.includes(origin))` pega a aba 1 (pode ser `/caixa`, `/kds/screen` ou… |
| F8B-002 | **ALTO** | Pedidos: resposta não-array derruba a renderização — `setOrders(data)` aceita `{error}` (500); `orders.filter/map` lançam `TypeError` → branco total. Zero `Array.isArray` no arquivo ✅. |
| F8B-004 | **ALTO** | Relatórios: falha de rede vira "R$ 0,00 de faturamento" — `catch(() => setLoading(false))` descarta o erro; a tela renderiza zeros idênticos a "sem vendas". Financeiro decide com dado errado. |
| F8B-005 | **ALTO** | Dashboard layout: qualquer falha de rede/500 expulsa o usuário para `/login` — `.catch(() => router.replace("/login"))` trata igualmente token inválido, 500, offline e `{error}`. Perder conexão 5 s =… |
| F8C-002 | **ALTO** | Cadastro de produto: Salvar/Adicionar sem `disabled={saving}` e sem validação de nome/preço → duplo clique cria 2 produtos; guarda só `!categoryId`; erros via `alert()` genérico. |
| F8C-004 | **ALTO** | Abatimento parcial sem trava de re-entrância: `processAbater` sem estado de submitting; duplo clique = 2 partial-payments + 2 movimentos de caixa. |
| F8C-005 | **ALTO** | `ConfirmDialog` compartilhado sem proteção de duplo clique: botão "Confirmar" nunca desabilitado; `onConfirm` dispara N vezes antes do re-render. Afeta: excluir cupom, baixar despesa, fechar mesa,… |
| F8C-006 | **ALTO** | "Pagar e Entregar" (Pedidos Externos) sem guarda: `handlePayOrder` sem loading; duplo clique = 2 PATCH. |
| F8C-008 | **ALTO** | HTML do cupom montado por interpolação sem escape em `document.write` (`printReceiptPopup`): nome de produto/cliente com HTML injeta script no popup de impressão (XSS no fluxo da impressora). |
| F8D-005 | **ALTO** | Cardápio (fluxo principal do cliente): zero fechamento por teclado — 7.360 linhas com 0 `Escape` e apenas 2 `onKeyDown` (OTP, chat). Bottom sheet de produto, carrinho, endereço, cupom, PIX e… |
| F8D-006 | **ALTO** | ~50 botões somente-ícone sem `aria-label` (9 no total para centenas de botões): mostrar/ocultar senha no login, fechar modais do PDV, fechar toasts, sair, abrir menu. |
| F8D-007 | **ALTO** | Rótulos não programaticamente associados: 321 `<label>` mas só 13 `htmlFor` ✅ para 335 `<input>`; nenhum `<input>` tem `aria-label`. Login (4 inputs/0 htmlFor), config (77/0), cardápio (42/0), caixa… |
| F8D-008 | **ALTO** | Componente `ui/Input` (o único acessível) nunca recebe `id` → `htmlFor={undefined}`/`id={undefined}`: mesmo nos 3 formulários que usam o componente o rótulo não é associado. |
| F8D-009 | **ALTO** | Campos com rótulo apenas por `placeholder` (some ao digitar, nunca anunciado como rótulo persistente): item avulso do PDV, cupom, observações, cartão de crédito, busca do cardápio. |
| F8D-010 | **ALTO** | Sem mecanismo de bypass (2.4.1): 0 skip links; `<main>` em apenas 3 de 64 rotas ✅. Cardápio do cliente, PDV, tracking e login não têm `<main>`/`<nav>`/`<header>`. |
| F8D-011 | **ALTO** | Estado de navegação não exposto: `aria-expanded`/`aria-controls`/`aria-current` = 0. Submenus colapsáveis do sidebar sem `aria-expanded`; item ativo comunicado só por estilo. |
| F8D-012 | **ALTO** | Títulos de página não distinguem rotas: só 4 de 64 rotas definem `metadata`; `/kds`, `/caixa`, `/dashboard/*`, `/login`, `/pedido/*` herdam todos `title: "FlowOS - Cardápio Digital"` (WCAG 2.4.2). |
| F8D-013 | **ALTO** | Badge `.badge-fire` não existe em nenhum CSS (grep em `globals.css` = 0 ✅) — o span usa `text-white` sem fundo → em tema claro (card `#f9fafb`) o texto é branco sobre branco (~1:1) e some. Afeta "🔥… |
| F8D-014 | **ALTO** | Texto branco sobre cores claras (≈1,7–2,2:1): `bg-yellow-400` (~1,7:1), `bg-amber-500` (~2,2:1), `bg-green-500` (~2,1:1) com `text-white` em fontes de 9–10px — selos operacionais "Atenção", badges de… |
| F8D-015 | **ALTO** | Contraste no cardápio do cliente: `theme.textMutedMore` = alpha 0,40 (~2,4:1 sobre claro; necessário 4,5:1) usado em nomes de categoria (navegação), preços riscados, horários — 58 usos; versão dark… |
| F8D-016 | **ALTO** | `focus:outline-none` sem substituição em 16 elementos ✅ (busca, endereço, quantidade, observação do cardápio + searchable-select). `focus-visible` = 0 no app inteiro. |
| F8D-017 | **ALTO** | Sem gestão de foco em modais: nenhum `useEffect` move o foco para a janela aberta nem o devolve ao gatilho; sem focus trap; fundo continua tabulável (`tabIndex` = 0 no projeto). Único `autoFocus` é o… |
| F8D-018 | **ALTO** | Escape fecha só 8 pontos de 76 overlays — PDV cobre 3 modais; não cobre `tableQRModal`, `transferModal`, `staffQr`, `abaterModal`; cardápio do cliente: 0. |

### Produto/SaaS — 9 achados (6C/3A)

| ID | Sev | Achado |
|---|---|---|
| F9A-001 | **CRÍTICO** | Cadastro público sem rate limit cria tenant + admin + produtos em 1 request. `POST /api/establishments` é anônimo, valida só presença de campos, não tem captcha/limite/verificação de e-mail, cria… |
| F9A-006 | **CRÍTICO** | Escalada de privilégio: qualquer usuário autenticado cria usuário `admin`. `POST /api/users` exige auth, mas aceita `role`/`permissions` do body sem checar o role do chamador (`role: role \·\·… |
| F9A-007 | **CRÍTICO** | Backoffice SaaS: PATCH de comissão sem `verifyAuth`. Rota em `admin-saas` altera `saasCommissionPercentage` de qualquer estabelecimento só com `establishmentId` no path — sem checar admin SaaS, sem… |
| F9A-008 | **CRÍTICO** | Sem multi-loja real: 0 telas de troca de estabelecimento. O plano Enterprise promete "Múltiplas filiais" na landing e nos cards, mas não existe seletor de tenant, nem convite de filial, nem vínculo… |
| F9B-002 | **CRÍTICO** | `POST /api/subscription/create` sem auth e com "sandbox mode" que ativa plano sem pagar. Aceita qualquer `establishmentId`; se `ASAAS_API_KEY` estiver vazia, comenta "Sandbox mode — activate… |
| F9B-005 | **CRÍTICO** | Zero enforcement de plano no backend. Único limite por estabelecimento em todo o código é `aiMessagesLimit` (IA); nada bloqueia Multi-unidade/API/relatórios avançados do Enterprise para quem está em… |
| F9A-002 | **ALTO** | Pós-cadastro: zero onboarding. Usuário é auto-login e cai direto no dashboard vazio; não há wizard de 1º pedido, checklist, import de cardápio nem guia de configuração. O único "wizard" do produto é… |
| F9A-004 | **ALTO** | `delivery-persons` aberto: lista e cria motoboy de qualquer tenant + senha default `123456` em claro. GET aceita qualquer `establishmentId` sem auth; POST cria `User` role `motoboy` com… |
| F9C-001 | **ALTO** | CTA "Falar com vendas" (Enterprise) é `<span>` sem link. O card Enterprise promete "Gerente de conta dedicado" e "SLA garantido", mas o botão é span decorativo dentro de um `Link` genérico para… |

---

## 4. Roadmap em 3 horizontes

### (a) H1 — Corrigir JÁ, antes de qualquer cliente real (bloqueante de go-live)

| # | Ação | Fecha | Esforço |
|---|---|---|---|
| 1 | **Mover `middleware.ts` para `src/`** + corrigir `PUBLIC_ROUTES` (incl. `/api/verification`, `/api/addresses`) + testar build (`middleware-manifest.json` ≠ `{}`) | F1A-001, F1C-101, F6B-010, F7A-016 | S |
| 2 | **Adicionar `verifyAuth` + checagem `establishmentId`** em todas as 51 rotas listadas (orders, customers, stock, cash-register, categories, expenses, financial/*, subscription/*, delivery-persons, payment-request, meta-*) | F1A-003/004/005/011, F1B-002, F5A-006/008, F5B-004/006/007/008/010 | **L** |
| 3 | **Remover `devCode`/`verifyLink` das respostas de OTP** + `crypto.randomInt` no lugar de `Math.random` + template `AUTHENTICATION` + redigir logs | F7A-001/002/003, F1C-004, F4A-016 | S |
| 4 | **`select` explícito em establishments/orders/pedido** (nunca devolver `password`, API keys, `.p12`, `metaAccessToken`, GPS, `pixPayload` ao cliente) | F1C-002/003/102, F6A-001, F1D-001/003 | M |
| 5 | **Recalcular preço/subtotal/cupom/fidelidade no servidor** (whitelist de campos aceitos no body de `POST /orders`) | F1C-201/202, F5B-013, F6B-001/002, F0-001 | M |
| 6 | **Auth+assinatura em `subscription/create` e `subscription/webhook`**; remover branch sandbox; model `Plan`/`Subscription` | F5C-001/003, F9B-001/002/003/004 | M |
| 7 | **Fechar escalada**: `role`/`permissions` só por admin do mesmo tenant (server-side whitelist) | F1A-002, F5C-022, F9A-006 | S |
| 8 | **Idempotência de pedido + webhook**: chave `clientRequestId`/`eventId` com `@@unique`; processar webhook antes do 2xx; inbox/dead-letter mínimo | F4A-001/002, F4B-019/021, F6B-006 | **L** |
| 9 | **Rotacionar TODOS os segredos** (lista Fase 1) + `git rm --cached prisma/dev.db` + remover `Admin@…` do seed + fallbacks literais | F1C-005/006/007, pendências F1 | S |
| 10 | **Tokenização de cartão**: sair de PAN/CVV no servidor (hosted checkout Asaas) | F9D-001, F6B-009 | M |
| 11 | **Termos de Uso + aceite + consentimento no schema + link da política** | F9C-004/005/007, F1D-008 | S |
| 12 | **CI mínimo**: lint+typecheck+test no PR; `npm test` no build; guarda de ambiente no `db:reset` | F4C-022/023/027 | S |
| 13 | **Não expor senha default 123456** nem `defaultPassword` em claro; auth em delivery-persons | F5B-006, F9A-004 | S |
| 14 | **Path traversal em `/api/icon/[slug]`** — allowlist de arquivos | F6A-012 | S |

*Esforço: S = dias · M = 1-2 semanas · L = 2-4 semanas (1-2 devs). Ordem respeita dependências (ver §5).*

### (b) H2 — Próximas 2 a 4 semanas

| # | Ação | Fecha |
|---|---|---|
| 1 | Máquina de estados de pedido no servidor (whitelist de transições por role) | F5A-002, F5D-008 |
| 2 | Helper único de estorno de estoque em todos os caminhos `cancelled/abandoned` + `$transaction` em escritas multi-etapa | F5A-009/010/011/022, F2-008 |
| 3 | `PrismaClient` singleton + `@@index` nas 6 tabelas quentes + `Order(customerId)` + `take` em `GET /orders` | F2-009, F3A-061, F2-006, F3A-001 |
| 4 | Mover expiração `abandoned` de GET para cron `expire-orders` | F3A-002/003 |
| 5 | Assinatura em Efi/Inter/WhatsApp/99 webhooks (modelo Asaas/Pagar.me) | F4B-011/012, F7B-010, F9D-002 |
| 6 | Sessão de servidor (cookie httpOnly) para cliente final + revogação no logout | F1A-010, F7A-015 |
| 7 | Rate limit em `/api/verification` (IP + teto diário/loja) + normalização de telefone + cota Meta + cron `meta-quota` | F7A-009/010/012, F5C-026 |
| 8 | `error.tsx`/`global-error.tsx` + Sentry/OTel + `/api/health` + log estruturado com redação | F4A-019/020/018, F8B-003 |
| 9 | `useSubmitGuard`/`disabled` em PDV (fechar mesa, caixa, abater, ConfirmDialog) + `close-table` idempotente | F8C-001/002/003/004/005/006 |
| 10 | Responsividade: PDV drawer mobile, KDS TV (breakpoints + ≥16px), CTA motoboy ≥44px | F8A-001/002/016 |
| 11 | Acessibilidade de base: `userScalable`, `<button>` nos cards, `role="dialog"`+Escape, `aria-label`, `htmlFor`, `focus-visible` | F8D-001…018 |
| 12 | Imagens para Storage (ligar `/api/upload` WebP) + `next/image` + `remotePatterns` restrito + sem base64 no HTML | F3D-010/011/012/013/004 |
| 13 | Banner offline + fila local de pedidos PDV + não limpar carrinho antes do ACK | F4C-001/003/004 |
| 14 | KDS: `res.ok` + indicador real de conexão + som default on + `visibilitychange` + refresh de token | F5D-002/003/004/005/010, F4C-010/011/012 |
| 15 | Reconciliação: agendar `sync-payments` (≥7d, multi-gateway) + `reset-ai-usage`; cobrir Pagar.me/Efi/Inter | F4D-007, F4A-004, F4B-024 |
| 16 | DPA + subprocessadores + retenção job + opt-out STOP + menção IA/OpenAI na política | F9C-006, F1D-007/009/011 |
| 17 | `.env.example` + runbook de incidente (iFood/gateway/WhatsApp/PDV) + tag de release | F4C-019/024, F4D-002 |
| 18 | Remover `delete-all` e `test-dispatch` de produção | F4D-025, F1C-110 |

### (c) H3 — 1 a 3 meses

| # | Ação | Fecha |
|---|---|---|
| 1 | Realtime: `postgres_changes`/channels do Supabase no KDS/painel/caixa; matar polling de mensagens | F3C-001, F3A-021, F3B-001/003 |
| 2 | Fila (inngest/pg-boss) para iFood catalog push, diagnose, sync — fora do request | F3D-015, F3A-019/020/045 |
| 3 | Splitter/merchant of record revisado (quem recebe, split, NFSe do lojista) | F9D-003, F9D-010/011 |
| 4 | Multi-loja real (convite, switcher, filiais) alinhado ao plano Enterprise | F9A-008, F9B-005 |
| 5 | Onboarding guiado + métricas de produto (analytics) + telemetria de trial→paid | F9A-002, F9B-012 |
| 6 | Impressão térmica ESC/POS + PDF fallback + histórico de recibos | F4C-015/016/017 |
| 7 | Migração Decimal para dinheiro + timezone `America/Sao_Paulo` + baseline `0_init` + proibir `db push` | F2-002/004/005 |
| 8 | Testes de carga (k6) em pedidos/KDS + APM com SLOs | F3C-011, meta |
| 9 | Cancelamento/exportação/delete self-service (LGPD + churn) | F9C-010/011/012 |
| 10 | Homologação oficial 99Food + iFood por-merchant credentials + doc de contingência | F9D-004/005, F5C-015/016 |
| 11 | Refatoração de `menu-page.tsx` (7.360 linhas → módulos) + state management | F3B-012, F0-006/007 |
| 12 | WCAG 2.1 AA audit externo + correção de contraste/foco | F8D-013/014/015/016/017 |

---

## 5. Dependências entre correções

```
[1] middleware em src/  ──►  [2] verifyAuth+tenant em 51 rotas  ──►  testes de regressão de tenant
         │                              │
         ▼                              ▼
[3] OTP seguro (crypto+sem devCode)   [5] recálculo de preço no servidor
         │                              │
         ▼                              ▼
[4] select explícito (segredos)       [6] backend de assinatura
         │                              │
         └──────────┬───────────────────┘
                    ▼
            [8] idempotência de pedido+webhook
                    │
                    ▼
        [H2] máquina de estados + estorno único + transações
                    │
                    ▼
        [H2] observabilidade (error.tsx, health, Sentry) — só depois de H1
                    │
                    ▼
        [H3] realtime, fila, multi-loja, homologações
```

- **Não adiantar H2/H3 antes de [1]-[6]:** realtime sobre rotas anônimas amplifica vazamento; multi-loja sem select explícito multiplica credenciais expostas; homologação de marketplace exige idempotência (F4B-019) senão duplica pedidos.
- **Refatoração grande** (`menu-page.tsx`, máquina de estados, fila) só **depois** de CI (H1#12) — sem portão de release, refatorar é piorar.
- **LGPD (termos/aceite)** pode (e deve) ir em paralelo a tudo — é legal, não técnico.
- **Rotação de segredos** é imediata e não depende de nada (só cuidado para não quebrar o que já está em produção — rotacionar com overlap).

---

## 6. Checklist de go-live

| # | Item | Verificável como | Status |
|---|---|---|---|
| 1 | `middleware.ts` carregado no build | `.next/server/middleware-manifest.json` ≠ `{"middleware": {}}` | ❌ **FAIL** (F1A-001) |
| 2 | 0 rotas de negócio sem `verifyAuth` | Script/auditoria de grep nas 149 rotas | ❌ **FAIL** (51+ rotas) |
| 3 | Isolamento de tenant em teste automatizado | Teste: token loja A não lê/escreve loja B em 10 rotas-chave | ❌ **FAIL** (F1B) |
| 4 | OTP nunca sai na resposta; `crypto` para código | Grep `devCode`/`Math.random` = 0 | ❌ **FAIL** (F7A-001/003) |
| 5 | Nenhum segredo/PII em HTML ou logs | Grep de API keys/.p12/CPF/`pixPayload` em responses e logs | ❌ **FAIL** (F6A-001, F4A-014) |
| 6 | Preço/subtotal recalculados no servidor | Teste: POST /orders com price adulterado é rejeitado/recalculado | ❌ **FAIL** (F1C-201) |
| 7 | Webhooks com assinatura (Asaas ok; Efi/Inter/WhatsApp/99 pendentes) | 6/6 webhooks com verificação | ❌ **FAIL** (4/6) |
| 8 | Idempotência de pedido e webhook | Replay do mesmo evento não duplica pedido/cobrança | ❌ **FAIL** (F4B-019) |
| 9 | Assinatura SaaS: cobrança recorrente real + enforcement por plano | Plano starter não acessa features Pro no servidor | ❌ **FAIL** (F9B-004/005) |
| 10 | Segredos rotacionados; `dev.db` fora do repo; seed sem senha fixa | `git log` sem dev.db; env vars novas | ❌ **PENDENTE** (ação manual) |
| 11 | RLS/cripto do Supabase conferido no painel | Print/screenshot do painel + política por tabela | ❌ **NÃO VERIFICADO** (fora do repo) |
| 12 | Backup com restauração testada | Restore em ambiente de teste + contagem de linhas | ❌ **NÃO VERIFICADO** (F4D-005) |
| 13 | CI: lint+typecheck+test bloqueiam merge | GitHub Actions/Outro com status check | ❌ **FAIL** (F4C-022) |
| 14 | `npm test` roda no build/deploy | Log do deploy contendo suite | ❌ **FAIL** (F4C-023) |
| 15 | Rate limit em login, OTP e cadastro | Teste de burst: 10 req/s não passa todas | ❌ **FAIL** (F1A-007, F7A-009) |
| 16 | Health endpoint + monitor externo acionado | `/api/health` 200 + alerta de teste | ❌ **FAIL** (F4A-020) |
| 17 | Erros de página (`error.tsx`) e Sentry/OTel | Forçar erro → tela de erro, não white screen | ❌ **FAIL** (F8B-003, F4A-019) |
| 18 | Log estruturado sem OTP/token/PII | Amostra de 100 logs de produção | ❌ **FAIL** (F4A-016/017) |
| 19 | Termos publicados + aceite + consentimento gravado | Cadastro com checkbox; row com timestamp | ❌ **FAIL** (F9C-004/005) |
| 20 | Política de privacidade linkada + DPA/subprocessadores | Links em rodapé de cadastro/login; doc DPA | ❌ **FAIL** (F9C-006/007) |
| 21 | Tokenização de cartão (sem PAN/CVV no servidor) | Código sem `creditCardNumber`/`cvv` em route handler | ❌ **FAIL** (F9D-001) |
| 22 | PCI/LGPD revisados por jurídico externo | Parecer assinado | ❌ **PENDENTE** |
| 23 | Homologação iFood (credenciais por merchant) | Certificado/status de homologação | ❌ **NÃO VERIFICADO** (F5C-015) |
| 24 | 99Food com doc oficial (hoje especulativa) | Contrato/spec da API | ❌ **FAIL** (F9D-005) |
| 25 | Timezone `America/Sao_Paulo` em relatórios/caixa | Teste com pedido 21h-24h não migra de dia | ❌ **FAIL** (F2-004) |
| 26 | KDS: som on, conexão real, token com refresh | Teste: derrubar rede → banner; voltar → sem reload | ❌ **FAIL** (F5D-003/005) |
| 27 | PDV: duplo clique não duplica pedido/caixa | Teste de re-entrância | ❌ **FAIL** (F8C-001) |
| 28 | Teste de carga (100 lojas × 10 pedidos/min) | Relatório k6 com p95 < 2s em pedidos | ❌ **NÃO EXECUTADO** |
| 29 | Rollback de deploy documentado e testado | Runbook + restore de tag anterior | ❌ **FAIL** (F4C-024) |
| 30 | `delete-all`/`test-dispatch` fora de produção | Grep = 0 em produção | ❌ **FAIL** (F4D-025) |

**Resultado: 0/30 itens verdes.** Go-live não é viável sem, no mínimo, os itens 1-10, 13-15, 19-21.

---

## 7. Plano de testes recomendado

| Tipo | O que testar | Ferramenta sugerida | Prioridade |
|---|---|---|---|
| **Segurança automatizada** | 1) Matriz rota×(anon|staff|other-tenant)×(GET|POST|PATCH|DELETE) — todo `verifyAuth`/comparação de `establishmentId`; 2) grep-gate `devCode`/`Math.random`/`password` em responses; 3) schema de body de `POST /orders` (extra fields rejeitados) | Script Node/pytest + CI | **P0** |
| **Integração de pedidos** | Fluxo feliz criar→pagar→cozinha→entregar; idempotência (retry ×2); máquina de estados (transições ilegais 4xx); estorno de estoque em cancel | Vitest/Playwright + seed de teste | **P0** |
| **Multi-tenant** | Loja A nunca lê/escreve loja B em 15 rotas (orders, customers, products, stock, financial, subscription, meta-*) | Vitest com 2 tenants seed | **P0** |
| **Webhooks** | Payload assinado válido/inválido/expirado para os 6 gateways; replay não duplica; dead-letter enfileira | Vitest + fixtures reais redigidas | **P0** |
| **OTP/autenticação** | E2E: solicitar→receber código→logar; rate limit 5/min; código errado 3× bloqueia; sessão expira; logout revoga | Playwright + WhatsApp mock | **P1** |
| **PDV/KDS (re-entrância e offline)** | Duplo clique em fechar mesa/pagar/abater; offline 30s no PDV com fila; KDS sem rede → banner; token expira → refresh | Playwright com offline route | **P1** |
| **Performance/load** | k6: 50 VUs criando pedidos; p95 < 2s; `GET /orders` com `take`; dashboard < 1s; cardápio LCP < 2.5s (throttling) | k6 + Lighthouse CI | **P1** |
| **Regressão de UI/a11y** | axe em 10 telas principais; zoom 200%; navegação só teclado no cardápio e PDV; contraste | Playwright + axe-core | **P2** |
| **Backup/restore** | Restore point-in-time em staging + contagem de tabelas quentes + diff | Script + runbook | **P1** |
| **Contrato de API** | OpenAPI gerado do código + diff no CI (breaking change bloqueia) | zod-to-openapi + PR check | **P2** |

*Ambiente: nunca `DATABASE_URL` de produção nos testes destrutivos; usar schema/staging com dados sintéticos; mocks de iFood/Asaas/Meta.*

---

## 8. Limitações da auditoria (NÃO VERIFICADO)

1. **Nenhum teste dinâmico contra produção** (regra 2.5) — todos os `testes/*.sh` destrutivos têm `obtido = NÃO EXECUTADO`; scripts estáticos das fases 2/3/4/5/8/9 foram executados com grep/read apenas.
2. **Estado real da infra fora do repo:** RLS/cripto do Supabase, planos/limites da Vercel, backups/PITR, logs de produção, crons agendados no painel (vs `vercel.json`), buckets de Storage, Evolution API/VPS, cota Meta real.
3. **Planos/preços oficiais cobrados** (Asaas/Pagar.me fora do sandbox) e se o "Enterprise" existe comercialmente — só o hardcoded no código foi lido.
4. **DPA, contratos, termos assinados, SLA** podem existir fora do repositório — no repo, não existem.
5. **Homologação iFood/99Food** e comportamento das APIs reais (especialmente 99Food especulativa) — sem credenciais de teste nem docs oficiais no ambiente.
6. **Custos reais de egress/OpenAI/Meta** e se há orçamento/alertas — não medidos.
7. **Comportamento em produção do Prisma pool/connections** (só análise de código do singleton).
8. **Segredos em histórico git além do que foi varrido** — `gitleaks`/`trufflehog` indisponíveis; varredura foi manual por grep/`git log -p`.
9. **Testes de carga e APM** — nenhum executado; latências do KDS/PDV são derivadas de código, não medidas.
10. **Working tree sujo desde 26/09** (~20 arquivos) — tratado como pré-existente; pode esconder divergência entre auditado e implantado.
11. **Acessibilidade**: contrastes são estimativas por valores Tailwind padrão (sem ferramenta axe no ambiente).
12. **Firmware/versão da Evolution, certificados `.p12` reais, Phone Numbers Meta** — não inspecionados.

---

## Apêndice — Origem dos relatórios fase a fase

| Fase | Arquivo | Únicos | C/A/M/B | Nota |
|---|---|---|---|---|
| 0 | `00-qualidade.md` (+inventário/arquitetura) | 16 | 0/5/7/4 | 5,5 |
| 1 | `01-seguranca*.md` | ~113 | 19/41/51/9 | 2,0 |
| 2 | `02-banco.md` | 22 | 1/9/9/3 | 5,5 |
| 6 | `06-cardapio-publico.md` | 76 | 18/18/25/15 | 4,0 |
| 7 | `07-login-otp.md` | 36 | 10/12/9/5 | 3,5 |
| 5 | `05-negocio.md` | 131 | 25/52/47/7 | 3,3 |
| 3 | `03-desempenho.md` | 106 | 10/43/39/8 | 2,1 |
| 4 | `04-confiabilidade.md` | 103 | 15/58/24/6 | 1,5 |
| 8 | `08-frontend-ux.md` | 98 | 7/31/40/20 | 1,5 |
| 9 | `09-produto-juridico.md` | 45 | 17/12/16/0 | 1,3 |
| **Total bruto** | | **~746** | | **2,3** |
| **Únicos após dedup C/A** | §3 deste relatório | **254** | 59/195/—/— | |

*Fim do relatório.*
