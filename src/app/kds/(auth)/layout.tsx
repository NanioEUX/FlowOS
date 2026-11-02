"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function KdsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    // Check KDS token first
    const kdsToken = localStorage.getItem("kds_token")
    const kdsUser = localStorage.getItem("kds_user")

    if (kdsToken && kdsUser) {
      try {
        const parsed = JSON.parse(kdsUser)
        if (parsed.role === "kds") {
          setAuthorized(true)
          return
        }
      } catch {}
    }

    // Check main user token (admin opening KDS from dashboard)
    const mainUser = localStorage.getItem("pedefacil-user")
    if (mainUser) {
      try {
        const parsed = JSON.parse(mainUser)
        if (parsed.role === "admin" || parsed.role === "kds") {
          // Store as kds_token so the screen page can use it
          localStorage.setItem("kds_token", parsed.token)
          localStorage.setItem("kds_user", JSON.stringify(parsed))
          if (parsed.establishment) {
            localStorage.setItem("kds_establishment", JSON.stringify(parsed.establishment))
          }
          setAuthorized(true)
          return
        }
      } catch {}
    }

    router.push("/kds")
  }, [router])

  // F8B-018: renderizar `null` causava flash de tela branca antes do redirect.
  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return <>{children}</>
}
