import { describe, expect, it } from 'vitest'
import type { Deck } from './deck'
import { rankCounts, rankOf } from './rank'
import { applyAnswer, deckStatus, isRoundOver, planRound, shuffle, startRound } from './round'
import { previewOutcomes, Rating, review, State, type CardProgress } from './srs'
import { emptyProgress, type DeckProgress } from './storage'
import { DAY_MS, dayKey, formatDue, formatInterval, MINUTE_MS } from './time'

const now = new Date(2026, 9, 18, 12, 0, 0)
const later = (ms: number) => new Date(now.getTime() + ms)
/** Makes the shuffle a no-op, so tests can check which cards were picked and in what priority. */
const noShuffle = () => 0.999999

function deckOf(n: number): Deck {
  return {
    id: 'test',
    name: 'Test',
    language: 'el-GR',
    cards: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, word: `w${i}`, translation: `t${i}`, examples: [], tags: [] })),
  }
}

/** A graduated review card with the given stability, due at `due`. */
function reviewCard(stability: number, due: number): CardProgress {
  return {
    due,
    stability,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: Math.round(stability),
    learning_steps: 0,
    reps: 3,
    lapses: 0,
    state: State.Review,
    last_review: due - stability * DAY_MS,
    lastRating: Rating.Good,
  }
}

describe('scheduling', () => {
  it('previews an increasing interval for each grade', () => {
    const o = previewOutcomes(undefined, now)
    expect(o[Rating.Again].intervalMs).toBeLessThan(o[Rating.Hard].intervalMs)
    expect(o[Rating.Hard].intervalMs).toBeLessThan(o[Rating.Good].intervalMs)
    expect(o[Rating.Good].intervalMs).toBeLessThan(o[Rating.Easy].intervalMs)
    expect(o[Rating.Easy].progress.state).toBe(State.Review)
  })

  it('graduates a new card after two Goods', () => {
    const first = review(undefined, Rating.Good, now)
    expect(first.state).toBe(State.Learning)
    const second = review(first, Rating.Good, later(10 * MINUTE_MS))
    expect(second.state).toBe(State.Review)
    expect(second.due - later(10 * MINUTE_MS).getTime()).toBeGreaterThanOrEqual(DAY_MS)
  })

  it('a review card that is failed goes to relearning', () => {
    const card = reviewCard(20, now.getTime())
    const failed = review(card, Rating.Again, now)
    expect(failed.state).toBe(State.Relearning)
    expect(failed.lapses).toBe(1)
    expect(failed.stability).toBeLessThan(card.stability)
  })
})

describe('ranks', () => {
  it('maps progress to F–A', () => {
    expect(rankOf(undefined)).toBe('F')
    expect(rankOf(review(undefined, Rating.Again, now))).toBe('F')
    expect(rankOf(review(undefined, Rating.Good, now))).toBe('E')
    expect(rankOf(reviewCard(3, 0))).toBe('D')
    expect(rankOf(reviewCard(10, 0))).toBe('C')
    expect(rankOf(reviewCard(30, 0))).toBe('B')
    expect(rankOf(reviewCard(90, 0))).toBe('A')
    expect(rankOf({ ...reviewCard(90, 0), lastRating: Rating.Again })).toBe('F')
  })

  it('counts ranks across a deck', () => {
    const deck = deckOf(3)
    const counts = rankCounts(deck, { c0: reviewCard(90, 0), c1: reviewCard(10, 0) })
    expect(counts).toEqual({ F: 1, E: 0, D: 0, C: 1, B: 0, A: 1 })
  })
})

