const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const establishments = await prisma.establishment.findMany({
    where: { tierConfig: { not: null } },
    select: { id: true, name: true, tierConfig: true },
  })

  for (const est of establishments) {
    let tc
    try {
      tc = JSON.parse(est.tierConfig)
    } catch { continue }
    if (!tc?.enabled || !tc.tiers?.length) continue

    const customers = await prisma.customer.findMany({
      where: { establishmentId: est.id },
    })

    for (const cust of customers) {
      const agg = await prisma.order.aggregate({
        where: {
          customerId: cust.id,
          status: { in: ["delivered", "confirmed", "preparing", "ready", "dispatched", "out_for_delivery"] },
        },
        _sum: { total: true },
        _count: true,
      })
      const realTotalSpent = agg._sum.total || 0
      const realTotalOrders = agg._count || 0

      const sortedTiers = [...tc.tiers].sort((a, b) => (b.minSpent || 0) - (a.minSpent || 0))
      const matchedTier = sortedTiers.find((t) => realTotalSpent >= (t.minSpent || 0))
      const newTier = matchedTier?.name?.toLowerCase() || "bronze"

      if (cust.tier !== newTier || cust.totalSpent !== realTotalSpent || cust.totalOrders !== realTotalOrders) {
        await prisma.customer.update({
          where: { id: cust.id },
          data: { tier: newTier, totalSpent: realTotalSpent, totalOrders: realTotalOrders },
        })
        console.log(`  ${cust.name || cust.phone}: tier ${cust.tier}→${newTier}, spent ${cust.totalSpent}→${realTotalSpent}, orders ${cust.totalOrders}→${realTotalOrders}`)
      }
    }
  }
  console.log("Done!")
}

main().catch(console.error).finally(() => prisma.$disconnect())
