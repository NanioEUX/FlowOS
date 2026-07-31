import { InstallPWA } from "@/components/pwa/install-pwa"
import { prisma } from "@/lib/prisma"
import type { Metadata } from "next"

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const establishment = await prisma.establishment.findUnique({
    where: { slug: params.slug },
    select: { name: true, primaryColor: true, logo: true, description: true },
  })

  if (!establishment) {
    return { title: "Estabelecimento não encontrado" }
  }

  return {
    title: `${establishment.name} - Cardápio Digital`,
    description: establishment.description || `Peça online em ${establishment.name}`,
    manifest: `/api/manifest/${params.slug}`,
    themeColor: establishment.primaryColor || "#1E7BFF",
    icons: {
      icon: `/api/icon/${params.slug}?size=192`,
      apple: `/api/icon/${params.slug}?size=192`,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: establishment.name,
    },
    other: {
      "apple-mobile-web-app-title": establishment.name,
    },
  }
}

export default function PublicSlugLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallPWA />
    </>
  )
}
