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

## Connect Gmail (Phase 1 — read + draft, never send)

Billi can triage your inboxes and write drafts. She **cannot send** — drafts
land in Gmail's Drafts folder for you to review and send yourself.

1. Create a Google OAuth client:
   - https://console.cloud.google.com/ → create/select a project.
   - Enable the **Gmail API**.
   - **APIs & Services → Credentials → Create credentials → OAuth client ID →
     Application type: Desktop app.**
   - Copy the client ID and secret into the repo-root `.env`:
     ```
     GOOGLE_CLIENT_ID=...
     GOOGLE_CLIENT_SECRET=...
     ```
   - On the OAuth consent screen, add yourself as a **test user** (so you can
     authorize while the app is unverified).
2. Connect each inbox (run once per account):
   ```
   npm run billi:connect-gmail
   ```
   A Google consent screen opens; approve read + draft access. The refresh
   token is saved to `billi/.gmail-accounts.json` (gitignored). Run it again
   to add another inbox.
3. Start Billi and ask: *"What's unread in my inbox?"*, *"Anything from Taylor
   this week?"*, *"Draft a reply saying I'll get her the numbers Thursday."*

With more than one inbox connected, Billi asks which one when it's ambiguous,
and never crosses context between them.

## How it fits together

| Piece | What it does |
|---|---|
| `server.mjs` | Local Node server. Serves the UI and bridges three APIs. Loads keys from `.env` and Billi's persona/guardrails from the repo-root `CLAUDE.md` (used as the system prompt). |
| `public/index.html` + `app.js` + `style.css` | The orb, push-to-talk, transcript, and the audio-reactive animation. |
| `/api/listen` | Browser audio → Deepgram → transcript. |
| `/api/respond` | Conversation → Claude (`claude-opus-4-8`) with a Gmail tool-use loop → reply text + the actions taken. |
| `/api/speak` | Reply text → ElevenLabs (voice `nklDUw4Cfwv6KJmhU9Vy`) → audio. |
| `lib/gmail.mjs` | Gmail read + draft over the REST API (raw fetch, OAuth refresh). No send function. |
| `connect-gmail.mjs` | One-time OAuth flow; saves a per-inbox refresh token. |

## Knobs (optional, via `.env`)

| Var | Default | Purpose |
|---|---|---|
| `BILLI_PORT` | `8787` | Local port. |
| `BILLI_VOICE_ID` | `nklDUw4Cfwv6KJmhU9Vy` | ElevenLabs voice. |
| `BILLI_MODEL` | `claude-sonnet-4-6` | Reasoning model. Set `claude-haiku-4-5` for faster turns, `claude-opus-4-8` for max quality. |
| `BILLI_TTS_MODEL` | `eleven_flash_v2_5` | ElevenLabs model (flash = lowest latency). |

## What's deliberately not here yet

- Sending email (drafts only, by design — Billi never sends without sign-off).
- Other connectors: Calendar, Slack, Stripe (the §8 integrations in the PRD).
- Wake word (v0 is push-to-talk only — best while others are in earshot).

See `../docs/billi-prd.md` for the full product spec and `../CLAUDE.md` for the
operating guardrails Billi runs under.
