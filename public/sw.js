const CACHE_NAME = "pedefacil-v11"

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
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
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
  let data = { title: "FlowOS", body: "Nova notificação", url: "/" }
  try {
    data = JSON.parse(event.data.text())
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/icon-512.png",
      vibrate: [200, 100, 200],
      data: { url: data.url, title: data.title, body: data.body, tag: data.tag },
      actions: [{ action: "open", title: "Ver pedido" }],
      tag: data.tag,
      renotify: true,
    })
  )

  // Notify all open PWA clients about the new push
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: "push-notification",
        title: data.title,
        body: data.body,
        url: data.url,
        tag: data.tag,
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

