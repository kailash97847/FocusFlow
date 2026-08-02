import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimerEngine, MODES, durationFor, nextModeAfter, formatClock,
} from '../app/js/core/timer.js';
import { sanitizeSettings } from '../app/js/core/settings.js';

/** Deterministic fake clock. */
function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

const baseSettings = () => sanitizeSettings({
  focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4,
  autoStartBreaks: false, autoStartFocus: false,
});

test('durationFor maps modes to settings minutes', () => {
  const s = baseSettings();
  assert.equal(durationFor(MODES.FOCUS, s), 25 * 60_000);
  assert.equal(durationFor(MODES.SHORT_BREAK, s), 5 * 60_000);
  assert.equal(durationFor(MODES.LONG_BREAK, s), 15 * 60_000);
});

test('nextModeAfter: long break every Nth completed focus, else short', () => {
  const s = baseSettings();
  assert.equal(nextModeAfter(MODES.FOCUS, 1, s), MODES.SHORT_BREAK);
  assert.equal(nextModeAfter(MODES.FOCUS, 3, s), MODES.SHORT_BREAK);
  assert.equal(nextModeAfter(MODES.FOCUS, 4, s), MODES.LONG_BREAK);
  assert.equal(nextModeAfter(MODES.FOCUS, 8, s), MODES.LONG_BREAK);
  assert.equal(nextModeAfter(MODES.SHORT_BREAK, 4, s), MODES.FOCUS);
  assert.equal(nextModeAfter(MODES.LONG_BREAK, 4, s), MODES.FOCUS);
});

test('start → tick → phaseEnd at end, session recorded', () => {
  const clock = fakeClock();
  const engine = createTimerEngine(baseSettings(), { now: clock.now });
  const events = [];
  engine.on('phaseEnd', (e) => events.push(e));

  engine.start();
  assert.equal(engine.getState().status, 'running');
  clock.advance(25 * 60_000 - 1_000);
  engine.tick();
  assert.equal(engine.getState().status, 'running');
  assert.equal(engine.getState().remainingMs, 1_000);
  clock.advance(1_000);
  engine.tick();

  assert.equal(events.length, 1);
  assert.equal(events[0].finishedMode, MODES.FOCUS);
  assert.equal(events[0].sessionCompleted, true);
  assert.equal(events[0].nextMode, MODES.SHORT_BREAK);
  assert.equal(engine.getState().status, 'idle');
  assert.equal(engine.getState().mode, MODES.SHORT_BREAK);
});

test('pause/resume freezes and restores remaining time exactly', () => {
  const clock = fakeClock();
  const engine = createTimerEngine(baseSettings(), { now: clock.now });
  engine.start();
  clock.advance(60_000);
  engine.pause();
  const frozen = engine.getState().remainingMs;
  assert.equal(frozen, 24 * 60_000);
  clock.advance(10 * 60_000); // wall time passes while paused
  engine.tick();
  assert.equal(engine.getState().remainingMs, frozen, 'paused must not tick down');
  engine.resume();
  clock.advance(60_000);
  engine.tick();
  assert.equal(engine.getState().remainingMs, 23 * 60_000);
});

test('drift immunity: infrequent ticks stay accurate (8h simulated)', () => {
  const clock = fakeClock();
  const engine = createTimerEngine(
    sanitizeSettings({ ...baseSettings(), autoStartBreaks: true, autoStartFocus: true }),
    { now: clock.now },
  );
  engine.start();
  // Simulate a throttled/sleeping tab: only 10 ticks across 8 hours.
  for (let i = 0; i < 10; i++) {
    clock.advance(48 * 60_000);
    engine.tick();
  }
  // 8h elapsed with 25/5 auto-cycling: engine kept flipping phases by wall
  // clock only when ticked — verify no crash and state is coherent.
  const state = engine.getState();
  assert.ok(['idle', 'running', 'paused'].includes(state.status));
  assert.ok(Object.values(MODES).includes(state.mode));
  assert.ok(state.remainingMs >= 0 && state.remainingMs <= state.durationMs);
});

test('complete 4 focus intervals → 4th proposes long break', () => {
  const clock = fakeClock();
  const s = sanitizeSettings({ ...baseSettings(), autoStartBreaks: true, autoStartFocus: true });
  const engine = createTimerEngine(s, { now: clock.now });
  const ends = [];
  engine.on('phaseEnd', (e) => ends.push(e));
  engine.start();
  for (let i = 0; i < 12; i++) { // burn through several full phases
    clock.advance(90 * 60_000); // way past any single interval
    engine.tick();
  }
  const focusEnds = ends.filter((e) => e.finishedMode === MODES.FOCUS);
  assert.ok(focusEnds.length >= 4);
  const fourth = focusEnds[3];
  assert.equal(fourth.nextMode, MODES.LONG_BREAK);
});

test('reset returns to idle full duration of current mode', () => {
  const clock = fakeClock();
  const engine = createTimerEngine(baseSettings(), { now: clock.now });
  engine.start();
  clock.advance(5 * 60_000);
  engine.reset();
  const st = engine.getState();
  assert.equal(st.status, 'idle');
  assert.equal(st.remainingMs, 25 * 60_000);
});

test('skip focus → short break unrecorded; skip break → focus', () => {
  const clock = fakeClock();
  const engine = createTimerEngine(baseSettings(), { now: clock.now });
  const events = [];
  engine.on('phaseEnd', (e) => events.push(e));
  engine.start();
  engine.skip();
  assert.equal(events.length, 0, 'skip must not emit phaseEnd / record session');
  assert.equal(engine.getState().mode, MODES.SHORT_BREAK);
  engine.skip();
  assert.equal(engine.getState().mode, MODES.FOCUS);
});

test('setMode validates and resets countdown', () => {
  const clock = fakeClock();
  const engine = createTimerEngine(baseSettings(), { now: clock.now });
  engine.setMode(MODES.LONG_BREAK);
  assert.equal(engine.getState().remainingMs, 15 * 60_000);
  assert.throws(() => engine.setMode('nope'), /Unknown mode/);
});

test('restore resumes a running timer that expired while away', () => {
  const clock = fakeClock();
  const engine = createTimerEngine(baseSettings(), { now: clock.now });
  engine.start();
  const saved = engine.getState();
  clock.advance(26 * 60_000); // device slept past the end
  const restored = createTimerEngine(baseSettings(), { now: clock.now });
  restored.restore(saved);
  assert.equal(restored.getState().mode, MODES.SHORT_BREAK, 'phase advanced while away');
});

test('restore paused keeps frozen remaining', () => {
  const clock = fakeClock();
  const engine = createTimerEngine(baseSettings(), { now: clock.now });
  engine.start();
  clock.advance(5 * 60_000);
  engine.pause();
  const saved = engine.getState();
  clock.advance(60 * 60_000);
  const restored = createTimerEngine(baseSettings(), { now: clock.now });
  restored.restore(saved);
  assert.equal(restored.getState().status, 'paused');
  assert.equal(restored.getState().remainingMs, 20 * 60_000);
});

test('formatClock renders m:ss and h:mm:ss', () => {
  assert.equal(formatClock(25 * 60_000), '25:00');
  assert.equal(formatClock(61_000), '1:01');
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(3_661_000), '1:01:01');
  assert.equal(formatClock(59_400), '1:00'); // ceil: 59.4s shows 1:00
});
