import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "caio@geladolate.com" },
    include: { establishment: true },
  })

  console.log("User:", JSON.stringify(user, null, 2))

  // Also check all establishments with "geladolate" in name
  const ests = await prisma.establishment.findMany({
    where: {
      OR: [
        { name: { contains: "geladolate", mode: "insensitive" } },
        { slug: { contains: "geladolate", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, active: true },
  })
  console.log("\nEstablishments:", JSON.stringify(ests, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
