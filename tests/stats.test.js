import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession, dayKey, sessionsOnDay, totalMinutes, lastNDays, currentStreak,
} from '../app/js/core/stats.js';

const DAY = 24 * 3600 * 1000;
// Fixed "now": 2026-08-03 18:00 local-ish; we construct via Date to stay tz-safe.
const NOW = new Date(2026, 7, 3, 18, 0, 0).getTime();

function sessionDaysAgo(daysAgo, minutes = 25) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return createSession({ minutes, endedAt: d.getTime() });
}

test('createSession clamps and rounds minutes', () => {
  const s = createSession({ minutes: 25.036 });
  assert.equal(s.minutes, 25);
  assert.equal(s.mode, 'focus');
  assert.ok(s.id.startsWith('s_'));
});

test('dayKey formats YYYY-MM-DD', () => {
  assert.match(dayKey(NOW), /^2026-08-0[34]$|^2026-08-03$/);
});

test('sessionsOnDay filters to local today', () => {
  const sessions = [sessionDaysAgo(0), sessionDaysAgo(1), sessionDaysAgo(0)];
  assert.equal(sessionsOnDay(sessions, NOW).length, 2);
});

test('totalMinutes sums with rounding', () => {
  const sessions = [createSession({ minutes: 25 }), createSession({ minutes: 25.05 })];
  assert.equal(totalMinutes(sessions), 50.1);
  assert.equal(totalMinutes([]), 0);
});

test('lastNDays returns exactly n zero-filled buckets, oldest first', () => {
  const sessions = [sessionDaysAgo(0), sessionDaysAgo(2, 50)];
  const buckets = lastNDays(sessions, 14, NOW);
  assert.equal(buckets.length, 14);
  assert.equal(buckets[13].sessions, 1);
  assert.equal(buckets[11].minutes, 50);
  assert.equal(buckets[0].minutes, 0);
  assert.ok(buckets[13].date > buckets[0].date);
});

test('currentStreak counts consecutive days incl. today', () => {
  const sessions = [sessionDaysAgo(0), sessionDaysAgo(1), sessionDaysAgo(2), sessionDaysAgo(4)];
  assert.equal(currentStreak(sessions, NOW), 3);
});

test('currentStreak starts from yesterday when today has none (grace)', () => {
  const sessions = [sessionDaysAgo(1), sessionDaysAgo(2)];
  assert.equal(currentStreak(sessions, NOW), 2);
});

test('currentStreak is 0 for empty / broken streaks', () => {
  assert.equal(currentStreak([], NOW), 0);
  const sessions = [sessionDaysAgo(3)];
  assert.equal(currentStreak(sessions, NOW), 0);
});
