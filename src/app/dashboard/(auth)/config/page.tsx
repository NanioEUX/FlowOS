import { Suspense } from "react"
import ConfigContent from "./page-content"

export default function ConfigPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    }>
      <ConfigContent />
    </Suspense>
  )
}
