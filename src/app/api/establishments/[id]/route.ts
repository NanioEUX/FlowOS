import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/auth"

// Credenciais que nunca saem para roles sem permissão de config (F7B-006):
// um JWT de kds/motoboy/atendente não baixa mais tokens/chaves/senhas.
const SECRET_FIELDS = [
  "password",
  "evolutionApiKey",
  "metaAccessToken",
  "metaWebhookVerifyToken",
  "interClientSecret",
  "interCertificate",
  "interCertificatePassword",
  "pagarmeApiKey",
  "pagarmeWebhookKey",
  "asaasApiKey",
  "efiClientSecret",
  "efiCertificate",
  "efiWebhookToken",
  "api99Key",
  "nineFoodApiKey",
  "ifoodAccessToken",
  "ifoodRefreshToken",
]

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authUser = await verifyAuth(req)
  if (!authUser) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (authUser.establishmentId !== params.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const establishment = await prisma.establishment.findUnique({
    where: { id: params.id },
    include: {
      categories: {
        include: { products: true },
        orderBy: { order: "asc" },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  })

  if (!establishment) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  // Quem pode editar as configurações (admin ou permissão "config") continua
  // recebendo o registro completo — o formulário de settings edita esses campos.
  const canSeeSecrets =
    authUser.role === "admin" || authUser.role === "saas_admin" || authUser.permissions?.includes("config")
  if (!canSeeSecrets) {
    const safe: Record<string, any> = { ...establishment }
    for (const field of SECRET_FIELDS) delete safe[field]
    return NextResponse.json(safe)
  }

  return NextResponse.json(establishment)
}

const SAFE_FIELDS = ["name", "slug", "phone", "email", "address", "logo", "cover", "description", "deliveryFeeType", "deliveryFeeAmount", "deliveryFreeAbove", "paymentConfig", "orderConfig", "primaryColor", "backgroundColor", "textColor", "headerColor", "colorsPublished", "instagramUrl", "businessHours", "loyaltyConfig", "tierConfig", "firstPurchaseEnabled", "firstPurchaseDiscount", "firstPurchaseBonus", "pickupMessage", "deliveryMessage", "confirmationTitle", "confirmationImage", "closedTitle", "closedSub", "tableCount", "defaultTheme", "expenseCategories", "paymentProvider", "interClientId", "interClientSecret", "interCertificate", "interCertificatePassword", "interPixKey", "maxPayOnDeliveryAmount", "blockConcurrentPayOnDelivery", "cancellationBlockEnabled", "cancellationBlockThreshold", "cancellationBlockWindowDays", "cancellationBlockDurationDays", "autoAcceptOrders", "whatsappProvider", "whatsappNumber", "evolutionBaseUrl", "evolutionApiKey", "evolutionInstanceName", "metaPhoneNumberId", "metaAccessToken", "metaWebhookVerifyToken", "metaBusinessAccountId", "metaProfilePictureUrl", "metaUserName", "metaUserPicture", "metaBusinessName", "consumoMarketing", "consumoUtility", "consumoAuthentication", "consumoService", "consumoPeriodo", "metaBillingConfigured", "botEnabled", "botAgentName", "botGreeting", "botMenuOptions", "botUseAI", "botTone", "botFAQ", "botSystemPrompt",
  "botInactivityEnabled", "botInactivityMinutes", "botInactivityMessage",
  "botTransferEnabled", "botTransferKeywords", "botTransferMessage",
  "botTypingDelayMinMs", "botTypingDelayMaxMs",
  "botRespectBusinessHours", "botOutsideHoursMode", "botOutsideHoursMessage", "botAcceptsScheduledOrders", "botScheduledOrderMessage",
  "botFallbackMessage",
  "botTemplateOrderConfirmed", "botTemplateOrderPreparing", "botTemplateOrderReady", "botTemplateOrderDelivering", "botTemplateOrderDelivered", "botTemplateOrderCancelled", "botTemplateOrderScheduled",
  "scheduledMinHours", "scheduledPrepMinutes", "scheduledMaxAdvanceDays", "estimatedDeliveryMin", "estimatedDeliveryMax",
  "whatsappAutomationEnabled", "whatsappAutomationActivatedAt", "whatsappAutomationPriceCents", "aiMessagesLimit",
  "verifyReminderEnabled", "verifyReminderDelayMin", "verifyReminderMessage",
  "minimumOrderEnabled", "minimumOrderValue", "minimumOrderApplyToDelivery", "minimumOrderApplyToPickup",
  "ifoodEnabled", "ifoodMerchantId", "ifoodMarkupPercent",
  "tipoEntregaAtiva", "api99Key", "api99EmployeeId",
  "pagarmeApiKey", "pagarmeEnvironment", "pagarmeWebhookKey", "pagarmeSplitReceiverId", "saasCommissionPercentage",
  "flowChavePix", "flowModoAtivado",
  "abandonedOrderMinutes"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await verifyAuth(req)
    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const establishmentId = authUser.establishmentId
    if (establishmentId !== params.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }

    const body = await req.json()
    const filtered: Record<string, any> = {}
    for (const key of SAFE_FIELDS) {
      if (key in body) filtered[key] = body[key]
    }

    const establishment = await prisma.establishment.update({
      where: { id: params.id },
      data: filtered,
    })
    return NextResponse.json(establishment)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}
