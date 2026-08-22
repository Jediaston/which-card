export const STORAGE_KEY = "household-meds-v1";

export function memoryStorage(init = {}) {
  const data = { ...init };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function emptyState() {
  return { version: 1, days: {} };
}

export function createStore(storage) {
  const backend = storage || (typeof localStorage === "undefined" ? memoryStorage() : localStorage);

  function load() {
    try {
      const raw = backend.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || typeof parsed.days !== "object") return emptyState();
      return { version: 1, days: parsed.days };
    } catch {
      return emptyState();
    }
  }

  function save(state) {
    backend.setItem(STORAGE_KEY, JSON.stringify({ version: 1, days: state.days || {} }));
  }

  function getDay(dateKey) {
    return { ...(load().days[dateKey] || {}) };
  }

  function writeDay(dateKey, day) {
    const state = load();
    const next = { ...day };
    for (const [id, entry] of Object.entries(next)) {
      if (!entry) delete next[id];
    }
    state.days[dateKey] = next;
    save(state);
    return next;
  }

  function setEntry(dateKey, slotId, entry) {
    const day = getDay(dateKey);
    if (entry) day[slotId] = entry;
    else delete day[slotId];
    return writeDay(dateKey, day);
  }

  return { load, save, getDay, setEntry, writeDay };
}
