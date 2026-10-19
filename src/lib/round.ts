// Picking the cards for a round, and the order they come up in during it.
import type { Deck } from './deck'
import { isNew, type Grade } from './srs'
import type { DeckProgress } from './storage'
import { dayKey, endOfStudyDay } from './time'

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
  /** Source of randomness for the card order; tests pass a fixed one. */
  random?: () => number
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * The card ids for a round, in the order they are shown. Which cards go in follows priority
 * (most overdue first, then new cards in deck order); the order you see them in is shuffled.
 */
export function planRound(deck: Deck, progress: DeckProgress, { size, newPerDay, mode, now, random }: RoundOptions): string[] {
  if (mode === 'practice') {
    const due = new Set(dueCardIds(deck, progress, now))
    const soonest = deck.cards
      .filter((c) => !isNew(progress.cards[c.id]) && !due.has(c.id))
      .sort((a, b) => progress.cards[a.id].due - progress.cards[b.id].due)
      .slice(0, size)
      .map((c) => c.id)
    return shuffle(soonest, random)
  }
  const due = dueCardIds(deck, progress, now).slice(0, size)
  const newLimit = mode === 'more-new' ? Infinity : Math.max(0, newPerDay - newCardsToday(progress, now))
  const fresh = newCardIds(deck, progress).slice(0, Math.min(newLimit, size - due.length))
  return shuffle([...due, ...fresh], random)
}

// ---- During a round ----

/**
 * Each card is shown once per round. A failed card is due again within minutes,
 * so it comes back in the next round.
 */
export interface RoundState {
  /** queue[0] is the card on screen. */
  queue: string[]
  total: number
  answers: { cardId: string; grade: Grade }[]
}

export function startRound(cardIds: string[]): RoundState {
  return { queue: [...cardIds], total: cardIds.length, answers: [] }
}

export function applyAnswer(round: RoundState, grade: Grade): RoundState {
  const [cardId, ...rest] = round.queue
  return { ...round, queue: rest, answers: [...round.answers, { cardId, grade }] }
}

export function isRoundOver(round: RoundState): boolean {
  return round.queue.length === 0
}
