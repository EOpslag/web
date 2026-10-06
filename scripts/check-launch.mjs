#!/usr/bin/env node
/**
 * Launch-readiness gate. Run after `yarn build` against ./dist.
 *
 *   node scripts/check-launch.mjs            # local: unfilled placeholders are warnings
 *   node scripts/check-launch.mjs --strict   # CI / deploy: unfilled placeholders FAIL the build
 *
 * Always fails on: third-party hosts this site must not call, missing CSP, unresolved template tokens.
 * Fails (strict) / warns (local) on: owner-supplied placeholders such as [[KVK-NUMMER]].
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const strict = process.argv.includes('--strict');
const TEXT_EXT = new Set(['.html', '.js', '.css', '.txt', '.xml', '.json', '.svg']);

const FORBIDDEN_HOSTS = [
  'magicpath.ai', // original image host the generator used
  'unpkg.com', // Leaflet used to be loaded from here, without SRI
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'transparenttextures.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
];
const TEMPLATE_TOKENS = ['%COMPONENT_NAME%', '%INJECTED_', '%SITE_URL%'];
// Owner-supplied blanks, e.g. [[KVK-NUMMER]] or "KvK [XXXXXXXX]".
const PLACEHOLDER_PATTERNS = [/\[\[[A-Z][A-Z0-9\- :,.()'"/]{3,}/g, /XXXXXXXX/g];

const walk = dir =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

let files;
try {
  files = walk(DIST);
} catch {
  console.error('✖ dist/ not found — run `yarn build` first.');
  process.exit(1);
}

const errors = [];
const warnings = [];
const placeholderHits = [];

for (const file of files.filter(f => TEXT_EXT.has(extname(f)))) {
  const rel = relative(DIST, file);
  const text = readFileSync(file, 'utf8');
  for (const host of FORBIDDEN_HOSTS) {
    if (text.includes(host)) errors.push(`${rel}: references forbidden host "${host}"`);
  }
  for (const token of TEMPLATE_TOKENS) {
    if (text.includes(token)) errors.push(`${rel}: unresolved template token "${token}"`);
  }
  for (const pattern of PLACEHOLDER_PATTERNS) {
    for (const match of text.matchAll(pattern)) placeholderHits.push(`${rel}: ${match[0].trim()}…`);
  }
}

let indexHtml = '';
try {
  indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
} catch {
  errors.push('index.html missing from dist/');
}
if (indexHtml) {
  if (!/http-equiv="Content-Security-Policy"/.test(indexHtml)) errors.push('index.html: Content-Security-Policy meta tag missing');
  if (/<script[^>]*src="https?:\/\//.test(indexHtml)) errors.push('index.html: external <script src> found');
  if (!/<link rel="canonical" href="https:\/\/[^"]+\/"/.test(indexHtml)) errors.push('index.html: canonical URL missing or not https');
  if (!/<html lang="nl"/.test(indexHtml)) errors.push('index.html: lang="nl" missing');
}
for (const required of ['robots.txt', 'sitemap.xml', '404.html', '.nojekyll', 'privacybeleid.html', 'favicon.svg', 'og-image.jpg']) {
  if (!files.some(f => relative(DIST, f) === required)) errors.push(`dist/${required} missing`);
}

(strict ? errors : warnings).push(...placeholderHits.map(h => `unfilled placeholder → ${h}`));

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
if (errors.length) {
  console.error(`\nLaunch gate FAILED (${errors.length} problem${errors.length === 1 ? '' : 's'}).`);
  process.exit(1);
}
console.log(`✔ Launch gate passed${warnings.length ? ` with ${warnings.length} warning(s) — run with --strict before going live` : ''}.`);
