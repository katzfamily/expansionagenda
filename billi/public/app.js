// Billi v0 — browser client.
// Push-to-talk: hold the orb (or Space) to record, release to send. The orb
// pulses with your voice while recording and with Billi's voice while she
// speaks. Loop: mic -> /api/listen (Deepgram) -> /api/respond (Claude) ->
// /api/speak (ElevenLabs) -> playback.

const orb = document.getElementById("orb");
const stateEl = document.getElementById("state");
const convoEl = document.getElementById("conversation");
const warnEl = document.getElementById("warn");
const ctx = orb.getContext("2d");

// Conversation history sent to Claude each turn (stateless API).
const messages = [];

// Shared amplitude (0..1) that drives the orb, updated by whichever source is
// live: the mic while recording, the audio element while speaking.
let amplitude = 0;
let phase = "idle"; // idle | listening | thinking | speaking
let audioCtx;

// ---- orb animation -------------------------------------------------------
function draw() {
  const w = orb.width;
  const h = orb.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const t = performance.now() / 1000;

  const idlePulse = 0.5 + 0.5 * Math.sin(t * 1.5);
  const energy = phase === "idle" ? idlePulse * 0.15 : Math.min(1, amplitude * 1.8);
  const base = 70;

  const color =
    phase === "speaking" ? "217,138,91" : phase === "listening" ? "110,168,254" : "150,160,180";

  for (let i = 3; i >= 0; i--) {
    const r = base + i * 22 + energy * (40 + i * 18);
    const alpha = (phase === "thinking" ? 0.16 : 0.26) - i * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color},${Math.max(0.04, alpha)})`;
    ctx.fill();
  }

  // core
  ctx.beginPath();
  ctx.arc(cx, cy, base * 0.55 + energy * 18, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${color},0.9)`;
  ctx.fill();

  if (phase === "thinking") {
    const a = (t * 2) % (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(cx, cy, base + 30, a, a + Math.PI / 2);
    ctx.strokeStyle = "rgba(244,241,234,0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// ---- analyser: turn an audio stream/element into amplitude ---------------
function ensureAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function meter(analyser) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  let stop = false;
  (function tick() {
    if (stop) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) {
      const x = (v - 128) / 128;
      sum += x * x;
    }
    amplitude = Math.sqrt(sum / data.length);
    requestAnimationFrame(tick);
  })();
  return () => {
    stop = true;
    amplitude = 0;
  };
}

// ---- conversation UI -----------------------------------------------------
function addTurn(who, text, actions) {
  const div = document.createElement("div");
  div.className = `turn ${who}`;
  const label = document.createElement("span");
  label.className = "who";
  label.textContent = who === "user" ? "You" : "Billi";
  div.appendChild(label);
  div.appendChild(document.createTextNode(text));
  if (actions && actions.length) {
    const acts = document.createElement("div");
    acts.className = "actions";
    acts.textContent = "↳ " + actions.join(" · ");
    div.appendChild(acts);
  }
  convoEl.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
  return div;
}

function setState(text) {
  stateEl.textContent = text;
}

// ---- recording -----------------------------------------------------------
let mediaRecorder;
let chunks = [];
let micStream;
let stopMeter;
let recording = false;

async function startRecording() {
  if (recording || phase === "speaking" || phase === "thinking") return;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setState("Microphone permission is needed to talk.");
    return;
  }
  recording = true;
  phase = "listening";
  setState("Listening…");

  const ac = ensureAudioCtx();
  const src = ac.createMediaStreamSource(micStream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  stopMeter = meter(analyser);

  chunks = [];
  mediaRecorder = new MediaRecorder(micStream);
  mediaRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mediaRecorder.onstop = onRecordingStop;
  mediaRecorder.start();
}

function stopRecording() {
  if (!recording) return;
  recording = false;
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
}

async function onRecordingStop() {
  if (stopMeter) stopMeter();
  micStream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
  if (blob.size < 1200) {
    phase = "idle";
    setState("Didn't catch that. Hold the orb and try again.");
    return;
  }
  await runTurn(blob);
}

// ---- the loop ------------------------------------------------------------
async function api(path, opts) {
  const res = await fetch(path, opts);
  const isJson = (res.headers.get("content-type") || "").includes("json");
  const payload = isJson ? await res.json() : res;
  if (!res.ok) throw new Error((isJson && payload.error) || `${path} failed (${res.status})`);
  return payload;
}

async function runTurn(audioBlob) {
  try {
    phase = "thinking";
    setState("Transcribing…");
    const { transcript } = await api("/api/listen", {
      method: "POST",
      headers: { "content-type": audioBlob.type },
      body: audioBlob,
    });
    if (!transcript.trim()) {
      phase = "idle";
      setState("Didn't catch that. Hold the orb and try again.");
      return;
    }
    addTurn("user", transcript);
    messages.push({ role: "user", content: transcript });

    setState("Thinking…");
    const { text, actions } = await api("/api/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    addTurn("billi", text, actions);
    messages.push({ role: "assistant", content: text });

    setState("Speaking…");
    await speak(text);
    phase = "idle";
    setState("Hold the orb or press and hold Space to talk");
  } catch (err) {
    phase = "idle";
    setState(err.message);
  }
}

async function speak(text) {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Speech failed");
  }
  const buf = await res.arrayBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
  const audio = new Audio(url);

  const ac = ensureAudioCtx();
  if (ac.state === "suspended") await ac.resume();
  const node = ac.createMediaElementSource(audio);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 512;
  node.connect(analyser);
  analyser.connect(ac.destination);

  phase = "speaking";
  const stop = meter(analyser);
  await audio.play();
  await new Promise((resolve) => (audio.onended = resolve));
  stop();
  URL.revokeObjectURL(url);
}

// ---- input wiring --------------------------------------------------------
orb.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  startRecording();
});
orb.addEventListener("pointerup", stopRecording);
orb.addEventListener("pointerleave", stopRecording);

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    startRecording();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    stopRecording();
  }
});

// ---- key check on load ---------------------------------------------------
(async () => {
  try {
    const s = await api("/api/status");
    const missing = [
      !s.deepgram && "DEEPGRAM_API_KEY (speech-to-text)",
      !s.anthropic && "ANTHROPIC_API_KEY (Claude)",
      !s.elevenlabs && "ELEVENLABS_API_KEY (voice)",
    ].filter(Boolean);
    if (missing.length) {
      warnEl.hidden = false;
      warnEl.textContent = `Add these to your .env, then restart the server:\n  ${missing.join("\n  ")}`;
    }
  } catch {
    /* status is best-effort */
  }
})();
