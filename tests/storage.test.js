import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, migrate, EMPTY_STATE, STORAGE_KEY } from '../app/js/services/storage.js';

function fakeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test('load returns empty state when nothing stored', () => {
  const storage = createStorage(fakeLocalStorage());
  assert.deepEqual(storage.load(), { ...EMPTY_STATE });
});

test('save → load round-trips through JSON with version stamp', () => {
  const backend = fakeLocalStorage();
  const storage = createStorage(backend);
  const state = { settings: { focusMin: 30 }, timer: null, tasks: [{ id: 't1' }], sessions: [] };
  assert.equal(storage.save(state), true);
  const loaded = storage.load();
  assert.equal(loaded.version, 1);
  assert.equal(loaded.settings.focusMin, 30);
  assert.equal(loaded.tasks.length, 1);
});

test('load survives corrupt JSON (returns empty, never throws)', () => {
  const backend = fakeLocalStorage();
  backend.setItem(STORAGE_KEY, '{corrupt!!!');
  const storage = createStorage(backend);
  assert.deepEqual(storage.load(), { ...EMPTY_STATE });
});

test('save failure (quota) returns false without throwing', () => {
  const backend = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} };
  const storage = createStorage(backend);
  assert.equal(storage.save({}), false);
});

test('migrate rebuilds malformed payloads safely', () => {
  const m = migrate({ tasks: 'not-an-array', sessions: 42, settings: { focusMin: 50 } });
  assert.deepEqual(m.tasks, []);
  assert.deepEqual(m.sessions, []);
  assert.equal(m.settings.focusMin, 50);
  assert.deepEqual(migrate(null), { ...EMPTY_STATE });
});

test('export → import round-trip preserves data', () => {
  const storage = createStorage(fakeLocalStorage());
  const state = { settings: { focusMin: 45 }, timer: { status: 'idle' }, tasks: [{ id: 'a' }], sessions: [{ id: 's1', minutes: 25 }] };
  const json = storage.exportJSON(state);
  const restored = storage.importJSON(json);
  assert.equal(restored.settings.focusMin, 45);
  assert.equal(restored.tasks[0].id, 'a');
  assert.equal(restored.sessions[0].minutes, 25);
});

test('importJSON rejects non-object payloads', () => {
  const storage = createStorage(fakeLocalStorage());
  assert.throws(() => storage.importJSON('"just a string"'), /Not a FocusFlow backup/);
  assert.throws(() => storage.importJSON('[[[broken'), SyntaxError);
});
