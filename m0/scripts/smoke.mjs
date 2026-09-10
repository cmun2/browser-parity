#!/usr/bin/env node
// Pre-freeze corpus sanity check. Deliberately SINGLE-ENGINE (Chromium only).
//
// This runs before the corpus is frozen, and it must never look at cross-engine
// agreement — otherwise "fixing" a page here would be selecting the corpus on
// the outcome being measured. It checks only that each page is a real page and
// that it renders the same way twice.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { settle, collectFromPage, VIEWPORT } from '../../scripts/funnel.mjs';
import { resolveSet } from './paths.mjs';

// `--set <dir>` picks the corpus (see paths.mjs); the check itself is identical
// for every set, and stays single-engine for every set.
const SET = resolveSet();
const ROOT = SET.root;
const PAGES = SET.pagesDir;
const SHOTDIR = path.join(SET.resultsDir, 'smoke');
const files = fs.readdirSync(PAGES).filter(f => f.endsWith('.html')).sort();
const shots = process.argv.includes('--screenshots');
if (shots) fs.mkdirSync(SHOTDIR, { recursive: true });

// Every utility class a page references must exist in util.css (or in that
// page's own <style> block). A missing one renders silently wrong — the first
// draft of the corpus had 40, which made every `w-3 h-3` icon balloon to fill
// its card. Checked mechanically so it is never a matter of eyeballing.
// A corpus of self-contained single-file pages has no shared stylesheet, in
// which case every class must be defined in the page's own <style> block — the
// same check with an empty shared vocabulary.
const UTILPATH = path.join(SET.assetsDir, 'util.css');
const UTIL = fs.existsSync(UTILPATH) ? fs.readFileSync(UTILPATH, 'utf8') : '';
const DEFINED = new Set([...UTIL.matchAll(/\.([a-zA-Z0-9_\\.-]+)/g)].map(m => m[1].replace(/\\/g, '')));
function undefinedClasses(src) {
  const style = (src.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
  const local = new Set([...style.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]));
  const out = new Set();
  for (const m of src.matchAll(/class="([^"]*)"/g))
    for (const c of m[1].trim().split(/\s+/))
      if (c && !DEFINED.has(c) && !local.has(c)) out.add(c);
  return [...out];
}

const FORBIDDEN = [/Math\.random/, /new Date\(/, /Date\.now/, /setInterval/, /setTimeout/, /requestAnimationFrame/, /https?:\/\//];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.message).slice(0, 120)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 120)); });

let fail = 0;
const rows = [];
for (const f of files) {
  errors.length = 0;
  const src = fs.readFileSync(path.join(PAGES, f), 'utf8');
  const banned = FORBIDDEN.filter(re => re.test(src)).map(re => String(re));
  const url = pathToFileURL(path.join(PAGES, f)).href;

  await settle(page, url);
  const a = await collectFromPage(page);
  const dims = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  if (shots) await page.screenshot({ path: path.join(SHOTDIR, f.replace('.html', '.png')), fullPage: true });

  // Same engine, same page, twice: any difference is the page, not the engines.
  await page.goto('about:blank');
  await settle(page, url);
  const b = await collectFromPage(page);
  const ka = Object.keys(a), kb = Object.keys(b);
  let selfDiff = 0;
  if (ka.length !== kb.length) selfDiff = Infinity;
  else for (const k of ka) {
    if (!b[k]) { selfDiff = Infinity; break; }
    selfDiff = Math.max(selfDiff, Math.abs(a[k].w - b[k].w), Math.abs(a[k].h - b[k].h),
      Math.abs(a[k].rx - b[k].rx), Math.abs(a[k].ry - b[k].ry));
  }

  const problems = [];
  // 35 is a "is this a real page or a blank/broken one" floor, not a quality bar.
  // A waitlist page and a split sign-up page legitimately render ~40-55 elements.
  if (ka.length < 35) problems.push(`only ${ka.length} rendered elements`);
  if (dims.h < 500) problems.push(`page only ${dims.h}px tall`);
  if (dims.w > dims.cw + 1) problems.push(`horizontal overflow (${dims.w} > ${dims.cw})`);
  if (selfDiff > 0.01) problems.push(`NONDETERMINISTIC: self-diff ${selfDiff === Infinity ? 'node set changed' : selfDiff.toFixed(2) + 'px'}`);
  if (banned.length) problems.push(`forbidden source pattern ${banned.join(',')}`);
  const undef = undefinedClasses(src);
  if (undef.length) problems.push(`${undef.length} undefined utility class(es): ${undef.slice(0, 6).join(' ')}`);
  if (errors.length) problems.push(`page errors: ${errors.slice(0, 2).join(' | ')}`);
  if (problems.length) fail++;

  rows.push({ file: f, nodes: ka.length, h: dims.h, selfDiff, problems });
  console.log(`${problems.length ? 'FAIL' : ' ok '}  ${f.padEnd(30)} ${String(ka.length).padStart(4)} nodes  ${String(dims.h).padStart(6)}px tall${problems.length ? '\n        ' + problems.join('\n        ') : ''}`);
}
await browser.close();

const nodes = rows.map(r => r.nodes).sort((a, b) => a - b);
console.log(`\n${rows.length} pages · nodes min ${nodes[0]} / median ${nodes[Math.floor(nodes.length / 2)]} / max ${nodes[nodes.length - 1]}`);
if (shots) console.log(`screenshots: ${SET.rel}/results/smoke/ (review these before freezing)`);
if (fail) { console.error(`\n${fail} page(s) failed the sanity check. Fix them BEFORE freezing.`); process.exit(1); }
console.log(`\nall pages sane. next: node m0/scripts/freeze.mjs${SET.isDefault ? '' : ' --set ' + path.basename(ROOT)}`);
