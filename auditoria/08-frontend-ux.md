# FASE 8 — FRONTEND, UX E ACESSIBILIDADE (painel, PDV, KDS, motoboy)

**Data:** 09/10/2026 · **Saída:** `auditoria/08-frontend-ux.md` · **Termo:** `AUDITORIA-SAAS-FOOD.txt:492-500`
**Método:** leitura estática de ~108 arquivos `.tsx` (App Router) + `public/sw.js` + `manifest` + `tailwind.config.js` + `globals.css`; varredura em 4 blocos (8A responsividade/PWA · 8B estados/erros/sessão · 8C formulários/PDV/design system · 8D acessibilidade) por sub-agentes, com **conferência pessoal de 20 âncoras** pelo auditor (✅). Contrastes são **estimativas** por valores Tailwind padrão (sem ferramenta). Nenhum arquivo do produto foi modificado.

## Escopo e método

- Telas mapeadas: PDV (`caixa/caixa-page.tsx`, 3.088 l.), KDS (`kds/(auth)/screen`, 685 l.), pedidos/chat/cardápio/relatórios/estoque/entregas (dashboard), login, cardápio público (`menu-page.tsx`, 7.360 l.), tracking, motoboy (`delivery-page`, 781 l.), mesa autoatendimento, staff, landing/cadastro, admin-saas.
- Deduplicação contra **Fases 1/4/5/6/7** (coluna *Origem*: `Novo`/`Rep.`) e **dentro da fase** (unificados listados ao final).
- **Validação estática executada:** `bash auditoria/testes/8-01-frontend-ux-estatico.sh` → **40/40 CONFIRMADO, 0 a rever** (estático, seguro; rodar da raiz do projeto).

## Resumo

| Seção | Achados | C | A | M | B | Novos/Rep. | Nota |
|---|---|---|---|---|---|---|---|
| 8.1 Responsividade (tablet/celular/TV) | 10 | 1 | 1 | 6 | 2 | 8/2 | **2,0** |
| 8.2 Estados de carregamento/erro/vazio e confirmações | 17 | 2 | 4 | 6 | 5 | 10/7 | **1,5** |
| 8.3 Formulários: validação e envio duplicado | 9 | 0 | 6 | 1 | 2 | 7/2 | **1,5** |
| 8.4 PDV: atalhos, leitor, impressora | 7 | 0 | 1 | 4 | 2 | 6/1 | **2,0** |
| 8.5 Acessibilidade WCAG básico | 30 | 4 | 14 | 10 | 2 | 26/4 | **1,0** |
| 8.6 Consistência visual, design system, i18n | 8 | 0 | 0 | 5 | 3 | 6/2 | **2,0** |
| 8.7 PWA/offline e atualização de versão | 10 | 0 | 2 | 6 | 2 | 9/1 | **1,5** |
| 8.8 Erros de rede e sessão expirada | 7 | 0 | 3 | 2 | 2 | 2/5 | **1,5** |
| **Total (únicos)** | **98** | **7** | **31** | **40** | **20** | **74/24** | **1,5** |

- **Diagnóstico em uma frase:** o produto foi desenhado para um único device (desktop 1024+ / celular) e **ignora os três dispositivos-alvo reais** — tablet do balcão (PDV com carrinho fixo de 320px que espreme a grade), TV de cozinha (KDS com **zero breakpoints** e texto de 8–10px) e celular do motoboy (CTA de 32px) — enquanto acessibilidade, feedback de erro e proteção contra duplo clique são, na média, **ausentes ou mascarados como sucesso**.
- **Três eixos de risco:** (1) **re-entrância no PDV** — fechar mesa em dinheiro, abrir/fechar caixa, abater e ConfirmDialog compartilhado não têm `disabled`/flag, e a API `close-table` não é idempotente → duplo clique duplica pedido e movimento de caixa; (2) **falsos positivos** — toast de sucesso incondicional, relatórios que viram "R$ 0,00" quando a rede falha, e login que expulsa o usuário por qualquer 500; (3) **invisibilidade operacional** — zero `error.tsx`, zero indicador de offline, KDS que some em silêncio quando o token de 24h expira, e Service Worker que recarrega a TV/PDV sem aviso a cada bump de versão.

---

## 8.1 Responsividade: tablet no balcão, celular do motoboy, TV na cozinha

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8A-001** | **CRÍTICO** | Novo | **PDV: coluna do carrinho fixa em 320px sem quebra responsiva.** Corpo é `flex overflow-hidden` com produtos `flex-1` + carrinho `flex w-80`. Em celular (375px) restam ~55px para a grade de 4 colunas; em **tablet retrato (768–834px)** a grade `md:grid-cols-6` gera cards de ~60–72px com imagem `w-20` (80px) → **transborda sobre o card vizinho** (hit-test errado → produto errado no caixa). O CTA "FINALIZAR VENDA" fica dentro do painel e some junto. Contraste: a tela de mesa faz certo (`hidden lg:flex w-80` + drawer mobile). | `caixa/caixa-page.tsx:1366` (`flex w-80`) ✅, `:1340` (`grid-cols-4 sm:grid-cols-5 md:grid-cols-6`), `:1561-1590` (CTA), `:1103` (`h-screen overflow-hidden`); positivo: `[slug]/mesa/[number]/mesa-page.tsx:620,760,816` |
| **F8A-002** | **ALTO** | Rep. F5D-002 | **KDS não é de cozinha/TV: 0 breakpoints** (`sm:/md:/lg:` = 0 ✅) **+ 14× `text-[10px]`** + 1× `text-[8px]`; maior fonte é `text-lg` só no título. Em TV 1920px/55" a 2–3 m o texto de item/adicionais/timer é ilegível; `aside w-56` e `grid-cols-3` não se adaptam a 1366px nem 4K. Nenhuma string `tv`/`kitchen-mode`. | `kds/(auth)/screen/page.tsx:322,324` (`w-56`), `:408` (`grid-cols-3`), `:452-648` (`text-[10px]` ×14) ✅; grep breakpoints = 0 ✅ |
| **F8A-003** | MÉDIO | Rep. F5D-004 | **KDS em toque: alvos abaixo de 44px** — checkbox de item `w-4 h-4` (16px), botão de avançar `py-1.5 text-xs` (~30px), enviar chat `px-2 py-1.5` com ícone 12px. | `kds/screen/page.tsx:543-552,664-669,650-656` |
| **F8A-016** | MÉDIO | Novo | **CTA do motoboy é `size="sm"` → h-8 (32px)**, abaixo do mínimo de 44px para uso com uma mão/mãos sujas; handshake de entrega idem. | `[slug]/entregas/[token]/delivery-page.tsx:664,640-646`; `ui/button.tsx:28` |
| **F8A-012** | MÉDIO | Novo | **Tabelas sem scroll horizontal**: 4 em `overflow-hidden` (clipa colunas em tela estreita) e 1 só com `overflow-y` — gestão de zonas de entrega e backoffice SaaS. | `delivery-zones/page.tsx:478-479`; `admin-saas/{financeiro:33-34, respostas-rapidas:25-26, estabelecimentos:38-39}`; `cardapio/page-content.tsx:4149-4150` |
| **F8A-013** | MÉDIO | Novo | **63 ocorrências de `grid-cols-N` sem variante responsiva** (`sm:/md:/lg:` ausente): `grid-cols-2/3` de formulários espremidos a ~170px/110px em celular; `grid-cols-7` (dias) a ~47px/coluna. | `estoque/page-content.tsx:632,642,658,675,963,1043,1204`; `config/page-content.tsx:491,1377,1385,1416,1428,1466,2129`; `delivery-zones/page.tsx:248,307,420`; `caixa-gerencial/page-content.tsx:346,438,602` |
| **F8A-014** | MÉDIO | Novo | **Manifest trava orientação em retrato** (`"orientation": "portrait"`, global e por slug) para **todas** as telas — se a equipe instalar em tablet Android e abrir o PDV/KDS em paisagem, o SO trava em retrato. | `public/manifest.json:8`; `api/manifest/[slug]/route.ts:25` |
| **F8A-015** | MÉDIO | Novo | **PDV usa `h-screen` + `overflow-hidden` sem `env(safe-area-inset-*)`** (0 no arquivo) enquanto o layout declara `viewportFit: "cover"`: em PWA standalone iOS a home-indicator cobre o rodapé do carrinho; em Safari com barra, `100vh` esconde o final. Só o cardápio público trata safe-area. | `caixa-page.tsx:1103` + grep `safe-area` = 0; `layout.tsx:33`; positivo: `menu-page.tsx:2917,3387,5304` |
| **F8A-017** | BAIXO | Novo | Cardápio público em tela grande vira coluna de 768px (`max-w-3xl`, grade fixa `grid-cols-2`), bottom-nav fixa visível também em desktop/TV. | `menu-page.tsx:3303,3340,3315,3380-3384` |
| **F8A-021** | BAIXO | Novo | Tabs do PDV sem `whitespace-nowrap`: abaixo de ~400px o rótulo quebra em 2 linhas e a barra cresce (container fixo, sem scroll). | `caixa-page.tsx:1193-1265` |

