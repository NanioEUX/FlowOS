import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// F3A-033: memoiza SEMPRE em globalThis, inclusive em produção — sem isso cada
// isolamento/cold start cria um PrismaClient com pool próprio (conexões ≈
// isolamentos × connection_limit; P1001 já foi atingido em produção).
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
globalForPrisma.prisma = prisma

process.on("beforeExit", async () => {
  await prisma.$disconnect()
})
