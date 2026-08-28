import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

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
