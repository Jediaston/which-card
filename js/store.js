/** localStorage: perk-wallet-v2, with v1 fallback. */

export const STORAGE_KEY = "perk-wallet-v2";
export const LEGACY_KEY = "perk-wallet-v1";

export function defaultState() {
  return {
    version: 2,
    setupComplete: false,
    owned: [],
    favorites: [],
    focus: {},
    activated: {},
    lastMode: "everyday",
  };
}

export function memoryStorage(initial = {}) {
  const map = { ...initial };
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => {
      map[k] = String(v);
    },
    removeItem: (k) => {
      delete map[k];
    },
    _dump: () => ({ ...map }),
  };
}

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => (typeof item === "string" ? item : item?.id)).filter(Boolean))];
}

export function migrate(raw) {
  if (!raw || typeof raw !== "object") return defaultState();
  if (raw.version === 2) {
    return {
      ...defaultState(),
      ...raw,
      version: 2,
      owned: asIdList(raw.owned),
      favorites: asIdList(raw.favorites),
      focus: raw.focus && typeof raw.focus === "object" ? raw.focus : {},
      activated: raw.activated && typeof raw.activated === "object" ? raw.activated : {},
      setupComplete: Boolean(raw.setupComplete),
    };
  }

  const fromCards = Array.isArray(raw.cards) ? raw.cards : [];
  const ownedFromCards = fromCards
    .filter((c) => c && (c.on || c.owned || c.have || c.enabled !== false))
    .map((c) => (typeof c === "string" ? c : c.id));
  const favFromCards = fromCards.filter((c) => c && c.favorite).map((c) => c.id);

  const owned = asIdList(raw.owned?.length ? raw.owned : ownedFromCards);
  const favorites = asIdList(raw.favorites?.length ? raw.favorites : favFromCards);

  return {
    ...defaultState(),
    setupComplete: Boolean(raw.setupComplete) || owned.length > 0,
    owned,
    favorites,
    focus: raw.focus && typeof raw.focus === "object" ? raw.focus : {},
    activated: raw.activated && typeof raw.activated === "object" ? raw.activated : {},
    lastMode: raw.lastMode || "everyday",
  };
}

export function createStore(storage) {
  const store = storage || (typeof globalThis !== "undefined" ? globalThis.localStorage : memoryStorage());

  function read() {
    const v2 = parseJson(store.getItem(STORAGE_KEY));
    if (v2) return migrate(v2);
    const v1 = parseJson(store.getItem(LEGACY_KEY));
    if (v1) {
      const migrated = migrate({ ...v1, version: 1 });
      write(migrated);
      return migrated;
    }
    return defaultState();
  }

  function write(state) {
    const next = { ...defaultState(), ...state, version: 2 };
    store.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  return {
    load: read,
    save: write,
    reset() {
      store.removeItem(STORAGE_KEY);
      store.removeItem(LEGACY_KEY);
      return defaultState();
    },
    exportBackup() {
      return JSON.stringify(read(), null, 2);
    },
    importBackup(text) {
      const parsed = parseJson(text);
      if (!parsed) throw new Error("Backup file is not valid JSON.");
      return write(migrate(parsed.version ? parsed : { ...parsed, version: 1 }));
    },
  };
}
