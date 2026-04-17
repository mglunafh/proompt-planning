'use strict';

function parseDate(str) {
  if (str instanceof Date) return new Date(str);
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function taskTypeCssClass(type) {
  return TASK_TYPE_CSS[type] ?? 'story';
}

// Ensures every allocation in the array has a stable id field.
// Call this whenever allocations arrive from the backend without ids.
function ensureAllocIds(allocations) {
  return allocations.map(a => a.id ? a : { ...a, id: crypto.randomUUID() });
}

// Returns an error message string if startDate/endDate are invalid, otherwise null.
function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return 'Start and end dates are required.';
  if (endDate < startDate) return 'End date must be on or after start date.';
  return null;
}

// Optimistically updates state, saves to backend, rolls back + shows error on failure.
async function savePlanSafely(partialState) {
  const prev = State.get();
  State.set(partialState);
  const s = State.get();
  SidePanel.showSaving();
  try {
    await API.savePlan(s.allocations, s.vacations, s.workSegments);
  } catch (err) {
    State.set(prev);
    SidePanel.showError('Failed to save: ' + err.message);
  } finally {
    SidePanel.hideSaving();
  }
}
