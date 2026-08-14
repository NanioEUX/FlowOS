import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

/**
 * Retorna o ícone PWA dinâmico do estabelecimento.
 * - Se tem logo: serve a imagem diretamente (proxy)
 * - Se não tem: serve fallback FlowOS
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const establishment = await prisma.establishment.findUnique({
    where: { slug: params.slug },
    select: { logo: true, name: true, primaryColor: true },
  })

  if (!establishment?.logo) {
    return serveFallback()
  }

  const logo = establishment.logo
  let buffer: Buffer | null = null
  let contentType = "image/png"

  try {
    if (logo.startsWith("data:")) {
      // Data URI base64 (logo enviada sem upload). Decodifica e serve direto.
      const commaIdx = logo.indexOf(",")
      const meta = logo.slice(5, commaIdx)
      const b64 = logo.slice(commaIdx + 1)
      if (meta.includes(";base64")) {
        buffer = Buffer.from(b64, "base64")
      } else {
        buffer = Buffer.from(decodeURIComponent(b64), "utf8")
      }
      const m = meta.match(/^image\/([\w.+-]+)/)
      contentType = m ? `image/${m[1]}` : "image/png"
    } else if (logo.startsWith("http")) {
      // URL externa: busca e faz proxy
      const res = await fetch(logo)
      if (!res.ok) throw new Error("fetch failed")
      buffer = Buffer.from(await res.arrayBuffer())
      contentType = res.headers.get("content-type") || "image/png"
    } else if (logo.startsWith("/")) {
      // Caminho local em /public
      const filePath = path.join(process.cwd(), "public", logo)
      buffer = await readFile(filePath)
      if (logo.endsWith(".svg")) contentType = "image/svg+xml"
      else if (logo.endsWith(".jpg") || logo.endsWith(".jpeg")) contentType = "image/jpeg"
      else if (logo.endsWith(".webp")) contentType = "image/webp"
    } else {
      throw new Error("invalid logo path")
    }
  } catch (e) {
    console.warn(`[Icon] falha ao carregar logo ${logo}:`, e)
    return serveFallback()
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, immutable",
    },
  })
}

function serveFallback() {
  return NextResponse.redirect(new URL("/icons/icon-192.png", process.env.NEXT_PUBLIC_APP_URL || "https://flowoshub.com"))
}
