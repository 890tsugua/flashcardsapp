import { describe, expect, it } from 'vitest'
import { Rating, review } from './srs'
import {
  DEFAULT_SETTINGS,
  loadAllProgress,
  loadSettings,
  makeBackup,
  MemoryStore,
  parseBackup,
  saveDeckProgress,
  saveSettings,
  type DeckProgress,
} from './storage'

const now = new Date(2026, 9, 18, 12, 0, 0)

describe('storage', () => {
  it('round-trips progress and settings', () => {
    const store = new MemoryStore()
    const progress: DeckProgress = {
      cards: { 'νερό': review(undefined, Rating.Good, now) },
      days: { '2026-10-18': { reviews: 1, newCards: 1, fails: 0 } },
      lastStudied: now.getTime(),
    }
    saveDeckProgress(store, 'greek-basics', progress)
    saveSettings(store, { ...DEFAULT_SETTINGS, newPerDay: 7 })
    store.setItem('unrelated', 'x')

    expect(loadAllProgress(store)).toEqual({ 'greek-basics': progress })
    expect(loadSettings(store).newPerDay).toBe(7)
  })

  it('falls back to defaults on corrupt data', () => {
    const store = new MemoryStore()
    store.setItem('flashcards:settings', '{not json')
    store.setItem('flashcards:progress:d', JSON.stringify({ cards: { a: { due: 'soon' } } }))
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS)
    expect(loadAllProgress(store)).toEqual({ d: { cards: {}, days: {} } })
  })

  it('validates backups', () => {
    const progress = { d: { cards: { a: review(undefined, Rating.Easy, now) }, days: {} } }
    const backup = makeBackup(DEFAULT_SETTINGS, progress, now)
    expect(parseBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup)
    expect(parseBackup({ hello: 'world' })).toEqual({ error: 'This file is not a Flashcards backup.' })
  })
})