**Pontos positivos:** mesa autoatendimento é a tela mais responsiva da base (28 breakpoints); shell do dashboard, chat, cardápio admin e tracking são responsivos com `hidden lg:`/`md:` adequados; landing usa 61 breakpoints.

---

## 8.2 Estados de carregamento, erro e vazio; confirmação antes de ações destrutivas

### Matriz tela × {loading, erro, vazio}

| Tela | Loading | Erro | Vazio | Observação |
|---|---|---|---|---|
| PDV `/caixa` | ✅ | ⚠️ carga inicial = spinner infinito | ✅ | 3 no papel, 1 na prática |
| KDS `/kds/screen` | ✅ | ❌ tudo `console.error` | ✅ | 2/3 |
| Pedidos | ✅ | ❌ spinner infinito ou crash | ✅ | 2/3 |
| Chat | ✅ | ❌ console only | ✅ | erro mascarado como vazio |
| Cardápio admin | ✅ | ❌ spinner infinito | ✅ | 2/3 |
| Relatórios | ✅ | ❌ catch silencioso → **"R$ 0,00"** | ✅ | **erro vira dado falso** |
| Dashboard home | ✅ | ✅ retry + botão | ✅ | **3/3 — referência** |
| Caixa fechamento | ✅ | ❌ | ⚠️ seções somem | 1,5/3 |
| Login | ✅ | ✅ | n/a | 2/2 |
| Cardápio público | ✅ SSR | ⚠️ sub-fetches mudos | ✅ | 2,5/3 |
| Tracking | ⚠️ SSR | ❌ falham mudos | n/a | 0,5/2 |
| Estoque | ✅ | ❌ spinner infinito | ✅ | 2/3 |
| Entregas (dashboard) | ✅ | ❌ spinner infinito | ✅ | 2/3 |
| Mesa | ✅ | ⚠️ catch → loading false sem aviso | ✅ | 2/3 |
| Motoboy | ✅ | ✅ | ✅ | **3/3** |
| Staff | ✅ | ⚠️ catch silencioso | ✅ | 2/3 |

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8B-001** | **CRÍTICO** | Rep. F4C-002 | **Fetch inicial sem `try/catch` → spinner infinito quando a rede cai** em PDV, Pedidos, Cardápio admin, Estoque, Entregas e Caixa (dashboard): `setLoading(false)` inalcançável na rejeição; sem mensagem e sem retry. | `caixa-page.tsx:386-397` (`Promise.all` sem try) ✅ + `:470`; `pedidos/page-content.tsx:112-115,127-128`; `cardapio:375-382,425`; `estoque:121-139`; `entregas:150-158`; `caixa/page-content.tsx:22-35` |
| **F8B-002** | **ALTO** | Novo | **Pedidos: resposta não-array derruba a renderização** — `setOrders(data)` aceita `{error}` (500); `orders.filter/map` lançam `TypeError` → branco total. Zero `Array.isArray` no arquivo ✅. | `pedidos/page-content.tsx:112-114` ✅, `:185`, `:547` |
| **F8B-003** | **ALTO** | Rep. F4A-025 | **Zero `error.tsx` e zero `not-found.tsx` em todo o App Router** — qualquer throw cai na página genérica do Next sem retry nem identidade. `notFound()` é chamado em `[slug]` e `pedido/[id]` mas nunca tem UI própria. | glob = 0 ✅; `[slug]/page.tsx:76-78`; `pedido/[id]/page.tsx:79-94` |
| **F8B-004** | **ALTO** | Novo | **Relatórios: falha de rede vira "R$ 0,00 de faturamento"** — `catch(() => setLoading(false))` descarta o erro; a tela renderiza zeros idênticos a "sem vendas". Financeiro decide com dado errado. | `relatorios/page-content.tsx:28-42` |
| **F8B-005** | **ALTO** | Novo | **Dashboard layout: qualquer falha de rede/500 expulsa o usuário para `/login`** — `.catch(() => router.replace("/login"))` trata igualmente token inválido, 500, offline e `{error}`. Perder conexão 5 s = deslogado do painel inteiro. | `dashboard/(auth)/layout.tsx:89-93,106` ✅ |
| **F8B-012** | MÉDIO | Rep. F4A-007 | **Toast de sucesso incondicional em operações destrutivas (padrão sistêmico)** — deletes e PATCH de status disparam `toast("...sucesso")` sem `res.ok`: falha vira "sucesso" e o item some só da UI local. | `estoque:169-178,299-300,1255-1258`; `cupons:114-117`; `usuarios:211-213`; `cardapio:617-621`; `entregas:187-196`; `pedidos:153-156`; `caixa-page:2761-2768,2984-2991` |
| **F8B-010** | MÉDIO | Novo | **"Fechar Caixa" do PDV: sem etapa de confirmação e sem `res.ok`** (contagem = 0 ✅) — em falha ainda exibe "Caixa fechado com sucesso" e zera `cashRegister`. `transferCashRegister` tem `ConfirmDialog` mas toast+logout incondicionais. | `caixa-page.tsx:1023-1046` ✅, `:1983-1988`, `:1048-1080` |
| **F8B-011** | MÉDIO | Rep. F5A-033 | **"Transferir Mesa" executa no clique do destino, sem confirmação, com `catch {}` que engole o erro** e toast de sucesso em sequência incondicional. | `caixa-page.tsx:2650-2675` ✅ (catch vazio + toast) |
| **F8B-013** | MÉDIO | Novo | **Chat: erro de carga indistinguível de "conversas vazias"** — catch só `console.error`; a UI mostra "Nenhuma conversa encontrada". | `chat/page-content.tsx:160-163,344-348` |
| **F8B-014** | MÉDIO | Novo | **Tracking público: mensagem do cliente descartada em silêncio** — `sendMessage` não trata `!res.ok` nem `catch` com feedback; o input é limpo só em sucesso mas o usuário vê o spinner parar e a mensagem não aparecer. | `pedido/[id]/tracking-page.tsx:194-211,107-171` |
| **F8B-015** | MÉDIO | Novo | **`orders-screen` (pedidos do cliente): cancelamento falha sem feedback** e sem checar status HTTP; o modal fecha mesmo em 4xx/5xx. | `components/orders-screen.tsx:774-795` |
| **F8B-017** | BAIXO | Rep. F8C-010 | `alert()` nativo misturado com toast em fluxos críticos do PDV, cardápio, planos e config — bloqueante em tablet de caixa. | `caixa-page:854,874`; `pedidos:938-955`; `config:305-361`; `planos:102-116` |
| **F8B-018** | BAIXO | Novo | KDS layout renderiza `null` enquanto checa autorização → flash de tela branca antes do redirect. | `kds/(auth)/layout.tsx:50,46` |
| **F8B-019** | BAIXO | Novo | Despesas: delete falho não gera mensagem (sem `else` após `res.ok`). | `financeiro/despesas/page-content.tsx:283-288` |
| **F8B-022** | BAIXO | Rep. F4C-002 | Caixa (dashboard): sem estado de erro; em falha parcial mostra "R$ 0,00"; seções somem quando vazias. | `caixa/page-content.tsx:22-38,120,146` |
| **F8B-023** | BAIXO | Novo | Cardápio público: sub-fetches de endereços/avaliações/curtidas falham com `catch {}` — listas vazias sem aviso. O fluxo de pedido trata bem (`setOrderError`). | `menu-page.tsx:1213-1217,852-884` vs `:2068-2071,2160-2162` |

