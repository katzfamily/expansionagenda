// Billi's WhatsApp connector — via Twilio, draft-and-confirm only.
//
// Guardrail: Billi NEVER sends a WhatsApp on her own. Her tool only *stages* a
// message into an outbox (whatsapp-outbox.json). It is sent solely when Cara
// taps Send in the dashboard, which calls the send endpoint here. So the actual
// send is always a human action, consistent with "no external message without
// per-instance sign-off."
//
// Auth: Twilio Account SID + Auth Token (Basic auth) from .env. Sender is the
// WhatsApp sandbox number by default. Recipients must have joined the sandbox.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MEMORY_DIR, ensureMemoryDir } from "./paths.mjs";

const OUTBOX_FILE = join(MEMORY_DIR, "whatsapp-outbox.json");
const CONTACTS_FILE = join(MEMORY_DIR, "whatsapp-contacts.json");

const ensureDir = ensureMemoryDir;

function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    /* fall through */
  }
  return fallback;
}

// --- config ---------------------------------------------------------------
export function config() {
  return {
    sid: process.env.TWILIO_ACCOUNT_SID || "",
    token: process.env.TWILIO_AUTH_TOKEN || "",
    from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886", // sandbox default
  };
}

export function isConfigured() {
  const c = config();
  return Boolean(c.sid && c.token && c.from);
}

// Normalize a raw number to E.164-ish (+digits). US 10-digit numbers get +1.
function normalizeNumber(raw) {
  let n = String(raw).replace(/^whatsapp:/i, "").trim();
  const digits = n.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  return `+${bare}`;
}

// --- contacts (name -> whatsapp number) -----------------------------------
export function loadContacts() {
  return readJson(CONTACTS_FILE, []);
}

export function saveContact(name, number) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("Contact needs a name.");
  const num = normalizeNumber(number);
  if (!/^\+\d{6,}$/.test(num)) throw new Error(`"${number}" is not a valid phone number.`);
  ensureDir();
  const contacts = loadContacts().filter((c) => c.name.toLowerCase() !== clean.toLowerCase());
  contacts.push({ name: clean, number: num });
  writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
  return { name: clean, number: num };
}

// Resolve "Sam", a saved name, or a raw number to { number, label }.
export function resolveRecipient(toHint) {
  const hint = String(toHint || "").trim();
  if (!hint) throw new Error("Who should this go to?");
  // "me" / own number shortcut from .env.
  if (/^(me|myself|my phone|my number|cara)$/i.test(hint) && process.env.MY_WHATSAPP_NUMBER) {
    return { number: normalizeNumber(process.env.MY_WHATSAPP_NUMBER), label: "you" };
  }
  // Looks like a phone number?
  if (/[\d]/.test(hint) && /^[+\d().\-\s]+$/.test(hint)) {
    return { number: normalizeNumber(hint), label: normalizeNumber(hint) };
  }
  // Saved contact by name (case-insensitive contains).
  const match = loadContacts().find((c) => c.name.toLowerCase().includes(hint.toLowerCase()));
  if (match) return { number: match.number, label: match.name };
  throw new Error(
    `No WhatsApp number for "${hint}". Ask Cara for the number, or save it first with save_whatsapp_contact.`,
  );
}

// --- outbox (staged, awaiting Cara's tap) ---------------------------------
export function loadOutbox() {
  return readJson(OUTBOX_FILE, []);
}

function writeOutbox(items) {
  ensureDir();
  writeFileSync(OUTBOX_FILE, JSON.stringify(items, null, 2));
}

function nextId(items) {
  return items.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
}

export function stageMessage({ number, label, body, source }, createdAt) {
  const text = String(body || "").trim();
  if (!text) throw new Error("Nothing to send — the message is empty.");
  const items = loadOutbox();
  const item = {
    id: nextId(items),
    to: number,
    toLabel: label || number,
    body: text,
    source: source ? String(source).trim() : null,
    status: "pending",
    createdAt: createdAt || null,
  };
  items.push(item);
  writeOutbox(items);
  return item;
}

export function discard(id) {
  const items = loadOutbox();
  const next = items.filter((x) => String(x.id) !== String(id));
  if (next.length === items.length) throw new Error(`No staged message with id ${id}.`);
  writeOutbox(next);
  return true;
}

// Pending (staged, not yet sent) messages.
export function pending() {
  return loadOutbox().filter((x) => x.status === "pending");
}

// Render pending messages for the system prompt so Billi knows what is staged
// and can send the right one by id once Cara confirms out loud.
export function pendingForPrompt() {
  const p = pending();
  if (!p.length) return "";
  const list = p
    .map((x) => `[${x.id}] to ${x.toLabel}: "${x.body.slice(0, 80)}${x.body.length > 80 ? "…" : ""}"`)
    .join("\n");
  return `\n\n---\n\nStaged WhatsApp messages waiting in Cara's Outbox (not sent). Send one\nwith send_whatsapp by its id only after Cara confirms out loud:\n${list}`;
}

// Actually send a staged message through Twilio. Called only by the send
// endpoint, which the dashboard Send button triggers.
export async function sendStaged(id) {
  const items = loadOutbox();
  const item = items.find((x) => String(x.id) === String(id));
  if (!item) throw new Error(`No staged message with id ${id}.`);
  if (!isConfigured()) throw new Error("Twilio is not configured in .env.");
  const c = config();

  const to = item.to.startsWith("whatsapp:") ? item.to : `whatsapp:${item.to}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`;
  const auth = Buffer.from(`${c.sid}:${c.token}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: c.from, Body: item.body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Surface Twilio's own message (e.g. recipient hasn't joined the sandbox,
    // or the 24-hour free-form window has closed).
    throw new Error(data.message || `Twilio ${res.status}`);
  }
  // Mark sent and keep a short record.
  item.status = "sent";
  item.sid = data.sid || null;
  writeOutbox(items);
  return { sid: item.sid, to: item.toLabel };
}
