import { EvolutionProvider } from "./evolution"
import type { WhatsAppProvider } from "./provider"

interface EstablishmentWhatsAppConfig {
  whatsappProvider: string | null
  evolutionBaseUrl: string | null
  evolutionApiKey: string | null
  evolutionInstanceName: string | null
  whatsappNumber: string | null
}

export function getWhatsAppProvider(config: EstablishmentWhatsAppConfig): WhatsAppProvider | null {
  switch (config.whatsappProvider) {
    case "evolution":
      if (!config.evolutionBaseUrl || !config.evolutionApiKey || !config.evolutionInstanceName) {
        return null
      }
      return new EvolutionProvider({
        baseUrl: config.evolutionBaseUrl,
        apiKey: config.evolutionApiKey,
        instanceName: config.evolutionInstanceName,
      })

    case "meta":
      // TODO: implementar MetaCloudProvider quando migrar
      return null

    default:
      return null
  }
}

export type { WhatsAppProvider, ParsedWhatsAppMessage } from "./provider"
