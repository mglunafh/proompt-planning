'use strict';

const Plans = (() => {
  let _activeCloseMenu = null;

  function render() {
    const state = State.get();
    const bar = document.getElementById('plan-bar');
    if (!bar) return;

    bar.innerHTML = '';
    const tabs = document.createElement('div');
    tabs.className = 'plan-tabs';

    for (const plan of state.plans) {
      const tab = document.createElement('div');
      tab.className = 'plan-tab' + (plan.id === state.activePlanId ? ' plan-tab--active' : '');
      tab.addEventListener('click', (e) => {
        if (!e.target.closest('.plan-tab-menu')) switchPlan(plan.id);
      });

      const name = document.createElement('span');
      name.className = 'plan-tab-name';
      name.textContent = plan.name;

      const menuBtn = document.createElement('button');
      menuBtn.className = 'plan-tab-menu';
      menuBtn.textContent = '⋯';
      menuBtn.addEventListener('click', (e) => { e.stopPropagation(); openMenu(e, plan); });

      tab.appendChild(name);
      tab.appendChild(menuBtn);
      tabs.appendChild(tab);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'plan-add-btn';
    addBtn.textContent = '+ New plan';
    addBtn.addEventListener('click', createPlan);
    tabs.appendChild(addBtn);

    bar.appendChild(tabs);
  }

  function switchPlan(planId) {
    const state = State.get();
    const plan = state.plans.find(p => p.id === planId);
    if (!plan || planId === state.activePlanId) return;
    savePlanSafely({ activePlanId: planId, allocations: plan.allocations });
  }

  async function createPlan() {
    const name = window.prompt('Plan name:', 'New plan');
    if (!name || !name.trim()) return;
    const state = State.get();
    const newPlan = { id: crypto.randomUUID(), name: name.trim(), allocations: [] };
    await savePlanSafely({ plans: [...state.plans, newPlan] });
  }

  function closeActiveMenu() {
    if (_activeCloseMenu) {
      document.removeEventListener('click', _activeCloseMenu);
      _activeCloseMenu = null;
    }
    document.querySelectorAll('.plan-menu').forEach(m => m.remove());
  }

  function openMenu(e, plan) {
    closeActiveMenu();

    const menu = document.createElement('div');
    menu.className = 'plan-menu';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.addEventListener('click', () => { closeActiveMenu(); renamePlan(plan); });

    const dupeBtn = document.createElement('button');
    dupeBtn.textContent = 'Duplicate';
    dupeBtn.addEventListener('click', () => { closeActiveMenu(); duplicatePlan(plan); });

    const delBtn = document.createElement('button');
    delBtn.className = 'plan-menu-item--danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => { closeActiveMenu(); deletePlan(plan); });

    menu.appendChild(renameBtn);
    menu.appendChild(dupeBtn);
    menu.appendChild(delBtn);

    const rect = e.target.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = rect.left + 'px';
    document.body.appendChild(menu);

    _activeCloseMenu = (ev) => {
      if (!menu.contains(ev.target)) closeActiveMenu();
    };
    setTimeout(() => document.addEventListener('click', _activeCloseMenu), 0);
  }

  async function renamePlan(plan) {
    const name = window.prompt('Rename plan:', plan.name);
    if (!name || !name.trim() || name.trim() === plan.name) return;
    const state = State.get();
    const plans = state.plans.map(p => p.id === plan.id ? { ...p, name: name.trim() } : p);
    await savePlanSafely({ plans });
  }

  async function duplicatePlan(plan) {
    const name = window.prompt('Duplicate plan name:', plan.name + ' (copy)');
    if (!name || !name.trim()) return;
    const state = State.get();
    // If duplicating the active plan use state.allocations (may have unsaved edits); otherwise use plan.allocations
    const srcAllocations = plan.id === state.activePlanId ? state.allocations : plan.allocations;
    const newPlan = {
      id: crypto.randomUUID(),
      name: name.trim(),
      allocations: srcAllocations.map(a => ({ ...a, id: crypto.randomUUID() })),
    };
    await savePlanSafely({ plans: [...state.plans, newPlan] });
  }

  async function deletePlan(plan) {
    if (!window.confirm(`Delete plan "${plan.name}"?`)) return;
    const state = State.get();
    const plans = state.plans.filter(p => p.id !== plan.id);
    let activePlanId = state.activePlanId;
    let allocations = state.allocations;
    if (plan.id === state.activePlanId) {
      activePlanId = plans.length > 0 ? plans[0].id : null;
      allocations = activePlanId ? (plans.find(p => p.id === activePlanId)?.allocations ?? []) : [];
    }
    await savePlanSafely({ plans, activePlanId, allocations });
  }

  State.subscribe(() => render());

  return { render };
})();
