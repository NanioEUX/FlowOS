export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-zinc-900 mb-2">{title}</h1>
      <p className="text-zinc-500 mb-6">Em construção.</p>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
        Esta página será implementada nos próximos módulos. O CRUD básico de Respostas Rápidas e Templates já está funcional.
      </div>
    </div>
  )
}
