export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
        <p className="text-sm text-zinc-400">Carregando...</p>
      </div>
    </div>
  )
}
