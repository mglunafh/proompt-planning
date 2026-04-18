'use strict';

const DragDrop = (() => {
  function attach() {
    interact('.block[data-draggable="true"]')
      .draggable({
        listeners: {
          start: onDragStart,
          move: onDragMove,
          end: onDragEnd,
        },
      })
      .resizable({
        edges: { left: '.resize-handle--left', right: '.resize-handle--right' },
        listeners: {
          start: onResizeStart,
          move: onResizeMove,
          end: onResizeEnd,
        },
        modifiers: [
          interact.modifiers.restrictSize({ minWidth: COL_WIDTH.day }),
        ],
      });

    interact('.block--vacation[data-vac-draggable="true"]')
      .draggable({
        listeners: {
          start: onVacDragStart,
          move: onVacDragMove,
          end: onVacDragEnd,
        },
      })
      .resizable({
        edges: { left: '.resize-handle--left', right: '.resize-handle--right' },
        listeners: {
          start: onVacResizeStart,
          move: onResizeMove,   // same visual logic
          end: onVacResizeEnd,
        },
        modifiers: [
          interact.modifiers.restrictSize({ minWidth: COL_WIDTH.day }),
        ],
      });
  }

  // ── Drag ──────────────────────────────────
  function onDragStart(event) {
    event.target.setAttribute('data-drag-x', '0');
    event.target.setAttribute('data-drag-y', '0');
    event.target.style.zIndex = '20';
  }

  function onDragMove(event) {
    const target = event.target;
    const colWidth = COL_WIDTH[State.get().zoom];

    const prevX = parseFloat(target.getAttribute('data-drag-x')) || 0;
    const nextX = prevX + event.dx;
    target.setAttribute('data-drag-x', nextX);
    const snappedX = Math.round(nextX / colWidth) * colWidth;

    const prevY = parseFloat(target.getAttribute('data-drag-y')) || 0;
    const nextY = prevY + event.dy;
    target.setAttribute('data-drag-y', nextY);
    target.style.transform = `translate(${snappedX}px, ${nextY}px)`;
  }

  async function onDragEnd(event) {
    const target = event.target;
    target.style.zIndex = '';

    const state = State.get();
    const colWidth = COL_WIDTH[state.zoom];
    const dx = parseFloat(target.getAttribute('data-drag-x')) || 0;
    const daysShifted = Math.round(dx / colWidth) * (state.zoom === 'week' ? 7 : 1);

    // Capture visual center Y before resetting transform
    const blockRect = target.getBoundingClientRect();
    const centerY = blockRect.top + blockRect.height / 2;

    target.setAttribute('data-drag-x', '0');
    target.setAttribute('data-drag-y', '0');
    target.style.transform = '';

    const allocId = target.getAttribute('data-alloc-id');
    const alloc = state.allocations.find(a => a.id === allocId);
    if (!alloc) return;

    // Detect reassignment in resource view (change resource)
    let newResourceId = alloc.resourceId;
    if (state.viewMode === 'resource') {
      const resourceRows = Array.from(
        document.querySelectorAll('#timeline-body .timeline-row[data-resource-index]')
      );
      const targetRow = resourceRows.find(r => {
        const rect = r.getBoundingClientRect();
        return centerY >= rect.top && centerY <= rect.bottom;
      });
      if (targetRow) {
        const idx = parseInt(targetRow.dataset.resourceIndex, 10);
        const targetResource = state.resources[idx];
        if (targetResource && targetResource.role === alloc.role) {
          newResourceId = targetResource.id;
        }
      } else {
        // Check unassigned rows — dropping here removes the assignee
        const unassignedRows = Array.from(
          document.querySelectorAll('#timeline-body .timeline-row[data-unassigned-role]')
        );
        const targetUnassigned = unassignedRows.find(r => {
          const rect = r.getBoundingClientRect();
          return centerY >= rect.top && centerY <= rect.bottom;
        });
        if (targetUnassigned && targetUnassigned.dataset.unassignedRole === alloc.role) {
          newResourceId = null;
        }
      }
    }

    // Detect reassignment in task view (change task)
    let newTaskId = alloc.taskId;
    if (state.viewMode === 'task') {
      const taskRows = Array.from(
        document.querySelectorAll('#timeline-body .timeline-row[data-task-id]')
      );
      const targetRow = taskRows.find(r => {
        const rect = r.getBoundingClientRect();
        return centerY >= rect.top && centerY <= rect.bottom;
      });
      if (targetRow) {
        newTaskId = targetRow.dataset.taskId;
      }
    }

    if (daysShifted === 0 && newResourceId === alloc.resourceId && newTaskId === alloc.taskId) return;

    const newAllocations = state.allocations.map(a => {
      if (a.id !== allocId) return a;
      return {
        ...a,
        taskId: newTaskId,
        resourceId: newResourceId,
        startDate: shiftDate(a.startDate, daysShifted),
        endDate: shiftDate(a.endDate, daysShifted),
      };
    });

    await savePlanSafely({ allocations: newAllocations });
  }

  // ── Resize ────────────────────────────────
  function onResizeStart(event) {
    const target = event.target;
    target.dataset.resizeInitialLeft = target.style.left;
    target.dataset.resizeInitialWidth = target.style.width;
    target.dataset.resizeAccLeft = '0';
    target.dataset.resizeAccWidth = '0';

    // Store original dates so onResizeEnd can shift only the affected edge
    const allocId = target.getAttribute('data-alloc-id');
    const alloc = State.get().allocations.find(a => a.id === allocId);
    if (alloc) {
      target.dataset.resizeOrigStart = alloc.startDate;
      target.dataset.resizeOrigEnd = alloc.endDate;
    }
  }

  function onResizeMove(event) {
    const target = event.target;
    const zoom = State.get().zoom;
    const colWidth = COL_WIDTH[zoom];

    const initialLeft = parseFloat(target.dataset.resizeInitialLeft) || 0;
    const initialWidth = parseFloat(target.dataset.resizeInitialWidth) || 0;

    if (event.edges.left) {
      const accLeft = (parseFloat(target.dataset.resizeAccLeft) || 0) + event.deltaRect.left;
      target.dataset.resizeAccLeft = accLeft;
      const snappedDelta = Math.round(accLeft / colWidth) * colWidth;
      const newLeft = initialLeft + snappedDelta;
      const newWidth = Math.max(initialWidth - snappedDelta, colWidth);
      target.style.left = newLeft + 'px';
      target.style.width = newWidth + 'px';
    } else {
      const accWidth = (parseFloat(target.dataset.resizeAccWidth) || 0) + event.deltaRect.width;
      target.dataset.resizeAccWidth = accWidth;
      const snappedDelta = Math.round(accWidth / colWidth) * colWidth;
      target.style.width = Math.max(initialWidth + snappedDelta, colWidth) + 'px';
    }
  }

  async function onResizeEnd(event) {
    const target = event.target;
    const zoom = State.get().zoom;
    const colWidth = COL_WIDTH[zoom];
    const daysPerUnit = zoom === 'week' ? 7 : 1;

    const allocId = target.getAttribute('data-alloc-id');
    const state = State.get();
    const origStart = target.dataset.resizeOrigStart;
    const origEnd = target.dataset.resizeOrigEnd;
    if (!origStart || !origEnd) return;

    const initialLeft = parseFloat(target.dataset.resizeInitialLeft) || 0;
    const initialWidth = parseFloat(target.dataset.resizeInitialWidth) || 0;
    const snappedLeft = parseFloat(target.style.left);
    const snappedWidth = parseFloat(target.style.width);

    let newStartDate, newEndDate;

    if (event.edges && event.edges.left) {
      const leftDeltaDays = Math.round((snappedLeft - initialLeft) / colWidth) * daysPerUnit;
      newStartDate = shiftDate(origStart, leftDeltaDays);
      newEndDate = origEnd;
    } else {
      const widthDeltaDays = Math.round((snappedWidth - initialWidth) / colWidth) * daysPerUnit;
      newStartDate = origStart;
      newEndDate = shiftDate(origEnd, widthDeltaDays);
    }

    if (newStartDate === origStart && newEndDate === origEnd) return;

    const newAllocations = state.allocations.map(a => {
      if (a.id !== allocId) return a;
      return { ...a, startDate: newStartDate, endDate: newEndDate };
    });

    await savePlanSafely({ allocations: newAllocations });
  }

  // ── Vacation drag ─────────────────────────
  function onVacDragStart(event) {
    event.target.setAttribute('data-drag-x', '0');
    event.target.style.zIndex = '20';
  }

  function onVacDragMove(event) {
    const target = event.target;
    const colWidth = COL_WIDTH[State.get().zoom];
    const prevX = parseFloat(target.getAttribute('data-drag-x')) || 0;
    const nextX = prevX + event.dx;
    target.setAttribute('data-drag-x', nextX);
    target.style.transform = `translateX(${Math.round(nextX / colWidth) * colWidth}px)`;
  }

  async function onVacDragEnd(event) {
    const target = event.target;
    target.style.zIndex = '';
    const state = State.get();
    const colWidth = COL_WIDTH[state.zoom];
    const dx = parseFloat(target.getAttribute('data-drag-x')) || 0;
    const daysShifted = Math.round(dx / colWidth) * (state.zoom === 'week' ? 7 : 1);
    target.setAttribute('data-drag-x', '0');
    target.style.transform = '';
    if (daysShifted === 0) return;

    const resourceId = target.dataset.resourceId;
    const origStart  = target.dataset.vacStart;
    const origEnd    = target.dataset.vacEnd;
    const type       = target.dataset.vacType;

    const newVacations = state.vacations.map(v => {
      if (v.resourceId !== resourceId || v.startDate !== origStart ||
          v.endDate !== origEnd || v.type !== type) return v;
      return { ...v, startDate: shiftDate(origStart, daysShifted), endDate: shiftDate(origEnd, daysShifted) };
    });
    await savePlanSafely({ vacations: newVacations });
  }

  // ── Vacation resize ───────────────────────
  function onVacResizeStart(event) {
    const target = event.target;
    target.dataset.resizeInitialLeft  = target.style.left;
    target.dataset.resizeInitialWidth = target.style.width;
    target.dataset.resizeAccLeft  = '0';
    target.dataset.resizeAccWidth = '0';
    target.dataset.resizeOrigStart = target.dataset.vacStart;
    target.dataset.resizeOrigEnd   = target.dataset.vacEnd;
  }

  async function onVacResizeEnd(event) {
    const target = event.target;
    const state = State.get();
    const colWidth = COL_WIDTH[state.zoom];
    const daysPerUnit = state.zoom === 'week' ? 7 : 1;

    const origStart    = target.dataset.resizeOrigStart;
    const origEnd      = target.dataset.resizeOrigEnd;
    const initialLeft  = parseFloat(target.dataset.resizeInitialLeft) || 0;
    const initialWidth = parseFloat(target.dataset.resizeInitialWidth) || 0;
    const snappedLeft  = parseFloat(target.style.left);
    const snappedWidth = parseFloat(target.style.width);

    let newStartDate, newEndDate;
    if (event.edges && event.edges.left) {
      const leftDeltaDays = Math.round((snappedLeft - initialLeft) / colWidth) * daysPerUnit;
      newStartDate = shiftDate(origStart, leftDeltaDays);
      newEndDate   = origEnd;
    } else {
      const widthDeltaDays = Math.round((snappedWidth - initialWidth) / colWidth) * daysPerUnit;
      newStartDate = origStart;
      newEndDate   = shiftDate(origEnd, widthDeltaDays);
    }
    if (newStartDate === origStart && newEndDate === origEnd) return;

    const resourceId = target.dataset.resourceId;
    const type       = target.dataset.vacType;

    const newVacations = state.vacations.map(v => {
      if (v.resourceId !== resourceId || v.startDate !== origStart ||
          v.endDate !== origEnd || v.type !== type) return v;
      return { ...v, startDate: newStartDate, endDate: newEndDate };
    });
    await savePlanSafely({ vacations: newVacations });
  }

  return { attach };
})();
