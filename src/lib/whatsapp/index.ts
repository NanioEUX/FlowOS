import { EvolutionProvider } from "./evolution"
import type { WhatsAppProvider } from "./provider"

interface EstablishmentWhatsAppConfig {
  whatsappProvider: string | null
  evolutionBaseUrl: string | null
  evolutionApiKey: string | null
  evolutionInstanceName: string | null
  whatsappNumber: string | null
}

/**
 * Returns the WhatsApp provider for an establishment.
 * Priority:
 *   1. Establishment's own Evolution/Meta config
 *   2. SaaS-level Evolution fallback (if configured in env)
 *   3. null (no provider available)
 */
export function getWhatsAppProvider(config: EstablishmentWhatsAppConfig): WhatsAppProvider | null {
  // Priority 1: Establishment's own Evolution
  if (config.whatsappProvider === "evolution") {
    if (!config.evolutionBaseUrl || !config.evolutionApiKey || !config.evolutionInstanceName) {
      // Config incomplete — fall through to SaaS fallback
    } else {
      return new EvolutionProvider({
        baseUrl: config.evolutionBaseUrl,
        apiKey: config.evolutionApiKey,
        instanceName: config.evolutionInstanceName,
      })
    }
  }

  // Priority 1b: Meta (not implemented yet)
  if (config.whatsappProvider === "meta") {
    // TODO: implementar MetaCloudProvider quando migrar
    // Fall through to SaaS fallback
  }

  // Priority 2: SaaS-level Evolution fallback
  const saasBaseUrl = process.env.SAAS_EVOLUTION_BASE_URL
  const saasApiKey = process.env.SAAS_EVOLUTION_API_KEY
  const saasInstance = process.env.SAAS_EVOLUTION_INSTANCE
  if (saasBaseUrl && saasApiKey && saasInstance) {
    return new EvolutionProvider({
      baseUrl: saasBaseUrl,
      apiKey: saasApiKey,
      instanceName: saasInstance,
    })
  }

  return null
}

export type { WhatsAppProvider, ParsedWhatsAppMessage } from "./provider"
