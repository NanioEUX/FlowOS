"use client"

import { CheckCircle, Gift, Bike, Banknote, Clock, ExternalLink, X } from "lucide-react"

interface ConfirmationItem {
  name: string
  quantity: number
  price: number
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
  total: number
  showLoyalty: boolean
  cashEarned: number
  loyaltyBalance: number
  orderType?: string
  paymentLabel?: string
  estimatedTime?: string
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
  total,
  showLoyalty,
  cashEarned,
  loyaltyBalance,
  orderType,
  paymentLabel,
  estimatedTime,
  onTrack,
  onContinue,
}: Props) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

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
          <X className="h-5 w-5" />
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
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full animate-bounce" style={{ backgroundColor: "rgba(34,197,94,0.12)" }}>
              <CheckCircle className="h-9 w-9" style={{ color: "#16a34a" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: theme.text }}>
              {title || "Pedido confirmado!"}
            </h1>
            {orderNumber != null && (
              <p className="text-2xl font-black mt-1">
                Nº {orderNumber}
              </p>
            )}
          </div>

          {/* Order summary */}
          <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm" style={{ color: theme.text }}>Resumo</h3>
              <span className="text-lg font-bold" style={{ color: theme.primary }}>{fmt(total)}</span>
            </div>
            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span style={{ color: theme.textMuted }}>{item.quantity}x {item.name}</span>
                  <span className="font-medium" style={{ color: theme.text }}>{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 space-y-1" style={{ borderTop: `1px solid ${theme.borderSubtle}` }}>
              <div className="flex justify-between text-sm" style={{ color: theme.textMuted }}>
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm" style={{ color: theme.textMuted }}>
                  <span>Taxa de entrega</span><span>{fmt(deliveryFee)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm" style={{ color: theme.accent }}>
                  <span>Desconto</span><span>-{fmt(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm" style={{ color: theme.text }}>
                <span>Total</span>
                <span style={{ color: theme.accent }}>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Cashback */}
          {showLoyalty && (
            <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: `${theme.primary}10`, border: `1px solid ${theme.primary}20` }}>
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5" style={{ color: theme.primary }} />
                <span className="text-sm font-bold" style={{ color: theme.primary }}>Cashback</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: theme.textMuted }}>Você ganhou neste pedido</p>
                  <p className="text-2xl font-black text-green-500">+{cashEarned} cash</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: theme.textMuted }}>Saldo total</p>
                  <p className="text-lg font-bold" style={{ color: theme.primary }}>{loyaltyBalance} cash</p>
                  <p className="text-xs" style={{ color: theme.textMutedMore }}>{fmt(loyaltyBalance)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-3">
            {orderType && (
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}>
                {orderType === "delivery" ? <Bike className="h-3 w-3" /> : "🏪"}
                {orderType === "delivery" ? "Entrega" : "Retirada"}
              </span>
            )}
            {paymentLabel && (
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: `${theme.accentLight}55`, color: theme.accent }}>
                <Banknote className="h-3 w-3" />
                {paymentLabel}
              </span>
            )}
            {estimatedTime && (
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "#16a34a" }}>
                <Clock className="h-3 w-3" />
                {estimatedTime}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sticky buttons */}
      <div className="flex-shrink-0 px-4 pt-3" style={{ borderTop: `1px solid ${theme.borderCard}`, paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))", backgroundColor: theme.bgPage }}>
        <button
          onClick={onTrack}
          className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent || theme.primary})` }}
        >
          <ExternalLink className="h-4 w-4" /> Acompanhar pedido
        </button>
      </div>
    </div>
  )
}
