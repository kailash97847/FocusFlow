/**
 * core/timer.js — FocusFlow timer engine (pure, deterministic, DOM-free).
 *
 * Design: the countdown is derived from an absolute timestamp (endsAt),
 * never from decrementing a counter, so setInterval drift, background-tab
 * throttling, and OS sleep cannot corrupt it. The clock is injectable,
 * making every behavior unit-testable.
 *
 * State machine:
 *   idle --start()--> running --pause()--> paused --resume()--> running
 *   running --tick(now>=endsAt)--> phaseEnd --> idle | running (auto-start)
 *   any --reset()--> idle     any --skip()--> idle(next mode)
 */

export const MODES = Object.freeze({
  FOCUS: 'focus',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK: 'longBreak',
});

export const MODE_LABELS = Object.freeze({
  [MODES.FOCUS]: 'Focus',
  [MODES.SHORT_BREAK]: 'Short break',
  [MODES.LONG_BREAK]: 'Long break',
});

/** Duration (ms) of a mode given user settings. */
export function durationFor(mode, settings) {
  const mins = {
    [MODES.FOCUS]: settings.focusMin,
    [MODES.SHORT_BREAK]: settings.shortBreakMin,
    [MODES.LONG_BREAK]: settings.longBreakMin,
  }[mode];
  return Math.round(mins * 60_000);
}

/** Decide which break follows a completed focus run. */
export function nextModeAfter(mode, completedFocusInCycle, settings) {
  if (mode === MODES.FOCUS) {
    const every = Math.max(1, settings.longBreakEvery | 0);
    return completedFocusInCycle > 0 && completedFocusInCycle % every === 0
      ? MODES.LONG_BREAK
      : MODES.SHORT_BREAK;
  }
  return MODES.FOCUS;
}

/**
 * Create a timer engine.
 * @param {object} settings  sanitized settings object (see core/settings.js)
 * @param {{now?: () => number}} [deps] injectable clock (ms epoch)
 */
export function createTimerEngine(settings, { now = () => Date.now() } = {}) {
  /** @type {'idle'|'running'|'paused'} */
  let status = 'idle';
  let mode = MODES.FOCUS;
  let endsAt = null;          // ms epoch when the running interval ends
  let remainingWhenPaused = durationFor(mode, settings);
  let completedFocusInCycle = 0;

  const listeners = new Map(); // event -> Set<fn>

  const emit = (event, payload) => {
    for (const fn of listeners.get(event) ?? []) fn(payload);
  };

  const snapshot = () => ({
    mode,
    status,
    endsAt,
    remainingMs: remainingMs(),
    durationMs: durationFor(mode, settings),
    completedFocusInCycle,
  });

  /** Remaining time derived from wall clock — immune to tick drift. */
  function remainingMs(at = now()) {
    if (status === 'running') return Math.max(0, endsAt - at);
    if (status === 'paused') return remainingWhenPaused;
    return durationFor(mode, settings);
  }

  /** Should this next mode auto-start per settings? */
  function shouldAutoStart(next) {
    return next === MODES.FOCUS ? !!settings.autoStartFocus : !!settings.autoStartBreaks;
  }

  function transitionToFinished() {
    const finishedMode = mode;
    let sessionCompleted = false;

    if (finishedMode === MODES.FOCUS) {
      completedFocusInCycle += 1;
      sessionCompleted = true;
    }
    const next = nextModeAfter(finishedMode, completedFocusInCycle, settings);
    mode = next;
    endsAt = null;
    remainingWhenPaused = durationFor(next, settings);

    const auto = shouldAutoStart(next);
    if (auto) {
      endsAt = now() + durationFor(next, settings);
      status = 'running';
    } else {
      status = 'idle';
    }

    emit('phaseEnd', {
      finishedMode,
      sessionCompleted,
      durationMs: durationFor(finishedMode, settings),
      nextMode: next,
      autoStarted: auto,
    });
    emit('change', snapshot());
  }

  return {
    /** Begin (or restart) the current mode countdown. */
    start() {
      if (status === 'running') return snapshot();
      if (status === 'paused') return this.resume();
      endsAt = now() + durationFor(mode, settings);
      status = 'running';
      emit('change', snapshot());
      return snapshot();
    },

    /** Freeze remaining time. */
    pause() {
      if (status !== 'running') return snapshot();
      remainingWhenPaused = remainingMs();
      endsAt = null;
      status = 'paused';
      emit('change', snapshot());
      return snapshot();
    },

    /** Continue from the frozen remaining time. */
    resume() {
      if (status !== 'paused') return snapshot();
      endsAt = now() + remainingWhenPaused;
      status = 'running';
      emit('change', snapshot());
      return snapshot();
    },

    /** Return to idle with a fresh full interval of the same mode. */
    reset() {
      status = 'idle';
      endsAt = null;
      remainingWhenPaused = durationFor(mode, settings);
      emit('change', snapshot());
      return snapshot();
    },

    /**
     * Abandon the current interval immediately and queue the next mode.
     * Skipped focus → short break (cycle count untouched, not recorded).
     * Skipped break → focus.
     */
    skip() {
      const next = mode === MODES.FOCUS ? MODES.SHORT_BREAK : MODES.FOCUS;
      mode = next;
      status = 'idle';
      endsAt = null;
      remainingWhenPaused = durationFor(next, settings);
      emit('change', snapshot());
      return snapshot();
    },

    /** Jump to a specific mode (user taps a mode tab). Resets countdown only. */
    setMode(next) {
      if (!Object.values(MODES).includes(next)) throw new Error(`Unknown mode: ${next}`);
      mode = next;
      status = 'idle';
      endsAt = null;
      remainingWhenPaused = durationFor(next, settings);
      emit('change', snapshot());
      return snapshot();
    },

    /**
     * Advance the clock. Call frequently (e.g. every 250 ms) AND on
     * visibility-resume. Returns true while still running.
     */
    tick(at = now()) {
      if (status === 'running' && at >= endsAt) {
        transitionToFinished();
        return false;
      }
      emit('tick', snapshot());
      return status === 'running';
    },

    /** Restore from a persisted snapshot (crash/reload resilience). */
    restore(saved) {
      if (!saved || typeof saved !== 'object') return snapshot();
      if (Object.values(MODES).includes(saved.mode)) mode = saved.mode;
      completedFocusInCycle = Number.isFinite(saved.completedFocusInCycle)
        ? Math.max(0, saved.completedFocusInCycle | 0) : 0;
      if (saved.status === 'running' && Number.isFinite(saved.endsAt)) {
        endsAt = saved.endsAt;
        status = 'running';
        if (now() >= endsAt) transitionToFinished(); // timer expired while away
      } else if (saved.status === 'paused' && Number.isFinite(saved.remainingMs)) {
        remainingWhenPaused = Math.max(0, saved.remainingMs);
        status = 'paused';
      } else {
        status = 'idle';
        endsAt = null;
        remainingWhenPaused = durationFor(mode, settings);
      }
      emit('change', snapshot());
      return snapshot();
    },

    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event).delete(fn);
    },

    getState: snapshot,
    remainingMs: (at) => remainingMs(at),
  };
}

/** Format milliseconds as m:ss (or h:mm:ss beyond an hour). */
export function formatClock(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
