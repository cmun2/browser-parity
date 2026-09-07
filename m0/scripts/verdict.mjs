#!/usr/bin/env node
// Compute m0/results/incidence-v0.1.json — the study's output.
//
// The decision rule is fixed here in code, ahead of the labels, so the verdict
// is a function of the data rather than of how the data reads on the day.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCorpus } from './verify-corpus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = path.join(ROOT, 'results');
const manifest = verifyCorpus(ROOT, { quiet: true });

const S = JSON.parse(fs.readFileSync(path.join(RESULTS, 'survivors.json'), 'utf8'));
if (S.corpusHash !== manifest.corpusHash) {
  console.error(`survivors.json was produced against corpus ${S.corpusHash.slice(0, 12)} but the corpus is now ${manifest.corpusHash.slice(0, 12)}. Re-run m0/scripts/run.mjs.`);
  process.exit(1);
}

// Labels. Synthetic demo entries are structurally excluded: they live in a
// different file, and any that leak into the real one are a hard error.
const LABELS = path.join(RESULTS, 'labels.jsonl');
const labels = {};
let synthetic = 0;
if (fs.existsSync(LABELS)) {
  for (const line of fs.readFileSync(LABELS, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.synthetic) { synthetic++; continue; }
    if (r.undo) delete labels[r.findingId]; else labels[r.findingId] = r;
  }
}
if (synthetic) { console.error(`labels.jsonl contains ${synthetic} synthetic record(s). Refusing — demo labels belong in labels.demo.jsonl.`); process.exit(1); }

const findings = S.pages.flatMap(p => p.findings);
const unlabelled = findings.filter(f => !labels[f.id]);
const skipped = findings.filter(f => labels[f.id]?.label === 'skip');

// ---- Wilson score interval. 30 pages is a small sample; the CI says so. ----
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
}
// Rule of three: with 0/n observed, the upper 95% bound on the true rate is ~3/n.
const ruleOfThree = (n) => 3 / n;

const perPage = S.pages.map(p => {
  const genuine = p.findings.filter(f => labels[f.id]?.label === 'genuine');
  return {
    id: p.id, kind: p.kind, survivors: p.survivorCount,
    rawFindings: p.stageCounts.raw, selfConsistent: p.selfConsistent,
    labelled: p.findings.filter(f => labels[f.id]).length,
    genuineDefects: genuine.length,
    genuineDefectClasses: [...new Set(genuine.map(f => labels[f.id].defectClass).filter(Boolean))],
    findingLabels: p.findings.map(f => ({
      id: f.id, tag: f.tag, path: f.path, maxDeltaPx: f.maxDeltaPx,
      label: labels[f.id]?.label ?? null, defectClass: labels[f.id]?.defectClass ?? null,
      note: labels[f.id]?.note ?? null,
    })),
  };
});

const counts = { genuine: 0, expected: 0, artifact: 0, skip: 0 };
for (const f of findings) { const l = labels[f.id]?.label; if (l) counts[l]++; }
const genuineFindings = findings.filter(f => labels[f.id]?.label === 'genuine');
const defectClasses = genuineFindings.reduce((a, f) => (a[labels[f.id].defectClass || 'unclassified'] = (a[labels[f.id].defectClass || 'unclassified'] || 0) + 1, a), {});
const pagesWithDefect = perPage.filter(p => p.genuineDefects > 0);
const n = perPage.length, k = pagesWithDefect.length;
const survPerPage = perPage.map(p => p.survivors).sort((a, b) => a - b);
const median = survPerPage.length % 2 ? survPerPage[(survPerPage.length - 1) / 2] : (survPerPage[survPerPage.length / 2 - 1] + survPerPage[survPerPage.length / 2]) / 2;
const [lo, hi] = wilson(k, n);

