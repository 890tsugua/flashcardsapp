// Pronunciation with the browser's built-in text-to-speech, or a recorded file when a card has one.
import { useEffect, useState } from 'react'
import { frontText, type DeckCard } from './deck'

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** "el-GR" -> "el" */
export function langPrefix(lang: string): string {
  return lang.split(/[-_]/)[0].toLowerCase()
}

export function voicesFor(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice[] {
  const prefix = langPrefix(lang)
  return voices
    .filter((v) => langPrefix(v.lang) === prefix)
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name))
}

/** Voices load asynchronously in most browsers, so this re-renders when they arrive. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (speechSupported() ? speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!speechSupported()) return
    const update = () => setVoices(speechSynthesis.getVoices())
    update()
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

export interface SpeakOptions {
  voiceURI?: string
  rate: number
}

// Safari can drop an utterance that gets garbage-collected mid-speech, so hold on to it.
let current: SpeechSynthesisUtterance | undefined
let currentAudio: HTMLAudioElement | undefined

export function stopSpeaking() {
  if (speechSupported()) speechSynthesis.cancel()
  currentAudio?.pause()
}

export function speak(text: string, lang: string, { voiceURI, rate }: SpeakOptions) {
  if (!speechSupported()) return
  stopSpeaking()
  const utterance = new SpeechSynthesisUtterance(text)
  const voices = voicesFor(speechSynthesis.getVoices(), lang)
  const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices.find((v) => v.lang.replace('_', '-') === lang) ?? voices[0]
  if (voice) utterance.voice = voice
  utterance.lang = voice?.lang ?? lang
  utterance.rate = rate
  current = utterance
  utterance.onend = () => {
    if (current === utterance) current = undefined
  }
  speechSynthesis.speak(utterance)
}

/** iOS only allows speech after it has been started from a tap, so call this from a click handler. */
export function unlockSpeech() {
  if (!speechSupported()) return
  const silent = new SpeechSynthesisUtterance(' ')
  silent.volume = 0
  speechSynthesis.speak(silent)
}

function audioUrl(path: string): string {
  return /^(https?:)?\/\//.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\//, '')
}

/** Plays the card's recording if it has one, otherwise speaks the front text. */
export function pronounceCard(card: DeckCard, lang: string, options: SpeakOptions) {
  if (card.audio) {
    stopSpeaking()
    currentAudio = new Audio(audioUrl(card.audio))
    currentAudio.play().catch(() => speak(frontText(card), lang, options))
    return
  }
  speak(frontText(card), lang, options)
}
