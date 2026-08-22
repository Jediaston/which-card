export const STORAGE_KEY = "household-meds-v2";
export const LEGACY_KEY = "household-meds-v1";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

function profileRecord(id, letter, pack = "custom") {
  return { id, letter, pack, custom: [], days: {} };
}

function defaultState() {
  return {
    version: 2,
    activeId: "a",
    profiles: {
      a: profileRecord("a", "A", "preset"),
      b: profileRecord("b", "B", "custom"),
    },
  };
}

function migrate(parsed) {
  if (parsed && parsed.version === 2 && parsed.profiles && typeof parsed.profiles === "object") {
    const profiles = {};
    for (const [id, row] of Object.entries(parsed.profiles)) {
      if (!row || !row.id) continue;
      profiles[id] = {
        id: row.id,
        letter: row.letter || String(id).toUpperCase(),
        pack: row.pack === "preset" ? "preset" : "custom",
        custom: Array.isArray(row.custom) ? row.custom : [],
        days: row.days && typeof row.days === "object" ? row.days : {},
      };
    }
    if (!Object.keys(profiles).length) return defaultState();
    const activeId = profiles[parsed.activeId] ? parsed.activeId : Object.keys(profiles)[0];
    return { version: 2, activeId, profiles };
  }
  if (parsed && parsed.version === 1 && parsed.days && typeof parsed.days === "object") {
    const state = defaultState();
    state.profiles.a.days = parsed.days;
    return state;
  }
  return defaultState();
}

export function createStore(storage) {
  const backend = storage || (typeof localStorage === "undefined" ? memoryStorage() : localStorage);

  function readRaw(key) {
    try {
      const raw = backend.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function load() {
    const current = readRaw(STORAGE_KEY);
    if (current) return migrate(current);
    const legacy = readRaw(LEGACY_KEY);
    const state = migrate(legacy);
    save(state);
    return state;
  }

  function save(state) {
    backend.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      activeId: state.activeId,
      profiles: state.profiles,
    }));
  }

  function listProfiles() {
    return Object.values(load().profiles).sort((a, b) => a.letter.localeCompare(b.letter));
  }

  function getActive() {
    const state = load();
    return state.profiles[state.activeId] || listProfiles()[0];
  }

  function setActive(id) {
    const state = load();
    if (!state.profiles[id]) return getActive();
    state.activeId = id;
    save(state);
    return state.profiles[id];
  }

  function addProfile() {
    const state = load();
    const used = new Set(Object.values(state.profiles).map((p) => p.letter));
    const letter = [...LETTERS].find((ch) => !used.has(ch)) || String(Object.keys(state.profiles).length + 1);
    const id = letter.toLowerCase();
    let nextId = id;
    let n = 2;
    while (state.profiles[nextId]) {
      nextId = `${id}${n}`;
      n += 1;
    }
    state.profiles[nextId] = profileRecord(nextId, letter, "custom");
    state.activeId = nextId;
    save(state);
    return state.profiles[nextId];
  }

  function removeProfile(id) {
    const state = load();
    if (Object.keys(state.profiles).length <= 1) return getActive();
    delete state.profiles[id];
    if (state.activeId === id) state.activeId = Object.keys(state.profiles)[0];
    save(state);
    return state.profiles[state.activeId];
  }

  function updateActive(mutator) {
    const state = load();
    const profile = state.profiles[state.activeId];
    if (!profile) return getActive();
    mutator(profile);
    save(state);
    return profile;
  }

  function setPack(pack) {
    return updateActive((profile) => {
      profile.pack = pack === "preset" ? "preset" : "custom";
    });
  }

  function addCustom(item) {
    return updateActive((profile) => {
      profile.custom = [...(profile.custom || []), item];
    });
  }

  function removeCustom(slotId) {
    return updateActive((profile) => {
      profile.custom = (profile.custom || []).filter((row) => row.id !== slotId);
    });
  }

  function getDay(dateKey) {
    return { ...(getActive().days[dateKey] || {}) };
  }

  function writeDay(dateKey, day) {
    return updateActive((profile) => {
      const next = { ...day };
      for (const [id, entry] of Object.entries(next)) {
        if (!entry) delete next[id];
      }
      profile.days = { ...profile.days, [dateKey]: next };
    });
  }

  function setEntry(dateKey, slotId, entry) {
    const day = getDay(dateKey);
    if (entry) day[slotId] = entry;
    else delete day[slotId];
    writeDay(dateKey, day);
    return getDay(dateKey);
  }

  return {
    load,
    save,
    listProfiles,
    getActive,
    setActive,
    addProfile,
    removeProfile,
    setPack,
    addCustom,
    removeCustom,
    getDay,
    setEntry,
    writeDay,
  };
}
