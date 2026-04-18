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
      <span style="color:#94a3b8;font-size:11px">${escHtml(task.id)}</span><br>
      <strong>${escHtml(task.title)}</strong><br>
      ${task.project ? `Project: ${escHtml(task.project)}<br>` : ''}
      ${alloc.comment ? `${escHtml(alloc.comment)}<br>` : ''}
      ${alloc.estimatedDuration > 0 ? `Est. ${formatDuration(alloc.estimatedDuration)}<br>` : ''}
      ${alloc.startDate} \u2192 ${alloc.endDate}
    `.trim();
  }

  function buildTaskView(task, resource, alloc) {
    const dotClass = resource
      ? `alloc-resource-dot alloc-resource-dot--${resource.role.toLowerCase()}`
      : 'alloc-resource-dot';
    const dot = `<span class="${dotClass}" style="width:8px;height:8px;margin-right:5px;vertical-align:middle"></span>`;
    const name = resource ? escHtml(resource.name) : '—';
    return `
      <span style="color:#94a3b8;font-size:11px">${escHtml(task.id)}</span><br>
      <strong>${escHtml(task.title)}</strong><br>
      ${dot}${name}<br>
      ${alloc.comment ? `${escHtml(alloc.comment)}<br>` : ''}
      ${alloc.estimatedDuration > 0 ? `Est. ${formatDuration(alloc.estimatedDuration)}<br>` : ''}
      ${alloc.startDate} \u2192 ${alloc.endDate}
    `.trim();
  }

  function buildVacationView(vac) {
    const label = VAC_TYPE_LABELS[vac.type] ?? vac.type;
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
