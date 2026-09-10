#!/usr/bin/env node
// Compare two measured corpora side by side.
//
//   node m0/scripts/compare.mjs --a . --b validation
//
// Everything here is derived from survivors.json, which is objective: raw
// findings, survivors, funnel stages, tag / element-family / property
// distributions, and which engine sits apart from the other two. None of it
// requires a label.
//
// If a set has labels.jsonl it also reports the label counts, so the same
// command answers the question again once the owner has judged the second
// corpus. Until then the defect rate for that set is simply absent — an
// unlabelled survivor is not a defect and is not counted as one.
import fs from 'node:fs';
import path from 'node:path';
import { M0 } from './paths.mjs';

const E = ['chromium', 'firefox', 'webkit'];
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const A = arg('--a', '.'), B = arg('--b', 'validation');
const OUT = arg('--out', null);

// Element families. The M0 labelling pass found half its defects on tables and
// a third on form controls; this is the same cut, applied mechanically so the
// two corpora are bucketed identically.
const FAMILY = (tag) =>
  ['TD', 'TH', 'TR', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'COL', 'COLGROUP', 'CAPTION'].includes(tag) ? 'table'
  : ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL', 'LEGEND', 'FIELDSET', 'OPTION', 'OPTGROUP'].includes(tag) ? 'form-control'
  : 'other';

// Which engine is the odd one out for a finding: the engine whose value on the
// largest-delta property is furthest from BOTH others. Ties go to the first
// engine examined, which is why this is reported as a distribution and not as a
// per-finding verdict.
function odd(f) {
  const top = f.properties?.[0];
  if (!top) return null;
  let best = null, bd = -1;
  for (const e of E) {
    const o = E.filter(x => x !== e);
    const d = Math.min(...o.map(x => Math.abs(top.values[e] - top.values[x])));
    if (d > bd) { bd = d; best = e; }
  }
  return best;
}

function readLabels(dir) {
  const f = path.join(dir, 'labels.jsonl');
  if (!fs.existsSync(f)) return null;
  const out = {};
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.synthetic) continue;
    if (r.undo) delete out[r.findingId]; else out[r.findingId] = r;
  }
  return out;
}

// Root-cause grouping, identical to label.mjs — reported so the reviewing cost
// of a set is visible next to its survivor count.
function unitCount(items) {
  const key = (f) => `${f.page}|${f.tag}|` + ['width', 'height', 'offset-x', 'offset-y']
    .map(p => { const q = (f.properties || []).find(x => x.prop === p); return q ? Math.round(q.deltaPx * 4) / 4 : 0; }).join('/');
  return new Set(items.map(key)).size;
}

