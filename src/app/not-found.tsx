import Link from "next/link"
import { FileQuestion } from "lucide-react"

/**
 * F8B-003: `notFound()` era chamado em `[slug]` e `pedido/[id]` sem nenhuma
 * UI própria — o usuário caía na página 404 padrão do Next.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
        <FileQuestion aria-hidden="true" className="h-7 w-7 text-zinc-500" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Página não encontrada</h1>
        <p className="mt-1 max-w-md text-sm text-zinc-600">
          O endereço acessado não existe ou não está mais disponível.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
