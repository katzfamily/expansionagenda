// Billi v0 — local voice-loop server.
// Bridges the browser orb to Deepgram (speech-to-text), Claude (reasoning),
// and ElevenLabs (text-to-speech). Runs entirely on the local machine.
//
//   node billi/server.mjs      (or: npm run billi)
//
// Keys are read from the repo-root .env (gitignored). Billi's operating
// context and guardrails are loaded from the repo-root CLAUDE.md and used as
// the system prompt, so even this first version knows who she is.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "./lib/env.mjs";
import * as gmail from "./lib/gmail.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PUBLIC = join(HERE, "public");
const PORT = process.env.BILLI_PORT || 8787;

loadEnv(join(ROOT, ".env"));

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const VOICE_ID = process.env.BILLI_VOICE_ID || "nklDUw4Cfwv6KJmhU9Vy";
// Default to a fast model for snappy voice turns. Set BILLI_MODEL in .env to
// claude-opus-4-8 if you want maximum reasoning quality over speed.
const MODEL = process.env.BILLI_MODEL || "claude-sonnet-4-6";

// Billi's persona/guardrails come from CLAUDE.md; append voice-mode framing.
const operatingContext = existsSync(join(ROOT, "CLAUDE.md"))
  ? readFileSync(join(ROOT, "CLAUDE.md"), "utf8")
  : "";
const SYSTEM_PROMPT = `${operatingContext}

---

You are Billi, speaking out loud to Cara through a voice interface. Your reply
is read aloud by a text-to-speech voice, so:
- Respond only with your final spoken answer. No preamble, no reasoning aloud,
  no markdown, no bullet points, no headers, no emoji.
- Be brief and conversational. Lead with the answer. Offer to elaborate rather
  than dumping detail.
- You have a Gmail connector with read and draft access across Cara's
  connected inboxes. Use it for triage, search, reading, and drafting. Tools:
  list_email_accounts, search_email (Gmail query syntax like is:unread,
  from:, newer_than:2d), read_email_thread, draft_email, draft_reply.
- You CANNOT send email. draft_email and draft_reply only save to Gmail Drafts
  for Cara to review and send herself. Never say or imply a message was sent.
- When the inbox is ambiguous and more than one is connected, ask which one
  before acting, and never cross context between inboxes. Always name the
  inbox you used.
- You do not yet have calendar, Slack, or Stripe. If asked for those, say so
  plainly and offer to note it for when that connector is wired up.
- Never invent facts, deadlines, or data. Honor the guardrails above.`;

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// --- helpers --------------------------------------------------------------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

// --- API handlers ---------------------------------------------------------

// Speech -> text via Deepgram.
async function handleListen(req, res) {
  if (!DEEPGRAM_API_KEY) return json(res, 500, { error: "DEEPGRAM_API_KEY not set in .env" });
  const audio = await readBody(req);
  if (!audio.length) return json(res, 400, { error: "no audio received" });
  const contentType = req.headers["content-type"] || "audio/webm";
  const url = "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true";
  const dg = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, "Content-Type": contentType },
    body: audio,
  });
  if (!dg.ok) return json(res, 502, { error: `Deepgram ${dg.status}: ${await dg.text()}` });
  const data = await dg.json();
  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  json(res, 200, { transcript });
}

// Gmail tools exposed to Claude. Read + draft only — there is no send tool.
const TOOLS = [
  {
    name: "list_email_accounts",
    description:
      "List the Gmail inboxes connected to Billi. Call this to know which inboxes exist or to disambiguate before another email action.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_email",
    description:
      "Search a Gmail inbox using Gmail query syntax (e.g. 'is:unread', 'from:taylor newer_than:3d', 'subject:invoice'). Call this whenever Cara asks about her email, inbox, what's new, who emailed, or to triage. Returns sender, subject, date, and snippet per thread.",
    input_schema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which inbox (email address or a distinctive part of it). Omit only if just one is connected.",
        },
        query: { type: "string", description: "Gmail search query." },
        max_results: { type: "integer", description: "How many threads to return (default 8)." },
      },
      required: ["query"],
    },
  },
  {
    name: "read_email_thread",
    description:
      "Read the full text of one email thread. Call after search_email when you need the actual contents to summarize or draft a reply.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Which inbox." },
        thread_id: { type: "string", description: "threadId from search_email." },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "draft_email",
    description:
      "Create a NEW email draft in Gmail Drafts. Saves a draft only — it does NOT send. Use when Cara asks to write or draft a new email.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Which inbox to draft from." },
        to: { type: "string", description: "Recipient email address." },
        subject: { type: "string" },
        body: { type: "string", description: "Plain-text body, in Cara's voice." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "draft_reply",
    description:
      "Draft a reply within an existing thread, saved to Gmail Drafts. Does NOT send. Use when Cara asks to reply to a message you found.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Which inbox." },
        thread_id: { type: "string", description: "threadId of the thread to reply to." },
        body: { type: "string", description: "Plain-text reply body, in Cara's voice." },
      },
      required: ["thread_id", "body"],
    },
  },
];

