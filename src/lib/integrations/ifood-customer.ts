import { prisma } from "@/lib/prisma"

export async function upsertIfoodCustomer(establishmentId: string, customerData: any) {
  const phone = customerData?.phone?.number?.replace(/\D/g, "") || null
  const email = customerData?.additionalInfo?.metadata?.customerEmail || null
  const name = customerData?.name || "Cliente iFood"
  const address = customerData?.orderType === "DELIVERY" && customerData?.delivery?.deliveryAddress
    ? customerData.delivery.deliveryAddress.formattedAddress
    : null

  if (!phone) return null

  let customer = await prisma.customer.findFirst({
    where: { phone, establishmentId }
  })

  if (!customer) {
    customer = await prisma.customer.create({
      data: { establishmentId, phone, name, email, address }
    })
  } else {
    // Update email/address only if we have new info.
    const data: any = {}
    if (email && !customer.email) data.email = email
    if (address && !customer.address) data.address = address
    if (data.email || data.address) {
      customer = await prisma.customer.update({ where: { id: customer.id }, data })
    }
  }

  // Increment stats
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      totalOrders: { increment: 1 },
      lastOrderAt: new Date(),
    }
  })

  return customer
}
