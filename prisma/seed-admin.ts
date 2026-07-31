import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = "admin@flowoshub.com"
  const password = "Admin@2026"
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

  console.log(`\n🔐 Credenciais:`)
  console.log(`   Email: ${email}`)
  console.log(`   Senha: ${password}`)
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
