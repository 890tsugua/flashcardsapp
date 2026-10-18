// Spaced repetition via FSRS (the algorithm Anki uses by default), from the ts-fsrs library.
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs'

export { Rating, State }
export type { Grade }

/** Everything we store per card. Dates are epoch milliseconds so it serializes compactly. */
export interface CardProgress {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: State
  last_review?: number
  lastRating: Grade
}

export const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]

export const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Again]: 'Fail',
  [Rating.Hard]: 'Hard',
  [Rating.Good]: 'Good',
  [Rating.Easy]: 'Easy',
}

const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true })

function toFsrs(progress: CardProgress | undefined, now: Date): Card {
  if (!progress) return createEmptyCard(now)
  const { lastRating: _, due, last_review, ...rest } = progress
  return { ...rest, due: new Date(due), last_review: last_review === undefined ? undefined : new Date(last_review) }
}

function fromFsrs(card: Card, grade: Grade): CardProgress {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.getTime(),
    lastRating: grade,
  }
}

export interface Outcome {
  progress: CardProgress
  /** Time until the card is due again. */
  intervalMs: number
}

/** What each answer would do to the card. Answering uses the same outcomes, so the buttons never lie. */
export function previewOutcomes(progress: CardProgress | undefined, now: Date): Record<Grade, Outcome> {
  const preview = scheduler.repeat(toFsrs(progress, now), now)
  const outcomes = {} as Record<Grade, Outcome>
  for (const grade of GRADES) {
    const card = preview[grade].card
    outcomes[grade] = { progress: fromFsrs(card, grade), intervalMs: card.due.getTime() - now.getTime() }
  }
  return outcomes
}

export function review(progress: CardProgress | undefined, grade: Grade, now: Date): CardProgress {
  return previewOutcomes(progress, now)[grade].progress
}

export function isNew(progress: CardProgress | undefined): boolean {
  return !progress || progress.state === State.New
}
