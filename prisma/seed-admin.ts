import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = "admin@flowoshub.com"
  const password = process.env.ADMIN_SEED_PASSWORD
  if (!password || password.length < 8) {
    console.error("Defina ADMIN_SEED_PASSWORD (mín. 8 caracteres) antes de rodar o seed-admin.")
    process.exit(1)
  }
  const hashedPassword = await bcrypt.hash(password, 10)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        role: "saas_admin",
        password: hashedPassword,
        establishmentId: null,
        isActive: true,
        mustChangePassword: true,
      },
    })
    console.log(`✅ Admin atualizado: ${email}`)
  } else {
    await prisma.user.create({
      data: {
        name: "Admin FlowOS",
        email,
        password: hashedPassword,
        role: "saas_admin",
        establishmentId: null,
        isActive: true,
        mustChangePassword: true,
      },
    })
    console.log(`✅ Admin criado: ${email}`)
  }

  console.log(`\n✅ Admin pronto: ${email} (senha definida via ADMIN_SEED_PASSWORD)`)
  console.log(`\n⚠️  Troque a senha no primeiro acesso!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
