# Billi — Product Requirements Document

**A voice-first personal AI agent for running businesses, travel, and family.**

| | |
|---|---|
| **Product name** | Billi |
| **Document owner** | us@myfavoritescientist.com |
| **Status** | Draft v1.0 |
| **Last updated** | 2026-06-23 |
| **Type** | Personal / single-principal agent (the "principal" = the owner) |

---

## 1. Summary

Billi is a **voice-first AI agent** that acts as a chief-of-staff for one person.
You talk to her; she listens, reasons, takes action across your connected
accounts, and reports back — by voice and on screen. She lives on your **local
machine** with a persistent desktop UI, can read and write **files, documents,
and directories** on that machine, and reaches out to your cloud services
(calendar, multiple email accounts, multiple Slack workspaces, Stripe, and more)
through a governed integration layer.

The thesis: most of the friction in running a few businesses + a family + a
travel-heavy life isn't deciding *what* to do — it's the dozens of small
context switches between apps, accounts, and tabs. Billi collapses that into a
conversation. You say "move my Thursday with Tori to Friday and tell her why,"
and it happens across calendar and Slack without you opening either.

### What makes Billi different
- **Voice-first, not voice-only.** Speech is the primary input, but every action
  produces a visible, auditable trail in the UI. You can always see what she did.
- **Local-first surface, cloud-reaching arms.** The UI and your files stay on
  your machine; integrations are explicit, scoped, and revocable.
- **Multi-account native.** She assumes you have several email inboxes, several
  Slack workspaces, and more than one business — disambiguation is a first-class
  feature, not an afterthought.
- **Consent-graded autonomy.** Every capability has a risk tier. Low-risk reads
  are automatic; money movement and external sends require confirmation that you
  can tune over time.

---

## 2. Goals & non-goals

### 2.1 Goals
1. Let the principal **operate by voice** for the majority of daily coordination
   work (triage, scheduling, drafting, status-checking, light bookkeeping).
2. Provide a **single trustworthy surface** that spans calendar, email, Slack,
   Stripe, files, and travel — without exposing the principal to N separate apps.
3. Make **taking action safe**: every write is previewable, attributable, and
   reversible-where-possible, with risk-tiered confirmations.
4. Run with a **persistent local UI** that can edit files and directories on the
   machine, so Billi is useful even offline for local work.
5. Earn trust incrementally — start read-mostly, expand autonomy as the
   principal calibrates it.

### 2.2 Non-goals (v1)
- **Multi-user / team deployment.** Billi serves one principal. (Delegation to
  family members is a v2+ consideration, §13.)
- **Being a general phone assistant / IVR.** This is a desktop companion, not a
  call-center bot.
- **Autonomous spending or contracts** without confirmation. Billi never moves
  money or signs anything on its own in v1.
- **Replacing the source-of-truth apps.** Billi orchestrates Gmail, Calendar,
  Stripe, etc.; it does not reimplement them or become the system of record.
- **Building its own LLM.** Billi is built on the latest Claude models (e.g.
  Claude Opus 4.8 for reasoning, with faster/cheaper models for routing and
  transcription post-processing).

---

## 3. The principal & their world (context)

Billi is being built by someone who:
- Runs **multiple businesses** (e.g. a "Dreamers & Doers" workspace; a recurring
  "Weekly Expansion Jam" operating cadence) with a small team (Taylor, Tori, Cara,
  and others) coordinated across Airtable, Asana, Slack, Zoom, and Fireflies.
- Has **multiple email accounts** and **multiple Slack workspaces** (personal +
  per-business + guest memberships).
- Uses **Stripe** to run revenue for at least one business.
- **Travels frequently** and needs itinerary, booking, and family-logistics help.
- Has a **family** whose schedule and obligations interleave with work.

Design implication: Billi must hold a **mental model of "which hat am I wearing
right now"** — which business, which inbox, which workspace — and ask when
ambiguous rather than guess.

---

## 4. Personas & top use cases

Although there's one human, Billi serves several *modes*:

### 4.1 Operator mode (running the businesses)
- "What needs my decision today across all three businesses?"
- "Summarize the Expansion Jam Slack since yesterday and draft replies to
  anything urgent."
- "How much did Stripe collect this week vs last? Any failed payments or
  disputes?"
- "Pull the open Asana tasks assigned to me, group by project, read me the top 5."

### 4.2 Scheduler mode (calendar & coordination)
- "Find me 45 minutes with Taylor next week, mornings my time, and send the invite."
- "Reschedule everything on Friday — I'm flying — and let people know."
- "Do I have any conflicts between the kids' pickup and my 4pm?"

