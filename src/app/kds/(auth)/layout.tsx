"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function KdsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
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
          localStorage.setItem("kds_establishment", JSON.stringify(parsed.establishment))
          setAuthorized(true)
          return
        }
      } catch {}
    }

    router.push("/kds")
  }, [router])

  if (!authorized) return null

  return <>{children}</>
}
