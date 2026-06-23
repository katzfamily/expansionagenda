// Billi's long-term memory — the "project knowledge" layer.
//
// Two things live on disk under billi/memory/ (gitignored, private to Cara):
//   memory.json        durable facts/preferences Billi keeps and revises
//   conversation.json  the running transcript, so the thread survives reloads
// A human-readable memory.md mirror is written alongside so Cara can read or
// hand-edit what Billi remembers.
//
// This is deliberately a flat file store. One principal, one machine, no
// database. It is read and rewritten whole on every change — fine at this size.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "..", "memory");
const FACTS_FILE = join(DIR, "memory.json");
const MD_FILE = join(DIR, "memory.md");
const CONVO_FILE = join(DIR, "conversation.json");

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    /* corrupt or partial — fall back rather than crash a voice turn */
  }
  return fallback;
}

// --- durable facts --------------------------------------------------------

export function loadFacts() {
  return readJson(FACTS_FILE, []);
}

function writeFacts(facts) {
  ensureDir();
  writeFileSync(FACTS_FILE, JSON.stringify(facts, null, 2));
  writeMarkdownMirror(facts);
}

function writeMarkdownMirror(facts) {
  const lines = [
    "# What Billi remembers about Cara",
    "",
    "Billi keeps this herself from Cara's feedback. Editable by hand — but the",
    "JSON next to it is the source of truth the server loads, so prefer pruning",
    "through the dashboard.",
    "",
  ];
  if (!facts.length) {
    lines.push("_Nothing remembered yet._");
  } else {
    for (const f of facts) lines.push(`- ${f.text}`);
  }
  writeFileSync(MD_FILE, lines.join("\n") + "\n");
}

function nextId(facts) {
  const max = facts.reduce((m, f) => Math.max(m, Number(f.id) || 0), 0);
  return max + 1;
}

export function addFact(text, createdAt) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Cannot remember an empty note.");
  const facts = loadFacts();
  // Skip near-duplicates so memory doesn't bloat with repeats.
  if (facts.some((f) => f.text.toLowerCase() === clean.toLowerCase())) {
    return facts.find((f) => f.text.toLowerCase() === clean.toLowerCase());
  }
  const fact = { id: nextId(facts), text: clean, createdAt: createdAt || null };
  facts.push(fact);
  writeFacts(facts);
  return fact;
}

export function updateFact(id, text) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Cannot save an empty note.");
  const facts = loadFacts();
  const fact = facts.find((f) => String(f.id) === String(id));
  if (!fact) throw new Error(`No memory with id ${id}.`);
  fact.text = clean;
  writeFacts(facts);
  return fact;
}

export function removeFact(id) {
  const facts = loadFacts();
  const next = facts.filter((f) => String(f.id) !== String(id));
  if (next.length === facts.length) throw new Error(`No memory with id ${id}.`);
  writeFacts(next);
  return true;
}

// Render facts for the system prompt so Billi "knows" them every turn.
export function factsForPrompt() {
  const facts = loadFacts();
  if (!facts.length) return "";
  const list = facts.map((f) => `[${f.id}] ${f.text}`).join("\n");
  return `\n\n---\n\nWhat you remember about Cara (your long-term memory, kept from her\nfeedback across past conversations). Treat these as true and current. Each\nline is prefixed with its memory id for update_memory / forget:\n${list}`;
}

// --- conversation transcript ----------------------------------------------

export function loadConversation() {
  return readJson(CONVO_FILE, []);
}

export function saveConversation(messages) {
  ensureDir();
  // Keep only clean text turns and cap length so the file stays sane.
  const trimmed = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.content === "string")
    .slice(-200);
  writeFileSync(CONVO_FILE, JSON.stringify(trimmed, null, 2));
  return trimmed;
}

export function clearConversation() {
  ensureDir();
  writeFileSync(CONVO_FILE, JSON.stringify([], null, 2));
  return true;
}
