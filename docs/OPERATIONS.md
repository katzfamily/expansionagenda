# Operations runbook — Jam Board

Day-to-day upkeep, in plain steps. No coding needed for most of this.

## Live site
- **App:** https://expansion-jam-board.netlify.app
- **Airtable base:** https://airtable.com/appd47FpAzqZCzTQM
- **Repo:** the `expansionagenda` GitHub repo (production branch `main`)
- **Host:** Netlify site `expansion-jam-board`

## Weekly rhythm
1. **During the week:** everyone drops topics on the board (or directly in Airtable).
2. **On the call:** open the meeting's tab, work down the list, tap the circle to
   check off each topic as you cover it. Jot outcomes inline.
3. **Wrap up:** click **Wrap up meeting** — it marks the call done, rolls uncovered
   topics to next week, and asks for the Fireflies recap link.
4. **After:** paste the Fireflies link; it's archived on that meeting's row.

You can do all of this from either the website **or** Airtable directly — they're
the same data.

## Common tasks

### Add next week's meeting
On the site: **＋ Meeting** in the header. Or add a row to the **Meetings** table in
Airtable (set Status = 🗓 Upcoming and a date).

### Change who can submit
The "Submitted by" names (Cara / Taylor / Tori / Other) live in two places that must
match: the `Submitted by` choices in the Airtable **Agenda Topics** table, and the
chips in `public/index.html`. Ask Claude to update both together.

### Rotate the Airtable token (do this if it ever leaks, or every few months)
1. airtable.com/create/tokens → create a new token with `data.records:read` **and**
   `data.records:write`, scoped to the base.
2. Netlify → site → Environment variables → update `AIRTABLE_TOKEN` → mark Secret.
3. Deploys → Trigger deploy. Delete the old token in Airtable.

### Redeploy without code changes
Netlify → **Deploys → Trigger deploy → Deploy site.** (Needed after changing an env
var.)

## Troubleshooting

### "Topics aren't saving"
Almost always the **Airtable token is missing write access** (reads work, writes
fail). Fix: regenerate the token with **both** `data.records:read` and
`data.records:write` (see *Rotate the Airtable token* above), update the Netlify env
var, and redeploy. Confirm by adding a topic and checking it appears as a row in
Airtable.

### The board is stuck on "Warming up the jam room…"
The API isn't responding. Check Netlify → the latest deploy is **Published** (not
failed), then **Functions → api** logs for errors. A failed deploy usually means a
bad edit on `main` — redeploy the previous good deploy from the Deploys list.

### Everything looks unstyled / wrong fonts
A deploy probably didn't finish. Re-trigger a deploy; hard-refresh the browser.

### Check the data directly
Open the Airtable base. Every board action writes there in real time, so it's the
source of truth for "did that save?"

## Running it locally (for code changes)
```
npm install
npm run smoke    # 19 API tests, no network needed
npm run dev      # netlify dev — full local site at localhost:8888
```
`npm run smoke` uses an in-memory store, so it's safe and offline.

## Where the secrets live
Only one secret exists: **`AIRTABLE_TOKEN`**, stored as a Secret env var on the
Netlify site (never in the code/repo). Rotate it via the steps above.