### Confirmações destrutivas — inventário

**COM confirmação (20 ações):** fechar mesa (sidebar), transferir caixa, venda com pagamento pendente, cancelar pedido (dashboard/entregas/cliente), excluir produto/categoria, excluir item/família/categoria/fornecedor do estoque, excluir despesa/usuário/cupom/banner/story/zona, desconectar WhatsApp (2×), trocar pagamento online→entrega, excluir endereço, excluir template admin.

**SEM confirmação:**

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8C-001** | **CRÍTICO** | Rep. F3C-019 | **Fechamento de mesa (dinheiro/modo único) sem guarda de re-entrância + API não-idempotente** → duplo clique duplica pedido E movimentação de caixa. O rodapé do modal chama `handleCloseTable()` direto; o `disabled` só cobre o modo split ✅; `close-table` faz `prisma.order.create` incondicional a cada POST. | `caixa-page.tsx:2480-2514` ✅, `:569-570`; `api/cash-register/close-table/route.ts:23-37,102-110` |
| **F8B-010** | (8.2) | — | *fechar caixa — ver acima* | — |
| **F8B-011** | (8.2) | — | *transferir mesa — ver acima* | — |

---

## 8.3 Formulários: validação, mensagens, prevenção de envio duplicado

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8C-002** | **ALTO** | Novo | **Cadastro de produto: Salvar/Adicionar sem `disabled={saving}` e sem validação de nome/preço** → duplo clique cria 2 produtos; guarda só `!categoryId`; erros via `alert()` genérico. | `cardapio/page-content.tsx:4047-4049` (sem disabled), `:629,681,713,720` |
| **F8C-003** | **ALTO** | Rep. F8B-010 | **Modal Abrir/Fechar Caixa do PDV: botões sem `disabled` durante submit** ✅ (nenhum `disabled` nas linhas 1961-1987) — duplo clique = 2 POSTs (2 registros de caixa/fechamento). | `caixa-page.tsx:1961-1963,1985-1987` ✅, `:994-1046` |
| **F8C-004** | **ALTO** | Novo | **Abatimento parcial sem trava de re-entrância**: `processAbater` sem estado de submitting; duplo clique = 2 partial-payments + 2 movimentos de caixa. | `caixa-page.tsx:672-716,2588-2594` |
| **F8C-005** | **ALTO** | Novo | **`ConfirmDialog` compartilhado sem proteção de duplo clique**: botão "Confirmar" nunca desabilitado; `onConfirm` dispara N vezes antes do re-render. Afeta: excluir cupom, baixar despesa, fechar mesa, transferir caixa, excluir produto. | `components/confirm-dialog.tsx:88-94`; usos em `cupons:267-275`, `despesas:540-541`, `caixa-page:2496-2504` |
| **F8C-006** | **ALTO** | Novo | **"Pagar e Entregar" (Pedidos Externos) sem guarda**: `handlePayOrder` sem loading; duplo clique = 2 PATCH. | `caixa-page.tsx:2961-2963,2771-2780` |
| **F8C-007** | **ALTO** | Rep. F7A-001 | **OTP exibido na tela quando o WhatsApp falha** ("⚠ WhatsApp não entregou — código visível" + botão "Usar este código") ✅ — derrota a finalidade da verificação de telefone no frontend do cliente. | `menu-page.tsx:3642-3653` ✅ |
| **F8C-011** | MÉDIO | Novo | **Cupom: sem validação de faixa** — percent > 100, valor negativo ou zero passam no client (`"0"` escapa de `!form.value`); criação de cupom de 150% só falharia (se) no server. | `cupons/page-content.tsx:64-98,175-181` |
| **F8C-020** | BAIXO | Novo | **`noValidate` nunca usado** — depende da validação HTML5 nativa (balões não-estilizados) + JS paralelo, criando dois sistemas de mensagem. | grep = 0 ✅; `login:213,226`; `cadastro:139,155,210` |
| **F8C-024** | BAIXO | Novo | Teclado virtual incompleto: `inputMode` em alguns campos (OTP, telefone, despesas) mas **ausente nos inputs de dinheiro do PDV**; zero `enterKeyHint` no codebase. | `menu-page:3675`; `cadastro:134,239`; ausentes em `caixa-page:1531-1538,1952-1982` |

**Pontos positivos:** login, cadastro, despesas, OTP e CEP (ViaCEP) têm mensagens específicas, `disabled` com loading e máscaras corretas; fluxo "FINALIZAR VENDA" principal tem `disabled={closing || ...}` + `ConfirmDialog`.

---

