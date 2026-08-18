/** Wallet persistence: localStorage, IndexedDB, and a cookie backup. */

export const STORAGE_KEY = "perk-wallet-v2";
export const LEGACY_KEY = "perk-wallet-v1";
const COOKIE_KEY = "perk-wallet-v2";
const IDB_NAME = "which-card-db";
const IDB_STORE = "kv";

export function defaultState() {
  return {
    version: 2,
    setupComplete: false,
    owned: [],
    favorites: [],
    focus: {},
    activated: {},
    lastMode: "everyday",
    updatedAt: 0,
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
      updatedAt: Number(raw.updatedAt) || 0,
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
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

export function richerState(a, b) {
  const left = a ? migrate(a) : defaultState();
  const right = b ? migrate(b) : defaultState();
  const leftScore = left.owned.length + (left.setupComplete ? 1 : 0);
  const rightScore = right.owned.length + (right.setupComplete ? 1 : 0);
  if (rightScore > leftScore) return right;
  if (leftScore > rightScore) return left;
  return (right.updatedAt || 0) > (left.updatedAt || 0) ? right : left;
}

function safeLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return memoryStorage();
    const probe = "__which_card_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

function readCookie() {
  if (typeof document === "undefined" || !document.cookie) return null;
  const match = document.cookie.match(/(?:^|; )perk-wallet-v2=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function writeCookie(state) {
  if (typeof document === "undefined") return;
  try {
    const value = encodeURIComponent(JSON.stringify(state));
    if (value.length > 3500) return;
    document.cookie = `${COOKIE_KEY}=${value}; max-age=31536000; samesite=lax; path=/`;
  } catch {
    /* ignore quota / cookie-disabled */
  }
}

function clearCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_KEY}=; max-age=0; samesite=lax; path=/`;
}

function openIdb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbGet(key) {
  return openIdb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(IDB_STORE, "readonly");
          const req = tx.objectStore(IDB_STORE).get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

function idbSet(key, value) {
  return openIdb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve();
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      })
  );
}

function idbDel(key) {
  return openIdb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve();
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      })
  );
}

export function createStore(storage) {
  const extras = !storage;
  const store = storage || safeLocalStorage();

  function readLocal() {
    try {
      const v2 = parseJson(store.getItem(STORAGE_KEY));
      if (v2) return migrate(v2);
      const v1 = parseJson(store.getItem(LEGACY_KEY));
      if (v1) {
        const migrated = migrate({ ...v1, version: 1 });
        try {
          store.setItem(STORAGE_KEY, JSON.stringify(migrated));
        } catch {
          /* ignore */
        }
        return migrated;
      }
    } catch {
      /* fall through */
    }
    return extras ? migrate(readCookie()) : defaultState();
  }

  function write(state) {
    const next = migrate({ ...defaultState(), ...state, version: 2, updatedAt: Date.now() });
    const json = JSON.stringify(next);
    try {
      store.setItem(STORAGE_KEY, json);
    } catch {
      /* private mode / quota */
    }
    if (extras) {
      writeCookie(next);
      idbSet(STORAGE_KEY, next);
    }
    return next;
  }

  function read() {
    return readLocal();
  }

  const ready = extras
    ? idbGet(STORAGE_KEY)
        .then((idb) => {
          const merged = richerState(readLocal(), idb);
          if (merged.owned.length || merged.setupComplete) write(merged);
          return merged;
        })
        .catch(() => readLocal())
    : Promise.resolve(readLocal());

  return {
    load: read,
    save: write,
    ready,
    reset() {
      try {
        store.removeItem(STORAGE_KEY);
        store.removeItem(LEGACY_KEY);
      } catch {
        /* ignore */
      }
      if (extras) {
        clearCookie();
        idbDel(STORAGE_KEY);
      }
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
