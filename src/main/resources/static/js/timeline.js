'use strict';

const Timeline = (() => {
  const ROW_HEIGHT = 48;
  const LEFT_COL_WIDTH = 240;

  const headerEl = document.getElementById('timeline-header');
  const bodyEl = document.getElementById('timeline-body');

  // ── Resizable left column ────────────────
  let leftColWidth = 240;

  function attachColResizeHandle(spacer) {
    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    spacer.appendChild(handle);

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('resizing');
      const startX = e.clientX;
      const startWidth = leftColWidth;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        leftColWidth = Math.max(120, Math.min(500, startWidth + dx));
        document.documentElement.style.setProperty('--left-col-width', leftColWidth + 'px');
      }

      function onUp() {
        handle.classList.remove('resizing');
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
      }

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  }

  // ── Role dropdown (singleton) ────────────
  const roleDropdown = document.createElement('div');
  roleDropdown.id = 'role-dropdown';
  roleDropdown.className = 'role-dropdown hidden';

  ROLES.forEach(role => {
    const item = document.createElement('button');
    item.className = 'role-dropdown-item role-dropdown-item--' + role.toLowerCase();
    item.textContent = ROLE_LABELS[role] ?? role.charAt(0) + role.slice(1).toLowerCase();
    item.dataset.role = role;
    roleDropdown.appendChild(item);
  });
  document.body.appendChild(roleDropdown);

  roleDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('[data-role]');
    if (!item) return;
    const resourceId = roleDropdown.dataset.resourceId;
    const newRole = item.dataset.role;
    const state = State.get();
    State.set({
      resources: state.resources.map(r =>
        r.id === resourceId ? { ...r, role: newRole } : r
      ),
    });
    closeRoleDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!roleDropdown.classList.contains('hidden') &&
        !roleDropdown.contains(e.target) &&
        !e.target.closest('.role-badge')) {
      closeRoleDropdown();
    }
  });

  function openRoleDropdown(badge, resourceId) {
    const rect = badge.getBoundingClientRect();
    roleDropdown.dataset.resourceId = resourceId;
    roleDropdown.style.top = (rect.bottom + 4) + 'px';
    roleDropdown.style.left = rect.left + 'px';
    roleDropdown.classList.remove('hidden');
  }

  function closeRoleDropdown() {
    roleDropdown.classList.add('hidden');
  }

  // ── Public entry point ──────────────────
  function render(state) {
    if (!state.tasks.length && !state.resources.length) {
      renderEmpty();
      return;
    }
    const range = computeRange(state);
    if (state.zoom === 'week') {
      // Snap range.start to Monday so header columns and body positions share the same origin
      range.start.setDate(range.start.getDate() - ((range.start.getDay() + 6) % 7));
    }
    const holidaySet = new Set(state.holidays);
    bodyEl.dataset.rangeStart = formatDate(range.start);
    renderHeader(state, range, holidaySet);
    renderBody(state, range, holidaySet);
    DragDrop.attach();
  }

  // ── Date range ──────────────────────────
  function computeRange(state) {
    const dates = [
      ...state.allocations.flatMap(a => [a.startDate, a.endDate]),
      ...state.vacations.flatMap(v => [v.startDate, v.endDate]),
    ];
    let start, end;
    if (dates.length) {
      start = parseDate(dates.reduce((a, b) => (a < b ? a : b)));
      end   = parseDate(dates.reduce((a, b) => (a > b ? a : b)));
    } else {
      // No allocations yet — show a default window around today
      start = new Date();
      end   = new Date();
      end.setDate(end.getDate() + 30);
    }
    // pad by a few days/weeks for visual breathing room
    start.setDate(start.getDate() - 2);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  // ── Header ──────────────────────────────
  function renderHeader(state, { start, end }, holidaySet) {
    const frag = document.createDocumentFragment();
    const zoom = state.zoom;
    const totalWidth = contentWidth({ start, end }, zoom);

    // ── Month bar ──
    const monthRow = document.createElement('div');
    monthRow.className = 'timeline-header-row';

    const monthSpacer = document.createElement('div');
    monthSpacer.className = 'timeline-header-spacer';
    monthRow.appendChild(monthSpacer);

    const m = new Date(start.getFullYear(), start.getMonth(), 1);
    while (m <= end) {
      const nextMonth = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      const xStart = Math.max(dateToX(m, start, zoom), 0);
      const xEnd   = Math.min(dateToX(nextMonth, start, zoom), totalWidth);
      const width  = xEnd - xStart;
      if (width > 0) {
        const col = document.createElement('div');
        col.className = 'month-col';
        col.style.width = width + 'px';
        col.textContent = m.toLocaleDateString('en', { month: 'long', year: 'numeric' });
        monthRow.appendChild(col);
      }
      m.setMonth(m.getMonth() + 1);
    }
    frag.appendChild(monthRow);

    // ── Day / week bar ──
    const dayRow = document.createElement('div');
    dayRow.className = 'timeline-header-row';

    const daySpacer = document.createElement('div');
    daySpacer.className = 'timeline-header-spacer';
    attachColResizeHandle(daySpacer);
    dayRow.appendChild(daySpacer);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (zoom === 'day') {
      forEachDay(start, end, (d) => {
        const col = document.createElement('div');
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        col.className = 'date-col' + (sameDay(d, today) ? ' today' : isHoliday(d, holidaySet) ? ' holiday' : isWeekend ? ' weekend' : '');
        col.style.width = COL_WIDTH.day + 'px';
        col.textContent = formatDay(d);
        dayRow.appendChild(col);
      });
    } else {
      forEachWeek(start, end, (weekStart) => {
        const col = document.createElement('div');
        col.className = 'date-col';
        col.style.width = COL_WIDTH.week + 'px';
        col.textContent = 'W' + isoWeek(weekStart) + ' ' + weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        dayRow.appendChild(col);
      });
    }
    frag.appendChild(dayRow);

    headerEl.replaceChildren(frag);
  }

  // ── Body ────────────────────────────────
  function renderBody(state, range, holidaySet) {
    const frag = document.createDocumentFragment();

    if (state.viewMode === 'resource') {
      renderResourceView(frag, state, range, holidaySet);
    } else {
      renderTaskView(frag, state, range, holidaySet);
    }

    bodyEl.replaceChildren(frag);
  }

  // ── Resource view ────────────────────────
  function clearDragIndicators() {
    bodyEl.querySelectorAll('.row--drag-over-top, .row--drag-over-bottom').forEach(el => {
      el.classList.remove('row--drag-over-top', 'row--drag-over-bottom');
    });
  }

  function renderResourceView(frag, state, range, holidaySet) {
    const allocIndexMap = new Map(state.allocations.map((a, i) => [a, i]));
    const taskById      = new Map(state.tasks.map(t => [t.id, t]));

    for (const [index, resource] of state.resources.entries()) {
      const row = createRow();
      row.dataset.resourceIndex = String(index);

      const label = createLabel();
      label.classList.add('row-label--' + resource.role.toLowerCase());
      label.dataset.resourceId = resource.id;
      label.draggable = true;
      label.style.cursor = 'grab';

      label.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        setTimeout(() => row.classList.add('row--dragging'), 0);
      });
      label.addEventListener('dragend', () => {
        row.classList.remove('row--dragging');
        clearDragIndicators();
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        clearDragIndicators();
        const rect = row.getBoundingClientRect();
        row.classList.add(e.clientY < rect.top + rect.height / 2 ? 'row--drag-over-top' : 'row--drag-over-bottom');
      });
      row.addEventListener('dragleave', (e) => {
        if (!row.contains(e.relatedTarget)) {
          row.classList.remove('row--drag-over-top', 'row--drag-over-bottom');
        }
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('row--drag-over-top', 'row--drag-over-bottom');
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (fromIndex === index) return;
        const rect = row.getBoundingClientRect();
        let insertBefore = e.clientY < rect.top + rect.height / 2 ? index : index + 1;
        const s = State.get();
        const resources = [...s.resources];
        const [moved] = resources.splice(fromIndex, 1);
        if (fromIndex < insertBefore) insertBefore--;
        resources.splice(insertBefore, 0, moved);
        State.set({ resources });
      });
      const badge = document.createElement('span');
      badge.className = 'role-badge role-badge--' + resource.role.toLowerCase();
      badge.textContent = (ROLE_LABELS[resource.role] ?? resource.role).charAt(0).toUpperCase();
      label.appendChild(badge);
      const text = document.createElement('span');
      text.className = 'row-label-text';
      text.textContent = resource.name;
      text.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.className = 'row-label-input';
        input.value = resource.name;
        label.replaceChild(input, text);
        input.focus();
        input.select();

        function commit() {
          const newName = input.value.trim();
          if (newName && newName !== resource.name) {
            const s = State.get();
            State.set({ resources: s.resources.map(r => r.id === resource.id ? { ...r, name: newName } : r) });
          } else {
            label.replaceChild(text, input);
          }
        }

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { input.blur(); }
          if (ev.key === 'Escape') {
            input.removeEventListener('blur', commit);
            label.replaceChild(text, input);
          }
        });
      });
      label.appendChild(text);

      const content = document.createElement('div');
      content.className = 'row-content';
      content.style.width = contentWidth(range, state.zoom) + 'px';
      if (state.zoom === 'day') { addWeekendStripes(content, range, holidaySet); addHolidayStripes(content, range, holidaySet); }
      else addWeekBorders(content, range);

      // Vacations and allocations share lane assignment — overlapping items get separate lanes
      const vacs   = state.vacations.filter(v => v.resourceId === resource.id);
      const allocs = state.allocations.filter(a => a.resourceId === resource.id);

      const allItems = [
        ...vacs.map(v => ({ kind: 'vac', item: v, startDate: v.startDate, endDate: v.endDate })),
        ...allocs.map(a => ({ kind: 'alloc', item: a, startDate: a.startDate, endDate: a.endDate })),
      ];
      const laned     = assignLanes(allItems, 'startDate', 'endDate');
      const laneCount = laned.length > 0 ? Math.max(...laned.map(x => x.lane)) + 1 : 1;
      if (laneCount > 1) row.style.height = (ROW_HEIGHT * laneCount) + 'px';

      for (const { item: tagged, lane } of laned) {
        if (tagged.kind === 'vac') {
          content.appendChild(createVacationBlock(tagged.item, range, state.zoom, lane));
        } else {
          const alloc = tagged.item;
          const task  = taskById.get(alloc.taskId);
          if (!task) continue;
          const allocIndex = allocIndexMap.get(alloc);
          content.appendChild(createTaskBlock(task, alloc, allocIndex, state.zoom, range, null, lane));
        }
      }

      row.appendChild(label);
      row.appendChild(content);
      frag.appendChild(row);
    }

    // Add resource button row
    const addRow = document.createElement('div');
    addRow.className = 'timeline-row--add-resource';

    function showAddResourceButton() {
      addRow.innerHTML = '';
      const btn = document.createElement('button');
      btn.className   = 'btn-add-resource';
      btn.textContent = '+ Add resource';
      btn.addEventListener('click', showAddResourceForm);
      addRow.appendChild(btn);
    }

    function showAddResourceForm() {
      addRow.innerHTML = '';

      const form = document.createElement('div');
      form.className = 'add-resource-form';

      const nameInput = document.createElement('input');
      nameInput.type        = 'text';
      nameInput.className   = 'alloc-vac-comment-input';
      nameInput.placeholder = 'Name';
      nameInput.style.marginBottom = '6px';

      const idInput = document.createElement('input');
      idInput.type        = 'text';
      idInput.className   = 'alloc-vac-comment-input';
      idInput.placeholder = 'Resource ID';
      idInput.style.marginBottom = '6px';

      nameInput.addEventListener('input', () => {
        if (!idInput.dataset.edited) {
          idInput.value = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }
      });
      idInput.addEventListener('input', () => { idInput.dataset.edited = '1'; });

      const roleSelect = document.createElement('select');
      roleSelect.className = 'alloc-vac-type-select';
      ROLES.forEach(role => {
        const opt = document.createElement('option');
        opt.value       = role;
        opt.textContent = ROLE_LABELS[role];
        roleSelect.appendChild(opt);
      });

      const actions = document.createElement('div');
      actions.className = 'alloc-form-actions';

      const confirmBtn = document.createElement('button');
      confirmBtn.className   = 'btn-alloc-confirm';
      confirmBtn.textContent = 'Add';
      confirmBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        const id = idInput.value.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
        if (!id) { idInput.focus(); return; }
        const s  = State.get();
        State.set({ resources: [...s.resources, { id, name, role: roleSelect.value }] });
        // re-render rebuilds the row with the button
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.className   = 'btn-alloc-cancel';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', showAddResourceButton);

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  confirmBtn.click();
        if (e.key === 'Escape') showAddResourceButton();
      });
      idInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  confirmBtn.click();
        if (e.key === 'Escape') showAddResourceButton();
      });

      actions.appendChild(confirmBtn);
      actions.appendChild(cancelBtn);
      form.appendChild(nameInput);
      form.appendChild(idInput);
      form.appendChild(roleSelect);
      form.appendChild(actions);
      addRow.appendChild(form);
      nameInput.focus();
    }

    showAddResourceButton();
    frag.appendChild(addRow);
  }

  // ── Task view ───────────────────────────
  const collapsedFeatures = new Set();

  function renderTaskView(frag, state, range, holidaySet) {
    const allocIndexMap = new Map(state.allocations.map((a, i) => [a, i]));
    const resourceById  = new Map(state.resources.map(r => [r.id, r]));
    const byProject = groupByProject(state.tasks);

    for (const [project, tasks] of byProject) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'project-group-header';
      const groupLabel = document.createElement('div');
      groupLabel.className = 'project-group-label';
      groupLabel.textContent = project || 'No Project';
      groupHeader.appendChild(groupLabel);
      frag.appendChild(groupHeader);

      const parents  = tasks.filter(t => t.type === 'FEATURE' || t.type === 'FEATURE_ENABLER');
      const stories  = tasks.filter(t => t.type === 'STORY' || t.type === 'RND');
      const parentIds = new Set(parents.map(p => p.id));

      // Map parentId → child stories; collect orphans separately
      const childrenOf = new Map();
      const orphans    = [];
      for (const story of stories) {
        if (story.parentId && parentIds.has(story.parentId)) {
          if (!childrenOf.has(story.parentId)) childrenOf.set(story.parentId, []);
          childrenOf.get(story.parentId).push(story);
        } else {
          orphans.push(story);
        }
      }

      // Render features / feature-enablers with their children
      for (const parent of parents) {
        const children    = childrenOf.get(parent.id) ?? [];
        const isCollapsed = collapsedFeatures.has(parent.id);

        const row   = buildTaskRow(parent, state, range, false, allocIndexMap, resourceById, holidaySet);
        const label = row.querySelector('.row-label');

        if (children.length > 0) {
          const toggle = document.createElement('button');
          toggle.className   = 'feature-collapse-toggle';
          toggle.textContent = isCollapsed ? '▶' : '▼';
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (collapsedFeatures.has(parent.id)) collapsedFeatures.delete(parent.id);
            else                                   collapsedFeatures.add(parent.id);
            render(State.get());
          });
          label.insertBefore(toggle, label.firstChild);
        }

        frag.appendChild(row);

        if (!isCollapsed) {
          for (const child of children) {
            frag.appendChild(buildTaskRow(child, state, range, true, allocIndexMap, resourceById, holidaySet));
          }
        }
      }

      // Render orphan stories (no parent or parent not in this project)
      for (const story of orphans) {
        frag.appendChild(buildTaskRow(story, state, range, false, allocIndexMap, resourceById, holidaySet));
      }
    }
  }

  function buildTaskRow(task, state, range, isChild, allocIndexMap, resourceById, holidaySet) {
    const row   = createRow();
    row.dataset.taskId = task.id;
    const label = createLabel();
    label.classList.add('row-label--' + taskTypeCssClass(task.type));
    if (isChild) label.classList.add('row-label--child');
    label.dataset.taskId = task.id;
    label.style.cursor   = 'pointer';

    const text = document.createElement('span');
    text.className = 'row-label-text';
    const idChip = document.createElement('span');
    idChip.className = 'task-id';
    idChip.textContent = task.id;
    text.appendChild(idChip);
    text.appendChild(document.createTextNode(task.title));
    label.appendChild(text);

    const content = document.createElement('div');
    content.className  = 'row-content';
    content.style.width = contentWidth(range, state.zoom) + 'px';
    if (state.zoom === 'day') { addWeekendStripes(content, range, holidaySet); addHolidayStripes(content, range, holidaySet); }
    else                      addWeekBorders(content, range);

    const allocs     = state.allocations.filter(a => a.taskId === task.id);
    const allocLaned = assignLanes(allocs, 'startDate', 'endDate');
    const laneCount  = allocLaned.length > 0 ? Math.max(...allocLaned.map(x => x.lane)) + 1 : 1;
    if (laneCount > 1) row.style.height = (ROW_HEIGHT * laneCount) + 'px';

    for (const { item: alloc, lane } of allocLaned) {
      const allocIndex = allocIndexMap.get(alloc);
      const resource   = resourceById.get(alloc.resourceId);
      content.appendChild(createTaskBlock(task, alloc, allocIndex, state.zoom, range, resource, lane));
    }

    row.appendChild(label);
    row.appendChild(content);
    return row;
  }

  // ── Lane assignment (overlapping bars) ──────
  function assignLanes(items, startKey, endKey) {
    const sorted = [...items].sort((a, b) => a[startKey].localeCompare(b[startKey]));
    const laneEnds = [];
    return sorted.map(item => {
      let lane = laneEnds.findIndex(end => end < item[startKey]);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(''); }
      laneEnds[lane] = item[endKey];
      return { item, lane };
    });
  }

  // ── Block factories ──────────────────────
  function createTaskBlock(task, alloc, allocIndex, zoom, range, resource = null, lane = 0) {
    const block = document.createElement('div');
    const colorClass = resource
      ? 'block--resource-' + resource.role.toLowerCase()
      : 'block--' + taskTypeCssClass(task.type);
    block.className = 'block ' + colorClass;
    block.setAttribute('data-task-id', task.id);
    block.setAttribute('data-resource-id', alloc.resourceId);
    block.setAttribute('data-alloc-index', allocIndex);
    block.setAttribute('data-draggable', 'true');

    const handleLeft = document.createElement('div');
    handleLeft.className = 'resize-handle resize-handle--left';

    const title = document.createElement('span');
    title.className = 'block-title';
    const base = resource ? resource.name : task.id;
    title.textContent = alloc.comment ? `${base} (${alloc.comment})` : base;

    const handleRight = document.createElement('div');
    handleRight.className = 'resize-handle resize-handle--right';

    block.appendChild(handleLeft);
    block.appendChild(title);
    block.appendChild(handleRight);

    const left = dateToX(parseDate(alloc.startDate), range.start, zoom);
    const width = Math.max(durationToWidth(alloc.startDate, alloc.endDate, zoom), 4);
    block.style.left  = (left + 2) + 'px';
    block.style.width = Math.max(width - 4, 4) + 'px';
    if (lane > 0) block.style.top = (6 + lane * ROW_HEIGHT) + 'px';

    return block;
  }

  function createVacationBlock(vac, range, zoom, lane = 0) {
    const block = document.createElement('div');
    block.className = 'block block--vacation';
    block.setAttribute('title', vac.type + (vac.comment ? ': ' + vac.comment : ''));
    block.dataset.resourceId   = vac.resourceId;
    block.dataset.vacStart     = vac.startDate;
    block.dataset.vacEnd       = vac.endDate;
    block.dataset.vacType      = vac.type;
    block.dataset.vacComment   = vac.comment ?? '';
    block.dataset.vacDraggable = 'true';

    const left = dateToX(parseDate(vac.startDate), range.start, zoom);
    const width = Math.max(durationToWidth(vac.startDate, vac.endDate, zoom), 4);
    block.style.left  = (left + 2) + 'px';
    block.style.width = Math.max(width - 4, 4) + 'px';
    if (lane > 0) block.style.top = (6 + lane * ROW_HEIGHT) + 'px';

    const handleLeft = document.createElement('div');
    handleLeft.className = 'resize-handle resize-handle--left';
    const handleRight = document.createElement('div');
    handleRight.className = 'resize-handle resize-handle--right';
    block.appendChild(handleLeft);
    if (vac.comment) {
      const title = document.createElement('span');
      title.className = 'block-title';
      title.textContent = vac.comment;
      block.appendChild(title);
    }
    block.appendChild(handleRight);

    return block;
  }

  // ── DOM helpers ──────────────────────────
  function createRow() {
    const row = document.createElement('div');
    row.className = 'timeline-row';
    return row;
  }

  function createLabel() {
    const label = document.createElement('div');
    label.className = 'row-label';
    return label;
  }

  function renderEmpty() {
    headerEl.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div>No data loaded</div><div style="font-size:12px">Import a CSV or JSON file to get started</div>';
    bodyEl.replaceChildren(empty);
  }

  // ── Positioning ──────────────────────────
  function dateToX(date, rangeStart, zoom) {
    const days = daysBetween(rangeStart, date);
    if (zoom === 'day') return days * COL_WIDTH.day;
    return (days / 7) * COL_WIDTH.week;
  }

  function durationToWidth(startStr, endStr, zoom) {
    const days = daysBetween(parseDate(startStr), parseDate(endStr)) + 1;
    if (zoom === 'day') return days * COL_WIDTH.day;
    return (days / 7) * COL_WIDTH.week;
  }

  function contentWidth(range, zoom) {
    return durationToWidth(
      range.start.toISOString().slice(0, 10),
      range.end.toISOString().slice(0, 10),
      zoom,
    );
  }

  function addWeekendStripes(content, range, holidaySet) {
    forEachDay(range.start, range.end, (d) => {
      if (d.getDay() !== 0 && d.getDay() !== 6) return;
      if (isHoliday(d, holidaySet)) return;
      const stripe = document.createElement('div');
      stripe.className = 'weekend-stripe';
      stripe.style.left = dateToX(d, range.start, 'day') + 'px';
      stripe.style.width = COL_WIDTH.day + 'px';
      content.appendChild(stripe);
    });
  }

  function addHolidayStripes(content, range, holidaySet) {
    forEachDay(range.start, range.end, (d) => {
      if (!isHoliday(d, holidaySet)) return;
      const stripe = document.createElement('div');
      stripe.className = 'holiday-stripe';
      stripe.style.left = dateToX(d, range.start, 'day') + 'px';
      stripe.style.width = COL_WIDTH.day + 'px';
      content.appendChild(stripe);
    });
  }

  function addWeekBorders(content, range) {
    forEachWeek(range.start, range.end, (weekStart) => {
      const line = document.createElement('div');
      line.className = 'week-border';
      line.style.left = dateToX(weekStart, range.start, 'week') + 'px';
      content.appendChild(line);
    });
  }

  // ── Date utilities ───────────────────────
  function daysBetween(a, b) {
    const msPerDay = 86400000;
    return Math.round((b - a) / msPerDay);
  }

  function isHoliday(d, holidaySet) {
    const iso = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    return holidaySet.has(iso);
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatDay(d) {
    return d.toLocaleDateString('en', { weekday: 'narrow', day: 'numeric' });
  }

  function isoWeek(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  function forEachDay(start, end, fn) {
    const d = new Date(start);
    while (d <= end) {
      fn(new Date(d));
      d.setDate(d.getDate() + 1);
    }
  }

  function forEachWeek(start, end, fn) {
    const d = new Date(start);
    // Snap to Monday
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    while (d <= end) {
      fn(new Date(d));
      d.setDate(d.getDate() + 7);
    }
  }

  function groupByProject(tasks) {
    const map = new Map();
    for (const task of tasks) {
      const key = task.project ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    }
    return map;
  }

  function xToDate(x, zoom) {
    const rangeStart = bodyEl.dataset.rangeStart;
    if (!rangeStart) return null;
    const days = zoom === 'day'
      ? Math.floor(x / COL_WIDTH.day)
      : Math.floor(x / COL_WIDTH.week * 7);
    const d = parseDate(rangeStart);
    d.setDate(d.getDate() + days);
    return formatDate(d);
  }

  return { render, openRoleDropdown, xToDate };
})();
