# Jam Board 🚀 — Weekly Expansion Jam agenda tool

A custom web app for running the Weekly Expansion Jam: teammates submit topics
all week, and on the call you cross them off live — everyone's screen updates
in real time.

- **Live site:** https://expansion-jam-board.netlify.app (Netlify site `expansion-jam-board`)
- **Airtable archive:** [Expansion Jam 📞 Agenda](https://airtable.com/appd47FpAzqZCzTQM)

## Features

- **Submit topics anytime** — who, context, priority (🔥 / 💬 / 🅿️), time
  needed, all chip-based so it takes 20 seconds.
- **Cross off live** — big satisfying checkmark with a strikethrough animation;
  the board polls every 4s so all 4 of you stay in sync during the Zoom call.
  Confetti when the agenda hits 100%. 🎉
- **Time budgeting** — shows minutes still planned vs. the 60-minute call and
  warns when you're overbooked.
- **Tori's data flag baked in** — 📊 toggle on the submit form with a free-text
  data ask, so the multi-day heads-up rule is part of the workflow.
- **Wrap up meeting** — one click marks the call done, rolls uncovered topics
  to next week's jam (creating it if needed), and prompts for the Fireflies
  recap link, which is archived on the meeting tab.
- **Parking lot** — park ideas that aren't for this week; pull them back with
  one click.
- **Outcome notes** — expand any topic to record decisions/next steps inline.

## Architecture

```
public/                      static front end (vanilla JS, no build step)
netlify/functions/api.mjs    serverless API (/api/*)
netlify/functions/lib/       storage drivers + seed data
test/smoke.mjs               end-to-end API tests (node test/smoke.mjs)
```

Storage is pluggable:

| Driver | When | Notes |
|---|---|---|
| **Netlify Blobs** | default | zero config, works the moment the site deploys |
| **Airtable** | set `AIRTABLE_TOKEN` env var | two-way syncs the board with the team's Airtable base, using field IDs so renames are safe (`AIRTABLE_BASE_ID` overridable, defaults to `appd47FpAzqZCzTQM`) |
| in-memory | `JAM_DRIVER=memory` | used by the smoke tests |

## Deploying

The Netlify site **expansion-jam-board** is already created. To go live:

1. Open https://app.netlify.com/projects/expansion-jam-board →
   **Site configuration → Build & deploy → Link repository** and pick
   `katzfamily/expansionagenda` (this repo's default branch). Build settings
   are read from `netlify.toml` automatically.
2. (Optional) Add `AIRTABLE_TOKEN` under **Environment variables** — create a
   personal access token at https://airtable.com/create/tokens with
   `data.records:read` + `data.records:write` scoped to the agenda base —
   and the board starts reading/writing Airtable instead of Blobs.

Alternatively, from a machine with the Netlify CLI:
`netlify deploy --build --prod --site expansion-jam-board`.

## Local dev

```
npm install
npm run smoke   # API end-to-end tests
npm run dev     # netlify dev (full local emulation incl. Blobs)
```

---

## The companion Airtable base

The Airtable base mirrors the board's schema and doubles as the long-term
archive. If you'd rather run everything out of Airtable directly:

### Submitting a topic (anytime during the week)
1. Open the **Agenda Topics** table (or the shared form — see setup below).
2. Add a row: topic headline, context, your name, which meeting it's for,
   priority (🔥 Must cover / 💬 If time allows / 🅿️ Parking lot), and time needed.
3. **If you need metrics from Tori**, tick "Needs data from Tori 📊" and spell
   out the ask in "Data ask details" — she needs a multi-day heads up, so flag
   it when you submit, not the night before.

### Running the call
1. Filter Agenda Topics to the current meeting, sort by Priority.
2. As each topic gets discussed, tick **Covered ✅** — that's the cross-off.
3. Capture decisions in "Outcome / next steps" as you go.
4. Anything left unchecked rolls to next week's meeting (re-link it) or gets
   bumped to 🅿️ Parking lot.

### After the call
1. Paste the Fireflies recap link onto the meeting's row in the **Meetings**
   table and flip its status to ✅ Done.
2. Create next week's row in Meetings (date + Zoom link) so people have
   somewhere to point new topics.

## Structure

| Table | Purpose |
|---|---|
| **Agenda Topics** | One row per topic. The `Covered ✅` checkbox is the live cross-off; `Meeting` links each topic to a call. |
| **Meetings** | One row per Tuesday call: date, status, Zoom link, Fireflies recap, notes. |

## One-time setup (5 minutes, in the Airtable UI)

These can't be created via API, so do them once by hand:

1. **Form view** on Agenda Topics → share the link in Slack/Asana so
   submitting takes 30 seconds. Hide `Covered ✅` and `Outcome / next steps`
   from the form.
2. **"This Week" grid view** on Agenda Topics: filter `Meeting` = next call,
   sort by Priority, fields ordered Topic → Submitted by → Time → Covered ✅.
   Share this view on screen during the Zoom call.
3. **"Tori's data prep" view**: filter `Needs data from Tori 📊` is checked and
   `Covered ✅` is unchecked, so she has one place to see open data asks.
4. **Share the base** with Taylor, Tori, and the 4th teammate as editors.
5. Update the Asana task **"Weekly Expansion Jam 📞 | Call Agenda"**
   description to point at the base/form links.

## Why Airtable (and not the rest of the stack)

- **Asana**: Cara is a guest in the Dreamers & Doers workspace, so she can't
  create a shared project there herself — and guests' API access doesn't reach
  that workspace either.
- **Zoom**: each Meetings row holds the Zoom link, so the agenda is one click
  from the call.
- **Fireflies**: the recap link lives on the Meetings row, giving a permanent
  archive of what was discussed vs. what was checked off.
