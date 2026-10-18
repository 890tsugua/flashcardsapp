import type { DeckCard } from '../lib/deck'
import { SpeakerIcon } from './Icons'

interface Props {
  card: DeckCard
  lang: string
  onSpeak: (text: string) => void
}

/** The answer side: translation plus whatever extra information the deck provides. */
export function CardDetails({ card, lang, onSpeak }: Props) {
  const forms = card.forms ? Object.entries(card.forms) : []
  return (
    <div>
      <div className="translation">{card.translation}</div>

      {(card.partOfSpeech || card.gender || card.transliteration) && (
        <div className="meta">
          {card.partOfSpeech && <span className="tag">{card.partOfSpeech}</span>}
          {card.gender && (
            <span className="tag">
              <span className="dot" style={{ background: `var(--gender-${card.gender})` }} />
              {card.gender}
            </span>
          )}
          {card.transliteration && <span className="tag">[{card.transliteration}]</span>}
        </div>
      )}

      {card.definition && <p className="secondary">{card.definition}</p>}

      {forms.length > 0 && (
        <div className="detail-section">
          <div className="detail-label">Forms</div>
          <dl className="forms">
            {forms.map(([name, value]) => (
              <div key={name} style={{ display: 'contents' }}>
                <dt>{name}</dt>
                <dd lang={lang}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {card.examples.length > 0 && (
        <div className="detail-section">
          <div className="detail-label">{card.examples.length === 1 ? 'Example' : 'Examples'}</div>
          <ul className="examples">
            {card.examples.map((example, i) => (
              <li key={i} className="example">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Play example"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSpeak(example.text)
                  }}
                >
                  <SpeakerIcon />
                </button>
                <div>
                  <div className="example-text" lang={lang}>
                    {example.text}
                  </div>
                  {example.translation && <div className="example-translation">{example.translation}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {card.notes && (
        <div className="detail-section">
          <div className="detail-label">Notes</div>
          <p className="secondary">{card.notes}</p>
        </div>
      )}
    </div>
  )
}
