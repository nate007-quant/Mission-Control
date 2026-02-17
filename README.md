# Mission Control

Local dashboard to queue work for OpenClaw agents.

## Run locally

```bash
cd dashboard
npm install
npm run dev
```

Open:
- http://localhost:5000

## Data

- `dashboard/mission_control.json`

## Dispatcher (OpenClaw)

Pair this dashboard with an OpenClaw cron job (“dispatcher tick”) that periodically claims queued tasks and spawns the assigned agent.

The dispatcher logic uses the CLI:
- `node dashboard/mc.js due`
- `node dashboard/mc.js claim`
- `node dashboard/mc.js update ...`