### 4.3 Communications mode (multi-inbox / multi-Slack)
- "Triage all my inboxes: what's actually for me, what can wait, what's spam."
- "Reply to the investor email in the founder account; keep the personal one out of it."
- "DM Cara on the Dreamers & Doers Slack that I'll get her the data by Thursday."

### 4.4 Travel mode
- "I need to be in Austin Tuesday and back Thursday night. Find options, hold the
  best, and put a placeholder on my calendar and my partner's."
- "My flight got delayed — rebook, notify my afternoon meetings, and check the
  hotel cancellation window."

### 4.5 Family/home mode
- "Add the recital to the family calendar and remind me to buy a gift Friday."
- "What's the week look like for the kids? Any gaps in coverage?"

### 4.6 Local work mode (files & docs)
- "Open the Q3 deck in ~/work/decks, fix the revenue slide with this week's
  Stripe numbers, and save a copy."
- "Find every contract PDF in ~/Documents/legal that mentions auto-renewal."
- "Create a project folder for the Austin trip and drop the itinerary in it."

---

## 5. Experience principles

1. **Glanceable, not chatty.** Voice replies are short and decision-oriented.
   Detail lives on screen.
2. **Always show your work.** Every action posts a card to the activity timeline
   with what changed, where, and an undo/inspect affordance.
3. **Confirm by exception.** Reads and reversible writes flow; risky or external
   actions surface a confirmation. The bar is tunable per capability.
4. **Disambiguate, don't assume.** When "my email" or "the Slack" is ambiguous,
   ask a one-tap/one-word clarifying question.
5. **Interruptible.** The principal can cut Billi off mid-sentence ("stop,"
   "wait," "no the other one") and she yields immediately.
6. **Quiet by default.** Billi speaks when spoken to or when a watch condition the
   principal set fires — not constantly.

---

## 6. Functional requirements

### 6.1 Voice interaction
- **Wake & turn-taking.** Push-to-talk (hotkey) *and* optional wake word
  ("Billi"). Barge-in supported: principal speech interrupts Billi's TTS.
- **Streaming ASR** with partial transcripts shown live; end-of-utterance
  detection plus an explicit "go" affordance for noisy environments.
- **Natural TTS** with a configurable voice; reads back numbers, names, and money
  amounts carefully (e.g. spells dollar figures, confirms recipient names).
- **Mixed input.** Voice + clicking on UI cards (e.g. say "reply to this" while
  the email is on screen). Keyboard always available as fallback.
- **Transcript of record.** Every spoken exchange is logged as text, searchable,
  and editable for corrections.

### 6.2 Reasoning & orchestration
- A planner decomposes a request into steps across tools, presents a plan for
  multi-step or risky actions, executes, and verifies results.
- **Tool use** via a governed connector layer (§8). Billi never calls a service
  it hasn't been granted, and surfaces which connector each step uses.
- **Memory** (§9): durable facts about people, businesses, accounts, preferences,
  and recurring patterns, plus episodic memory of past actions.
