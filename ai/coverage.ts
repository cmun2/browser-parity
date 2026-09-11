#!/usr/bin/env node --experimental-strip-types
//
// How much of the measured corpora does the deterministic matcher explain
// without a model?
//
// That fraction is the architecture decision. If it is high, the model is an
// optional investigator for the tail and the project can promise a useful tool
// with no key at all. If it is low, the model is load-bearing and BYOK becomes
// a dependency dressed up as an option.
//
//   node --experimental-strip-types ai/coverage.ts
//   node --experimental-strip-types ai/coverage.ts --json out.json
//   node --experimental-strip-types ai/coverage.ts --rules
//   node --experimental-strip-types ai/coverage.ts --uncovered
//
// Reads only. Never writes inside m0/.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Corpus, buildEvidence, rootCauseKey } from './evidence.ts';
import type { SurvivorFinding } from './evidence.ts';
import { RULES, matchKnownCause } from './known-causes.ts';
import type { Rule, RuleMatch } from './known-causes.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const arg = (n: string, d: string | null = null) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? (process.argv[i + 1] ?? '') : d;
};
const has = (n: string) => process.argv.includes(n);

// ---------------------------------------------------------------- corpora
//
// A: the 30-page hand-authored corpus, 475 survivors, all 475 labelled.
// B: the 10-page model-emitted validation corpus, 106 survivors, unlabelled.
//
// B lives on branch m0-validation-model-emitted. When its working tree is not
// checked out, fall back to reading the committed file straight out of git —
// the matcher must be measurable against both corpora from either branch, and
// copying study data into ai/ would fork the evidence.

interface CorpusSpec { name: string; root: string; labels?: string; origin: string; survivorsFile?: string; evidenceDir?: string }

// The re-collection with `maxWidth` included (ai/recollect.mjs). Used when
// present; m0/results/evidence is the fallback. Geometry is identical between
// the two to 0.0000px and the funnel counts are byte-identical, so this only
// ever adds a property — but which set was read is printed, because a coverage
// number that does not say what evidence it was computed from is not a number.
const V2 = path.join(REPO, 'ai', '.evidence-v2');
const v2For = (name: string) => {
  const d = path.join(V2, name);
  return fs.existsSync(d) ? d : undefined;
};

const SPECS: CorpusSpec[] = [
  { name: 'A · 30-page hand-authored', root: path.join(REPO, 'm0'), labels: path.join(REPO, 'm0/results/labels.jsonl'), origin: 'hand-authored', evidenceDir: v2For('m0') },
  { name: 'B · 10-page model-emitted', root: path.join(REPO, 'm0/validation'), origin: 'model-emitted', evidenceDir: v2For('validation') },
];

const VALIDATION_REF = 'm0-validation-model-emitted:m0/validation/results/survivors.json';

/**
 * Locate a corpus's survivors.json. If the working tree does not have it,
 * read the committed copy out of the validation branch into ai/.corpus-cache/
 * (gitignored). Nothing is ever written inside m0/.
 */
