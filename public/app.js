/* Jam Board — live agenda for the Weekly Expansion Jam */

const TIME_MINUTES = { "5 min": 5, "10 min": 10, "15 min": 15, "20+ min": 20 };
const CALL_BUDGET_MIN = 60;

let state = null; // { backend, backendLabel, meetings, topics }
let selectedMeetingId = null;
let expanded = new Set();
let lastSnapshot = "";
let celebrated = new Set();

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------------- API ---------------- */

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: options.body ? { "content-type": "application/json" } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function applyState(next) {
  state = next;
  const snapshot = JSON.stringify([next.meetings, next.topics]);
  if (snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;
  render();
}

async function refresh({ quiet = false } = {}) {
  try {
    applyState(await api("state"));
    setSync("live");
  } catch (err) {
    setSync("error");
    if (!quiet) toast(`Couldn't load the board: ${err.message}`);
  }
}

async function mutate(path, options, optimistic) {
  if (optimistic) {
    optimistic();
    render();
  }
  try {
    applyState(await api(path, options));
    setSync("live");
    return true;
  } catch (err) {
    toast(err.message);
    await refresh({ quiet: true });
    return false;
  }
}

/* ---------------- helpers ---------------- */

function fmtDate(iso) {
  if (!iso) return "Undated";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function todayISO() {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local time
}

function defaultMeeting() {
  const upcoming = state.meetings
    .filter((m) => m.status === "upcoming" && m.date >= todayISO())
    .sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming[0]) return upcoming[0];
  const anyUpcoming = state.meetings.filter((m) => m.status === "upcoming").at(-1);
  return anyUpcoming || state.meetings.at(-1) || null;
}

function currentMeeting() {
  return state.meetings.find((m) => m.id === selectedMeetingId) || defaultMeeting();
}

function topicsFor(meetingId) {
  return state.topics.filter((t) => t.meetingId === meetingId && t.priority !== "parking");
}

function parkingTopics() {
  return state.topics.filter((t) => t.priority === "parking" && !t.covered);
}

function getWho() {
  return localStorage.getItem("jamWho") || "";
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function toast(msg) {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function setSync(mode) {
  const dot = $("#sync-dot");
  dot.className = `sync-dot ${mode === "live" ? "live" : mode === "error" ? "error" : ""}`;
  dot.title = mode === "live" ? "Live — syncing every few seconds" : "Sync issue — retrying";
}

/* ---------------- rendering ---------------- */

function render() {
  renderWho();
  renderTabs();
  renderMain();
  renderFooter();
}

function renderWho() {
  const el = $("#whoami");
  const who = getWho();
  el.innerHTML = ["Cara", "Taylor", "Tori"]
    .map((n) => `<button data-who="${n}" class="${who === n ? "active" : ""}">${n}</button>`)
    .join("");
}

function renderTabs() {
  const meeting = currentMeeting();
  selectedMeetingId = meeting?.id || null;
  const tabs = state.meetings
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => {
      const status = m.status === "done" ? "✅" : m.status === "skipped" ? "❌" : "";
      return `<button class="meeting-tab ${m.id === selectedMeetingId ? "active" : ""}" data-meeting="${m.id}">
        ${fmtDate(m.date)} <span class="tab-status">${status}</span>
      </button>`;
    });
  $("#meeting-tabs").innerHTML = tabs.join("");
}

function topicCard(t) {
  const minutes = TIME_MINUTES[t.timeNeeded] || 0;
  const isExpanded = expanded.has(t.id);
  return `
  <article class="topic ${t.covered ? "covered" : ""} ${isExpanded ? "expanded" : ""}" data-id="${t.id}">
    <button class="tickbox ${t.covered ? "on" : ""}" data-action="toggle" aria-label="Mark covered" title="${t.covered ? "Covered! Click to undo" : "Cross off as covered"}">✓</button>
    <div class="topic-body">
      <span class="topic-title" data-action="expand">${escapeHtml(t.topic)}</span>
      <div class="topic-meta">
        <span class="meta-chip who-${escapeHtml(t.submittedBy)}">${escapeHtml(t.submittedBy)}</span>
        <span class="meta-chip">⏱ ${minutes}${t.timeNeeded === "20+ min" ? "+" : ""} min</span>
        ${t.priority === "must" ? '<span class="meta-chip prio-must">🔥 must cover</span>' : ""}
        ${t.needsData ? '<span class="meta-chip data">📊 data from Tori</span>' : ""}
      </div>
      <div class="topic-extra">
        ${t.details ? `<div class="topic-details">${escapeHtml(t.details)}</div>` : ""}
        ${t.needsData && t.dataAsk ? `<div class="data-ask">📊 <strong>Data ask:</strong> ${escapeHtml(t.dataAsk)}</div>` : ""}
        <label class="outcome-label" for="outcome-${t.id}">Outcome / next steps</label>
        <textarea id="outcome-${t.id}" class="outcome-input" data-action="outcome" placeholder="Decisions + who's doing what…">${escapeHtml(t.outcome)}</textarea>
      </div>
      ${!isExpanded && t.outcome ? `<div class="outcome-view">→ ${escapeHtml(t.outcome)}</div>` : ""}
    </div>
    <div class="topic-side">
      <div class="topic-actions">
        ${t.priority !== "parking"
          ? `<button class="icon-btn" data-action="park" title="Send to parking lot">🅿️</button>`
          : `<button class="icon-btn" data-action="unpark" title="Bring to this week's agenda">⬆️</button>`}
        <button class="icon-btn" data-action="delete" title="Delete topic">🗑</button>
      </div>
    </div>
  </article>`;
}

function renderMain() {
  const main = $("#main");
  // Don't blow away in-progress typing in an outcome box.
  if (main.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA") return;

  const meeting = currentMeeting();
  if (!meeting) {
    main.innerHTML = `<div class="empty"><span class="big">📞</span>No meetings yet — add one to get jamming.</div>`;
    return;
  }

  const topics = topicsFor(meeting.id);
  const must = topics.filter((t) => t.priority === "must");
  const iftime = topics.filter((t) => t.priority === "iftime");
  const parking = parkingTopics();

  const total = topics.length;
  const covered = topics.filter((t) => t.covered).length;
  const plannedMin = topics.filter((t) => !t.covered)
    .reduce((sum, t) => sum + (TIME_MINUTES[t.timeNeeded] || 0), 0);
  const pct = total ? Math.round((covered / total) * 100) : 0;

  const isPast = meeting.status !== "upcoming";
  const uncoveredLeft = total - covered;

  main.innerHTML = `
    <div class="meeting-head">
      <div>
        <h2>${fmtDate(meeting.date)} ${meeting.status === "done" ? "· wrapped ✅" : ""}</h2>
        <div class="sub">${total} topic${total === 1 ? "" : "s"} on deck · submitted all week, crossed off live</div>
      </div>
      <div class="meeting-head-actions meeting-links">
        ${meeting.zoomLink ? `<a class="link-pill" href="${escapeHtml(meeting.zoomLink)}" target="_blank" rel="noopener">🎥 Join Zoom</a>` : ""}
        ${meeting.firefliesLink ? `<a class="link-pill" href="${escapeHtml(meeting.firefliesLink)}" target="_blank" rel="noopener">🔥 Fireflies recap</a>` : ""}
        ${isPast && !meeting.firefliesLink ? `<input class="fireflies-input" id="fireflies-input" type="url" placeholder="Paste Fireflies recap link…" />` : ""}
        ${!isPast ? `<button class="btn btn-light btn-small" id="btn-wrapup">Wrap up meeting ✅</button>` : ""}
      </div>
    </div>

    <div class="progress-wrap">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-label">
        <span>${covered} of ${total} covered ${pct === 100 && total > 0 ? "— that's a wrap! 🎉" : ""}</span>
        <span class="${plannedMin > CALL_BUDGET_MIN ? "time-warning" : ""}">
          ${plannedMin} min still planned${plannedMin > CALL_BUDGET_MIN ? ` — over the ${CALL_BUDGET_MIN} min call! ✂️` : ""}
        </span>
      </div>
    </div>

    <div class="section-title">🔥 Must cover <span class="count">${must.length}</span></div>
    ${must.map(topicCard).join("") || `<div class="empty">Nothing flagged 🔥 yet.</div>`}

    <div class="section-title">💬 If time allows <span class="count">${iftime.length}</span></div>
    ${iftime.map(topicCard).join("") || `<div class="empty">Open runway — add something!</div>`}

    <div class="section-title">🅿️ Parking lot <span class="count">${parking.length}</span></div>
    ${parking.map(topicCard).join("") ||
      `<div class="empty"><span class="big">🅿️</span>Ideas that aren't for this week live here.</div>`}
  `;

  if (pct === 100 && total > 0 && !celebrated.has(meeting.id)) {
    celebrated.add(meeting.id);
    confetti();
  }
  if (uncoveredLeft === 0) celebrated.add(meeting.id); // don't re-fire on reload of a done board
}

function renderFooter() {
  const note = $("#backend-note");
  if (state.backend === "airtable") {
    note.innerHTML = `Synced live with the team's <a href="https://airtable.com/appd47FpAzqZCzTQM" target="_blank" rel="noopener">Airtable base</a> 🗂`;
  } else {
    note.textContent = "Stored on Netlify Blobs · add an AIRTABLE_TOKEN env var to sync with the Airtable base";
  }
}

/* ---------------- events ---------------- */

document.addEventListener("click", async (e) => {
  const whoBtn = e.target.closest("[data-who]");
  if (whoBtn) {
    localStorage.setItem("jamWho", whoBtn.dataset.who);
    renderWho();
    return;
  }

  const tab = e.target.closest(".meeting-tab");
  if (tab) {
    selectedMeetingId = tab.dataset.meeting;
    render();
    return;
  }

  if (e.target.id === "btn-wrapup") {
    const meeting = currentMeeting();
    const leftovers = topicsFor(meeting.id).filter((t) => !t.covered).length;
    const msg = leftovers
      ? `Wrap up ${fmtDate(meeting.date)}? ${leftovers} uncovered topic${leftovers === 1 ? "" : "s"} will roll to next week's jam.`
      : `Wrap up ${fmtDate(meeting.date)}?`;
    if (!confirm(msg)) return;
    const data = await api("rollover", { method: "POST", body: { fromMeetingId: meeting.id } })
      .catch((err) => (toast(err.message), null));
    if (data) {
      applyState(data);
      toast(data.rolled ? `Wrapped! ${data.rolled} topic${data.rolled === 1 ? "" : "s"} rolled forward 📦` : "Wrapped — clean sweep, nothing rolled! 🧹");
    }
    return;
  }

  const card = e.target.closest(".topic");
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!card || !action) return;
  const id = card.dataset.id;
  const topic = state.topics.find((t) => t.id === id);
  if (!topic) return;

  if (action === "toggle") {
    const next = !topic.covered;
    await mutate(`topics/${id}`, { method: "PATCH", body: { covered: next } }, () => {
      topic.covered = next;
    });
  } else if (action === "expand") {
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    render();
  } else if (action === "park") {
    await mutate(`topics/${id}`, { method: "PATCH", body: { priority: "parking" } }, () => {
      topic.priority = "parking";
    });
    toast("Sent to the parking lot 🅿️");
  } else if (action === "unpark") {
    const meeting = currentMeeting();
    await mutate(
      `topics/${id}`,
      { method: "PATCH", body: { priority: "iftime", meetingId: meeting.id } },
      () => { topic.priority = "iftime"; topic.meetingId = meeting.id; }
    );
    toast(`Moved onto ${fmtDate(meeting.date)} 💬`);
  } else if (action === "delete") {
    if (!confirm(`Delete "${topic.topic}"?`)) return;
    await mutate(`topics/${id}`, { method: "DELETE" }, () => {
      state.topics = state.topics.filter((t) => t.id !== id);
    });
  }
});

// Save outcome notes on blur
document.addEventListener("focusout", async (e) => {
  if (e.target.dataset?.action !== "outcome") return;
  const card = e.target.closest(".topic");
  const topic = state.topics.find((t) => t.id === card?.dataset.id);
  if (!topic || topic.outcome === e.target.value.trim()) return;
  const value = e.target.value.trim();
  await mutate(`topics/${topic.id}`, { method: "PATCH", body: { outcome: value } }, () => {
    topic.outcome = value;
  });
  toast("Outcome saved ✍️");
});

// Fireflies link on past meetings
document.addEventListener("change", async (e) => {
  if (e.target.id !== "fireflies-input") return;
  const meeting = currentMeeting();
  const value = e.target.value.trim();
  if (!value) return;
  await mutate(`meetings/${meeting.id}`, { method: "PATCH", body: { firefliesLink: value } }, () => {
    meeting.firefliesLink = value;
  });
  toast("Fireflies recap linked 🔥");
});

/* ---------------- dialogs ---------------- */

const topicDialog = $("#topic-dialog");
const meetingDialog = $("#meeting-dialog");

$("#btn-new-topic").addEventListener("click", () => {
  const form = $("#topic-form");
  form.reset();
  const who = getWho();
  if (who) form.querySelector(`input[name="submittedBy"][value="${who}"]`).checked = true;
  $("#data-ask-field").classList.add("hidden");
  topicDialog.showModal();
});
$("#topic-cancel").addEventListener("click", () => topicDialog.close());
$("#needs-data-toggle").addEventListener("change", (e) => {
  $("#data-ask-field").classList.toggle("hidden", !e.target.checked);
});

$("#topic-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const meeting = currentMeeting();
  if (!data.submittedBy) {
    toast("Tell us who you are first 👋");
    return;
  }
  localStorage.setItem("jamWho", data.submittedBy);
  topicDialog.close();
  const ok = await mutate("topics", {
    method: "POST",
    body: {
      ...data,
      needsData: !!data.needsData,
      meetingId: data.priority === "parking" ? meeting?.id : meeting?.id,
    },
  });
  if (ok) toast(data.needsData ? "Added — Tori's been flagged for data 📊" : "Topic added to the jam 🚀");
});

