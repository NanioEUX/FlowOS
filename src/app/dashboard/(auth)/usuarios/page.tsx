"use client"

import { Suspense } from "react"
import UsuariosPage from "./page-content"

export default function Usuarios() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-flow-blue border-t-transparent" /></div>}>
      <UsuariosPage />
    </Suspense>
  )
}
