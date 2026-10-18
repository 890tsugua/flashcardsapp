import type { CSSProperties } from 'react'
import { RANK_INFO, RANKS, type Rank } from '../lib/rank'

function rankStyle(rank: Rank): CSSProperties {
  return { '--seg': `var(--rank-${rank})`, '--seg-ink': `var(--rank-${rank}-ink)` } as CSSProperties
}

function plural(n: number) {
  return `${n} ${n === 1 ? 'card' : 'cards'}`
}

export function RankBadge({ rank, large }: { rank: Rank; large?: boolean }) {
  return (
    <span className={`rank-badge${large ? ' large' : ''}`} style={rankStyle(rank)} title={`Rank ${rank}: ${RANK_INFO[rank]}`}>
      <span aria-hidden>{rank}</span>
      <span className="sr-only">Rank {rank}</span>
    </span>
  )
}

interface RankBarProps {
  counts: Record<Rank, number>
  /** Compact, non-interactive version for the deck list. */
  small?: boolean
  selected?: Rank
  onSelect?: (rank: Rank | undefined) => void
}

/** Stacked bar of how many cards sit at each rank, F (left) to A (right). */
export function RankBar({ counts, small, selected, onSelect }: RankBarProps) {
  const total = RANKS.reduce((sum, r) => sum + counts[r], 0)
  if (total === 0) return null

  let before = 0
  const segments = RANKS.filter((r) => counts[r] > 0).map((rank) => {
    const middle = (before + counts[rank] / 2) / total
    before += counts[rank]
    // Keep tooltips on screen near the edges.
    const align = middle < 0.35 ? 'align-start' : middle > 0.65 ? 'align-end' : ''
    return { rank, align }
  })

  const tip = (rank: Rank, align: string) => (
    <span className={`tip ${align}`} aria-hidden>
      <strong>{plural(counts[rank])}</strong>
      <span>
        Rank {rank} · {RANK_INFO[rank]}
      </span>
    </span>
  )

  if (small) {
    return (
      <div
        className="rankbar small"
        role="img"
        aria-label={RANKS.map((r) => `${r}: ${counts[r]}`).join(', ')}
      >
        {segments.map(({ rank, align }) => (
          <span key={rank} className="rankbar-seg" style={{ ...rankStyle(rank), flexGrow: counts[rank] }}>
            {tip(rank, align)}
          </span>
        ))}
      </div>
    )
  }

  const toggle = (rank: Rank) => onSelect?.(selected === rank ? undefined : rank)
  return (
    <div>
      <div className="rankbar" data-selected={selected}>
        {segments.map(({ rank, align }) => (
          <button
            key={rank}
            type="button"
            className="rankbar-seg"
            style={{ ...rankStyle(rank), flexGrow: counts[rank] }}
            aria-pressed={selected === rank}
            aria-label={`Rank ${rank}: ${plural(counts[rank])}. Show these cards.`}
            onClick={() => toggle(rank)}
          >
            {tip(rank, align)}
          </button>
        ))}
      </div>
      <div className="legend">
        {RANKS.map((rank) => (
          <button
            key={rank}
            type="button"
            className="legend-item"
            style={rankStyle(rank)}
            aria-pressed={selected === rank}
            onClick={() => toggle(rank)}
            title={RANK_INFO[rank]}
          >
            <span className="swatch" />
            {rank} <b>{counts[rank]}</b>
          </button>
        ))}
      </div>
    </div>
  )
}
