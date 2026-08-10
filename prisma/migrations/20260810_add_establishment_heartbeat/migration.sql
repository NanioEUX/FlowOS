-- CreateTable
CREATE TABLE "EstablishmentHeartbeat" (
    "establishmentId" TEXT NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstablishmentHeartbeat_pkey" PRIMARY KEY ("establishmentId")
);

-- AddForeignKey
ALTER TABLE "EstablishmentHeartbeat" ADD CONSTRAINT "EstablishmentHeartbeat_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