describe('planning a round', () => {
  it('puts due cards first, most overdue first, then new cards', () => {
    const deck = deckOf(6)
    const progress: DeckProgress = {
      ...emptyProgress(),
      cards: {
        c0: reviewCard(5, now.getTime() - DAY_MS),
        c1: reviewCard(5, now.getTime() - 3 * DAY_MS),
        c2: reviewCard(5, now.getTime() + 5 * DAY_MS), // not due
      },
    }
    expect(planRound(deck, progress, { size: 4, newPerDay: 20, mode: 'normal', now, random: noShuffle })).toEqual(['c1', 'c0', 'c3', 'c4'])
  })

  it('respects the daily new-card limit unless asked for more', () => {
    const deck = deckOf(10)
    const progress: DeckProgress = { ...emptyProgress(), days: { [dayKey(now)]: { reviews: 5, newCards: 8, fails: 0 } } }
    expect(planRound(deck, progress, { size: 5, newPerDay: 10, mode: 'normal', now, random: noShuffle })).toEqual(['c0', 'c1'])
    expect(planRound(deck, progress, { size: 5, newPerDay: 10, mode: 'more-new', now })).toHaveLength(5)
    expect(deckStatus(deck, progress, 10, now)).toMatchObject({ due: 0, newAvailable: 2, unseen: 10, newToday: 8 })
  })

  it('practice mode picks learned cards that are not due', () => {
    const deck = deckOf(4)
    const progress: DeckProgress = {
      ...emptyProgress(),
      cards: {
        c0: reviewCard(5, now.getTime() + 9 * DAY_MS),
        c1: reviewCard(5, now.getTime() + 2 * DAY_MS),
        c2: reviewCard(5, now.getTime() - DAY_MS), // due, belongs in a normal round
      },
    }
    expect(planRound(deck, progress, { size: 10, newPerDay: 20, mode: 'practice', now, random: noShuffle })).toEqual(['c1', 'c0'])
  })

  it('shuffles the order but not which cards are picked', () => {
    const deck = deckOf(30)
    const orders = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const ids = planRound(deck, emptyProgress(), { size: 10, newPerDay: 20, mode: 'normal', now })
      expect([...ids].sort()).toEqual(deck.cards.slice(0, 10).map((c) => c.id).sort())
      orders.add(ids.join())
    }
    expect(orders.size).toBeGreaterThan(1)
  })

  it('shuffle keeps every item exactly once', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const shuffled = shuffle(items)
    expect(shuffled).toHaveLength(50)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items)
  })
})

describe('during a round', () => {
  it('shows each card once, whatever the answers, so a round of 5 is 5 cards', () => {
    let round = startRound(['a', 'b', 'c', 'd', 'e'])
    const grades = [Rating.Again, Rating.Hard, Rating.Good, Rating.Again, Rating.Easy] as const
    const shown: string[] = []
    for (const grade of grades) {
      expect(isRoundOver(round)).toBe(false)
      shown.push(round.queue[0])
      round = applyAnswer(round, grade)
    }
    expect(shown).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(isRoundOver(round)).toBe(true)
    expect(round.answers).toHaveLength(5)
  })

  it('a failed card is due again soon, so the next round picks it up', () => {
    const deck = deckOf(3)
    const failed = review(undefined, Rating.Again, now)
    const progress: DeckProgress = { ...emptyProgress(), cards: { c2: failed } }
    expect(planRound(deck, progress, { size: 1, newPerDay: 20, mode: 'normal', now: later(MINUTE_MS) })).toEqual(['c2'])
  })
})

describe('time formatting', () => {
  it('formats intervals compactly', () => {
    expect(formatInterval(30_000)).toBe('1m')
    expect(formatInterval(10 * MINUTE_MS)).toBe('10m')
    expect(formatInterval(3 * DAY_MS)).toBe('3d')
    expect(formatInterval(75 * DAY_MS)).toBe('2.5mo')
    expect(formatInterval(400 * DAY_MS)).toBe('1.1y')
  })

  it('describes due dates in words', () => {
    expect(formatDue(now.getTime() - 1, now)).toBe('now')
    expect(formatDue(now.getTime() + 5 * MINUTE_MS, now)).toBe('in 5 min')
    expect(formatDue(now.getTime() + DAY_MS, now)).toBe('tomorrow')
    expect(formatDue(now.getTime() + 5 * DAY_MS, now)).toBe('in 5 days')
  })

  it('rolls the study day over at 4 am', () => {
    expect(dayKey(new Date(2026, 9, 19, 2, 0))).toBe('2026-10-18')
    expect(dayKey(new Date(2026, 9, 19, 5, 0))).toBe('2026-10-19')
  })
})
