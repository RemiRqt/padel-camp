const CACHE_NAME = 'padel-camp-v1'
const STATIC_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
]

// Install: pre-cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy:
// - API calls (supabase) → network only
// - Static assets → cache first, fallback network (and update cache)
// - Navigation → network first, fallback cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin API calls
  if (request.method !== 'GET') return
  if (url.hostname.includes('supabase')) return

  // Navigation requests: network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Static assets: cache first
  if (url.pathname.match(/\.(js|css|svg|png|woff2?|ttf)$/) || url.hostname.includes('fonts')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        }).catch(() => caches.match(request))
      })
    )
    return
  }
})
