import { useState } from 'react'
import { CardDetails } from '../components/CardDetails'
import { Forecast } from '../components/Forecast'
import { BackIcon, SpeakerIcon } from '../components/Icons'
import { NothingToStudy } from '../components/NothingToStudy'
import { RankBadge, RankBar } from '../components/RankBar'
import { frontText, type Deck } from '../lib/deck'
import { RANK_INFO, RANKS, rankCounts, rankOf, type Rank } from '../lib/rank'
import { deckStatus, planRound, type RoundMode } from '../lib/round'
import { isNew } from '../lib/srs'
import { langPrefix, pronounceCard, speak, unlockSpeech } from '../lib/speech'
import { deckProgress, resetDeck, updateSettings, useAppState } from '../lib/store'
import { dayKey, formatAgo, formatDue } from '../lib/time'
import { hrefFor, navigate } from '../router'

const PRESETS = [10, 20, 30, 50]
const LIST_LIMIT = 100

function RoundSizePicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [custom, setCustom] = useState(!PRESETS.includes(value))
  const [draft, setDraft] = useState(String(value))
  return (
    <div className="row">
      <div className="chips" role="group" aria-label="Cards per round">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            className="chip"
            aria-pressed={!custom && value === n}
            onClick={() => {
              setCustom(false)
              setDraft(String(n))
              onChange(n)
            }}
          >
            {n}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={custom} onClick={() => setCustom(true)}>
          Other
        </button>
      </div>
      {custom && (
        <input
          type="number"
          min={1}
          max={500}
          inputMode="numeric"
          aria-label="Cards per round"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = Number.parseInt(e.target.value, 10)
            if (n >= 1) onChange(Math.min(500, n))
          }}
        />
      )}
    </div>
  )
}

