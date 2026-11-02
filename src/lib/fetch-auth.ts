export function getToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem("pedefacil-user")
    if (!stored) return null
    const data = JSON.parse(stored)
    return data.token || null
  } catch {
    return null
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem("pedefacil-user")
    if (!stored) return null
    const data = JSON.parse(stored)
    return data.refreshToken || null
  } catch {
    return null
  }
}

export function saveTokens(token: string, refreshToken: string): void {
  if (typeof window === "undefined") return
  try {
    const stored = localStorage.getItem("pedefacil-user")
    if (!stored) return
    const data = JSON.parse(stored)
    data.token = token
    data.refreshToken = refreshToken
    localStorage.setItem("pedefacil-user", JSON.stringify(data))
  } catch {}
}

// F8B-008: o redirect era bruto (sem motivo) — o operador achava que tinha sido
// deslogado. O motivo viaja na URL e a tela de login explica.
export function clearAuth(reason: "expired" | "manual" = "expired"): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("pedefacil-user")
  const params = new URLSearchParams()
  params.set("reason", reason)
  window.location.href = `/login?${params.toString()}`
}

let refreshPromise: Promise<string | null> | null = null

async function tryRefreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return null

    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })

      if (!res.ok) return null

      const data = await res.json()
      saveTokens(data.token, data.refreshToken)
      return data.token
    } catch {
      return null
    }
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

export async function fetchAuth(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const res = await fetch(input, { ...init, headers, cache: "no-store" })

  if (res.status === 401) {
    const newToken = await tryRefreshToken()
    if (newToken) {
      const retryHeaders = new Headers(init?.headers)
      retryHeaders.set("Authorization", `Bearer ${newToken}`)
      return fetch(input, { ...init, headers: retryHeaders, cache: "no-store" })
    } else {
      clearAuth("expired")
    }
  }

  return res
}
