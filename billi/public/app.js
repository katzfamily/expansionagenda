// Billi v0 — browser client.
// Push-to-talk: hold the orb (or Space) to record, release to send. The orb
// pulses with your voice while recording and with Billi's voice while she
// speaks. Loop: mic -> /api/listen (Deepgram) -> /api/respond (Claude) ->
// /api/speak (ElevenLabs) -> playback.

const orb = document.getElementById("orb");
const stateEl = document.getElementById("state");
const convoEl = document.getElementById("conversation");
const warnEl = document.getElementById("warn");
const orbGlow = orb.querySelector(".orb-glow");
const orbTint = orb.querySelector(".orb-tint");
const orbPulse = orb.querySelector(".orb-pulse");
const orbRays = orb.querySelector(".orb-rays");

// Conversation history sent to Claude each turn (stateless API).
const messages = [];

// Shared amplitude (0..1) that drives the orb, updated by whichever source is
// live: the mic while recording, the audio element while speaking.
let amplitude = 0;
let phase = "idle"; // idle | listening | thinking | speaking
let audioCtx;

// ---- orb animation -------------------------------------------------------
// The design's reflective glass orb: a glow ring and an inner pulse that react
// to whatever audio is live. Periwinkle at rest and while listening, warm
// terracotta while Billi speaks.
const PERIWINKLE = "125,123,240";
const AMBER = "214,132,92";

function animateOrb() {
  const t = performance.now() / 1000;
  const idle = 0.5 + 0.5 * Math.sin(t * 1.4);
  // energy: gentle breathing at rest, audio-reactive while live.
  const energy = phase === "idle" ? idle * 0.5 : Math.min(1, amplitude * 2.1);
  const color = phase === "speaking" ? AMBER : PERIWINKLE;

  if (orbGlow) {
    orbGlow.style.background =
      `radial-gradient(circle, rgba(${color},${(0.3 + energy * 0.4).toFixed(3)}), rgba(${color},0) 70%)`;
  }
  if (orbTint) {
    orbTint.style.background =
      `radial-gradient(circle at 42% 28%, rgba(255,255,255,0.4), rgba(${color},0.14) 54%, rgba(${color},0.04) 80%, transparent)`;
  }
  if (orbRays) {
    orbRays.style.opacity = (0.22 + energy * 0.3).toFixed(3);
  }
  if (orbPulse) {
    const base = phase === "idle" ? 100 : phase === "speaking" ? 150 : 130;
    const size = Math.round(base + energy * 44);
    orbPulse.style.width = `${size}px`;
    orbPulse.style.height = `${size}px`;
    orbPulse.style.background =
      `radial-gradient(circle, rgba(${color},${(0.24 + energy * 0.22).toFixed(3)}), rgba(${color},0) 68%)`;
  }
  requestAnimationFrame(animateOrb);
}
requestAnimationFrame(animateOrb);

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
    // Billi may have saved a memory, captured a to-do, or staged a WhatsApp.
    if (window.billiRefreshMemory) window.billiRefreshMemory();
    if (window.billiRefreshTodos) window.billiRefreshTodos();
    if (window.billiRefreshOutbox) window.billiRefreshOutbox();

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

  const ac = ensureAudioCtx();
  if (ac.state === "suspended") await ac.resume();

  // Wire an audio element through an analyser so the orb still reacts.
  const audio = new Audio();
  const node = ac.createMediaElementSource(audio);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 512;
  node.connect(analyser);
  analyser.connect(ac.destination);

  phase = "speaking";
  const stop = meter(analyser);
  try {
    if (window.MediaSource && MediaSource.isTypeSupported("audio/mpeg")) {
      await playStream(res, audio); // starts on the first chunk
    } else {
      await playBlob(res, audio); // fallback: whole clip first
    }
  } finally {
    stop();
  }
}

// Progressive playback: append audio chunks to a MediaSource as they stream in,
// so Billi begins speaking almost immediately.
function playStream(res, audio) {
  return new Promise((resolve, reject) => {
    const ms = new MediaSource();
    audio.src = URL.createObjectURL(ms);
    audio.onended = resolve;
    audio.onerror = () => reject(new Error("Playback failed"));

    ms.addEventListener("sourceopen", async () => {
      URL.revokeObjectURL(audio.src);
      let sb;
      try {
        sb = ms.addSourceBuffer("audio/mpeg");
      } catch (err) {
        return reject(err);
      }
      const queue = [];
      let done = false;
      const pump = () => {
        if (sb.updating) return;
        if (queue.length) sb.appendBuffer(queue.shift());
        else if (done && ms.readyState === "open") {
          try {
            ms.endOfStream();
          } catch {
            /* already closed */
          }
        }
      };
      sb.addEventListener("updateend", pump);

      const reader = res.body.getReader();
      audio.play().catch(() => {});
      try {
        for (;;) {
          const { value, done: d } = await reader.read();
          if (d) {
            done = true;
            pump();
            break;
          }
          queue.push(value);
          pump();
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Fallback for browsers without MediaSource mpeg support.
async function playBlob(res, audio) {
  const buf = await res.arrayBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
  audio.src = url;
  await audio.play();
  await new Promise((resolve) => (audio.onended = resolve));
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

// ---- restore the saved conversation --------------------------------------
async function restoreConversation() {
  try {
    const { messages: saved } = await api("/api/conversation");
    if (!Array.isArray(saved) || !saved.length) return;
    for (const m of saved) {
      if (typeof m.content !== "string") continue;
      addTurn(m.role === "assistant" ? "billi" : "user", m.content);
      messages.push({ role: m.role, content: m.content });
    }
  } catch {
    /* best-effort — start fresh if it can't be restored */
  }
}

// Clear the saved thread on the server and in the UI.
const clearBtn = document.getElementById("clear-convo");
if (clearBtn) {
  clearBtn.addEventListener("click", async () => {
    if (!confirm("Clear the saved conversation? Billi's long-term memory is kept.")) return;
    try {
      await fetch("/api/conversation", { method: "DELETE" });
    } catch {
      /* clear locally regardless */
    }
    messages.length = 0;
    convoEl.textContent = "";
    setState("hold the orb or press and hold space to talk");
  });
}

// ---- voice tempo (Slow / Normal / Fast) ----------------------------------
const tempoButtons = Array.from(document.querySelectorAll(".tempo-seg button"));
function markTempo(speed) {
  for (const b of tempoButtons) {
    b.classList.toggle("on", Math.abs(Number(b.dataset.speed) - speed) < 0.01);
  }
}
for (const b of tempoButtons) {
  b.addEventListener("click", async () => {
    const speed = Number(b.dataset.speed);
    markTempo(speed);
    try {
      await fetch("/api/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ speed }),
      });
    } catch {
      /* the visual selection still updates */
    }
  });
}
(async () => {
  try {
    const { speed } = await api("/api/voice");
    markTempo(typeof speed === "number" ? speed : 1.1);
  } catch {
    markTempo(1.1);
  }
})();

// ---- key check on load ---------------------------------------------------
(async () => {
  await restoreConversation();
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
