import { useEffect } from 'react'
import { SettingsIcon } from './components/Icons'
import { getDeck } from './lib/decks'
import { useAppState } from './lib/store'
import { DeckPage } from './pages/DeckPage'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'
import { StudyPage } from './pages/StudyPage'
import { hrefFor, useRoute, type Route } from './router'

function NotFound({ what }: { what: string }) {
  return (
    <div className="panel empty-state">
      <h1>{what} not found</h1>
      <div className="row">
        <a className="btn" href={hrefFor({ page: 'home' })}>
          Go to your decks
        </a>
      </div>
    </div>
  )
}

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case 'home':
      return <HomePage />
    case 'settings':
      return <SettingsPage />
    case 'deck': {
      const deck = getDeck(route.deckId)
      return deck ? <DeckPage key={deck.id} deck={deck} /> : <NotFound what="Deck" />
    }
    case 'study': {
      const deck = getDeck(route.deckId)
      return deck ? <StudyPage key={`${deck.id}:${route.mode}`} deck={deck} mode={route.mode} /> : <NotFound what="Deck" />
    }
    case 'not-found':
      return <NotFound what="Page" />
  }
}

export function App() {
  const route = useRoute()
  const { settings, storageProblem } = useAppState()

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = settings.theme
  }, [settings.theme])

  return (
    <>
      <header className="app-header">
        <a className="brand" href={hrefFor({ page: 'home' })}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          Flashcards
        </a>
        {route.page !== 'settings' && (
          <a className="icon-btn" href={hrefFor({ page: 'settings' })} aria-label="Settings" title="Settings">
            <SettingsIcon />
          </a>
        )}
      </header>
      <main className="app-main">
        {storageProblem && <div className="notice">{storageProblem}</div>}
        <Page route={route} />
      </main>
    </>
  )
}
