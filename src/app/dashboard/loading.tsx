export default function DashboardLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
        <p className="text-sm text-zinc-400">Carregando painel...</p>
      </div>
    </div>
  )
}
