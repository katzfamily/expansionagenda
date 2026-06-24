// Where Billi keeps her data on disk.
//
// Locally this is billi/ (so memory lives in billi/memory and the Gmail token
// in billi/.gmail-accounts.json, exactly as before). On a cloud host, set
// BILLI_DATA_DIR to a mounted persistent disk (e.g. /var/data/billi) so memory,
// to-dos, conversation, and tokens survive restarts and redeploys.

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url)); // billi/lib
const BILLI_DIR = join(HERE, ".."); // billi/

export const DATA_DIR = process.env.BILLI_DATA_DIR
  ? resolve(process.env.BILLI_DATA_DIR)
  : BILLI_DIR;

export const MEMORY_DIR = join(DATA_DIR, "memory");
export const ACCOUNTS_FILE = join(DATA_DIR, ".gmail-accounts.json");

export function ensureMemoryDir() {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
}
