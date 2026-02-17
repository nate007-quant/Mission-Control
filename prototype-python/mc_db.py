import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.environ.get("MC_DB_PATH", Path(__file__).resolve().parent / "mission_control.sqlite"))

SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT 'platformengineer',
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT,
  session_key TEXT,
  last_error TEXT,
  log TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

DEFAULT_SETTINGS = {
  "dispatch_interval_hours": "12",
  "last_dispatch_at": "",
}

@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
    finally:
        con.close()


def init_db():
    with connect() as con:
        con.executescript(SCHEMA)
        for k, v in DEFAULT_SETTINGS.items():
            con.execute(
                "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
                (k, v),
            )
        con.commit()


def get_setting(con, key: str) -> str:
    row = con.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else ""


def set_setting(con, key: str, value: str):
    con.execute(
        "INSERT INTO settings(key, value, updated_at) VALUES (?, ?, datetime('now')) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')",
        (key, value),
    )


def touch_task(con, task_id: int, **fields):
    cols = []
    vals = []
    for k, v in fields.items():
        cols.append(f"{k}=?")
        vals.append(v)
    cols.append("updated_at=datetime('now')")
    vals.append(task_id)
    con.execute(f"UPDATE tasks SET {', '.join(cols)} WHERE id=?", vals)