## 8.4 PDV: atalhos de teclado, tempo de lançamento, leitor e impressora

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8C-019** | MÉDIO | Novo | **Sem leitor de código de barras dedicado**: zero `scanner`/`barcode`/`onScan`/timing de keyup; schema sem campo `barcode`; busca só manual. Leitor USB em modo teclado funciona por acaso na busca, sem confirmação automática por Enter/silêncio. | grep = 0 ✅; busca: `caixa-page.tsx:1276-1283` |
| **F8C-016** | MÉDIO | Rep. F4C-015 | **Impressão: falha silenciosa** — `window.open` bloqueado retorna sem aviso (`if (!win) return`), `win.print()` sem esperar `onload`; sem estado "Imprimindo..." nem retry. Positivo: checkbox "Gerar cupom" persistido em localStorage (opção de não imprimir existe). | `caixa-page.tsx:946-992` ✅, `:84-89,1480-1494` |
| **F8C-008** | **ALTO** | Novo | **HTML do cupom montado por interpolação sem escape** em `document.write` (`printReceiptPopup`): nome de produto/cliente com HTML **injeta script no popup de impressão** (XSS no fluxo da impressora). | `caixa-page.tsx:951-987` ✅ (`${item.name}`, `${order.establishmentName}` sem sanitização) |
| **F8C-012** | MÉDIO | Novo | **KDS calcula tempo/atraso com relógio do cliente**: `Date.now()` do navegador comparado a `createdAt` do servidor — tablet com relógio desalinhado mostra "overdue" falso/oculta atraso real; ordenação e média afetadas. | `kds/screen/page.tsx:260,295-298,310,432` |
| **F8C-027** | MÉDIO | Novo | **Datas sem fuso explícito**: todo o front usa `toLocaleString("pt-BR")` no fuso do cliente; filtro "vendas de hoje" do PDV usa `toDateString()` local — relógio desalinhado exclui pedidos das 23h5X ou duplica a contagem. | `caixa-page.tsx:369-372,421-425,306-318`; `kds/screen:495`; grep `timeZone:` = 0 |
| **F8C-023** | BAIXO | Novo | **Atalhos existem mas são indocumentados e sequestram F-keys**: F1–F5 + Ctrl+1–9 implementados com guarda de input (bom), mas só F2 aparece na UI; **F5 (recarregar) é sobrescrito** sem aviso; nenhum atalho de Enter para finalizar venda. | `caixa-page.tsx:183-289` (F1 `:200`, F5 `:230` com `preventDefault`); doc UI só `:1279` |
| **F8C-025** | BAIXO | Novo | **Fluxo de lançamento**: balcão = 3 cliques (produto → FINALIZAR VENDA → Confirmar); mesa = 4 cliques; fechar conta = 3–4. Sem atalho de Enter. Guards do fluxo principal estão corretos (`disabled={closing}`). | `caixa-page.tsx:1561-1590,762-791,1837-1848` |

---

## 8.5 Acessibilidade (WCAG básico): contraste, foco, rótulos, teclado

### Métricas globais

