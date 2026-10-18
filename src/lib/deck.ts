// Deck format and validation. Decks are JSON files in /decks; see README for the format.

export type Gender = 'masculine' | 'feminine' | 'neuter'

export interface Example {
  text: string
  translation?: string
}

export interface DeckCard {
  /** Stable key for progress. Defaults to `word` when the JSON has no id. */
  id: string
  word: string
  article?: string
  translation: string
  transliteration?: string
  partOfSpeech?: string
  gender?: Gender
  definition?: string
  forms?: Record<string, string>
  examples: Example[]
  notes?: string
  tags: string[]
  /** Optional recording, relative to the site root (e.g. "audio/spiti.mp3") or a full URL. */
  audio?: string
}

export interface Deck {
  id: string
  name: string
  description?: string
  /** BCP 47 language of the words, used for pronunciation (e.g. "el-GR"). */
  language: string
  cards: DeckCard[]
}

export interface DeckLoadResult {
  file: string
  deck?: Deck
  errors: string[]
  warnings: string[]
}

const GENDERS: Record<string, Gender> = {
  m: 'masculine',
  masc: 'masculine',
  masculine: 'masculine',
  'αρσενικό': 'masculine',
  f: 'feminine',
  fem: 'feminine',
  feminine: 'feminine',
  'θηλυκό': 'feminine',
  n: 'neuter',
  neut: 'neuter',
  neuter: 'neuter',
  'ουδέτερο': 'neuter',
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function parseExamples(value: unknown, where: string, warnings: string[]): Example[] {
  if (value === undefined) return []
  const list = Array.isArray(value) ? value : [value]
  const examples: Example[] = []
  for (const item of list) {
    if (typeof item === 'string') {
      const t = text(item)
      if (t) examples.push({ text: t })
    } else if (isObject(item) && text(item.text)) {
      examples.push({ text: text(item.text)!, translation: text(item.translation) })
    } else {
      warnings.push(`${where}: ignored an example that has no "text".`)
    }
  }
  return examples
}

function parseForms(value: unknown, where: string, warnings: string[]): Record<string, string> | undefined {
  if (value === undefined) return undefined
  if (!isObject(value)) {
    warnings.push(`${where}: "forms" should be an object like {"plural": "..."}.`)
    return undefined
  }
  const forms: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    const v = Array.isArray(raw) ? raw.map(text).filter(Boolean).join(', ') : text(raw)
    if (v) forms[key] = v
  }
  return Object.keys(forms).length > 0 ? forms : undefined
}

function parseCard(raw: unknown, index: number, warnings: string[]): DeckCard | undefined {
  const where = `card ${index + 1}`
  if (!isObject(raw)) {
    warnings.push(`${where}: skipped, it is not an object.`)
    return undefined
  }
  const word = text(raw.word)
  const translation = text(raw.translation)
  if (!word || !translation) {
    warnings.push(`${where}: skipped, "word" and "translation" are required.`)
    return undefined
  }
  const label = `card "${word}"`

  let gender: Gender | undefined
  const rawGender = text(raw.gender)
  if (rawGender) {
    gender = GENDERS[rawGender.toLowerCase()]
    if (!gender) warnings.push(`${label}: unknown gender "${rawGender}" (use masculine, feminine or neuter).`)
  }

  let tags: string[] = []
  if (Array.isArray(raw.tags)) tags = raw.tags.map(text).filter((t): t is string => !!t)
  else if (raw.tags !== undefined) warnings.push(`${label}: "tags" should be a list of strings.`)

  return {
    id: text(raw.id) ?? word,
    word,
    article: text(raw.article),
    translation,
    transliteration: text(raw.transliteration),
    partOfSpeech: text(raw.partOfSpeech),
    gender,
    definition: text(raw.definition),
    forms: parseForms(raw.forms, label, warnings),
    examples: parseExamples(raw.examples, label, warnings),
    notes: text(raw.notes),
    tags,
    audio: text(raw.audio),
  }
}

/** Validates a deck file. Bad cards are skipped with a warning; a bad deck returns errors and no deck. */
export function parseDeck(raw: unknown, file: string): DeckLoadResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isObject(raw)) return { file, errors: ['The file must contain a JSON object.'], warnings }
  if (!Array.isArray(raw.cards)) return { file, errors: ['The deck needs a "cards" list.'], warnings }

  const cards: DeckCard[] = []
  const seen = new Set<string>()
  raw.cards.forEach((rawCard, i) => {
    const card = parseCard(rawCard, i, warnings)
    if (!card) return
    if (seen.has(card.id)) {
      warnings.push(`card ${i + 1}: skipped, another card already has the id "${card.id}". Give one of them an "id".`)
      return
    }
    seen.add(card.id)
    cards.push(card)
  })
  if (cards.length === 0) errors.push('The deck has no valid cards.')

  const deck: Deck = {
    id: text(raw.id) ?? file,
    name: text(raw.name) ?? file,
    description: text(raw.description),
    language: text(raw.language) ?? 'el-GR',
    cards,
  }
  return errors.length > 0 ? { file, errors, warnings } : { file, deck, errors, warnings }
}

/** What the front of the card shows and speaks, e.g. "το σπίτι". */
export function frontText(card: DeckCard): string {
  return card.article ? `${card.article} ${card.word}` : card.word
}
