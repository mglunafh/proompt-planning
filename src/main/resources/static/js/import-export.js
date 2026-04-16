'use strict';

(() => {
  // ── CSV import ──────────────────────────
  document.getElementById('csv-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await API.importCsv(file);
      State.set({
        tasks: result.tasks,
        resources: result.resources,
        allocations: result.allocations,
        vacations: [],
      });
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
        tasks:       result.tasks,
        resources:   result.resources,
        allocations: result.allocations,
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
        allocations: normalized.allocations,
        vacations: normalized.vacations,
      });
    } catch (err) {
      showError('JSON import failed: ' + err.message);
    }
  });

  // ── Export ───────────────────────────────
  document.getElementById('btn-export').addEventListener('click', async () => {
    const state = State.get();
    const snapshot = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      tasks: state.tasks,
      resources: state.resources,
      allocations: state.allocations,
      vacations: state.vacations,
    };
    try {
      await API.exportSnapshot(snapshot);
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

  function showError(msg) {
    const banner = document.getElementById('error-banner');
    banner.style.cssText = '';
    banner.textContent = msg;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 5000);
  }
})();
