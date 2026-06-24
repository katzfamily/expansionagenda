// Billi dashboard — the three summary cards (To-do / Memory / Drafts).
// Each card shows an at-a-glance summary from real data and expands on tap to
// reveal the full live list (which todos.js / memory.js / whatsapp.js render
// into the IDs inside). app.js calls refresh() after each turn.

const cards = {
  todo: document.getElementById("card-todo"),
  memory: document.getElementById("card-memory"),
  drafts: document.getElementById("card-drafts"),
};
const el = {
  todoTitle: document.getElementById("todo-sum-title"),
  todoSub: document.getElementById("todo-sum-sub"),
  memTitle: document.getElementById("mem-sum-title"),
  memSub: document.getElementById("mem-sum-sub"),
  draftTitle: document.getElementById("draft-sum-title"),
  draftSub: document.getElementById("draft-sum-sub"),
  draftEmpty: document.getElementById("draft-empty"),
};

// Expand / collapse a card when its summary head is tapped (but not when
// interacting with the list inside it).
for (const card of Object.values(cards)) {
  if (!card) continue;
  const head = card.querySelector(".info-head");
  head.addEventListener("click", () => card.classList.toggle("open"));
}

async function getJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(path);
  return res.json();
}

function clip(text, n) {
  const t = String(text || "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

async function refresh() {
  // To-do
  try {
    const { todos = [] } = await getJson("/api/todos");
    const open = todos.filter((t) => !t.done);
    const done = todos.filter((t) => t.done);
    el.todoTitle.textContent = open.length ? clip(open[0].text, 40) : "All caught up";
    el.todoSub.textContent = `${open.length} open · ${done.length} done`;
  } catch {
    /* leave as-is */
  }
  // Memory
  try {
    const { facts = [] } = await getJson("/api/memory");
    el.memTitle.textContent = `Knows ${facts.length} thing${facts.length === 1 ? "" : "s"} about you`;
    el.memSub.textContent = facts.length ? `Latest: ${clip(facts[facts.length - 1].text, 38)}` : "Nothing yet";
  } catch {
    /* leave as-is */
  }
  // Drafts (WhatsApp outbox)
  try {
    const { outbox = [] } = await getJson("/api/whatsapp");
    const pending = outbox.filter((m) => m.status === "pending");
    if (pending.length) {
      el.draftTitle.textContent = `WhatsApp to ${clip(pending[0].toLabel, 24)}`;
      el.draftSub.textContent = `${pending.length} staged · awaiting sign-off`;
      el.draftEmpty.hidden = true;
      cards.drafts.classList.add("open"); // surface staged messages
    } else {
      el.draftTitle.textContent = "Nothing staged";
      el.draftSub.textContent = "Outbox empty";
      el.draftEmpty.hidden = false;
    }
  } catch {
    /* leave as-is */
  }
}

window.billiRefreshCards = refresh;
refresh();
