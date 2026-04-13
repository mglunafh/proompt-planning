'use strict';

const SidePanel = (() => {
  const panel   = document.getElementById('side-panel');
  const content = document.getElementById('side-panel-content');

  let openMode       = null; // 'task' | 'resource'
  let openTaskId     = null;
  let openResourceId = null;

  document.getElementById('side-panel-close').addEventListener('click', close);

  State.subscribe((state) => {
    if (panel.classList.contains('hidden')) return;
    if (openMode === 'task'     && openTaskId)     refreshTaskFromState(state, openTaskId);
    if (openMode === 'resource' && openResourceId) refreshResourceFromState(state, openResourceId);
  });

  // ── Delegation ────────────────────────────
  content.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) { handleAction(actionEl); return; }
    const option = e.target.closest('.alloc-resource-option, .alloc-task-option');
    if (option) selectOption(option);
  });

  function handleAction(el) {
    switch (el.dataset.action) {
      case 'delete-allocation':
        deleteAllocation(el.dataset.taskId, el.dataset.resourceId, el.dataset.start, el.dataset.end);
        break;
      case 'add-allocation':
        showAddTaskAllocationForm();
        break;
      case 'change-role':
        Timeline.openRoleDropdown(el, openResourceId);
        break;
      case 'add-resource-allocation':
        showAddResourceAllocationForm();
        break;
      case 'toggle-resource-dropdown':
      case 'toggle-task-dropdown':
        toggleDropdown();
        break;
      case 'alloc-confirm':
        confirmAddAllocation();
        break;
      case 'alloc-cancel': {
        const state = State.get();
        if (openMode === 'task')          refreshTaskFromState(state, openTaskId);
        else if (openMode === 'resource') refreshResourceFromState(state, openResourceId);
        break;
      }
      case 'add-vacation':
        showAddVacationForm();
        break;
      case 'vacation-confirm':
        confirmAddVacation();
        break;
      case 'vacation-cancel':
        refreshResourceFromState(State.get(), openResourceId);
        break;
      case 'delete-vacation':
        deleteVacation(el.dataset.resourceId, el.dataset.start, el.dataset.end, el.dataset.type);
        break;
    }
  }

  // ── Public API ────────────────────────────
  function openTask({ task, resources, allocations }) {
    openMode   = 'task';
    openTaskId = task.id;
    openResourceId = null;
    content.innerHTML = buildTaskContent(task, resources, allocations);
    panel.classList.remove('hidden');
  }

  function openResource({ resource, tasks, allocations }) {
    openMode       = 'resource';
    openResourceId = resource.id;
    openTaskId     = null;
    const vacations = State.get().vacations.filter(v => v.resourceId === resource.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    content.innerHTML = buildResourceContent(resource, tasks, allocations, vacations);
    panel.classList.remove('hidden');
  }

  function close() {
    openMode = openTaskId = openResourceId = null;
    panel.classList.add('hidden');
  }

  // ── Refresh ───────────────────────────────
  function refreshTaskFromState(state, taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const allocations = state.allocations.filter(a => a.taskId === taskId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const resources   = allocations.map(a => state.resources.find(r => r.id === a.resourceId)).filter(Boolean);
    content.innerHTML = buildTaskContent(task, resources, allocations);
  }

  function refreshResourceFromState(state, resourceId) {
    const resource  = state.resources.find(r => r.id === resourceId);
    if (!resource) return;
    const allocations = state.allocations.filter(a => a.resourceId === resourceId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const tasks       = allocations.map(a => state.tasks.find(t => t.id === a.taskId)).filter(Boolean);
    const vacations   = state.vacations.filter(v => v.resourceId === resourceId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    content.innerHTML = buildResourceContent(resource, tasks, allocations, vacations);
  }

  // ── Task panel HTML ───────────────────────
  function buildChildStoriesHtml(task) {
    if (task.type !== 'FEATURE' && task.type !== 'FEATURE_ENABLER') return '';
    const children = State.get().tasks.filter(t => t.parentId === task.id);
    if (children.length === 0) return '';
    const items = children.map(c => {
      const statusText = c.status ? ` <span style="color:#94a3b8;font-size:11px">${Tooltip.escHtml(c.status)}</span>` : '';
      return `<li style="padding:3px 0;border-bottom:1px solid #f1f5f9">${Tooltip.escHtml(c.title)}${statusText}</li>`;
    }).join('');
    return `
      <div class="panel-field">
        <div class="panel-field-label">Stories (${children.length})</div>
        <ul style="list-style:none;padding:0;margin:0;font-size:12px">${items}</ul>
      </div>`;
  }

  function buildTaskContent(task, resources, allocations) {
    const rows = allocations.map(a => {
      const res      = resources.find(r => r.id === a.resourceId);
      const name     = res ? Tooltip.escHtml(res.name) : Tooltip.escHtml(a.resourceId);
      const nameCell = res
        ? `<span class="alloc-resource-dot alloc-resource-dot--${res.role.toLowerCase()}"></span>${name}`
        : name;
      const delBtn = `<button class="btn-alloc-delete" data-action="delete-allocation" data-task-id="${Tooltip.escHtml(a.taskId)}" data-resource-id="${Tooltip.escHtml(a.resourceId)}" data-start="${a.startDate}" data-end="${a.endDate}" title="Remove allocation">&times;</button>`;
      return `<tr><td>${nameCell}</td><td>${a.startDate}</td><td>${a.endDate}</td><td style="width:18px;text-align:right">${delBtn}</td></tr>`;
    }).join('');

    return `
      <div class="panel-title">${Tooltip.escHtml(task.title)}</div>
      ${typeField(task.type)}
      ${field('Project', task.project)}
      ${field('Status', task.status)}
      ${field('Task ID', task.id)}
      ${buildChildStoriesHtml(task)}
      ${allocations.length > 0 ? `
        <div class="panel-field">
          <div class="panel-field-label">Allocations</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <thead><tr style="color:#64748b">
              <th style="text-align:left;padding-bottom:4px">Resource</th>
              <th style="text-align:left;padding-bottom:4px">From</th>
              <th style="text-align:left;padding-bottom:4px">To</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : ''}
      <div class="panel-field">
        <button class="btn-add-allocation" data-action="add-allocation">+ Add allocation</button>
      </div>
    `.trim();
  }

  // ── Resource panel HTML ───────────────────
  function buildResourceContent(resource, tasks, allocations, vacations = []) {
    const roleLabels = { DEVELOPER: 'Developer', ANALYST: 'Analyst', TESTER: 'Tester' };
    const vacTypeLabels = { VACATION: 'Vacation', SICK_LEAVE: 'Sick leave', DAY_OFF: 'Day off' };

    const allocRows = allocations.map(a => {
      const task = tasks.find(t => t.id === a.taskId);
      const name = task ? Tooltip.escHtml(task.title) : Tooltip.escHtml(a.taskId);
      const dot  = task
        ? `<span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(task.type)}"></span>`
        : '';
      const delBtn = `<button class="btn-alloc-delete" data-action="delete-allocation" data-task-id="${Tooltip.escHtml(a.taskId)}" data-resource-id="${Tooltip.escHtml(a.resourceId)}" data-start="${a.startDate}" data-end="${a.endDate}" title="Remove allocation">&times;</button>`;
      return `<tr><td>${dot}${name}</td><td>${a.startDate}</td><td>${a.endDate}</td><td style="width:18px;text-align:right">${delBtn}</td></tr>`;
    }).join('');

    const vacRows = vacations.map(v => {
      const typeLabel = Tooltip.escHtml(vacTypeLabels[v.type] ?? v.type);
      const comment   = v.comment ? ` <span style="color:#94a3b8">(${Tooltip.escHtml(v.comment)})</span>` : '';
      const delBtn = `<button class="btn-alloc-delete" data-action="delete-vacation" data-resource-id="${Tooltip.escHtml(v.resourceId)}" data-start="${v.startDate}" data-end="${v.endDate}" data-type="${Tooltip.escHtml(v.type)}" title="Remove vacation">&times;</button>`;
      return `<tr><td>${typeLabel}${comment}</td><td>${v.startDate}</td><td>${v.endDate}</td><td style="width:18px;text-align:right">${delBtn}</td></tr>`;
    }).join('');

    return `
      <div class="panel-title">${Tooltip.escHtml(resource.name)}</div>
      <div class="panel-field">
        <div class="panel-field-label">Role</div>
        <div><span class="role-badge role-badge--${resource.role.toLowerCase()} role-badge--clickable" data-action="change-role" title="Change role">${Tooltip.escHtml(roleLabels[resource.role] ?? resource.role)}</span></div>
      </div>
      ${allocations.length > 0 ? `
        <div class="panel-field">
          <div class="panel-field-label">Allocations</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <thead><tr style="color:#64748b">
              <th style="text-align:left;padding-bottom:4px">Task</th>
              <th style="text-align:left;padding-bottom:4px">From</th>
              <th style="text-align:left;padding-bottom:4px">To</th>
            </tr></thead>
            <tbody>${allocRows}</tbody>
          </table>
        </div>` : ''}
      <div class="panel-field">
        <button class="btn-add-allocation" data-action="add-resource-allocation">+ Add allocation</button>
      </div>
      ${vacations.length > 0 ? `
        <div class="panel-field">
          <div class="panel-field-label">Vacations</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <thead><tr style="color:#64748b">
              <th style="text-align:left;padding-bottom:4px">Type</th>
              <th style="text-align:left;padding-bottom:4px">From</th>
              <th style="text-align:left;padding-bottom:4px">To</th>
            </tr></thead>
            <tbody>${vacRows}</tbody>
          </table>
        </div>` : ''}
      <div class="panel-field">
        <button class="btn-add-allocation" data-action="add-vacation">+ Add vacation</button>
      </div>
    `.trim();
  }

  // ── Delete allocation ─────────────────────
  let _pendingDelete = null;

  const deleteDialog     = document.getElementById('delete-alloc-dialog');
  const deleteDialogBody = document.getElementById('delete-alloc-body');

  document.getElementById('btn-delete-alloc-confirm').addEventListener('click', async () => {
    if (!_pendingDelete) return;
    const pending = _pendingDelete;
    _pendingDelete = null;
    deleteDialog.classList.add('hidden');

    const state = State.get();
    if (pending._isVacation) {
      const newVacations = state.vacations.filter(v =>
        !(v.resourceId === pending.resourceId && v.startDate === pending.startDate &&
          v.endDate === pending.endDate && v.type === pending.type)
      );
      State.set({ vacations: newVacations });
      try {
        await API.savePlan(state.allocations, newVacations);
      } catch (err) {
        showError('Failed to save plan: ' + err.message);
      }
    } else {
      const { taskId, resourceId, startDate, endDate } = pending;
      const newAllocations = state.allocations.filter(a =>
        !(a.taskId === taskId && a.resourceId === resourceId &&
          a.startDate === startDate && a.endDate === endDate)
      );
      State.set({ allocations: newAllocations });
      try {
        await API.savePlan(newAllocations, state.vacations);
      } catch (err) {
        showError('Failed to save plan: ' + err.message);
      }
    }
  });

  document.getElementById('btn-delete-alloc-cancel').addEventListener('click', () => {
    _pendingDelete = null;
    deleteDialog.classList.add('hidden');
  });

  deleteDialog.addEventListener('click', (e) => {
    if (e.target === deleteDialog) {
      _pendingDelete = null;
      deleteDialog.classList.add('hidden');
    }
  });

  function deleteAllocation(taskId, resourceId, startDate, endDate) {
    const state    = State.get();
    const task     = state.tasks.find(t => t.id === taskId);
    const resource = state.resources.find(r => r.id === resourceId);
    const taskName = task     ? Tooltip.escHtml(task.title)     : Tooltip.escHtml(taskId);
    const resName  = resource ? Tooltip.escHtml(resource.name)  : Tooltip.escHtml(resourceId);
    deleteDialogBody.innerHTML =
      `<strong>${taskName}</strong> ← <strong>${resName}</strong><br>` +
      `<span style="color:#64748b;font-size:12px">${startDate} → ${endDate}</span>`;
    _pendingDelete = { taskId, resourceId, startDate, endDate };
    deleteDialog.classList.remove('hidden');
  }

  // ── Add-allocation forms ──────────────────
  function showAddTaskAllocationForm() {
    const state          = State.get();
    const taskAllocations = state.allocations.filter(a => a.taskId === openTaskId);
    const startDate      = defaultStartDate(taskAllocations, state);
    const endDate        = shiftDate(startDate, 6);
    const first          = state.resources[0];

    const optionItems = state.resources.map(r => `
      <button class="alloc-resource-option" data-value="${Tooltip.escHtml(r.id)}" data-role="${r.role.toLowerCase()}" data-name="${Tooltip.escHtml(r.name)}">
        <span class="alloc-resource-dot alloc-resource-dot--${r.role.toLowerCase()}"></span>${Tooltip.escHtml(r.name)}
      </button>`).join('');

    replaceAddButton('[data-action="add-allocation"]',
      buildCustomSelectHtml(first?.id ?? '', first ? `<span class="alloc-resource-dot alloc-resource-dot--${first.role.toLowerCase()}"></span>` : '', first ? Tooltip.escHtml(first.name) : '—', 'toggle-resource-dropdown', optionItems),
      startDate, endDate);
  }

  function showAddResourceAllocationForm() {
    const state              = State.get();
    const resourceAllocations = state.allocations.filter(a => a.resourceId === openResourceId);
    const startDate          = defaultStartDate(resourceAllocations, state);
    const endDate            = shiftDate(startDate, 6);
    const first              = state.tasks[0];
    const firstType          = first ? taskTypeCssClass(first.type) : 'story';

    const optionItems = state.tasks.map(t => `
      <button class="alloc-task-option" data-value="${Tooltip.escHtml(t.id)}" data-type="${taskTypeCssClass(t.type)}" data-name="${Tooltip.escHtml(t.title)}">
        <span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(t.type)}"></span>${Tooltip.escHtml(t.title)}
      </button>`).join('');

    replaceAddButton('[data-action="add-resource-allocation"]',
      buildCustomSelectHtml(first?.id ?? '', first ? `<span class="alloc-task-dot alloc-task-dot--${firstType}"></span>` : '', first ? Tooltip.escHtml(first.title) : '—', 'toggle-task-dropdown', optionItems),
      startDate, endDate);
  }

  function showAddVacationForm() {
    const state    = State.get();
    const existing = state.vacations.filter(v => v.resourceId === openResourceId);
    const startDate = defaultStartDate(existing, state);
    const endDate   = shiftDate(startDate, 6);
    const vacTypes  = [
      { value: 'VACATION',   label: 'Vacation' },
      { value: 'SICK_LEAVE', label: 'Sick leave' },
      { value: 'DAY_OFF',    label: 'Day off' },
    ];
    const fieldEl = content.querySelector('[data-action="add-vacation"]')?.closest('.panel-field');
    if (!fieldEl) return;
    fieldEl.outerHTML = `
      <div class="panel-field alloc-form" id="vacation-form">
        <div class="panel-field-label">New Vacation</div>
        <select class="alloc-vac-type-select" data-field="vac-type">
          ${vacTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
        </select>
        <div class="alloc-date-row">
          <input type="date" class="alloc-date-input" data-field="vac-start" value="${startDate}">
          <span class="alloc-date-sep">→</span>
          <input type="date" class="alloc-date-input" data-field="vac-end" value="${endDate}">
        </div>
        <input type="text" class="alloc-vac-comment-input" data-field="vac-comment" placeholder="Comment (optional)">
        <div class="alloc-form-actions">
          <button class="btn-alloc-confirm" data-action="vacation-confirm">Add</button>
          <button class="btn-alloc-cancel" data-action="vacation-cancel">Cancel</button>
        </div>
      </div>`;
  }

  async function confirmAddVacation() {
    const type      = content.querySelector('[data-field="vac-type"]')?.value;
    const startDate = content.querySelector('[data-field="vac-start"]')?.value;
    const endDate   = content.querySelector('[data-field="vac-end"]')?.value;
    const comment   = content.querySelector('[data-field="vac-comment"]')?.value.trim() || undefined;
    if (!type || !startDate || !endDate) return;

    const state       = State.get();
    const newVacation = { resourceId: openResourceId, startDate, endDate, type, ...(comment ? { comment } : {}) };
    const newVacations = [...state.vacations, newVacation];
    State.set({ vacations: newVacations });
    try {
      await API.savePlan(state.allocations, newVacations);
    } catch (err) {
      showError('Failed to save plan: ' + err.message);
    }
  }

  function deleteVacation(resourceId, startDate, endDate, type) {
    const state    = State.get();
    const resource = state.resources.find(r => r.id === resourceId);
    const typeLabels = { VACATION: 'Vacation', SICK_LEAVE: 'Sick leave', DAY_OFF: 'Day off' };
    const resName  = resource ? Tooltip.escHtml(resource.name) : Tooltip.escHtml(resourceId);
    deleteDialogBody.innerHTML =
      `<strong>${Tooltip.escHtml(typeLabels[type] ?? type)}</strong> — <strong>${resName}</strong><br>` +
      `<span style="color:#64748b;font-size:12px">${startDate} → ${endDate}</span>`;
    _pendingDelete = { _isVacation: true, resourceId, startDate, endDate, type };
    deleteDialog.classList.remove('hidden');
  }

  function replaceAddButton(selector, selectHtml, startDate, endDate) {
    const fieldEl = content.querySelector(selector)?.closest('.panel-field');
    if (!fieldEl) return;
    fieldEl.outerHTML = `
      <div class="panel-field alloc-form">
        <div class="panel-field-label">New Allocation</div>
        ${selectHtml}
        <div class="alloc-date-row">
          <input type="date" class="alloc-date-input" data-field="start" value="${startDate}">
          <span class="alloc-date-sep">→</span>
          <input type="date" class="alloc-date-input" data-field="end" value="${endDate}">
        </div>
        <input type="text" class="alloc-vac-comment-input" data-field="comment" placeholder="Comment (optional)">
        <div class="alloc-form-actions">
          <button class="btn-alloc-confirm" data-action="alloc-confirm">Add</button>
          <button class="btn-alloc-cancel" data-action="alloc-cancel">Cancel</button>
        </div>
      </div>`;
  }

  function buildCustomSelectHtml(selectedId, triggerDotHtml, triggerName, toggleAction, optionItems) {
    return `
      <div class="alloc-custom-select" data-selected-value="${Tooltip.escHtml(selectedId)}">
        <button class="alloc-select-trigger" data-action="${toggleAction}" type="button">
          ${triggerDotHtml}<span class="alloc-select-label">${triggerName}</span><span class="alloc-select-chevron">▾</span>
        </button>
        <div class="alloc-select-list hidden">${optionItems}</div>
      </div>`;
  }

  function toggleDropdown() {
    content.querySelector('.alloc-select-list')?.classList.toggle('hidden');
  }

  function selectOption(option) {
    const container = content.querySelector('.alloc-custom-select');
    const list      = content.querySelector('.alloc-select-list');
    if (!container || !list) return;
    container.dataset.selectedValue = option.dataset.value;
    const dot  = option.dataset.role
      ? `<span class="alloc-resource-dot alloc-resource-dot--${option.dataset.role}"></span>`
      : `<span class="alloc-task-dot alloc-task-dot--${option.dataset.type}"></span>`;
    const trigger = container.querySelector('.alloc-select-trigger');
    trigger.innerHTML = `${dot}<span class="alloc-select-label">${Tooltip.escHtml(option.dataset.name)}</span><span class="alloc-select-chevron">▾</span>`;
    list.classList.add('hidden');
  }

  async function confirmAddAllocation() {
    const selectedValue = content.querySelector('.alloc-custom-select')?.dataset.selectedValue;
    const startDate     = content.querySelector('[data-field="start"]')?.value;
    const endDate       = content.querySelector('[data-field="end"]')?.value;
    if (!selectedValue || !startDate || !endDate) return;

    const comment = content.querySelector('[data-field="comment"]')?.value.trim() || undefined;
    const state = State.get();
    const newAlloc = openMode === 'task'
      ? { taskId: openTaskId,    resourceId: selectedValue, startDate, endDate, ...(comment ? { comment } : {}) }
      : { taskId: selectedValue, resourceId: openResourceId, startDate, endDate, ...(comment ? { comment } : {}) };

    const newAllocations = [...state.allocations, newAlloc];
    State.set({ allocations: newAllocations });

    try {
      await API.savePlan(newAllocations, state.vacations);
    } catch (err) {
      showError('Failed to save plan: ' + err.message);
    }
  }

  // ── Date helpers ──────────────────────────
  function defaultStartDate(existingAllocations, state) {
    if (existingAllocations.length > 0) {
      const latestEnd = existingAllocations.reduce((max, a) => a.endDate > max ? a.endDate : max, '');
      return shiftDate(latestEnd, 1);
    }
    const rangeStart = document.getElementById('timeline-body').dataset.rangeStart;
    const base = rangeStart ? parseLocalDate(rangeStart) : new Date();
    if (state.zoom === 'week') {
      const dayOfWeek = (base.getDay() + 6) % 7;
      base.setDate(base.getDate() - dayOfWeek);
    }
    return formatLocalDate(base);
  }

  function shiftDate(dateStr, days) {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + days);
    return formatLocalDate(d);
  }

  function parseLocalDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatLocalDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 4000);
  }

  // ── HTML field helpers ────────────────────
  function typeField(type) {
    if (!type) return '';
    const labels   = { STORY: 'Story', FEATURE: 'Feature', FEATURE_ENABLER: 'Feature Enabler' };
    const cssClass = { STORY: 'story', FEATURE: 'feature', FEATURE_ENABLER: 'feature-enabler' };
    const label    = labels[type] ?? type;
    const cls      = cssClass[type] ?? 'story';
    return `
      <div class="panel-field">
        <div class="panel-field-label">Type</div>
        <div><span class="type-badge type-badge--${cls}">${Tooltip.escHtml(label)}</span></div>
      </div>`;
  }

  function field(label, value) {
    if (!value) return '';
    return `
      <div class="panel-field">
        <div class="panel-field-label">${label}</div>
        <div>${Tooltip.escHtml(value)}</div>
      </div>`;
  }

  function taskTypeCssClass(type) {
    switch (type) {
      case 'FEATURE': return 'feature';
      case 'FEATURE_ENABLER': return 'feature-enabler';
      default: return 'story';
    }
  }

  return { open: openTask, openTask, openResource, close, promptDeleteAllocation: deleteAllocation, promptDeleteVacation: deleteVacation, showError };
})();
