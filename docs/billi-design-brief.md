# Billi — design brief (for a visual redesign)

Hand this to Claude (or any designer) when redesigning Billi's interface. Follow
the **Functional contract** and every capability keeps working. Everything in
**Free to change** is yours to reimagine.

---

## What Billi is

Billi is a local, voice-first assistant for Cara — a single-page dashboard she
talks to. She holds an orb (or presses Space) to talk; Billi transcribes,
thinks, replies aloud, and shows the conversation. Around the orb sit widgets:
quick links, a to-do list, a memory list, today's weather, and a WhatsApp
outbox. It runs on her Mac in Chrome.

The current look: warm cream (#FFFBF6), charcoal ink (#242323), periwinkle
accent (#8685FD), warm amber (#B36E1D), serif display type — the Dreamers &
Doers brand. Keep that spirit unless Cara says otherwise.

---

## Functional contract (MUST be preserved)

The look is HTML + CSS. The behavior is JavaScript that finds elements **by these
exact IDs** and styles content **with these exact class names**. Keep them and
everything works. Rename or drop them and that feature breaks.

### 1. Keep these `<script>` includes in `index.html` (do not edit the JS files)
```
<script src="/bookmarks.js" type="module"></script>
<script src="/todos.js"     type="module"></script>
<script src="/memory.js"    type="module"></script>
<script src="/weather.js"   type="module"></script>
<script src="/whatsapp.js"  type="module"></script>
<script src="/app.js"       type="module"></script>
```

### 2. Keep these element IDs (any tag/placement/styling is fine)
- `orb` — **must stay a `<canvas>`** (with width/height attributes). The orb
  animation draws on it. You may restyle/reskin it, but it has to be a canvas.
- `state` — the status line ("listening…", "thinking…", "speaking…").
- `conversation` — container the chat turns are appended into.
- `warn` — hidden error banner (shown if API keys are missing).
- `clear-convo` — button that clears the saved thread.
- `link-grid` + `add-link` — quick-links container and its add button.
- `todo-list` + `add-todo` — to-do list container and its add button.
- `memory-list` + `add-memory` — memory list container and its add button.
- `weather` (container, starts hidden), `weather-icon`, `w-hi`, `w-lo`,
  `weather-place` — today's weather pill.
- `outbox` (container, starts hidden) + `outbox-list` — WhatsApp outbox.

### 3. Provide CSS for these class names (the JS creates these at runtime)
- Conversation: `turn`, `user`, `billi`, `who`, `actions`
- Quick links: `link-tile`, `link-badge`, `link-label`, `link-del`
- To-dos: `todo-item`, `todo-box`, `todo-body`, `todo-text`, `todo-source`,
  `todo-del`, `todo-empty`, `done`
- Memory: `memory-item`, `memory-text`, `memory-del`, `memory-empty`
- Outbox: `outbox-item`, `outbox-to`, `outbox-source`, `outbox-body`,
  `outbox-actions`, `outbox-send`, `outbox-discard`, `outbox-error`

### 4. Leave these alone entirely
- The JS files (`app.js`, `bookmarks.js`, `todos.js`, `memory.js`,
  `weather.js`, `whatsapp.js`) and the server.
- The server endpoints the JS calls: `/api/listen`, `/api/respond`,
  `/api/speak`, `/api/status`, `/api/memory`, `/api/todos`, `/api/whatsapp`,
  `/api/conversation`.

---

## Free to change (reimagine away)

- All colors, gradients, typography, spacing, borders, shadows, rounding.
- The whole layout: where the orb sits, how widgets are arranged, one column or
  three, sidebar vs grid, collapsible panels, tabs, anything.
- The orb's drawn appearance (color, motion, shape) — that lives in `app.js`'s
  draw function, so describe what you want and it can be reskinned there.
- Empty states, icons, microcopy, animations, light/dark, responsive behavior.

---

## What to deliver

A new `index.html` and `style.css` that satisfy the contract above. A mockup or
screenshot is also welcome as a starting point — the wiring can be applied to it
afterward.
