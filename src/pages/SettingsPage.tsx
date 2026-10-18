import { useEffect, useRef, useState } from 'react'
import { BackIcon } from '../components/Icons'
import { decks } from '../lib/decks'
import { frontText } from '../lib/deck'
import { langPrefix, speak, speechSupported, useVoices, voicesFor } from '../lib/speech'
import { exportBackup, requestPersistence, restoreBackup, updateSettings, useAppState } from '../lib/store'
import { parseBackup, type Theme } from '../lib/storage'
import { dayKey } from '../lib/time'
import { hrefFor } from '../router'

function NumberInput({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(value))
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = Number.parseInt(e.target.value, 10)
        if (n >= min && n <= max) onChange(n)
      }}
    />
  )
}

function languageName(lang: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(langPrefix(lang)) ?? lang
  } catch {
    return lang
  }
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function SettingsPage() {
  const { settings } = useAppState()
  const voices = useVoices()
  const fileInput = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean>()

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(undefined))
  }, [])

  // One voice picker per language used by the decks, with a sample word from that language.
  const languages = [...new Map(decks.map((d) => [langPrefix(d.language), d])).values()].map((deck) => ({
    prefix: langPrefix(deck.language),
    lang: deck.language,
    sample: deck.cards[0] ? frontText(deck.cards[0]) : '',
  }))

  const download = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flashcards-backup-${dayKey(new Date())}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importFile = async (file: File) => {
    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      window.alert('That file is not valid JSON.')
      return
    }
    const backup = parseBackup(raw)
    if ('error' in backup) {
      window.alert(backup.error)
      return
    }
    const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString() : 'an unknown date'
    if (window.confirm(`Replace all progress and settings on this device with the backup from ${when}?`)) {
      restoreBackup(backup)
    }
  }

  return (
    <>
      <div className="page-head">
        <a className="back-link" href={hrefFor({ page: 'home' })}>
          <BackIcon /> All decks
        </a>
        <h1>Settings</h1>
      </div>

      <section className="panel" aria-labelledby="speech-heading">
        <h2 id="speech-heading">Pronunciation</h2>
        {!speechSupported() && <div className="notice">This browser can't speak text aloud.</div>}
        {languages.map(({ prefix, lang, sample }) => {
          const options = voicesFor(voices, lang)
          return (
            <div className="field" key={prefix}>
              <label className="field-label" htmlFor={`voice-${prefix}`}>
                {languageName(lang)} voice
              </label>
              <div className="row">
                <select
                  id={`voice-${prefix}`}
                  value={settings.voiceByLang[prefix] ?? ''}
                  onChange={(e) => updateSettings({ voiceByLang: { ...settings.voiceByLang, [prefix]: e.target.value } })}
                >
                  <option value="">Automatic</option>
                  {options.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                      {v.localService ? '' : ' (online)'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn"
                  onClick={() => speak(sample, lang, { voiceURI: settings.voiceByLang[prefix], rate: settings.speechRate })}
                >
                  Test
                </button>
              </div>
              {speechSupported() && voices.length > 0 && options.length === 0 && (
                <p className="field-help">
                  No {languageName(lang)} voice found on this device. On Windows, add it under Settings › Time &amp;
                  language › Speech. On Android, install the {languageName(lang)} voice data for Google Text-to-speech.
                </p>
              )}
            </div>
          )
        })}
        <div className="field">
          <label className="field-label" htmlFor="rate">
            Speed
          </label>
          <div className="row">
            <input
              id="rate"
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={settings.speechRate}
              onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
            />
            <span className="secondary small" style={{ minWidth: 40 }}>
              {settings.speechRate.toFixed(2)}×
            </span>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="autoplay">
            Say each word when its card appears
          </label>
          <input
            id="autoplay"
            type="checkbox"
            checked={settings.autoplay}
            onChange={(e) => updateSettings({ autoplay: e.target.checked })}
          />
        </div>
      </section>

      <section className="panel" aria-labelledby="study-settings-heading">
        <h2 id="study-settings-heading">Study</h2>
        <div className="field">
          <span className="field-label">New cards per day</span>
          <NumberInput label="New cards per day" value={settings.newPerDay} min={0} max={9999} onChange={(n) => updateSettings({ newPerDay: n })} />
          <p className="field-help">Per deck. Fewer new cards means fewer reviews piling up later.</p>
        </div>
        <div className="field">
          <span className="field-label">Default cards per round</span>
          <NumberInput label="Default cards per round" value={settings.defaultRoundSize} min={1} max={500} onChange={(n) => updateSettings({ defaultRoundSize: n })} />
          <p className="field-help">Used until you pick a round size on a deck's page.</p>
        </div>
      </section>

      <section className="panel" aria-labelledby="theme-heading">
        <h2 id="theme-heading">Appearance</h2>
        <div className="chips" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.value} type="button" className="chip" aria-pressed={settings.theme === t.value} onClick={() => updateSettings({ theme: t.value })}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel stack" aria-labelledby="backup-heading">
        <h2 id="backup-heading" style={{ marginBottom: 0 }}>
          Backup
        </h2>
        <p className="secondary">
          Your progress is saved in this browser on this device. Export a backup now and then, or to move your progress to
          another device or browser.
        </p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={download}>
            Export backup
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Import backup…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void importFile(file)
            }}
          />
        </div>
        <p className="muted small">
          {persisted
            ? 'This browser has agreed to keep your data even when storage runs low.'
            : 'Browsers can clear site data when storage runs low. Safari also clears it after 7 days without a visit, unless the app is added to your Home Screen.'}
          {persisted === false && (
            <>
              {' '}
              <button type="button" className="link-btn" onClick={() => requestPersistence().then(setPersisted)}>
                Ask to keep my data
              </button>
            </>
          )}
        </p>
      </section>
    </>
  )
}
