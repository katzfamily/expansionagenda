// One-time Gmail authorization for Billi. Run once per inbox:
//
//   npm run billi:connect-gmail
//
// Opens Google's consent screen, captures the code on a localhost redirect,
// exchanges it for a refresh token, and saves the account to
// billi/.gmail-accounts.json (gitignored). Repeat for each inbox.
//
// Prereq: a Google OAuth client (type "Desktop app") with the Gmail API
// enabled. Put its credentials in the repo-root .env:
//   GOOGLE_CLIENT_ID=...
//   GOOGLE_CLIENT_SECRET=...

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { loadEnv } from "./lib/env.mjs";
import { saveAccount } from "./lib/gmail.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(ROOT, ".env"));

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = process.env.BILLI_OAUTH_PORT || 8788;
const REDIRECT = `http://localhost:${PORT}`;
// read-only for triage; compose for creating drafts. Billi's code exposes no
// send function, so drafts are the only write it can make.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n  Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env.");
  console.error("  Create a Desktop-app OAuth client at https://console.cloud.google.com/");
  console.error("  (enable the Gmail API), then add both to .env.\n");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });

async function exchange(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function profileEmail(accessToken) {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Profile lookup failed (${res.status})`);
  return (await res.json()).emailAddress;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("No code in callback.");
    return;
  }
  try {
    const tokens = await exchange(code);
    if (!tokens.refresh_token) {
      throw new Error("No refresh token returned. Revoke prior access and retry (prompt=consent).");
    }
    const email = await profileEmail(tokens.access_token);
    saveAccount({ email, refresh_token: tokens.refresh_token });
    res.writeHead(200, { "content-type": "text/html" }).end(
      `<body style="font-family:system-ui;background:#0b0d12;color:#f4f1ea;padding:48px">
         <h2>Connected ${email}</h2><p>You can close this tab and return to the terminal.</p></body>`,
    );
    console.log(`\n  ✓ Connected ${email}\n  Run another time to add more inboxes, or 'npm run billi'.\n`);
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500).end(String(err.message));
    console.error(`\n  ✗ ${err.message}\n`);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Opening Google consent for authorization…`);
  console.log(`  If it doesn't open, paste this into your browser:\n\n  ${authUrl}\n`);
  // Best-effort auto-open on macOS.
  spawn("open", [authUrl.toString()], { stdio: "ignore" }).on("error", () => {});
});
