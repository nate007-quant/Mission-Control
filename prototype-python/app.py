import os
from pathlib import Path

from flask import Flask, redirect, render_template, request, url_for, flash

from mc_db import connect, init_db, get_setting, set_setting

app = Flask(__name__)
app.secret_key = os.environ.get("MC_SECRET_KEY", "dev-secret-change-me")

BASE_DIR = Path(__file__).resolve().parent


def get_counts(con):
    rows = con.execute("SELECT status, COUNT(*) AS c FROM tasks GROUP BY status").fetchall()
    d = {"queued": 0, "running": 0, "done": 0, "failed": 0}
    for r in rows:
        d[r["status"]] = r["c"]
    return d


@app.route("/")
def index():
    init_db()
    with connect() as con:
        counts = get_counts(con)
        tasks = con.execute(
            "SELECT * FROM tasks ORDER BY created_at DESC LIMIT 25"
        ).fetchall()
        interval = get_setting(con, "dispatch_interval_hours")
        last = get_setting(con, "last_dispatch_at")
    return render_template(
        "index.html",
        counts=counts,
        tasks=tasks,
        interval=interval,
        last_dispatch_at=last,
    )


@app.route("/tasks")
def tasks():
    init_db()
    status = request.args.get("status")
    with connect() as con:
        if status in ("queued", "running", "done", "failed"):
            rows = con.execute(
                "SELECT * FROM tasks WHERE status=? ORDER BY created_at DESC LIMIT 200",
                (status,),
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC LIMIT 200"
            ).fetchall()
    return render_template("tasks.html", tasks=rows, status=status)


@app.route("/tasks/new", methods=["GET", "POST"]
def tasks_new():
    init_db()
    if request.method == "POST":
        title = (request.form.get("title") or "").strip()
        description = (request.form.get("description") or "").strip()
        agent_id = (request.form.get("agent_id") or "platformengineer").strip() or "platformengineer"

        if not title:
            flash("Title is required", "error")
            return redirect(url_for("tasks_new"))

        with connect() as con:
            con.execute(
                "INSERT INTO tasks(title, description, agent_id, status) VALUES(?, ?, ?, 'queued')",
                (title, description, agent_id),
            )
            con.commit()

        flash("Task added to queue.", "ok")
        return redirect(url_for("tasks"))

    return render_template("new_task.html")


@app.route("/tasks/<int:task_id>")
def task_detail(task_id: int):
    init_db()
    with connect() as con:
        row = con.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        return ("Not found", 404)
    return render_template("task_detail.html", task=row)


@app.route("/settings", methods=["GET", "POST"]
def settings():
    init_db()
    if request.method == "POST":
        interval = (request.form.get("dispatch_interval_hours") or "").strip()
        try:
            val = float(interval)
            if val <= 0:
                raise ValueError("must be >0")
        except Exception:
            flash("Interval must be a positive number (hours).", "error")
            return redirect(url_for("settings"))

        with connect() as con:
            set_setting(con, "dispatch_interval_hours", str(val))
            con.commit()
        flash("Saved.", "ok")
        return redirect(url_for("index"))

    with connect() as con:
        interval = get_setting(con, "dispatch_interval_hours")
        last = get_setting(con, "last_dispatch_at")
    return render_template("settings.html", interval=interval, last_dispatch_at=last)


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
