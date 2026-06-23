-- AlterTable: Add pickupMessage and deliveryMessage to Establishment
ALTER TABLE "Establishment" ADD COLUMN "pickupMessage" TEXT DEFAULT 'Vai ser um prazer recebê-lo. Estamos lhe aguardando!';
ALTER TABLE "Establishment" ADD COLUMN "deliveryMessage" TEXT DEFAULT 'Obrigado pelo seu pedido!';
