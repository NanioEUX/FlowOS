import { prisma } from "@/lib/prisma"

export interface QuickReplyMatch {
  text: string
  category: string
  label: string
}

/**
 * Procura uma resposta rápida global que case com o texto.
 * Retorna null se nenhuma regra casar.
 *
 * Substitui placeholders:
 * - {{CARDAPIO}}: lista de produtos do estabelecimento (nome + preço)
 * - {{HORARIO}}: horário de funcionamento formatado
 * - {{ENTREGA_INFO}}: mensagem configurada ou padrão
 * - {{PAGAMENTO_INFO}}: mensagem configurada ou padrão
 */
export async function matchGlobalQuickReply(
  text: string,
  establishmentId: string
): Promise<QuickReplyMatch | null> {
  const normalized = text.toLowerCase().trim()

  const rules = await prisma.globalQuickReply.findMany({
    where: { enabled: true },
    orderBy: { order: "asc" },
  })

  for (const rule of rules) {
    const triggers = rule.triggers
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    if (triggers.length === 0) continue

    let matched = false
    if (rule.matchType === "exact") {
      matched = triggers.includes(normalized)
    } else if (rule.matchType === "all") {
      matched = triggers.every((t) => normalized.includes(t))
    } else {
      // "any" (default)
      matched = triggers.some((t) => normalized.includes(t))
    }

    if (matched) {
      return {
        text: rule.response,
        category: rule.category,
        label: rule.label,
      }
    }
  }

  return null
}

/**
 * Substitui placeholders do texto com dados reais do estabelecimento.
 */
export async function fillQuickReplyPlaceholders(
  template: string,
  establishmentId: string
): Promise<string> {
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: {
      name: true,
      slug: true,
      botOutsideHoursMessage: true,
      businessHours: true,
      categories: {
        select: {
          name: true,
          products: {
            where: { isAvailable: true },
            orderBy: { order: "asc" },
            select: { name: true, price: true },
          },
        },
      },
    },
  })

  if (!establishment) return template

  let result = template

  // {{CARDAPIO}}
  if (result.includes("{{CARDAPIO}}")) {
    const lines: string[] = []
    for (const cat of establishment.categories) {
      if (cat.products.length === 0) continue
      lines.push(`*${cat.name}*`)
      for (const p of cat.products) {
        lines.push(`• ${p.name} - R$ ${Number(p.price).toFixed(2).replace(".", ",")}`)
      }
    }
    result = result.replaceAll("{{CARDAPIO}}", lines.join("\n") || "Cardápio indisponível no momento.")
  }

  // {{HORARIO}}
  if (result.includes("{{HORARIO}}")) {
    let hoursText = "Consulte nosso horário de funcionamento."
    if (establishment.businessHours) {
      try {
        const hours = JSON.parse(establishment.businessHours)
        const active = hours.filter((h: any) => h.active)
        if (active.length > 0) {
          const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
          hoursText = active
            .map((h: any) => `${dayNames[h.day]}: ${h.open}-${h.close}`)
            .join("\n")
        }
      } catch {}
    }
    result = result.replaceAll("{{HORARIO}}", hoursText)
  }

  // {{ENTREGA_INFO}}
  if (result.includes("{{ENTREGA_INFO}}")) {
    result = result.replaceAll(
      "{{ENTREGA_INFO}}",
      establishment.botOutsideHoursMessage ||
        "Atendemos sua região. Informe seu bairro para calcularmos a taxa e o tempo de entrega!"
    )
  }

  // {{PAGAMENTO_INFO}}
  if (result.includes("{{PAGAMENTO_INFO}}")) {
    result = result.replaceAll(
      "{{PAGAMENTO_INFO}}",
      "Aceitamos:\n💵 Dinheiro\n💳 Cartão (crédito/débito)\n📱 Pix\n\nPagamento na entrega ou retirada."
    )
  }

  return result
}
