-- Pedidos agendados: campos no Order + config no Establishment.

ALTER TABLE "Order" ADD COLUMN "isScheduled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "deliveryDate" TIMESTAMP;

CREATE INDEX "Order_establishmentId_isScheduled_deliveryDate_idx" ON "Order"("establishmentId", "isScheduled", "deliveryDate");

ALTER TABLE "Establishment" ADD COLUMN "scheduledMinHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Establishment" ADD COLUMN "scheduledPrepMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Establishment" ADD COLUMN "scheduledMaxAdvanceDays" INTEGER NOT NULL DEFAULT 30;
