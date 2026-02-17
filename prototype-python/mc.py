"""Mission Control CLI helpers.

This is intentionally dumb/simple so OpenClaw agent turns can call it via exec
and parse JSON.
"""

import argparse
import json
from datetime import datetime, timezone

from mc_db import connect, init_db, get_setting, set_setting, touch_task


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def cmd_init(_args):
    init_db()
    print(json.dumps({"ok": True}))


def cmd_add(args):
    init_db()
    with connect() as con:
        cur = con.execute(
            "INSERT INTO tasks(title, description, agent_id, status) VALUES(?, ?, ?, 'queued')",
            (args.title, args.description, args.agent_id),
        )
        con.commit()
        print(json.dumps({"ok": True, "id": cur.lastrowid}))


def cmd_list(args):
    init_db()
    with connect() as con:
        q = "SELECT * FROM tasks"
        params = []
        if args.status:
            q += " WHERE status=?"
            params.append(args.status)
        q += " ORDER BY created_at DESC LIMIT ?"
        params.append(args.limit)
        rows = con.execute(q, params).fetchall()
        print(json.dumps({"ok": True, "tasks": [dict(r) for r in rows]}))


def cmd_claim(args):
    init_db()
    with connect() as con:
        row = con.execute(
            "SELECT * FROM tasks WHERE status='queued' ORDER BY created_at ASC LIMIT 1"
        ).fetchone()
        if not row:
            print(json.dumps({"ok": True, "task": None}))
            return
        task_id = row["id"]
        touch_task(
            con,
            task_id,
            status="running",
            started_at=now_iso(),
        )
        con.commit()
        row2 = con.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        print(json.dumps({"ok": True, "task": dict(row2)}))


def cmd_update(args):
    init_db()
    with connect() as con:
        fields = {}
        if args.status:
            fields["status"] = args.status
            if args.status in ("done", "failed"):
                fields["finished_at"] = now_iso()
        if args.session_key is not None:
            fields["session_key"] = args.session_key
        if args.last_error is not None:
            fields["last_error"] = args.last_error
        if args.append_log:
            row = con.execute("SELECT log FROM tasks WHERE id=?", (args.id,)).fetchone()
            prev = row[0] if row and row[0] else ""
            fields["log"] = (prev + ("\n" if prev else "") + args.append_log)[-20000:]
        touch_task(con, args.id, **fields)
        con.commit()
        print(json.dumps({"ok": True}))


def cmd_settings_get(_args):
    init_db()
    with connect() as con:
        interval = get_setting(con, "dispatch_interval_hours")
        last = get_setting(con, "last_dispatch_at")
        print(json.dumps({"ok": True, "dispatch_interval_hours": interval, "last_dispatch_at": last}))


def cmd_settings_set(args):
    init_db()
    with connect() as con:
        if args.dispatch_interval_hours is not None:
            set_setting(con, "dispatch_interval_hours", str(args.dispatch_interval_hours))
        con.commit()
    print(json.dumps({"ok": True}))


def cmd_due(_args):
    """Return whether we're due for a dispatch tick based on settings."""
    init_db()
    with connect() as con:
        interval_h = float(get_setting(con, "dispatch_interval_hours") or "12")
        last = get_setting(con, "last_dispatch_at")
        now = datetime.now(timezone.utc)
        if not last:
            print(json.dumps({"ok": True, "due": True}))
            return
        try:
            last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
        except Exception:
            print(json.dumps({"ok": True, "due": True, "reason": "bad last_dispatch_at"}))
            return
        delta_h = (now - last_dt).total_seconds() / 3600.0
        print(json.dumps({"ok": True, "due": delta_h >= interval_h, "hours_since": delta_h}))


def cmd_mark_dispatched(_args):
    init_db()
    with connect() as con:
        set_setting(con, "last_dispatch_at", now_iso())
        con.commit()
    print(json.dumps({"ok": True}))


def build_parser():
    p = argparse.ArgumentParser(prog="mc")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init")
    s.set_defaults(fn=cmd_init)

    s = sub.add_parser("add")
    s.add_argument("--title", required=True)
    s.add_argument("--description", default="")
    s.add_argument("--agent-id", default="platformengineer")
    s.set_defaults(fn=cmd_add)

    s = sub.add_parser("list")
    s.add_argument("--status", choices=["queued", "running", "done", "failed"], default=None)
    s.add_argument("--limit", type=int, default=200)
    s.set_defaults(fn=cmd_list)

    s = sub.add_parser("claim")
    s.set_defaults(fn=cmd_claim)

    s = sub.add_parser("update")
    s.add_argument("id", type=int)
    s.add_argument("--status", choices=["queued", "running", "done", "failed"], default=None)
    s.add_argument("--session-key", default=None)
    s.add_argument("--last-error", default=None)
    s.add_argument("--append-log", default=None)
    s.set_defaults(fn=cmd_update)

    s = sub.add_parser("settings-get")
    s.set_defaults(fn=cmd_settings_get)

    s = sub.add_parser("settings-set")
    s.add_argument("--dispatch-interval-hours", type=float, default=None)
    s.set_defaults(fn=cmd_settings_set)

    s = sub.add_parser("due")
    s.set_defaults(fn=cmd_due)

    s = sub.add_parser("mark-dispatched")
    s.set_defaults(fn=cmd_mark_dispatched)

    return p


def main():
    args = build_parser().parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