| Métrica | Valor |
|---|---|
| `aria-label` | **9** (todo o src) |
| `aria-describedby` / `aria-live` / `aria-hidden` / `aria-expanded` / `aria-current` / `aria-controls` | **0** |
| `role="..."` | **0** |
| `focus-visible` | **0** |
| `focus:outline-none` sem substituição (ring/border/shadow) | **16** ✅ (de 242) |
| `tabIndex` | **0** |
| `<div onClick>` | **26** · `role="button"`: 0 |
| `<input>` / `<label>` / `htmlFor` | 335 / 321 / **13** ✅ |
| Overlays `fixed inset-0` (modais) | **76** · com Escape: 8 |
| `<img>` com `alt` | **44/44** ✓ |
| `<main>` / `<nav>` / `<header>` | **3** / 4 / 3 (64 rotas) ✅ |
| Skip link | **0** |
| `export const metadata` | **4** (64 rotas) |
| `<th>` / `scope=` / `caption` | 69 / **0** / **0** |
| `prefers-reduced-motion` | 0 |

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8D-001** | **CRÍTICO** | Novo | **Card de produto do cardápio digital é `<div onClick>`** sem `role`/`tabIndex`/`onKeyDown` ✅ — abrir o detalhe do produto (passo central da compra) é impossível por teclado/leitor de tela. | `[slug]/menu-page.tsx:7269-7274` ✅ |
| **F8D-002** | **CRÍTICO** | Novo | **PDV: card de mesa é `<div onClick>`** ✅ — `selectTable(num)` só por mouse/touch. Botões filhos (QR, Transferir, Conta) são `<button>` aninhados dentro do div clicável. | `caixa-page.tsx:1629-1642` ✅ |
| **F8D-003** | **CRÍTICO** | Rep. F6A-001 | **Zoom bloqueado globalmente**: `maximumScale: 1` + `userScalable: false` ✅ — usuário de baixa visão não pode ampliar nenhuma tela (WCAG 1.4.4), aplicado a todas as rotas via root layout. | `layout.tsx:30-32` ✅ |
| **F8A-011** | — | — | *unificado em F8D-003* | — |
| **F8D-004** | **CRÍTICO** | Novo | **76 modais sem semântica de diálogo**: `role=`, `role="dialog"`, `aria-modal` = **0** ✅ em todo `src`. Leitores de tela não anunciam abertura nem delimitam conteúdo; `aria-describedby` = 0. | grep = 0 ✅; overlays em `caixa-page:1869,2603,2633,2709`, `confirm-dialog:52,67`, `menu-page:5728,5790,7002` |
| **F8D-005** | **ALTO** | Novo | **Cardápio (fluxo principal do cliente): zero fechamento por teclado** — 7.360 linhas com **0 `Escape`** e apenas 2 `onKeyDown` (OTP, chat). Bottom sheet de produto, carrinho, endereço, cupom, PIX e avaliação não fecham com Esc nem têm focus trap. | `menu-page.tsx` (grep Escape = 0); overlays em `:5728,5790,5881,6324,7002` |
| **F8D-006** | **ALTO** | Novo | **~50 botões somente-ícone sem `aria-label`** (9 no total para centenas de botões): mostrar/ocultar senha no login, fechar modais do PDV, fechar toasts, sair, abrir menu. | `login:229-235` (Eye/EyeOff); `toast.tsx:77-82`; `caixa-page:1873,1943,2534,2607,2640`; `dashboard/layout:208,211,377,393`; `menu-page:7014,7131` |
| **F8D-007** | **ALTO** | Novo | **Rótulos não programaticamente associados**: 321 `<label>` mas só **13 `htmlFor`** ✅ para 335 `<input>`; **nenhum `<input>` tem `aria-label`**. Login (4 inputs/0 htmlFor), config (77/0), cardápio (42/0), caixa (10/0). | `login:207,219,288,309`; `config` (0 htmlFor); `caixa-page:1527` |
| **F8D-008** | **ALTO** | Novo | **Componente `ui/Input` (o único acessível) nunca recebe `id`** → `htmlFor={undefined}`/`id={undefined}`: mesmo nos 3 formulários que usam o componente o rótulo não é associado. | `ui/input.tsx:14,20`; chamadas sem `id` em `esqueci-senha:88-94`, `redefinir-senha:143,161`, `trocar-senha:107-134` |
| **F8D-009** | **ALTO** | Novo | **Campos com rótulo apenas por `placeholder`** (some ao digitar, nunca anunciado como rótulo persistente): item avulso do PDV, cupom, observações, cartão de crédito, busca do cardápio. | `caixa-page:1876,1884`; `menu-page:4858,5069,7162-7224,3278` |
| **F8D-010** | **ALTO** | Novo | **Sem mecanismo de bypass (2.4.1)**: **0 skip links**; `<main>` em apenas **3 de 64 rotas** ✅. Cardápio do cliente, PDV, tracking e login não têm `<main>`/`<nav>`/`<header>`. | grep skip = 0; `<main>` só em `dashboard/layout:404`, `admin-saas/layout:72`, `kds/screen:407` ✅ |
| **F8D-011** | **ALTO** | Novo | **Estado de navegação não exposto**: `aria-expanded`/`aria-controls`/`aria-current` = 0. Submenus colapsáveis do sidebar sem `aria-expanded`; item ativo comunicado só por estilo. | `dashboard/layout:264-276,297-335,221-235`; `globals.css:73-81` |
| **F8D-012** | **ALTO** | Novo | **Títulos de página não distinguem rotas**: só **4 de 64** rotas definem `metadata`; `/kds`, `/caixa`, `/dashboard/*`, `/login`, `/pedido/*` herdam todos `title: "FlowOS - Cardápio Digital"` (WCAG 2.4.2). | `layout.tsx:9-10`; só `politica-de-privacidade`, `[slug]/layout`, `[slug]/page` têm metadata |
| **F8D-013** | **ALTO** | Novo | **Badge `.badge-fire` não existe em nenhum CSS** (grep em `globals.css` = 0 ✅) — o span usa `text-white` **sem fundo** → em tema claro (card `#f9fafb`) o texto é branco sobre branco (~1:1) e some. Afeta "🔥 Mais Pedido", "🆕 Novo" e "% OFF". | `menu-page.tsx:5915,7290,7295,7300` ✅ |
| **F8D-014** | **ALTO** | Novo | **Texto branco sobre cores claras (≈1,7–2,2:1)**: `bg-yellow-400` (~1,7:1), `bg-amber-500` (~2,2:1), `bg-green-500` (~2,1:1) com `text-white` em fontes de 9–10px — selos operacionais "Atenção", badges de status. | `dashboard/layout:234,274`; `caixa-page:1238`; `cardapio:2456`; `menu-page:7305`; `config:2977` |
| **F8D-015** | **ALTO** | Novo | **Contraste no cardápio do cliente**: `theme.textMutedMore` = alpha **0,40** (~2,4:1 sobre claro; necessário 4,5:1) usado em nomes de categoria (navegação), preços riscados, horários — 58 usos; versão dark alpha 0,30 (~2,9:1). | `menu-page.tsx:199,228,3314,3163,3250,3741-4068` |
| **F8D-016** | **ALTO** | Novo | **`focus:outline-none` sem substituição em 16 elementos** ✅ (busca, endereço, quantidade, observação do cardápio + searchable-select). **`focus-visible` = 0** no app inteiro. | `menu-page.tsx:3278,3580-6496` (16 linhas); `searchable-select.tsx:82` |
| **F8D-017** | **ALTO** | Novo | **Sem gestão de foco em modais**: nenhum `useEffect` move o foco para a janela aberta nem o devolve ao gatilho; sem focus trap; fundo continua tabulável (`tabIndex` = 0 no projeto). Único `autoFocus` é o primeiro campo, que fura o fundo. | `confirm-dialog:41-46` (só Escape); `caixa-page:1877`; grep `.focus()` em modal = 0 |
| **F8D-018** | **ALTO** | Novo | **Escape fecha só 8 pontos de 76 overlays** — PDV cobre 3 modais; não cobre `tableQRModal`, `transferModal`, `staffQr`, `abaterModal`; cardápio do cliente: 0. | `caixa-page:188-194`; `confirm-dialog:36`; overlays sem handler: `caixa-page:2603,2633,2709` |
| **F8D-019** | MÉDIO | Novo | **`text-zinc-400` (~3,0:1 sobre branco; exige 4,5:1) — 573 ocorrências**, incluindo estado vazio do tracking, mensagens do entregador e metadados de pedido (motoboy/celular ao sol). | `tracking-page:313,441,458`; `delivery-page:306,425,451,546,577`; `caixa-page:1793,1799,1805` |
| **F8D-020** | MÉDIO | Novo | **Texto branco com opacidade abaixo de 4,5:1**: `text-white/30` ~2,7:1, `/40` ~3,8:1, `/25` ~2,1:1 — 18 usos de `/25–/30` e 43 de `/40` em fontes de 9–13px (landing, PDV dark, rodapé do dashboard). | `dashboard/layout:362,416,426`; `caixa-page:1538,2148,1787-1799`; `page.tsx:144-404` |
| **F8D-021** | MÉDIO | Rep. F8A-002 | **KDS: `text-zinc-500` sobre `#1a1a1a` (~3,6:1)** + 17 elementos com `text-[8-10px]` — leitura difícil a distância. Positivo: status tem rótulo textual + ícone (não é só cor). | `kds/screen:454,559,563,596-599,452` |
| **F8D-022** | MÉDIO | Novo | **Hierarquia de headings quebrada**: 10 telas do dashboard sem `<h1>` (começam em h2); 13 arquivos com salto h1→h3; cardápio do cliente tem **2 `<h1>`**; PDV gerencial tem 2. | sem h1: `dashboard/{home,config,cardapio,chat,entregas,fidelidade,relatorios,usuarios,caixa,caixa-gerencial}`; `menu-page:2929,2934` |
| **F8D-023** | MÉDIO | Novo | **69 `<th>` sem `scope`**, sem `<caption>`, sem `<thead>` garantido em 13 tabelas — cabeçalhos não vinculados às células (1.3.1). | `caixa-page:977`; `pedidos:772`; `despesas:380`; `admin-saas/estabelecimentos:39` |
| **F8D-024** | MÉDIO | Rep. F8A-003 | **Alvos de clique abaixo de 24px (WCAG 2.5.8)**: X de fechar modal com ícone 16–20px sem padding; favoritar `h-4 w-4`; QR da mesa ~20px; toast `p-0.5` + `h-3 w-3`. | `caixa-page:1873,1943,2607,2640,1647`; `menu-page:7327-7334`; `toast.tsx:79-81` |
| **F8D-025** | MÉDIO | Novo | **Login sem `autoComplete`** (1.3.5 — AA): e-mail e senha não identificam o propósito; autofill não funciona. Só cadastro (6) e OTP (1) usam. | `login:208-228` |
| **F8D-026** | MÉDIO | Rep. F8C-013 | **Dois sistemas de tema dark incompatíveis**: Tailwind `dark:` (93 classes) opera por **`media`** (config sem `darkMode`), enquanto PDV/mesa/cardápio usam **estado JS** em localStorage — usuário alterna tema no PDV mas SO claro → `dark:` não aplicam e cards misturam `bg-red-50`/`bg-green-50` (claro) sobre fundo `#0d2137` (escuro). | `tailwind.config.js` (sem `darkMode`); `caixa-page:114,151,1171,1633-1671` |
| **F8D-027** | MÉDIO | Novo | **Mensagens de status sem região viva**: `ToastProvider` sem `role="status"`/`aria-live` (4.1.3); erros de formulário idem. 0 `aria-live` no projeto. | `toast.tsx:64-86`; `login:245-249,320-324`; `kds/page:77-79` |
| **F8D-028** | MÉDIO | Novo | **Grupos de controles sem `<fieldset>/<legend>`** (0 no projeto): forma de pagamento, método de cobrança, parcelas — grupos de rádio sem nome acessível. | `caixa-page:1503-1517,2085-2160`; `mesa-page:430-443,511-522` |
| **F8D-029** | BAIXO | Novo | Ícones SVG decorativos sem `aria-hidden`/`focusable="false"` (0 `aria-hidden` no app; 22 `<svg>` inline + lucide). | `menu-page:7283`; `caixa-page:1329` |
| **F8D-030** | BAIXO | Novo | Sem `prefers-reduced-motion`: animações contínuas (`animate-pulse`, `glow-pulse`, `shimmer`, `ken-burns`) não desativadas. | `globals.css:109-188`; `dashboard/layout:232`; `caixa-page:1238` |

