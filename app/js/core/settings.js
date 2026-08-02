/**
 * core/settings.js — defaults + sanitization (pure).
 * Every persisted value passes through sanitizeSettings() so corrupt or
 * hostile localStorage data can never crash the app.
 */

export const DEFAULT_SETTINGS = Object.freeze({
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  sound: true,
  ambient: 'off',        // 'off' | 'brown'
  ambientVolume: 0.4,    // 0..1
  theme: 'dark',         // 'dark' | 'light' | 'auto'
  taskIdCounter: 0,
});

const LIMITS = Object.freeze({
  focusMin: [1, 180],
  shortBreakMin: [1, 60],
  longBreakMin: [1, 90],
  longBreakEvery: [2, 12],
});

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (Number.isFinite(+v) ? +v : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/** Merge partial user settings over defaults and clamp to safe ranges. */
export function sanitizeSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS, ...(typeof raw === 'object' && raw !== null ? raw : {}) };
  for (const key of Object.keys(LIMITS)) {
    s[key] = clamp(Math.round(num(s[key], DEFAULT_SETTINGS[key])), LIMITS[key]);
  }
  s.autoStartBreaks = bool(s.autoStartBreaks, DEFAULT_SETTINGS.autoStartBreaks);
  s.autoStartFocus = bool(s.autoStartFocus, DEFAULT_SETTINGS.autoStartFocus);
  s.sound = bool(s.sound, DEFAULT_SETTINGS.sound);
  s.ambient = oneOf(s.ambient, ['off', 'brown'], DEFAULT_SETTINGS.ambient);
  s.ambientVolume = Math.min(1, Math.max(0, num(s.ambientVolume, DEFAULT_SETTINGS.ambientVolume)));
  s.theme = oneOf(s.theme, ['dark', 'light', 'auto'], DEFAULT_SETTINGS.theme);
  s.taskIdCounter = Math.max(0, Math.round(num(s.taskIdCounter, 0)));
  return s;
}
