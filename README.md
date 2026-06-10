# Expansion Jam 📞 Agenda Tool

A lightweight agenda system for the Weekly Expansion Jam, built in Airtable
(where the team already works). Anyone can submit topics during the week, and
on the call you check them off one by one as they're covered.

**Base:** [Expansion Jam 📞 Agenda](https://airtable.com/appd47FpAzqZCzTQM)

## How it works

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
