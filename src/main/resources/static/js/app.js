'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const timelineBody = document.getElementById('timeline-body');

  // ── Holidays ──────────────────────────────
  API.getHolidays()
    .then(holidays => State.set({ holidays }))
    .catch(() => { /* holidays unavailable — render without highlights */ });

  // ── Selection state ───────────────────────
  let selectedTaskId     = null; // resource view — allocation selection
  let selectedResourceId = null; // task view — allocation selection
  let selectedAlloc      = null; // { taskId, resourceId, startDate, endDate }
  let selectedVacation   = null; // { resourceId, startDate, endDate, type }
  let selectedSegmentId  = null; // work-planning view — segment selection

  // ── Highlight helpers ─────────────────────
  function applyBlockHighlight(attr, value) {
    timelineBody.querySelectorAll('.block[data-task-id]').forEach(b => {
      b.classList.toggle('block--related', !!value && b.dataset[attr] === value);
    });
    timelineBody.querySelectorAll('.block--vacation').forEach(b => b.classList.remove('block--related'));
    timelineBody.classList.toggle('has-selection', !!value);
  }

  function applyTaskHighlight(taskId)         { applyBlockHighlight('taskId', taskId); }
  function applyResourceHighlight(resourceId) { applyBlockHighlight('resourceId', resourceId); }

  function applyTaskGroupHighlight(taskIdSet) {
    timelineBody.querySelectorAll('.block[data-task-id]').forEach(b => {
      b.classList.toggle('block--related', taskIdSet.has(b.dataset.taskId));
    });
    timelineBody.querySelectorAll('.block--vacation').forEach(b => b.classList.remove('block--related'));
    timelineBody.classList.toggle('has-selection', taskIdSet.size > 0);
  }

  function applyVacationHighlight(resourceId) {
    timelineBody.querySelectorAll('.block[data-task-id]').forEach(b => b.classList.remove('block--related'));
    timelineBody.querySelectorAll('.block--vacation').forEach(b => {
      b.classList.toggle('block--related', !!resourceId && b.dataset.resourceId === resourceId);
    });
    timelineBody.classList.toggle('has-selection', !!resourceId);
  }

  function deselect() {
    selectedTaskId = selectedResourceId = null;
    selectedAlloc  = selectedVacation   = null;
    selectedSegmentId = null;
    timelineBody.querySelectorAll('.block--related').forEach(b => b.classList.remove('block--related'));
    timelineBody.classList.remove('has-selection');
  }

  // ── Resolve helpers ───────────────────────
  function resolveAlloc(block, state) {
    const allocIndex = parseInt(block.dataset.allocIndex, 10);
    return state.allocations[allocIndex] ?? null;
  }

  function resolveVacation(block) {
    return {
      resourceId: block.dataset.resourceId,
      startDate:  block.dataset.vacStart,
      endDate:    block.dataset.vacEnd,
      type:       block.dataset.vacType,
    };
  }

  function openResourceSidebar(resourceId, state) {
    const resource = state.resources.find(r => r.id === resourceId);
    if (!resource) return;
    const allocations = state.allocations.filter(a => a.resourceId === resource.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const tasks       = allocations.map(a => state.tasks.find(t => t.id === a.taskId)).filter(Boolean);
    SidePanel.openResource({ resource, tasks, allocations });
  }

  // ── Subscribe timeline to state changes ──
  State.subscribe((state) => {
    Timeline.render(state);
    if (selectedVacation) {
      applyVacationHighlight(selectedVacation.resourceId);
    } else if (state.viewMode === 'resource') {
      applyTaskHighlight(selectedTaskId);
    } else if (state.viewMode === 'work-planning') {
      applyTaskHighlight(selectedTaskId);
    } else {
      applyResourceHighlight(selectedResourceId);
    }
  });

  // ── View mode toggle ─────────────────────
  document.getElementById('view-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    document.querySelectorAll('#view-toggle .toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.set({ viewMode: btn.dataset.view });
  });

  // ── Zoom toggle ──────────────────────────
  document.getElementById('zoom-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-zoom]');
    if (!btn) return;
    document.querySelectorAll('#zoom-toggle .toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.set({ zoom: btn.dataset.zoom });
  });

  // ── Delegated: hover highlight ────────────
  timelineBody.addEventListener('mouseover', (e) => {
    const taskLabel = e.target.closest('.row-label[data-task-id]');
    if (taskLabel) {
      if (!selectedTaskId) {
        const taskId = taskLabel.dataset.taskId;
        const state = State.get();
        const task = state.tasks.find(t => t.id === taskId);
        if (task?.type === 'FEATURE' || task?.type === 'FEATURE_ENABLER') {
          const ids = new Set([taskId, ...state.tasks.filter(t => t.parentId === taskId).map(t => t.id)]);
          applyTaskGroupHighlight(ids);
        } else {
          applyTaskHighlight(taskId);
        }
      }
      return;
    }
    const resourceLabel = e.target.closest('.row-label[data-resource-id]');
    if (resourceLabel) {
      if (!selectedResourceId) applyResourceHighlight(resourceLabel.dataset.resourceId);
      return;
    }

    const vacBlock = e.target.closest('.block--vacation[data-resource-id]');
    if (vacBlock) {
      Tooltip.show(e, Tooltip.buildVacationView({
        type:      vacBlock.dataset.vacType,
        startDate: vacBlock.dataset.vacStart,
        endDate:   vacBlock.dataset.vacEnd,
        comment:   vacBlock.dataset.vacComment || undefined,
      }));
      if (!selectedVacation) applyVacationHighlight(vacBlock.dataset.resourceId);
      return;
    }

    const block = e.target.closest('.block[data-task-id]');
    if (!block) return;
    const state = State.get();
    const task = state.tasks.find(t => t.id === block.dataset.taskId);
    if (!task) return;

    if (state.viewMode === 'resource') {
      const allocIndex = parseInt(block.dataset.allocIndex, 10);
      const alloc = state.allocations[allocIndex];
      Tooltip.show(e, Tooltip.buildResourceView(task, alloc));
      if (!selectedTaskId) applyTaskHighlight(block.dataset.taskId);
    } else if (state.viewMode === 'work-planning') {
      if (!selectedTaskId) applyTaskHighlight(block.dataset.taskId);
    } else {
      const allocIndex = parseInt(block.dataset.allocIndex, 10);
      const alloc = state.allocations[allocIndex];
      const resource = alloc ? state.resources.find(r => r.id === alloc.resourceId) : null;
      Tooltip.show(e, Tooltip.buildTaskView(task, resource, alloc));
      if (!selectedResourceId) applyResourceHighlight(block.dataset.resourceId);
    }
  });

  timelineBody.addEventListener('mouseout', (e) => {
    const taskLabel = e.target.closest('.row-label[data-task-id]');
    if (taskLabel) {
      const stillInRow = e.relatedTarget?.closest('.timeline-row') === taskLabel.closest('.timeline-row');
      if (!stillInRow && !selectedTaskId) applyTaskGroupHighlight(new Set());
      return;
    }
    const resourceLabel = e.target.closest('.row-label[data-resource-id]');
    if (resourceLabel) {
      const stillInRow = e.relatedTarget?.closest('.timeline-row') === resourceLabel.closest('.timeline-row');
      if (!stillInRow && !selectedResourceId) applyResourceHighlight(null);
      return;
    }

    const vacBlock = e.target.closest('.block--vacation[data-resource-id]');
    if (vacBlock) {
      const relatedVac = e.relatedTarget?.closest('.block--vacation[data-resource-id]');
      if (!relatedVac) {
        Tooltip.hide();
        if (selectedVacation) applyVacationHighlight(selectedVacation.resourceId);
        else                  applyVacationHighlight(null);
      }
      return;
    }

    const block = e.target.closest('.block[data-task-id]');
    if (!block) return;
    Tooltip.hide();
    const relatedBlock = e.relatedTarget?.closest('.block[data-task-id]');
    if (!relatedBlock) {
      const vm = State.get().viewMode;
      if (vm === 'resource' || vm === 'work-planning') applyTaskHighlight(selectedTaskId);
      else                                              applyResourceHighlight(selectedResourceId);
    }
  });

  // ── Delegated: click ──────────────────────
  timelineBody.addEventListener('click', (e) => {
    // Vacation block click (resource view only)
    const vacBlock = e.target.closest('.block--vacation[data-resource-id]');
    if (vacBlock && State.get().viewMode === 'resource') {
      selectedTaskId = selectedResourceId = selectedAlloc = null;
      selectedVacation = resolveVacation(vacBlock);
      applyVacationHighlight(selectedVacation.resourceId);
      openResourceSidebar(selectedVacation.resourceId, State.get());
      return;
    }

    const block         = e.target.closest('.block[data-task-id]');
    const taskLabel     = e.target.closest('.row-label[data-task-id]');
    const resourceLabel = e.target.closest('.row-label[data-resource-id]');
    const state         = State.get();

    // Resource row label → drop selection + open resource sidebar
    if (resourceLabel && !e.target.closest('.role-badge')) {
      deselect();
      openResourceSidebar(resourceLabel.dataset.resourceId, state);
      return;
    }

    // Work planning view: segment block or task row label click
    if (state.viewMode === 'work-planning') {
      const source = block || taskLabel;
      if (!source) { deselect(); return; }
      const taskId = source.dataset.taskId;
      selectedVacation   = null;
      selectedResourceId = null;
      selectedAlloc      = null;
      selectedSegmentId  = block?.dataset.segmentId ?? null;
      selectedTaskId     = taskId;
      applyTaskHighlight(taskId);
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        const segs = (state.workSegments ?? []).filter(s => s.taskId === taskId)
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        SidePanel.openWorkPlanningTask({ task, workSegments: segs });
      }
      return;
    }

    // Task view: allocation block click → persist resource highlight + resource sidebar
    if (state.viewMode === 'task' && block) {
      selectedVacation   = null;
      selectedResourceId = block.dataset.resourceId;
      selectedAlloc      = resolveAlloc(block, state);
      applyResourceHighlight(selectedResourceId);
      openResourceSidebar(selectedResourceId, state);
      return;
    }

    const source = block || taskLabel;

    if (!source) {
      deselect();
      return;
    }

    const task = state.tasks.find(t => t.id === source.dataset.taskId);
    if (!task) return;

    if (state.viewMode === 'resource' && block) {
      selectedVacation = null;
      selectedTaskId   = task.id;
      selectedAlloc    = resolveAlloc(block, state);
      applyTaskHighlight(selectedTaskId);
    } else if (state.viewMode === 'task' && taskLabel) {
      selectedVacation = selectedResourceId = selectedAlloc = null;
      applyResourceHighlight(null);
    }

    const allocations = state.allocations.filter(a => a.taskId === task.id)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const resources   = allocations.map(a => state.resources.find(r => r.id === a.resourceId)).filter(Boolean);
    SidePanel.openTask({ task, resources, allocations });
  });

  // ── Delegated: dblclick ───────────────────
  timelineBody.addEventListener('dblclick', (e) => {
    const vacBlock = e.target.closest('.block--vacation[data-resource-id]');
    if (vacBlock) {
      const partial = resolveVacation(vacBlock);
      const full = State.get().vacations.find(v =>
        v.resourceId === partial.resourceId && v.startDate === partial.startDate &&
        v.endDate === partial.endDate && v.type === partial.type
      );
      if (full) SidePanel.openEditVacationDialog(full);
      return;
    }
    const block = e.target.closest('.block[data-task-id]');
    if (block) {
      if (block.dataset.segmentId) {
        const seg = State.get().workSegments.find(s => s.id === block.dataset.segmentId);
        if (seg) SidePanel.openEditWorkSegmentDialog(seg);
      } else {
        const alloc = resolveAlloc(block, State.get());
        if (alloc) SidePanel.openEditAllocationDialog(alloc);
      }
      return;
    }

    // Double-click on empty grid area → open add-allocation form
    const state = State.get();
    if (e.target.closest('.row-label')) return;   // ignore label area
    const row = e.target.closest('.timeline-row');
    if (!row) return;

    const rowContent = row.querySelector('.row-content');
    if (!rowContent) return;
    const rect      = rowContent.getBoundingClientRect();
    const startDate = Timeline.xToDate(e.clientX - rect.left, state.zoom);
    if (!startDate) return;

    if (state.viewMode === 'resource') {
      const resourceLabel = row.querySelector('.row-label[data-resource-id]');
      if (!resourceLabel) return;
      SidePanel.openAddAllocationDialog({ resourceId: resourceLabel.dataset.resourceId }, startDate);
    } else if (state.viewMode === 'task') {
      const taskLabel = row.querySelector('.row-label[data-task-id]');
      if (!taskLabel) return;
      SidePanel.openAddAllocationDialog({ taskId: taskLabel.dataset.taskId }, startDate);
    } else if (state.viewMode === 'work-planning') {
      const taskLabel = row.querySelector('.row-label[data-task-id]');
      if (!taskLabel) return;
      const task = state.tasks.find(t => t.id === taskLabel.dataset.taskId);
      if (!task) return;
      const segs = (state.workSegments ?? []).filter(s => s.taskId === task.id)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
      SidePanel.openWorkPlanningTask({ task, workSegments: segs });
    }
  });

  // Clear selection when side panel is closed
  document.getElementById('side-panel-close').addEventListener('click', deselect);

  // Clear selection when clicking below the row grid
  document.getElementById('timeline-container').addEventListener('click', (e) => {
    if (e.target.closest('#timeline-body') || e.target.closest('#timeline-header')) return;
    deselect();
  });

  // ── Initial render ───────────────────────
  Timeline.render(State.get());

  // ── Reload confirmation dialog ───────────
  const reloadDialog = document.getElementById('reload-dialog');

  function openReloadDialog()  { reloadDialog.classList.remove('hidden'); }
  function closeReloadDialog() { reloadDialog.classList.add('hidden'); }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
      e.preventDefault();
      openReloadDialog();
    }
    if (e.key === 'Escape' && !reloadDialog.classList.contains('hidden')) {
      closeReloadDialog();
    } else if (e.key === 'Escape' && !document.getElementById('edit-alloc-dialog').classList.contains('hidden')) {
      SidePanel.closeEditDialog();
    } else if (e.key === 'Escape') {
      document.getElementById('btn-delete-alloc-cancel').click();
    }
    if (e.key === 'Delete' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      if (selectedVacation) {
        SidePanel.promptDeleteVacation(selectedVacation.resourceId, selectedVacation.startDate, selectedVacation.endDate, selectedVacation.type);
      } else if (selectedAlloc) {
        SidePanel.promptDeleteAllocation(selectedAlloc.taskId, selectedAlloc.resourceId, selectedAlloc.startDate, selectedAlloc.endDate);
      } else if (selectedSegmentId) {
        SidePanel.promptDeleteWorkSegment(selectedSegmentId);
      }
    }
  });

  reloadDialog.addEventListener('click', (e) => {
    if (e.target === reloadDialog) closeReloadDialog();
  });

  document.getElementById('btn-dialog-export').addEventListener('click', () => {
    closeReloadDialog();
    document.getElementById('btn-export').click();
  });

  document.getElementById('btn-dialog-reload').addEventListener('click', () => {
    window.location.reload();
  });
});
