// Picking the cards for a round, and the order they come up in during it.
import type { Deck } from './deck'
import { isNew, Rating, type CardProgress, type Grade } from './srs'
import type { DeckProgress } from './storage'
import { dayKey, endOfStudyDay, HOUR_MS } from './time'

/**
 * normal:   due cards first, then new cards within the daily limit
 * more-new: like normal, but ignores the daily new-card limit
 * practice: extra practice on already-learned cards that are not due yet, soonest first
 */
export type RoundMode = 'normal' | 'more-new' | 'practice'

export interface DeckStatus {
  due: number
  /** New cards you can still start today (daily limit applied). */
  newAvailable: number
  /** All cards never studied. */
  unseen: number
  learned: number
  newToday: number
}

export function dueCardIds(deck: Deck, progress: DeckProgress, now: Date): string[] {
  const cutoff = endOfStudyDay(now).getTime()
  return deck.cards
    .filter((c) => {
      const p = progress.cards[c.id]
      return !isNew(p) && p!.due < cutoff
    })
    .sort((a, b) => progress.cards[a.id].due - progress.cards[b.id].due)
    .map((c) => c.id)
}

export function newCardIds(deck: Deck, progress: DeckProgress): string[] {
  return deck.cards.filter((c) => isNew(progress.cards[c.id])).map((c) => c.id)
}

export function newCardsToday(progress: DeckProgress, now: Date): number {
  return progress.days[dayKey(now)]?.newCards ?? 0
}

export function deckStatus(deck: Deck, progress: DeckProgress, newPerDay: number, now: Date): DeckStatus {
  const unseen = newCardIds(deck, progress).length
  const newToday = newCardsToday(progress, now)
  return {
    due: dueCardIds(deck, progress, now).length,
    newAvailable: Math.min(unseen, Math.max(0, newPerDay - newToday)),
    unseen,
    learned: deck.cards.length - unseen,
    newToday,
  }
}

export interface RoundOptions {
  size: number
  newPerDay: number
  mode: RoundMode
  now: Date
}

/** The card ids for a round, in the order they are first shown. */
export function planRound(deck: Deck, progress: DeckProgress, { size, newPerDay, mode, now }: RoundOptions): string[] {
  if (mode === 'practice') {
    const due = new Set(dueCardIds(deck, progress, now))
    return deck.cards
      .filter((c) => !isNew(progress.cards[c.id]) && !due.has(c.id))
      .sort((a, b) => progress.cards[a.id].due - progress.cards[b.id].due)
      .slice(0, size)
      .map((c) => c.id)
  }
  const due = dueCardIds(deck, progress, now).slice(0, size)
  const newLimit = mode === 'more-new' ? Infinity : Math.max(0, newPerDay - newCardsToday(progress, now))
  const fresh = newCardIds(deck, progress).slice(0, Math.min(newLimit, size - due.length))
  return [...due, ...fresh]
}

// ---- During a round ----

/** A card due again within this window is still being learned and comes back in the same round. */
const REQUEUE_WINDOW_MS = HOUR_MS

export interface RoundState {
  /** queue[0] is the card on screen. */
  queue: string[]
  total: number
  finished: string[]
  answers: { cardId: string; grade: Grade }[]
}

export function startRound(cardIds: string[]): RoundState {
  return { queue: [...cardIds], total: cardIds.length, finished: [], answers: [] }
}

export function applyAnswer(round: RoundState, grade: Grade, next: CardProgress, now: Date): RoundState {
  const [cardId, ...rest] = round.queue
  const answers = [...round.answers, { cardId, grade }]
  if (next.due - now.getTime() < REQUEUE_WINDOW_MS) {
    // Bring it back after a few other cards (sooner if failed); at the end if the queue is short.
    const gap = grade === Rating.Again ? 3 : 5
    rest.splice(Math.min(rest.length, gap), 0, cardId)
    return { ...round, queue: rest, answers }
  }
  return { ...round, queue: rest, finished: [...round.finished, cardId], answers }
}

export function isRoundOver(round: RoundState): boolean {
  return round.queue.length === 0
}
