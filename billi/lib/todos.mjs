// Billi's to-do list — durable, local, private (lives in billi/memory/).
//
// Tasks are created three ways: Cara asks Billi to add one, Cara adds one by
// hand in the dashboard, or — the point of this widget — Billi captures a
// follow-up when she drafts an email reply that commits Cara to an action.
//
// Same flat-file approach as memory.mjs: read and rewritten whole on change.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "..", "memory");
const FILE = join(DIR, "todos.json");

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

export function loadTodos() {
  try {
    if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    /* corrupt — start clean rather than crash a turn */
  }
  return [];
}

function write(todos) {
  ensureDir();
  writeFileSync(FILE, JSON.stringify(todos, null, 2));
}

function nextId(todos) {
  return todos.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) + 1;
}

export function addTodo(text, source, createdAt) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Cannot add an empty task.");
  const todos = loadTodos();
  // Skip an open near-duplicate so the same follow-up isn't added twice.
  const dup = todos.find((t) => !t.done && t.text.toLowerCase() === clean.toLowerCase());
  if (dup) return dup;
  const todo = {
    id: nextId(todos),
    text: clean,
    done: false,
    source: source ? String(source).trim() : null,
    createdAt: createdAt || null,
  };
  todos.push(todo);
  write(todos);
  return todo;
}

export function setDone(id, done) {
  const todos = loadTodos();
  const todo = todos.find((t) => String(t.id) === String(id));
  if (!todo) throw new Error(`No task with id ${id}.`);
  todo.done = Boolean(done);
  write(todos);
  return todo;
}

export function removeTodo(id) {
  const todos = loadTodos();
  const next = todos.filter((t) => String(t.id) !== String(id));
  if (next.length === todos.length) throw new Error(`No task with id ${id}.`);
  write(next);
  return true;
}

// Open tasks rendered for the system prompt so Billi knows what's outstanding
// and can complete one by id when Cara says it's handled.
export function todosForPrompt() {
  const open = loadTodos().filter((t) => !t.done);
  if (!open.length) return "";
  const list = open.map((t) => `[${t.id}] ${t.text}`).join("\n");
  return `\n\n---\n\nCara's open to-do list (each line prefixed with its task id; use\ncomplete_todo when she says one is done):\n${list}`;
}
