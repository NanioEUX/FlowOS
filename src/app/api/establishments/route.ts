import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/utils"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

// Menu cache: 60s revalidation (menu rarely changes)
export const revalidate = 60

export async function POST(req: NextRequest) {
  try {
    const { name, ownerName, email, password, phone, category, address } = await req.json()

    if (!name || !email || !password || !phone) {
      return NextResponse.json({ error: "Nome, email, senha e WhatsApp são obrigatórios" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 })
    }

    const existingEmail = await prisma.establishment.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado" }, { status: 400 })
    }

    let slug = slugify(name)
    const existingSlug = await prisma.establishment.findUnique({ where: { slug } })
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const now = new Date()
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const establishment = await prisma.establishment.create({
      data: {
        name, slug, email, password: hashedPassword, phone, category, address,
        trialStartsAt: now,
        trialEndsAt: trialEnds,
        subscriptionStatus: "trial",
        subscriptionPlan: "starter",
      },
    })

    // Create admin user for this establishment
    const adminUser = await prisma.user.create({
      data: {
        name: ownerName || name,
        email,
        password: hashedPassword,
        role: "admin",
        permissions: JSON.stringify(["dashboard","pedidos","entregas","cardapio","estoque","clientes","financeiro","caixa","config","usuarios","relatorios"]),
        establishmentId: establishment.id,
      },
    })

    const cat = await prisma.category.create({
      data: { name: "Principais", order: 0, establishmentId: establishment.id },
    })

    await prisma.product.createMany({
      data: [
        { name: "Produto Exemplo 1", price: 29.9, categoryId: cat.id, establishmentId: establishment.id },
        { name: "Produto Exemplo 2", price: 39.9, categoryId: cat.id, establishmentId: establishment.id },
      ],
    })

    const token = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: "admin", permissions: ["admin"], establishmentId: establishment.id },
      JWT_SECRET,
      { expiresIn: "24h" }
    )

    const refreshToken = jwt.sign(
      { userId: adminUser.id, type: "refresh" },
      JWT_SECRET + "-refresh",
      { expiresIn: "7d" }
    )

    return NextResponse.json({ establishment, token, refreshToken })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get("slug")
  const id = searchParams.get("id")

  if (id) {
    const establishment = await prisma.establishment.findUnique({
      where: { id },
      include: {
        categories: {
          include: { products: { where: { isAvailable: true }, orderBy: { name: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    }

    const { password, ...data } = establishment
    return NextResponse.json(data)
  }

  if (slug) {
    const establishment = await prisma.establishment.findUnique({
      where: { slug },
      include: {
        categories: {
          include: { products: { where: { isAvailable: true }, orderBy: { name: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    })

    if (!establishment) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    }

    const { password, ...data } = establishment
    return NextResponse.json(data)
  }

  const establishments = await prisma.establishment.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, category: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(establishments)
}
