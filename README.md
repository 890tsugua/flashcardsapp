# Flashcards

Spaced-repetition flashcards for language vocabulary, starting with Greek. It runs as a static site on GitHub Pages:

**https://890tsugua.github.io/flashcardsapp/**

- Each card shows the word and says it out loud. Tap the card to see the translation, part of speech, gender, definition, forms, examples and notes.
- Answer **Fail**, **Hard**, **Good** or **Easy**. The scheduler ([FSRS](https://github.com/open-spaced-repetition/ts-fsrs), the algorithm Anki uses by default) decides when you see the card next. Each button shows that interval.
- Every card has a rank from **F** to **A** based on how long you're expected to remember it.
- Each deck's page shows how many cards are at each rank, what's due, and reviews coming up over the next week.
- You choose how many cards go into a round. Cards you fail come back later in the same round.
- The site works offline and can be added to your phone's home screen.

## Studying

| Key | Action |
| --- | --- |
| Space | Show the answer |
| 1 / 2 / 3 / 4 | Fail / Hard / Good / Easy |
| R | Say the word again |
| U | Undo the last answer |

**A round** starts with cards that are due (most overdue first), then adds new cards up to your daily limit (20 per deck by default; change it in Settings). When you're done for the day you can still learn more new cards or practice cards that aren't due yet.

**Ranks** come from FSRS *stability*: roughly how many days until your chance of remembering the card drops to 90%.

| Rank | Meaning |
| --- | --- |
| F | New, or failed last time |
| E | Still learning (remembered for less than a day) |
| D | Remembered for up to a week |
| C | Remembered for up to 3 weeks |
| B | Remembered for up to 2 months |
| A | Remembered for 2 months or more |

## Your progress

Progress is saved in the browser you study in (localStorage), so it stays between sessions on that device. It is not stored in this repository.

- **Backups:** Settings › Backup › *Export backup* downloads a JSON file. *Import backup* restores it, which also moves your progress to another device or browser.
- **Safari / iPhone:** Safari deletes site data after 7 days without a visit, unless the site is added to the Home Screen. Add it to the Home Screen, or export a backup now and then.

## Adding a deck

Put a JSON file in [`decks/`](decks/) and push. The file name becomes the deck's id (`decks/greek-food.json` → `greek-food`), so renaming the file resets that deck's progress.

```json
{
  "name": "Greek Basics",
  "description": "Everyday words and phrases.",
  "language": "el-GR",
  "cards": [
    {
      "word": "σπίτι",
      "article": "το",
      "translation": "house, home",
      "transliteration": "spíti",
      "partOfSpeech": "noun",
      "gender": "neuter",
      "definition": "A building or place where someone lives.",
      "forms": { "plural": "τα σπίτια" },
      "examples": [{ "text": "Το σπίτι μου είναι μικρό.", "translation": "My house is small." }],
      "notes": "Πάω σπίτι = I'm going home.",
      "tags": ["home"]
    }
  ]
}
```

Only `word` and `translation` are required.

| Field | Notes |
| --- | --- |
| `name`, `description` | Shown on the home page. `name` defaults to the file name. |
| `language` | Language of the words, used to pick the voice. Defaults to `el-GR`. |
| `word` | What the card shows and says. |
| `article` | Shown and spoken before the word (`το σπίτι`). |
| `translation` | The answer. |
| `transliteration` | Shown in brackets on the answer side. |
| `partOfSpeech` | Free text: `noun`, `verb`, `adjective`, … |
| `gender` | `masculine`, `feminine` or `neuter` (`m`/`f`/`n` work too). |
| `definition`, `notes` | Free text. |
| `forms` | Any labels you like: `{"plural": "…"}`, `{"past": "…", "future": "…"}`. |
| `examples` | A list of `{"text", "translation"}` objects, or plain strings. Each one has its own play button. |
| `tags` | A list of strings. |
| `id` | Optional. Progress is tracked by `id`, or by `word` when there's no `id`. Add an `id` if you plan to edit a word's spelling, or if two cards share the same word. |
| `audio` | Optional recording, e.g. `"audio/spiti.mp3"` for a file in `public/audio/`. If set, it's played instead of the built-in voice. |

After the deploy finishes, the app picks up the new version by itself a moment after you open it, or when you switch back to it on your phone. If you're in the middle of a round, it waits until you leave the round.

Every deck is checked when the site builds (`npm test`). A deck with mistakes, such as missing fields or duplicate cards, stops the deploy, and the live site stays as it was. The failed run in the repo's **Actions** tab says what's wrong.

## Pronunciation

Words are spoken with your device's built-in text-to-speech, so it's free and works offline. Mac, iPhone and iPad have a Greek voice (Melina), and Android has one through Google Text-to-speech. Windows needs the Greek speech pack (Settings › Time & language › Speech). In the app, choose the voice and speed under Settings.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests + deck validation
npm run build    # production build in dist/
```

- `src/lib/`: the logic, with no UI.
  - `srs.ts`: FSRS scheduling
  - `rank.ts`: F–A ranks
  - `round.ts`: picking and ordering a round's cards
  - `storage.ts` and `store.ts`: saved progress and settings
  - `deck.ts`: the deck format and validation
  - `speech.ts`: pronunciation
- `src/pages/` and `src/components/`: the React UI.

## Deploying

Every push to `main` builds the site and publishes it to GitHub Pages with [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

One-time setup: in the repository on GitHub, go to **Settings › Pages** and set **Source** to **GitHub Actions**. On a free GitHub account, Pages requires the repository to be public.
