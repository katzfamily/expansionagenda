# Billi — Product Requirements Document

**A voice-first AI chief-of-staff for Cara Katz.** Built to help run the businesses, the travel, and the family across multiple inboxes, multiple Slack workspaces, a calendar, and Stripe.

| | |
|---|---|
| Product name | Billi |
| Principal | Cara Katz (us@myfavoritescientist.com) |
| Company of record | Cara Parrish Consulting LLC (Wyoming) |
| Document owner | Cara |
| Status | Draft v1.1 |
| Last updated | 2026-06-23 |
| Builders | Cara, with Claude and ElevenLabs. No outside developers in v1. |
| Companion doc | `CLAUDE.md` (the operating-context and judgment layer, read on every run) |

> This PRD honors Cara's hard formatting rules (no em dashes, minimal colons in prose). The canonical guardrails live in `CLAUDE.md`. Where the two overlap, `CLAUDE.md` wins, because it is the judgment layer Billi reads on every run.

---

## 1. Summary

Billi is a voice-first AI agent that acts as a chief-of-staff for one person. Cara talks to her, she listens, reasons, takes action across connected accounts, and reports back by voice and on screen. She lives on the local machine with a persistent desktop UI, can read and write files, documents, and directories on that machine, and reaches out to cloud services through a governed integration layer.

The thesis is that the friction in running several simultaneous revenue engagements plus a family plus a travel-heavy life is not deciding what to do. It is the dozens of small context switches between apps, accounts, and tabs, and the risk that something crosses a boundary it should never cross. Billi collapses the coordination into a conversation and holds the wall map so streams that must stay separate stay separate.

### What makes Billi different
- Voice-first, not voice-only. Speech is the primary input. Every action still produces a visible, auditable trail in the UI so Cara can always see what was done.
- Local-first surface, cloud-reaching arms. The UI, the files, and the memory stay on the machine. Integrations are explicit, scoped, and revocable.
- Multi-engagement native. Billi assumes several inboxes, several Slack workspaces, and more than one business. Disambiguation and confidentiality walls are first-class, not afterthoughts.
- Draft and hold by default. Billi reads freely and drafts freely. Sending, introducing, moving money, and deleting all wait for explicit sign-off.
- Built on the latest Claude models for reasoning, with ElevenLabs for the voice.

---

## 2. Goals and non-goals

### 2.1 Goals
1. Let Cara operate by voice for the majority of daily coordination work across all engagements (triage, scheduling, drafting, status-checking, research, dossier assembly).
2. Provide a single trustworthy surface that spans calendar, multiple email accounts, multiple Slack workspaces, Stripe, files, and travel, without exposing Cara to N separate apps.
3. Make taking action safe. Every write is previewable and attributable, confidential streams never cross, and every external or money action waits for sign-off.
4. Run with a persistent local UI that can edit files and directories on the machine, useful even offline.
5. Respect how Cara works and writes. Never manufacture urgency, and never produce a draft that violates her voice rules.

### 2.2 Non-goals (v1)
- Multi-user deployment. Billi serves one principal. The Kassidy Hardwyn handoff (section 13) is a boundary question, not a multi-user feature.
- Autonomous spending or money movement of any kind. Stripe is read-only in v1.
- Autonomous external sends or introductions. Billi drafts and holds.
- Replacing the source-of-truth apps. Billi orchestrates Gmail, Calendar, Slack, Stripe, Airtable, Granola, and Drive. It does not become the system of record.
- Building its own model or its own voice. Claude reasons, ElevenLabs speaks.

---

## 3. The principal and her world

Cara Katz is a fractional revenue executive and multi-venture operator. Her niche is revenue strategy for founder-led businesses with multiple revenue streams, membership, sponsorship, services, events, and IP. Women founders dominate the roster. Company of record is Cara Parrish Consulting LLC, a Wyoming LLC, and Cara signs as Member.

She runs the full revenue function across several simultaneous engagements at once, each with its own account, its own Slack, and its own confidentiality boundary. She travels domestically and internationally throughout the year, and relocates to Lyon, France on August 1, 2026, after which calendar reasoning defaults to CET. Her family schedule interleaves with all of it.

