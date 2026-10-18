import type { Deck } from '../lib/deck'
import type { RoundMode } from '../lib/round'
import { deckStatus } from '../lib/round'
import { isNew } from '../lib/srs'
import type { DeckProgress } from '../lib/storage'
import { formatDue } from '../lib/time'

interface Props {
  deck: Deck
  progress: DeckProgress
  newPerDay: number
  roundSize: number
  now: Date
  onStart: (mode: RoundMode) => void
}

/** Shown when a normal round would be empty: say when to come back, and offer extra study. */
export function NothingToStudy({ deck, progress, newPerDay, roundSize, now, onStart }: Props) {
  const status = deckStatus(deck, progress, newPerDay, now)
  const nextDue = Math.min(
    ...deck.cards.map((c) => progress.cards[c.id]).filter((p) => !isNew(p)).map((p) => p!.due),
  )
  return (
    <div className="stack">
      <div>
        <h3>You're done for now</h3>
        <p className="secondary">
          {Number.isFinite(nextDue) ? `Your next review is ${formatDue(nextDue, now)}.` : 'Nothing is scheduled yet.'}
          {status.unseen > 0 && status.newAvailable === 0 && ` You've reached today's limit of ${newPerDay} new cards.`}
        </p>
      </div>
      <div className="row">
        {status.unseen > 0 && (
          <button type="button" className="btn" onClick={() => onStart('more-new')}>
            Learn {Math.min(roundSize, status.unseen)} more new cards
          </button>
        )}
        {status.learned > 0 && (
          <button type="button" className="btn" onClick={() => onStart('practice')}>
            Practice anyway
          </button>
        )}
      </div>
    </div>
  )
}
