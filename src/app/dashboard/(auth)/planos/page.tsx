import { Suspense } from "react"
import PlanosPageContent from "./page-content"

export default function PlanosPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" /></div>}>
      <PlanosPageContent />
    </Suspense>
  )
}
