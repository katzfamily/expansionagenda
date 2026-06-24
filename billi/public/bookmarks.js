// Billi dashboard — Quick links widget.
// A curated set of the tools Cara works in, editable and saved to this
// browser (localStorage). No browser-history access; these are bookmarks she
// owns. Each tile is a colored initial + label so there are no external
// favicon requests.

const STORE_KEY = "billi.bookmarks.v1";

// Seeded from the tools in Billi's world. Cara can add/remove freely.
const DEFAULTS = [
  { name: "Gmail", url: "https://mail.google.com" },
  { name: "Calendar", url: "https://calendar.google.com" },
  { name: "Drive", url: "https://drive.google.com" },
  { name: "Stripe", url: "https://dashboard.stripe.com" },
  { name: "Airtable", url: "https://airtable.com" },
  { name: "Slack", url: "https://app.slack.com" },
  { name: "Granola", url: "https://app.granola.ai" },
  { name: "Book Cara", url: "https://www.magicalteams.com/chat-with-cara" },
];

const grid = document.getElementById("link-grid");
const addBtn = document.getElementById("add-link");

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to defaults */
  }
  return DEFAULTS.slice();
}

function save(links) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(links));
  } catch {
    /* private mode / quota — the widget still works for this session */
  }
}

let links = load();

// Stable-ish gradient accent per tile so the badges read as a lively set.
const ACCENTS = [
  "linear-gradient(135deg,#ea5a5a,#d6456e)",
  "linear-gradient(135deg,#6f8ce8,#5e72c8)",
  "linear-gradient(135deg,#8a7bf0,#6f5ad6)",
  "linear-gradient(135deg,#b07ad0,#9456b8)",
  "linear-gradient(135deg,#f08aa0,#e0607c)",
  "linear-gradient(135deg,#5ab8c8,#3f9aac)",
  "linear-gradient(135deg,#e0a060,#c9822e)",
];
function accentFor(i) {
  return ACCENTS[i % ACCENTS.length];
}

function initials(name) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function render() {
  grid.textContent = "";
  links.forEach((link, i) => {
    const tile = document.createElement("a");
    tile.className = "link-tile";
    tile.href = link.url;
    tile.target = "_blank";
    tile.rel = "noopener noreferrer";
    tile.title = `${link.name} — ${hostOf(link.url)}`;

    const badge = document.createElement("span");
    badge.className = "link-badge";
    badge.style.background = accentFor(i);
    badge.textContent = initials(link.name);

    const label = document.createElement("span");
    label.className = "link-label";
    label.textContent = link.name;

    const del = document.createElement("button");
    del.className = "link-del";
    del.type = "button";
    del.title = "Remove";
    del.textContent = "×";
    del.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      links = links.filter((_, j) => j !== i);
      save(links);
      render();
    });

    tile.append(badge, label, del);
    grid.appendChild(tile);
  });
}

function normalizeUrl(input) {
  const v = input.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

addBtn.addEventListener("click", () => {
  const name = window.prompt("Link name (e.g. LinkedIn)");
  if (!name || !name.trim()) return;
  const urlRaw = window.prompt("URL (e.g. linkedin.com)");
  const url = normalizeUrl(urlRaw || "");
  if (!url) return;
  links.push({ name: name.trim(), url });
  save(links);
  render();
});

render();
