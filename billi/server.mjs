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
import * as memory from "./lib/memory.mjs";
import * as todos from "./lib/todos.mjs";
import * as whatsapp from "./lib/whatsapp.mjs";

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
const SYSTEM_BASE = `${operatingContext}

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
- You keep Cara's to-do list. Whenever you draft a reply or email that commits
  her to a follow-up action (a deliverable, a promised send, something due by a
  date), call add_todo to capture it, naming the person and any date, and set
  source to the inbox and recipient. Also add a task whenever she asks you to.
  Use complete_todo when she says one is done. Mention briefly what you added.
- When the inbox is ambiguous and more than one is connected, ask which one
  before acting, and never cross context between inboxes. Always name the
  inbox you used.
- Triage rule: when Cara asks you to triage or go through her inbox, present
  every email five at a time in the exact order Gmail returns them (most recent
  first). Do not filter, rank, skip, group, or judge which ones matter, and do
  not call anything urgent or important on your own. Read the five, then ask if
  she wants the next five and continue with the page token. Let Cara decide
  what matters.
- You have a long-term memory. When Cara tells you to remember something, states
  a lasting preference, corrects you in a way that should stick, or gives
  feedback about how she wants things done, call remember to save it. Use
  update_memory to revise a fact and forget to drop one that is wrong or stale.
  Keep each memory a single specific sentence. Do not save fleeting context or
  anything she would not want kept. Confirm briefly in your spoken reply when
  you remember or update something.
- You can forward things to people over WhatsApp. To forward an email, read the
  thread first, then compose a short WhatsApp message in Cara's voice and stage
  it with forward_via_whatsapp (this does NOT send — it adds it to her Outbox).
  After staging, read the message back to her and ask if you should send it now.
  Only when she clearly confirms ("yes", "send it") do you call send_whatsapp
  with that message's id to actually send it. If she does not confirm, leave it
  staged. Never call send_whatsapp without an explicit confirmation in the same
  conversation, and never say a message was sent unless send_whatsapp succeeded.
  She can also tap Send on the Outbox card herself. If you do not have the
  recipient's number, ask for it or save it with save_whatsapp_contact.
  Recipients must have joined the WhatsApp sandbox first.
- You do not yet have calendar, Slack, or Stripe. If asked for those, say so
  plainly and offer to note it for when that connector is wired up.
- Never invent facts, deadlines, or data. Honor the guardrails above.`;

