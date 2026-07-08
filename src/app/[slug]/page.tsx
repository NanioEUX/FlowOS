import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { MenuPage } from "./menu-page"

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      if (i === retries) throw err
      const isTransient = err?.message?.includes("pool") || err?.code?.includes("P1001") || err?.message?.includes("Connection") || err?.message?.includes("timeout")
      if (!isTransient) throw err
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }
  throw new Error("unreachable")
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const establishment = await withRetry(() =>
    prisma.establishment.findUnique({
      where: { slug: params.slug },
      select: { name: true, description: true, logo: true, cover: true, phone: true },
    })
  )

  if (!establishment) {
    return { title: "Estabelecimento não encontrado" }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://flowos.fs.app"
  const imageUrl = establishment.cover || establishment.logo || `${baseUrl}/og-default.png`

  return {
    title: `${establishment.name} - Cardápio Digital | FlowOS`,
    description: establishment.description || `Faça seu pedido no ${establishment.name}. Cardápio digital com delivery e retirada.`,
    openGraph: {
      title: establishment.name,
      description: establishment.description || `Faça seu pedido no ${establishment.name}`,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      siteName: "FlowOS",
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: establishment.name,
      description: establishment.description || `Faça seu pedido no ${establishment.name}`,
      images: [imageUrl],
    },
  }
}

export default async function EstablishmentPage({
  params,
}: {
  params: { slug: string }
}) {
  const establishment = await withRetry(() =>
    prisma.establishment.findUnique({
      where: { slug: params.slug },
      include: {
        categories: {
          include: { products: { where: { isAvailable: true }, orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    })
  )

  if (!establishment) {
    notFound()
  }

  const now = new Date()
  const isExpired =
    establishment.subscriptionStatus === "expired" ||
    (establishment.subscriptionStatus === "trial" && establishment.trialEndsAt && new Date(establishment.trialEndsAt) < now) ||
    (establishment.subscriptionStatus === "pending_payment")

  const { password, paymentConfig: pc, orderConfig: oc, ...rest } = establishment
  const paymentConfig = JSON.parse(pc || '{"online":true,"delivery":true,"pickup":true}')
  const orderConfig = JSON.parse(oc || '{"delivery":true,"pickup":true}')

  if (isExpired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-white/30">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">Cardápio temporariamente indisponível</h1>
        <p className="mb-6 max-w-md text-sm text-white/40">
          Este estabelecimento ainda não ativou seu plano. Volte em breve!
        </p>
        <a
          href="/"
          className="rounded-xl bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15"
        >
          ← Voltar ao início
        </a>
      </div>
    )
  }

  return <MenuPage establishment={rest} paymentConfig={paymentConfig} orderConfig={orderConfig} />
}
