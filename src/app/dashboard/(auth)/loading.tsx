export default function AuthLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-white/[.03]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-flow-blue/20 border-t-green-600" />
        <p className="text-sm text-zinc-400">Carregando...</p>
      </div>
    </div>
  )
}
