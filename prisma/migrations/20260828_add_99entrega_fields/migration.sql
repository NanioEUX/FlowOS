-- AlterTable: Add 99Entrega fields to Establishment
ALTER TABLE "Establishment" ADD COLUMN "tipoEntregaAtiva" TEXT NOT NULL DEFAULT 'propria';
ALTER TABLE "Establishment" ADD COLUMN "api99Key" TEXT;
ALTER TABLE "Establishment" ADD COLUMN "api99EmployeeId" TEXT;

-- AlterTable: Add 99Entrega tracking fields to Order
ALTER TABLE "Order" ADD COLUMN "entregaProvedor" TEXT DEFAULT 'propria';
ALTER TABLE "Order" ADD COLUMN "entrega99RideId" TEXT;
ALTER TABLE "Order" ADD COLUMN "entregaStatusProvedor" TEXT;
ALTER TABLE "Order" ADD COLUMN "entregaPrecoCusto" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN "entregaLinkRastreamento" TEXT;
ALTER TABLE "Order" ADD COLUMN "entregaPinCode" TEXT;

-- CreateTable: LogWebhook99 for webhook audit logs
CREATE TABLE "LogWebhook99" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT,
    "rideId" TEXT,
    "payload" JSONB NOT NULL,
    "statusProcessamento" TEXT NOT NULL DEFAULT 'pendente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogWebhook99_pkey" PRIMARY KEY ("id")
);
