# FocusFlow 🍅

> **Deep work, distilled.** A free, private, offline Pomodoro PWA with task-linked focus sessions, streak analytics and ambient sound. No account, no ads, no tracking.

<p>
  <img alt="Tests" src="https://img.shields.io/badge/tests-45%2F45%20passing-14b8a6">
  <img alt="Dependencies" src="https://img.shields.io/badge/runtime%20dependencies-0-6366f1">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-8b5cf6">
</p>

## Quick start

```bash
npm run verify   # syntax check + unit tests + release gate  (Node 18+, zero deps)
npm run serve    # → app at http://localhost:4173/app/
                 # → landing at http://localhost:4173/landing/
```

No `npm install` needed — the project has **zero runtime and zero dev dependencies**.

## Features

- **Throttle-proof timer** — timestamp-based engine stays accurate through background tabs, screen locks and laptop sleep; survives page reloads mid-session
- **Task-linked Pomodoros** — queue with estimates, active-task tracking, completed-tomato counters
- **Momentum analytics** — today's minutes, 🔥 streaks, 14-day chart, recent sessions
- **Ambient brown noise + chimes** — synthesized on-device with WebAudio (no audio files)
- **Offline PWA** — installable, service-worker precached shell, app shortcuts
- **Local-first data** — everything in `localStorage`, JSON export/import, one-click erase

## Architecture

Clean layered design — dependencies point inward; the domain core is pure and 100% unit-tested.

```
app/js/
├── core/        timer engine · tasks · stats · settings   (pure, deterministic)
├── services/    storage · audio · notify                  (side-effect adapters)
└── ui/          app.js                                    (DOM controller)

tests/           node:test suites for every core module + storage
scripts/         check (lint) · serve · validate (release gate) · make_icons.py
docs/            market research · PRD · deployment guide
landing/         marketing site (SEO/OG/JSON-LD optimized)
```

### Why vanilla ES modules?
A single-purpose PWA doesn't need a framework. No build step means ~62 KB of
auditable JS, sub-second loads, trivial hosting, zero supply-chain risk — and
tests that run on any Node 18+ runtime in ~300 ms.

## Native Android app (Capacitor)

```bash
npm ci && npx cap sync android
cd android && ./gradlew assembleDebug bundleRelease
```

Artifacts: `android/app/build/outputs/apk/debug/app-debug.apk` and
`android/app/build/outputs/bundle/release/app-release.aab`.
The entire web app ships **inside** the binary — fully offline on-device, with
exact-alarm phase notifications bridged to native LocalNotifications.
See [android/README.md](android/README.md) for signing, icons, splash and CI
(emulator launch test runs on every push).

## DevOps

```bash
docker build -t focusflow . && docker run -p 8080:80 focusflow
```

See [docs/06-deployment.md](docs/06-deployment.md) for Netlify/Pages/Vercel/Docker recipes, perf budget, and the release checklist. CI (`.github/workflows/ci.yml`) runs lint + tests + release gate + image build on every push.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Start / pause |
| `R` | Reset |
| `S` | Skip to next phase |

## Docs

- [01 · Market research](docs/01-market-research.md)
- [02 · PRD & architecture](docs/02-prd.md)
- [06 · Deployment guide](docs/06-deployment.md)
- [PROJECT_REPORT.md](PROJECT_REPORT.md) — full delivery report

MIT © 2026 FocusFlow
