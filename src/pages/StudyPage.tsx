import { useEffect, useMemo, useState } from 'react'
import { CardDetails } from '../components/CardDetails'
import { CloseIcon, SpeakerIcon, UndoIcon } from '../components/Icons'
import { NothingToStudy } from '../components/NothingToStudy'
import { RankBadge } from '../components/RankBar'
import type { Deck } from '../lib/deck'
import { rankIndex, rankOf, type Rank } from '../lib/rank'
import { applyAnswer, isRoundOver, planRound, startRound, type RoundMode, type RoundState } from '../lib/round'
import { GRADE_LABELS, GRADES, isNew, previewOutcomes, Rating, type Grade, type Outcome } from '../lib/srs'
import { langPrefix, pronounceCard, speak, stopSpeaking, unlockSpeech } from '../lib/speech'
import {
  deckProgress,
  getState,
  recordAnswer,
  requestPersistence,
  undoAnswer,
  useAppState,
  type UndoEntry,
} from '../lib/store'
import { formatInterval } from '../lib/time'
import { hrefFor, navigate } from '../router'

/** A short pause before each new card is spoken, so the word isn't read out the instant it appears. */
const AUTOPLAY_DELAY_MS = 300

const GRADE_CLASS: Record<Grade, string> = {
  [Rating.Again]: 'grade-fail',
  [Rating.Hard]: 'grade-hard',
  [Rating.Good]: 'grade-good',
  [Rating.Easy]: 'grade-easy',
}

interface Session {
  id: number
  round: RoundState
  rankBefore: Record<string, Rank>
  undo: { round: RoundState; entry: UndoEntry }[]
}

function newSession(deck: Deck, mode: RoundMode): Session {
  const app = getState()
  const progress = deckProgress(app, deck.id)
  const size = app.settings.roundSize[deck.id] ?? app.settings.defaultRoundSize
  const ids = planRound(deck, progress, { size, newPerDay: app.settings.newPerDay, mode, now: new Date() })
  return {
    id: Date.now(),
    round: startRound(ids),
    rankBefore: Object.fromEntries(ids.map((id) => [id, rankOf(progress.cards[id])])),
    undo: [],
  }
}

interface Reveal {
  at: Date
  outcomes: Record<Grade, Outcome>
}

