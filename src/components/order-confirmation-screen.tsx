"use client"

import { CheckCircle, Gift, Sparkles, ArrowRight } from "lucide-react"

interface ConfirmationItemOption {
  name: string
  price: number
  quantity: number
}

interface ConfirmationItem {
  name: string
  quantity: number
  price: number
  additionalOptions?: ConfirmationItemOption[]
}

interface Props {
  theme: any
  title?: string
  logo?: string
  establishmentName: string
  orderNumber?: number
  items: ConfirmationItem[]
  subtotal: number
  deliveryFee: number
  couponDiscount: number
  firstPurchaseDiscount: number
  firstPurchaseBonus: number
  total: number
  showLoyalty: boolean
  cashEarned: number
  loyaltyBalance: number
  redeemPoints?: number
  redeemDiscount?: number
  orderType?: string
  deliveryCode?: string | null
  onTrack: () => void
  onContinue: () => void
}

export function OrderConfirmationScreen({
  theme,
  title,
  logo,
  establishmentName,
  orderNumber,
  items,
  subtotal,
  deliveryFee,
  couponDiscount,
  firstPurchaseDiscount,
  firstPurchaseBonus,
  total,
  showLoyalty,
  cashEarned,
  loyaltyBalance,
  redeemPoints,
  redeemDiscount,
  orderType,
  deliveryCode,
  onTrack,
  onContinue,
}: Props) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  const pointsToR$ = (points: number) => {
    if (!redeemPoints || !redeemDiscount) return 0
    return (points / redeemPoints) * redeemDiscount
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ backgroundColor: theme.bgPage }}>
      {/* Close button */}
      <div className="absolute top-0 right-0 p-4" style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}>
        <button
          onClick={onContinue}
          aria-label="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ backgroundColor: theme.bgCard, color: theme.textMutedMore }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-4">
        <div className="mx-auto w-full max-w-lg">
          {/* Header */}
          <div className="mb-6 text-center">
            {logo ? (
              <img src={logo} alt={establishmentName} className="mx-auto mb-3 h-14 w-14 rounded-full object-cover shadow-md" />
            ) : (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold shadow-md" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                {establishmentName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${theme.success}15` }}>
              <CheckCircle className="h-9 w-9" style={{ color: theme.success }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: theme.text }}>
              {title || "Pedido confirmado!"}
            </h1>
            {orderNumber != null && (
              <p className="text-xl font-black mt-1" style={{ color: theme.success }}>
                Nº {orderNumber}
              </p>
            )}
          </div>

          {/* Order summary - RECEIPT STYLE */}
          <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
            <h3 className="font-semibold text-sm mb-3" style={{ color: theme.text }}>Seu pedido</h3>

            {/* Items list */}
            <div className="space-y-2 mb-3">
              {items.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: theme.text }}>{item.quantity}x {item.name}</span>
                    <span className="font-medium" style={{ color: theme.text }}>{fmt(item.price * item.quantity)}</span>
                  </div>
                  {item.additionalOptions && item.additionalOptions.length > 0 && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {item.additionalOptions.map((opt, optIdx) => (
                        <div key={optIdx} className="flex justify-between text-xs">
                          <span style={{ color: theme.textMutedMore }}>  {opt.quantity}x {opt.name}</span>
                          <span style={{ color: theme.textMutedMore }}>{fmt(opt.price * opt.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-3 space-y-1" style={{ borderTop: `1px solid ${theme.borderSubtle}` }}>
              <div className="flex justify-between text-sm" style={{ color: theme.textMuted }}>
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm" style={{ color: theme.textMuted }}>
                  <span>Entrega</span><span>{fmt(deliveryFee)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm" style={{ color: theme.success }}>
                  <span>Cupom</span><span>-{fmt(couponDiscount)}</span>
                </div>
              )}
              {firstPurchaseDiscount > 0 && (
                <div className="flex justify-between text-sm" style={{ color: theme.success }}>
                  <span>1ª compra</span><span>-{fmt(firstPurchaseDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1" style={{ color: theme.text }}>
                <span>Total</span>
                <span style={{ color: theme.success }}>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Code */}
          {deliveryCode && orderType === "delivery" && (
            <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5 mb-3 text-center">
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">
                Código de Confirmação da Entrega
              </p>
              <p className="text-4xl font-black tracking-[0.4em] text-amber-700 mb-1">
                {deliveryCode}
              </p>
              <p className="text-xs text-amber-500">
                Informe este código ao motoboy na hora da entrega
              </p>
            </div>
          )}

          {/* Cashback earned */}
          {showLoyalty && cashEarned > 0 && (
            <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: `${theme.success}10`, border: `1px solid ${theme.success}20` }}>
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5" style={{ color: theme.success }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: theme.success }}>Você ganhou +{cashEarned} pontos</p>
                  <p className="text-xs" style={{ color: theme.textMuted }}>Saldo: {loyaltyBalance} pontos ({fmt(pointsToR$(loyaltyBalance))})</p>
                </div>
              </div>
            </div>
          )}

          {/* First purchase bonus */}
          {firstPurchaseBonus > 0 && (
            <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: `${theme.success}10`, border: `1px solid ${theme.success}20` }}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" style={{ color: theme.success }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: theme.success }}>Bônus 1ª compra: +{firstPurchaseBonus} cash</p>
                  <p className="text-xs" style={{ color: theme.textMuted }}>Adicionado ao seu saldo</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA - Track button */}
      <div className="flex-shrink-0 px-4 pt-3 pb-4" style={{ borderTop: `1px solid ${theme.borderCard}`, paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))", backgroundColor: theme.bgPage }}>
        <button
          onClick={onTrack}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent || theme.primary})` }}
        >
          Acompanhar pedido <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-center text-xs mt-2" style={{ color: theme.textMutedMore }}>
          Acompanhe o status em tempo real
        </p>
      </div>
    </div>
  )
}
