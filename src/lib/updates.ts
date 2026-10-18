// The service worker shows the saved copy of the app first (so it works offline) and downloads a
// new version in the background. When that new version takes over, reload so new decks and fixes
// appear right away, but never in the middle of a study round.

function inRound(): boolean {
  return window.location.hash.includes('/study')
}

export function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
  const base = import.meta.env.BASE_URL

  // On the very first visit the worker also takes control, but there is nothing newer to show then.
  let controlled = navigator.serviceWorker.controller !== null
  let updateReady = false
  const reloadIfIdle = () => {
    if (updateReady && !inRound()) window.location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true
      return
    }
    updateReady = true
    reloadIfIdle()
  })
  window.addEventListener('hashchange', reloadIfIdle)

  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base })
    .then((registration) => {
      // A Home Screen app can stay open for days, so also look for a new version whenever it comes back into view.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {})
      })
    })
    .catch(() => {})
}
