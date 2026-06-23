// Billi dashboard — WhatsApp Outbox.
// Billi stages forwards here; nothing leaves until Cara taps Send. This is the
// human sign-off the guardrails require. app.js calls refresh() after each turn
// so a freshly staged message appears right away.

const box = document.getElementById("outbox");
const list = document.getElementById("outbox-list");

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${path} failed`);
  return data;
}

function render(outbox) {
  list.textContent = "";
  const pending = (outbox || []).filter((m) => m.status === "pending");
  if (!pending.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  for (const msg of pending) {
    const li = document.createElement("li");
    li.className = "outbox-item";

    const head = document.createElement("div");
    head.className = "outbox-to";
    head.textContent = `To ${msg.toLabel} on WhatsApp`;
    li.appendChild(head);

    if (msg.source) {
      const src = document.createElement("div");
      src.className = "outbox-source";
      src.textContent = msg.source;
      li.appendChild(src);
    }

    const body = document.createElement("div");
    body.className = "outbox-body";
    body.textContent = msg.body;
    li.appendChild(body);

    const row = document.createElement("div");
    row.className = "outbox-actions";

    const send = document.createElement("button");
    send.className = "outbox-send";
    send.type = "button";
    send.textContent = "Send";
    send.addEventListener("click", async () => {
      send.disabled = true;
      send.textContent = "Sending…";
      try {
        const { outbox: next } = await api("/api/whatsapp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: msg.id }),
        });
        render(next);
      } catch (err) {
        send.disabled = false;
        send.textContent = "Send";
        const e = document.createElement("div");
        e.className = "outbox-error";
        e.textContent = err.message;
        li.appendChild(e);
      }
    });

    const discard = document.createElement("button");
    discard.className = "outbox-discard";
    discard.type = "button";
    discard.textContent = "Discard";
    discard.addEventListener("click", async () => {
      try {
        const { outbox: next } = await api("/api/whatsapp", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: msg.id }),
        });
        render(next);
      } catch {
        /* leave in place */
      }
    });

    row.append(send, discard);
    li.appendChild(row);
    list.appendChild(li);
  }
}

async function refresh() {
  try {
    const { outbox } = await api("/api/whatsapp");
    render(outbox);
  } catch {
    /* best-effort */
  }
}

window.billiRefreshOutbox = refresh;

refresh();
