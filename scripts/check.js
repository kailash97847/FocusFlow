#!/usr/bin/env node
/**
 * scripts/check.js — zero-dependency "lint": runs `node --check` (syntax +
 * module resolution-independent parse) over every JS file in the project.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (entry.endsWith('.js') || entry.endsWith('.mjs')) yield full;
  }
}

let failed = 0;
const files = [...walk(ROOT)];
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(`✗ ${file}\n${err.stderr?.toString() ?? err.message}`);
  }
}

if (failed) {
  console.error(`\n${failed}/${files.length} files failed syntax check.`);
  process.exit(1);
}
console.log(`✓ syntax check passed for ${files.length} JS files.`);
