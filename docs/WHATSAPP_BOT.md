# WhatsApp Bot - Documentação Completa

## Visão Geral

Implementação de atendimento automatizado via WhatsApp com bot determinístico (Fase 1) evoluindo para IA (Fases 2-4). Cada estabelecimento tem configuração independente.

---

## Roadmap por Fases

### Fase 1 - Bot Determinístico (SEM IA)
**Status**: Em andamento
**Tempo estimado**: 1-2 dias
**Custo IA**: R$ 0

**Funcionalidades**:
- Webhook recebe mensagem da Evolution API
- Bot responde com menu fixo numerado
- Opções configuráveis por estabelecimento
- Envio de link do cardápio digital
- Notificação ao admin quando cliente pede atendimento humano

**Arquivos**:
- `src/lib/whatsapp/provider.ts` - interface WhatsAppProvider
- `src/lib/whatsapp/evolution.ts` - adapter Evolution API
- `src/lib/whatsapp/index.ts` - factory de seleção
- `src/app/api/webhooks/whatsapp/route.ts` - webhook handler
- `src/app/dashboard/(auth)/config/page-content.tsx` - UI config bot

**Schema Prisma** (já adicionado):
```prisma
model Establishment {
  whatsappProvider       String?
  whatsappNumber         String?
  evolutionBaseUrl       String?
  evolutionApiKey        String?
  evolutionInstanceName  String?
  botEnabled             Boolean   @default(false)
  botAgentName           String?   @default("Atendente")
  botGreeting            String?
  botMenuOptions         String?
}
```

---

### Fase 2 - Bot com IA (LLM)
**Status**: Pendente
**Tempo estimado**: 3-5 dias
**Custo IA**: ~$0,15/1M tokens (gpt-4o-mini)

**Funcionalidades**:
- IA entende linguagem natural
- Prompt mestre no super admin
- Identidade/FAQ por estabelecimento
- Estado de conversa (memória curta)
- Rate limit por número
- Auto-identificação via link `?phone=`

**Novos arquivos**:
- `src/lib/whatsapp/ai/` - integrações OpenAI/Anthropic
- `src/app/dashboard/super-admin/` - painel super admin
- Models: `WhatsAppConversation`, `WhatsAppMessageLog`

---

### Fase 3 - Encomendas e Cancelamentos Inteligentes
**Status**: Pendente
**Tempo estimado**: 3-4 dias
**Custo IA**: + ~$0,05/mensagem

**Funcionalidades**:
- Agendamento de eventos com antecedência mínima
- Sinal via PIX (Asaas)
- Matriz de cancelamentos por status
- Asaas refund automático
- Webhook confirma agendamento após pagamento

**Schema adicional**:
```prisma
model Order {
  scheduledFor    DateTime?
}

model Product {
  isEventItem     Boolean   @default(false)
}

model Establishment {
  eventLeadTimeHours    Int    @default(24)
  eventDepositPercent   Int    @default(50)
}
```

---

### Fase 4 - Refazer Pedido + Atendimento Humano
**Status**: Pendente
**Tempo estimado**: 2-3 dias

**Funcionalidades**:
- Atalho "refazer último pedido" para clientes recorrentes
- Handoff para atendente humano
- Push notification para admin
- Outbound do admin via WhatsApp

---

## Infraestrutura Recomendada

### Por Estágio

| Clientes | Solução | Custo/mês |
|---|---|---|
| 0-2 | Railway Hobby $5 | R$ 25 |
| 3-5 | Contabo VPS €9 | R$ 50 |
| 5-10 | Contabo VPS maior | R$ 100 |
| 10-30 | Hetzner CPX31 | R$ 90 |
| 30+ | Múltiplos VPS | R$ 200+ |

**Quando migrar Railway → VPS**: ao atingir 3 clientes ou quando Railway ficar caro (>R$ 50/mês).

---

## Segurança Anti-Ban - Regras Críticas

### Limites Técnicos da Meta (WhatsApp Web)

| Limite | Valor Aproximado | Consequência se Exceder |
|---|---|---|
| Mensagens/dia para contatos que nunca falaram | ~80 | Ban temporário 24h |
| Mensagens/dia totais (todos os contatos) | ~1.000-5.000 | Ban temporário |
| Taxa de envio sustentada | ~1 msg/segundo | Throttling (delay) |
| Mensagens/hora | ~200-500 | Throttling |

