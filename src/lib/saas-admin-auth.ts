import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "flowoshub-saas-admin-secret-change-me"
)

export interface SaasAdminSession {
  userId: string
  email: string
  role: string
}

export async function getSaasAdmin(): Promise<SaasAdminSession | null> {
  const token = cookies().get("saas_admin_token")?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    if (payload.role !== "saas_admin") return null
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
    }
  } catch {
    return null
  }
}

export async function requireSaasAdmin(): Promise<SaasAdminSession> {
  const session = await getSaasAdmin()
  if (!session) throw new Error("Não autorizado")
  return session
}
