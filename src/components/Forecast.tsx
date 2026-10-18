import type { Deck } from '../lib/deck'
import { isNew } from '../lib/srs'
import type { DeckProgress } from '../lib/storage'
import { DAY_MS, startOfStudyDay, studyDaysUntil } from '../lib/time'

const DAYS = 7

/** Column chart of how many reviews fall due on each of the next seven days. */
export function Forecast({ deck, progress, now }: { deck: Deck; progress: DeckProgress; now: Date }) {
  const counts = new Array<number>(DAYS).fill(0)
  for (const card of deck.cards) {
    const p = progress.cards[card.id]
    if (isNew(p)) continue
    const day = Math.max(0, studyDaysUntil(p!.due, now)) // overdue counts as today
    if (day < DAYS) counts[day]++
  }
  const max = Math.max(...counts)
  if (max === 0) return <p className="muted">No reviews scheduled for the next 7 days.</p>

  const start = startOfStudyDay(now).getTime()
  const labels = counts.map((_, i) =>
    i === 0 ? 'Today' : new Date(start + i * DAY_MS + DAY_MS / 2).toLocaleDateString('en-US', { weekday: 'short' }),
  )
  const when = (i: number) => (i === 0 ? 'due today' : i === 1 ? 'due tomorrow' : `due ${labels[i]}`)

  return (
    <div>
      <div className="forecast">
        {counts.map((count, i) => (
          <div key={i} className="fc-col" tabIndex={0} aria-label={`${count} cards ${when(i)}`}>
            <div className="fc-stack" style={{ height: `${(count / max) * 80}%` }}>
              {count > 0 && <span className="fc-value">{count}</span>}
              <div className="fc-bar" />
              <span className={`tip ${i < 2 ? 'align-start' : i > 4 ? 'align-end' : ''}`} aria-hidden>
                <strong>
                  {count} {count === 1 ? 'card' : 'cards'}
                </strong>
                <span>{when(i)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="fc-labels" aria-hidden>
        {labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  )
}
