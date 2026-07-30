-- Bot v2 features: inatividade, auto-transfer humano, delay typing,
-- fora de horário, templates de status, fallback message.

-- 1. Inatividade: encerrar conversa se cliente não responde
ALTER TABLE "Establishment" ADD COLUMN "botInactivityEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Establishment" ADD COLUMN "botInactivityMinutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Establishment" ADD COLUMN "botInactivityMessage" TEXT DEFAULT 'Se precisar de algo mais, é só chamar! 😊';

-- 2. Auto-transfer para humano (palavras-chave)
ALTER TABLE "Establishment" ADD COLUMN "botTransferEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Establishment" ADD COLUMN "botTransferKeywords" TEXT DEFAULT 'atendente,humano,pessoa,recepcao,recepção';
ALTER TABLE "Establishment" ADD COLUMN "botTransferMessage" TEXT DEFAULT 'Vou chamar um atendente para te ajudar. Só um momento! 🙏';

-- 3. Delay entre mensagens (typing simulation, evita ban)
ALTER TABLE "Establishment" ADD COLUMN "botTypingDelayMinMs" INTEGER NOT NULL DEFAULT 1500;
ALTER TABLE "Establishment" ADD COLUMN "botTypingDelayMaxMs" INTEGER NOT NULL DEFAULT 3500;

-- 4. Fora de horário: respeitar businessHours
ALTER TABLE "Establishment" ADD COLUMN "botRespectBusinessHours" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Establishment" ADD COLUMN "botOutsideHoursMode" TEXT NOT NULL DEFAULT 'closed'; -- 'closed' | 'scheduled'
ALTER TABLE "Establishment" ADD COLUMN "botOutsideHoursMessage" TEXT DEFAULT 'Estamos fechados no momento. Nosso horário de atendimento é:';
ALTER TABLE "Establishment" ADD COLUMN "botAcceptsScheduledOrders" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Establishment" ADD COLUMN "botScheduledOrderMessage" TEXT DEFAULT 'Aceito pedidos para agendamento! É só me dizer o que quer e pra quando. 😊';

-- 5. Mensagem de fallback (quando não entende)
ALTER TABLE "Establishment" ADD COLUMN "botFallbackMessage" TEXT DEFAULT 'Não entendi muito bem 🤔 Pode me explicar com outras palavras?';

-- 6. Templates de status do pedido (bot envia ao mudar status)
ALTER TABLE "Establishment" ADD COLUMN "botTemplateOrderConfirmed" TEXT DEFAULT '✅ Pedido confirmado! Já estamos preparando. Prazo estimado: 30-45 min.';
ALTER TABLE "Establishment" ADD COLUMN "botTemplateOrderPreparing" TEXT DEFAULT '👨‍🍳 Seu pedido está sendo preparado!';
ALTER TABLE "Establishment" ADD COLUMN "botTemplateOrderReady" TEXT DEFAULT '🛎️ Seu pedido está pronto!';
ALTER TABLE "Establishment" ADD COLUMN "botTemplateOrderDelivering" TEXT DEFAULT '🛵 Seu pedido saiu para entrega! Previsão de chegada: 20-30 min.';
ALTER TABLE "Establishment" ADD COLUMN "botTemplateOrderDelivered" TEXT DEFAULT '🎉 Pedido entregue! Bom apetite e obrigado pela preferência! ❤️';
ALTER TABLE "Establishment" ADD COLUMN "botTemplateOrderCancelled" TEXT DEFAULT '❌ Seu pedido foi cancelado. Se precisar de algo, estou aqui!';

-- 7. Flag de conversa pendente humano (na Customer)
ALTER TABLE "Customer" ADD COLUMN "needsHuman" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN "needsHumanAt" TIMESTAMP;
