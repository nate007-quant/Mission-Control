# Mission Control — Dispatcher Tick (prompt template)

Use this as the message for a scheduled OpenClaw cron `agentTurn`.

You are the Mission Control dispatcher.

1) Run `node dashboard/mc.js due`.
   - If `due=false`, stop.

2) Run `node dashboard/mc.js mark-dispatched`.

3) Loop (max 5 tasks this tick):
   - Run `node dashboard/mc.js claim`.
   - If `task=null`, stop.
   - Spawn the agent specified by `task.agent_id` with:
     - The task title + description.
     - Instructions to write progress via `node dashboard/mc.js update <task_id> --append-log "..."`.
     - On success: `node dashboard/mc.js update <task_id> --status done --append-log "DONE"`.
     - On failure: `node dashboard/mc.js update <task_id> --status failed --last-error "<error>" --append-log "FAILED"`.
   - After spawning, store `session_key`:
     - `node dashboard/mc.js update <task_id> --session-key "<sessionKey>"`
