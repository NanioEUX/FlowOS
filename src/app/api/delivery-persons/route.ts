import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import bcrypt from "bcryptjs"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const establishmentId = searchParams.get("establishmentId")
  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId necessário" }, { status: 400 })
  }
  const people = await prisma.deliveryPerson.findMany({
    where: { establishmentId, isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { orders: true } },
      establishment: { select: { slug: true } },
      user: { select: { id: true, email: true, mustChangePassword: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  })
  const result = people.map((p) => ({
    ...p,
    establishmentSlug: p.establishment.slug,
    establishment: undefined,
  }))
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  try {
    const { name, phone, establishmentId, defaultPassword, email: customEmail } = await req.json()
    if (!name || !phone || !establishmentId) {
      return NextResponse.json({ error: "name, phone e establishmentId obrigatórios" }, { status: 400 })
    }

    const token = crypto.randomBytes(8).toString("hex")
    const password = defaultPassword || "123456"
    const hashedPassword = await bcrypt.hash(password, 10)

    const email = customEmail || `motoboy-${phone}@pedefacil.local`

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "motoboy",
        permissions: JSON.stringify(["entregas"]),
        mustChangePassword: true,
        establishmentId,
      },
    })

    const person = await prisma.deliveryPerson.create({
      data: { name, phone, establishmentId, token, userId: user.id },
    })

    return NextResponse.json({ ...person, defaultPassword: password })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 })
  }
}
