// Billi dashboard — "What Billi remembers" widget.
// Reads the durable memory the server keeps in billi/memory/. Cara can add a
// memory by hand or remove one she no longer wants kept. Billi also writes
// here herself (via her remember/forget tools), so app.js calls refresh()
// after each turn to pick up anything she just saved.

const list = document.getElementById("memory-list");
const addBtn = document.getElementById("add-memory");

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${path} failed`);
  return data;
}

function render(facts) {
  list.textContent = "";
  if (!facts.length) {
    const empty = document.createElement("li");
    empty.className = "memory-empty";
    empty.textContent = "Nothing yet. Tell Billi to remember something, or add it here.";
    list.appendChild(empty);
    return;
  }
  for (const fact of facts) {
    const li = document.createElement("li");
    li.className = "memory-item";

    const text = document.createElement("span");
    text.className = "memory-text";
    text.textContent = fact.text;

    const del = document.createElement("button");
    del.className = "memory-del";
    del.type = "button";
    del.title = "Forget this";
    del.textContent = "×";
    del.addEventListener("click", async () => {
      try {
        const { facts: next } = await api("/api/memory", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: fact.id }),
        });
        render(next);
      } catch {
        /* leave the item in place on failure */
      }
    });

    li.append(text, del);
    list.appendChild(li);
  }
}

async function refresh() {
  try {
    const { facts } = await api("/api/memory");
    render(facts);
  } catch {
    /* widget is best-effort */
  }
}

addBtn.addEventListener("click", async () => {
  const note = window.prompt("What should Billi remember? (one sentence)");
  if (!note || !note.trim()) return;
  try {
    const { facts } = await api("/api/memory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: note.trim() }),
    });
    render(facts);
  } catch (err) {
    window.alert(err.message);
  }
});

// Let app.js refresh the list after Billi may have remembered something.
window.billiRefreshMemory = refresh;

refresh();