export function StudyPage({ deck, mode }: { deck: Deck; mode: RoundMode }) {
  const app = useAppState()
  const { settings } = app
  const progress = deckProgress(app, deck.id)
  const [session, setSession] = useState(() => newSession(deck, mode))
  const [reveal, setReveal] = useState<Reveal | null>(null)

  const cardsById = useMemo(() => new Map(deck.cards.map((c) => [c.id, c])), [deck])
  const { round } = session
  const card = round.queue.length > 0 ? cardsById.get(round.queue[0]) : undefined
  const over = isRoundOver(round)
  const speakOptions = { voiceURI: settings.voiceByLang[langPrefix(deck.language)], rate: settings.speechRate }

  // Say each card out loud shortly after it comes up.
  const shown = round.answers.length
  useEffect(() => {
    if (!card || !settings.autoplay) return
    const timer = window.setTimeout(() => pronounceCard(card, deck.language, speakOptions), AUTOPLAY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [session.id, shown])

  useEffect(() => stopSpeaking, [])

  useEffect(() => {
    if (over && round.answers.length > 0) void requestPersistence()
  }, [over, round.answers.length])

  const showAnswer = () => {
    if (!card || reveal) return
    const at = new Date()
    setReveal({ at, outcomes: previewOutcomes(progress.cards[card.id], at) })
  }

  const answer = (grade: Grade) => {
    if (!card || !reveal) return
    const { progress: next } = reveal.outcomes[grade]
    const entry = recordAnswer(deck.id, card.id, grade, next, reveal.at)
    setSession((s) => ({ ...s, round: applyAnswer(s.round, grade), undo: [...s.undo, { round: s.round, entry }] }))
    setReveal(null)
  }

  const undo = () => {
    const last = session.undo.at(-1)
    if (!last) return
    undoAnswer(last.entry)
    setSession((s) => ({ ...s, round: last.round, undo: s.undo.slice(0, -1) }))
    const at = new Date()
    setReveal({ at, outcomes: previewOutcomes(last.entry.previous, at) })
  }

  const replay = () => card && pronounceCard(card, deck.language, speakOptions)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === ' ') {
        // Also stops Space from clicking whichever button has focus.
        e.preventDefault()
        showAnswer()
      } else if (e.key === 'Enter') {
        if (!target.closest('button, a')) showAnswer()
      } else if (reveal && ['1', '2', '3', '4'].includes(e.key)) {
        answer(GRADES[Number(e.key) - 1])
      } else if (e.key.toLowerCase() === 'r') {
        replay()
      } else if (e.key.toLowerCase() === 'u') {
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const backToDeck = hrefFor({ page: 'deck', deckId: deck.id })

  const begin = (m: RoundMode) => {
    unlockSpeech()
    setReveal(null)
    if (m === mode) setSession(newSession(deck, m))
    else navigate({ page: 'study', deckId: deck.id, mode: m })
  }

  if (round.total === 0) {
    const size = settings.roundSize[deck.id] ?? settings.defaultRoundSize
    return (
      <div className="panel empty-state">
        <NothingToStudy
          deck={deck}
          progress={progress}
          newPerDay={settings.newPerDay}
          roundSize={size}
          now={new Date()}
          onStart={begin}
        />
        <div className="row">
          <a className="btn btn-ghost" href={backToDeck}>
            Back to deck
          </a>
        </div>
      </div>
    )
  }

  if (over || !card) {
    return (
      <Summary
        deck={deck}
        session={session}
        onUndo={session.undo.length > 0 ? undo : undefined}
        onStart={begin}
      />
    )
  }

  const p = progress.cards[card.id]
  return (
    <div className="study">
      <div className="study-bar">
        <a className="icon-btn" href={backToDeck} aria-label="End round">
          <CloseIcon />
        </a>
        <div
          className="progress"
          role="progressbar"
          aria-label="Cards answered"
          aria-valuemin={0}
          aria-valuemax={round.total}
          aria-valuenow={round.answers.length}
        >
          <div style={{ width: `${(round.answers.length / round.total) * 100}%` }} />
        </div>
        <span className="study-count">
          {round.answers.length} / {round.total}
        </span>
        <button type="button" className="icon-btn" onClick={undo} disabled={session.undo.length === 0} aria-label="Undo last answer" title="Undo (U)">
          <UndoIcon />
        </button>
      </div>

      <section
        className={`panel study-card${reveal ? ' revealed' : ''}`}
        onClick={showAnswer}
        aria-live="polite"
      >
        <div className="study-card-tags">{isNew(p) ? <span className="tag">New</span> : <RankBadge rank={rankOf(p)} />}</div>
        <button
          type="button"
          className="icon-btn study-card-speak"
          aria-label="Play pronunciation"
          title="Play (R)"
          onClick={(e) => {
            e.stopPropagation()
            replay()
          }}
        >
          <SpeakerIcon />
        </button>
        <div className="front">
          <div className="word" lang={deck.language}>
            {card.article && <span className="article">{card.article} </span>}
            {card.word}
          </div>
          {!reveal && <div className="reveal-hint">Tap to show the answer</div>}
        </div>
        {reveal && (
          <div className="answer">
            <CardDetails card={card} lang={deck.language} onSpeak={(text) => speak(text, deck.language, speakOptions)} />
          </div>
        )}
      </section>

      {reveal ? (
        <div className="grades">
          {GRADES.map((grade, i) => (
            <button key={grade} type="button" className={`grade ${GRADE_CLASS[grade]}`} onClick={() => answer(grade)}>
              <span className="grade-name">{GRADE_LABELS[grade]}</span>
              <span className="grade-interval">{formatInterval(reveal.outcomes[grade].intervalMs)}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      ) : (
        <div className="grades single">
          <button type="button" className="btn btn-primary btn-large" onClick={showAnswer}>
            Show answer
          </button>
        </div>
      )}
      <p className="shortcuts">Space shows the answer · 1–4 answers · R replays · U undoes</p>
    </div>
  )
}

function Summary({
  deck,
  session,
  onUndo,
  onStart,
}: {
  deck: Deck
  session: Session
  onUndo?: () => void
  onStart: (mode: RoundMode) => void
}) {
  const app = useAppState()
  const progress = deckProgress(app, deck.id)
  const settings = app.settings
  const size = settings.roundSize[deck.id] ?? settings.defaultRoundSize
  const moreToStudy = planRound(deck, progress, { size, newPerDay: settings.newPerDay, mode: 'normal', now: new Date() }).length

  const counts: Record<Grade, number> = { [Rating.Again]: 0, [Rating.Hard]: 0, [Rating.Good]: 0, [Rating.Easy]: 0 }
  for (const { grade } of session.round.answers) counts[grade]++

  const changes = Object.entries(session.rankBefore)
    .map(([id, before]) => ({ card: deck.cards.find((c) => c.id === id)!, before, after: rankOf(progress.cards[id]) }))
    .filter((c) => c.card && c.before !== c.after)
    .sort((a, b) => rankIndex(b.after) - rankIndex(b.before) - (rankIndex(a.after) - rankIndex(a.before)))

  return (
    <div>
      <section className="panel">
        <h1>Round complete</h1>
        <p className="secondary" style={{ marginTop: 6 }}>
          You went through {session.round.total} {session.round.total === 1 ? 'card' : 'cards'}:
        </p>
        <div className="summary-grades">
          {GRADES.map((grade) => (
            <div key={grade} className={`summary-grade ${GRADE_CLASS[grade]}`}>
              <b>{counts[grade]}</b>
              <span className="secondary small">{GRADE_LABELS[grade]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Rank changes</h2>
        {changes.length === 0 ? (
          <p className="muted">No ranks changed this round.</p>
        ) : (
          <ul className="changes">
            {changes.map(({ card, before, after }) => (
              <li key={card.id}>
                <span className="change-word" lang={deck.language}>
                  {card.article ? `${card.article} ` : ''}
                  {card.word}
                </span>
                <RankBadge rank={before} />
                <span aria-label="to" className="muted">
                  →
                </span>
                <RankBadge rank={after} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {moreToStudy === 0 && (
        <section className="panel">
          <NothingToStudy
            deck={deck}
            progress={progress}
            newPerDay={settings.newPerDay}
            roundSize={size}
            now={new Date()}
            onStart={onStart}
          />
        </section>
      )}

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {onUndo && (
          <button type="button" className="btn btn-ghost" onClick={onUndo}>
            <UndoIcon /> Undo last
          </button>
        )}
        <a className="btn" href={hrefFor({ page: 'deck', deckId: deck.id })}>
          Back to deck
        </a>
        {moreToStudy > 0 && (
          <button type="button" className="btn btn-primary" onClick={() => onStart('normal')}>
            Another round ({moreToStudy})
          </button>
        )}
      </div>
    </div>
  )
}
