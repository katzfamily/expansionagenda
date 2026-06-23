// Gmail connector for Billi — read + draft only. There is no send function
// here, by design: Billi's guardrails say she never sends without sign-off,
// so drafts land in Gmail's Drafts folder for Cara to review and send herself.
//
// Auth: OAuth 2.0 with a per-account refresh token (stored in
// billi/.gmail-accounts.json, gitignored). Access tokens are refreshed on
// demand via raw fetch — no googleapis dependency.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ACCOUNTS_FILE = join(HERE, "..", ".gmail-accounts.json");

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// --- account store --------------------------------------------------------
// Each account: { email, refresh_token }
export function loadAccounts() {
  if (!existsSync(ACCOUNTS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

export function saveAccount(account) {
  const accounts = loadAccounts().filter((a) => a.email !== account.email);
  accounts.push(account);
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  return accounts;
}

// Resolve a user-supplied account hint to a connected account.
export function resolveAccount(hint) {
  const accounts = loadAccounts();
  if (!accounts.length) {
    throw new Error("No Gmail accounts are connected. Run: npm run billi:connect-gmail");
  }
  if (!hint) {
    if (accounts.length === 1) return accounts[0];
    throw new Error(
      `Multiple inboxes are connected (${accounts.map((a) => a.email).join(", ")}). Ask which one.`,
    );
  }
  const match = accounts.find((a) => a.email.toLowerCase().includes(hint.toLowerCase()));
  if (!match) {
    throw new Error(
      `No connected inbox matches "${hint}". Connected: ${accounts.map((a) => a.email).join(", ")}`,
    );
  }
  return match;
}

// --- token refresh --------------------------------------------------------
const tokenCache = new Map(); // refresh_token -> { access_token, expiresAt }

async function accessToken(account) {
  const cached = tokenCache.get(account.refresh_token);
  if (cached && cached.expiresAt > Date.now()) return cached.access_token;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set in .env");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  tokenCache.set(account.refresh_token, {
    access_token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  });
  return data.access_token;
}

async function gapi(account, path, opts = {}) {
  const token = await accessToken(account);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- payload helpers ------------------------------------------------------
function header(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function decodePart(payload) {
  // Prefer text/plain; fall back to stripping a text/html part.
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = decodePart(p);
      if (t) return t;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url")
      .toString("utf8")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function buildRaw({ to, subject, body, inReplyTo, references }) {
  const lines = [`To: ${to}`, `Subject: ${subject}`];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"', "MIME-Version: 1.0", "", body);
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

// --- operations -----------------------------------------------------------

// Search using Gmail query syntax (is:unread, from:x, newer_than:2d, etc.).
// Results come back in Gmail's own order (most recent first) — no reordering
// here. Returns a page of results plus a nextPageToken for the following page,
// so callers can walk the inbox a batch at a time.
export async function searchEmail(account, query, maxResults = 5, pageToken) {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);
  const list = await gapi(account, `/messages?${params.toString()}`);
  if (!list.messages?.length) return { results: [], nextPageToken: null };
  const out = [];
  for (const { id } of list.messages) {
    const msg = await gapi(
      account,
      `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    out.push({
      id,
      threadId: msg.threadId,
      from: header(msg.payload.headers, "From"),
      subject: header(msg.payload.headers, "Subject"),
      date: header(msg.payload.headers, "Date"),
      snippet: msg.snippet || "",
    });
  }
  return { results: out, nextPageToken: list.nextPageToken || null };
}

// Full thread as readable text.
export async function readThread(account, threadId) {
  const thread = await gapi(account, `/threads/${threadId}?format=full`);
  return (thread.messages || []).map((m) => {
    const h = m.payload.headers;
    const body = decodePart(m.payload).trim();
    return `From: ${header(h, "From")}\nDate: ${header(h, "Date")}\nSubject: ${header(h, "Subject")}\n\n${body}`;
  });
}

// Create a brand-new draft (saved to Drafts, never sent).
export async function draftEmail(account, { to, subject, body }) {
  const raw = buildRaw({ to, subject, body });
  const draft = await gapi(account, "/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  return draft.id;
}

// Draft a reply in an existing thread (saved to Drafts, never sent).
export async function draftReply(account, threadId, body) {
  const thread = await gapi(account, `/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References`);
  const last = (thread.messages || []).at(-1);
  if (!last) throw new Error("Thread not found or empty.");
  const h = last.payload.headers;
  const to = header(h, "Reply-To") || header(h, "From");
  let subject = header(h, "Subject");
  if (!/^re:/i.test(subject)) subject = `Re: ${subject}`;
  const messageId = header(h, "Message-ID");
  const refs = header(h, "References");
  const raw = buildRaw({
    to,
    subject,
    body,
    inReplyTo: messageId,
    references: [refs, messageId].filter(Boolean).join(" "),
  });
  const draft = await gapi(account, "/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { raw, threadId } }),
  });
  return { id: draft.id, to, subject };
}
