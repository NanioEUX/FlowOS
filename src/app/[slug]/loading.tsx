export default function SlugLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[#FF6B35]" />
        <p className="text-sm text-white/40">Carregando cardápio...</p>
      </div>
    </div>
  )
}
