import type { Deck } from './deck'
import { isNew, Rating, State, type CardProgress } from './srs'

export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A'] as const
export type Rank = (typeof RANKS)[number]

export const RANK_INFO: Record<Rank, string> = {
  F: 'New, or failed last time',
  E: 'Learning: remembered for less than a day',
  D: 'Remembered for up to a week',
  C: 'Remembered for up to 3 weeks',
  B: 'Remembered for up to 2 months',
  A: 'Remembered for 2 months or more',
}

/**
 * Ranks come from FSRS stability: roughly how many days you can go before
 * the chance of remembering drops to 90%. Good/Easy grow it; Fail shrinks it.
 */
export function rankOf(progress: CardProgress | undefined): Rank {
  if (isNew(progress) || progress!.lastRating === Rating.Again) return 'F'
  const p = progress!
  if (p.state === State.Learning || p.state === State.Relearning || p.stability < 1) return 'E'
  if (p.stability < 7) return 'D'
  if (p.stability < 21) return 'C'
  if (p.stability < 60) return 'B'
  return 'A'
}

export function rankCounts(deck: Deck, cards: Record<string, CardProgress>): Record<Rank, number> {
  const counts = Object.fromEntries(RANKS.map((r) => [r, 0])) as Record<Rank, number>
  for (const card of deck.cards) counts[rankOf(cards[card.id])]++
  return counts
}

export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank)
}
