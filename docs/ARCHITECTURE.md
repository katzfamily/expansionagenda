# Architecture — how Jam Board fits together

A plain-English map of the system, for whoever inherits it.

## The one-paragraph version

Jam Board is a small web app with no build step. The browser loads three static
files (`public/index.html`, `styles.css`, `app.js`). When you add or check off a
topic, `app.js` calls a serverless function at `/api/*` (one file:
`netlify/functions/api.mjs`). That function reads and writes the data through a
**pluggable storage driver** — in production that's the team's **Airtable base**,
so the app and the Airtable archive are always the same data. Hosting and the API
both run on **Netlify**, which redeploys automatically whenever the **GitHub** repo
changes.

```
 Browser (public/*)
   │  fetch /api/state, /api/topics, /api/meetings, /api/rollover
   ▼
 Netlify Function  netlify/functions/api.mjs
   │  picks a driver based on env vars
   ▼
 Storage driver  (netlify/functions/lib/)
   ├─ airtable-driver.mjs   ← PRODUCTION (AIRTABLE_TOKEN is set)
   ├─ blobs-driver.mjs      ← fallback if no token (Netlify Blobs)
   └─ memory-driver.mjs     ← used only by the smoke test
   ▼
 Airtable base  appd47FpAzqZCzTQM  ("Expansion Jam 📞 Agenda")
   ├─ Meetings       tblsV0G5AuMwi0zP3
   └─ Agenda Topics  tbl9tN3Uc11sBgTc1
```

## Which driver runs?

Decided in `netlify/functions/lib/store.mjs`:

1. `JAM_DRIVER=memory` → in-memory (tests only).
2. else `AIRTABLE_TOKEN` is set → **Airtable** (this is production today).
3. else → Netlify Blobs (zero-config default).

So flipping between Airtable and the built-in store is just an env var, no code
change. The Airtable base ID defaults to `appd47FpAzqZCzTQM` and can be overridden
with `AIRTABLE_BASE_ID`.

## Why field IDs, not field names

`airtable-driver.mjs` maps every app concept to an Airtable **field ID** (e.g.
`Topic` → `fldkmXEdxCH1WLbzu`), not the column name. That means you can rename or
re-emoji columns in Airtable and the app keeps working. The mapping tables at the
top of that file are the source of truth — if you ever add a column and want the
app to use it, add it there.

## The data model

**Meetings** — one row per call: date, status (Upcoming/Done/Skipped), Zoom link,
Fireflies recap link, notes.

**Agenda Topics** — one row per topic: title, context, who submitted it, a link to
its Meeting, priority (🔥 Must cover / 💬 If time allows / 🅿️ Parking lot), time
needed, a Covered checkbox, the "needs data from Tori" flag + data ask, and an
outcome/next-steps field.

## The API (all under `/api`)

| Method + path | Does |
|---|---|
| `GET /api/state` | returns all meetings + topics (the whole board) |
| `POST /api/topics` | add a topic |
| `PATCH /api/topics/:id` | edit/check off/park a topic |
| `DELETE /api/topics/:id` | remove a topic |
| `POST /api/meetings` | add a meeting |
| `PATCH /api/meetings/:id` | edit a meeting (status, Fireflies link, …) |
| `POST /api/rollover` | wrap up a meeting: mark it done, roll uncovered topics to the next one |

## How "live sync" works

`app.js` re-fetches `/api/state` every 4 seconds (pausing while you're typing or a
dialog is open). That's what lets all four of you watch topics get checked off in
real time during the call. It's polling, not websockets — simple and robust.

## Tech choices, briefly

- **No build step / vanilla JS** — anyone can edit `public/*` and the change ships;
  nothing to compile.
- **One serverless function** — the whole API is ~200 lines in one file.
- **Netlify + GitHub** — push to `main` → auto-deploy. No manual deploys needed.
- **Airtable as the database** — gives the team a browsable archive for free.
