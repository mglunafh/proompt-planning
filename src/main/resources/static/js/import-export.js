'use strict';

(() => {
  // ── CSV import ──────────────────────────
  document.getElementById('csv-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await API.importCsv(file);
      const allocations = ensureAllocIds(result.allocations);
      const newPlan = { id: crypto.randomUUID(), name: 'Plan 1', allocations };
      State.set({
        tasks: result.tasks,
        resources: result.resources,
        allocations,
        vacations: [],
        workSegments: [],
        plans: [newPlan],
        activePlanId: newPlan.id,
      });
      Plans.render();
      if (result.warnings.length > 0) showWarnings(result.warnings);
    } catch (err) {
      showError('CSV import failed: ' + err.message);
    }
  });

  document.getElementById('csv-merge-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await API.mergeCsv(file);
      State.set({
        tasks:     result.tasks,
        resources: result.resources,
      });
      if (result.warnings.length > 0) showWarnings(result.warnings);
    } catch (err) {
      showError('CSV merge failed: ' + err.message);
    }
  });

  // ── JSON import ──────────────────────────
  document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('json-file-input').click();
  });

  document.getElementById('json-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const normalized = await API.importPlan(file);
      State.set({
        tasks: normalized.tasks,
        resources: normalized.resources,
        allocations: ensureAllocIds(normalized.plans?.find(p => p.id === normalized.activePlanId)?.allocations ?? []),
        vacations: normalized.vacations,
        workSegments: normalized.workSegments ?? [],
        plans: normalized.plans ?? [],
        activePlanId: normalized.activePlanId ?? null,
      });
      Plans.render();
    } catch (err) {
      showError('JSON import failed: ' + err.message);
    }
  });

  // ── Export ───────────────────────────────
  document.getElementById('btn-export').addEventListener('click', async () => {
    let fileHandle;
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: 'workload-plan.json',
        types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }],
      });
    } catch (err) {
      if (err.name !== 'AbortError') showError('Export failed: ' + err.message);
      return;
    }

    const state = State.get();
    const snapshot = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      tasks: state.tasks,
      resources: state.resources,
      allocations: [],
      vacations: state.vacations,
      workSegments: state.workSegments ?? [],
      plans: state.plans,
      activePlanId: state.activePlanId,
    };
    try {
      const exported = await API.exportSnapshot(snapshot, fileHandle.name);
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(exported, null, 2));
      await writable.close();
    } catch (err) {
      showError('Export failed: ' + err.message);
    }
  });

  // ── Helpers ──────────────────────────────
  function showWarnings(warnings) {
    const banner = document.getElementById('error-banner');
    banner.style.background = '#fefce8';
    banner.style.borderColor = '#fbbf24';
    banner.style.color = '#92400e';
    banner.textContent = warnings.slice(0, 3).join(' | ') + (warnings.length > 3 ? ` (+${warnings.length - 3} more)` : '');
    banner.classList.remove('hidden');
    setTimeout(() => {
      banner.classList.add('hidden');
      banner.style.cssText = '';
    }, 5000);
  }
})();