Design implication. Billi must always know which hat is on right now, which business, which inbox, which workspace, and must ask when it is ambiguous rather than guess. Crossing an engagement boundary is a failure even when the output looks helpful.

### 3.1 The engagement map (so references resolve)
| Engagement | Cara's role | Notes Billi must respect |
|---|---|---|
| Magical Teams (MT) | CRO | Embedded ops and revenue consultancy for $1M+ founder-led businesses. Three verticals, agencies, communities, psychedelic/wellness. `mt-internal-ops` Slack is internal only. |
| Dreamers & Doers (D&D) | Head of Expansion | Post-acquisition by Magical Teams. The D&D / MT acquisition is publicly announced and may be referenced openly. D&D content uses emojis liberally. |
| SOWM (Society of Working Moms) | Founding Revenue Advisor | Founder Kate Tovsen. Reactivation window September 2026 when Kate returns from leave. |
| Agency 6B | Fractional CRO | Founder Vix Reitano. Under a signed NDA. Client context stays inside 6B. Intro filter, diagnostic floor about $3,500, build phase about $20K. Never suggest for pre-revenue, early-stage, or solopreneurs. |
| Hedy Society | Advisor | Clients Corey Kupfer (DealQuest / Kupfer Law) and Neil and Dan Rosen (WildStork). Client context stays private. |
| VC venture scout | Scout | Sourcing early-stage biotech and femtech founders. |

### 3.2 Key people
Christina Salerno (MT founder/CEO, financial modeling), Taylor Harrington (D&D Head of Community, co-plans events with Cara), Vix Reitano (Agency 6B founder and client), Corey Kupfer (DealQuest host, mentor and friend of nearly a decade, wife is Rha Goddess), Alex Canedo (incoming MT CEO, runs the accelerator), Kate Tovsen (SOWM founder), Gesche Haas (D&D founder/seller), Kassidy Hardwyn (personal assistant from July 1, 2026). Family, Sam Katz (husband, computational biologist and immunologist, searching for a new role) and Hadassah "Haddie" (daughter, born January 18, 2024).

---

## 4. Personas and top use cases

One human, several modes.

### 4.1 Operator mode (running the engagements)
- "What needs my decision today across all the engagements?" Billi groups by engagement and never mixes 6B detail into a D&D summary.
- "Summarize the MT internal Slack since yesterday and draft replies to anything urgent." Drafts only.
- "How did Stripe do this week, any failed payments or disputes?" Read-only.
- "Pull my open tasks across Airtable and read me the top five by engagement."

### 4.2 Scheduler mode (calendar and coordination)
- "Find me 45 minutes with Taylor next week, mornings my time, and draft the invite." Held as a draft until sign-off.
- "Reschedule Friday, I am flying, and draft notes to the people affected."
- "Do I have a conflict between Haddie's pickup and my 4pm?" Family blocks are protected (section 9).

### 4.3 Communications mode (multi-inbox, multi-Slack)
- "Triage all my inboxes, what is actually for me, what can wait." Reading is free.
- "Draft a reply to the investor thread in the right account." Billi names the sending identity before anything goes out, and never sends without sign-off.
- "Draft a DM to Cara's D&D contact about the data." D&D house style allows emojis, Cara's personal content does not.

### 4.4 Travel mode
- "I need to be in Austin Tuesday and back Thursday night, find options and hold the best, then draft a placeholder for my calendar." Hold, never purchase.
- "My flight got delayed, find the rebook options and draft the notices to my afternoon meetings." Cara confirms before anything sends or books.

### 4.5 Family and home mode
- "Add Haddie's recital to the family calendar and remind me to buy a gift Friday."
- "What does the week look like for the family, any gaps in coverage?"
- Protected family time and Haddie's birthday, January 18, are never scheduled over.

### 4.6 Local work mode (files and docs)
- "Open the Q3 deck in my work folder, update the revenue slide with this week's Stripe numbers, and save a copy." Diff and confirm, never silent overwrite.
- "Find every contract PDF that mentions auto-renewal." Read across an allow-listed root.
- "Assemble the dossier for this founder." Output saved as `.md`, named `firstname_lastname_dossier.md`, sourced per the hierarchy in section 11.

