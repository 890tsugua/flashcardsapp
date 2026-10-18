// Progress and settings live in the browser's localStorage, one entry per deck.
import { GRADES, State, type CardProgress } from './srs'

export interface DayStats {
  reviews: number
  newCards: number
  fails: number
}

export interface DeckProgress {
  cards: Record<string, CardProgress>
  /** Per study day ("2026-10-18"), used for the daily new-card limit and history. */
  days: Record<string, DayStats>
  lastStudied?: number
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  newPerDay: number
  defaultRoundSize: number
  roundSize: Record<string, number>
  autoplay: boolean
  speechRate: number
  /** Chosen voice per language prefix, e.g. { el: "com.apple.voice.compact.el-GR.Melina" } */
  voiceByLang: Record<string, string>
  theme: Theme
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 20,
  defaultRoundSize: 20,
  roundSize: {},
  autoplay: true,
  speechRate: 0.9,
  voiceByLang: {},
  theme: 'system',
}

export function emptyProgress(): DeckProgress {
  return { cards: {}, days: {} }
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  readonly length: number
  key(index: number): string | null
}

const PREFIX = 'flashcards:'
const SETTINGS_KEY = `${PREFIX}settings`
const PROGRESS_PREFIX = `${PREFIX}progress:`

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const NUMBER_FIELDS = [
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
] as const

function parseCardProgress(raw: unknown): CardProgress | undefined {
  if (!isObject(raw)) return undefined
  for (const field of NUMBER_FIELDS) if (typeof raw[field] !== 'number' || !Number.isFinite(raw[field])) return undefined
  if (![State.New, State.Learning, State.Review, State.Relearning].includes(raw.state as State)) return undefined
  if (!GRADES.includes(raw.lastRating as never)) return undefined
  if (raw.last_review !== undefined && typeof raw.last_review !== 'number') return undefined
  return raw as unknown as CardProgress
}

function parseDayStats(raw: unknown): DayStats {
  const r = isObject(raw) ? raw : {}
  const n = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : 0)
  return { reviews: n(r.reviews), newCards: n(r.newCards), fails: n(r.fails) }
}

/** Accepts stored or imported progress, dropping anything malformed. */
export function parseDeckProgress(raw: unknown): DeckProgress {
  const progress = emptyProgress()
  if (!isObject(raw)) return progress
  if (isObject(raw.cards)) {
    for (const [id, card] of Object.entries(raw.cards)) {
      const parsed = parseCardProgress(card)
      if (parsed) progress.cards[id] = parsed
    }
  }
  if (isObject(raw.days)) {
    for (const [day, stats] of Object.entries(raw.days)) progress.days[day] = parseDayStats(stats)
  }
  if (typeof raw.lastStudied === 'number') progress.lastStudied = raw.lastStudied
  return progress
}

export function parseSettings(raw: unknown): Settings {
  const r = isObject(raw) ? raw : {}
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && v >= min && v <= max ? v : fallback
  const record = <T>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> =>
    isObject(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => ok(x))) as Record<string, T> : {}
  return {
    newPerDay: num(r.newPerDay, 0, 9999, DEFAULT_SETTINGS.newPerDay),
    defaultRoundSize: num(r.defaultRoundSize, 1, 999, DEFAULT_SETTINGS.defaultRoundSize),
    roundSize: record(r.roundSize, (x): x is number => typeof x === 'number' && x >= 1),
    autoplay: typeof r.autoplay === 'boolean' ? r.autoplay : DEFAULT_SETTINGS.autoplay,
    speechRate: num(r.speechRate, 0.5, 1.5, DEFAULT_SETTINGS.speechRate),
    voiceByLang: record(r.voiceByLang, (x): x is string => typeof x === 'string'),
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'system',
  }
}

function readJson(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function loadSettings(store: KeyValueStore): Settings {
  return parseSettings(readJson(store, SETTINGS_KEY))
}

export function saveSettings(store: KeyValueStore, settings: Settings): void {
  store.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadAllProgress(store: KeyValueStore): Record<string, DeckProgress> {
  const all: Record<string, DeckProgress> = {}
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key?.startsWith(PROGRESS_PREFIX)) all[key.slice(PROGRESS_PREFIX.length)] = parseDeckProgress(readJson(store, key))
  }
  return all
}

export function saveDeckProgress(store: KeyValueStore, deckId: string, progress: DeckProgress): void {
  store.setItem(PROGRESS_PREFIX + deckId, JSON.stringify(progress))
}

export function removeDeckProgress(store: KeyValueStore, deckId: string): void {
  store.removeItem(PROGRESS_PREFIX + deckId)
}

export function isAppStorageKey(key: string | null): boolean {
  return key === null || key.startsWith(PREFIX)
}

// ---- Backups ----

export interface Backup {
  app: 'flashcardsapp'
  version: 1
  exportedAt: string
  settings: Settings
  progress: Record<string, DeckProgress>
}

export function makeBackup(settings: Settings, progress: Record<string, DeckProgress>, now: Date): Backup {
  return { app: 'flashcardsapp', version: 1, exportedAt: now.toISOString(), settings, progress }
}

export function parseBackup(raw: unknown): Backup | { error: string } {
  if (!isObject(raw) || raw.app !== 'flashcardsapp' || !isObject(raw.progress)) {
    return { error: 'This file is not a Flashcards backup.' }
  }
  if (raw.version !== 1) return { error: `Unsupported backup version: ${String(raw.version)}.` }
  const progress: Record<string, DeckProgress> = {}
  for (const [deckId, deck] of Object.entries(raw.progress)) progress[deckId] = parseDeckProgress(deck)
  return {
    app: 'flashcardsapp',
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    settings: parseSettings(raw.settings),
    progress,
  }
}

/** In-memory stand-in when localStorage is unavailable, and for tests. */
export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}
