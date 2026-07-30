/**
 * Script de teste do webhook do WhatsApp
 *
 * Simula uma mensagem chegando da Evolution API para validar que o bot
 * responde corretamente antes de plugar no WhatsApp real.
 *
 * Como rodar:
 *   1. Subir o servidor: npm run dev (em outro terminal)
 *   2. Em outro terminal: npx tsx scripts/test-webhook.ts
 *
 * Ou direto via curl:
 *   curl -X POST http://localhost:3000/api/webhooks/whatsapp \
 *     -H "Content-Type: application/json" \
 *     -d @scripts/test-webhook-payload.json
 */

const BASE_URL = process.env.WEBHOOK_URL || "http://localhost:3000"
const ENDPOINT = `${BASE_URL}/api/webhooks/whatsapp`

const payloads = {
  greeting: {
    event: "messages.upsert",
    instance: "minha-loja",
    data: {
      key: {
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        id: "TEST_MSG_001",
      },
      pushName: "João Silva",
      message: {
        conversation: "oi",
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  },

  menu: {
    event: "messages.upsert",
    instance: "minha-loja",
    data: {
      key: {
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        id: "TEST_MSG_002",
      },
      pushName: "João Silva",
      message: {
        conversation: "1",
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  },

  cardapio: {
    event: "messages.upsert",
    instance: "minha-loja",
    data: {
      key: {
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        id: "TEST_MSG_003",
      },
      pushName: "João Silva",
      message: {
        conversation: "2",
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  },

  atendente: {
    event: "messages.upsert",
    instance: "minha-loja",
    data: {
      key: {
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        id: "TEST_MSG_004",
      },
      pushName: "João Silva",
      message: {
        conversation: "3",
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  },

  unknown: {
    event: "messages.upsert",
    instance: "minha-loja",
    data: {
      key: {
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        id: "TEST_MSG_005",
      },
      pushName: "João Silva",
      message: {
        conversation: "quero um açaí",
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  },
}

async function testWebhook(name: string, payload: any) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`TESTE: ${name}`)
  console.log("=".repeat(60))
  console.log(`Enviando: ${payload.data.message.conversation}`)

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log(`Status: ${response.status}`)
    console.log(`Resposta:`, JSON.stringify(data, null, 2))
  } catch (error: any) {
    console.error(`ERRO: ${error.message}`)
  }
}

async function main() {
  console.log(`\nWebhook URL: ${ENDPOINT}\n`)
  console.log("Executando 5 testes (greeting, menu, cardapio, atendente, unknown)...\n")

  await testWebhook("Saudação (oi)", payloads.greeting)
  await new Promise((r) => setTimeout(r, 1000))

  await testWebhook("Opção 1 (menu)", payloads.menu)
  await new Promise((r) => setTimeout(r, 1000))

  await testWebhook("Opção 2 (cardápio)", payloads.cardapio)
  await new Promise((r) => setTimeout(r, 1000))

  await testWebhook("Opção 3 (atendente)", payloads.atendente)
  await new Promise((r) => setTimeout(r, 1000))

  await testWebhook("Mensagem desconhecida (deve ser ignorada)", payloads.unknown)

  console.log("\n" + "=".repeat(60))
  console.log("TESTES FINALIZADOS")
  console.log("=".repeat(60))
  console.log("\nPróximos passos:")
  console.log("1. Verifique se o bot respondeu corretamente em cada teste")
  console.log("2. Acesse o Railway para ver os logs da Evolution")
  console.log("3. Quando o eSIM ativar, escaneie o QR e teste com WhatsApp real")
}

main().catch(console.error)
