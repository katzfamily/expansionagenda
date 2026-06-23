# Billi v0 — the voice loop

A local "Jarvis" for Cara. Hold the orb, talk, and Billi talks back in her
ElevenLabs voice. This first version proves the full pipeline:

```
mic → Deepgram (speech-to-text) → Claude (reasoning) → ElevenLabs (voice) → speaker
```

It runs entirely on your Mac. Nothing here is deployed. Connectors (Gmail,
Calendar, Slack, Stripe) are the next phase; v0 is the conversation itself.

## Setup (one time)

1. Install Node 18 or newer (`node --version`). Then, from the repo root:
   ```
   npm install
   ```
2. Add your keys to the repo-root `.env` (gitignored). Two are already there
   (Deepgram, ElevenLabs). You need to add one:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get it at https://console.anthropic.com/.

## Run

```
npm run billi
```

Then open http://localhost:8787 in Chrome. **Hold the orb** (or press and hold
**Space**), speak, and release. Billi transcribes, thinks, and replies aloud.
The orb pulses blue while you talk and terracotta while she speaks.

The first time, Chrome asks for microphone permission — allow it.

## How it fits together

| Piece | What it does |
|---|---|
| `server.mjs` | Local Node server. Serves the UI and bridges three APIs. Loads keys from `.env` and Billi's persona/guardrails from the repo-root `CLAUDE.md` (used as the system prompt). |
| `public/index.html` + `app.js` + `style.css` | The orb, push-to-talk, transcript, and the audio-reactive animation. |
| `/api/listen` | Browser audio → Deepgram → transcript. |
| `/api/respond` | Conversation → Claude (`claude-opus-4-8`) → reply text. |
| `/api/speak` | Reply text → ElevenLabs (voice `nklDUw4Cfwv6KJmhU9Vy`) → audio. |

## Knobs (optional, via `.env`)

| Var | Default | Purpose |
|---|---|---|
| `BILLI_PORT` | `8787` | Local port. |
| `BILLI_VOICE_ID` | `nklDUw4Cfwv6KJmhU9Vy` | ElevenLabs voice. |
| `BILLI_MODEL` | `claude-opus-4-8` | Reasoning model. |
| `BILLI_TTS_MODEL` | `eleven_turbo_v2_5` | ElevenLabs model (turbo = low latency). |

## What's deliberately not here yet

- Connectors and live account access (the §8 integrations in the PRD).
- Wake word (v0 is push-to-talk only — best while others are in earshot).
- Streaming TTS (v0 speaks each reply after it's fully generated; replies are
  short, so it stays snappy).

See `../docs/billi-prd.md` for the full product spec and `../CLAUDE.md` for the
operating guardrails Billi runs under.