### Comportamento Seguro (Risco < 1% por ano)

✅ **PERMITIDO**:
- Bot responde cliente que mandou mensagem
- Cliente pediu link, bot manda link
- Cliente perguntou horário, bot responde
- Cliente fez pedido, bot manda atualizações
- Mensagens conversacionais (ida e volta)

⚠️ **ATENÇÃO**:
- Cliente não falou há 30+ dias, bot manda mensagem sem contexto
- Volume entre 500-1.000 msgs/dia por número
- Mensagens sempre no mesmo formato/template

❌ **PROIBIDO** (Risco 10-30% de ban):
- Spam em massa (mesma msg para 500+ contatos)
- Mensagens idênticas para muitos contatos em sequência
- Marketing não solicitado
- Volume > 1.000 msgs/dia sem variação
- Bot que não responde, só dispara marketing

---

## Proteções Implementadas no Sistema

### Rate Limiting por Número

```typescript
// Limites por número WhatsApp
const DAILY_LIMIT = 500          // mensagens/dia por número
const HOURLY_LIMIT = 50          // mensagens/hora por número
const BURST_LIMIT = 5            // mensagens/minuto (anti-spam)
const COOLDOWN_MS = 2000         // delay mínimo entre mensagens (2s)
```

### Throttling Automático

- Delay de **2-5 segundos** entre cada mensagem
- Variação aleatória (não parecer robô)
- Fila de mensagens com rate limit

### Validações Antes de Enviar

```typescript
// Antes de enviar qualquer mensagem
if (!isValidWhatsAppNumber(phone)) return error
if (isRateLimited(phone)) return error
if (isBanned(phone)) return error
if (isInactive(phone, daysSinceLastContact)) return error
```

### Detecção de Padrão Anormal

```typescript
// Monitora e pausa se detectar:
- Mesma mensagem para 10+ contatos em 5min
- Mais de 50 mensagens em 1h para o mesmo número
- Mais de 3 reclamações de "não solicitei"
- Volume crescente sem variação de texto
```

---

## Monitoramento Recomendado

### Métricas Essenciais

**Por número WhatsApp**:
- Mensagens enviadas/dia
- Mensagens recebidas/dia
- Taxa de entrega (entregas vs falhas)
- Taxa de leitura (mensagens lidas vs enviadas)
- Tempo médio de resposta

**Por estabelecimento**:
- Total de mensagens/mês
- Custo de IA (quando implementar)
- Conversas ativas
- Pedidos iniciados via WhatsApp

### Alertas (quando próximo do limite)

| Métrica | Threshold | Ação |
|---|---|---|
| Msgs/dia por número | > 400 (80% do limite) | Alerta amarelo + throttling |
| Msgs/dia por número | > 450 (90% do limite) | Alerta vermelho + pausa 1h |
| Msgs/dia por número | > 500 (100% do limite) | Bloqueio até próximo dia |
| Custo IA mensal | > 80% da quota | Notificar super admin |
| Taxa de ban/erro | > 5% | Pausa imediata + investigação |

### Ferramentas de Monitoramento

**Grátis**:
- UptimeRobot (uptime da VPS/Evolution)
- Logs do Railway/Contabo
- Dashboard próprio (a implementar)

**Pagas** (quando escalar):
- Datadog ($0,10/mês por host)
- New Relic (free tier limitado)
- Sentry (error tracking, free tier)

---

## Boas Práticas de Conteúdo

### Mensagens que NÃO Causam Ban

✅ Conversacionais:
- "Oi! Como posso ajudar?"
- "Seu pedido #123 foi confirmado"
- "Como prefere pagar: PIX ou cartão?"

✅ Transacionais (cliente pediu):
- "Link do cardápio: https://..."
- "Status do pedido: em preparo"
- "Seu pedido saiu para entrega"

### Mensagens que PODEM Causar Ban

❌ Marketing agressivo:
- "Promoção imperdível! Compre agora!"
- "Última chance! Desconto de 50%!"

❌ Spam:
- "Olá, somos da empresa X, temos uma oferta..."
- "Você ganhou um cupom de R$ 100!"

❌ Templates repetitivos:
- Mesma mensagem para 100+ contatos
- Mensagens sem personalização