---

## 5. Experience principles

1. Glanceable, not chatty. Voice replies are short and decision-oriented. Detail lives on screen.
2. Always show the work. Every action posts a card to the activity timeline with what changed, where, which identity, and an inspect or undo affordance.
3. Draft and hold. Reads and reversible local writes flow. Every external send, introduction, money action, and delete waits for sign-off.
4. Disambiguate, do not assume. When "my email" or "the Slack" is ambiguous, ask a one-word clarifying question and remember the answer for the session.
5. Interruptible. Cara can cut Billi off mid-sentence and she yields immediately.
6. Never manufacture urgency. Cara is a Reflector who decides on a lunar cycle (section 12). Batch non-urgent decisions, hold things for her to sit with, and flag only real deadlines.

---

## 6. Functional requirements

### 6.1 Voice interaction
- Wake and turn-taking. Push-to-talk hotkey and optional wake word "Billi". Barge-in supported, Cara's speech interrupts Billi's speech.
- Streaming speech-to-text with partial transcripts shown live, plus an explicit "go" affordance for noisy or sensitive moments.
- ElevenLabs text-to-speech with a configurable voice. Numbers, names, money amounts, and recipients are read back carefully before any risky action.
- Mixed input. Voice plus clicking on UI cards, for example "draft a reply to this" while a thread is on screen. Keyboard always available.
- Transcript of record. Every spoken exchange is logged as searchable, editable text.

### 6.2 Reasoning and orchestration
- A planner decomposes a request into steps across tools, presents a plan for multi-step or risky work, executes the safe parts, and holds the rest for sign-off.
- Tool use runs through a governed connector layer (section 8). Billi surfaces which connector and which identity each step uses.
- Memory (section 9) holds the entity map, the confidentiality walls, preferences, and the voice rules.
- Watches and triggers are standing conditions Cara sets, for example "tell me if Stripe gets a dispute" or "flag anything in the founder inbox that names a real deadline." Watches inform, they never auto-act.

### 6.3 Local file and document operations
- Read, write, move, and rename within explicitly granted root folders. Never the whole disk by default.
- Open, edit, and save Markdown, text, code, and CSV, and read office docs and PDFs through converters. Document outputs are saved as `.md`, never `.docx`.
- Diff and confirm on edits to existing files. Never silently overwrite. Keep a backup, support undo. Surgical edits only unless a full rewrite is requested, and flag what changed and why.
- Honor a `.billignore` exclusion file and the OS permissions.

### 6.4 Activity timeline and audit
- Chronological feed of every action, the input, the plan, the connector and identity used, the result, and the sign-off. Filterable by connector, engagement, and risk tier.
- Each entry links to the artifact it touched, the calendar event, the draft, the file diff, and offers inspect, undo, and redo where possible.

### 6.5 Sign-off and autonomy controls
- A settings surface maps every capability to a risk tier and a default behavior. See section 11.
- Dry-run mode. Billi plans and shows what it would do without executing.

---

## 7. Voice and UI design

### 7.1 The desktop UI (local)
- Persistent companion window, summonable via hotkey, with a listening-state indicator (idle, listening, thinking, speaking, awaiting sign-off), a live transcript, the activity timeline, sign-off cards that pop for held actions, and a "today" dashboard.
- The dashboard shows a cross-account calendar with family blocks marked, top inbox items per identity, Slack mentions per workspace, the Stripe pulse, and travel-day flags. After August 1, 2026 it reasons in CET.
- Screen-context awareness. If Cara has a thread or file open in Billi, "this" resolves to it.
- Offline-capable shell. Local file work and queued actions function without network. Cloud actions queue and replay on reconnect, with a re-confirm on anything time-sensitive.

### 7.2 Conversational design
- Replies lead with the answer or the action taken, then offer detail.
- Sign-off prompts are specific and read back the identity, for example "Drafted to the investor thread from the founder account, ready when you are." Billi states the sending identity every time.
- Graceful repair. Misheard names and amounts are easy to correct mid-flow, and high-risk actions confirm the parsed value, not the raw audio.

