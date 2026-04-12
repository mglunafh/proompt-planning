'use strict';

const Tooltip = (() => {
  const el = document.getElementById('tooltip');

  function show(event, html) {
    el.innerHTML = html;
    el.classList.remove('hidden');
    move(event);
  }

  function hide() {
    el.classList.add('hidden');
  }

  function move(event) {
    const x = Math.min(event.clientX + 14, window.innerWidth - 260);
    const y = Math.max(event.clientY - 70, 8);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  document.addEventListener('mousemove', (e) => {
    if (!el.classList.contains('hidden')) move(e);
  });

  function buildResourceView(task, alloc) {
    return `
      <strong>${escHtml(task.title)}</strong><br>
      ${task.project ? `Project: ${escHtml(task.project)}<br>` : ''}
      ${alloc.startDate} → ${alloc.endDate}
    `.trim();
  }

  function buildTaskView(task, resource, alloc) {
    const roleColors = { DEVELOPER: '#16a34a', ANALYST: '#ea580c', TESTER: '#2563eb' };
    const color = resource ? (roleColors[resource.role] || '#64748b') : '#64748b';
    const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px;vertical-align:middle"></span>`;
    const name = resource ? escHtml(resource.name) : '—';
    return `
      <strong>${escHtml(task.title)}</strong><br>
      ${dot}${name}<br>
      ${alloc.startDate} → ${alloc.endDate}
    `.trim();
  }

  function buildVacationView(vac) {
    const typeLabels = { VACATION: 'Vacation', SICK_LEAVE: 'Sick leave', DAY_OFF: 'Day off' };
    const label = typeLabels[vac.type] ?? vac.type;
    return `
      <strong>${escHtml(label)}</strong><br>
      ${vac.comment ? `${escHtml(vac.comment)}<br>` : ''}
      ${vac.startDate} → ${vac.endDate}
    `.trim();
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { show, hide, buildResourceView, buildTaskView, buildVacationView, escHtml };
})();
