import { execFile } from 'node:child_process';

function execJson(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
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
  if (Array.isArray(data)) return data;
  if (data?.agents && Array.isArray(data.agents)) return data.agents;
  return [];
}

export async function cronList() {
  return await execJson('openclaw', ['cron', 'list', '--json']);
}

export async function cronUpdate(jobId, patch) {
  return await execJson('openclaw', ['cron', 'update', '--id', String(jobId), '--patch-json', JSON.stringify(patch), '--json']);
}

export async function sessionsList(activeMinutes = null) {
  const args = ['sessions', '--json'];
  if (activeMinutes != null) args.push('--active', String(activeMinutes));
  return await execJson('openclaw', args);
}
