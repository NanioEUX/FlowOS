import type { MetadataRoute } from "next"

/**
 * F6B-021 — robots.txt (antes inexistente: crawlers recebiam 404 e podiam
 * indexar áreas privadas por default).
 *
 * Público (indexável): cardápio do tenant (`/[slug]`), home de marketing,
 * cadastro e política de privacidade.
 * Privado (bloqueado): dashboard, PDV/caixa, KDS, admin SaaS, login/cadastro
 * de staff, tracking de pedido (`/pedido/[token]` — dados do cliente) e APIs.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://flowos.fs.app"
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/caixa",
          "/kds",
          "/admin",
          "/admin-saas",
          "/login",
          "/esqueci-senha",
          "/redefinir-senha",
          "/trocar-senha",
          "/pedido/",
          "/ui-review",
          "/demo",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
