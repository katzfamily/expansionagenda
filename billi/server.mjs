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

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PUBLIC = join(HERE, "public");
const PORT = process.env.BILLI_PORT || 8787;

// --- tiny .env loader (no dependency) -------------------------------------
// Only sets vars that aren't already in the environment.
function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(join(ROOT, ".env"));

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const VOICE_ID = process.env.BILLI_VOICE_ID || "nklDUw4Cfwv6KJmhU9Vy";
const MODEL = process.env.BILLI_MODEL || "claude-opus-4-8";

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
- This is v0: you do not yet have live access to email, calendar, Slack, or
  Stripe. If asked to do something that needs a connector you don't have, say
  so plainly and offer to note it for when that connector is wired up.
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

// Conversation -> reply text via Claude.
async function handleRespond(req, res) {
  if (!anthropic) return json(res, 500, { error: "ANTHROPIC_API_KEY not set in .env" });
  const { messages } = JSON.parse((await readBody(req)).toString() || "{}");
  if (!Array.isArray(messages) || !messages.length) {
    return json(res, 400, { error: "messages array required" });
  }
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" }, // snappy turns for voice
      system: SYSTEM_PROMPT,
      messages,
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    json(res, 200, { text });
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