function summarize(setDir, label, onlyPages) {
  const S = JSON.parse(fs.readFileSync(path.join(setDir, 'results/survivors.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(setDir, 'corpus/manifest.json'), 'utf8'));
  const labels = readLabels(path.join(setDir, 'results'));
  let pages = S.pages;
  if (onlyPages) pages = pages.filter(p => onlyPages.includes(p.id));
  const finds = pages.flatMap(p => p.findings);
  const per = pages.map(p => p.survivorCount).sort((a, b) => a - b);
  const median = per.length % 2 ? per[(per.length - 1) / 2] : (per[per.length / 2 - 1] + per[per.length / 2]) / 2;
  const bump = (o, k) => (o[k] = (o[k] || 0) + 1, o);
  const tag = {}, prop = {}, family = { table: 0, 'form-control': 0, other: 0 }, engine = { chromium: 0, firefox: 0, webkit: 0 }, kind = {};
  const stages = {};
  for (const p of pages) for (const [k, v] of Object.entries(p.stageCounts)) stages[k] = (stages[k] || 0) + v;
  for (const f of finds) {
    bump(tag, f.tag); family[FAMILY(f.tag)]++;
    for (const q of f.properties) bump(prop, q.prop);
    const o = odd(f); if (o) engine[o]++;
  }
  for (const p of pages) kind[p.kind] = (kind[p.kind] || 0) + 1;
  const raw = stages.raw || 0;
  const labelled = labels ? finds.filter(f => labels[f.id]) : [];
  const genuine = labels ? finds.filter(f => labels[f.id]?.label === 'genuine') : [];
  const pagesWithDefect = labels ? pages.filter(p => p.findings.some(f => labels[f.id]?.label === 'genuine')).length : null;
  return {
    label,
    corpus: { version: manifest.corpusVersion, hash: manifest.corpusHash, origin: manifest.provenance?.origin ?? 'unknown' },
    pages: pages.length, kindMix: kind,
    matchedNodes: pages.reduce((a, p) => a + p.matchedAllThree, 0),
    rawFindings: raw,
    survivors: finds.length,
    suppressionRatio: raw ? +(1 - finds.length / raw).toFixed(4) : null,
    rawPerMatchedNode: +(raw / pages.reduce((a, p) => a + p.matchedAllThree, 0)).toFixed(4),
    survivorsPerPage: { median, max: per[per.length - 1] ?? 0, all: per },
    pagesWithSurvivors: pages.filter(p => p.survivorCount > 0).length,
    rootCauseUnits: unitCount(finds),
    funnelStages: stages,
    nondeterministicPages: pages.filter(p => !p.selfConsistent).map(p => p.id),
    elementFamily: family,
    tagDistribution: Object.fromEntries(Object.entries(tag).sort((a, b) => b[1] - a[1])),
    propertyDistribution: prop,
    oddEngineOut: engine,
    labelling: labels
      ? { labelled: labelled.length, genuine: genuine.length, pagesWithGenuineDefect: pagesWithDefect,
          defectRatePerPage: +(pagesWithDefect / pages.length).toFixed(4) }
      : { labelled: 0, note: 'NOT LABELLED — no labels.jsonl for this set. Survivor counts above are objective; there is no defect rate for this corpus yet.' },
  };
}

const aDir = path.resolve(M0, A), bDir = path.resolve(M0, B);
const bSpecs = fs.existsSync(path.join(bDir, 'specs.mjs'))
  ? await import(new URL('file://' + path.join(bDir, 'specs.mjs')).href) : {};

// Paired subsets. Each page in B may name the page in A implementing the same
// brief; where it does, both sets can be cut to exactly those briefs, which is
// the only comparison that holds the brief mix constant.
const pairs = (bSpecs.SPECS || []).filter(s => s.pairedWith).map(s => [s.id, s.pairedWith]);
const bPaired = pairs.map(p => p[0]), aPaired = pairs.map(p => p[1]);
// The unweighted subset is pinned in B's specs.mjs before the run.
const bUnweighted = bSpecs.UNWEIGHTED_SUBSET || null;
const aUnweighted = bUnweighted ? bUnweighted.map(id => pairs.find(p => p[0] === id)?.[1]).filter(Boolean) : null;

const report = {
  schema: 'browser-parity/corpus-comparison/1',
  comparedAt: new Date().toISOString(),
  question: 'Does the M0 incidence result survive on model-emitted pages, or was it an artifact of a hand-authored corpus?',
  sets: { a: path.relative(path.resolve(M0, '..'), aDir), b: path.relative(path.resolve(M0, '..'), bDir) },
  full: { a: summarize(aDir, 'A · full'), b: summarize(bDir, 'B · full') },
  paired: pairs.length ? {
    note: 'Same briefs on both sides — the like-for-like comparison. Holds the brief mix constant, so any difference is authorship (plus stylesheet delivery; see the B corpus limitations).',
    briefs: pairs.map(([b, a]) => ({ b, a })),
    a: summarize(aDir, 'A · paired', aPaired), b: summarize(bDir, 'B · paired', bPaired),
  } : null,
  unweighted: bUnweighted ? {
    note: 'One page per category, pinned in B/specs.mjs before the run, so neither side is tilted toward the categories where M0 found its defects.',
    a: summarize(aDir, 'A · unweighted', aUnweighted), b: summarize(bDir, 'B · unweighted', bUnweighted),
  } : null,
};

if (OUT) { fs.writeFileSync(path.resolve(OUT), JSON.stringify(report, null, 2) + '\n'); console.log(`wrote ${OUT}`); }

const pct = (x) => x == null ? '—' : (100 * x).toFixed(1) + '%';
function row(name, a, b, f = (x) => x) { console.log('  ' + name.padEnd(26) + String(f(a)).padStart(12) + String(f(b)).padStart(12)); }
for (const [title, blk] of [['FULL SETS', report.full], ['SAME BRIEFS (paired)', report.paired], ['ONE PER CATEGORY', report.unweighted]]) {
  if (!blk) continue;
  console.log(`\n${'='.repeat(52)}\n${title}\n${'='.repeat(52)}`);
  console.log('  ' + ''.padEnd(26) + `${blk.a.corpus.origin}`.padStart(12) + `${blk.b.corpus.origin}`.padStart(12));
  row('pages', blk.a.pages, blk.b.pages);
  row('matched nodes', blk.a.matchedNodes, blk.b.matchedNodes);
  row('raw findings', blk.a.rawFindings, blk.b.rawFindings);
  row('raw / matched node', blk.a.rawPerMatchedNode, blk.b.rawPerMatchedNode, pct);
  row('survivors', blk.a.survivors, blk.b.survivors);
  row('suppression', blk.a.suppressionRatio, blk.b.suppressionRatio, pct);
  row('survivors/page median', blk.a.survivorsPerPage.median, blk.b.survivorsPerPage.median);
  row('survivors/page max', blk.a.survivorsPerPage.max, blk.b.survivorsPerPage.max);
  row('pages with >=1 survivor', `${blk.a.pagesWithSurvivors}/${blk.a.pages}`, `${blk.b.pagesWithSurvivors}/${blk.b.pages}`);
  row('root-cause units', blk.a.rootCauseUnits, blk.b.rootCauseUnits);
  row('survivors on tables', pct(blk.a.elementFamily.table / blk.a.survivors), pct(blk.b.elementFamily.table / blk.b.survivors));
  row('survivors on form ctrl', pct(blk.a.elementFamily['form-control'] / blk.a.survivors), pct(blk.b.elementFamily['form-control'] / blk.b.survivors));
  const w = (s) => pct(((s.propertyDistribution.width || 0) + (s.propertyDistribution['offset-x'] || 0)) / Object.values(s.propertyDistribution).reduce((x, y) => x + y, 0));
  row('width + offset-x share', w(blk.a), w(blk.b));
  for (const e of E) row(`odd engine out · ${e}`, pct(blk.a.oddEngineOut[e] / blk.a.survivors), pct(blk.b.oddEngineOut[e] / blk.b.survivors));
  row('genuine defects', blk.a.labelling.genuine ?? '—', blk.b.labelling.genuine ?? 'unlabelled');
  row('pages with a defect', blk.a.labelling.pagesWithGenuineDefect != null ? `${blk.a.labelling.pagesWithGenuineDefect}/${blk.a.pages}` : '—',
      blk.b.labelling.pagesWithGenuineDefect != null ? `${blk.b.labelling.pagesWithGenuineDefect}/${blk.b.pages}` : 'unlabelled');
}
console.log(`\nB is ${report.full.b.labelling.labelled ? 'labelled' : 'NOT labelled'} — until it is, B has survivor counts but no defect rate.`);
