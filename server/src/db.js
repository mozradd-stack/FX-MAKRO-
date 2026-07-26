import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'fxmacro.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS central_banks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL UNIQUE,
  current_rate REAL NOT NULL,
  last_change_date TEXT NOT NULL,
  last_change_amount REAL NOT NULL,
  next_meeting TEXT NOT NULL,
  forward_guidance TEXT NOT NULL CHECK (forward_guidance IN ('hawkish','neutral','dovish')),
  cpi REAL NOT NULL,
  unemployment REAL NOT NULL,
  gdp_growth REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL,
  rate REAL NOT NULL,
  effective_date TEXT NOT NULL,
  change_amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pair_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair TEXT NOT NULL UNIQUE,
  bias TEXT NOT NULL,
  score INTEGER NOT NULL,
  differential REAL NOT NULL,
  trend_direction TEXT NOT NULL,
  expected_change TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS economic_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  bank TEXT NOT NULL,
  expected_decision TEXT NOT NULL,
  importance TEXT NOT NULL CHECK (importance IN ('HIGH','MEDIUM')),
  affected_pairs TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);