// ---- decision rule (ROADMAP.md M0 gate), evaluated in fixed order ----
const NON_PIVOT = new Set(['layout', 'other']);
let verdict, rationale;
if (unlabelled.length) {
  verdict = 'INCOMPLETE';
  rationale = `${unlabelled.length} of ${findings.length} survivors are unlabelled. Finish the labelling pass before reading a verdict.`;
} else if (k === 0) {
  verdict = 'KILL';
  rationale = `0 of ${n} pages produced a human-confirmed genuine defect. Engines have converged past the point where a cross-engine oracle has anything to report on this kind of page. Publish the negative result (m0/NEGATIVE-RESULT-TEMPLATE.md).`;
} else if (genuineFindings.length && !genuineFindings.some(f => NON_PIVOT.has(labels[f.id].defectClass))) {
  verdict = 'PIVOT';
  rationale = `Every genuine defect is a form-control or text-metric difference (${Object.entries(defectClasses).map(([c, v]) => `${c}:${v}`).join(', ')}). Real, but not "the agent wrote a bug" — the honest product is a cross-engine design-system linter, not a defect detector.`;
} else if (k >= 3 && median <= 5) {
  verdict = 'GO';
  rationale = `${k} of ${n} pages produced a human-confirmed genuine defect (threshold 3), at a median of ${median} survivors per page (threshold 5). Both halves of the hypothesis hold.`;
} else if (k >= 3 && median > 5) {
  verdict = 'GO-BLOCKED-ON-PRECISION';
  rationale = `Base rate clears the gate (${k}/${n} pages) but median survivors per page is ${median} > 5. Per ROADMAP.md, one more suppression-rule iteration (sibling-uniform delta collapse is already validated by experiment 02), then re-gate. Do not proceed on hope.`;
} else {
  verdict = 'INCONCLUSIVE';
  rationale = `${k} of ${n} pages produced a genuine defect — above the KILL line (0) but below the GO line (3). The pre-registered thresholds do not decide this case. A larger corpus is the only honest way to resolve it; picking either verdict from here is choosing the answer.`;
}
if (verdict !== 'INCOMPLETE' && skipped.length) {
  rationale += ` NOTE: ${skipped.length} survivor(s) were skipped as unsure; if any is in fact a genuine defect on a page that has none, k could rise to ${k + Math.min(skipped.length, perPage.filter(p => !p.genuineDefects && p.findingLabels.some(f => f.label === 'skip')).length)}.`;
}

