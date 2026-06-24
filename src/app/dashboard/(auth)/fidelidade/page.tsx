import { Suspense } from "react"
import FidelidadePageContent from "./page-content"

export default function FidelidadePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>}>
      <FidelidadePageContent />
    </Suspense>
  )
}
