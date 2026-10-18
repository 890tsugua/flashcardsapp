// Hash-based routes (#/deck/greek-basics) so the static GitHub Pages site needs no server rewrites.
import { useEffect, useState } from 'react'
import type { RoundMode } from './lib/round'

export type Route =
  | { page: 'home' }
  | { page: 'deck'; deckId: string }
  | { page: 'study'; deckId: string; mode: RoundMode }
  | { page: 'settings' }
  | { page: 'not-found' }

const MODES: RoundMode[] = ['normal', 'more-new', 'practice']

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts.length === 0) return { page: 'home' }
  if (parts[0] === 'settings' && parts.length === 1) return { page: 'settings' }
  if (parts[0] === 'deck' && parts.length === 2) return { page: 'deck', deckId: parts[1] }
  if (parts[0] === 'deck' && parts.length === 3 && parts[2] === 'study') {
    const mode = new URLSearchParams(query).get('mode') as RoundMode | null
    return { page: 'study', deckId: parts[1], mode: mode && MODES.includes(mode) ? mode : 'normal' }
  }
  return { page: 'not-found' }
}

export function hrefFor(route: Route): string {
  switch (route.page) {
    case 'home':
    case 'not-found':
      return '#/'
    case 'settings':
      return '#/settings'
    case 'deck':
      return `#/deck/${encodeURIComponent(route.deckId)}`
    case 'study':
      return `#/deck/${encodeURIComponent(route.deckId)}/study${route.mode === 'normal' ? '' : `?mode=${route.mode}`}`
  }
}

export function navigate(route: Route) {
  window.location.hash = hrefFor(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const update = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return route
}
