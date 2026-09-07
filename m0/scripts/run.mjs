#!/usr/bin/env node
// M0 runner: takes the frozen corpus through the existing pipeline and emits the
// survivors, plus the per-element screenshot crops the labelling pass needs.
//
// The pipeline itself is imported from scripts/funnel.mjs — the same collection
// snippet and the same four suppression rules that produced the published
// 638->19 / 611->5 / 74->0 numbers. This file adds no detection logic of its own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LAUNCHERS, E, VIEWPORT, settle, collectFromPage, computeDeltas, funnel, RULES } from '../../scripts/funnel.mjs';
import { verifyCorpus } from './verify-corpus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = path.join(ROOT, 'results');
const SHOTS = path.join(RESULTS, 'shots');
const EVIDENCE = path.join(RESULTS, 'evidence');
// Crop geometry for the labelling evidence. MIN* guarantees surrounding context
// (a 20px-tall <legend> cropped to 20px+padding is unjudgeable); MAX* keeps the
// images small enough to flick through.
const PAD = 24, MAXW = 900, MAXH = 640, MINW = 380, MINH = 260;
const SHOTS_ONLY = process.argv.includes('--shots-only');

const manifest = verifyCorpus(ROOT);
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(EVIDENCE, { recursive: true });

const t0 = Date.now();
const browsers = {}, pages = {}, engineVersions = {};
for (const [n, l] of Object.entries(LAUNCHERS)) {
  browsers[n] = await l.launch();
  engineVersions[n] = browsers[n].version();
  const ctx = await browsers[n].newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  pages[n] = await ctx.newPage();
}
console.log(`engines: ${E.map(e => `${e} ${engineVersions[e]}`).join(' · ')}`);

// Environment stamp. Two runs that disagree must be distinguishable from two
// engines that disagree (ARCHITECTURE R2).
const fontFingerprint = await pages.chromium.evaluate(() => {
  const probe = (f) => { const c = document.createElement('canvas').getContext('2d'); c.font = `16px ${f}`; return c.measureText('The quick brown fox 0123456789').width.toFixed(3); };
  return ['system-ui', 'sans-serif', 'serif', 'monospace', 'Helvetica', 'Arial', 'Georgia', 'Inter'].map(f => `${f}=${probe(f)}`).join(' ');
});

