#!/usr/bin/env node
/**
 * scripts/validate.js — release gate:
 *   1. manifest parses + required fields/icons exist with correct dimensions
 *   2. every service-worker precache entry exists on disk
 *   3. every module specifier used by the app resolves to a real file
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const APP = join(ROOT, 'app');
let failures = 0;
const fail = (msg) => { failures++; console.error(`✗ ${msg}`); };
const ok = (msg) => console.log(`✓ ${msg}`);

// --- PNG IHDR dimensions (pure, no deps) ---
function pngSize(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// --- 1. manifest ---
let manifest;
try {
  manifest = JSON.parse(readFileSync(join(APP, 'manifest.webmanifest'), 'utf8'));
  ok('manifest parses as JSON');
} catch (e) {
  fail(`manifest.webmanifest invalid: ${e.message}`);
  manifest = null;
}

if (manifest) {
  for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) {
    if (!manifest[key]) fail(`manifest missing required field: ${key}`);
  }
  for (const icon of manifest.icons ?? []) {
    const path = join(APP, normalize(icon.src));
    if (!existsSync(path)) { fail(`manifest icon missing on disk: ${icon.src}`); continue; }
    const [w, h] = icon.sizes.split('x').map(Number);
    const actual = pngSize(path);
    if (!actual || actual.w !== w || actual.h !== h) {
      fail(`icon ${icon.src} declares ${icon.sizes} but is ${actual ? `${actual.w}x${actual.h}` : 'not a PNG'}`);
    } else {
      ok(`icon ${icon.src} is ${icon.sizes}`);
    }
  }
}

// --- 2. service worker precache ---
const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
const precacheBlock = sw.match(/PRECACHE\s*=\s*\[([\s\S]*?)\]/);
if (!precacheBlock) {
  fail('could not find PRECACHE list in sw.js');
} else {
  const entries = [...precacheBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const entry of entries) {
    const rel = entry === './' ? './index.html' : entry;
    const path = join(APP, normalize(rel));
    if (!existsSync(path) || !statSync(path).isFile()) fail(`precache entry missing: ${entry}`);
  }
  if (failures === 0) ok(`all ${entries.length} precache entries exist`);
}

// --- 3. module resolution sweep ---
function sweepImports(file) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const target = join(dirname(file), normalize(spec));
    if (!existsSync(target)) fail(`${file.replace(ROOT, '')} imports missing module: ${spec}`);
  }
}
const jsFiles = [
  'js/core/timer.js', 'js/core/settings.js', 'js/core/tasks.js', 'js/core/stats.js',
  'js/services/storage.js', 'js/services/audio.js', 'js/services/notify.js', 'js/ui/app.js',
];
for (const rel of jsFiles) sweepImports(join(APP, rel));
ok('module import sweep complete');

// --- 4. landing page critical assets ---
for (const rel of ['landing/index.html', 'landing/assets/og-image.jpg', 'app/index.html', 'app/assets/favicon.svg']) {
  if (!existsSync(join(ROOT, rel))) fail(`missing release asset: ${rel}`);
}

if (failures) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
console.log('\n✓ release validation passed.');
