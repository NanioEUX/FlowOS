"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function KdsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("kds_token")
    const user = localStorage.getItem("kds_user")

    if (!token || !user) {
      router.push("/kds")
      return
    }

    try {
      const parsed = JSON.parse(user)
      if (parsed.role !== "kds") {
        router.push("/kds")
        return
      }
    } catch {
      router.push("/kds")
      return
    }

    setAuthorized(true)
  }, [router])

  if (!authorized) return null

  return <>{children}</>
}