const out = {
  schema: 'browser-parity/m0-incidence/1',
  study: 'M0 base-rate measurement — do modern engines still diverge on AI-generated frontends?',
  verdict, rationale,
  thresholds: { go: '>=3 of 30 pages with a genuine defect AND median survivors/page <=5', kill: '0 of 30 pages with a genuine defect', pivot: 'genuine defects exist but all are form-control or text-metric' },

  corpus: {
    version: manifest.corpusVersion, hash: manifest.corpusHash, frozenAt: manifest.frozenAt,
    pages: manifest.pageCount, mix: manifest.mix, provenance: manifest.provenance,
  },
  environment: S.environment,
  ranAt: S.ranAt, labelledAt: new Date().toISOString(),

  incidence: {
    pagesTotal: n,
    pagesWithGenuineDefect: k,
    defectRatePerPage: +(k / n).toFixed(4),
    confidenceInterval95: { method: k === 0 ? 'Wilson score (see also ruleOfThreeUpperBound)' : 'Wilson score', low: +lo.toFixed(4), high: +hi.toFixed(4) },
    ruleOfThreeUpperBound: k === 0 ? +ruleOfThree(n).toFixed(4) : null,
    interpretation: unlabelled.length ? `INCOMPLETE — ${unlabelled.length} of ${findings.length} survivors are still unlabelled, so every count in this block is a floor, not a result. Do not quote these numbers.`
      : k === 0
      ? `Zero defects in ${n} pages. The 95% upper bound on the true per-page defect rate is ${(ruleOfThree(n) * 100).toFixed(1)}% — this rules out a common defect, not a rare one. ${n} pages cannot distinguish "never happens" from "happens once in 15 pages".`
      : `${k}/${n} pages = ${(100 * k / n).toFixed(1)}% (95% CI ${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}%). The interval is wide because ${n} pages is a small sample; treat the point estimate as indicative, not settled.`,
    genuineDefectsTotal: genuineFindings.length,
    defectClasses,
  },

  precision: {
    rawFindingsTotal: S.totals.rawFindings,
    survivorsTotal: S.totals.survivors,
    suppressionRatio: S.totals.rawFindings ? +(1 - S.totals.survivors / S.totals.rawFindings).toFixed(4) : null,
    survivorsPerPage: { median, max: S.totals.maxSurvivorsPerPage, zeroSurvivorPages: S.totals.pagesWithZeroSurvivors, all: survPerPage },
    meetsPrecisionBound: median <= 5,
    note: 'The <=5 findings/page half of the hypothesis was already largely de-risked by experiment 02 (638->19, 611->5, 74->0 on real sites). This run re-measures it on the corpus; it is not the gating number.',
  },

  labels: { counts, unlabelled: unlabelled.length, skipped: skipped.length, syntheticExcluded: synthetic },
  suppressionRules: S.suppressionRules,
  nondeterministicPages: S.totals.nondeterministicPages,
  perPage,

  limitations: [
    "Playwright's WebKit is not Safari. It is a real WebKit layout engine, so a POSITIVE finding here is credible evidence of a genuine cross-engine divergence. But it is not Apple's shipping configuration, and iOS Safari is not covered at all — so the ABSENCE of a finding does not clear Safari, and a KILL verdict is a statement about Chromium/Gecko/Playwright-WebKit, not about the browser most teams actually worry about.",
    'The corpus is hand-authored in an AI-typical idiom, not emitted by a model. No hosted model was called (no-paid-API constraint). The 30 briefs are recorded in m0/corpus/SPECS.md so the study can be repeated against real model output; until it is, the corpus reflects one author\'s model of what AI frontends look like.',
    'All 30 pages share one base utility-CSS vocabulary and one component library. Real AI output would draw on more varied CSS. Layout variety comes from per-page stylesheets, but the shared base narrows the corpus.',
    'One machine, one OS, one font set. Font metrics and font availability are two of the three known noise classes, so results are conditioned on this environment (see environment.fontFingerprint).',
    'Pages are static and local: no network, no JS-driven layout, no hydration, no web fonts. This removes DOM-level engine divergence (correspondence failures), which is a real finding class the study therefore cannot observe.',
    'Measured with no normalization preset. Findings include the font/line-height/form-control noise classes that --normalize would suppress; that is deliberate, since it is what the tool would report on the page as written.',
    'n=30 pages. See incidence.confidenceInterval95 — the interval is wide by construction.',
  ],
};
fs.mkdirSync(RESULTS, { recursive: true });
fs.writeFileSync(path.join(RESULTS, 'incidence-v0.1.json'), JSON.stringify(out, null, 2) + '\n');

const line = '='.repeat(72);
console.log(`\n${line}\nVERDICT: ${verdict}\n${line}`);
console.log(rationale.replace(/(.{1,72})(\s|$)/g, '$1\n').trim());
console.log(`\n  genuine defects      ${genuineFindings.length} across ${k}/${n} pages${Object.keys(defectClasses).length ? `  (${Object.entries(defectClasses).map(([c, v]) => `${c}:${v}`).join(' ')})` : ''}`);
console.log(`  defect rate/page     ${(100 * k / n).toFixed(1)}%  95% CI ${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}%${k === 0 ? `  (rule of three: <=${(100 * ruleOfThree(n)).toFixed(1)}%)` : ''}`);
console.log(`  survivors/page       median ${median}, max ${S.totals.maxSurvivorsPerPage}  (bound: <=5 ${median <= 5 ? 'MET' : 'NOT MET'})`);
console.log(`  suppression          ${S.totals.rawFindings} raw -> ${S.totals.survivors} survivors`);
console.log(`  labels               ${counts.genuine} genuine · ${counts.expected} expected · ${counts.artifact} artifact · ${counts.skip} skipped · ${unlabelled.length} unlabelled`);
console.log(`\nwrote m0/results/incidence-v0.1.json`);
if (verdict === 'KILL') console.log('\nKILL -> fill in m0/NEGATIVE-RESULT-TEMPLATE.md and publish it. That is a real contribution.');
console.log('\nA finding here is credible evidence of cross-engine divergence.');
console.log('The absence of one does NOT clear Safari, and iOS is not covered at all.');
