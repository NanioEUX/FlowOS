import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const establishment = await prisma.establishment.findUnique({
    where: { slug: params.slug },
    select: { name: true, primaryColor: true, logo: true },
  })

  if (!establishment) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const themeColor = establishment.primaryColor || "#1E7BFF"
  const slugPath = `/${params.slug}`
  const iconPath = `/api/icon/${params.slug}`

  const manifest = {
    name: establishment.name,
    short_name: establishment.name,
    description: `Cardápio digital de ${establishment.name}`,
    start_url: slugPath,
    scope: slugPath,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: themeColor,
    categories: ["food", "lifestyle", "shopping"],
    icons: [
      { src: `${iconPath}?size=192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${iconPath}?size=512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${iconPath}?size=512&mask=1`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Cardápio",
        short_name: "Cardápio",
        url: slugPath,
        icons: [{ src: `${iconPath}?size=192`, sizes: "192x192" }],
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
    },
  })
}