$("#btn-new-meeting").addEventListener("click", () => {
  const form = $("#meeting-form");
  form.reset();
  const last = state?.meetings?.at(-1);
  if (last) {
    const d = new Date(`${last.date}T12:00:00`);
    d.setDate(d.getDate() + 7);
    form.date.value = d.toLocaleDateString("sv-SE");
    form.zoomLink.value = last.zoomLink || "";
  }
  meetingDialog.showModal();
});
$("#meeting-cancel").addEventListener("click", () => meetingDialog.close());

$("#meeting-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  meetingDialog.close();
  const ok = await mutate("meetings", { method: "POST", body: { ...data, status: "upcoming" } });
  if (ok) {
    selectedMeetingId = null; // snap to the new default
    toast("Meeting on the books 📅");
    render();
  }
});

/* ---------------- confetti ---------------- */

function confetti() {
  const canvas = $("#confetti");
  const ctx = canvas.getContext("2d");
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const colors = ["#ff5a5f", "#ff8a3d", "#ffb13d", "#1fae6e", "#8a5cf6", "#14b8a6", "#ec4899"];
  const bits = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    vx: -1.5 + Math.random() * 3,
    vy: 2.5 + Math.random() * 3.5,
    rot: Math.random() * Math.PI,
    vr: -0.12 + Math.random() * 0.24,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) {
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = Math.max(0, 1 - t / 3000);
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (t < 3000) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })(start);
}

/* ---------------- live sync loop ---------------- */

setInterval(() => {
  if (document.hidden) return;
  if (topicDialog.open || meetingDialog.open) return;
  if (document.activeElement?.tagName === "TEXTAREA") return;
  refresh({ quiet: true });
}, 4000);

refresh();
