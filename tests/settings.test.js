import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../app/js/core/settings.js';

test('sanitizeSettings returns defaults for empty input', () => {
  assert.deepEqual(sanitizeSettings(), { ...DEFAULT_SETTINGS });
  assert.deepEqual(sanitizeSettings(null), { ...DEFAULT_SETTINGS });
});

test('clamps durations into safe ranges', () => {
  const s = sanitizeSettings({ focusMin: 9999, shortBreakMin: -5, longBreakEvery: 1 });
  assert.equal(s.focusMin, 180);
  assert.equal(s.shortBreakMin, 1);
  assert.equal(s.longBreakEvery, 2);
});

test('rounds fractional minutes', () => {
  assert.equal(sanitizeSettings({ focusMin: 24.6 }).focusMin, 25);
});

test('drops invalid enum values to defaults', () => {
  const s = sanitizeSettings({ theme: 'neon', ambient: 'whalesong' });
  assert.equal(s.theme, 'dark');
  assert.equal(s.ambient, 'off');
});

test('coerces non-boolean toggles to defaults', () => {
  const s = sanitizeSettings({ sound: 'yes', autoStartFocus: 1 });
  assert.equal(s.sound, DEFAULT_SETTINGS.sound);
  assert.equal(s.autoStartFocus, DEFAULT_SETTINGS.autoStartFocus);
});

test('ambient volume clamped 0..1', () => {
  assert.equal(sanitizeSettings({ ambientVolume: 7 }).ambientVolume, 1);
  assert.equal(sanitizeSettings({ ambientVolume: -1 }).ambientVolume, 0);
});

test('partial merge keeps untouched defaults', () => {
  const s = sanitizeSettings({ focusMin: 50 });
  assert.equal(s.focusMin, 50);
  assert.equal(s.longBreakMin, DEFAULT_SETTINGS.longBreakMin);
});