let perPage = [];
if (SHOTS_ONLY) {
  // Re-render the crops from an existing survivors.json. Used when the crop
  // presentation changes; it cannot change a single measured number.
  const prev = JSON.parse(fs.readFileSync(path.join(RESULTS, 'survivors.json'), 'utf8'));
  if (prev.corpusHash !== manifest.corpusHash) { console.error('survivors.json is from a different corpus.'); process.exit(1); }
  perPage = prev.pages;
  console.log(`--shots-only: re-rendering crops for ${perPage.reduce((a, p) => a + p.findings.length, 0)} findings`);
}
for (const p of SHOTS_ONLY ? [] : manifest.pages) {
  const url = pathToFileURL(path.join(ROOT, p.file)).href;
  const data = {};
  for (const e of E) { await settle(pages[e], url); data[e] = await collectFromPage(pages[e]); }

  // Same engine, same page, twice. A page that disagrees with itself makes every
  // cross-engine finding on it uninterpretable, so it is recorded, not hidden.
  await pages.chromium.goto('about:blank');
  await settle(pages.chromium, url);
  const again = await collectFromPage(pages.chromium);
  let selfDelta = 0;
  const ka = Object.keys(data.chromium);
  if (ka.length !== Object.keys(again).length) selfDelta = Infinity;
  else for (const k of ka) {
    if (!again[k]) { selfDelta = Infinity; break; }
    selfDelta = Math.max(selfDelta, Math.abs(data.chromium[k].w - again[k].w), Math.abs(data.chromium[k].h - again[k].h),
      Math.abs(data.chromium[k].rx - again[k].rx), Math.abs(data.chromium[k].ry - again[k].ry));
  }

  const { common, delta } = computeDeltas(data);
  const { stages, survivors } = funnel(common, delta);
  const counts = Object.fromEntries(stages.map(s => [s.id, s.count]));
  const nodesPerEngine = Object.fromEntries(E.map(e => [e, Object.keys(data[e]).length]));
  const unmatched = Object.fromEntries(E.map(e => [e, Object.keys(data[e]).filter(k => !(k in delta)).length]));

  const findings = survivors
    .sort((a, b) => Math.max(delta[b].rel, delta[b].size) - Math.max(delta[a].rel, delta[a].size))
    .map((k, i) => {
      const x = delta[k];
      const per = Object.fromEntries(E.map(e => [e, { w: data[e][k].w, h: data[e][k].h, rx: data[e][k].rx, ry: data[e][k].ry, ax: data[e][k].ax, ay: data[e][k].ay }]));
      const props = [['width', x.dw], ['height', x.dh], ['offset-x', x.dx], ['offset-y', x.dy]]
        .filter(([, d]) => d > 0.5).sort((a, b) => b[1] - a[1])
        .map(([prop, d]) => ({ prop, deltaPx: +d.toFixed(2), values: Object.fromEntries(E.map(e => [e, per[e][{ width: 'w', height: 'h', 'offset-x': 'rx', 'offset-y': 'ry' }[prop]]])) }));
      const styleDiffs = {};
      for (const sk of Object.keys(data.chromium[k].styles || {})) {
        const v = E.map(e => (data[e][k].styles || {})[sk]);
        if (new Set(v).size > 1) styleDiffs[sk] = Object.fromEntries(E.map((e, j) => [e, v[j]]));
      }
      return {
        id: `${p.id}#${i + 1}`, page: p.id, path: k,
        selector: data.chromium[k].sel || '', tag: data.chromium[k].tag,
        display: data.chromium[k].disp, text: data.chromium[k].text,
        maxDeltaPx: +Math.max(x.rel, x.size).toFixed(2),
        properties: props, geometry: per, styleDiffs,
        // filename only; the labelling server resolves it inside results/shots/
        shots: Object.fromEntries(E.map(e => [e, `${p.id}_${i + 1}.${e}.png`])),
      };
    });

  fs.writeFileSync(path.join(EVIDENCE, p.id + '.json'), JSON.stringify({ page: p.id, url, data }, null, 0));
  perPage.push({
    id: p.id, kind: p.kind, sha256: p.sha256, nodesPerEngine, matchedAllThree: common.length,
    unmatchedPerEngine: unmatched, stageCounts: counts, survivorCount: findings.length,
    selfConsistent: selfDelta <= 0.01, selfDeltaPx: selfDelta === Infinity ? null : +selfDelta.toFixed(2),
    findings,
  });
  console.log(`  ${p.id.padEnd(30)} matched ${String(common.length).padStart(4)}  raw ${String(counts.raw).padStart(4)} -> survivors ${String(findings.length).padStart(3)}${selfDelta > 0.01 ? '   ** NONDETERMINISTIC **' : ''}`);
}
const collectMs = Date.now() - t0;

