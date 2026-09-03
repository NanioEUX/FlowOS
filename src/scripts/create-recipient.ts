import { getPagarmeConfig } from "../lib/pagarme-config"
import { prisma } from "../lib/prisma"

async function createRecipient() {
  const config = await getPagarmeConfig()
  
  if (!config.apiKey) {
    console.error("API Key não configurada")
    return
  }

  const authHeader = `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}`

  const recipientData = {
    name: "Restaurante Hamburgueria de Teste",
    email: "financeiro@restaurantedeteste.com",
    description: "Subconta criada para o cardápio online Flowos",
    document: "11222333000181",
    type: "company",
    default_bank_account: {
      holder_name: "Hamburgueria de Teste LTDA",
      holder_type: "company",
      holder_document: "11222333000181",
      bank: "341",
      branch_number: "0001",
      account_number: "12345",
      account_check_digit: "6",
      type: "checking"
    },
    transfer_settings: {
      transfer_enabled: true,
      transfer_interval: "Daily",
      transfer_day: 0
    },
    automatic_anticipation_settings: {
      enabled: false
    }
  }

  console.log("Enviando requisição...")
  console.log("Dados:", JSON.stringify(recipientData, null, 2))

  try {
    const res = await fetch("https://api.pagar.me/core/v5/recipients", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(recipientData),
    })

    const data = await res.json()

    if (res.ok) {
      console.log("✅ Recipient criado com sucesso!")
      console.log("ID:", data.id)
      console.log("Nome:", data.name)
      console.log("Status:", data.status)
      console.log("\nUse este ID no estabelecimento BlackBurguer CR:")
      console.log(`pagarmeSplitReceiverId: "${data.id}"`)
    } else {
      console.error("❌ Erro ao criar recipient:", data)
    }
  } catch (error) {
    console.error("Erro:", error)
  }
}

createRecipient()
