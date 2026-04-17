'use strict';

const SidePanel = (() => {
  const panel   = document.getElementById('side-panel');
  const content = document.getElementById('side-panel-content');

  let openMode       = null; // 'task' | 'resource' | 'work-planning'
  let openTaskId     = null;
  let openResourceId = null;

  let _editingAllocation  = null; // full Allocation object being edited
  let _editingVacation    = null; // full Vacation object being edited
  let _editingWorkSegment = null; // full WorkSegment object being edited
  let _addingAllocation   = null; // { resourceId, startDate } for new allocation dialog
  let _addingWorkSegment  = null; // truthy when add-work-segment modal is open

  const editDialog      = document.getElementById('edit-alloc-dialog');
  const editDialogTitle = document.getElementById('edit-dialog-title');
  const editDialogBody  = document.getElementById('edit-dialog-body');

  document.getElementById('btn-edit-confirm').addEventListener('click', () => {
    if (_editingAllocation) confirmEditAllocation();
    else if (_editingVacation) confirmEditVacation();
    else if (_editingWorkSegment) confirmEditWorkSegment();
    else if (_addingAllocation) confirmAddAllocationDialog();
    else if (_addingWorkSegment) confirmAddWorkSegmentDialog();
  });
  document.getElementById('btn-edit-cancel').addEventListener('click', closeEditDialog);
  editDialog.addEventListener('click', (e) => { if (e.target === editDialog) closeEditDialog(); });

  editDialogBody.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl && (['toggle-resource-dropdown', 'toggle-task-dropdown', 'toggle-role-dropdown'].includes(actionEl.dataset.action))) {
      const thisSelect = actionEl.closest('.alloc-custom-select');
      const thisList   = thisSelect?.querySelector('.alloc-select-list');
      editDialogBody.querySelectorAll('.alloc-select-list').forEach(l => { if (l !== thisList) l.classList.add('hidden'); });
      thisList?.classList.toggle('hidden');
      return;
    }
    const option = e.target.closest('.alloc-resource-option, .alloc-task-option, .alloc-role-option');
    if (option) selectOptionIn(editDialogBody, option);
  });

  function closeEditDialog() {
    _editingAllocation = _editingVacation = _editingWorkSegment = _addingAllocation = _addingWorkSegment = null;
    editDialog.classList.add('hidden');
  }

  document.getElementById('side-panel-close').addEventListener('click', close);

  State.subscribe((state) => {
    if (panel.classList.contains('hidden')) return;
    if (openMode === 'task'          && openTaskId)     refreshTaskFromState(state, openTaskId);
    if (openMode === 'resource'      && openResourceId) refreshResourceFromState(state, openResourceId);
    if (openMode === 'work-planning' && openTaskId)     refreshWorkPlanningFromState(state, openTaskId);
  });

  // ── Delegation ────────────────────────────
  content.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) { handleAction(actionEl); return; }
    const option = e.target.closest('.alloc-resource-option, .alloc-task-option, .alloc-role-option');
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
      case 'toggle-role-dropdown':
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
      case 'edit-allocation': {
        const alloc = State.get().allocations.find(a =>
          a.taskId === el.dataset.taskId && a.resourceId === el.dataset.resourceId &&
          a.startDate === el.dataset.start && a.endDate === el.dataset.end
        );
        if (alloc) openEditAllocationDialog(alloc);
        break;
      }
      case 'edit-vacation': {
        const vac = State.get().vacations.find(v =>
          v.resourceId === el.dataset.resourceId && v.startDate === el.dataset.start &&
          v.endDate === el.dataset.end && v.type === el.dataset.type
        );
        if (vac) openEditVacationDialog(vac);
        break;
      }
      case 'add-work-segment':
        showAddWorkSegmentForm();
        break;
      case 'work-segment-confirm':
        confirmAddWorkSegment();
        break;
      case 'work-segment-cancel':
        refreshWorkPlanningFromState(State.get(), openTaskId);
        break;
      case 'delete-work-segment':
        deleteWorkSegment(el.dataset.segmentId);
        break;
      case 'edit-work-segment': {
        const seg = State.get().workSegments.find(s => s.id === el.dataset.segmentId);
        if (seg) openEditWorkSegmentDialog(seg);
        break;
      }
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

  function openWorkPlanningTask({ task, workSegments }) {
    openMode       = 'work-planning';
    openTaskId     = task.id;
    openResourceId = null;
    content.innerHTML = buildWorkPlanningContent(task, workSegments);
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

  function refreshWorkPlanningFromState(state, taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const workSegments = (state.workSegments ?? []).filter(s => s.taskId === taskId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    content.innerHTML = buildWorkPlanningContent(task, workSegments);
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
      const delBtn  = `<button class="btn-alloc-delete" data-action="delete-allocation" data-task-id="${Tooltip.escHtml(a.taskId)}" data-resource-id="${Tooltip.escHtml(a.resourceId)}" data-start="${a.startDate}" data-end="${a.endDate}" title="Remove allocation">&times;</button>`;
      const editBtn = `<button class="btn-alloc-edit" data-action="edit-allocation" data-task-id="${Tooltip.escHtml(a.taskId)}" data-resource-id="${Tooltip.escHtml(a.resourceId)}" data-start="${a.startDate}" data-end="${a.endDate}" title="Edit allocation">✎</button>`;
      return `<tr><td>${nameCell}</td><td>${a.startDate}</td><td>${a.endDate}</td><td style="width:36px;text-align:right">${editBtn}${delBtn}</td></tr>`;
    }).join('');

    return `
      <div class="task-id">${Tooltip.escHtml(task.id)}</div>
      <div class="panel-title">${Tooltip.escHtml(task.title)}</div>
      ${typeField(task.type)}
      ${field('Project', task.project)}
      ${field('Status', task.status)}
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
    const allocRows = allocations.map(a => {
      const task = tasks.find(t => t.id === a.taskId);
      const name = task ? Tooltip.escHtml(task.title) : Tooltip.escHtml(a.taskId);
      const dot  = task
        ? `<span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(task.type)}"></span>`
        : '';
      const delBtn  = `<button class="btn-alloc-delete" data-action="delete-allocation" data-task-id="${Tooltip.escHtml(a.taskId)}" data-resource-id="${Tooltip.escHtml(a.resourceId)}" data-start="${a.startDate}" data-end="${a.endDate}" title="Remove allocation">&times;</button>`;
      const editBtn = `<button class="btn-alloc-edit" data-action="edit-allocation" data-task-id="${Tooltip.escHtml(a.taskId)}" data-resource-id="${Tooltip.escHtml(a.resourceId)}" data-start="${a.startDate}" data-end="${a.endDate}" title="Edit allocation">✎</button>`;
      return `<tr><td>${dot}${name}</td><td>${a.startDate}</td><td>${a.endDate}</td><td style="width:36px;text-align:right">${editBtn}${delBtn}</td></tr>`;
    }).join('');

    const vacRows = vacations.map(v => {
      const typeLabel = Tooltip.escHtml(VAC_TYPE_LABELS[v.type] ?? v.type);
      const comment   = v.comment ? ` <span style="color:#94a3b8">(${Tooltip.escHtml(v.comment)})</span>` : '';
      const delBtn  = `<button class="btn-alloc-delete" data-action="delete-vacation" data-resource-id="${Tooltip.escHtml(v.resourceId)}" data-start="${v.startDate}" data-end="${v.endDate}" data-type="${Tooltip.escHtml(v.type)}" title="Remove vacation">&times;</button>`;
      const editBtn = `<button class="btn-alloc-edit" data-action="edit-vacation" data-resource-id="${Tooltip.escHtml(v.resourceId)}" data-start="${v.startDate}" data-end="${v.endDate}" data-type="${Tooltip.escHtml(v.type)}" title="Edit vacation">✎</button>`;
      return `<tr><td>${typeLabel}${comment}</td><td>${v.startDate}</td><td>${v.endDate}</td><td style="width:36px;text-align:right">${editBtn}${delBtn}</td></tr>`;
    }).join('');

    return `
      <div class="panel-title">${Tooltip.escHtml(resource.name)}</div>
      <div class="panel-field">
        <div class="panel-field-label">Role</div>
        <div><span class="role-badge role-badge--${resource.role.toLowerCase()} role-badge--clickable" data-action="change-role" title="Change role">${Tooltip.escHtml(ROLE_LABELS[resource.role] ?? resource.role)}</span></div>
      </div>
      ${field('ID', resource.id)}
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

  // ── Work planning panel HTML ──────────────
  function buildWorkPlanningContent(task, workSegments) {
    const rows = workSegments.map(s => {
      const roleLabel = ROLE_LABELS[s.role] ?? s.role;
      const comment   = s.comment ? ` <span style="color:#94a3b8">(${Tooltip.escHtml(s.comment)})</span>` : '';
      const delBtn  = `<button class="btn-alloc-delete" data-action="delete-work-segment" data-segment-id="${Tooltip.escHtml(s.id)}" title="Remove segment">&times;</button>`;
      const editBtn = `<button class="btn-alloc-edit"   data-action="edit-work-segment"   data-segment-id="${Tooltip.escHtml(s.id)}" title="Edit segment">✎</button>`;
      return `<tr>
        <td><span class="alloc-resource-dot alloc-resource-dot--${s.role.toLowerCase()}"></span>${Tooltip.escHtml(s.label)}${comment}</td>
        <td><span class="role-badge role-badge--${s.role.toLowerCase()}" style="font-size:10px">${Tooltip.escHtml(roleLabel)}</span></td>
        <td>${s.startDate}</td><td>${s.endDate}</td>
        <td style="width:36px;text-align:right">${editBtn}${delBtn}</td>
      </tr>`;
    }).join('');

    return `
      <div class="task-id">${Tooltip.escHtml(task.id)}</div>
      <div class="panel-title">${Tooltip.escHtml(task.title)}</div>
      ${typeField(task.type)}
      ${field('Project', task.project)}
      ${field('Status', task.status)}
      ${workSegments.length > 0 ? `
        <div class="panel-field">
          <div class="panel-field-label">Work segments</div>
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <thead><tr style="color:#64748b">
              <th style="text-align:left;padding-bottom:4px">Label</th>
              <th style="text-align:left;padding-bottom:4px">Role</th>
              <th style="text-align:left;padding-bottom:4px">From</th>
              <th style="text-align:left;padding-bottom:4px">To</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : ''}
      <div class="panel-field">
        <button class="btn-add-allocation" data-action="add-work-segment">+ Add work segment</button>
      </div>
    `.trim();
  }

  function showAddWorkSegmentForm() {
    const state     = State.get();
    const existing  = (state.workSegments ?? []).filter(s => s.taskId === openTaskId);
    const startDate = defaultStartDate(existing, state);
    const endDate   = shiftDate(startDate, 6);

    const fieldEl = content.querySelector('[data-action="add-work-segment"]')?.closest('.panel-field');
    if (!fieldEl) return;
    fieldEl.outerHTML = `
      <div class="panel-field alloc-form" id="work-segment-form">
        <div class="panel-field-label">New Work Segment</div>
        <input type="text" class="alloc-vac-comment-input" data-field="seg-label" placeholder="Label (e.g. Analysis)" style="margin-bottom:6px">
        ${buildRoleCustomSelectHtml(ROLES[0])}
        <div class="alloc-date-row">
          <input type="date" class="alloc-date-input" data-field="seg-start" value="${startDate}">
          <span class="alloc-date-sep">→</span>
          <input type="date" class="alloc-date-input" data-field="seg-end" value="${endDate}">
        </div>
        <input type="text" class="alloc-vac-comment-input" data-field="seg-comment" placeholder="Comment (optional)">
        <div class="alloc-form-actions">
          <button class="btn-alloc-confirm" data-action="work-segment-confirm">Add</button>
          <button class="btn-alloc-cancel"  data-action="work-segment-cancel">Cancel</button>
        </div>
      </div>`;
  }

  async function confirmAddWorkSegment() {
    const label     = content.querySelector('[data-field="seg-label"]')?.value.trim();
    const role      = content.querySelector('.alloc-custom-select')?.dataset.selectedValue;
    const startDate = content.querySelector('[data-field="seg-start"]')?.value;
    const endDate   = content.querySelector('[data-field="seg-end"]')?.value;
    const comment   = content.querySelector('[data-field="seg-comment"]')?.value.trim() || undefined;
    if (!label || !role || !startDate || !endDate) return;
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) { showError(dateError); return; }

    const state = State.get();
    const newSeg = { id: crypto.randomUUID(), taskId: openTaskId, label, role, startDate, endDate, ...(comment ? { comment } : {}) };
    const newWorkSegments = [...(state.workSegments ?? []), newSeg];
    await savePlanSafely({ workSegments: newWorkSegments });
  }

  function deleteWorkSegment(segmentId) {
    const state = State.get();
    const seg   = (state.workSegments ?? []).find(s => s.id === segmentId);
    const task  = state.tasks.find(t => t.id === seg?.taskId);
    deleteDialogBody.innerHTML =
      `<strong>${seg ? Tooltip.escHtml(seg.label) : 'Work segment'}</strong><br>` +
      (task ? `<span style="color:#64748b;font-size:12px">${Tooltip.escHtml(task.title)}</span><br>` : '') +
      (seg  ? `<span style="color:#64748b;font-size:12px">${seg.startDate} → ${seg.endDate}</span>` : '');
    _pendingDelete = { _isWorkSegment: true, segmentId };
    deleteDialog.classList.remove('hidden');
  }

  function openEditWorkSegmentDialog(seg) {
    _editingAllocation = _editingVacation = _addingWorkSegment = null;
    _editingWorkSegment = seg;
    editDialogTitle.textContent = 'Edit Work Segment';
    const state = State.get();
    const sortedTasks = [...state.tasks].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const taskOptions = sortedTasks.map(t => `
      <button class="alloc-task-option" data-value="${Tooltip.escHtml(t.id)}"
        data-type="${taskTypeCssClass(t.type)}" data-name="${Tooltip.escHtml(t.id + ': ' + t.title)}">
        <span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(t.type)}"></span>
        <span style="color:#94a3b8;font-size:11px">${Tooltip.escHtml(t.id)}</span> ${Tooltip.escHtml(t.title)}</button>`).join('');
    const selTask  = state.tasks.find(t => t.id === seg.taskId);
    const taskDot  = selTask ? `<span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(selTask.type)}"></span>` : '';
    const taskName = selTask ? Tooltip.escHtml(selTask.id + ': ' + selTask.title) : Tooltip.escHtml(seg.taskId);
    editDialogBody.innerHTML = `
      <div class="alloc-form">
        <div class="panel-field-label" style="margin-bottom:4px">Task</div>
        ${buildCustomSelectHtml(seg.taskId, taskDot, taskName, 'toggle-task-dropdown', taskOptions)}
        <div class="panel-field-label" style="margin:8px 0 4px">Label</div>
        <input type="text" class="alloc-vac-comment-input" data-field="seg-label" value="${Tooltip.escHtml(seg.label)}" style="margin-bottom:6px">
        <div class="panel-field-label" style="margin-bottom:4px">Role</div>
        ${buildRoleCustomSelectHtml(seg.role)}
        <div class="alloc-date-row" style="margin-top:8px">
          <input type="date" class="alloc-date-input" data-field="seg-start" value="${seg.startDate}">
          <span class="alloc-date-sep">→</span>
          <input type="date" class="alloc-date-input" data-field="seg-end" value="${seg.endDate}">
        </div>
        <input type="text" class="alloc-vac-comment-input" data-field="seg-comment"
          placeholder="Comment (optional)" value="${Tooltip.escHtml(seg.comment ?? '')}">
      </div>`;
    editDialog.classList.remove('hidden');
  }

  async function confirmEditWorkSegment() {
    const orig      = _editingWorkSegment;
    const selects   = editDialogBody.querySelectorAll('.alloc-custom-select');
    const taskId    = selects[0]?.dataset.selectedValue;
    const label     = editDialogBody.querySelector('[data-field="seg-label"]')?.value.trim();
    const role      = selects[1]?.dataset.selectedValue;
    const startDate = editDialogBody.querySelector('[data-field="seg-start"]')?.value;
    const endDate   = editDialogBody.querySelector('[data-field="seg-end"]')?.value;
    const comment   = editDialogBody.querySelector('[data-field="seg-comment"]')?.value.trim() || undefined;
    if (!taskId || !label || !role || !startDate || !endDate) return;
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) { showError(dateError); return; }
    const state   = State.get();
    const updated = { ...orig, taskId, label, role, startDate, endDate, ...(comment ? { comment } : { comment: undefined }) };
    const newWorkSegments = (state.workSegments ?? []).map(s => s.id === orig.id ? updated : s);
    const confirmBtn = document.getElementById('btn-edit-confirm');
    closeEditDialog();
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      await savePlanSafely({ workSegments: newWorkSegments });
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  function openAddWorkSegmentDialog(taskId, startDate) {
    _editingAllocation = _editingVacation = _editingWorkSegment = _addingAllocation = null;
    _addingWorkSegment = { taskId };
    const state = State.get();
    const endDate = shiftDate(startDate, 6);
    editDialogTitle.textContent = 'Add Work Segment';
    const sortedTasks = [...state.tasks].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const taskOptions = sortedTasks.map(t => `
      <button class="alloc-task-option" data-value="${Tooltip.escHtml(t.id)}"
        data-type="${taskTypeCssClass(t.type)}" data-name="${Tooltip.escHtml(t.id + ': ' + t.title)}">
        <span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(t.type)}"></span>
        <span style="color:#94a3b8;font-size:11px">${Tooltip.escHtml(t.id)}</span> ${Tooltip.escHtml(t.title)}</button>`).join('');
    const selTask  = state.tasks.find(t => t.id === taskId);
    const taskDot  = selTask ? `<span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(selTask.type)}"></span>` : '';
    const taskName = selTask ? Tooltip.escHtml(selTask.id + ': ' + selTask.title) : (taskId ? Tooltip.escHtml(taskId) : '—');
    editDialogBody.innerHTML = `
      <div class="alloc-form">
        <div class="panel-field-label" style="margin-bottom:4px">Task</div>
        ${buildCustomSelectHtml(taskId ?? '', taskDot, taskName, 'toggle-task-dropdown', taskOptions)}
        <div class="panel-field-label" style="margin:8px 0 4px">Label</div>
        <input type="text" class="alloc-vac-comment-input" data-field="seg-label" placeholder="Label (e.g. Analysis)" style="margin-bottom:6px">
        <div class="panel-field-label" style="margin-bottom:4px">Role</div>
        ${buildRoleCustomSelectHtml(ROLES[0])}
        <div class="alloc-date-row" style="margin-top:8px">
          <input type="date" class="alloc-date-input" data-field="seg-start" value="${startDate}">
          <span class="alloc-date-sep">→</span>
          <input type="date" class="alloc-date-input" data-field="seg-end" value="${endDate}">
        </div>
        <input type="text" class="alloc-vac-comment-input" data-field="seg-comment" placeholder="Comment (optional)">
      </div>`;
    editDialog.classList.remove('hidden');
  }

  async function confirmAddWorkSegmentDialog() {
    const selects   = editDialogBody.querySelectorAll('.alloc-custom-select');
    const taskId    = selects[0]?.dataset.selectedValue;
    const role      = selects[1]?.dataset.selectedValue;
    const label     = editDialogBody.querySelector('[data-field="seg-label"]')?.value.trim();
    const startDate = editDialogBody.querySelector('[data-field="seg-start"]')?.value;
    const endDate   = editDialogBody.querySelector('[data-field="seg-end"]')?.value;
    const comment   = editDialogBody.querySelector('[data-field="seg-comment"]')?.value.trim() || undefined;
    if (!taskId || !role || !label || !startDate || !endDate) return;
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) { showError(dateError); return; }
    const state = State.get();
    const newSeg = { id: crypto.randomUUID(), taskId, label, role, startDate, endDate, ...(comment ? { comment } : {}) };
    const newWorkSegments = [...(state.workSegments ?? []), newSeg];
    const confirmBtn = document.getElementById('btn-edit-confirm');
    closeEditDialog();
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      await savePlanSafely({ workSegments: newWorkSegments });
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
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
    if (pending._isWorkSegment) {
      const newWorkSegments = (state.workSegments ?? []).filter(s => s.id !== pending.segmentId);
      await savePlanSafely({ workSegments: newWorkSegments });
    } else if (pending._isVacation) {
      const newVacations = state.vacations.filter(v =>
        !(v.resourceId === pending.resourceId && v.startDate === pending.startDate &&
          v.endDate === pending.endDate && v.type === pending.type)
      );
      await savePlanSafely({ vacations: newVacations });
    } else {
      const { taskId, resourceId, startDate, endDate } = pending;
      const newAllocations = state.allocations.filter(a =>
        !(a.taskId === taskId && a.resourceId === resourceId &&
          a.startDate === startDate && a.endDate === endDate)
      );
      await savePlanSafely({ allocations: newAllocations });
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

  function showAddResourceAllocationForm(prefilledStartDate = null) {
    const state              = State.get();
    const resourceAllocations = state.allocations.filter(a => a.resourceId === openResourceId);
    const startDate          = prefilledStartDate ?? defaultStartDate(resourceAllocations, state);
    const endDate            = shiftDate(startDate, 6);
    const first              = state.tasks[0];
    const firstType          = first ? taskTypeCssClass(first.type) : 'story';

    const optionItems = state.tasks.map(t => `
      <button class="alloc-task-option" data-value="${Tooltip.escHtml(t.id)}" data-type="${taskTypeCssClass(t.type)}" data-name="${Tooltip.escHtml(t.id + ': ' + t.title)}">
        <span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(t.type)}"></span>
        <span style="color:#94a3b8;font-size:11px">${Tooltip.escHtml(t.id)}</span> ${Tooltip.escHtml(t.title)}
      </button>`).join('');

    replaceAddButton('[data-action="add-resource-allocation"]',
      buildCustomSelectHtml(first?.id ?? '', first ? `<span class="alloc-task-dot alloc-task-dot--${firstType}"></span>` : '', first ? Tooltip.escHtml(first.id + ': ' + first.title) : '—', 'toggle-task-dropdown', optionItems),
      startDate, endDate);
  }

  function showAddVacationForm() {
    const state    = State.get();
    const existing = state.vacations.filter(v => v.resourceId === openResourceId);
    const startDate = defaultStartDate(existing, state);
    const endDate   = shiftDate(startDate, 6);
    const vacTypes = Object.keys(VAC_TYPE_LABELS).map(v => ({ value: v, label: VAC_TYPE_LABELS[v] }));
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
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) { showError(dateError); return; }

    const state       = State.get();
    const newVacation = { resourceId: openResourceId, startDate, endDate, type, ...(comment ? { comment } : {}) };
    const newVacations = [...state.vacations, newVacation];
    await savePlanSafely({ vacations: newVacations });
  }

  function deleteVacation(resourceId, startDate, endDate, type) {
    const state    = State.get();
    const resource = state.resources.find(r => r.id === resourceId);
    const resName  = resource ? Tooltip.escHtml(resource.name) : Tooltip.escHtml(resourceId);
    deleteDialogBody.innerHTML =
      `<strong>${Tooltip.escHtml(VAC_TYPE_LABELS[type] ?? type)}</strong> — <strong>${resName}</strong><br>` +
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

  function buildRoleCustomSelectHtml(selectedRole) {
    const options = ROLES.map(r => `
      <button class="alloc-role-option" data-value="${r}" data-role="${r.toLowerCase()}" data-name="${Tooltip.escHtml(ROLE_LABELS[r])}">
        <span class="alloc-resource-dot alloc-resource-dot--${r.toLowerCase()}"></span>${Tooltip.escHtml(ROLE_LABELS[r])}
      </button>`).join('');
    const dot   = `<span class="alloc-resource-dot alloc-resource-dot--${selectedRole.toLowerCase()}"></span>`;
    const label = Tooltip.escHtml(ROLE_LABELS[selectedRole] ?? selectedRole);
    return buildCustomSelectHtml(selectedRole, dot, label, 'toggle-role-dropdown', options);
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
    toggleDropdownIn(content);
  }

  function toggleDropdownIn(container) {
    container.querySelector('.alloc-select-list')?.classList.toggle('hidden');
  }

  function selectOption(option) {
    selectOptionIn(content, option);
  }

  function selectOptionIn(container, option) {
    const customSelect = option.closest('.alloc-custom-select');
    const list         = customSelect?.querySelector('.alloc-select-list');
    if (!customSelect || !list) return;
    customSelect.dataset.selectedValue = option.dataset.value;
    const dot  = option.dataset.role
      ? `<span class="alloc-resource-dot alloc-resource-dot--${option.dataset.role}"></span>`
      : `<span class="alloc-task-dot alloc-task-dot--${option.dataset.type}"></span>`;
    const trigger = customSelect.querySelector('.alloc-select-trigger');
    trigger.innerHTML = `${dot}<span class="alloc-select-label">${Tooltip.escHtml(option.dataset.name)}</span><span class="alloc-select-chevron">▾</span>`;
    list.classList.add('hidden');
  }

  async function confirmAddAllocation() {
    const selectedValue = content.querySelector('.alloc-custom-select')?.dataset.selectedValue;
    const startDate     = content.querySelector('[data-field="start"]')?.value;
    const endDate       = content.querySelector('[data-field="end"]')?.value;
    if (!selectedValue || !startDate || !endDate) return;
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) { showError(dateError); return; }

    const comment = content.querySelector('[data-field="comment"]')?.value.trim() || undefined;
    const state = State.get();
    const newAlloc = openMode === 'task'
      ? { id: crypto.randomUUID(), taskId: openTaskId,    resourceId: selectedValue, startDate, endDate, ...(comment ? { comment } : {}) }
      : { id: crypto.randomUUID(), taskId: selectedValue, resourceId: openResourceId, startDate, endDate, ...(comment ? { comment } : {}) };

    const newAllocations = [...state.allocations, newAlloc];
    await savePlanSafely({ allocations: newAllocations });
  }

  // ── Add allocation dialog ────────────────
  function openAddAllocationDialog({ resourceId = null, taskId = null } = {}, startDate) {
    _editingAllocation = _editingVacation = null;
    _addingAllocation  = { resourceId };
    const state   = State.get();
    const endDate = shiftDate(startDate, 6);
    editDialogTitle.textContent = 'Add Allocation';

    const taskOptions = [...state.tasks].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map(t => `
      <button class="alloc-task-option" data-value="${Tooltip.escHtml(t.id)}"
        data-type="${taskTypeCssClass(t.type)}" data-name="${Tooltip.escHtml(t.id + ': ' + t.title)}">
        <span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(t.type)}"></span>
        <span style="color:#94a3b8;font-size:11px">${Tooltip.escHtml(t.id)}</span> ${Tooltip.escHtml(t.title)}</button>`).join('');
    const selTask   = taskId ? state.tasks.find(t => t.id === taskId) : null;
    const taskDot   = selTask ? `<span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(selTask.type)}"></span>` : '';
    const taskLabel = selTask ? Tooltip.escHtml(selTask.id + ': ' + selTask.title) : '—';

    const resourceOptions = state.resources.map(r => `
      <button class="alloc-resource-option" data-value="${Tooltip.escHtml(r.id)}"
        data-role="${r.role.toLowerCase()}" data-name="${Tooltip.escHtml(r.name)}">
        <span class="alloc-resource-dot alloc-resource-dot--${r.role.toLowerCase()}"></span>
        ${Tooltip.escHtml(r.name)}</button>`).join('');
    const selRes  = resourceId ? state.resources.find(r => r.id === resourceId) : null;
    const resDot  = selRes ? `<span class="alloc-resource-dot alloc-resource-dot--${selRes.role.toLowerCase()}"></span>` : '';
    const resName = selRes ? Tooltip.escHtml(selRes.name) : (resourceId ? Tooltip.escHtml(resourceId) : '—');

    editDialogBody.innerHTML = `
      <div class="alloc-form">
        <div class="panel-field-label" style="margin-bottom:4px">Task</div>
        ${buildCustomSelectHtml(selTask?.id ?? '', taskDot, taskLabel, 'toggle-task-dropdown', taskOptions)}
        <div class="panel-field-label" style="margin:8px 0 4px">Resource</div>
        ${buildCustomSelectHtml(resourceId ?? '', resDot, resName, 'toggle-resource-dropdown', resourceOptions)}
        <div class="alloc-date-row" style="margin-top:8px">
          <input type="date" class="alloc-date-input" data-field="start" value="${startDate}">
          <span class="alloc-date-sep">→</span>
          <input type="date" class="alloc-date-input" data-field="end" value="${endDate}">
        </div>
        <input type="text" class="alloc-vac-comment-input" data-field="comment" placeholder="Comment (optional)">
      </div>`;
    editDialog.classList.remove('hidden');
  }

  async function confirmAddAllocationDialog() {
    const selects    = editDialogBody.querySelectorAll('.alloc-custom-select');
    const taskId     = selects[0]?.dataset.selectedValue;
    const resourceId = selects[1]?.dataset.selectedValue;
    const startDate  = editDialogBody.querySelector('[data-field="start"]')?.value;
    const endDate    = editDialogBody.querySelector('[data-field="end"]')?.value;
    const comment    = editDialogBody.querySelector('[data-field="comment"]')?.value.trim() || undefined;
    if (!taskId || !resourceId || !startDate || !endDate) return;
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) { showError(dateError); return; }
    const state          = State.get();
    const newAlloc       = { id: crypto.randomUUID(), taskId, resourceId, startDate, endDate, ...(comment ? { comment } : {}) };
    const newAllocations = [...state.allocations, newAlloc];
    const confirmBtn = document.getElementById('btn-edit-confirm');
    closeEditDialog();
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      await savePlanSafely({ allocations: newAllocations });
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  // ── Edit allocation/vacation dialog ──────
  function openEditAllocationDialog(alloc) {
    _editingVacation   = null;
    _editingAllocation = alloc;
    const state = State.get();
    editDialogTitle.textContent = 'Edit Allocation';

    const taskOptions = [...state.tasks].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map(t => `
      <button class="alloc-task-option" data-value="${Tooltip.escHtml(t.id)}"
        data-type="${taskTypeCssClass(t.type)}" data-name="${Tooltip.escHtml(t.id + ' ' + t.title)}">
        <span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(t.type)}"></span>
        <span style="color:#94a3b8;font-size:11px">${Tooltip.escHtml(t.id)}</span> ${Tooltip.escHtml(t.title)}</button>`).join('');
    const selTask  = state.tasks.find(t => t.id === alloc.taskId);
    const taskDot  = selTask ? `<span class="alloc-task-dot alloc-task-dot--${taskTypeCssClass(selTask.type)}"></span>` : '';
    const taskName = selTask ? Tooltip.escHtml(selTask.id + ' ' + selTask.title) : Tooltip.escHtml(alloc.taskId);

    const resourceOptions = state.resources.map(r => `
      <button class="alloc-resource-option" data-value="${Tooltip.escHtml(r.id)}"
        data-role="${r.role.toLowerCase()}" data-name="${Tooltip.escHtml(r.name)}">
        <span class="alloc-resource-dot alloc-resource-dot--${r.role.toLowerCase()}"></span>
        ${Tooltip.escHtml(r.name)}</button>`).join('');
    const selRes  = state.resources.find(r => r.id === alloc.resourceId);
    const resDot  = selRes ? `<span class="alloc-resource-dot alloc-resource-dot--${selRes.role.toLowerCase()}"></span>` : '';
    const resName = selRes ? Tooltip.escHtml(selRes.name) : Tooltip.escHtml(alloc.resourceId);

    editDialogBody.innerHTML = `
      <div class="alloc-form">
        <div class="panel-field-label" style="margin-bottom:4px">Task</div>
        ${buildCustomSelectHtml(alloc.taskId, taskDot, taskName, 'toggle-task-dropdown', taskOptions)}
        <div class="panel-field-label" style="margin:8px 0 4px">Resource</div>
        ${buildCustomSelectHtml(alloc.resourceId, resDot, resName, 'toggle-resource-dropdown', resourceOptions)}
        <div class="alloc-date-row" style="margin-top:8px">
          <input type="date" class="alloc-date-input" data-field="start" value="${alloc.startDate}">
          <span class="alloc-date-sep">→</span>
          <input type="date" class="alloc-date-input" data-field="end" value="${alloc.endDate}">
        </div>
        <input type="text" class="alloc-vac-comment-input" data-field="comment"
          placeholder="Comment (optional)" value="${Tooltip.escHtml(alloc.comment ?? '')}">
      </div>`;
    editDialog.classList.remove('hidden');
  }

  function openEditVacationDialog(vac) {
    _editingAllocation = null;
    _editingVacation   = vac;
    const vacTypes = Object.keys(VAC_TYPE_LABELS).map(v => ({ value: v, label: VAC_TYPE_LABELS[v] }));
    editDialogTitle.textContent = 'Edit Vacation';
    editDialogBody.innerHTML = `
      <div class="alloc-form">
        <select class="alloc-vac-type-select" data-field="vac-type">
          ${vacTypes.map(t => `<option value="${t.value}"${t.value === vac.type ? ' selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <div class="alloc-date-row">
          <input type="date" class="alloc-date-input" data-field="vac-start" value="${vac.startDate}">
          <span class="alloc-date-sep">→</span>
          <input type="date" class="alloc-date-input" data-field="vac-end" value="${vac.endDate}">
        </div>
        <input type="text" class="alloc-vac-comment-input" data-field="vac-comment"
          placeholder="Comment (optional)" value="${Tooltip.escHtml(vac.comment ?? '')}">
      </div>`;
    editDialog.classList.remove('hidden');
  }

  async function confirmEditAllocation() {
    const orig       = _editingAllocation;
    const selects    = editDialogBody.querySelectorAll('.alloc-custom-select');
    const taskId     = selects[0]?.dataset.selectedValue;
    const resourceId = selects[1]?.dataset.selectedValue;
    const startDate  = editDialogBody.querySelector('[data-field="start"]')?.value;
    const endDate    = editDialogBody.querySelector('[data-field="end"]')?.value;
    const comment    = editDialogBody.querySelector('[data-field="comment"]')?.value.trim() || undefined;
    if (!taskId || !resourceId || !startDate || !endDate) return;
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) { showError(dateError); return; }
    const state   = State.get();
    const updated = { id: orig.id, taskId, resourceId, startDate, endDate, ...(comment ? { comment } : {}) };
    const newAllocations = state.allocations.map(a =>
      (a.taskId === orig.taskId && a.resourceId === orig.resourceId &&
       a.startDate === orig.startDate && a.endDate === orig.endDate) ? updated : a
    );
    const confirmBtn = document.getElementById('btn-edit-confirm');
    closeEditDialog();
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      await savePlanSafely({ allocations: newAllocations });
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  async function confirmEditVacation() {
    const orig      = _editingVacation;
    const type      = editDialogBody.querySelector('[data-field="vac-type"]')?.value;
    const startDate = editDialogBody.querySelector('[data-field="vac-start"]')?.value;
    const endDate   = editDialogBody.querySelector('[data-field="vac-end"]')?.value;
    const comment   = editDialogBody.querySelector('[data-field="vac-comment"]')?.value.trim() || undefined;
    if (!type || !startDate || !endDate) return;
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) { showError(dateError); return; }
    const state   = State.get();
    const updated = { resourceId: orig.resourceId, startDate, endDate, type, ...(comment ? { comment } : {}) };
    const newVacations = state.vacations.map(v =>
      (v.resourceId === orig.resourceId && v.startDate === orig.startDate &&
       v.endDate === orig.endDate && v.type === orig.type) ? updated : v
    );
    const confirmBtn = document.getElementById('btn-edit-confirm');
    closeEditDialog();
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      await savePlanSafely({ vacations: newVacations });
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  // ── Date helpers ──────────────────────────
  function defaultStartDate(existingAllocations, state) {
    if (existingAllocations.length > 0) {
      const latestEnd = existingAllocations.reduce((max, a) => a.endDate > max ? a.endDate : max, '');
      return shiftDate(latestEnd, 1);
    }
    const rangeStart = document.getElementById('timeline-body').dataset.rangeStart;
    const base = rangeStart ? parseDate(rangeStart) : new Date();
    if (state.zoom === 'week') {
      const dayOfWeek = (base.getDay() + 6) % 7;
      base.setDate(base.getDate() - dayOfWeek);
    }
    return formatDate(base);
  }

  function showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 4000);
  }

  function showSaving() {
    document.getElementById('saving-indicator').classList.remove('hidden');
  }

  function hideSaving() {
    document.getElementById('saving-indicator').classList.add('hidden');
  }

  // ── HTML field helpers ────────────────────
  function typeField(type) {
    if (!type) return '';
    const label = TASK_TYPE_LABELS[type] ?? type;
    const cls   = taskTypeCssClass(type);
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

  function openResourceAndShowAllocForm(resourceData, startDate) {
    openResource(resourceData);
    showAddResourceAllocationForm(startDate);
  }

  return { open: openTask, openTask, openResource, openWorkPlanningTask, openResourceAndShowAllocForm, openAddAllocationDialog, openAddWorkSegmentDialog, close, promptDeleteAllocation: deleteAllocation, promptDeleteVacation: deleteVacation, promptDeleteWorkSegment: deleteWorkSegment, showError, showSaving, hideSaving, openEditAllocationDialog, openEditVacationDialog, openEditWorkSegmentDialog, closeEditDialog };
})();