// ---- element crops for the labelling pass -------------------------------
// Each engine is cropped to its OWN element rect, but all three crops share the
// same pixel dimensions, so the element sits at the same offset in each and a
// size difference is visible as a difference rather than as a reframing.
const t1 = Date.now();
let shotCount = 0;
for (const pg of perPage) {
  if (!pg.findings.length) continue;
  const url = pathToFileURL(path.join(ROOT, 'corpus/pages', pg.id + '.html')).href;
  for (const e of E) {
    await settle(pages[e], url);
    const full = await pages[e].evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    for (const f of pg.findings) {
      const g = f.geometry[e], all = E.map(x => f.geometry[x]);
      const cw = Math.min(MAXW, Math.max(MINW, Math.max(...all.map(a => a.w)) + PAD * 2));
      const ch = Math.min(MAXH, Math.max(MINH, Math.max(...all.map(a => a.h)) + PAD * 2));
      // Centre the element in the crop box so all three engines frame it the same way.
      const x = Math.max(0, Math.min(g.ax - (cw - Math.min(cw, g.w)) / 2, Math.max(0, full.w - cw)));
      const y = Math.max(0, Math.min(g.ay - (ch - Math.min(ch, g.h)) / 2, Math.max(0, full.h - ch)));
      const clip = { x, y, width: Math.max(8, Math.min(cw, full.w - x)), height: Math.max(8, Math.min(ch, full.h - y)) };
      const out = path.join(SHOTS, f.shots[e]);
      // Outline the element under review. An absolutely-positioned overlay appended
      // to <body> does not reflow anything, and geometry was already collected.
      await pages[e].evaluate(([bx, by, bw, bh]) => {
        const d = document.createElement('div');
        d.id = '__bp_hl';
        d.style.cssText = `position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;` +
          'outline:2px solid #e11d48;outline-offset:1px;box-shadow:0 0 0 9999px rgba(225,29,72,.06);' +
          'pointer-events:none;z-index:2147483647';
        document.body.appendChild(d);
      }, [g.ax, g.ay, g.w, g.h]);
      try { await pages[e].screenshot({ path: out, fullPage: true, clip }); shotCount++; }
      catch (err) { console.error(`  !! shot ${f.id} ${e}: ${String(err.message).slice(0, 70)}`); }
      await pages[e].evaluate(() => document.getElementById('__bp_hl')?.remove());
    }
  }
}
for (const b of Object.values(browsers)) await b.close();
const shotMs = Date.now() - t1;

const totals = perPage.map(p => p.survivorCount).sort((a, b) => a - b);
const median = totals.length % 2 ? totals[(totals.length - 1) / 2] : (totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2;
const out = {
  schema: 'browser-parity/m0-survivors/1',
  corpusVersion: manifest.corpusVersion, corpusHash: manifest.corpusHash,
  ranAt: new Date().toISOString(),
  environment: {
    playwrightVersion: JSON.parse(fs.readFileSync(path.resolve(ROOT, '../node_modules/playwright/package.json'), 'utf8')).version,
    engineVersions, os: `${process.platform} ${process.arch}`, node: process.version,
    viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce', fontFingerprint,
    normalizationPreset: 'none (pages measured exactly as generated)',
  },
  suppressionRules: RULES.map(r => ({ id: r.id, label: r.label })),
  totals: {
    pages: perPage.length,
    rawFindings: perPage.reduce((a, p) => a + p.stageCounts.raw, 0),
    survivors: perPage.reduce((a, p) => a + p.survivorCount, 0),
    medianSurvivorsPerPage: median,
    maxSurvivorsPerPage: totals[totals.length - 1],
    pagesWithZeroSurvivors: perPage.filter(p => !p.survivorCount).length,
    nondeterministicPages: perPage.filter(p => !p.selfConsistent).map(p => p.id),
  },
  timingMs: { collect: collectMs, screenshots: shotMs },
  pages: perPage,
};
if (SHOTS_ONLY) {
  console.log(`\n--shots-only: ${shotCount} crops re-rendered in ${(shotMs / 1000).toFixed(0)}s. survivors.json untouched.`);
  process.exit(0);
}
fs.writeFileSync(path.join(RESULTS, 'survivors.json'), JSON.stringify(out, null, 2) + '\n');

console.log(`\nraw ${out.totals.rawFindings} -> survivors ${out.totals.survivors} across ${out.totals.pages} pages`);
console.log(`survivors/page: median ${median}, max ${out.totals.maxSurvivorsPerPage}, ${out.totals.pagesWithZeroSurvivors} pages at zero`);
if (out.totals.nondeterministicPages.length) console.log(`NONDETERMINISTIC pages: ${out.totals.nondeterministicPages.join(', ')}`);
console.log(`${shotCount} crops -> m0/results/shots/`);
console.log(`collect ${(collectMs / 1000).toFixed(0)}s · screenshots ${(shotMs / 1000).toFixed(0)}s`);
console.log('\nnext: node m0/scripts/label.mjs');
