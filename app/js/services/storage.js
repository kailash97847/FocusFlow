/**
 * services/storage.js — versioned persistence port.
 * DOM-free apart from the injected backend (defaults to localStorage).
 * A single JSON document keeps writes atomic-ish; schema migrations hook in
 * via migrate().
 */

export const STORAGE_KEY = 'focusflow.v1';
export const SCHEMA_VERSION = 1;

export const EMPTY_STATE = Object.freeze({
  version: SCHEMA_VERSION,
  settings: null,   // sanitized on load by caller
  timer: null,      // engine restore payload
  tasks: [],
  sessions: [],
});

/** Migrate older payloads to the current schema. Hook for future versions. */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_STATE };
  // v1 → v1: identity. Future: if (raw.version < 2) { ... }
  return {
    version: SCHEMA_VERSION,
    settings: raw.settings ?? null,
    timer: raw.timer ?? null,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
  };
}

/**
 * Create a storage adapter.
 * @param {object} [backend] localStorage-compatible {getItem,setItem,removeItem}
 */
export function createStorage(backend = globalThis.localStorage) {
  return {
    load() {
      try {
        const text = backend.getItem(STORAGE_KEY);
        if (!text) return { ...EMPTY_STATE };
        return migrate(JSON.parse(text));
      } catch {
        // Corrupt JSON, quota errors, private-mode throws → safe empty state.
        return { ...EMPTY_STATE };
      }
    },

    save(state) {
      try {
        backend.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: SCHEMA_VERSION }));
        return true;
      } catch {
        return false; // quota exceeded / private mode — app keeps running in-memory
      }
    },

    clear() {
      try { backend.removeItem(STORAGE_KEY); } catch { /* no-op */ }
    },

    /** Serialize for user export (backup/move devices). */
    exportJSON(state) {
      return JSON.stringify({ ...state, version: SCHEMA_VERSION, exportedAt: new Date().toISOString() }, null, 2);
    },

    /** Parse + migrate an imported backup. Throws on invalid input. */
    importJSON(text) {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Not a FocusFlow backup');
      return migrate(parsed);
    },
  };
}
