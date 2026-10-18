import { RankBar } from '../components/RankBar'
import { deckResults, decks } from '../lib/decks'
import { rankCounts } from '../lib/rank'
import { deckStatus } from '../lib/round'
import { unlockSpeech } from '../lib/speech'
import { deckProgress, useAppState } from '../lib/store'
import { hrefFor, navigate } from '../router'

export function HomePage() {
  const app = useAppState()
  const now = new Date()
  const broken = deckResults.filter((r) => !r.deck)

  return (
    <>
      <div className="page-head">
        <h1>Your decks</h1>
      </div>

      {broken.length > 0 && (
        <div className="notice">
          <strong>Some deck files could not be loaded:</strong>
          <ul>
            {broken.map((r) => (
              <li key={r.file}>
                decks/{r.file}.json: {r.errors.join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {decks.length === 0 && (
        <div className="panel">
          <p>No decks yet. Add a JSON file to the <code>decks/</code> folder and push it to GitHub.</p>
        </div>
      )}

      <div className="deck-list">
        {decks.map((deck) => {
          const progress = deckProgress(app, deck.id)
          const status = deckStatus(deck, progress, app.settings.newPerDay, now)
          const size = app.settings.roundSize[deck.id] ?? app.settings.defaultRoundSize
          const roundCards = Math.min(size, status.due + status.newAvailable)
          return (
            <article key={deck.id} className="panel deck-card">
              <div className="stack" style={{ gap: 4 }}>
                <h2>
                  <a className="deck-card-title" href={hrefFor({ page: 'deck', deckId: deck.id })}>
                    {deck.name}
                  </a>
                </h2>
                {deck.description && <p className="secondary small">{deck.description}</p>}
              </div>
              <RankBar counts={rankCounts(deck, progress.cards)} small />
              <div className="deck-card-foot">
                <div className="deck-card-stats">
                  <span>
                    <strong>{status.due}</strong> due
                  </span>
                  <span>
                    <strong>{status.newAvailable}</strong> new today
                  </span>
                  <span>
                    <strong>{status.learned}</strong> of {deck.cards.length} learned
                  </span>
                </div>
                <div className="row">
                  <a className="btn btn-ghost" href={hrefFor({ page: 'deck', deckId: deck.id })}>
                    Details
                  </a>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={roundCards === 0}
                    onClick={() => {
                      unlockSpeech()
                      navigate({ page: 'study', deckId: deck.id, mode: 'normal' })
                    }}
                  >
                    {roundCards === 0 ? 'All done' : `Study ${roundCards}`}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