---

## Checklist de Segurança por Estabelecimento

Antes de ativar o bot para um novo cliente:

- [ ] Número WhatsApp dedicado (não é o pessoal do dono)
- [ ] Conta WhatsApp com pelo menos 1 mês de uso normal
- [ ] Foto de perfil configurada
- [ ] Status/business description preenchido
- [ ] Aquecimento gradual (primeiros 7 dias: volume baixo)
- [ ] Resposta humana configurada (horário comercial)
- [ ] Limites diários configurados no sistema
- [ ] Monitoramento ativado

---

## Aquecimento de Número Novo

### Semana 1: Volume Muito Baixo
- Máx 50 mensagens/dia
- Apenas respostas (cliente iniciou conversa)
- Sem mensagens proativas

### Semana 2: Volume Baixo
- Máx 150 mensagens/dia
- Respostas + confirmações de pedido
- Mensagens proativas só para clientes ativos (últimos 7 dias)

### Semana 3: Volume Moderado
- Máx 300 mensagens/dia
- Todas as funcionalidades ativas
- Monitoramento constante

### Semana 4+: Volume Normal
- Limite padrão (500/dia)
- Todas as funcionalidades liberadas
- Monitoramento contínuo

---

## Recuperação de Ban

Se um número for banido (temporário ou permanente):

### Ban Temporário (24h-7 dias)
1. Identificar causa (volume, conteúdo, padrão)
2. Aguardar período de ban
3. Reduzir limites em 50%
4. Retomar gradualmente
5. Monitorar dobrado nas primeiras 2 semanas

### Ban Permanente
1. Número perdido (não recuperável)
2. Cliente precisa fornecer outro número
3. Iniciar processo de aquecimento novamente
4. Investigar causa raiz pra não repetir

---

## Configurações Recomendadas por Plano

### Plano Starter (até 500 msgs/mês)
- Limite diário: 50 msgs
- Limite horário: 10 msgs
- Delay entre msgs: 3-5s
- Aquecimento: 2 semanas

### Plano Pro (até 2.000 msgs/mês)
- Limite diário: 200 msgs
- Limite horário: 30 msgs
- Delay entre msgs: 2-3s
- Aquecimento: 1 semana

### Plano Business (ilimitado)
- Limite diário: 500 msgs
- Limite horário: 50 msgs
- Delay entre msgs: 2s
- Aquecimento: 3 dias (número já validado)

---

## Custos Reais do Sistema

### Custos Fixos (independem de uso)
| Item | Custo/mês |
|---|---|
| Next.js (Vercel Pro) | $20 (R$ 100) |
| Supabase Pro | $25 (R$ 125) |
| Evolution (Railway/VPS) | $5-10 (R$ 25-50) |
| **Total fixo** | **R$ 250-275** |

### Custos Variáveis (por uso)
| Item | Custo |
|---|---|
| OpenAI gpt-4o-mini | $0,15/1M tokens input |
| OpenAI gpt-4o-mini output | $0,60/1M tokens |
| Média por mensagem | ~$0,0001 |
| 10.000 mensagens/mês | ~$1 (R$ 5) |

### Custo Total Estimado
- **MVP (1-3 clientes, 1.000 msgs/mês)**: ~R$ 280/mês
- **Crescimento (10 clientes, 10.000 msgs/mês)**: ~R$ 350/mês
- **Escala (30 clientes, 50.000 msgs/mês)**: ~R$ 500/mês

---

## Próximos Passos Imediatos

1. **Schema**: já adicionado ao `prisma/schema.prisma`
2. **Migration**: rodar `npx prisma db push`
3. **Abstração WhatsAppProvider**: criar `src/lib/whatsapp/`
4. **Adapter Evolution**: implementar `src/lib/whatsapp/evolution.ts`
5. **Webhook**: criar `src/app/api/webhooks/whatsapp/route.ts`
6. **Bot**: implementar lógica determinística
7. **UI**: adicionar campos no `/dashboard/config`
8. **Testes**: configurar Evolution no Railway + testar

---

## Contatos Úteis

- **Evolution API Docs**: https://doc.evolution-api.com/
- **OpenAI Docs**: https://platform.openai.com/docs
- **Meta WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp

---

**Última atualização**: 2026-07-29
**Versão do documento**: 1.0
