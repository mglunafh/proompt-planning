'use strict';

const API = (() => {
  async function request(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        message = body.error || message;
      } catch (_) { /* ignore parse errors */ }
      throw new Error(message);
    }
    return response.json();
  }

  async function importCsv(file) {
    const form = new FormData();
    form.append('file', file);
    return request('/api/import', { method: 'POST', body: form });
  }

  async function mergeCsv(file) {
    const form = new FormData();
    form.append('file', file);
    return request('/api/import/csv/merge', { method: 'POST', body: form });
  }

  async function importJson(snapshot) {
    return request('/api/import/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  }

  async function getTimeline(snapshot, from, to, mode) {
    return request('/api/timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, from, to, mode }),
    });
  }

  async function savePlan(allocations, vacations) {
    return request('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocations, vacations }),
    });
  }

  async function validate(snapshot) {
    return request('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  }

  async function exportSnapshot(snapshot) {
    return request('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  }

  let _holidaysPromise = null;
  async function getHolidays() {
    if (!_holidaysPromise) {
      _holidaysPromise = request('/api/holidays', { method: 'GET' });
    }
    return _holidaysPromise;
  }

  return { importCsv, mergeCsv, importJson, getTimeline, savePlan, validate, exportSnapshot, getHolidays };
})();