### 7.3 Drafting in Cara's voice (enforced, not optional)
Any draft Cara might send or publish carries her voice or it comes back for a full rewrite. The full rules live in `CLAUDE.md` section 6. Billi enforces them at draft time.
- Hard formatting blocks. No em dashes ever. No colons in prose. No emojis in Cara's own professional or Substack content, with the exception of D&D content which matches their emoji-heavy house style. No hashtags on LinkedIn. No bullets or headers in Substack or long-form prose. No "it is not X it is Y" construction in any form. No staccato repetition as a formula. No manufactured profundity. Run-on sentences over clipped staccato.
- Banned words and phrases are enforced from the list in `CLAUDE.md`. Never cite McKinsey or Gallup. No throat-clearing openers. No career-longevity references.
- Structure. Scene first, the personal earns the professional and the order never reverses. Specificity over abstraction. Open inside a moment, close on a verdict.
- LinkedIn DM protocol on every connection. Open with "Thanks for the connection request." Close with the scheduling link. No subject lines, greetings, or signatures. Paragraph break every two sentences. Formal register.
- The voice is biblical and bitter, declarative and earned, no corporate polish. Billi never softens the edge to feel safe.

---

## 8. Integrations (connector layer)

All integrations sit behind a connector abstraction with scoped token storage, per-connector read/write flags, rate-limit handling, retries with backoff, and a uniform audit hook. Connectors are added incrementally.

| Connector | v1 scope | Key actions | Notes and edge cases |
|---|---|---|---|
| Google Calendar (multiple) | R/W, send held | List, create, update, suggest times, find free time | Multiple calendars including family. Time-zone math for travel. CET default after 2026-08-01. Never schedule over protected family blocks. |
| Gmail (multiple accounts) | R/W, draft-first | Search, read, label, draft, send on sign-off | Identity disambiguation mandatory. Never cross-send between identities. Never cross engagement boundaries. |
| Slack (multiple workspaces) | R/W, draft-first | Read channels, threads, DMs, search, draft, send on sign-off, schedule | Per-workspace identity. `mt-internal-ops` is internal only. Guest vs member capability differs and is surfaced, not silently failed. |
| Stripe | Read-only in v1 | Balances, payouts, charges, failed payments, disputes, subscriptions, MRR | No money movement in v1. Any future write is T3, confirmed, capped, and follows Cara's money sequence (section 14). |
| Local filesystem | R/W, allow-listed roots | Read, write, move, rename, edit docs, search | Backups and diffs. `.billignore`. No access outside granted roots. Outputs as `.md`. |
| Granola | Read | List meetings, get by ID, natural-language single-concept queries | Primary source for meeting and transcript intelligence. |
| Grain | Read | Transcripts and summaries | Fallback only when Granola lacks the meeting. Cara plans to sunset Grain. |
| Fireflies | Read | Transcripts | Unreliable, avoid as default. |
| Airtable, Network Matching Engine | R/W | `list_records_for_table` pageSize 50 to 100 | Base `appSNjA3YxRLr2yvH`, table `tbl19escd0SaYHkHS`. First stop for introductions and network matching. Listing beats search for candidate surfacing. |
| Airtable, LinkedIn CRM | R/W | Read and create contacts | Base `appgp94U9aYOymEc8`, table `tblwLseddJ6dQVODO`. Use `typecast:true` for all creates. |
| Google Drive, dossier library | R | Read full dossiers, search | Folder owned by us@myfavoritescientist.com. Read full dossiers, never skim snippets. Confirm geography, budget, stage, and overlap before including or excluding. |
| Travel search (for example Kiwi) | Read plus hold | Flight search, hold | Booking and purchase are never automatic. Hold and draft a placeholder, Cara confirms. Track hold expiry. |
| Canva | R/W | Design assets | Pairs with local files for hybrid workflows. |

