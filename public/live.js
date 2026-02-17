(function(){
  function $(sel){ return document.querySelector(sel); }

  // Tasks list live refresh
  const tasksTable = document.querySelector('[data-live-tasks]');
  if (tasksTable) {
    const src = new EventSource('/events');
    src.addEventListener('tasks', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        const tbody = tasksTable.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = payload.tasks.map(t => {
          const statusPill = `<span class="pill ${t.status}">${t.status}</span>`;
          const project = t.project ? `<div class="muted">${escapeHtml(t.project)}</div>` : '';
          return `
            <tr>
              <td><a href="/tasks/${t.id}">${t.id}</a></td>
              <td><div>${escapeHtml(t.title || '')}</div>${project}</td>
              <td><code>${escapeHtml(t.agent_id || '')}</code></td>
              <td>${statusPill}</td>
              <td class="muted">${escapeHtml(t.created_at || '')}</td>
            </tr>
          `;
        }).join('');
        const badge = $('#liveBadge');
        if (badge) badge.textContent = 'Live';
      } catch {}
    });
    src.addEventListener('open', () => {
      const badge = $('#liveBadge');
      if (badge) badge.textContent = 'Live';
    });
    src.addEventListener('error', () => {
      const badge = $('#liveBadge');
      if (badge) badge.textContent = 'Offline';
    });
  }

  // Task detail log tail
  const logPre = document.querySelector('[data-live-log]');
  if (logPre) {
    const taskId = logPre.getAttribute('data-task-id');
    const src = new EventSource('/events');
    src.addEventListener('task', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (String(payload.task?.id) !== String(taskId)) return;

        // Update status pill + fields
        const statusEl = document.querySelector('[data-field=status]');
        if (statusEl) statusEl.innerHTML = `<span class="pill ${payload.task.status}">${payload.task.status}</span>`;
        const startedEl = document.querySelector('[data-field=started_at]');
        if (startedEl) startedEl.textContent = payload.task.started_at || '—';
        const finishedEl = document.querySelector('[data-field=finished_at]');
        if (finishedEl) finishedEl.textContent = payload.task.finished_at || '—';
        const sessionEl = document.querySelector('[data-field=session_key]');
        if (sessionEl) sessionEl.textContent = payload.task.session_key || '—';

        // Replace log
        logPre.textContent = payload.task.log || '';
      } catch {}
    });
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }
})();
