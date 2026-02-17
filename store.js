import fs from 'node:fs';
import path from 'node:path';

const DATA_PATH = process.env.MC_DATA_PATH
  ? path.resolve(process.env.MC_DATA_PATH)
  : path.resolve(path.dirname(new URL(import.meta.url).pathname), 'mission_control.json');

function defaultData() {
  return {
    settings: {
      dispatch_interval_hours: 12,
      last_dispatch_at: ""
    },
    next_task_id: 1,
    next_project_id: 1,
    projects: [
      {
        id: 1,
        name: "Mission Control",
        description: "Dashboard for interacting with OpenClaw",
        default_agent_id: "platformengineer",
        links: "https://github.com/nate007-quant/Mission-Control"
      }
    ],
    tasks: []
  };
}

function load() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    // minimal migration
    data.settings ||= defaultData().settings;
    data.next_task_id ||= 1;
    data.next_project_id ||= 1;
    data.projects ||= defaultData().projects;
    data.tasks ||= [];
    return data;
  } catch {
    return defaultData();
  }
}

function save(data) {
  const dir = path.dirname(DATA_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = DATA_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_PATH);
}

export { DATA_PATH, load, save, defaultData };