// Run one tool call. Pushes a human-readable label onto `actions` for the UI.
async function executeTool(name, input, actions) {
  if (name === "list_email_accounts") {
    actions.push("checked connected inboxes");
    const accts = gmail.loadAccounts().map((a) => a.email);
    return accts.length ? `Connected inboxes: ${accts.join(", ")}` : "No inboxes connected yet.";
  }
  if (name === "search_email") {
    const acct = gmail.resolveAccount(input.account);
    const results = await gmail.searchEmail(acct, input.query, input.max_results || 8);
    actions.push(`searched ${acct.email} for "${input.query}"`);
    if (!results.length) return `No threads in ${acct.email} match "${input.query}".`;
    return (
      `Results from ${acct.email}:\n` +
      results
        .map((r, i) => `${i + 1}. [thread ${r.threadId}] ${r.from} — ${r.subject} (${r.date})\n   ${r.snippet}`)
        .join("\n")
    );
  }
  if (name === "read_email_thread") {
    const acct = gmail.resolveAccount(input.account);
    const msgs = await gmail.readThread(acct, input.thread_id);
    actions.push(`read a thread in ${acct.email}`);
    return msgs.join("\n\n---\n\n").slice(0, 12000);
  }
  if (name === "draft_email") {
    const acct = gmail.resolveAccount(input.account);
    const id = await gmail.draftEmail(acct, { to: input.to, subject: input.subject, body: input.body });
    actions.push(`drafted an email to ${input.to} in ${acct.email} (saved to Drafts, not sent)`);
    return `Draft saved to ${acct.email} Drafts (id ${id}). To: ${input.to}. Not sent — Cara reviews and sends.`;
  }
  if (name === "draft_reply") {
    const acct = gmail.resolveAccount(input.account);
    const d = await gmail.draftReply(acct, input.thread_id, input.body);
    actions.push(`drafted a reply to ${d.to} in ${acct.email} (saved to Drafts, not sent)`);
    return `Reply draft saved to ${acct.email} Drafts (id ${d.id}). To: ${d.to}, Subject: ${d.subject}. Not sent.`;
  }
  throw new Error(`Unknown tool: ${name}`);
}

// Conversation -> reply text via Claude, with a Gmail tool-use loop.
async function handleRespond(req, res) {
  if (!anthropic) return json(res, 500, { error: "ANTHROPIC_API_KEY not set in .env" });
  const { messages } = JSON.parse((await readBody(req)).toString() || "{}");
  if (!Array.isArray(messages) || !messages.length) {
    return json(res, 400, { error: "messages array required" });
  }
  const convo = [...messages];
  const actions = [];
  try {
    let finalText = "";
    for (let step = 0; step < 6; step++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        output_config: { effort: "low" }, // fast turns for voice
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: convo,
      });
      finalText = resp.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      const toolUses = resp.content.filter((b) => b.type === "tool_use");
      if (!toolUses.length) break;
      convo.push({ role: "assistant", content: resp.content });
      const results = [];
      for (const tu of toolUses) {
        try {
          const out = await executeTool(tu.name, tu.input, actions);
          results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
        } catch (err) {
          results.push({ type: "tool_result", tool_use_id: tu.id, content: err.message, is_error: true });
        }
      }
      convo.push({ role: "user", content: results });
    }
    json(res, 200, { text: finalText, actions });
  } catch (err) {
    json(res, 502, { error: `Claude error: ${err.message}` });
  }
}

// Text -> speech via ElevenLabs (Billi's voice).
async function handleSpeak(req, res) {
  if (!ELEVENLABS_API_KEY) return json(res, 500, { error: "ELEVENLABS_API_KEY not set in .env" });
  const { text } = JSON.parse((await readBody(req)).toString() || "{}");
  if (!text) return json(res, 400, { error: "text required" });
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const el = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: process.env.BILLI_TTS_MODEL || "eleven_turbo_v2_5" }),
  });
  if (!el.ok) return json(res, 502, { error: `ElevenLabs ${el.status}: ${await el.text()}` });
  const audio = Buffer.from(await el.arrayBuffer());
  res.writeHead(200, { "content-type": "audio/mpeg", "content-length": audio.length });
  res.end(audio);
}

// Which keys are configured (so the UI can warn before the first turn).
function handleStatus(res) {
  json(res, 200, {
    deepgram: Boolean(DEEPGRAM_API_KEY),
    anthropic: Boolean(ANTHROPIC_API_KEY),
    elevenlabs: Boolean(ELEVENLABS_API_KEY),
    voiceId: VOICE_ID,
    model: MODEL,
  });
}

// --- static files ---------------------------------------------------------
async function serveStatic(req, res) {
  let path = req.url.split("?")[0];
  if (path === "/") path = "/index.html";
  const filePath = normalize(join(PUBLIC, path));
  if (!filePath.startsWith(PUBLIC)) return json(res, 403, { error: "forbidden" });
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    json(res, 404, { error: "not found" });
  }
}

// --- server ---------------------------------------------------------------
const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/listen") return await handleListen(req, res);
    if (req.method === "POST" && req.url === "/api/respond") return await handleRespond(req, res);
    if (req.method === "POST" && req.url === "/api/speak") return await handleSpeak(req, res);
    if (req.method === "GET" && req.url === "/api/status") return handleStatus(res);
    return await serveStatic(req, res);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Billi v0 is listening on http://localhost:${PORT}`);
  console.log(`  voice: ${VOICE_ID}   model: ${MODEL}`);
  const missing = [
    !DEEPGRAM_API_KEY && "DEEPGRAM_API_KEY",
    !ANTHROPIC_API_KEY && "ANTHROPIC_API_KEY",
    !ELEVENLABS_API_KEY && "ELEVENLABS_API_KEY",
  ].filter(Boolean);
  if (missing.length) console.log(`  ⚠ missing in .env: ${missing.join(", ")}`);
  console.log("");
});
