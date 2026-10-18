import { parseDeck, type Deck, type DeckLoadResult } from './deck'

// Every JSON file in /decks is bundled at build time, so adding a deck is just adding a file.
const files = import.meta.glob<unknown>('/decks/*.json', { eager: true, import: 'default' })

function loadAll(): DeckLoadResult[] {
  const results = Object.entries(files).map(([path, raw]) =>
    parseDeck(raw, path.replace(/^.*\//, '').replace(/\.json$/, '')),
  )
  const ids = new Set<string>()
  for (const result of results) {
    if (!result.deck) continue
    if (ids.has(result.deck.id)) {
      result.errors.push(`Another deck already uses the id "${result.deck.id}".`)
      result.deck = undefined
    } else {
      ids.add(result.deck.id)
    }
  }
  return results.sort((a, b) => (a.deck?.name ?? a.file).localeCompare(b.deck?.name ?? b.file))
}

export const deckResults = loadAll()
export const decks: Deck[] = deckResults.flatMap((r) => (r.deck ? [r.deck] : []))

export function getDeck(id: string): Deck | undefined {
  return decks.find((d) => d.id === id)
}
