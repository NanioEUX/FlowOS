const CACHE_NAME = "pedefacil-v20"

// Recursos críticos para offline
const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/favicon.svg",
  "/icons/pedefacil-login.png",
  "/icons/pedefacil-sidebar.png",
  "/icons/pedefacil-icon.svg",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Se havia cache de versão anterior, é um upgrade de versão: os clients
      // abertos estão rodando JS antigo, então força o reload deles. Na
      // primeira visita não há cache antigo → não recarrega ninguém.
      const oldCaches = cacheNames.filter((name) => name !== CACHE_NAME)
      const cleanup = Promise.all(oldCaches.map((name) => caches.delete(name)))
      return cleanup.then(() => oldCaches.length > 0)
    }).then((wasUpgrade) => {
      return self.clients.claim().then(() => {
        if (!wasUpgrade) return
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            try {
              client.navigate(client.url)
            } catch {}
          })
        })
      })
    })
  )
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // APIs e assets Next: nunca cachear
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(event.request))
    return
  }

  // Navegação (páginas): network-first com fallback pro cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Imagens: cache-first
  if (event.request.destination === "image") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) return response
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
          return response
        })
      })
    )
    return
  }

  // Outros assets estáticos: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response
        }
        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })
        return response
      })
      return cached || fetchPromise
    })
  )
})

self.addEventListener("push", (event) => {
  let data = { title: "Seu pedido", body: "Nova notificação", url: "/" }
  let rawPayload = null
  try {
    if (event.data) {
      rawPayload = event.data.text()
      data = JSON.parse(rawPayload)
    } else {
      console.warn("[SW push] event.data é NULL - payload não entregue ao dispositivo")
    }
  } catch (e) {
    console.warn("[SW push] Falha ao parsear payload:", e?.message, "raw:", rawPayload?.slice(0, 200))
  }

  const title = data.title || "Seu pedido"
  const body = data.body || ""
  const tag = data.tag || "push-" + Date.now()

  console.log(`[SW push] Recebido: title="${title}" body="${body?.slice(0, 100)}" url="${data.url}"`)

  // No iOS, o SO ignora o title do showNotification e usa o name do manifest.
  // Prefixar o body com o title faz o texto ficar enorme e ser truncado pelo OS.
  // Então no iOS mostramos só o body (que já contém as infos do pedido).
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const displayBody = isIOS && body ? body : (isAndroid && title && body ? `${title}\n${body}` : body)

  event.waitUntil(
    self.registration.showNotification(title, {
      body: displayBody,
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/icon-512.png",
      vibrate: [200, 100, 200],
      data: { url: data.url || "/", title, body, tag },
      actions: isIOS ? [] : [{ action: "open", title: "Ver pedido" }],
      tag,
      renotify: true,
    }).catch((e) => {
      console.warn("[SW push] showNotification falhou:", e?.message)
    })
  )

  // Notify all open PWA clients about the new push
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: "push-notification",
        title,
        body,
        url: data.url,
        tag,
      })
    })
  })
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // 1. Find a PWA standalone window first
      let target = clients.find((c) => c.url.includes(self.location.origin))
      // 2. If no PWA client, find any client
      if (!target) target = clients[0]
      if (target) {
        target.focus()
        target.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})

// Subscription expirou/regenerou: pede para os clients re-registrarem
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "push-subscription-change" }))
    })
  )
})
