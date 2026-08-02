/**
 * ui/app.js — application controller (browser only).
 * Wires the pure core to the DOM. Rendering is explicit and idempotent;
 * every mutation funnels through persist(). No DOM access at module level
 * so this file stays parse-safe in Node.
 */

import { createTimerEngine, MODES, MODE_LABELS, formatClock } from '../core/timer.js';
import { sanitizeSettings } from '../core/settings.js';
import { createTaskStore } from '../core/tasks.js';
import { createSession, sessionsOnDay, totalMinutes, lastNDays, currentStreak } from '../core/stats.js';
import { createStorage } from '../services/storage.js';
import { createAudio } from '../services/audio.js';
import { createNotifier } from '../services/notify.js';

const RING_R = 118;
const RING_C = 2 * Math.PI * RING_R;
const TICK_MS = 250;

export function initApp(doc) {
  const $ = (sel) => doc.querySelector(sel);
  const el = {
    clock: $('#clock'),
    ringFg: $('#ring-fg'),
    timerCard: $('#timer-card'),
    phaseLabel: $('#phase-label'),
    cycleDots: $('#cycle-dots'),
    activeTask: $('#active-task-name'),
    startPause: $('#btn-start-pause'),
    reset: $('#btn-reset'),
    skip: $('#btn-skip'),
    modeTabs: Array.from(doc.querySelectorAll('[data-mode-tab]')),
    announcer: $('#sr-announcer'),
    // tasks
    taskForm: $('#task-form'),
    taskTitle: $('#task-title'),
    taskEst: $('#task-est'),
    taskList: $('#task-list'),
    tasksEmpty: $('#tasks-empty'),
    clearCompleted: $('#btn-clear-completed'),
    // stats
    statToday: $('#stat-today'),
    statStreak: $('#stat-streak'),
    statSessions: $('#stat-sessions'),
    statTotal: $('#stat-total'),
    chart: $('#chart'),
    recent: $('#recent-sessions'),
    // settings
    sFocus: $('#set-focus'),
    sShort: $('#set-short'),
    sLong: $('#set-long'),
    sEvery: $('#set-every'),
    sAutoBreak: $('#set-autobreak'),
    sAutoFocus: $('#set-autofocus'),
    sSound: $('#set-sound'),
    sAmbient: $('#set-ambient'),
    sAmbientVol: $('#set-ambientvol'),
    sTheme: $('#set-theme'),
    testSound: $('#btn-test-sound'),
    exportBtn: $('#btn-export'),
    importBtn: $('#btn-import'),
    importFile: $('#import-file'),
    resetAll: $('#btn-reset-all'),
    notifyBtn: $('#btn-enable-notifications'),
    installBtn: $('#btn-install'),
    // nav
    navTabs: Array.from(doc.querySelectorAll('[data-nav]')),
    views: Array.from(doc.querySelectorAll('[data-view]')),
  };

  // ---------- state ----------
  const storage = createStorage();
  const saved = storage.load();
  let settings = sanitizeSettings(saved.settings ?? {});
  let sessions = saved.sessions;
  const tasks = createTaskStore(saved.tasks);
  const engine = createTimerEngine(settings);
  const audio = createAudio(settings);
  const notifier = createNotifier();
  engine.restore(saved.timer);

  let deferredInstallPrompt = null;
  let announcedPhase = null;

  const persist = () => storage.save({
    settings, timer: engine.getState(), tasks: tasks.list(), sessions,
  });

  // ---------- rendering ----------
  function announce(msg) {
    if (el.announcer && announcedPhase !== msg) {
      announcedPhase = msg;
      el.announcer.textContent = msg;
    }
  }

  function renderTimer() {
    const st = engine.getState();
    const ms = st.remainingMs;
    el.clock.textContent = formatClock(ms);
    const frac = st.durationMs > 0 ? ms / st.durationMs : 0;
    el.ringFg.style.strokeDashoffset = String(RING_C * (1 - frac));

    el.timerCard.dataset.mode = st.mode;
    el.timerCard.dataset.status = st.status;
    el.phaseLabel.textContent = MODE_LABELS[st.mode];

    el.startPause.textContent = st.status === 'running' ? 'Pause' : st.status === 'paused' ? 'Resume' : 'Start';
    el.startPause.setAttribute('aria-pressed', st.status === 'running' ? 'true' : 'false');
    el.startPause.classList.toggle('is-running', st.status === 'running');

    for (const btn of el.modeTabs) {
      const active = btn.dataset.modeTab === st.mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }

    // cycle dots: progress toward next long break
    const every = Math.max(1, settings.longBreakEvery);
    const done = st.completedFocusInCycle % every;
    el.cycleDots.innerHTML = '';
    for (let i = 0; i < every; i++) {
      const dot = doc.createElement('span');
      dot.className = 'dot' + (i < done ? ' is-done' : '');
      el.cycleDots.append(dot);
    }

    const active = tasks.getActive();
    el.activeTask.textContent = active
      ? `${active.title} · ${active.donePomodoros}/${active.estimate} 🍅`
      : 'No active task — add one in Tasks';

    doc.title = st.status === 'running'
      ? `${formatClock(ms)} · ${MODE_LABELS[st.mode]} — FocusFlow`
      : 'FocusFlow — Deep work, distilled';
  }

  function renderTasks() {
    const list = tasks.list();
    const active = tasks.getActive();
    el.taskList.innerHTML = '';
    el.tasksEmpty.hidden = list.length > 0;

    list.forEach((t, idx) => {
      const li = doc.createElement('li');
      li.className = 'task' + (t.completed ? ' is-completed' : '') + (active && t.id === active.id ? ' is-active' : '');

      const main = doc.createElement('button');
      main.type = 'button';
      main.className = 'task-main';
      main.setAttribute('aria-label', t.completed ? `Reopen ${t.title}` : `Set active: ${t.title}`);
      main.addEventListener('click', () => {
        if (t.completed) { tasks.toggleComplete(t.id); } else { tasks.setActive(t.id); audio.blip(); }
      });

      const check = doc.createElement('button');
      check.type = 'button';
      check.className = 'task-check';
      check.setAttribute('aria-label', t.completed ? 'Mark not done' : 'Mark done');
      check.addEventListener('click', (e) => { e.stopPropagation(); tasks.toggleComplete(t.id); audio.blip(); });

      const title = doc.createElement('span');
      title.className = 'task-title';
      title.textContent = t.title;
      const meta = doc.createElement('span');
      meta.className = 'task-meta';
      meta.textContent = `${t.donePomodoros}/${t.estimate} 🍅`;
      main.append(title, meta);

      const controls = doc.createElement('span');
      controls.className = 'task-controls';
      const mk = (label, icon, fn, disabled) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'icon-btn';
        b.textContent = icon;
        b.title = label;
        b.setAttribute('aria-label', label);
        b.disabled = disabled;
        b.addEventListener('click', fn);
        return b;
      };
      controls.append(
        mk('Move up', '↑', () => tasks.reorder(t.id, -1), idx === 0),
        mk('Move down', '↓', () => tasks.reorder(t.id, 1), idx === list.length - 1),
        mk('Delete task', '✕', () => { tasks.remove(t.id); audio.blip(); }),
      );

      li.append(check, main, controls);
      el.taskList.append(li);
    });
  }

  function renderStats() {
    const today = sessionsOnDay(sessions);
    el.statToday.textContent = `${Math.round(totalMinutes(today))}m`;
    el.statStreak.textContent = `${currentStreak(sessions)}d`;
    el.statSessions.textContent = String(today.length);
    el.statTotal.textContent = `${Math.round(totalMinutes(sessions) / 60 * 10) / 10}h`;

    const buckets = lastNDays(sessions, 14);
    const max = Math.max(1, ...buckets.map((b) => b.minutes));
    el.chart.innerHTML = '';
    for (const b of buckets) {
      const wrap = doc.createElement('div');
      wrap.className = 'bar-wrap';
      const val = doc.createElement('div');
      val.className = 'bar-val';
      val.textContent = b.minutes >= 60
        ? `${Math.round(b.minutes / 60 * 10) / 10}h`
        : b.minutes > 0 ? `${Math.round(b.minutes)}m` : '';
      const bar = doc.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${Math.max(2, (b.minutes / max) * 100)}%`;
      if (b.date === buckets[buckets.length - 1].date) bar.classList.add('is-today');
      bar.title = `${b.date}: ${Math.round(b.minutes)} min · ${b.sessions} sessions`;
      const lab = doc.createElement('div');
      lab.className = 'bar-lab';
      lab.textContent = b.date.slice(8); // day of month
      wrap.append(val, bar, lab);
      el.chart.append(wrap);
    }

    el.recent.innerHTML = '';
    [...sessions].sort((a, b) => b.endedAt - a.endedAt).slice(0, 6).forEach((s) => {
      const li = doc.createElement('li');
      const taskTitle = tasks.list().find((t) => t.id === s.taskId)?.title ?? 'Untracked';
      const when = new Date(s.endedAt);
      li.innerHTML = '';
      const strong = doc.createElement('strong');
      strong.textContent = taskTitle;
      const span = doc.createElement('span');
      span.textContent = ` · ${Math.round(s.minutes)}m — ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      li.append(strong, span);
      el.recent.append(li);
    });
  }

  function renderSettingsForm() {
    el.sFocus.value = String(settings.focusMin);
    el.sShort.value = String(settings.shortBreakMin);
    el.sLong.value = String(settings.longBreakMin);
    el.sEvery.value = String(settings.longBreakEvery);
    el.sAutoBreak.checked = settings.autoStartBreaks;
    el.sAutoFocus.checked = settings.autoStartFocus;
    el.sSound.checked = settings.sound;
    el.sAmbient.value = settings.ambient;
    el.sAmbientVol.value = String(settings.ambientVolume);
    el.sTheme.value = settings.theme;
    if (notifier.supported) {
      el.notifyBtn.disabled = notifier.permission === 'granted';
      el.notifyBtn.textContent = notifier.permission === 'granted' ? 'Notifications enabled ✓' : 'Enable notifications';
    } else {
      el.notifyBtn.disabled = true;
      el.notifyBtn.textContent = 'Notifications unsupported';
    }
  }

  function applyTheme() {
    const root = doc.documentElement;
    if (settings.theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.dataset.theme = settings.theme;
    }
  }

  // ---------- behaviors ----------
  function switchView(name) {
    for (const t of el.navTabs) {
      const active = t.dataset.nav === name;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    for (const v of el.views) v.hidden = v.dataset.view !== name;
    if (name === 'stats') renderStats();
  }

  function onPhaseEnd({ finishedMode, sessionCompleted, durationMs, nextMode }) {
    notifier.cancelScheduled();
    if (sessionCompleted) {
      sessions = [...sessions, createSession({ taskId: tasks.getActive()?.id ?? null, minutes: durationMs / 60_000 })];
      const active = tasks.getActive();
      if (active) tasks.incrementDone(active.id);
      audio.chime('focus');
    } else {
      audio.chime('break');
    }
    notifier.notify(
      `${MODE_LABELS[finishedMode]} complete`,
      nextMode === MODES.FOCUS ? 'Time to focus again.' : `Enjoy your ${MODE_LABELS[nextMode].toLowerCase()}.`,
    );
    announce(`${MODE_LABELS[finishedMode]} complete. Next: ${MODE_LABELS[nextMode]}.`);
    persist();
    renderTimer();
    renderTasks();
    renderStats();
  }

  // ---------- wiring ----------
  engine.on('tick', renderTimer);
  engine.on('change', () => { renderTimer(); persist(); syncScheduledNotification(); });
  engine.on('phaseEnd', onPhaseEnd);
  tasks.onChange(() => { renderTasks(); renderTimer(); persist(); });

  /**
   * Keep a native scheduled alert aligned with the running timer so the
   * phase-end ping fires even if the app is backgrounded or killed.
   */
  function syncScheduledNotification() {
    const st = engine.getState();
    if (st.status === 'running' && Number.isFinite(st.endsAt)) {
      notifier.schedulePhaseEnd({
        at: st.endsAt,
        title: `${MODE_LABELS[st.mode]} complete`,
        body: st.mode === MODES.FOCUS ? 'Great work — tap to take your break.' : 'Break over — tap to refocus.',
      });
    } else {
      notifier.cancelScheduled();
    }
  }

  el.startPause.addEventListener('click', () => {
    audio.unlock();
    audio.syncAmbient();
    const st = engine.getState().status;
    if (st === 'running') { engine.pause(); audio.blip(); }
    else { engine.start(); announce(`${MODE_LABELS[engine.getState().mode]} started.`); }
  });
  el.reset.addEventListener('click', () => { engine.reset(); audio.blip(); });
  el.skip.addEventListener('click', () => { engine.skip(); audio.blip(); });

  for (const btn of el.modeTabs) {
    btn.addEventListener('click', () => { engine.setMode(btn.dataset.modeTab); audio.blip(); });
  }
  for (const tab of el.navTabs) {
    tab.addEventListener('click', () => switchView(tab.dataset.nav));
  }

  el.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const task = tasks.add(el.taskTitle.value, Number(el.taskEst.value) || 1);
    if (task) { el.taskTitle.value = ''; el.taskEst.value = '1'; el.taskTitle.focus(); audio.blip(); }
  });
  el.clearCompleted.addEventListener('click', () => tasks.clearCompleted());

  // settings listeners
  const applySettings = () => {
    settings = sanitizeSettings({
      ...settings,
      focusMin: Number(el.sFocus.value),
      shortBreakMin: Number(el.sShort.value),
      longBreakMin: Number(el.sLong.value),
      longBreakEvery: Number(el.sEvery.value),
      autoStartBreaks: el.sAutoBreak.checked,
      autoStartFocus: el.sAutoFocus.checked,
      sound: el.sSound.checked,
      ambient: el.sAmbient.value,
      ambientVolume: Number(el.sAmbientVol.value),
      theme: el.sTheme.value,
    });
    renderSettingsForm();
    applyTheme();
    audio.setAmbientVolume(settings.ambientVolume);
    audio.syncAmbient();
    persist();
    renderTimer();
  };
  for (const input of [el.sFocus, el.sShort, el.sLong, el.sEvery, el.sAutoBreak, el.sAutoFocus, el.sSound, el.sAmbient, el.sAmbientVol, el.sTheme]) {
    input.addEventListener('change', applySettings);
  }
  el.testSound.addEventListener('click', () => { audio.unlock(); audio.chime('focus'); });

  el.notifyBtn.addEventListener('click', async () => {
    await notifier.requestPermission();
    renderSettingsForm();
  });

  el.exportBtn.addEventListener('click', () => {
    const json = storage.exportJSON({ settings, timer: null, tasks: tasks.list(), sessions });
    const blob = new Blob([json], { type: 'application/json' });
    const a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `focusflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  el.importBtn.addEventListener('click', () => el.importFile.click());
  el.importFile.addEventListener('change', async () => {
    const file = el.importFile.files?.[0];
    if (!file) return;
    try {
      const data = storage.importJSON(await file.text());
      settings = sanitizeSettings(data.settings ?? {});
      sessions = data.sessions;
      storage.save({ settings, timer: null, tasks: data.tasks, sessions });
      location.reload();
    } catch {
      alert('Import failed: not a valid FocusFlow backup file.');
    }
  });
  el.resetAll.addEventListener('click', () => {
    if (confirm('Erase ALL FocusFlow data on this device? This cannot be undone.')) {
      storage.clear();
      location.reload();
    }
  });

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    el.installBtn.hidden = false;
  });
  el.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    el.installBtn.hidden = true;
  });

  // Keyboard shortcuts
  doc.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(doc.activeElement?.tagName ?? '');
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); el.startPause.click(); }
    else if (e.key === 'r' || e.key === 'R') el.reset.click();
    else if (e.key === 's' || e.key === 'S') el.skip.click();
  });

  // Unlock audio on first interaction (iOS/Safari requirement)
  doc.addEventListener('pointerdown', () => { audio.unlock(); audio.syncAmbient(); }, { once: true });

  // Ticking: interval + resume hooks for throttling/sleep recovery
  setInterval(() => engine.tick(), TICK_MS);
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) engine.tick(); });
  window.addEventListener('focus', () => engine.tick());
  window.addEventListener('beforeunload', persist);

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline SW optional in dev */ });
  }

  // ---------- first render ----------
  applyTheme();
  renderSettingsForm();
  renderTimer();
  renderTasks();
  renderStats();
  persist();
  syncScheduledNotification();
  notifier.init().finally(renderSettingsForm);

  return { engine, tasks, switchView };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initApp(document));
}