Adding connectors is a first-class extensibility point. A connector SDK declares auth, capability, and the audit hook so anything else relevant can be brought in. Candidates, banking or accounting read-only, SMS for travel alerts, maps and rideshare.

### 8.1 Source-of-truth hierarchy (do not pull from the wrong place)
1. Meeting and transcript intelligence. Granola first, Grain only as fallback, avoid Fireflies as default.
2. Introductions and network matching. Airtable Network Matching Engine first. Do not source intros from transcripts.
3. Dossiers. The Drive dossier library, read in full.
4. Factual questions. Project knowledge and history are authoritative. Do not say "I do not have that" until both have been checked.
5. LinkedIn contacts. The Airtable LinkedIn CRM base.

---

## 9. Memory and the wall map

Billi maintains a personal knowledge graph so she does not re-ask known things and never crosses a confidentiality boundary.

- Entities. People with role, which engagement, preferred channel, and time zone. Engagements with which inbox, Slack, Stripe, and calendar belong to each. Family members and protected blocks.
- The wall map. Each engagement is a separate stream. D&D context never enters a 6B thread. MT internal detail never enters a client-facing draft. 6B and Hedy client context stays private. The D&D / MT acquisition is public and may be referenced openly.
- Preferences. Meeting defaults and buffers, travel preferences, the voice rules, and the no-manufactured-urgency rule.
- Family. Sam, and Haddie born January 18, 2024. Protected family time and Haddie's birthday are never scheduled over.
- Provenance and correction. Every learned fact records where it came from and can be edited or forgotten by voice.
- Storage. Local-first, encrypted at rest, fully inspectable and exportable. Memory never leaves the machine except through an explicit connector call.

---

## 10. Architecture (reference)

```
Local machine
  Desktop UI (companion window, timeline, today dashboard)
        | voice in/out (ElevenLabs TTS), clicks
  Billi core (local service)
     - speech-to-text (streaming)
     - planner / orchestrator (Claude, latest models)
     - tool router  - memory + wall map (encrypted)
     - sign-off / risk engine  - audit log
        |                         |
   local FS                  connector calls (scoped tokens, TLS)
   (allow-listed roots)           |
                                   v
   Cloud connectors: Calendar - Gmail xN - Slack xN - Stripe(R) -
   Airtable(Network + CRM) - Granola/Grain - Drive - Travel - Canva
```

- The local service owns secrets, memory, the wall map, audit, and the sign-off engine. The model reasons but reaches a connector only through the router, which enforces scope, identity, engagement boundary, and risk tier.
- Secrets live in the OS keychain or an encrypted local vault, never in plaintext and never in the model context.
- Only connector traffic leaves the machine, over TLS. The UI, the files, and the memory stay local.

---

## 11. Security, privacy, and trust

This is the make-or-break of the product. Billi touches money, email identities, NDA'd client context, and a family's life.

### 11.1 Risk tiers and defaults
| Tier | Examples | Default |
|---|---|---|
| T0 read | List calendar, read inbox, Stripe balance, read transcripts, search files | Auto |
| T1 reversible local or internal write | Create a draft, label email, add an event on own calendar, edit a file with backup | Auto, shown in timeline |
| T2 external or visible action | Send email, post to Slack, send a calendar invite, make an introduction | Always sign-off in v1 |
| T3 money, bookings, destructive | Stripe refund or payout, flight purchase, delete anything | Hard-disabled in v1, money movement out of scope |

Cara can tune T2 defaults per recipient or per identity over time. T3 stays gated.

### 11.2 Identity and engagement isolation
- Each email account and Slack workspace is a distinct identity with its own signature, send permission, and color.
- Billi never sends from or replies across identities without naming the identity in the sign-off prompt.
- Billi never moves context across an engagement boundary. The wall map in section 9 is enforced at draft time, not just at send time.

### 11.3 Hard nevers (from `CLAUDE.md` section 4)
- Never recommend, refer, or introduce anyone to Jerry Malcolm (InvestKept / Icon Streamer), in any context, ever.
- Every introduction is double opt-in. Confirm both sides want it before anything goes out. No exceptions.
- Never call revenue "a system."

