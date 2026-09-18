"use client"

import { CheckCircle, Gift, Sparkles, ArrowRight, MapPin, Clock, MessageCircle } from "lucide-react"

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
  establishmentName: string
  orderNumber?: number
  items: ConfirmationItem[]
  subtotal: number
  deliveryFee: number
  deliveryFeeType?: string
  couponDiscount: number
  firstPurchaseDiscount: number
  firstPurchaseBonus: number
  loyaltyDiscount: number
  total: number
  showLoyalty: boolean
  cashEarned: number
  cashbackBase?: number
  tierBonus?: number
  tierName?: string
  tierEmoji?: string
  loyaltyBalance: number
  maxRedeemPercent?: number
  orderType?: string
  deliveryCode?: string | null
  deliveryAddress?: string | null
  establishmentAddress?: string | null
  estimatedDeliveryMin?: number
  estimatedDeliveryMax?: number
  whatsappPhone?: string
  onTrack: () => void
  onContinue: () => void
}

export function OrderConfirmationScreen({
  theme,
  title,
  establishmentName,
  orderNumber,
  items,
  subtotal,
  deliveryFee,
  deliveryFeeType,
  couponDiscount,
  firstPurchaseDiscount,
  firstPurchaseBonus,
  loyaltyDiscount,
  total,
  showLoyalty,
  cashEarned,
  cashbackBase,
  tierBonus,
  tierName,
  tierEmoji,
  loyaltyBalance,
  maxRedeemPercent,
  orderType,
  deliveryCode,
  deliveryAddress,
  establishmentAddress,
  estimatedDeliveryMin,
  estimatedDeliveryMax,
  whatsappPhone,
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
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-4">
        <div className="mx-auto w-full max-w-lg">
          {/* Header */}
          <div className="mb-6 text-center">
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
            {orderType === "delivery" && estimatedDeliveryMin && estimatedDeliveryMax && (
              <p className="text-sm mt-2 flex items-center justify-center gap-1.5" style={{ color: theme.textMuted }}>
                <Clock className="h-3.5 w-3.5" />
                Previsão: {estimatedDeliveryMin} a {estimatedDeliveryMax} min
              </p>
            )}
            {deliveryCode && (
              <p className="text-sm mt-1.5 font-semibold tracking-wider" style={{ color: theme.text }}>
                Código {deliveryCode}
              </p>
            )}
          </div>

          {/* Order summary - RECEIPT STYLE */}
          <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
            <h3 className="font-semibold text-sm mb-3" style={{ color: theme.text }}>Descrição</h3>

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
              {deliveryFee > 0 ? (
                <div className="flex justify-between text-sm" style={{ color: theme.textMuted }}>
                  <span>Entrega</span><span>{fmt(deliveryFee)}</span>
                </div>
              ) : orderType === "delivery" && deliveryFeeType === "free_above" ? (
                <div className="flex justify-between text-sm" style={{ color: theme.success }}>
                  <span>Entrega</span><span>Grátis</span>
                </div>
              ) : null}
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
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm" style={{ color: theme.success }}>
                  <span>Desconto (cashback)</span><span>-{fmt(loyaltyDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1" style={{ color: theme.text }}>
                <span>Total</span>
                <span style={{ color: theme.success }}>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {orderType === "delivery" && deliveryAddress && (
            <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4" style={{ color: theme.primary }} />
                <span className="text-xs font-medium" style={{ color: theme.textSubtle }}>Endereço da entrega</span>
              </div>
              {(() => {
                const parts = deliveryAddress.split(" - ")
                return parts.length > 1 ? (
                  <div>
                    <p className="text-sm font-semibold" style={{ color: theme.text }}>{parts[0]}</p>
                    <p className="text-xs" style={{ color: theme.textMuted }}>{parts.slice(1).join(" - ")}</p>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: theme.text }}>{deliveryAddress}</p>
                )
              })()}
            </div>
          )}

          {/* Pickup Address */}
          {orderType === "pickup" && establishmentAddress && (
            <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.borderCard}` }}>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4" style={{ color: theme.primary }} />
                <span className="text-xs font-medium" style={{ color: theme.textSubtle }}>Retirar no local</span>
              </div>
              <p className="text-sm" style={{ color: theme.text }}>{establishmentAddress}</p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(establishmentAddress || "")}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline mt-1 inline-block" style={{ color: theme.primary }}>
                Abrir no Maps
              </a>
            </div>
          )}

          {/* Delivery Code — moved to header */}

          {/* Cashback earned */}
          {showLoyalty && cashEarned > 0 && (
            <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: `${theme.success}10`, border: `1px solid ${theme.success}20` }}>
              <div className="flex items-center gap-2 mb-1">
                <Gift className="h-5 w-5" style={{ color: theme.success }} />
                <p className="text-sm font-bold" style={{ color: theme.success }}>Cashback ganho</p>
              </div>
              <div className="ml-7 space-y-0.5">
                {cashbackBase != null && (
                  <p className="text-xs" style={{ color: theme.textMuted }}>Base: +R$ {(cashbackBase / 100).toFixed(2)}</p>
                )}
                {tierBonus != null && tierBonus > 0 && tierName && (
                  <p className="text-xs" style={{ color: theme.textMuted }}>{tierEmoji} {tierName}: +R$ {(tierBonus / 100).toFixed(2)}</p>
                )}
                <p className="text-xs font-bold" style={{ color: theme.success }}>Total: +R$ {(cashEarned / 100).toFixed(2)}</p>
                <p className="text-xs" style={{ color: theme.textMuted }}>Saldo: R$ {((loyaltyBalance / 100) - loyaltyDiscount + (cashEarned / 100)).toFixed(2)}</p>
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
      <div className="flex-shrink-0 px-4 pt-3 pb-4 space-y-2" style={{ borderTop: `1px solid ${theme.borderCard}`, paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))", backgroundColor: theme.bgPage }}>
        <button
          onClick={onTrack}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent || theme.primary})` }}
        >
          Acompanhar pedido <ArrowRight className="h-4 w-4" />
        </button>
        {whatsappPhone && (
          <a
            href={`https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Preciso de ajuda com meu pedido Nº ${orderNumber || ""}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-2xl text-xs font-medium flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ color: theme.textMuted, border: `1px solid ${theme.borderCard}` }}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Precisa de ajuda?
          </a>
        )}
      </div>
    </div>
  )
}
