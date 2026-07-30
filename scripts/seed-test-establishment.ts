/**
 * Script de seed para testes do webhook WhatsApp
 *
 * Cria um estabelecimento de teste com bot habilitado para validar
 * o fluxo completo do webhook antes de plugar no WhatsApp real.
 *
 * Como rodar:
 *   npx tsx scripts/seed-test-establishment.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const TEST_INSTANCE = "minha-loja"
TEST_INSTANCE.toLowerCase()

async function main() {
  console.log("Criando estabelecimento de teste...\n")

  const establishment = await prisma.establishment.upsert({
    where: { slug: "teste-webhook" },
    update: {
      botEnabled: true,
      whatsappProvider: "evolution",
      evolutionInstanceName: TEST_INSTANCE,
      evolutionBaseUrl: process.env.EVOLUTION_BASE_URL || "http://localhost:8080",
      evolutionApiKey: process.env.EVOLUTION_API_KEY || "test-key",
      whatsappNumber: "5511999999999",
      botAgentName: "Sofia",
      botGreeting: "Olá! Eu sou a Sofia, atendente virtual da Pizzaria Teste.",
    },
    create: {
      name: "Pizzaria Teste",
      slug: "teste-webhook",
      email: "teste@webhook.com",
      password: "$2a$10$dummy",
      phone: "5511999999999",
      description: "Estabelecimento de teste para webhook WhatsApp",
      whatsappProvider: "evolution",
      whatsappNumber: "5511999999999",
      evolutionInstanceName: TEST_INSTANCE,
      evolutionBaseUrl: process.env.EVOLUTION_BASE_URL || "http://localhost:8080",
      evolutionApiKey: process.env.EVOLUTION_API_KEY || "test-key",
      botEnabled: true,
      botAgentName: "Sofia",
      botGreeting: "Olá! Eu sou a Sofia, atendente virtual da Pizzaria Teste.",
      botMenuOptions: JSON.stringify([
        { id: "1", label: "Fazer Pedido", response: "menu" },
        { id: "2", label: "Ver Cardápio", response: "cardapio" },
        { id: "3", label: "Falar com Atendente", response: "atendente" },
      ]),
    },
  })

  console.log(`✓ Estabelecimento criado/atualizado: ${establishment.name}`)
  console.log(`  ID: ${establishment.id}`)
  console.log(`  Slug: ${establishment.slug}`)
  console.log(`  Instance: ${establishment.evolutionInstanceName}`)
  console.log(`  Bot ativo: ${establishment.botEnabled ? "Sim" : "Não"}`)
  console.log("\nAgora pode rodar o teste do webhook:")
  console.log("  npx tsx scripts/test-webhook.ts")
}

main()
  .catch((e) => {
    console.error("Erro:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
