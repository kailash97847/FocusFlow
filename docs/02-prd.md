# Phase 2 — Product Design: FocusFlow PRD

**Version:** 1.0 · **Date:** 2026-08-03 · **Status:** ✅ Approved by acting CPO

---

## 1. Product Overview

**Name:** FocusFlow · **Tagline:** *Deep work, distilled.*
A local-first Progressive Web App combining a Pomodoro timer, a task queue, focus analytics, and ambient sound. No accounts, no servers, no ads.

## 2. Goals & Success Metrics

| Goal | Metric | v1 Target |
|---|---|---|
| Instant start | LCP → timer clickable | < 1.5s on 3G; time-to-first-timer < 5s |
| Retention | Day-7 returning users | ≥ 25% of installers |
| Reliability | Timer accuracy after 8h sleep/throttle | drift < 1s |
| Engagement | Focus sessions per active user / week | ≥ 10 |
| Quality | Lighthouse PWA/Perf/A11y/Best-Practices | ≥ 95 each |

## 3. Scope

### 3.1 MVP (v1.0) — MUST
- **Timer engine:** Focus / Short Break / Long Break; configurable durations; long-break every N cycles; auto-start options; pause/resume/reset/skip; throttle- and sleep-proof (timestamp-based).
- **Task queue:** add, complete, delete, reorder, set active; estimated vs. completed Pomodoros per task.
- **Session logging:** every completed focus interval recorded with task link, duration, timestamp.
- **Analytics:** today's minutes, current streak, 14-day bar chart, recent sessions.
- **Sound:** completion chime + optional brown-noise ambient loop (WebAudio, no assets).
- **Notifications:** phase-end browser notification (permission-gated, graceful fallback).
- **Persistence:** localStorage, versioned schema, JSON export/import, factory reset.
- **PWA:** installable, offline via service worker, app icons, shortcuts.
- **Settings:** durations, cycle length, auto-start toggles, sound, theme (dark/light/auto).

### 3.2 v1.1+ — SHOULD (documented, not built)
- Keyboard shortcut overlay, weekly summary, per-task reports.
### 3.3 Out of scope — WON'T (v1)
- Accounts/cloud sync, teams, calendar integration, mobile native shells, monetization.

## 4. User Flows

**F1 — First-run instant start:** Open app → timer preset 25:00, sample hint → press **Space**/tap Start → chime at end → prompt break. *No dialogs, no signup.*

**F2 — Task-linked session:** Add "Write intro chapter" (est 4 🍅) → set active → Start focus → each completed 🍅 increments task progress → after 4th focus, long break auto-proposed.

**F3 — Interrupted session:** pause → answer call → resume (timestamps keep accuracy) → OR reset/skip.

**F4 — Laptop sleeps mid-session:** OS sleeps at 12:00 remaining → wakes 20 min later → engine recomputes from `endsAt` → phase already flipped to break with notification queued. **Zero data loss on reload** (state persisted every change).

**F5 — Review & streak:** Stats tab → today's minutes, 🔥 streak, 14-day chart, recent sessions.

**F6 — Data control:** Settings → Export JSON (backup) / Import (restore/migrate to new device) / Reset.

**F7 — Install & offline:** Chrome/Safari/Edge "Install"/A2HS → launch offline from dock → full functionality.

## 5. Feature Prioritization (MoSCoW + RICE)

| Feature | Reach/wk | Impact | Effort | RICE | Priority |
|---|---|---|---|---|---|
| Throttle-proof timer | 100% | High | M | ★★★★★ | P0 |
| Task-linked pomodoros | 80% | High | M | ★★★★☆ | P0 |
| Streaks + 14-day chart | 70% | High | S | ★★★★★ | P0 |
| Offline PWA | 60% | High | S | ★★★★★ | P0 |
| Chime + brown noise | 50% | Med | S | ★★★★ | P0 |
| Notifications | 55% | Med | XS | ★★★★ | P0 |
| Export/Import | 15% | Med | XS | ★★★ | P1 (cheap, trust-building) → in MVP |
| Themes | 30% | Low | XS | ★★★ | P1 → in MVP |

## 6. Architecture

**Stack decision (senior eng. call):** **Zero-dependency, bundleless ES modules (vanilla JS + HTML + CSS), Node 20 built-in test runner (`node --test`).** Rationale: a timer PWA has zero need for framework weight; no build step = instant LCP, trivial hosting, immutable cacheability, no supply-chain risk, and tests run anywhere Node runs. Scales to ~10k LOC comfortably; a framework can be introduced later without touching `core/`.

**Clean layered architecture (dependency rule: inner layers never import outer):**

```
┌──────────────────────────────────────────────────────────┐
│ ui/           DOM controllers, rendering, events          │  (browser only)
├──────────────────────────────────────────────────────────┤
│ services/     storage · audio · notify  (side effects,    │  (injectable)
│               behind ports; DOM-free where testable)      │
├──────────────────────────────────────────────────────────┤
│ core/         timer engine · tasks · stats · settings     │  (pure, 100% unit-tested)
└──────────────────────────────────────────────────────────┘
```

**Timer engine design (the crown jewel):** countdown expressed as `endsAt = now + duration`; `tick(now)` derives remaining each call ⇒ setInterval drift, background-tab throttling, and OS sleep cannot corrupt it. State machine: `idle → running ⇄ paused → (phaseEnd) → idle/running(next mode)`. Emits events; the UI layer subscribes. All logic pure with injected clock → deterministic tests.

**Persistence:** single JSON document `focusflow.v1` with `migrate()` hook; write-through on every mutation (throttled via microtask batching).

## 7. UX / Design System (feeds Phase 4)

- **Visual identity:** "calm gradient depth" — dark glass surfaces, indigo→violet focus ring, mode-coded accents (focus `#6366F1`, short break `#14B8A6`, long break `#F59E0B`).
- **Type:** system stack (SF/Segoe/Inter/Roboto), tabular numerals for the clock.
- **Motion:** ring progress eased, card hover lifts, mode-change crossfade; `prefers-reduced-motion` honored.
- **A11y targets:** WCAG 2.2 AA — `role="timer"`, aria-live announcements, full keyboard operability (Space/R/S), focus-visible rings, ≥4.5:1 contrast.
- **Responsive:** mobile-first; single column → 3-pane layout ≥ 1024px.

## 8. Risks (product)

- *User never grants notifications* → in-app visual + audio cue always present; notifications strictly progressive enhancement.
- *localStorage eviction on iOS (7-day ITP for webviews)* → export encouraged; documented.
- *Ring-based time display ambiguous* → always paired with exact mm:ss digits.

## 9. Acceptance Criteria (for Phase 5 QA)

1. Start/pause/resume/reset/skip behave per state machine; drift < 1s over simulated 8h.
2. Completed focus → session recorded → stats update; 4th focus → long break.
3. Reload mid-session restores exact remaining time.
4. All unit tests pass; `node --check` clean on every file; validator green.
5. App loads offline after first visit (service worker), installable manifest verified.
