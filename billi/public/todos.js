// Billi dashboard — To-do widget.
// Tasks come from Billi (when she drafts a reply that commits Cara to a
// follow-up, or when asked), or Cara adds them here by hand. Check one off to
// mark it done, × to remove. app.js calls refresh() after each turn so tasks
// Billi just captured show up.

const list = document.getElementById("todo-list");
const addBtn = document.getElementById("add-todo");

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${path} failed`);
  return data;
}

function render(todos) {
  list.textContent = "";
  if (!todos.length) {
    const empty = document.createElement("li");
    empty.className = "todo-empty";
    empty.textContent = "Nothing yet. Billi adds follow-ups from your email replies, or add one here.";
    list.appendChild(empty);
    return;
  }
  // Open tasks first, then completed.
  const sorted = [...todos].sort((a, b) => Number(a.done) - Number(b.done));
  for (const todo of sorted) {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");

    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "todo-box";
    box.checked = todo.done;
    box.addEventListener("change", async () => {
      try {
        const { todos: next } = await api("/api/todos", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: todo.id, done: box.checked }),
        });
        render(next);
      } catch {
        box.checked = todo.done;
      }
    });

    const body = document.createElement("div");
    body.className = "todo-body";
    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.text;
    body.appendChild(text);
    if (todo.source) {
      const src = document.createElement("span");
      src.className = "todo-source";
      src.textContent = todo.source;
      body.appendChild(src);
    }

    const del = document.createElement("button");
    del.className = "todo-del";
    del.type = "button";
    del.title = "Remove";
    del.textContent = "×";
    del.addEventListener("click", async () => {
      try {
        const { todos: next } = await api("/api/todos", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: todo.id }),
        });
        render(next);
      } catch {
        /* leave it in place on failure */
      }
    });

    li.append(box, body, del);
    list.appendChild(li);
  }
}

async function refresh() {
  try {
    const { todos } = await api("/api/todos");
    render(todos);
  } catch {
    /* widget is best-effort */
  }
}

addBtn.addEventListener("click", async () => {
  const task = window.prompt("New task");
  if (!task || !task.trim()) return;
  try {
    const { todos } = await api("/api/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task: task.trim() }),
    });
    render(todos);
  } catch (err) {
    window.alert(err.message);
  }
});

window.billiRefreshTodos = refresh;

refresh();