### Evidências positivas verificadas

- `<html lang="pt-BR">` correto (`layout.tsx:42`).
- **44/44 `<img>` com `alt`** (10 `alt=""` decorativos corretos).
- KDS usa `<button>` para todas as ações (0 `<div onClick>` em `kds/screen`).
- Status do KDS não depende só de cor (rótulo textual + ícone + tempo).
- OTP com `aria-label` por dígito e `autoComplete="one-time-code"`.
- Botões "adicionar" e "favoritar" do cardápio **têm** `aria-label`.
- `cadastro` usa `htmlFor` + `id` + `autoComplete` corretamente.
- 219 de 240 `focus:outline-none` têm `ring`/`border` de substituição.
- Sidebar e bottom-nav usam `<Link>`/`<button>` (tabuláveis por padrão).
- Tabelas usam `<table>` semântico (13), não divs.

---

## 8.6 Consistência visual (design system), i18n, moeda e data em pt-BR

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8C-013** | MÉDIO | Rep. F6A-003 | **Sem design system adotado no PDV**: `caixa-page` importa `Button` mas usa **0** `<Button>` — **69 `<button>` raw** com styling inline, 215 ternários `darkMode ?` e 69 cores hex hardcoded no mesmo arquivo. Tokens `flow.*` do Tailwind são ignorados (usa zinc/green + `#0d2137`, `#1a3a5c`...). | `caixa-page.tsx` (contagens via grep); `tailwind.config.js:6-17` |
| **F8C-014** | MÉDIO | Novo | **Design system parcial — `Input` quase inexistente**: `ui/input.tsx` (com `label`/`error` prontos) importado em apenas **4 arquivos**; telas grandes copiam a mesma className de input ~30×, multiplicando divergência. | grep 4 imports; `despesas:441-445`; `financeiro/caixa:217-222,282-310` |
| **F8C-015** | MÉDIO | Novo | **Tema claro quebrado no PDV — texto branco sobre fundo branco**: dezenas de fallbacks `darkMode ? "text-white/40" : "text-white/50"` (dois tons de branco) e `text-white/40` fixo no modal de recibo (fundo `bg-white`) deixam textos invisíveis no modo claro. | `caixa-page.tsx:1357,1413-1444,1509,1535,1910,2825-3065,2712` |
| **F8C-017** | MÉDIO | Novo | **Moeda: helper único existe mas é contornado** — `formatCurrency` (Intl pt-BR/BRL) usado na maioria, mas há formatação manual `R$ ${v.toFixed(2).replace(".", ",")}` e `toLocaleString` próprio no cupom, cashback, quota, admin-saas e badges (`R$${coupon.value}`) — risco de divergência (`R$ 10` vs `R$ 10,00`). | `lib/utils.ts:8-15`; manual: `caixa-page:947`, `order-confirmation-screen:83,236-242`, `meta-quota-card:108`, `cupons:235,242`, `geolocation-button:112-114`, `admin-saas/{dashboard:88,145, estabelecimentos:87}` |
| **F8C-018** | MÉDIO | Novo | **Duas telas de abertura/fechamento de caixa divergentes** (modal do PDV vs `dashboard/financeiro/caixa`) com UX, campos e botões diferentes para a mesma operação. | `caixa-page.tsx:1935-2013` vs `financeiro/caixa/page-content.tsx:208-299` |
| **F8C-021** | BAIXO | Novo | **i18n inexistente e um texto em inglês visível**: zero libs (`next-intl`/`i18next` = 0); texto hardcoded pt-BR ok para escopo atual, mas **"+{valor} Cash"** aparece em inglês no cardápio. Status keys internas em inglês são mapeados corretamente. | grep i18n = 0; `orders-screen.tsx:616` |
| **F8C-022** | BAIXO | Novo | **Nomes de botões inconsistentes**: "Salvar" vs "Salvar alterações" vs "Salvar e conectar" vs "Salvar configurações"; "Criar" vs "Adicionar" vs "Registrar" vs "Confirmar" para submits equivalentes. | `config:3162`, `fidelidade:455`, `despesas:487`, `estoque:1139`, `financeiro/caixa:324`, `admin-saas/pagamentos:274` |
| **F8C-026** | BAIXO | Rep. F6A-005 | **Ícones: lucide-react consistente (52 arquivos)** ✓, mas emojis funcionam como ícone em fluxos reais do PDV/cardápio (🍕 produto sem foto, 👨‍🍳 auto-preparo, 💳/➗/👥 modos de cobrança), quebrando a linguagem visual. | `caixa-page.tsx:1350,1474,2081-2083` |

---

