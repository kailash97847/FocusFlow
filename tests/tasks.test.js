import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTaskStore, createTask } from '../app/js/core/tasks.js';

test('add normalizes title, estimate; first task becomes active', () => {
  const store = createTaskStore();
  const t = store.add('  Write report  ', 3);
  assert.equal(t.title, 'Write report');
  assert.equal(t.estimate, 3);
  assert.equal(store.getActive().id, t.id);
});

test('add rejects empty title', () => {
  const store = createTaskStore();
  assert.equal(store.add('   '), null);
});

test('estimate is clamped to 1..20', () => {
  assert.equal(createTask({ title: 'x', estimate: 0 }).estimate, 1);
  assert.equal(createTask({ title: 'x', estimate: 500 }).estimate, 20);
});

test('toggleComplete flips and reassigns active', () => {
  const store = createTaskStore();
  const a = store.add('A');
  const b = store.add('B'); // newest first; active stays A
  assert.equal(store.getActive().id, a.id);
  store.toggleComplete(a.id);
  assert.equal(store.list().find((t) => t.id === a.id).completed, true);
  assert.equal(store.getActive().id, b.id, 'active falls to next open task');
});

test('completed tasks cannot be set active', () => {
  const store = createTaskStore();
  const a = store.add('A');
  const b = store.add('B');
  store.toggleComplete(a.id);
  assert.equal(store.setActive(a.id), false);
  assert.equal(store.getActive().id, b.id);
});

test('remove deletes and reassigns active', () => {
  const store = createTaskStore();
  const a = store.add('A');
  store.add('B');
  assert.equal(store.remove(a.id), true);
  assert.equal(store.list().length, 1);
  assert.equal(store.remove('nonexistent'), false);
});

test('incrementDone counts up to 99', () => {
  const store = createTaskStore();
  const a = store.add('A');
  for (let i = 0; i < 105; i++) store.incrementDone(a.id);
  assert.equal(store.list()[0].donePomodoros, 99);
  assert.equal(store.incrementDone('nope'), false);
});

test('reorder swaps neighbors with bounds checking', () => {
  const store = createTaskStore();
  const a = store.add('A'); const b = store.add('B'); const c = store.add('C');
  // order: C, B, A (newest first)
  assert.equal(store.reorder(a.id, 1), false, 'A already last');
  assert.equal(store.reorder(c.id, -1), false, 'C already first');
  assert.equal(store.reorder(b.id, -1), true);
  assert.deepEqual(store.list().map((t) => t.title), ['B', 'C', 'A']);
});

test('clearCompleted removes only completed', () => {
  const store = createTaskStore();
  const a = store.add('A'); store.add('B');
  store.toggleComplete(a.id);
  assert.equal(store.clearCompleted(), 1);
  assert.equal(store.list().length, 1);
});

test('onChange fires on mutations', () => {
  const store = createTaskStore();
  let calls = 0;
  store.onChange(() => calls++);
  const a = store.add('A');
  store.incrementDone(a.id);
  store.remove(a.id);
  assert.equal(calls, 3);
});

test('rehydration: corrupted entries dropped, active auto-picked', () => {
  const store = createTaskStore([
    { id: 'ok1', title: 'Keep', estimate: 2, donePomodoros: 1 },
    null,
    { noId: true },
    { id: 'done1', title: 'Done', completed: true },
  ]);
  const list = store.list();
  assert.equal(list.length, 2);
  assert.equal(store.getActive().id, 'ok1');
});
