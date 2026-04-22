import { useEffect, useState } from 'react'

export function useServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Capture whether a SW was already controlling this page before registration.
    // controllerchange fires on first install too, so we use this flag to
    // distinguish "first install" (hadController=false) from "update" (true).
    const hadController = !!navigator.serviceWorker.controller

    let refreshing = false
    function onControllerChange() {
      if (hadController && !refreshing) {
        refreshing = true
        setUpdateReady(true)
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Poll for updates every 60 s so long-running tabs also pick up changes.
        setInterval(() => reg.update(), 60_000)
      })
      .catch((err) => console.warn('SW registration failed:', err))

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return { updateReady }
}