## 8.7 PWA/offline e atualização de versão sem quebrar telas abertas

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8A-004** | **ALTO** | Rep. F4C-035 | **Atualização de versão recarrega TODAS as janelas abertas, sem aviso e sem adiamento**: `skipWaiting()` no install +, no activate com cache antigo, `client.navigate(client.url)` em toda janela ✅. A cada bump do `CACHE_NAME` (Chrome: navegação + 24h): reload inesperado em tablets/TV que ficam horas abertas. **Estado perdido:** `completedItems` do KDS é só React local, modais abertos, filtros, rascunho de chat; `navigate()` aborta `fetch` em andamento (ex.: `POST /api/orders` do caixa). Carrinho/mesas do caixa sobrevivem (localStorage). | `public/sw.js:51,54-76` ✅; perda: `kds/screen:76,151-156`; sobrevive: `caixa-page:291-300` |
| **F8A-005** | **ALTO** | Novo | **Clique na notificação empurra a PRIMEIRA janela aberta para a URL do pedido**, sem checar qual tela é — `clients.find(c => c.url.includes(origin))` pega a aba 1 (pode ser `/caixa`, `/kds/screen` ou dashboard) → `target.navigate(url)` **substitui a tela operacional pelo tracking do cliente**. | `public/sw.js:223-240` ✅ (`clients.find` + `target.navigate`) |
| **F8A-008** | MÉDIO | Novo | **A "versão" é um número hardcoded que alguém precisa lembrar de bumpar** (`CACHE_NAME = "pedefacil-v25"`; bumps manuais no git, v24→v25 não commitado). Esquecer o bump: cache antigo não é purgado **e** clientes não recarregam → abas abertas rodam JS antigo contra API nova. | `public/sw.js:1`; `git log/diff -- public/sw.js` |
| **F8A-009** | MÉDIO | Novo | **Nenhum mecanismo de detecção/banner de atualização no app** — o registrador só chama `register()`; sem `updatefound`, `controllerchange`, "nova versão disponível" nem reload guiado. Tudo é hard-reload do SW. | `components/pwa/service-worker-register.tsx:6-25`; grep `updatefound\·controllerchange\·reg.update` = 0 |
| **F8A-006** | MÉDIO | Novo | **Offline não tem shell**: `PRECACHE_URLS` só manifest + ícones + favicon; **não existe `public/offline.html`**. Fallback de navegação é `caches.match` (só páginas já visitadas); `/_next/*` sempre `fetch` sem cache — primeira visita offline = erro do browser. | `public/sw.js:37-45,82-103`; `ls public/` (sem offline.html) |
| **F8A-007** | MÉDIO | Novo | **Imagens (inclusive fotos de produtos em CDN) são cache-first sem revalidation** → ficam eternamente velhas até bump manual; sem `cache.delete` por item nem expiry. | `public/sw.js:106-121,60-63` |
| **F8A-010** | MÉDIO | Novo | **localStorage sem versionamento de schema** — Caixa: `pedefacil-tables-<estId>` guarda `{tableData, activeCart, stagingCart}` sem versão; Menu: carrinho salvo é lido como array — **se o formato antigo não for array, `parsed.length > 0` é false e o efeito regrava `[]`, apagando o carrinho silenciosamente**; KDS: tokens sem migração. Grep `APP_VERSION`/`schemaVersion` = 0. | `caixa-page:86,94,116,151-176,294-303`; `menu-page:244-255,379`; `kds/screen:54-160` |
| **F8A-019** | MÉDIO | Novo | **`start_url: "."` do manifest global resolve para `/`** — quem instalar a partir de `/caixa`, `/kds` ou `/dashboard` ganha ícone que abre a **landing de marketing**; a tela de login não tem redirect automático para sessão existente → operador digita credencial de novo a cada abertura. (Cardápio público: manifest por slug com `start_url=/slug` ✓.) | `public/manifest.json:5`; `layout.tsx:12`; `page.tsx:85`; `login:26-90`; positivo: `api/manifest/[slug]/route.ts:22-23` |
| **F8A-018** | BAIXO | Novo | Classes de safe-area órfãs: `.safe-top`/`.safe-bottom` declaradas no CSS mas usadas em **nenhum** componente. | `globals.css:5-8`; grep em `*.tsx` = 0 |
| **F8A-020** | BAIXO | Novo | Ícones do PWA: `purpose: "maskable"` reaproveita o mesmo PNG 512 (sem zona segura própria) e o `apple` icon aponta para 192px (padrão iOS é 180×180; sem `apple-touch-icon` dedicado). | `public/manifest.json:15`; `layout.tsx:19-22`; `ls public/icons` (sem icon-180.png) |

**Pontos positivos:** `/api/` e `/_next/` **nunca cacheados**; precache íntegro (7 arquivos existem); manifest por slug com `start_url`/`scope` corretos; caixa persiste carrinho/mesas em localStorage (sobrevive a reload).

---

## 8.8 Tratamento de erros de rede e sessão expirada

| ID | Sev | Origem | Achado | Evidência |
|---|---|---|---|---|
| **F8B-006** | **ALTO** | Rep. F4C-004 | **Sem nenhum indicador de conectividade**: `navigator.onLine`, listener de `offline`/`online` e banner "sem conexão" = **0 ocorrências** ✅ — usuário do PDV/KDS não tem como saber que está offline. | grep = 0 ✅ |
| **F8B-007** | **ALTO** | Rep. F4C-012 | **KDS: expiração do token (24h) silencia a tela por completo** — `kds-login` emite só access token sem refresh ✅; a screen usa `fetch` cru e **não checa `res.ok`**. Após expiração: `GET /api/orders` continua (rota pública no middleware), mas `PATCH` passa a retornar 401 e `updateStatus` falha sem mensagem/som/redirect — o card mostra status antigo. Chat/mensagens também morrem em silêncio. | `kds-login/route.ts:45-57` ✅; `kds/screen:105-135,137-149,165-214,287-291`; `api/orders/[id]:15,34-44`; `middleware:10-36` |
| **F8B-008** | **ALTO** | Rep. F4C-009 | **`fetchAuth` derruba a venda/PDV no meio do turno com redirect bruto**: em 401 sem refresh válido → `clearAuth()` + `window.location.href = "/login"` ✅ (sem toast, sem parâmetro de motivo). Roda de forma assíncrona dentro do polling de 10s do PDV — pode acontecer com carrinho aberto/mesa em fechamento. Carrinho sobrevive em localStorage, mas o operador é surpreendido sem explicação. | `lib/fetch-auth.ts:37-41,85-94` ✅; `caixa-page:6,334-336,292-300,154-178` |
| **F8B-009** | MÉDIO | Novo | **Nenhuma tela avisa "sessão expirada"** — grep por `expirad*/sessão` no frontend só retorna labels de pedido; a tela de login não recebe query param/reason — o usuário acha que foi deslogado manualmente ou que o sistema quebrou. | grep (só `caixa-page:2733`, `pedidos:28`, `tracking:18` = status de pedido); `login` sem querystring |
| **F8B-016** | MÉDIO | Novo | **Retry automático praticamente inexistente** — só a home do dashboard (1 retry + 500ms + botão "Tentar novamente") e o `page.tsx` server-side do cardápio (2 retries para erros de pool). Todas as demais telas: 1 tentativa. | `home/page-content.tsx:20-47` ✅ (referência); `[slug]/page.tsx:6-18`; restante: 0 |
| **F8B-024** | BAIXO | Rep. F7A-004 | **Sessão do cliente do cardápio não expira nem é invalidável**: `pedefacil-customer-<slug>` em localStorage, sem TTL, sem versão, sem revogação server-side. | `menu-page.tsx:422,875,2631-2634,3945,4358` |
| **F8B-025** | BAIXO | Rep. F1A-041 | `DELETE /api/orders/delete-all` **não tem nenhum botão na UI** (confirmado: sem invocação em `.tsx`) — API exposta sem trava de papel, mas sem caminho de UX. | grep `delete-all` em `*.tsx` = 0 |

**Padrão a replicar:** `home/page-content.tsx:20-47` (loading + retry único + erro visível com botão "Tentar novamente") e `delivery-page.tsx:62-63,301-305` ("Link inválido" + erro) são os únicos exemplos corretos na base.

---

## O que está bom

