import { prisma } from "@/lib/prisma"

/**
 * Upsert customer from 99Food order data.
 * 99Food uses Open Delivery Abrasel standard.
 */
export async function upsert99FoodCustomer(establishmentId: string, customerData: any) {
  const phone = (customerData?.phone || "").replace(/\D/g, "") || null
  const email = customerData?.email || null
  const name = customerData?.name || "Cliente 99Food"
  const address = customerData?.address || null

  if (!phone) return null

  let customer = await prisma.customer.findFirst({
    where: { phone, establishmentId },
  })

  if (!customer) {
    customer = await prisma.customer.create({
      data: { establishmentId, phone, name, email, address },
    })
  } else {
    const data: any = {}
    if (email && !customer.email) data.email = email
    if (address && !customer.address) data.address = address
    if (data.email || data.address) {
      customer = await prisma.customer.update({ where: { id: customer.id }, data })
    }
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      totalOrders: { increment: 1 },
      lastOrderAt: new Date(),
    },
  })

  return customer
}