function survivorsFileFor(spec: CorpusSpec): string | null {
  const inTree = path.join(spec.root, 'results', 'survivors.json');
  if (fs.existsSync(inTree)) return inTree;
  const cached = path.join(REPO, 'ai', '.corpus-cache', 'validation-survivors.json');
  if (fs.existsSync(cached)) return cached;
  try {
    const buf = execFileSync('git', ['show', VALIDATION_REF], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.writeFileSync(cached, buf);
    return cached;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- labels

interface Label { findingId: string; label: string; defectClass?: string }

function readLabels(file: string | undefined): Map<string, Label> {
  const out = new Map<string, Label>();
  if (!file || !fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r: any;
    try { r = JSON.parse(line); } catch { continue; }
    if (r.synthetic) continue;
    if (r.undo) out.delete(r.findingId); else out.set(r.findingId, r);
  }
  return out;
}

// ---------------------------------------------------------------- measure

interface PerRule { findings: number; units: number; genuine: number; expected: number }
interface Uncovered { id: string; tag: string; display: string; props: string; label: string; styleDiffs: string }

interface CorpusResult {
  name: string;
  origin: string;
  hasDumps: boolean;
  evidenceDir: string;
  findings: number;
  rootCauseUnits: number;
  covered: number;
  coveredUnits: number;
  coverage: number;
  unitCoverage: number;
  labelled: number;
  genuine: number;
  genuineCovered: number;
  genuineCoverage: number | null;
  byRule: Record<string, PerRule>;
  byConfidence: Record<string, number>;
  verdictAgreement: { agree: number; disagree: number; abstained: number; rate: number | null };
  uncovered: Uncovered[];
}

interface MeasureOpts { rules?: Rule[] }

function measure(spec: CorpusSpec, opts: MeasureOpts = {}): CorpusResult | null {
  const rules = opts.rules ?? RULES;
  const match = (ev: any) => {
    for (const r of rules) { const m = r.match(ev); if (m) return m; }
    return null;
  };
  const survivorsFile = survivorsFileFor(spec);
  if (!survivorsFile) return null;
  const corpus = new Corpus({ root: spec.root, name: spec.name, survivorsFile, evidenceDir: spec.evidenceDir });
  const labels = readLabels(spec.labels);
  const findings = corpus.findings();

  const byRule: Record<string, PerRule> = {};
  const byConfidence: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const coveredUnitKeys = new Set<string>();
  const allUnitKeys = new Set<string>();
  const uncovered: Uncovered[] = [];
  let covered = 0;
  let genuine = 0;
  let genuineCovered = 0;
  let agree = 0;
  let disagree = 0;
  let abstained = 0;

  for (const f of findings) {
    const key = rootCauseKey(f);
    allUnitKeys.add(key);
    const ev = buildEvidence(corpus, f as SurvivorFinding);
    const m: RuleMatch | null = match(ev);
    const lab = labels.get(f.id);
    const isGenuine = lab?.label === 'genuine';
    if (isGenuine) genuine++;

    if (m) {
      covered++;
      coveredUnitKeys.add(key);
      byConfidence[m.confidence]++;
      const r = (byRule[m.ruleId] ??= { findings: 0, units: 0, genuine: 0, expected: 0 });
      r.findings++;
      if (lab) (isGenuine ? r.genuine++ : r.expected++);
      if (isGenuine) genuineCovered++;
      if (lab) {
        // The matcher's verdict vs. the owner's judgement. Only 'defect' vs
        // 'expected-engine-difference' is comparable; 'unclear' abstains.
        if (m.verdict === 'unclear') abstained++;
        else if ((m.verdict === 'defect') === isGenuine) agree++;
        else disagree++;
      }
    } else {
      uncovered.push({
        id: f.id, tag: f.tag, display: f.display,
        props: f.properties.map((p) => `${p.prop} Δ${p.deltaPx}`).join(' '),
        label: lab ? (isGenuine ? `genuine/${lab.defectClass}` : lab.label) : '—',
        styleDiffs: Object.keys(ev.styleDiffs).join(','),
      });
    }
  }

  // Root-cause units per rule (a rule that explains 173 symptoms of one cause
  // has not explained 173 things).
  const unitRule = new Map<string, string>();
  for (const f of findings) {
    const ev = buildEvidence(corpus, f as SurvivorFinding);
    const m = match(ev);
    if (m) unitRule.set(rootCauseKey(f) + '|' + m.ruleId, m.ruleId);
  }
  for (const [, ruleId] of unitRule) byRule[ruleId]!.units++;

  return {
    name: spec.name,
    origin: spec.origin,
    hasDumps: corpus.hasDumps,
    evidenceDir: path.relative(REPO, corpus.evidenceDir) + (spec.evidenceDir ? '  (re-collected, includes maxWidth)' : '  (original M0 collection)'),
    findings: findings.length,
    rootCauseUnits: allUnitKeys.size,
    covered,
    coveredUnits: coveredUnitKeys.size,
    coverage: findings.length ? covered / findings.length : 0,
    unitCoverage: allUnitKeys.size ? coveredUnitKeys.size / allUnitKeys.size : 0,
    labelled: labels.size,
    genuine,
    genuineCovered,
    genuineCoverage: genuine ? genuineCovered / genuine : null,
    byRule,
    byConfidence,
    verdictAgreement: { agree, disagree, abstained, rate: agree + disagree ? agree / (agree + disagree) : null },
    uncovered,
  };
}

// ---------------------------------------------------------------- output

const pct = (x: number | null) => (x == null ? '—' : (100 * x).toFixed(1) + '%');

if (has('--rules')) {
  console.log('\nknown-cause rules, in match order\n');
  for (const r of RULES) console.log(`  ${r.id.padEnd(30)} ${r.what}`);
  console.log('\nFirst match wins. Specific mechanisms precede general ones.\n');
  process.exit(0);
}

const results = SPECS.map(measure).filter((r): r is CorpusResult => r != null);

console.log('\n' + '='.repeat(78));
console.log('KNOWN-CAUSE MATCHER COVERAGE   (no model, no network, no key)');
console.log('='.repeat(78));

for (const r of results) {
  console.log(`\n${r.name}   [${r.origin}]${r.hasDumps ? '' : '   ** no per-page evidence dump on disk: ancestor-dependent rules degraded **'}`);
  console.log(`  evidence                  ${r.evidenceDir}`);
  console.log(`  survivors                 ${String(r.findings).padStart(6)}`);
  console.log(`  explained by the matcher  ${String(r.covered).padStart(6)}   ${pct(r.coverage)}`);
  console.log(`  root-cause units          ${String(r.rootCauseUnits).padStart(6)}`);
  console.log(`  units explained           ${String(r.coveredUnits).padStart(6)}   ${pct(r.unitCoverage)}`);
  if (r.labelled) {
    console.log(`  owner-labelled genuine    ${String(r.genuine).padStart(6)}`);
    console.log(`  of those, explained       ${String(r.genuineCovered).padStart(6)}   ${pct(r.genuineCoverage)}`);
    console.log(`  verdict agrees with owner ${String(r.verdictAgreement.agree).padStart(6)} / ${r.verdictAgreement.agree + r.verdictAgreement.disagree}   ${pct(r.verdictAgreement.rate)}`);
    console.log(`  verdict abstained        ${String(r.verdictAgreement.abstained).padStart(7)}   ${pct(r.verdictAgreement.abstained / r.labelled)}  (mechanism known, defect/expected left to the human)`);
  }
  console.log(`  confidence                high ${r.byConfidence.high} · medium ${r.byConfidence.medium} · low ${r.byConfidence.low}`);
  console.log('\n  rule                             findings   units' + (r.labelled ? '   genuine  expected' : ''));
  const rows = Object.entries(r.byRule).sort((a, b) => b[1].findings - a[1].findings);
  for (const [id, v] of rows) {
    console.log(`    ${id.padEnd(30)} ${String(v.findings).padStart(6)}  ${String(v.units).padStart(6)}` +
      (r.labelled ? `  ${String(v.genuine).padStart(8)}  ${String(v.expected).padStart(8)}` : ''));
  }
  if (r.uncovered.length) {
    console.log(`\n  unexplained: ${r.uncovered.length}`);
    if (has('--uncovered')) {
      for (const u of r.uncovered) {
        console.log(`    ${u.id.padEnd(30)} ${u.tag.padEnd(8)} ${u.display.padEnd(12)} ${u.label.padEnd(20)} ${u.props}  [${u.styleDiffs}]`);
      }
    }
  }
}

// ---------------------------------------------------------------- holdout
//
// The headline figure above is in-sample: every rule was written while looking
// at one of these two corpora. The number worth acting on is this one — the
// A-derived rules, alone, against a corpus written by a different author (a
// real coding agent) that they were not built from.

interface Holdout { from: 'A' | 'B'; to: string; rules: number; result: CorpusResult | null }

const holdouts: Holdout[] = [];
for (const [from, toIdx] of [['A', 1], ['B', 0]] as Array<['A' | 'B', number]>) {
  const subset = RULES.filter((r) => r.derivedFrom.includes(from));
  const spec = SPECS[toIdx];
  holdouts.push({ from, to: spec.name, rules: subset.length, result: measure(spec, { rules: subset }) });
}

console.log('\n' + '='.repeat(78));
console.log('OUT OF SAMPLE   rules derived from one corpus, measured on the other');
console.log('='.repeat(78));
for (const h of holdouts) {
  if (!h.result) continue;
  console.log(`\n  ${h.rules} rule${h.rules === 1 ? '' : 's'} derived from corpus ${h.from}  ->  ${h.to}`);
  console.log(`    survivors explained   ${String(h.result.covered).padStart(5)} / ${h.result.findings}   ${pct(h.result.coverage)}`);
  console.log(`    units explained       ${String(h.result.coveredUnits).padStart(5)} / ${h.result.rootCauseUnits}   ${pct(h.result.unitCoverage)}`);
  const rows = Object.entries(h.result.byRule).sort((a, b) => b[1].findings - a[1].findings);
  console.log('      ' + rows.map(([id, v]) => `${id} ${v.findings}`).join(' · '));
}
console.log('\n  The A -> B figure is the one to quote. A 100% in-sample score on corpora the');
console.log('  rules were mined from is a property of the mining, not of the matcher.\n');

const totF = results.reduce((a, r) => a + r.findings, 0);
const totC = results.reduce((a, r) => a + r.covered, 0);
const totU = results.reduce((a, r) => a + r.rootCauseUnits, 0);
const totCU = results.reduce((a, r) => a + r.coveredUnits, 0);

console.log('\n' + '='.repeat(78));
console.log(`BOTH CORPORA   ${totC} / ${totF} survivors explained deterministically   ${pct(totC / totF)}`);
console.log(`               ${totCU} / ${totU} root-cause units explained              ${pct(totCU / totU)}`);
console.log('='.repeat(78));
console.log('\nThe remainder is what an optional model investigator would be for.\n');

const out = arg('--json');
if (out) {
  fs.writeFileSync(path.resolve(out), JSON.stringify({
    schema: 'browser-parity/known-cause-coverage/1',
    measuredAt: new Date().toISOString(),
    rules: RULES.map((r) => ({ id: r.id, what: r.what })),
    corpora: results,
    holdout: holdouts.map((h) => ({
      derivedFrom: h.from, measuredOn: h.to, rules: h.rules,
      coverage: h.result?.coverage ?? null, unitCoverage: h.result?.unitCoverage ?? null,
      covered: h.result?.covered ?? null, findings: h.result?.findings ?? null,
    })),
    combined: {
      findings: totF, covered: totC, coverage: totC / totF,
      rootCauseUnits: totU, coveredUnits: totCU, unitCoverage: totCU / totU,
    },
  }, null, 2) + '\n');
  console.log(`wrote ${out}`);
}
