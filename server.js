import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load, save } from './store.js';
import { listAgents, cronList, cronUpdate } from './openclaw_api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));

function counts(tasks) {
  const c = { queued: 0, running: 0, done: 0, failed: 0 };
  for (const t of tasks) c[t.status] = (c[t.status] || 0) + 1;
  return c;
}

app.get('/', (req, res) => {
  const data = load();
  const tasks = [...data.tasks].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 25);
  res.render('index', {
    counts: counts(data.tasks),
    tasks,
    interval: data.settings.dispatch_interval_hours,
    last_dispatch_at: data.settings.last_dispatch_at
  });
});

app.get('/tasks', (req, res) => {
  const data = load();
  const status = req.query.status;
  let tasks = [...data.tasks].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 200);
  if (['queued', 'running', 'done', 'failed'].includes(status)) tasks = tasks.filter(t => t.status === status);
  res.render('tasks', { tasks, status });
});

app.get('/tasks/new', async (req, res) => {
  let agents = [];
  try {
    agents = await listAgents();
  } catch {
    agents = [{ id: 'platformengineer' }];
  }
  if (!agents.length) agents = [{ id: 'platformengineer' }];
  res.render('new_task', { agents });
});

app.post('/tasks/new', (req, res) => {
  const data = load();
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const agent_id = String(req.body.agent_id || 'platformengineer').trim() || 'platformengineer';
  const project = String(req.body.project || '').trim() || 'General';

  if (!title) return res.status(400).send('Title required');
  const id = data.next_task_id++;
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  data.tasks.push({
    id,
    project,
    title,
    description,
    agent_id,
    status: 'queued',
    created_at: now,
    updated_at: now,
    started_at: '',
    finished_at: '',
    session_key: '',
    last_error: '',
    log: ''
  });
  save(data);
  res.redirect('/tasks');
});

app.get('/tasks/:id', (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const task = data.tasks.find(t => t.id === id);
  if (!task) return res.status(404).send('Not found');
  res.render('task_detail', { task });
});

app.get('/settings', (req, res) => {
  const data = load();
  res.render('settings', {
    interval: data.settings.dispatch_interval_hours,
    last_dispatch_at: data.settings.last_dispatch_at
  });
});

app.post('/settings', (req, res) => {
  const data = load();
  const v = Number(req.body.dispatch_interval_hours);
  if (!Number.isFinite(v) || v <= 0) return res.status(400).send('Interval must be a positive number (hours)');
  data.settings.dispatch_interval_hours = v;
  save(data);
  res.redirect('/');
});

const port = Number(process.env.PORT || 5000);
app.listen(port, '0.0.0.0', () => {
  console.log(`Mission Control listening on 0.0.0.0:${port}`);
});

// --- Cron UI ---
app.get('/cron', async (req, res) => {
  let jobs = [];
  try {
    const out = await cronList();
    // openclaw may return {jobs:[...]} or [...]
    jobs = Array.isArray(out) ? out : (out?.jobs || []);
  } catch (e) {
    jobs = [];
  }
  res.render('cron', { jobs });
});

app.get('/cron/:id', async (req, res) => {
  const id = String(req.params.id);
  let jobs = [];
  try {
    const out = await cronList();
    jobs = Array.isArray(out) ? out : (out?.jobs || []);
  } catch {
    jobs = [];
  }
  const job = jobs.find(j => String(j.id || j.jobId) === id);
  if (!job) return res.status(404).send('Cron job not found');
  res.render('cron_edit', { job });
});

app.post('/cron/:id', async (req, res) => {
  const id = String(req.params.id);
  const enabled = String(req.body.enabled || 'true') === 'true';
  let schedule = undefined;
  try {
    schedule = JSON.parse(String(req.body.schedule_json || '{}'));
  } catch {
    return res.status(400).send('Invalid schedule JSON');
  }
  try {
    const patch = { enabled, schedule };
    await cronUpdate(id, patch);
    res.redirect('/cron');
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
});

// --- Metrics (local, per-task recorded usage) ---
app.get('/metrics', (req, res) => {
  const data = load();
  const rows = new Map();
  let totalTokens = 0;
  let totalCost = 0;

  for (const t of data.tasks || []) {
    const project = String(t.project || 'General');
    const tokens = Number(t.tokens_total || 0);
    const cost = Number(t.cost_usd || 0);
    totalTokens += tokens;
    totalCost += cost;
    const cur = rows.get(project) || { project, tokens: 0, cost: 0, tasks: 0 };
    cur.tokens += tokens;
    cur.cost += cost;
    cur.tasks += 1;
    rows.set(project, cur);
  }

  const byProject = [...rows.values()].sort((a, b) => b.tokens - a.tokens);

  res.render('metrics', {
    totals: {
      tokens: totalTokens,
      cost: totalCost,
      tasks: (data.tasks || []).length,
      projects: rows.size
    },
    byProject
  });
});
