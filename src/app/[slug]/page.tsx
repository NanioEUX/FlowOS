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
  // og-default.png não existia em public/ (link quebrado) — usa o ícone 512
  const imageUrl = establishment.cover || establishment.logo || `${baseUrl}/icons/icon-512.png`

  return {
    title: `${establishment.name} - Cardápio Digital | FlowOS`,
    description: establishment.description || `Faça seu pedido no ${establishment.name}. Cardápio digital com delivery e retirada.`,
    // F6B-021: canonical por tenant (evita indexar a mesma página por URL
    // de rastreio/parâmetros)
    alternates: { canonical: `${baseUrl}/${params.slug}` },
    openGraph: {
      title: establishment.name,
      description: establishment.description || `Faça seu pedido no ${establishment.name}`,
      // Sem width/height fixos: cover/logo têm proporção variável e dims
      // erradas cortam a prévia no WhatsApp (F6B-021)
      images: [{ url: imageUrl }],
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
          include: { products: { where: { isAvailable: true }, orderBy: { order: "asc" }, include: { additionalOptions: true } } },
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
  // Credenciais do tenant nunca vão para o HTML do cardápio público (F6A-001)
  for (const k of ["evolutionApiKey","metaAccessToken","metaWebhookVerifyToken","asaasApiKey","efiClientSecret","efiCertificate","efiWebhookToken","interClientSecret","interCertificate","interCertificatePassword","pagarmeApiKey","pagarmeWebhookKey","api99Key","ifoodAccessToken","ifoodRefreshToken","nineFoodApiKey"]) {
    delete (rest as any)[k]
  }
  const paymentConfig = JSON.parse(pc || '{"online":true,"delivery":true,"pickup":true}')
  const orderConfig = JSON.parse(oc || '{"delivery":true,"pickup":true,"dineIn":true}')
  const minimumOrder = {
    enabled: rest.minimumOrderEnabled ?? false,
    value: rest.minimumOrderValue ?? 0,
    applyToDelivery: rest.minimumOrderApplyToDelivery ?? true,
    applyToPickup: rest.minimumOrderApplyToPickup ?? false,
  }

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

  // F6B-021 — JSON-LD (rich result do cardápio). `replace(/</g)` impede que
  // qualquer string do tenant feche o </script> (XSS via JSON).
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://flowos.fs.app"
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: rest.name,
    description: rest.description || undefined,
    url: `${baseUrl}/${establishment.slug}`,
    image: rest.cover || rest.logo || `${baseUrl}/icons/icon-512.png`,
    telephone: rest.phone || undefined,
    address: rest.address
      ? { "@type": "PostalAddress", streetAddress: rest.address }
      : undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <MenuPage establishment={rest as any} paymentConfig={paymentConfig} orderConfig={orderConfig} minimumOrder={minimumOrder} />
    </>
  )
}
