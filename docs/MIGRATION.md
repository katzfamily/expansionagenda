# Migration playbook — move Jam Board into Dreamers & Doers

This guide moves the entire Jam Board system out of Cara's personal accounts and
into Dreamers & Doers–owned accounts, so the team owns and maintains it (not just
Cara). Work top to bottom — the order matters.

> **Time:** ~30–40 minutes. **Who:** Cara (current owner) + whoever holds the
> Dreamers & Doers shared logins. **Downtime:** none if you follow the order.

---

## 0. The mental model — what "this" actually is

Jam Board is **four separate assets** living in **four accounts**. "Moving it to
the D&D Claude account" means giving each asset a Dreamers & Doers home, and then
pointing the team's shared Claude account at those new homes.

| # | Asset | What it is | Lives now in | Needs to live in |
|---|-------|-----------|--------------|------------------|
| 1 | **GitHub repo** `katzfamily/expansionagenda` | the app's source code | Cara's GitHub (`katzfamily`) | a D&D GitHub org |
| 2 | **Netlify site** `expansion-jam-board` | hosts the live site + serverless API | Cara's Netlify (`us@myfavoritescientist.com`) | a D&D Netlify team |
| 3 | **Airtable base** `appd47FpAzqZCzTQM` | the live data + archive | Cara's Airtable ("My First Workspace") | a D&D Airtable workspace |
| 4 | **Claude account + connectors** | the control surface you talk to | Cara's Claude login | the D&D shared Claude login (`membership@…`) |

The live site (`expansion-jam-board.netlify.app`) keeps working throughout — you're
changing *ownership*, not rebuilding.

> **Heads up — there is a bug to fix along the way.** Topics added on the board
> aren't saving because the current Airtable token is missing **write** access.
> Step 3 regenerates that token correctly, which fixes it. Don't skip it.

---

## 1. Move the GitHub repo

**Goal:** `katzfamily/expansionagenda` → `dreamers-and-doers/expansionagenda` (or
whatever the D&D org is called).

1. Make sure a **Dreamers & Doers GitHub organization** exists and Cara is a member
   of it. (If the team doesn't use GitHub yet, create a free org at
   github.com/organizations/plan — name it for D&D.)
2. In the repo: **Settings → General → Danger Zone → Transfer ownership.**
3. Type the new owner (the D&D org) and confirm.
4. GitHub keeps all history, branches (`main` + the working branch), and sets up a
   redirect from the old URL, so nothing breaks immediately.

**If the team would rather not use GitHub at all:** that's fine — the code is also
fully reproducible from the Netlify site. But keeping it in a D&D-owned repo is
strongly recommended so future Claude Code sessions can edit and auto-deploy it.

✅ **Checkpoint:** the repo opens at the new `dreamers-and-doers/…` URL and Cara can
still see it.

---

## 2. Move the Netlify site

**Goal:** the `expansion-jam-board` site → a Dreamers & Doers Netlify team.

1. Create (or identify) a **Dreamers & Doers Netlify team**: app.netlify.com →
   team switcher → **Add a team** (the Starter tier is free and enough for this).
2. Add Cara to that team (Team settings → Members), or have a D&D admin do the
   transfer in step 3.
3. Open the site → **Site configuration → General → Danger zone → Transfer site to
   another team** → pick the D&D team.
4. **Re-link the code repo** (because it moved in Step 1): Site configuration →
   Build & deploy → **Link repository** → choose `dreamers-and-doers/expansionagenda`,
   production branch **`main`**. Build settings come from `netlify.toml` automatically.
5. **Check the environment variable carried over:** Site configuration →
   Environment variables. You should see `AIRTABLE_TOKEN`. If it's missing, you'll
   add it in Step 3 — leave it for now.

The public URL `expansion-jam-board.netlify.app` stays the same unless you rename it.

✅ **Checkpoint:** the site appears under the D&D Netlify team and the **Deploys**
tab shows the GitHub repo connected.

---

## 3. Move the Airtable base + fix the token (this fixes the "not saving" bug)

**Goal:** base `appd47FpAzqZCzTQM` → a D&D Airtable workspace, with a fresh
team-owned token that has **read AND write** access.

### 3a. Move the base
1. Identify (or create) a **Dreamers & Doers Airtable workspace**, with a D&D owner.
2. Add Cara as an owner of that workspace (or have a D&D owner perform the move).
3. In Airtable, open the base → click the base name → **Move base** → select the
   D&D workspace.
   *The base ID stays `appd47FpAzqZCzTQM` after a workspace move, so no code change
   is needed.*

