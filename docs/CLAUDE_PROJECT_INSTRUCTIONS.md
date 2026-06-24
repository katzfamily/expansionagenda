# Claude Project instructions (paste into the D&D Claude account)

When you recreate the Jam Board project under the Dreamers & Doers Claude account,
create a new Project and paste the block below into its **custom instructions**. It
gives Claude the context to maintain the app from the shared account.

---

```
You help maintain "Jam Board," the live agenda tool for the Dreamers & Doers
Weekly Expansion Jam call (Cara, Taylor, Tori + guests; Wednesdays 2:45–3:30 PM ET).

What it is: a no-build web app (static front end + one Netlify serverless function)
backed by an Airtable base, hosted on Netlify, source in GitHub.

Key facts:
- Live site: https://expansion-jam-board.netlify.app
- GitHub repo: <D&D org>/expansionagenda, production branch `main` (push to main → Netlify auto-deploys)
- Netlify site: expansion-jam-board (Dreamers & Doers team)
- Airtable base: "Expansion Jam 📞 Agenda" (Meetings + Agenda Topics tables)
- The app reads/writes Airtable when AIRTABLE_TOKEN is set on Netlify; that token
  needs BOTH data.records:read and data.records:write scopes.

Connectors this project uses: GitHub, Netlify, Airtable (and Asana, Fireflies,
Canva, Zoom for the broader workflow).

How to make changes:
- Code lives in public/ (index.html, styles.css, app.js) and
  netlify/functions/ (api.mjs + lib/ drivers). Edit, run `npm run smoke` to test,
  push to `main`, and Netlify deploys automatically.
- Keep element IDs, class names, data-action attributes, and form field names
  intact when restyling — the JavaScript depends on them.
- Never commit secrets. The only secret is AIRTABLE_TOKEN, which lives as a Netlify
  env var.

Docs to read first: docs/ARCHITECTURE.md, docs/OPERATIONS.md, docs/MIGRATION.md in
the repo.
```

---

Replace `<D&D org>` with the actual GitHub org name once Step 1 of the migration is
done.
