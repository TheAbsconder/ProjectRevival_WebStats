CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_key TEXT NOT NULL UNIQUE,
  completed_at TEXT NOT NULL,
  map TEXT NOT NULL,
  winner TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rounds_completed ON rounds(completed_at DESC, id DESC);