/** Case- and accent-insensitive, so "spiti" or "σπιτι" finds σπίτι. */
function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function DeckPage({ deck }: { deck: Deck }) {
  const app = useAppState()
  const now = new Date()
  const { settings } = app
  const progress = deckProgress(app, deck.id)
  const size = settings.roundSize[deck.id] ?? settings.defaultRoundSize
  const status = deckStatus(deck, progress, settings.newPerDay, now)
  const plan = planRound(deck, progress, { size, newPerDay: settings.newPerDay, mode: 'normal', now })
  const planDue = Math.min(status.due, plan.length)
  const counts = rankCounts(deck, progress.cards)
  const today = progress.days[dayKey(now)]
  const speakOptions = { voiceURI: settings.voiceByLang[langPrefix(deck.language)], rate: settings.speechRate }

  const [rankFilter, setRankFilter] = useState<Rank>()
  const [query, setQuery] = useState('')
  const [openCard, setOpenCard] = useState<string>()
  const [showAll, setShowAll] = useState(false)

  const start = (mode: RoundMode) => {
    unlockSpeech()
    navigate({ page: 'study', deckId: deck.id, mode })
  }

  const q = normalize(query.trim())
  const filtered = deck.cards.filter((card) => {
    if (rankFilter && rankOf(progress.cards[card.id]) !== rankFilter) return false
    if (!q) return true
    return [frontText(card), card.translation, card.transliteration ?? ''].some((s) => normalize(s).includes(q))
  })
  const visible = showAll ? filtered : filtered.slice(0, LIST_LIMIT)

  return (
    <>
      <div className="page-head">
        <a className="back-link" href={hrefFor({ page: 'home' })}>
          <BackIcon /> All decks
        </a>
        <h1>{deck.name}</h1>
        {deck.description && <p className="lede">{deck.description}</p>}
      </div>

      <section className="panel stack" aria-labelledby="study-heading">
        <h2 id="study-heading">Study</h2>
        <div className="stack" style={{ gap: 8 }}>
          <span className="secondary small">Cards per round</span>
          <RoundSizePicker
            value={size}
            onChange={(n) => updateSettings({ roundSize: { ...settings.roundSize, [deck.id]: n } })}
          />
        </div>
        {plan.length > 0 ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <p className="secondary">
              Next round: <strong>{planDue}</strong> due + <strong>{plan.length - planDue}</strong> new
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={() => start('normal')}>
              Start round
            </button>
          </div>
        ) : (
          <NothingToStudy
            deck={deck}
            progress={progress}
            newPerDay={settings.newPerDay}
            roundSize={size}
            now={now}
            onStart={start}
          />
        )}
      </section>

      <section className="panel" aria-labelledby="progress-heading">
        <div className="panel-head">
          <h2 id="progress-heading">Progress</h2>
          <span className="muted small">
            {progress.lastStudied ? `Last studied ${formatAgo(progress.lastStudied, now)}` : 'Not studied yet'}
          </span>
        </div>
        <div className="tiles">
          <div className="tile">
            <div className="tile-label">Due today</div>
            <div className="tile-value">{status.due}</div>
          </div>
          <div className="tile">
            <div className="tile-label">New today</div>
            <div className="tile-value">{status.newToday}</div>
            <div className="tile-sub">of {settings.newPerDay} a day</div>
          </div>
          <div className="tile">
            <div className="tile-label">Learned</div>
            <div className="tile-value">{status.learned}</div>
            <div className="tile-sub">of {deck.cards.length} cards</div>
          </div>
          <div className="tile">
            <div className="tile-label">Reviews today</div>
            <div className="tile-value">{today?.reviews ?? 0}</div>
          </div>
        </div>
        <h3 className="secondary small" style={{ marginBottom: 10, fontWeight: 600 }}>
          Cards by rank
        </h3>
        <RankBar counts={counts} selected={rankFilter} onSelect={setRankFilter} />
        <details style={{ marginTop: 14 }}>
          <summary>How ranks work</summary>
          <p className="secondary small" style={{ marginTop: 8 }}>
            A card's rank comes from how long the scheduler expects you to remember it. Good and Easy push it up;
            Fail drops it back to F.
          </p>
          <div className="rank-table">
            {RANKS.map((r) => (
              <div key={r}>
                <RankBadge rank={r} />
                {RANK_INFO[r]}
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="panel" aria-labelledby="forecast-heading">
        <h2 id="forecast-heading">Reviews coming up</h2>
        <Forecast deck={deck} progress={progress} now={now} />
      </section>

      <section className="panel" aria-labelledby="cards-heading">
        <div className="panel-head">
          <h2 id="cards-heading">Cards</h2>
          <span className="muted small">
            {rankFilter ? `Rank ${rankFilter}: ` : ''}
            {filtered.length} of {deck.cards.length}
            {rankFilter && (
              <>
                {' · '}
                <button type="button" className="link-btn" onClick={() => setRankFilter(undefined)}>
                  show all
                </button>
              </>
            )}
          </span>
        </div>
        <input type="search" placeholder="Search words or translations" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="card-list">
          {visible.map((card) => {
            const p = progress.cards[card.id]
            const open = openCard === card.id
            return (
              <li key={card.id} className="card-row">
                <button type="button" className="card-row-btn" aria-expanded={open} onClick={() => setOpenCard(open ? undefined : card.id)}>
                  <RankBadge rank={rankOf(p)} />
                  <span className="card-row-word" lang={deck.language}>
                    {frontText(card)}
                  </span>
                  <span className="card-row-translation">{card.translation}</span>
                  <span className="card-row-due">{isNew(p) ? 'new' : formatDue(p!.due, now)}</span>
                </button>
                {open && (
                  <div className="card-row-detail">
                    <button type="button" className="btn btn-ghost" style={{ paddingLeft: 0 }} onClick={() => pronounceCard(card, deck.language, speakOptions)}>
                      <SpeakerIcon /> Play
                    </button>
                    <CardDetails card={card} lang={deck.language} onSpeak={(text) => speak(text, deck.language, speakOptions)} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {filtered.length > visible.length && (
          <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setShowAll(true)}>
            Show all {filtered.length}
          </button>
        )}
      </section>

      <section className="panel" aria-labelledby="reset-heading">
        <h2 id="reset-heading">Reset</h2>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="secondary small">Forget all progress for this deck and start over.</p>
          <button
            type="button"
            className="btn btn-danger"
            disabled={status.learned === 0}
            onClick={() => {
              if (window.confirm(`Reset all progress for "${deck.name}"? This can't be undone.`)) resetDeck(deck.id)
            }}
          >
            Reset progress
          </button>
        </div>
      </section>
    </>
  )
}