### 11.4 Local file safety
- Operations confined to allow-listed roots, everything else invisible.
- Edits create backups, deletes go to a recoverable trash, bulk operations escalate and in v1 deletes are disabled.
- Honor `.billignore` and OS permissions.

### 11.5 Prompt-injection and untrusted content
- Email bodies, Slack messages, web pages, file contents, and meeting transcripts are untrusted data, not instructions. Content that tries to make Billi act never triggers a T2 or T3 action, and outbound actions derived from inbound content always show provenance.

### 11.6 Secrets and principal authentication
- Tokens and keys in the OS keychain or encrypted vault, rotated and revocable per connector. A panic command revokes all connector tokens at once.
- Voice alone is not proof of identity. T2 actions and idle-timeout resumes can require OS biometric or passphrase. Optional voice-match is a signal, never the sole gate. This matters most when others are nearby, which is often, given a toddler at home and frequent travel.

---

## 12. How Cara decides (and how Billi must behave)

Cara is a Human Design Reflector, all nine centers open, strategy Wait a Lunar Cycle, authority Lunar Cycle, profile 4/6. In practice Billi does not push for same-day decisions on anything that is not genuinely urgent. She batches non-urgent decisions, holds things for Cara to sit with, and gives room rather than nudging "approve now" or "decide today." Manufactured urgency fights how Cara works. Real, time-bound deadlines are flagged clearly and never invented.

---

## 13. Lyon relocation and the human handoff

- Relocation to Lyon, France on August 1, 2026. After that, default time-zone logic shifts to CET. This is baked in now so calendar reasoning does not break in August. Domestic and international travel happens throughout.
- Kassidy Hardwyn is the personal assistant, contract effective July 1, 2026. Kassidy does not own travel. Billi draws the Billi-versus-Kassidy line clearly so they do not collide on the same tasks, and does not assume travel logistics are Kassidy's by default. Where ownership is unclear, Billi asks rather than acts.

---

## 14. Money philosophy

If Billi touches Stripe or frames any financial decision she follows Cara's sequence, not generic advice, and she frames money as information for Cara to decide, never as a directive, and never moves money.
- Debt payoff before investing. Investing follows payoff, it does not run concurrently.
- The investment base is near zero. Do not assume a surplus to deploy.
- Equity events are the lever that moves the asset goals, central not incidental.
- Commission on gross new revenue beats profit share. Profits interest beats phantom equity for tax treatment on exit.
- The Lyon move changes the income-need math. Factor it in.

---

## 15. Edge cases and failure handling

### 15.1 Disambiguation
- "My email" across several inboxes, ask which, remember for the session.
- "Tell the team", which engagement and which channel, confirm scope.
- Two people with the same first name, resolve by engagement and recent context, then confirm.
- Vague time near a week boundary or across time zones while traveling, restate the resolved absolute date and time, in CET after August.

### 15.2 Engagement-boundary hazards
- Reply-all storms and cross-identity replies.
- Almost pulling 6B or Hedy client detail into a D&D or member-facing draft. Billi blocks at draft time and explains why.
- Slack guest vs member capability gaps, detect and explain, do not silently fail.

### 15.3 Voice and speech failures
- Mishearing names, amounts, or addresses, read back and confirm the parsed value.
- Noisy environment or partial utterance, ask to repeat rather than guess.
- Someone else speaking near the mic, do not execute T2 from unverified input, require principal authentication for sensitive actions.

### 15.4 Calendar and family
- Time-zone drift while traveling, DST, the CET cutover on August 1.
- Protected family blocks and Haddie's birthday, January 18, never scheduled over. When a block's protection is unclear, ask before scheduling into it.
- Editing recurring events, this vs all future, and events Cara does not own.

### 15.5 Travel
- Held vs booked vs purchased, never auto-purchase, track hold expiry and warn.
- Delay or cancellation triggers a rebook-and-notify draft that waits for sign-off.
- Itineraries that touch the family calendar and Sam's calendar.

### 15.6 Money and Stripe
- Read-only in v1, surface failed payments and disputes proactively as a watch.
- If write is ever enabled, refunds and payouts are T3, confirmed with amount and recipient read-back, and capped.

