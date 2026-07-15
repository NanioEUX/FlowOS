import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
})

async function main() {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "waiterName" TEXT'
    )
    console.log("✅ Coluna waiterName adicionada com sucesso!")
  } catch (e: any) {
    console.error("❌ Erro:", e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
