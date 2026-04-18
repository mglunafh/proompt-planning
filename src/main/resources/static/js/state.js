'use strict';

const State = (() => {
  let _state = {
    tasks: [],
    resources: [],
    allocations: [],
    vacations: [],
    holidays: [],
    viewMode: 'resource',
    zoom: 'day',
    plans: [],
    activePlanId: null,
  };

  const listeners = [];

  function get() {
    return { ..._state };
  }

  function set(partial) {
    _state = { ..._state, ...partial };
    listeners.forEach(fn => fn(_state));
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  return { get, set, subscribe };
})();
