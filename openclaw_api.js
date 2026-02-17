import { execFile } from 'node:child_process';

function execJson(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(`Command failed: ${cmd} ${args.join(' ')}\n${stderr || stdout || err.message}`);
        e.cause = err;
        return reject(e);
      }
      const out = String(stdout || '').trim();
      try {
        resolve(out ? JSON.parse(out) : null);
      } catch (e) {
        reject(new Error(`Failed to parse JSON from: ${cmd} ${args.join(' ')}\n---\n${out.slice(0, 2000)}`));
      }
    });
  });
}

export async function listAgents() {
  const data = await execJson('openclaw', ['agents', 'list', '--json']);
  // Expecting array of {id, ...}
  if (Array.isArray(data)) return data;
  if (data?.agents && Array.isArray(data.agents)) return data.agents;
  return [];
}

export async function cronList() {
  return await execJson('openclaw', ['cron', 'list', '--json']);
}

export async function cronUpdate(jobId, patch) {
  // Patch via stdin to avoid escaping issues
  return await new Promise((resolve, reject) => {
    const child = execFile('openclaw', ['cron', 'update', '--id', String(jobId), '--patch-json', JSON.stringify(patch), '--json'], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || stdout || err.message));
      const out = String(stdout || '').trim();
      try { resolve(out ? JSON.parse(out) : null); } catch { resolve(out); }
    });
    child.on('error', reject);
  });
}

export async function cronRemove(jobId) {
  return await execJson('openclaw', ['cron', 'remove', '--id', String(jobId), '--json']);
}

export async function cronAdd(job) {
  return await execJson('openclaw', ['cron', 'add', '--job-json', JSON.stringify(job), '--json']);
}
