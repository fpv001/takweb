const CACHE_NAME = 'tak-app-v3'
const STATIC_ASSETS = ['/admin/', '/admin/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Only cache successful, non-partial responses
        if (res.ok && res.status === 200 && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // SPA fallback: serve the app shell for navigations when offline
        if (request.mode === 'navigate') return caches.match('/admin/index.html')
        return Response.error()
      })
  )
})