1. **`<img>` 44/44 com `alt>`** e `<html lang="pt-BR">` correto — base de semântica mínima existe.
2. **Mesa autoatendimento é a tela mais bem-feita** (28 breakpoints, safe-area, drawer mobile) — serve de referência para o que falta no PDV.
3. **Fluxo "FINALIZAR VENDA" principal tem guarda** (`disabled={closing}` + `ConfirmDialog` + texto "Registrando...") — o problema está nos fluxos satélite (fechar mesa, abrir/fechar caixa, abater, pagar externo, ConfirmDialog).
4. **Login, cadastro, despesas e OTP têm validação client com mensagens específicas** — contraste com cardápio de produto e cupom.
5. **Service Worker nunca cacheia `/api/` e `/_next/`** e o precache é íntegro; manifest por slug do cardápio tem `start_url`/`scope` corretos.
6. **Atalhos de teclado do PDV (F1–F5, Ctrl+1-9) têm guarda de input** (ignoram campos) — falta documentação e não sequestrar F5.
7. **KDS usa `<button>` para todas as ações** (0 `<div onClick>`) e status com rótulo textual + ícone (não só cor).
8. **Cardápio público trata `safe-area` e tem OTP com `autoComplete="one-time-code"` + `aria-label` por dígito.**

## Não verificado / fora do alcance deste repositório

- **Nenhum teste dinâmico executado** — nenhuma resolução real (tablet 768/1024, celular, TV) foi renderizada; as geometrias do F8A-001 são cálculo de CSS (flexbox + `minmax(0,1fr)`), **confirmar em dispositivo**.
- Contrastes são **estimativas** por valores Tailwind padrão — validar com ferramenta (Lighthouse/axe) em ambiente de teste.
- Comportamento real do `Cache-Control` de `/sw.js` na Vercel (não declarado no repo).
- Travamento de orientação Android (`orientation: portrait`) por OS/version.
- Push nas telas de equipe: `PushSubscribe`/`InstallPromptToast` só existem em `menu-page` — caixa/KDS/dashboard não inscrevem push (fora do escopo 8A, anotado como contexto).

## Prioridades desta fase (Top 5)

1. **Re-entrância do PDV**: hook `useSubmitGuard` + `disabled`/`loading` em **todos** os botões de submit (fechar mesa, abrir/fechar caixa, abater, pagar externo, ConfirmDialog) + tornar `close-table` idempotente (lock por mesa ou chave de requisição) — fecha F8C-001/003/004/005/006.
2. **Feedback honesto**: `res.ok` antes de toast de sucesso em todo write; `Array.isArray` antes de `setOrders`; relatórios com estado de erro (não zeros); login não expulsa por 500/offline; banner de offline (`navigator.onLine`) — fecha F8B-002/004/005/006/012.
3. **Responsividade dos 3 devices-alvo**: PDV com drawer mobile (copiar o padrão da mesa), KDS com modo TV (breakpoints + fonte ≥16px + alvos 44px), CTA do motoboy ≥44px — fecha F8A-001/002/003/016.
4. **Acessibilidade de base**: remover `userScalable: false`, trocar `<div onClick>` por `<button>` (card de produto, card de mesa), `role="dialog"` + `aria-modal` + Escape em todos os 76 overlays, `aria-label` nos botões só-ícone, `htmlFor`/`id` nos inputs, `focus-visible` — fecha F8D-001…004/006/007/016/018.
5. **PWA seguro**: banner "nova versão disponível" em vez de `navigate()` forçado, deduplicar notificação por URL, versionar localStorage, corrigir `start_url` do manifest global — fecha F8A-004/005/008/009/010/019.

## Duplicados removidos nesta fase

| Descartado | Unificado em |
|---|---|
| F8A-011 | F8D-003 (zoom bloqueado; também Rep. F6A-001) |
| F8A-002 / F8D-021 | mantidos ambos (legibilidade vs contraste do KDS) com cross-ref |
| F8B-010 / F8C-003 | mantidos ambos (sem res.ok/confirm vs sem disabled) com cross-ref |
| F8B-011 | mantido (transferência) com cross-ref para F5A-033 |
| F8B-017 | F8C-010 (alert() nativo — bloco 8C é o canônico) |
| F8B-022 | F8B-001 (caixa dashboard — instância do spinner infinito) |
| F8D-026 | F8C-013 (design system/tema — canônico 8C) |
| F8D-024 | F8A-003 (alvos de clique KDS — canônico 8A) |
| F8B-010 (fechar mesa sem conf.) | F8C-001 (re-entrância + API não-idempotente — canônico crítico) |

## Pendências da Fase 8 para o responsável

1. **Re-entrância do PDV (CRÍTICO)**: hook `useSubmitGuard` + `disabled`/`loading` em fechar mesa, abrir/fechar caixa, abater, pagar externo e `ConfirmDialog`; idempotência em `POST /api/cash-register/close-table` (lock por mesa ou `Idempotency-Key`) — F8C-001/003/004/005/006.
2. **XSS no cupom de impressão**: escapar/`textContent` no `printReceiptPopup` (`caixa-page.tsx:951-987`) — F8C-008.
3. **OTP não pode aparecer na tela do cliente** quando o WhatsApp falha (esconder `verifyDevCode` em produção; depende de F7A-001) — F8C-007.
4. **Feedback honesto**: `res.ok` antes de todo toast de sucesso; `Array.isArray` antes de `setOrders`; relatórios com estado de erro (não "R$ 0,00"); login não expulsa por 500/offline (distinguir 401 de rede); banner de offline — F8B-002/004/005/006/012.
5. **Responsividade dos 3 devices**: PDV com drawer mobile (padrão da mesa), KDS com modo TV (breakpoints + fonte ≥16px + alvos ≥44px), CTA do motoboy ≥44px — F8A-001/002/003/016.
6. **Acessibilidade de base**: remover `userScalable: false`; `<button>` no card de produto e card de mesa; `role="dialog"`+`aria-modal`+Escape nos 76 overlays; `aria-label` em botões só-ícone; `htmlFor`/`id` em inputs (inclusive `ui/Input`); `focus-visible`; `aria-live` no toast — F8D-001…004/006/007/016/017/018/027.
7. **PWA seguro**: banner "nova versão disponível" em vez de `navigate()` forçado; deduplicar notificação por URL (não navegar a primeira janela); versionar localStorage; corrigir `start_url` do manifest global e `orientation: portrait` — F8A-004/005/008/009/010/014/019.
8. **Contraste**: criar `.badge-fire` com fundo; trocar `text-white` sobre `bg-yellow-400`/`green-500`; elevar `textMutedMore` para alpha ≥0,60; revisar `text-zinc-400`/`text-white/30-40` em telas operacionais — F8D-013/014/015/019/020.
9. **Design system**: adotar `ui/Button`/`ui/Input` no PDV e dashboard; eliminar hex hardcoded e ternários `darkMode` duplicados; unificar tema via classe no `<html>` (não estado JS + `media`); unificar moeda no `formatCurrency` — F8C-013/014/015/017, F8D-026.
10. **Impressão**: tratar `window.open` bloqueado com aviso + retry; estado "Imprimindo..."; XSS (item 2) — F8C-016/008.
11. **KDS**: refresh token ou sessão longa; checar `res.ok`/401 em `updateStatus`/`fetchOrders` com aviso visível; relógio do servidor para timers — F8B-007, F8C-012.
12. **Confirmar em dispositivo**: geometria do PDV em tablet retrato (F8A-001), KDS em TV real, e validar contraste com ferramenta (axe/Lighthouse) em ambiente de teste.
