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

// Formats a duration stored in calendar days into a work-week string.
// 5 work days = 1 work week.  Examples: 1->"1d", 5->"1w", 8->"1w3d", 30->"6w"
function formatDuration(days) {
  if (!days || days <= 0) return '';
  const weeks = Math.floor(days / 5);
  const rem   = days % 5;
  if (weeks === 0) return rem + 'd';
  if (rem === 0)   return weeks + 'w';
  return weeks + 'w' + rem + 'd';
}

// Parses a duration string into calendar days.
// Accepts plain numbers (treated as days), and combinations of weeks/days
// in English (w/d) or Russian (н/д).  Returns null for unrecognised input.
// Examples: "1"->"1", "1w"->"5", "1w3d"->"8", "6w"->"30", "1н1д"->"6"
function parseDuration(str) {
  if (!str) return 0;
  const s = str.trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(?:(\d+)[w\u043d])?(?:(\d+)[d\u0434])?$/);
  if (!m || (!m[1] && !m[2])) return null;
  return (m[1] ? parseInt(m[1], 10) : 0) * 5 + (m[2] ? parseInt(m[2], 10) : 0);
}

// Computes the real number of working days for an allocation.
// Counts Mon-Fri days in [startDate, endDate] (inclusive), excluding
// holidays and — when a resource is assigned — their overlapping vacation days.
function computeDuration(alloc, vacations, holidays) {
  const holidaySet = new Set(holidays);
  const vacDays = new Set();
  if (alloc.resourceId) {
    for (const v of vacations.filter(v => v.resourceId === alloc.resourceId)) {
      let d = parseDate(v.startDate);
      const end = parseDate(v.endDate);
      while (d <= end) { vacDays.add(formatDate(d)); d.setDate(d.getDate() + 1); }
    }
  }
  let count = 0;
  let d = parseDate(alloc.startDate);
  const end = parseDate(alloc.endDate);
  while (d <= end) {
    const dow = d.getDay();
    const ds  = formatDate(d);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(ds) && !vacDays.has(ds)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Returns an error message string if startDate/endDate are invalid, otherwise null.
function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return 'Start and end dates are required.';
  if (endDate < startDate) return 'End date must be on or after start date.';
  return null;
}

function showError(msg) {
  const banner = document.getElementById('error-banner');
  banner.style.cssText = '';
  banner.textContent = msg;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 5000);
}

// Optimistically updates state, saves to backend, rolls back + shows error on failure.
async function savePlanSafely(partialState) {
  const prev = State.get();
  const pending = { ...prev, ...partialState };
  // Keep active plan's allocations in sync with state.allocations
  if (pending.activePlanId && pending.plans?.length > 0) {
    pending.plans = pending.plans.map(p =>
      p.id === pending.activePlanId ? { ...p, allocations: pending.allocations } : p
    );
  }
  State.set(pending);
  const s = State.get();
  SidePanel.showSaving();
  try {
    await API.savePlan(s.vacations, s.plans, s.activePlanId);
  } catch (err) {
    State.set(prev);
    SidePanel.showError('Failed to save: ' + err.message);
  } finally {
    SidePanel.hideSaving();
  }
}
