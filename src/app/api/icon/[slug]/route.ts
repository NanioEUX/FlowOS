import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * Retorna o ícone PWA dinâmico do estabelecimento.
 * - Se tem logo: redireciona pra ela
 * - Se não tem: retorna fallback FlowOS com cor primária
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const establishment = await prisma.establishment.findUnique({
    where: { slug: params.slug },
    select: { logo: true, name: true, primaryColor: true },
  })

  if (!establishment) {
    return NextResponse.redirect(new URL("/icons/icon-192.png", req.url))
  }

  // Se tem logo do estabelecimento, redireciona pra ela
  if (establishment.logo) {
    return NextResponse.redirect(establishment.logo)
  }

  // Sem logo: usa FlowOS fallback
  return NextResponse.redirect(new URL("/icons/icon-192.png", req.url))
}
