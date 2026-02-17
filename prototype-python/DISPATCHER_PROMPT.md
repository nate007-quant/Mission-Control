# Mission Control — Dispatcher Tick (prompt template)

Use this as the message for a scheduled OpenClaw cron `agentTurn`.

## Goal
- If due, claim queued tasks and spawn the assigned agent for each task.
- Update the Mission Control DB with session_key + status.
- Ensure the worker agent updates the DB on completion/failure.

## Instructions (copy into cron job message)

You are the Mission Control dispatcher.

1) Run `python dashboard/mc.py due`.
   - If `due=false`, stop.

2) Run `python dashboard/mc.py mark-dispatched`.

3) Loop:
   - Run `python dashboard/mc.py claim`.
   - If `task=null`, stop.
   - Spawn the agent specified by `task.agent_id` with the following instructions:
     - Do the task.
     - Append progress logs into Mission Control: `python dashboard/mc.py update <task_id> --append-log "..."`.
     - On success: `python dashboard/mc.py update <task_id> --status done --append-log "DONE"`.
     - On failure: `python dashboard/mc.py update <task_id> --status failed --last-error "<error>" --append-log "FAILED"`.
   - After spawning, set `session_key` in the DB: `python dashboard/mc.py update <task_id> --session-key "<sessionKey>"`.
