import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"

/**
 * F6B-021 — sitemap.xml (antes inexistente).
 *
 * Lista as páginas estáticas públicas + os cardápios dos estabelecimentos
 * ativos. Se o banco estiver indisponível, devolve só as estáticas (a rota
 * nunca deve 500 por causa disso).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://flowos.fs.app"
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/cadastro`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/politica-de-privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  try {
    const establishments = await prisma.establishment.findMany({
      where: {
        isActive: true,
        slug: { not: "" },
        // Lojas canceladas/expiradas/pagamento pendente não devem ser indexadas
        // (a própria página as trata como expiradas — [slug]/page.tsx)
        subscriptionStatus: { notIn: ["expired", "cancelled", "pending_payment"] },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    })

    return [
      ...staticPages,
      ...establishments.map((e) => ({
        url: `${baseUrl}/${e.slug}`,
        lastModified: e.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.9,
      })),
    ]
  } catch {
    return staticPages
  }
}
