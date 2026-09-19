// The tolerance model, tested without launching a browser.
//
// Two layers:
//   1. test/fixtures/*.json — three corpus pages committed verbatim, so a fresh
//      clone can run these with no browser and no corpus run.
//   2. m0/results/evidence/*.json — all 30 pages, gitignored and regenerable
//      with `npm run m0`. When present, the full M0 totals are re-derived and
//      asserted; when absent those tests skip rather than fail.
//
// A regression in the suppression rules therefore shows up as a failing test
// rather than as a published number that quietly moved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computeDeltas, funnel, RULES, E } from '../scripts/funnel.mjs';

const HERE = import.meta.dirname;
const FIXTURES = path.join(HERE, 'fixtures');
const EVIDENCE = path.join(HERE, '..', 'm0', 'results', 'evidence');

const jsonIn = dir => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
const load = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const fixtures = jsonIn(FIXTURES);
const evidence = jsonIn(EVIDENCE);
const hasCorpus = evidence.length === 30;

// ---------------------------------------------------------------- always run
test('fixtures are present and have all three engines', () => {
  assert.ok(fixtures.length >= 3, 'at least three pages are committed');
  for (const f of fixtures) {
    const { data } = load(FIXTURES, f);
    for (const e of E) assert.ok(Object.keys(data[e] ?? {}).length > 0, `${f}: ${e} empty`);
  }
});

test('the four rules are the published four, in order', () => {
  assert.deepEqual(RULES.map(r => r.id),
    ['raw', 'svg-interior', 'inline-text', 'tolerance', 'inherited-delta']);
});

test('every rule only ever removes elements', () => {
  for (const f of fixtures) {
    const { common, delta } = computeDeltas(load(FIXTURES, f).data);
    let prev = common.length;
    for (const st of funnel(common, delta).stages) {
      assert.ok(st.count <= prev, `${f}: ${st.id} grew ${prev} -> ${st.count}`);
      prev = st.count;
    }
  }
});

test('correspondence only keeps elements all three engines have', () => {
  for (const f of fixtures) {
    const { data } = load(FIXTURES, f);
    for (const k of computeDeltas(data).common)
      for (const e of E) assert.ok(data[e][k], `${f}: ${k} missing in ${e}`);
  }
});

test('a page compared against itself yields nothing', () => {
  const { data } = load(FIXTURES, fixtures[0]);
  const self = { chromium: data.chromium, firefox: data.chromium, webkit: data.chromium };
  const { common, delta } = computeDeltas(self);
  assert.ok(common.length > 0);
  assert.equal(funnel(common, delta).survivors.length, 0, 'identical engines must agree');
});

test('tolerance scales with box size, not just the 2px floor', () => {
  const rule = RULES.find(r => r.id === 'tolerance');
  const at = (w, h, rel) => rule.keep('k', { rel, size: 0, m: { w, h } });
  assert.equal(at(50, 50, 1.5), false, 'under the 2px floor on a small box');
  assert.equal(at(50, 50, 2.5), true, 'over the 2px floor on a small box');
  assert.equal(at(1000, 100, 5), false, '5px is under 1% of a 1000px box');
  assert.equal(at(1000, 100, 12), true, '12px is over 1% of a 1000px box');
});

test('suppression is reproducible: same input, same survivors', () => {
  for (const f of fixtures) {
    const { data } = load(FIXTURES, f);
    const a = computeDeltas(data), b = computeDeltas(data);
    assert.deepEqual(funnel(a.common, a.delta).survivors,
                     funnel(b.common, b.delta).survivors, `${f} is not deterministic`);
  }
});

// ------------------------------------------- only with the full corpus present
test('the M0 totals re-derive from the corpus', { skip: hasCorpus ? false :
  'm0/results/evidence absent — run `npm run m0` to check the published totals' }, () => {
  let raw = 0, survivors = 0; const perPage = [];
  for (const f of evidence) {
    const { common, delta } = computeDeltas(load(EVIDENCE, f).data);
    const { stages, survivors: s } = funnel(common, delta);
    raw += stages[0].count; survivors += s.length; perPage.push(s.length);
  }
  assert.equal(raw, 1722, 'raw finding total moved');
  assert.equal(survivors, 475, 'survivor total moved');
  const s = [...perPage].sort((a, b) => a - b);
  const median = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  assert.equal(median, 4, 'median survivors/page moved');
});
