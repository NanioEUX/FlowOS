import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { buscarEstimativa99 } from "@/lib/integrations/nine-nine"

/**
 * Calcula distância (Haversine), taxa de entrega e tempo estimado.
 *
 * GET /api/delivery/calculate?est=X&lat=Y&lng=Z
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const establishmentId = url.searchParams.get("est")
  const lat = parseFloat(url.searchParams.get("lat") || "")
  const lng = parseFloat(url.searchParams.get("lng") || "")

  if (!establishmentId || isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  }

  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: {
      id: true,
      addressLat: true,
      addressLng: true,
      deliveryRadiusKm: true,
      tipoEntregaAtiva: true,
      api99Key: true,
      api99EmployeeId: true,
      deliveryZones: {
        where: { enabled: true },
        orderBy: { order: "asc" },
      },
    },
  })

  if (!establishment || establishment.addressLat == null || establishment.addressLng == null) {
    return NextResponse.json({
      available: false,
      reason: "Estabelecimento sem localização configurada",
    })
  }

  // ── Modo 99Entrega: busca estimativa na API externa ──
  if (establishment.tipoEntregaAtiva === "99entrega" && establishment.api99Key && establishment.api99EmployeeId) {
    const estimativa = await buscarEstimativa99(
      establishment.api99Key,
      establishment.api99EmployeeId,
      establishment.addressLat,
      establishment.addressLng,
      lat,
      lng
    )

    if (!estimativa.success) {
      return NextResponse.json({
        available: false,
        reason: estimativa.error || "Erro ao consultar 99Entrega",
      })
    }

    return NextResponse.json({
      available: true,
      distanceKm: null,
      fee: estimativa.estimatedValue || 0,
      estimatedMin: estimativa.estimatedTime || 30,
      zoneName: "99Entrega",
      freeAbove: null,
      provedor: "99entrega",
    })
  }

  // ── Modo Entrega Própria: lógica Haversine existente (INALTERADA) ──

  const distanceKm = haversineKm(
    lat, lng,
    establishment.addressLat, establishment.addressLng
  )

  const maxRadius = establishment.deliveryRadiusKm || 8

  if (distanceKm > maxRadius) {
    return NextResponse.json({
      available: false,
      distanceKm: Math.round(distanceKm * 10) / 10,
      reason: `Fora do raio de entrega (${maxRadius}km)`,
    })
  }

  // Acha a zona que cobre essa distância
  const zone = establishment.deliveryZones.find(
    (z) => distanceKm >= z.minKm && distanceKm <= z.maxKm
  )

  if (!zone) {
    // Sem zona configurada pra essa distância: usa taxa base
    return NextResponse.json({
      available: true,
      distanceKm: Math.round(distanceKm * 10) / 10,
      fee: 0,
      estimatedMin: 30,
      zoneName: "Padrão",
      freeAbove: null,
    })
  }

  return NextResponse.json({
    available: true,
    distanceKm: Math.round(distanceKm * 10) / 10,
    fee: zone.fee,
    estimatedMin: zone.estimatedMin,
    zoneName: zone.name,
    freeAbove: zone.freeAbove,
  })
}

/** Fórmula de Haversine — distância em km entre 2 pontos lat/lng */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // raio da Terra em km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}
