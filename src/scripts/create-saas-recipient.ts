import { getPagarmeConfig } from "../lib/pagarme-config"

async function createSaaSRecipient() {
  const config = await getPagarmeConfig()
  const authHeader = `Basic ${Buffer.from(config.apiKey + ":").toString("base64")}`

  const res = await fetch("https://api.pagar.me/core/v5/recipients", {
    method: "POST",
    headers: { "Authorization": authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "FlowOS SaaS",
      email: "financeiro@flowos.com",
      description: "Recebedor principal do SaaS FlowOS",
      document: "11222333000181",
      type: "company",
      default_bank_account: {
        holder_name: "FlowOS Tecnologia LTDA",
        holder_type: "company",
        holder_document: "11222333000181",
        bank: "341",
        branch_number: "0001",
        account_number: "12345",
        account_check_digit: "6",
        type: "checking"
      },
      transfer_settings: { transfer_enabled: true, transfer_interval: "Daily", transfer_day: 0 },
      automatic_anticipation_settings: { enabled: false }
    }),
  })

  const data = await res.json()
  if (res.ok) {
    console.log("✅ SaaS Recipient criado!")
    console.log("ID:", data.id)
    console.log("\nAdicione no .env:")
    console.log(`PAGARME_SAAS_RECIPIENT_ID=${data.id}`)
  } else {
    console.error("❌ Erro:", data)
  }
}

createSaaSRecipient()