- **Watches / triggers**: principal-defined standing conditions ("tell me if
  Stripe gets a dispute," "ping me if anyone in the founder inbox says 'urgent'").

### 6.3 Local file & document operations
- Read/write/move/rename files and directories within **explicitly granted root
  folders** (an allow-list; never the whole disk by default).
- Open, edit, and save common document types (Markdown, text, code, CSV; office
  docs and PDFs via converters/readers).
- Diff-and-confirm on edits to existing files; **never silently overwrite** —
  show a preview, keep a backup/version, support undo.
- Respect a `.billignore`-style exclusion file and OS permissions.

### 6.4 Activity timeline & audit
- Chronological feed of every action: inputs, plan, tool calls, results, and
  confirmations. Filterable by connector, business, and risk tier.
- Each entry links to the artifact it touched (the calendar event, the email
  draft, the file diff) and offers **inspect / undo / redo where possible**.

### 6.5 Confirmation & autonomy controls
- A settings surface mapping every capability to a risk tier and a default
  behavior (auto / confirm / disabled). See §11.
- "Dry-run" mode: Billi plans and shows what it *would* do without executing.

---

## 7. Voice & UI design

### 7.1 The desktop UI (local)
- **Persistent companion window** (always-available, summonable via hotkey) with:
  - A **listening orb / state indicator** (idle, listening, thinking, speaking,
    awaiting-confirmation).
  - **Live transcript** of the current exchange.
  - **Activity timeline** (§6.4).
  - **Confirmation cards** that pop for risky actions, dismissible by voice or click.
  - A **"today" dashboard**: cross-account calendar, top inbox items, Slack
    mentions, Stripe pulse, travel-day flags.
- **Context awareness of the screen**: if the principal has an email/file open in
  Billi, "this" resolves to it.
- **Offline-capable shell**: local file work and queued actions function without
  network; cloud actions queue and replay when reconnected.

### 7.2 Conversational design
- Replies follow a **decision → detail-on-request** shape: lead with the answer
  or the action taken, offer to elaborate.
- Confirmations are **specific and read-back**: "Sending to taylor@…, subject
  'Friday move', from your founder account — go?" rather than "Send this?"
- **Graceful repair**: misheard names/amounts are easy to correct mid-flow.

---

## 8. Integrations (connector layer)

All integrations sit behind a **connector abstraction** with: scoped OAuth/token
storage, per-connector capability flags (read/write), rate-limit handling,
retries with backoff, and a uniform audit hook. Connectors are added
incrementally; v1 ships a core set and a clear path to more.

| Connector | v1 scope | Key actions | Notes / edge cases |
|---|---|---|---|
| **Google Calendar** (multiple) | R/W | List/create/update/delete events, find free time, suggest times, RSVP | Multiple calendars per account; family calendar; time-zone math for travel |
| **Gmail** (multiple accounts) | R/W (draft-first) | Search threads, read, label, **draft**, send-on-confirm | Account disambiguation is mandatory; never cross-send between identities |
| **Slack** (multiple workspaces) | R/W (draft-first) | Read channels/threads/DMs, search, **draft**, send-on-confirm, schedule | Guest vs member capability differs per workspace; respect per-workspace identity |
| **Stripe** | **Read-only in v1** | Balances, payouts, charges, failed payments, disputes, subscriptions, MRR | Money movement (refunds, payouts) is **confirm-only and gated** even when enabled in v2 |
| **Local filesystem** | R/W (allow-listed roots) | Read/write/move/rename, edit docs, search | Backups + diffs; exclusion file; no access outside granted roots |
| **Airtable** | R/W | Read/update bases (e.g. Expansion Jam agenda) | Field-ID based to survive renames |
| **Asana** | R/W (confirm on create/complete) | Tasks, projects, assignments | Guest-workspace API limits (e.g. Cara's access) — surface gracefully |
| **Fireflies / Grain / Granola** | Read | Meeting transcripts, summaries, soundbites | Feed recaps into memory & follow-ups |
| **Travel search (e.g. Kiwi)** | Read + hold | Flight search, hold/booking flow | Booking is confirm-only; never auto-purchase in v1 |
| **Google Drive / Canva** | R/W | Docs, files, design assets | Pairs with local files for hybrid workflows |

**Adding connectors** is a first-class extensibility point: a connector SDK
(auth + capability declaration + audit hook) so "anything else relevant" can be
brought in without core changes. Candidates: banking/accounting (read-only),
SMS, maps/rideshare, password manager (read-only secrets retrieval under strict
gating), CRM.

---

## 9. Memory & knowledge

Billi maintains a **personal knowledge graph** so she doesn't re-ask known things:

- **Entities**: people (name, role, which businesses, preferred channel, time
  zone), businesses (which inbox/Slack/Stripe/calendar belong to each), accounts,
  recurring meetings, family members.
- **Preferences**: meeting defaults (length, buffers, no-meeting blocks),
  tone/signature per identity, travel preferences (airlines, seats, hotel chains),
  "rules of the house" (e.g. "Tori needs multi-day notice for data asks").
- **Episodic log**: what was done, when, and the outcome — feeds the audit and
  lets the principal say "do that thing you did last Friday."
- **Provenance & correction**: every learned fact records where it came from and
  can be edited/forgotten by voice ("forget that I prefer United").
- **Storage**: local-first, encrypted at rest; the principal can inspect and
  export the entire memory store. No memory leaves the machine without an
  explicit connector call.

---

## 10. Architecture (reference)

```
┌──────────────────────────────────────────────────────────────┐
│  Local machine                                                 │
│                                                                │
│   Desktop UI (companion window, timeline, dashboard)           │
│        │  voice in/out, clicks                                 │
│   ┌────▼─────────────────────────────────────────────┐        │
│   │  Billi core (local service)                       │        │
│   │   • ASR (streaming) → text                        │        │
│   │   • Planner/orchestrator (Claude Opus 4.8)        │        │
│   │   • Tool router  • Memory store (encrypted)       │        │
│   │   • Confirmation/risk engine  • Audit log         │        │
│   │   • TTS ← text                                    │        │
│   └────┬───────────────────────────┬──────────────────┘        │
│        │ local FS (allow-listed)    │                           │
│   ┌────▼────┐                       │ connector calls           │
│   │ Files / │                       │ (scoped tokens, HTTPS)    │
│   │  docs   │                       │                           │
│   └─────────┘                       │                           │
└─────────────────────────────────────┼──────────────────────────┘
                                       ▼
        Cloud connectors: Calendar · Gmail(×N) · Slack(×N) ·
        Stripe · Airtable · Asana · Drive · Travel · …
```

- **Local service** owns secrets, memory, audit, and the risk engine. The LLM
  reasons but cannot reach a connector except through the router, which enforces
  scope and tier.
- **Model layer** uses the latest Claude models — a strong reasoner (Opus 4.8)
  for planning, faster models for routing/classification and transcript cleanup.
- **Secrets** (OAuth tokens, API keys) live in the OS keychain / encrypted local
  vault — never in plaintext, never in the model context.
- **Network**: only connector traffic leaves the machine, over TLS; the UI,
  files, and memory stay local.

---

## 11. Security, privacy & trust (core, not an appendix)

This is the make-or-break of the product. Billi touches money, email identities,
and a family's life.

### 11.1 Risk tiers & confirmation defaults
| Tier | Examples | Default |
|---|---|---|
| **T0 read** | List calendar, read inbox, Stripe balance, search files | Auto |
| **T1 reversible local/internal write** | Create draft, label email, add calendar event on own calendar, edit a file (with backup) | Auto, shown in timeline |
| **T2 external/visible action** | Send email, post to Slack, send calendar invite, create Asana task assigned to others | **Confirm** (tunable) |
| **T3 money / bookings / destructive** | Stripe refund/payout, flight purchase, delete event others rely on, bulk file delete | **Always confirm**, with read-back; some hard-disabled in v1 |

The principal can promote/demote individual capabilities (e.g. "always auto-send
Slack DMs to Taylor") with per-recipient/per-account granularity.

### 11.2 Identity isolation (multi-account safety)
- Each email account and Slack workspace is a distinct **identity** with its own
  signature, send permission, and visual color.
- **Hard rule**: Billi never sends from or replies across identities without
  naming the identity in the confirmation. No accidental cross-posting between
  the founder inbox and the personal one.

### 11.3 Local file safety
- Operations confined to **allow-listed roots**; everything else is invisible.
- Edits create backups/versions; deletes go to a recoverable trash with a
  retention window; bulk operations (>N files) escalate to T3.
- Honor `.billignore` and OS permissions; never traverse into excluded paths.

### 11.4 Prompt-injection & untrusted content
- Email bodies, Slack messages, web pages, file contents, and meeting transcripts
  are **untrusted data**, not instructions. Content that tries to make Billi act
  ("ignore previous instructions, wire money to…") is flagged and **never**
  triggers a T2/T3 action without explicit principal confirmation that references
  the *origin* of the request.
- Outbound actions derived from inbound content always show provenance.

### 11.5 Secrets & data handling
- Tokens/keys in OS keychain or encrypted vault; rotated and revocable per
  connector from settings.
- Model context is minimized: only the data needed for the task is sent to the
  LLM; secrets are never included.
- Full **local audit log**; principal can export or wipe all data; "panic"
  command revokes all connector tokens at once.

### 11.6 Authentication of the principal
- The companion can require re-auth (OS biometric / passphrase) for T3 actions
  and after idle timeout, since voice alone is not proof of identity (anyone in
  earshot can speak). Optional voice-match as a *signal*, never the sole gate.

---

## 12. Edge cases & failure handling

A non-exhaustive but representative catalog the build must address:

### 12.1 Disambiguation & ambiguity
- "My email" with 3 inboxes → ask which, remember the answer for the session.
- "Tell the team" → which business's team / which channel? Confirm scope.
- Two people named "Chris" → resolve by business/recent context, then confirm.
- Vague time ("next Thursday" near a week boundary, across time zones while
  traveling) → restate the resolved absolute date/time before acting.

### 12.2 Voice/ASR failures
- Mishearing names, amounts, or addresses → read-back + easy correction; high-risk
  actions require confirmation of the *parsed* value, not the raw audio.
- Noisy environment / partial utterance → ask to repeat rather than guess.
- Wake-word false positives → require intent confirmation before any T2+ action.
- Someone else speaking near the mic → don't execute T2/T3 from unverified input
  during sensitive operations (see §11.6).

### 12.3 Multi-account / identity hazards
- Reply-all storms, cross-identity replies, sending from the wrong "from."
- Slack guest vs member capability gaps (an action allowed in one workspace fails
  in another) → detect and explain, don't silently fail.

### 12.4 Calendar & scheduling
- Time-zone drift while traveling; DST boundaries; all-day vs timed events.
- Double-booking and conflicts with family calendar; declining vs proposing-new.
- Editing recurring events (this-vs-all-future); events you don't own.
- Inviting external attendees (T2, confirm) vs blocking your own time (T1).

### 12.5 Money / Stripe
- Read-only by default; surfacing failed payments and disputes proactively (watch).
- If write is ever enabled: refunds/payouts are T3, always confirmed with
  amount + recipient read-back, with a hard cap the principal sets.

### 12.6 Travel
- Held vs booked vs purchased — never auto-purchase in v1; holds expire (track and
  warn). Delays/cancellations trigger a rebook+notify flow that's confirm-gated.
- Itineraries that touch the family calendar and a partner's calendar.

### 12.7 Local files
- Concurrent edits (file changed on disk since Billi read it) → re-diff, don't
  clobber. Large files / binary files → handle or refuse gracefully. Permission
  errors → explain. Accidental "delete everything in Downloads" → escalate to T3
  with a count and a sample.

### 12.8 System & connectivity
- Network loss → queue cloud actions, keep local work flowing, replay on
  reconnect with confirmation of anything time-sensitive.
- Connector outage / rate limits / expired tokens → degrade gracefully, tell the
  principal which arm is down, retry with backoff.
- Conflicting watches firing at once → prioritize and batch, don't talk over
  yourself.
- Long-running task → stream progress, allow "stop."

### 12.9 Conversational
- Interruptions ("stop," "no, the other one") → yield immediately, roll back the
  in-flight step if not yet committed.
- Ambiguous undo ("undo that") → confirm which action.
- Principal changes their mind mid-plan → re-plan from current state.

---

## 13. Roadmap / phasing

### Phase 0 — Foundations (read-mostly, build trust)
- Local desktop shell + voice loop (ASR/TTS, barge-in, transcript).
- Connectors: Calendar (R), Gmail (R + draft), one Slack workspace (R + draft),
  Stripe (R), local files (R/W in allow-listed roots).
- Activity timeline, risk engine, encrypted memory store, audit log.
- **Success**: principal does morning triage + local doc edits by voice daily.

### Phase 1 — Acting on the world (confirmed writes)
- Send email / post Slack (T2, confirm), full multi-account & multi-workspace
  identity isolation, calendar create/update incl. invites, Asana/Airtable writes.
- Watches/triggers; "today" dashboard across all businesses.
- **Success**: principal sends/schedules/coordinates without opening the apps.

### Phase 2 — Travel & proactive ops
- Travel search + hold + rebook flows; itinerary→calendar(s) automation.
- Proactive surfacing (Stripe disputes, urgent mail, conflicts) with quiet hours.
- Tunable autonomy (promote trusted capabilities to auto).
- **Success**: a flight delay is handled end-to-end with one confirmation.

### Phase 3 — Depth & extensibility
- Connector SDK for "anything else relevant"; richer memory; optional limited
  delegation to family members; Stripe writes (gated) if desired.

---

## 14. Success metrics
- **Adoption**: daily active voice sessions; % of coordination actions done via
  Billi vs native apps.
- **Trust**: confirmation-override rate (how often the principal corrects a
  proposed action) trending down; zero cross-identity send incidents.
- **Time saved**: self-reported minutes/day reclaimed; reduction in app switches.
- **Reliability**: action success rate; mean time to recover from connector
  outages; ASR correction rate.
- **Safety**: zero unauthorized T3 actions; 100% of actions in the audit log.

---

## 15. Open questions
1. **Platform**: which OS first (macOS / Windows / Linux) for the local shell?
   This drives keychain, file-permission, and packaging choices.
2. **Wake word vs push-to-talk** as the default — privacy vs convenience.
3. **Always-listening** boundaries: what's recorded vs transient, and where.
4. **Stripe writes**: ever in scope, and with what hard caps?
5. **Family delegation**: do other household members get scoped voices/access?
6. **Backup of memory**: local-only, or optional encrypted cloud backup?
7. **Latency budget**: acceptable end-to-end voice round-trip for "feels live."

---

## 16. Glossary
- **Principal** — the single human Billi serves.
- **Connector** — a governed integration to one external service.
- **Identity** — a specific sendable account (an email address or Slack
  workspace membership) with its own permissions and signature.
- **Risk tier (T0–T3)** — the sensitivity class of an action, governing whether
  it auto-runs or requires confirmation.
- **Watch / trigger** — a standing condition that makes Billi speak up proactively.
- **Allow-listed root** — a directory Billi is permitted to read/write.