### 3b. Create a new token (the bug fix)
The old token (created under Cara's login, and pasted into chat earlier) should be
**replaced** — both to move ownership and because it's missing write access.

1. Sign in to Airtable as the **Dreamers & Doers** account.
2. Go to **airtable.com/create/tokens → Create token.** Name it `Jam Board`.
3. **Scopes — add BOTH** (this is the part that was missing):
   - `data.records:read`
   - `data.records:write`  ← **the one that fixes topics not saving**
4. **Access:** add the base **Expansion Jam 📞 Agenda**.
5. Create it and copy the `pat…` value.

### 3c. Put the new token on Netlify
1. Netlify → the site → **Site configuration → Environment variables.**
2. Add/update key **`AIRTABLE_TOKEN`**, value = the new `pat…`, and mark it
   **Secret**. (If `AIRTABLE_TOKEN` already exists from the old token, edit it.)
3. **Deploys → Trigger deploy → Deploy site** so the functions pick it up.

> If you ever rebuild the base from scratch instead of moving it, the base ID
> changes. In that case also add an env var **`AIRTABLE_BASE_ID`** = the new
> `app…` id. The code reads it automatically; no edit required.

✅ **Checkpoint:** open the live site, add a test topic, refresh — it persists, and
it shows up as a new row in the Airtable base. The bug is fixed. (Then delete the
test topic and the old "✅ Airtable sync test" row.)

### 3d. Revoke the old token
Back in **airtable.com/create/tokens**, delete the **old** token (the one that was
pasted in chat). It's no longer used and should not linger.

---

## 4. Move the Claude control surface (the "D&D Claude account")

**Goal:** the team's shared Claude login (`membership@…`) can run and maintain Jam
Board, instead of it being tied to Cara's Claude account.

1. Sign in to the **Dreamers & Doers shared Claude account**.
2. **Reconnect the connectors** there (Settings → Connectors), authenticating each
   as Dreamers & Doers:
   - **GitHub** → grant access to the D&D org / the `expansionagenda` repo.
   - **Netlify** → the D&D Netlify team.
   - **Airtable** → the D&D workspace.
   - Plus the others the team uses (Asana, Fireflies, Canva, Zoom).
3. **Recreate the Claude Project** (if the team runs this from a Claude Project):
   create a new project in the D&D account named e.g. *"Jam Board / Expansion Jam,"*
   and paste in the contents of [`CLAUDE_PROJECT_INSTRUCTIONS.md`](./CLAUDE_PROJECT_INSTRUCTIONS.md).
4. **For future code changes:** start a Claude Code session from the D&D Claude
   account pointed at `dreamers-and-doers/expansionagenda`. It will have the right
   access end-to-end (edit code → push → Netlify auto-deploys).

> If Dreamers & Doers is on a **Claude Team/Enterprise plan** rather than a single
> shared login, connectors are set up per member — each teammate who needs to
> maintain Jam Board connects GitHub/Netlify/Airtable under their own seat. The
> repo/site/base from steps 1–3 are shared, so this still works.

✅ **Checkpoint:** from the D&D Claude account, ask it to "list the topics on the
Jam Board Airtable base" — if it answers, the connectors are wired correctly.

---

## 5. Final verification checklist

- [ ] Repo opens under the D&D GitHub org; `main` is the default branch.
- [ ] Netlify site is under the D&D team and linked to the D&D repo on `main`.
- [ ] `AIRTABLE_TOKEN` (with read **and** write) is set; last deploy is green.
- [ ] Adding a topic on the live site **persists** and appears in Airtable.
- [ ] Old Airtable token is **revoked**; test rows cleaned up.
- [ ] D&D Claude account's connectors point at the D&D repo/site/base.
- [ ] Asana task description links to `expansion-jam-board.netlify.app`.

---

## What I (Claude) can and can't do here

- **I can't** perform the ownership transfers in steps 1–4 myself — they happen in
  GitHub/Netlify/Airtable/Claude UIs and require the destination Dreamers & Doers
  accounts, which I'm not signed into. Those steps are yours.
- **I can**, from a Claude session connected to the new accounts: update the env
  var, trigger redeploys, edit the code, and verify the data. Once you've done the
  transfers, hand me the new token (or just say "go") and I'll finish the wiring.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the pieces fit together and
[`OPERATIONS.md`](./OPERATIONS.md) for the day-to-day runbook.
