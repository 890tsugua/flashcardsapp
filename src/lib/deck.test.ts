import { describe, expect, it } from 'vitest'
import { frontText, parseDeck } from './deck'
import { deckResults } from './decks'

describe('parseDeck', () => {
  it('reads a minimal deck and fills defaults', () => {
    const result = parseDeck({ cards: [{ word: 'νερό', translation: 'water' }] }, 'my-deck')
    expect(result.errors).toEqual([])
    expect(result.deck).toMatchObject({ id: 'my-deck', name: 'my-deck', language: 'el-GR' })
    expect(result.deck!.cards[0]).toMatchObject({ id: 'νερό', word: 'νερό', translation: 'water', examples: [], tags: [] })
  })

  it('normalizes gender, examples and forms', () => {
    const { deck, warnings } = parseDeck(
      {
        name: 'Test',
        cards: [
          {
            id: 'spiti',
            word: 'σπίτι',
            article: 'το',
            translation: 'house',
            gender: 'n',
            examples: ['Το σπίτι μου.', { text: 'Ένα σπίτι.', translation: 'A house.' }],
            forms: { plural: 'τα σπίτια', other: ['α', 'β'] },
          },
        ],
      },
      'test',
    )
    expect(warnings).toEqual([])
    const card = deck!.cards[0]
    expect(card.id).toBe('spiti')
    expect(card.gender).toBe('neuter')
    expect(card.examples).toEqual([{ text: 'Το σπίτι μου.' }, { text: 'Ένα σπίτι.', translation: 'A house.' }])
    expect(card.forms).toEqual({ plural: 'τα σπίτια', other: 'α, β' })
    expect(frontText(card)).toBe('το σπίτι')
  })

  it('skips invalid and duplicate cards with warnings', () => {
    const { deck, warnings } = parseDeck(
      {
        cards: [
          { word: 'ένα', translation: 'one' },
          { word: 'ένα', translation: 'a, an' },
          { word: 'δύο' },
          'oops',
        ],
      },
      'd',
    )
    expect(deck!.cards).toHaveLength(1)
    expect(warnings).toHaveLength(3)
  })

  it('rejects files that are not decks', () => {
    expect(parseDeck([], 'x').deck).toBeUndefined()
    expect(parseDeck({ name: 'No cards' }, 'x').errors).toHaveLength(1)
    expect(parseDeck({ cards: [{ word: 'x' }] }, 'x').errors).toEqual(['The deck has no valid cards.'])
  })
})

describe('decks in /decks', () => {
  it('found at least one deck', () => {
    expect(deckResults.length).toBeGreaterThan(0)
  })

  for (const result of deckResults) {
    it(`${result.file}.json is valid with no warnings`, () => {
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })
  }
})
