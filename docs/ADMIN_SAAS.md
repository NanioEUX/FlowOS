# FlowOS — Painel Admin SaaS

Documento vivo sobre a arquitetura do painel administrativo do SaaS.

---

## 🎯 Visão Geral

O painel `/admin-saas` é o **centro de comando** do SaaS FlowOS. Permite ao time FlowOS:

- Monitorar toda a operação em tempo real
- Configurar regras globais (templates por categoria, respostas rápidas)
- Editar configurações de IA de qualquer estabelecimento
- Acompanhar custos de OpenAI
- Gerenciar planos, billing e features

**Acesso:** `https://flowoshub.com/admin-saas`

**Login:** `admin@flowoshub.com` (criado via seed)

---

## 🏗️ Arquitetura

### Stack
- Next.js 14 (App Router)
- Prisma + Supabase
- JWT em cookie httpOnly
- Tailwind + componentes próprios

### Auth
- Cookie `saas_admin_token` (JWT)
- Secret em `JWT_SECRET` env
- Role `saas_admin` no `User`
- `establishmentId` opcional (null para admins SaaS)

---

## 📂 Módulos Implementados

### 1. Visão Geral (`/admin-saas/dashboard`)
- KPIs: estabelecimentos ativos, pedidos/mês, faturamento/mês, custo IA/mês
- Monitores de serviço: Supabase, Vercel, OpenAI, Evolution
- Pedidos recentes (top 10)
- Próximos passos / status

### 2. Estabelecimentos (`/admin-saas/estabelecimentos`)
- Lista com filtros
- Detalhe por estabelecimento (`/admin-saas/estabelecimentos/[id]`)
- Editor de configuração de IA inline

### 3. Respostas Rápidas Globais (`/admin-saas/respostas-rapidas`)
- CRUD completo
- Categorias: cardápio, horário, entrega, pagamento, humano
- Tipos de match: any/all/exact
- Placeholders: `{{CARDAPIO}}`, `{{HORARIO}}`, `{{ENTREGA_INFO}}`, `{{PAGAMENTO_INFO}}`

### 4. Templates por Categoria (`/admin-saas/templates`)
- CRUD completo
- 8 categorias seed: pizzaria, sorveteria, açaí, hamburgueria, restaurante, doces, bebidas, outro
- Cada template tem: prompt base, tom, agente padrão, ícone

---

## 🔄 Fluxos Automáticos (Backend)

### Quick Replies Globais
- Webhook consulta **antes** de chamar IA
- Se casar (qualquer/todas/exato), responde direto
- Placeholders substituídos dinamicamente
- **Economiza** chamadas OpenAI

### Templates por Categoria
- Quando `establishment.botSystemPrompt` está vazio
- Usa `CategoryTemplate.promptBase` da categoria
- Estabelecimento pode customizar (override)

### Auto-fill no Cadastro
- Estabelecimento novo escolhe categoria
- Sistema auto-preenche `botSystemPrompt`, `botAgentName`, `botTone`
- Baseado no `CategoryTemplate`

---

## 📂 Modelos do Banco

### `CategoryTemplate`
```prisma
- slug (unique): "pizzaria"
- name: "Pizzaria"
- icon: "🍕"
- description
- tone: "casual" | "formal" | "leve" | "direto"
- promptBase (texto do prompt)
- defaultAgentName: "Sofia"
- defaultMenuJson (opcional)
- enabled (boolean)
- order (int)
```

### `GlobalQuickReply`
```prisma
- category (string)
- label (string)
- triggers (csv)
- response (texto com placeholders)
- enabled (boolean)
- order (int)
- matchType: "any" | "all" | "exact"
```

### `User` (modificado)
- `establishmentId` agora é opcional (null para saas_admin)
- Novo role: `saas_admin`

---

## 🚧 Módulos Pendentes

| # | Módulo | Status |
|---|---|---|
| 5 | Instâncias WhatsApp | pendente |
| 6 | IA & Custos | pendente |
| 7 | Planos & Billing | pendente |
| 8 | Logs & Auditoria | pendente |

---

## 🕒 Backlog / Melhorias Futuras

### Push Notifications Staff

- [ ] **Push pro dono** quando pedido novo (toggle "🔔 Ativar notificações do painel" no `/dashboard`)
- [ ] **Push pro entregador** quando pedido atribuído (painel `/staff/[slug]`)
- [ ] Toggle + indicador "disponível" pro entregador pausar notificações
- [ ] Subscription separada do cliente (model `StaffPushSubscription`)
- [ ] Push só pro entregador atribuído (não pra todos disponíveis)

### Painel Estabelecimento — Geolocalização

- [ ] UI pra configurar `addressLat`/`addressLng` do estabelecimento (botão "📍 Capturar GPS")
- [ ] CRUD visual das `DeliveryZone` (tabela de zonas: minKm, maxKm, fee, freeAbove)
- [ ] Configurar `deliveryRadiusKm` máximo

### Outras

- [ ] Badge no ícone do PWA (carrinho com N itens)
- [ ] Confirmação de pagamento PIX via push
- [ ] Melhorias de UX no PWA (offline order, cache inteligente)

---

## 🔐 Como Criar Mais Admins SaaS

```bash
# Editar email/senha em prisma/seed-admin.ts
npx tsx prisma/seed-admin.ts
```

---

## 📚 Referências

- `docs/WHATSAPP_BOT.md` — Bot WhatsApp (Fase 2, status atualizado)
