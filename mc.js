#!/usr/bin/env node

// Mission Control CLI helpers.
// Prints JSON to stdout.

import { load, save } from './store.js';

function nowIso() {
  // UTC, no ms
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function ok(obj = {}) {
  process.stdout.write(JSON.stringify({ ok: true, ...obj }));
}

function fail(message) {
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const flags = {};
  const positionals = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
      flags[k] = v;
    } else {
      positionals.push(a);
    }
  }
  return { cmd, flags, positionals };
}

const { cmd, flags, positionals } = parseArgs(process.argv.slice(2));
if (!cmd) fail('missing cmd');

const data = load();

if (cmd === 'init') {
  save(data);
  ok();
  process.exit(0);
}

if (cmd === 'add') {
  const title = String(flags.title || '').trim();
  const description = String(flags.description || '').trim();
  const agent_id = String(flags['agent-id'] || 'platformengineer').trim() || 'platformengineer';
  if (!title) fail('title required');
  const id = data.next_task_id++;
  data.tasks.push({
    id,
    title,
    description,
    agent_id,
    status: 'queued',
    created_at: nowIso(),
    updated_at: nowIso(),
    started_at: '',
    finished_at: '',
    session_key: '',
    last_error: '',
    log: ''
  });
  save(data);
  ok({ id });
  process.exit(0);
}

if (cmd === 'list') {
  const status = flags.status ? String(flags.status) : '';
  const limit = flags.limit ? Number(flags.limit) : 200;
  let tasks = [...data.tasks].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (['queued', 'running', 'done', 'failed'].includes(status)) {
    tasks = tasks.filter(t => t.status === status);
  }
  ok({ tasks: tasks.slice(0, limit) });
  process.exit(0);
}

if (cmd === 'claim') {
  // claim oldest queued
  const task = [...data.tasks]
    .filter(t => t.status === 'queued')
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))[0];
  if (!task) {
    ok({ task: null });
    process.exit(0);
  } else {
    task.status = 'running';
    task.started_at = task.started_at || nowIso();
    task.updated_at = nowIso();
    save(data);
    ok({ task });
    process.exit(0);
  }
}

if (cmd === 'update') {
  const id = Number(positionals[0]);
  if (!id) fail('id required');
  const task = data.tasks.find(t => t.id === id);
  if (!task) fail('task not found');

  if (flags.status) {
    const s = String(flags.status);
    if (!['queued', 'running', 'done', 'failed'].includes(s)) fail('bad status');
    task.status = s;
    if ((s === 'done' || s === 'failed') && !task.finished_at) {
      task.finished_at = nowIso();
    }
  }
  if (flags['session-key'] !== undefined) task.session_key = String(flags['session-key'] ?? '');
  if (flags['last-error'] !== undefined) task.last_error = String(flags['last-error'] ?? '');
  if (flags['append-log']) {
    const msg = String(flags['append-log']);
    task.log = (task.log ? task.log + '\n' : '') + msg;
    if (task.log.length > 20000) task.log = task.log.slice(-20000);
  }
  task.updated_at = nowIso();
  save(data);
  ok();
  process.exit(0);
}

if (cmd === 'settings-get') {
  ok({
    dispatch_interval_hours: data.settings.dispatch_interval_hours,
    last_dispatch_at: data.settings.last_dispatch_at
  });
  process.exit(0);
}

if (cmd === 'settings-set') {
  if (flags['dispatch-interval-hours'] !== undefined) {
    const v = Number(flags['dispatch-interval-hours']);
    if (!Number.isFinite(v) || v <= 0) fail('dispatch-interval-hours must be >0');
    data.settings.dispatch_interval_hours = v;
  }
  save(data);
  ok();
  process.exit(0);
}

if (cmd === 'due') {
  const intervalH = Number(data.settings.dispatch_interval_hours ?? 12);
  const last = data.settings.last_dispatch_at;
  if (!last) { ok({ due: true }); process.exit(0); }
  const lastMs = Date.parse(last);
  if (!Number.isFinite(lastMs)) { ok({ due: true, reason: 'bad last_dispatch_at' }); process.exit(0); }
  const deltaH = (Date.now() - lastMs) / 3600000;
  ok({ due: deltaH >= intervalH, hours_since: deltaH });
  process.exit(0);
}

if (cmd === 'mark-dispatched') {
  data.settings.last_dispatch_at = nowIso();
  save(data);
  ok();
  process.exit(0);
}

fail('unknown cmd');
