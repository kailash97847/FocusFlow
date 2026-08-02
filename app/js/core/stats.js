/**
 * core/stats.js — focus session analytics (pure, DOM-free).
 * A "session" is one completed focus interval:
 *   { id, taskId, minutes, endedAt (ms epoch), mode: 'focus' }
 */

/** Local calendar day key YYYY-MM-DD (uses caller's timezone). */
export function dayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createSession({ taskId = null, minutes, endedAt = Date.now() }) {
  return {
    id: `s_${endedAt.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    taskId,
    minutes: Math.max(0, Math.round(minutes * 10) / 10),
    endedAt,
    mode: 'focus',
  };
}

/** Sessions that occurred "today" (local time). */
export function sessionsOnDay(sessions, ts = Date.now()) {
  const key = dayKey(ts);
  return sessions.filter((s) => dayKey(s.endedAt) === key);
}

export function totalMinutes(sessions) {
  return Math.round(sessions.reduce((sum, s) => sum + (s.minutes || 0), 0) * 10) / 10;
}

/**
 * Last N local days (oldest → newest) with focus minutes & session counts.
 * Always returns exactly `n` buckets, zero-filled — chart-ready.
 */
export function lastNDays(sessions, n = 14, now = Date.now()) {
  const byDay = new Map();
  for (const s of sessions) {
    const k = dayKey(s.endedAt);
    const agg = byDay.get(k) ?? { minutes: 0, sessions: 0 };
    agg.minutes += s.minutes || 0;
    agg.sessions += 1;
    byDay.set(k, agg);
  }
  const out = [];
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() - i);
    const k = dayKey(d.getTime());
    const agg = byDay.get(k) ?? { minutes: 0, sessions: 0 };
    out.push({ date: k, minutes: Math.round(agg.minutes * 10) / 10, sessions: agg.sessions });
  }
  return out;
}

/**
 * Current streak: consecutive local days ending today (or yesterday, so a
 * new day hasn't broken it yet) with ≥1 focus session.
 */
export function currentStreak(sessions, now = Date.now()) {
  if (!sessions.length) return 0;
  const activeDays = new Set(sessions.map((s) => dayKey(s.endedAt)));
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  // If today has no session yet, start counting from yesterday.
  if (!activeDays.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (activeDays.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
