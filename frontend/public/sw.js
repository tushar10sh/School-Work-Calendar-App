// BUILD_TIME is replaced with Date.now() by the Vite build plugin on each build.
// A different byte causes the browser to detect a new SW version automatically.
const BUILD_TIME = '__BUILD_TIME__'
const CACHE_NAME = `school-planner-${BUILD_TIME}`

// ── Install ──────────────────────────────────────────────────────────────────
// Activate immediately without waiting for existing tabs to close.
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────
// Delete stale caches from old builds, claim all open tabs, then signal them.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('school-planner-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then((clientList) => {
          clientList.forEach((client) =>
            client.postMessage({ type: 'APP_UPDATED', buildTime: BUILD_TIME })
          )
        })
      )
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept API calls or SSE streams — always go straight to network.
  if (url.pathname.startsWith('/api/')) return

  // Navigation requests (HTML): network-first so a new build is picked up
  // immediately; fall back to cache only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Static assets (JS, CSS, fonts, images): cache-first for speed.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, clone))
        }
        return response
      })
    })
  )
})