### 15.7 Local files
- File changed on disk since Billi read it, re-diff, do not clobber.
- Large or binary files handled or refused gracefully, permission errors explained.
- No accidental bulk delete, deletes are disabled in v1.

### 15.8 System and connectivity
- Network loss, queue cloud actions, keep local work flowing, replay on reconnect with a re-confirm on anything time-sensitive.
- Connector outage, rate limit, or expired token, degrade gracefully, say which arm is down, retry with backoff.
- Conflicting watches, prioritize and batch, do not talk over herself, and never manufacture urgency.

### 15.9 Conversational
- Interruptions, yield immediately and roll back the in-flight step if not yet committed.
- Ambiguous undo, confirm which action.
- Cara changes her mind mid-plan, re-plan from current state.

---

## 16. Roadmap and phasing

### Phase 0, foundations (read and draft, build trust)
- Local desktop shell and voice loop, speech-to-text, ElevenLabs TTS, barge-in, transcript.
- Connectors, Calendar R, Gmail R plus draft, one Slack workspace R plus draft, Stripe R, local files R/W in allow-listed roots, Granola R.
- Activity timeline, sign-off engine, encrypted memory and wall map, audit log, voice-rule enforcement at draft time.
- Success, Cara does morning triage and local doc work by voice daily, with zero boundary crossings.

### Phase 1, acting on the world (signed-off sends)
- Send email and post Slack on sign-off, full multi-account and multi-workspace identity isolation, calendar create and update including invites, Airtable Network Matching Engine and LinkedIn CRM, dossier assembly from Drive.
- Double opt-in introduction workflow. Watches and the today dashboard across all engagements.
- Success, Cara sends, schedules, and coordinates without opening the apps, and introductions always confirm both sides.

### Phase 2, travel, relocation, and proactive ops
- Travel search, hold, and rebook drafts, itinerary to calendars automation, the CET cutover.
- Proactive surfacing of Stripe disputes, real deadlines, and conflicts, with quiet hours and no manufactured urgency.
- The Billi-versus-Kassidy task boundary.
- Success, a flight delay is handled end-to-end as a single sign-off, and August's relocation does not break calendar reasoning.

### Phase 3, depth and extensibility
- Connector SDK for anything else relevant, richer memory, the full Cara voice guide added to the repo, and a gated reconsideration of Stripe writes if Cara expands scope in writing.

---

## 17. Success metrics
- Adoption, daily voice sessions, and the share of coordination actions done via Billi versus native apps.
- Trust, the rate at which Cara overrides a proposed draft trending down, and zero cross-identity or cross-engagement incidents.
- Time saved, self-reported minutes per day reclaimed, and fewer app switches.
- Reliability, action success rate, recovery time from connector outages, and the speech correction rate.
- Safety, zero unauthorized T2 or T3 actions, zero boundary crossings, and 100% of actions in the audit log.

---

## 18. Open questions
1. Platform, which OS first for the local shell, which drives keychain, file-permission, and packaging choices.
2. Wake word vs push-to-talk as the default, given a toddler and frequent travel mean others are often in earshot.
3. Always-listening boundaries, what is recorded vs transient, and where.
4. Stripe writes, ever in scope, and with what caps, only if Cara expands scope in writing.
5. The Billi-versus-Kassidy line, where exactly it sits once Kassidy starts July 1.
6. Memory backup, local-only or optional encrypted cloud backup.
7. Latency budget, the acceptable voice round-trip for "feels live."

---

## 19. Glossary
- Principal, Cara Katz, the single human Billi serves.
- Connector, a governed integration to one external service.
- Identity, a specific sendable account, an email address or a Slack workspace membership, with its own permissions and signature.
- Engagement boundary, the confidentiality wall around one client or business that context must not cross.
- Risk tier T0 to T3, the sensitivity class of an action that governs whether it auto-runs, shows in the timeline, waits for sign-off, or is disabled.
- Watch, a standing condition that makes Billi surface something, never act on it.
- Allow-listed root, a directory Billi may read and write.
