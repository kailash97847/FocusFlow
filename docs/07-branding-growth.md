# Phase 7 — Branding & Growth

**Status:** ✅ Complete

---

## 1. Brand

- **Name:** FocusFlow — instantly communicates the two promises (focus + flow state); available-feeling, pronounceable in English/Hindi, two clean syllables.
- **Tagline:** *Deep work, distilled.*
- **Promise:** the free, private, offline deep-work companion.
- **Voice:** calm, confident, zero-hype. We never say "crush your goals"; we say "start in 5 seconds."
- **Personality:** a quiet studio, not a drill sergeant.

## 2. Visual identity

- **Logo concept (shipped):** *the Flow Ring* — a glowing indigo→violet ring drawn as overlapping sine waves closing into a circle: focus (ring) meeting flow (wave). Built as a rounded-square app icon family (`app/assets/`, maskable + Apple touch variants) and a 1 KB `favicon.svg` echo.
- **Palette:**
  - Deep navy `#0b0e1a` (canvas — night-desk calm)
  - Indigo `#6366f1` → violet `#8b5cf6` (focus gradient — primary action)
  - Teal `#14b8a6` (short break / success), Amber `#f59e0b` (long break)
  - Rose `#fb7185` (destructive only)
- **Typography:** system UI stack (SF/Segoe/Inter/Roboto) with tabular numerals for the clock — a deliberate privacy/perf choice (zero font downloads).
- **Art direction:** deep-space gradients + glass surfaces + one glowing ring motif, repeated across app icon, app UI and OG image — consistent recognition everywhere.

## 3. Landing page (shipped)

`landing/index.html` — hero with brand art, 6-card feature grid, 3-step how-it-works, comparison table vs. typical paid apps, privacy band, final CTA. Fully responsive, reduced-motion safe, self-contained CSS, links into `/app/`.

## 4. Marketing plan (first 8 weeks)

| Week | Motion |
|---|---|
| 1–2 | **Build-in-public** on X/LinkedIn: ship notes, engine deep-dive ("why web timers drift"), before/after GIFs. Collect emails? No — collect feedback in replies. |
| 2 | **Reddit seeding** (authentic, not spammy): r/productivity, r/GetStudying, r/ADHD, r/webdev — "I built a free offline pomodoro because subscriptions annoyed me", devlog comments enabled. |
| 3 | **Product Hunt launch** (Tue/Wed): tagline "Free offline Pomodoro — no sign-up, no tracking", gallery from landing assets, maker comment with the privacy story + engine reliability hook. |
| 4 | **Hacker News Show HN**: lead with the tech contrarian take ("zero-dependency PWA, 62 KB JS, throttle-proof timer"). |
| 5–6 | **SEO content** on the landing domain (`/blog`): "Pomodoro technique for exam prep", "Why your browser timer loses time (and how we fixed it)", "Brown noise vs white noise for focus" — each ending in an app CTA. |
| 7–8 | **Community loops**: answer "best pomodoro app?" threads; submit to AlternativeTo, Slant, SaaSHub, PWA directories (appagg, PWA Stats). University study Discords for exam season. |

**North-star metric:** weekly returning focus-hours per installer. Guardrail: D7 retention ≥ 25%.

## 5. SEO / ASO strategy

- **On-page (done):** keyword-rich title/description, canonical, OG/Twitter cards, `SoftwareApplication` JSON-LD with rating + free offer, semantic HTML, fast LCP.
- **Keyword targets (long-tail, low competition):** "offline pomodoro timer", "pomodoro no sign up", "private pomodoro timer", "pomodoro works when laptop sleeps", "free pomofocus alternative", "study timer with streaks", "brown noise focus timer".
- **PWA "ASO":** Chrome/Edge/Safari install surfaces read from the manifest — rich name/description, categories, screenshots are the listing; add store-style screenshots when shipping v1.1 listing pages.
- **Content moat:** the throttle-drift bug of competitor web timers is a genuinely searchable pain — own that query with a technical explainer.

## 6. Launch roadmap

```
T-2w  Freeze v1.0 (this delivery) + dogfood daily + capture screenshots/GIFs
T-1w  Landing live on focusflow domain + Search Console + preload PH page
T-0   Product Hunt + Reddit + Show HN (staggered 2 days) · monitor, fix, thank
T+1w  Ship v1.1 fast-follow fixes from PH feedback
T+2w  First SEO blog posts live
T+4w  Review metrics: installs, D7 retention, focus-hours/user → decide v1.2
      (weekly digest view? keyboard-shortcut overlay? per-task reports?)
T+8w  Optional Pro exploration (themes/multi-device e2e-sync) only if core
      retention > 30% — never paywall what v1 gives away.
```

## 7. Positioning one-liner (for every channel)

> FocusFlow is the Pomodoro timer for people who hate subscriptions and love privacy: free forever, works offline, survives your laptop sleeping — with real analytics and streaks, no account required.
