# Phase 6 — Deployment & Performance Guide

**Status:** ✅ Complete · **Target:** static hosting or Docker, HTTPS required for installability

---

## 1. What ships

The release artifact is **pure static files** — no build step, no runtime dependencies:

```
app/        → the PWA (serve at /app/)
landing/    → marketing site (serve at /landing/, index of /)
```

## 2. Option A — Zero-config static hosts (recommended)

| Host | Steps | Notes |
|---|---|---|
| **Netlify** | Drag-and-drop the repo root in the dashboard; done | Auto-HTTPS; `_redirects` not needed (no SPA routing) |
| **GitHub Pages** | Settings → Pages → serve from `main` root | Free HTTPS; URLs `user.github.io/repo/app/` |
| **Cloudflare Pages** | Connect repo, framework preset "None", output dir `/` | Global CDN, instant |
| **Vercel** | Import repo, framework "Other", no build command | `vercel.json` not required |

## 3. Option B — Self-host with Docker

```bash
docker build -t focusflow .
docker run -d -p 8080:80 --name focusflow focusflow
# or
docker compose up -d
```

Then terminate TLS in front (Caddy one-liner):
```
focusflow.example.com {
  reverse_proxy localhost:8080
}
```

## 4. Local verification

```bash
npm run verify     # syntax check + 45 unit tests + release gate
npm run serve      # http://localhost:4173/app/  and  /landing/
```

## 5. Performance budget & optimizations (already applied)

| Technique | Where | Effect |
|---|---|---|
| Zero-dependency ES modules | entire app | ~62 KB total JS uncompressed; no framework tax; sub-second LCP on 3G |
| No build step | — | assets cached as immutable files; instant deploys |
| Precached app shell | `sw.js` | repeat visits fully offline, ~0ms startup from cache |
| WebAudio-synthesized sound | `services/audio.js` | zero audio bytes shipped |
| SVG + resized PNG icons | `assets/` | 512px icon ≈ 90 KB; favicon.svg ≈ 1 KB |
| Gzip + cache headers | `nginx.conf` | static text ~70% smaller on the wire |
| Timestamp-based ticking | `core/timer.js` | renders only on 250ms cadence; cheap DOM writes |
| `prefers-reduced-motion` + system color scheme | `styles.css` | battery & a11y friendly |

**Budget guardrails for future work:** total JS < 150 KB gzip; no CDN JS; images ≤ 200 KB each; Lighthouse ≥ 95 across the board.

## 6. Release checklist

- [ ] `npm run verify` green
- [ ] Bump `CACHE_VERSION` in `app/sw.js` (rolls caches on install)
- [ ] Bump version in `package.json` + `docker-compose.yml` tag
- [ ] Deploy; open site once; hard-refresh; confirm offline mode in DevTools (Network → Offline → reload)
- [ ] Confirm "Install FocusFlow" prompt appears (HTTPS + manifest)
- [ ] Submit landing URL to Google Search Console

## 7. Rollback

Static site → redeploy previous commit. Docker → `docker run focusflow:<previous-tag>`. SW cache rolls automatically with `CACHE_VERSION`.
