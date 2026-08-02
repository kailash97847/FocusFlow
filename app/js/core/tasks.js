/**
 * core/tasks.js — task queue store (pure, DOM-free).
 * Tasks are plain serializable objects so the store round-trips through JSON.
 */

const uid = (seed) => `t_${Date.now().toString(36)}_${(seed ?? Math.floor(Math.random() * 1e6)).toString(36)}`;

export function createTask({ id, title, estimate = 1, now = Date.now() }) {
  return {
    id: id ?? uid(),
    title: String(title ?? '').trim().slice(0, 200),
    estimate: Math.max(1, Math.min(20, Math.round(estimate) || 1)),
    donePomodoros: 0,
    completed: false,
    createdAt: now,
    completedAt: null,
  };
}

/**
 * Task store: immutable-ish updates, emits on change.
 * @param {Array} [initial] previously persisted tasks
 */
export function createTaskStore(initial = []) {
  let tasks = Array.isArray(initial)
    ? initial.filter((t) => t && typeof t.id === 'string').map((t) => ({
        ...createTask({ id: t.id, title: t.title, estimate: t.estimate, now: t.createdAt ?? Date.now() }),
        donePomodoros: Math.max(0, Math.round(t.donePomodoros) || 0),
        completed: !!t.completed,
        completedAt: t.completedAt ?? null,
      }))
    : [];
  let activeId = null;

  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(list()));
  const find = (id) => tasks.find((t) => t.id === id);
  const list = () => tasks.map((t) => ({ ...t }));

  // Auto-activate the first open task on load.
  const firstOpen = tasks.find((t) => !t.completed);
  if (firstOpen) activeId = firstOpen.id;

  return {
    list,

    add(title, estimate = 1) {
      const task = createTask({ title, estimate });
      if (!task.title) return null;
      tasks = [task, ...tasks];
      activeId ??= task.id;
      emit();
      return task;
    },

    toggleComplete(id) {
      const t = find(id);
      if (!t) return false;
      t.completed = !t.completed;
      t.completedAt = t.completed ? Date.now() : null;
      if (t.completed && activeId === id) {
        activeId = (tasks.find((x) => !x.completed) ?? {}).id ?? null;
      }
      emit();
      return true;
    },

    remove(id) {
      const before = tasks.length;
      tasks = tasks.filter((t) => t.id !== id);
      if (activeId === id) activeId = (tasks.find((t) => !t.completed) ?? {}).id ?? null;
      if (tasks.length !== before) emit();
      return tasks.length !== before;
    },

    setActive(id) {
      const t = find(id);
      if (!t || t.completed) return false;
      activeId = id;
      emit();
      return true;
    },

    getActive() {
      const t = find(activeId);
      return t && !t.completed ? { ...t } : null;
    },

    /** Record one completed focus interval against a task. */
    incrementDone(id) {
      const t = find(id);
      if (!t) return false;
      t.donePomodoros = Math.min(99, t.donePomodoros + 1);
      emit();
      return true;
    },

    /** Move a task one step up (-1) or down (+1) in the queue. */
    reorder(id, direction) {
      const i = tasks.findIndex((t) => t.id === id);
      const j = i + (direction < 0 ? -1 : 1);
      if (i < 0 || j < 0 || j >= tasks.length) return false;
      [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
      emit();
      return true;
    },

    clearCompleted() {
      const before = tasks.length;
      tasks = tasks.filter((t) => !t.completed);
      if (tasks.length !== before) emit();
      return before - tasks.length;
    },

    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
