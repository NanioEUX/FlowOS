import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { MenuPage } from "./menu-page"

export default async function EstablishmentPage({
  params,
}: {
  params: { slug: string }
}) {
  const establishment = await prisma.establishment.findUnique({
    where: { slug: params.slug },
    include: {
      categories: {
        include: { products: { where: { isAvailable: true }, orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
    },
  })

  if (!establishment) {
    notFound()
  }

  // Check subscription status
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
