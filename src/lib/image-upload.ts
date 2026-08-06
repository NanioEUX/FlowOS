import sharp from "sharp"
import { supabase } from "./supabase"

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const MAX_WIDTH = 1200
const WEBP_QUALITY = 80

export async function compressAndUploadImage(file: File): Promise<{ url: string; error?: string }> {
  if (!supabase) {
    return { url: "", error: "Supabase Storage não configurado" }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { url: "", error: `Imagem muito grande. Máximo: ${MAX_SIZE_BYTES / 1024 / 1024}MB` }
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const compressed = await sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`

    const { data, error } = await supabase.storage
      .from("images")
      .upload(fileName, compressed, {
        contentType: "image/webp",
        cacheControl: "31536000",
      })

    if (error) {
      return { url: "", error: error.message }
    }

    const { data: urlData } = supabase.storage.from("images").getPublicUrl(data.path)
    return { url: urlData.publicUrl }
  } catch (err: any) {
    return { url: "", error: err.message || "Erro ao processar imagem" }
  }
}
