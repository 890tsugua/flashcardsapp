// App-wide state (settings + progress for every deck), written through to localStorage.
import { useSyncExternalStore } from 'react'
import { isNew, Rating, type CardProgress, type Grade } from './srs'
import {
  emptyProgress,
  isAppStorageKey,
  loadAllProgress,
  loadSettings,
  makeBackup,
  MemoryStore,
  removeDeckProgress,
  saveDeckProgress,
  saveSettings,
  type Backup,
  type DayStats,
  type DeckProgress,
  type KeyValueStore,
  type Settings,
} from './storage'
import { dayKey } from './time'

export interface AppState {
  settings: Settings
  progress: Record<string, DeckProgress>
  /** Set when progress can't be saved (blocked or full storage). */
  storageProblem?: string
}

function openStorage(): { store: KeyValueStore; problem?: string } {
  try {
    const probe = 'flashcards:probe'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return { store: window.localStorage }
  } catch {
    return {
      store: new MemoryStore(),
      problem: 'This browser is blocking storage, so progress will be lost when you close the page.',
    }
  }
}

const opened = openStorage()
const storage = opened.store

let state: AppState = {
  settings: loadSettings(storage),
  progress: loadAllProgress(storage),
  storageProblem: opened.problem,
}
const listeners = new Set<() => void>()

function setState(next: AppState) {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getState(): AppState {
  return state
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState)
}

// Keep tabs in sync: another tab studying the same deck updates this one.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== window.localStorage || !isAppStorageKey(event.key)) return
    setState({ ...state, settings: loadSettings(storage), progress: loadAllProgress(storage) })
  })
}

function write(action: () => void): string | undefined {
  try {
    action()
    return undefined
  } catch {
    return 'Your progress could not be saved. Storage may be full; export a backup from Settings.'
  }
}

const EMPTY = emptyProgress()

export function deckProgress(app: AppState, deckId: string): DeckProgress {
  return app.progress[deckId] ?? EMPTY
}

function putDeckProgress(deckId: string, progress: DeckProgress) {
  const problem = write(() => saveDeckProgress(storage, deckId, progress))
  setState({ ...state, progress: { ...state.progress, [deckId]: progress }, storageProblem: problem ?? state.storageProblem })
}

export interface UndoEntry {
  deckId: string
  cardId: string
  previous: CardProgress | undefined
  day: string
  previousDay: DayStats | undefined
  previousLastStudied: number | undefined
}

export function recordAnswer(deckId: string, cardId: string, grade: Grade, next: CardProgress, now: Date): UndoEntry {
  const current = deckProgress(state, deckId)
  const previous = current.cards[cardId]
  const day = dayKey(now)
  const stats = current.days[day] ?? { reviews: 0, newCards: 0, fails: 0 }
  putDeckProgress(deckId, {
    cards: { ...current.cards, [cardId]: next },
    days: {
      ...current.days,
      [day]: {
        reviews: stats.reviews + 1,
        newCards: stats.newCards + (isNew(previous) ? 1 : 0),
        fails: stats.fails + (grade === Rating.Again ? 1 : 0),
      },
    },
    lastStudied: now.getTime(),
  })
  return { deckId, cardId, previous, day, previousDay: current.days[day], previousLastStudied: current.lastStudied }
}

export function undoAnswer(entry: UndoEntry) {
  const current = deckProgress(state, entry.deckId)
  const cards = { ...current.cards }
  if (entry.previous) cards[entry.cardId] = entry.previous
  else delete cards[entry.cardId]
  const days = { ...current.days }
  if (entry.previousDay) days[entry.day] = entry.previousDay
  else delete days[entry.day]
  putDeckProgress(entry.deckId, { cards, days, lastStudied: entry.previousLastStudied })
}

export function resetDeck(deckId: string) {
  const problem = write(() => removeDeckProgress(storage, deckId))
  const progress = { ...state.progress }
  delete progress[deckId]
  setState({ ...state, progress, storageProblem: problem ?? state.storageProblem })
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch }
  const problem = write(() => saveSettings(storage, settings))
  setState({ ...state, settings, storageProblem: problem ?? state.storageProblem })
}

export function exportBackup(now = new Date()): Backup {
  return makeBackup(state.settings, state.progress, now)
}

/** Replaces all settings and progress with the backup's. */
export function restoreBackup(backup: Backup) {
  const problem = write(() => {
    for (const deckId of Object.keys(state.progress)) removeDeckProgress(storage, deckId)
    for (const [deckId, progress] of Object.entries(backup.progress)) saveDeckProgress(storage, deckId, progress)
    saveSettings(storage, backup.settings)
  })
  setState({ settings: backup.settings, progress: backup.progress, storageProblem: problem })
}

/** Asks the browser not to evict our data under storage pressure. Safe to call repeatedly. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