// Built fresh each turn so memory edits take effect without a restart.
function buildSystemPrompt() {
  return SYSTEM_BASE + memory.factsForPrompt() + todos.todosForPrompt() + whatsapp.pendingForPrompt();
}

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
      "Search a Gmail inbox using Gmail query syntax (e.g. 'is:unread', 'from:taylor newer_than:3d', 'subject:invoice'). Call this whenever Cara asks about her email, inbox, what's new, who emailed, or to triage. Returns sender, subject, date, and snippet per thread, in Gmail's own order (most recent first). For triage, return them five at a time and pass back next_page_token to fetch the following five.",
    input_schema: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "Which inbox (email address or a distinctive part of it). Omit only if just one is connected.",
        },
        query: { type: "string", description: "Gmail search query." },
        max_results: { type: "integer", description: "How many threads to return (default 5)." },
        page_token: {
          type: "string",
          description: "Pass the next_page_token from a previous search to get the next batch (e.g. the next five).",
        },
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
  {
    name: "remember",
    description:
      "Save a durable fact or preference about Cara to long-term memory so you keep it across future conversations. Use when she tells you to remember something, states a lasting preference, or corrects you in a way that should persist. One specific sentence.",
    input_schema: {
      type: "object",
      properties: {
        note: { type: "string", description: "The single-sentence fact or preference to remember." },
      },
      required: ["note"],
    },
  },
  {
    name: "update_memory",
    description:
      "Revise an existing long-term memory by its id (ids are shown next to each remembered fact in your context). Use when a remembered fact changes.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "The memory id to update." },
        note: { type: "string", description: "The corrected single-sentence fact." },
      },
      required: ["id", "note"],
    },
  },
  {
    name: "forget",
    description:
      "Delete a long-term memory by its id when it is wrong, stale, or Cara asks you to forget it.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "The memory id to forget." },
      },
      required: ["id"],
    },
  },
  {
    name: "add_todo",
    description:
      "Add a task to Cara's to-do list. Use when you draft a reply or email that commits her to a follow-up, or when she asks to add a task. Phrase it as a clear action with the person and any date.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The action to do, e.g. 'Send Taylor the Q3 numbers by Thursday'." },
        source: {
          type: "string",
          description: "Where it came from, e.g. 'reply to Taylor in us@myfavoritescientist.com'. Optional.",
        },
      },
      required: ["task"],
    },
  },
  {
    name: "complete_todo",
    description: "Mark a to-do task done by its id (ids are shown next to each open task in your context).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "The task id to complete." },
      },
      required: ["id"],
    },
  },
  {
    name: "forward_via_whatsapp",
    description:
      "STAGE a WhatsApp message to Cara's Outbox for her to send. This does NOT send — it only queues the message until Cara taps Send. Use to forward an email (compose a short message from the thread you read) or to send any WhatsApp Cara asks for.",
    input_schema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient: a saved contact name, a phone number, or 'me' for Cara's own number.",
        },
        message: { type: "string", description: "The WhatsApp message text, in Cara's voice." },
        source: {
          type: "string",
          description: "Optional note on what this forwards, e.g. 'email from Taylor in us@myfavoritescientist.com'.",
        },
      },
      required: ["to", "message"],
    },
  },
  {
    name: "save_whatsapp_contact",
    description: "Save a WhatsApp contact so you can forward to them by name later.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Contact name, e.g. 'Sam'." },
        number: { type: "string", description: "Their phone number, e.g. +13045551234." },
      },
      required: ["name", "number"],
    },
  },
  {
    name: "send_whatsapp",
    description:
      "Actually SEND a staged WhatsApp message from the Outbox by its id. Call this ONLY after Cara has explicitly confirmed out loud that she wants it sent now. If she has not confirmed, do not call this.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "The staged message id (shown in your context). Omit only if exactly one is staged.",
        },
      },
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
    const { results, nextPageToken } = await gmail.searchEmail(
      acct,
      input.query,
      input.max_results || 5,
      input.page_token,
    );
    actions.push(`searched ${acct.email} for "${input.query}"`);
    if (!results.length) return `No threads in ${acct.email} match "${input.query}".`;
    const lines = results
      .map((r, i) => `${i + 1}. [thread ${r.threadId}] ${r.from} — ${r.subject} (${r.date})\n   ${r.snippet}`)
      .join("\n");
    const more = nextPageToken
      ? `\n\nMore beyond these. To show the next batch, search again with page_token: ${nextPageToken}`
      : `\n\nThat is the end of the results.`;
    return `Results from ${acct.email}, in inbox order (present these as-is, do not reorder or filter):\n${lines}${more}`;
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
  if (name === "remember") {
    const fact = memory.addFact(input.note, new Date().toISOString());
    actions.push(`remembered: "${fact.text}"`);
    return `Saved to long-term memory (id ${fact.id}): ${fact.text}`;
  }
  if (name === "update_memory") {
    const fact = memory.updateFact(input.id, input.note);
    actions.push(`updated memory ${fact.id}: "${fact.text}"`);
    return `Memory ${fact.id} updated to: ${fact.text}`;
  }
  if (name === "forget") {
    memory.removeFact(input.id);
    actions.push(`forgot memory ${input.id}`);
    return `Forgot memory ${input.id}.`;
  }
  if (name === "add_todo") {
    const todo = todos.addTodo(input.task, input.source, new Date().toISOString());
    actions.push(`added to-do: "${todo.text}"`);
    return `Added to the to-do list (id ${todo.id}): ${todo.text}`;
  }
  if (name === "complete_todo") {
    const todo = todos.setDone(input.id, true);
    actions.push(`completed to-do ${todo.id}: "${todo.text}"`);
    return `Marked task ${todo.id} done: ${todo.text}`;
  }
  if (name === "forward_via_whatsapp") {
    const rcpt = whatsapp.resolveRecipient(input.to);
    const item = whatsapp.stageMessage(
      { number: rcpt.number, label: rcpt.label, body: input.message, source: input.source },
      new Date().toISOString(),
    );
    actions.push(`staged a WhatsApp to ${rcpt.label} (awaiting Cara's tap to send)`);
    return `Staged a WhatsApp to ${rcpt.label} in the Outbox (id ${item.id}). NOT sent — Cara taps Send to send it.`;
  }
  if (name === "save_whatsapp_contact") {
    const c = whatsapp.saveContact(input.name, input.number);
    actions.push(`saved WhatsApp contact ${c.name}`);
    return `Saved ${c.name} (${c.number}) as a WhatsApp contact.`;
  }
  if (name === "send_whatsapp") {
    let id = input.id;
    if (id == null) {
      const p = whatsapp.pending();
      if (!p.length) return "Nothing is staged to send.";
      if (p.length > 1) {
        return `More than one message is staged (${p
          .map((x) => `id ${x.id} to ${x.toLabel}`)
          .join(", ")}). Ask Cara which one.`;
      }
      id = p[0].id;
    }
    const sent = await whatsapp.sendStaged(id); // throws on Twilio error → surfaced to Billi
    actions.push(`SENT a WhatsApp to ${sent.to}`);
    return `Sent the WhatsApp to ${sent.to} (Twilio id ${sent.sid}).`;
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
    const systemPrompt = buildSystemPrompt();
    for (let step = 0; step < 6; step++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        output_config: { effort: "low" }, // fast turns for voice
        system: systemPrompt,
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
    // Persist the clean text transcript so the thread survives a reload.
    memory.saveConversation([...messages, { role: "assistant", content: finalText }]);
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

// Memory widget: list, manually add, or remove a remembered fact.
async function handleMemory(req, res) {
  if (req.method === "GET") {
    return json(res, 200, { facts: memory.loadFacts() });
  }
  if (req.method === "POST") {
    const { note } = JSON.parse((await readBody(req)).toString() || "{}");
    try {
      const fact = memory.addFact(note, new Date().toISOString());
      return json(res, 200, { fact, facts: memory.loadFacts() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }
  if (req.method === "DELETE") {
    const { id } = JSON.parse((await readBody(req)).toString() || "{}");
    try {
      memory.removeFact(id);
      return json(res, 200, { facts: memory.loadFacts() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }
  json(res, 405, { error: "method not allowed" });
}

// To-do widget: list, add, toggle done, or remove a task.
async function handleTodos(req, res) {
  if (req.method === "GET") {
    return json(res, 200, { todos: todos.loadTodos() });
  }
  if (req.method === "POST") {
    const { task, source } = JSON.parse((await readBody(req)).toString() || "{}");
    try {
      const todo = todos.addTodo(task, source, new Date().toISOString());
      return json(res, 200, { todo, todos: todos.loadTodos() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }
  if (req.method === "PATCH") {
    const { id, done } = JSON.parse((await readBody(req)).toString() || "{}");
    try {
      todos.setDone(id, done);
      return json(res, 200, { todos: todos.loadTodos() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }
  if (req.method === "DELETE") {
    const { id } = JSON.parse((await readBody(req)).toString() || "{}");
    try {
      todos.removeTodo(id);
      return json(res, 200, { todos: todos.loadTodos() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }
  json(res, 405, { error: "method not allowed" });
}

// WhatsApp Outbox: list staged messages, send one (the human sign-off), or
// discard one. Sending is the ONLY place a WhatsApp actually goes out, and it
// is triggered by Cara tapping Send in the dashboard.
async function handleWhatsapp(req, res) {
  if (req.method === "GET") {
    return json(res, 200, { outbox: whatsapp.loadOutbox(), configured: whatsapp.isConfigured() });
  }
  const body = JSON.parse((await readBody(req)).toString() || "{}");
  if (req.method === "POST") {
    try {
      const sent = await whatsapp.sendStaged(body.id);
      return json(res, 200, { sent, outbox: whatsapp.loadOutbox() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }
  if (req.method === "DELETE") {
    try {
      whatsapp.discard(body.id);
      return json(res, 200, { outbox: whatsapp.loadOutbox() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }
  json(res, 405, { error: "method not allowed" });
}

// Conversation persistence: restore on load, or clear the thread.
async function handleConversation(req, res) {
  if (req.method === "GET") {
    return json(res, 200, { messages: memory.loadConversation() });
  }
  if (req.method === "DELETE") {
    memory.clearConversation();
    return json(res, 200, { messages: [] });
  }
  json(res, 405, { error: "method not allowed" });
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
    if (req.url === "/api/memory") return await handleMemory(req, res);
    if (req.url === "/api/todos") return await handleTodos(req, res);
    if (req.url === "/api/whatsapp") return await handleWhatsapp(req, res);
    if (req.url === "/api/conversation") return await handleConversation(req, res);
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
