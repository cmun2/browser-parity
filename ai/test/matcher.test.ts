// Known-cause matcher: the signatures, on synthetic bundles.
//
// Synthetic on purpose. A rule that only fires on the one corpus finding it was
// written from has not been tested; it has been described. Each case here
// states a signature and asserts the rule that must claim it.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Corpus, buildEvidence, classifyDiff, oddEngineOut, relevantStyleKeys } from '../evidence.ts';
import { matchKnownCause, RULES } from '../known-causes.ts';
import type { EvidenceBundle, PropertyDivergence, Triple } from '../types.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------- fixtures

const box = (w: number, h: number, rx = 0, ry = 0) => ({ w, h, rx, ry, ax: rx, ay: ry });
const tri = <T,>(c: T, f: T, w: T): Triple<T> => ({ chromium: c, firefox: f, webkit: w });

function bundle(over: Partial<EvidenceBundle> & { properties: PropertyDivergence[] }): EvidenceBundle {
  return {
    schema: 'browser-parity/investigation-evidence/1',
    findingId: 'synthetic#1',
    page: 'synthetic',
    url: 'about:blank',
    corpus: 'synthetic',
    environment: {
      playwrightVersion: '1.63.0',
      engineVersions: tri('1', '1', '1'),
      os: 'test', viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1,
      fontFingerprint: '', normalizationPreset: 'none',
    },
    element: { path: 'BODY[1]/DIV[1]', tag: 'DIV', selector: '', display: 'block', text: 'hello' },
    geometry: tri(box(100, 20), box(100, 20), box(100, 20)),
    styles: tri({}, {}, {}),
    styleDiffs: {},
    ancestors: [],
    descendantCulprits: [],
    related: [],
    symptomCount: 1,
    oddEngineOut: oddEngineOut(over.properties),
    crops: {
      chromium: { engine: 'chromium', file: null, width: 0, height: 0, bytes: 0 },
      firefox: { engine: 'firefox', file: null, width: 0, height: 0, bytes: 0 },
      webkit: { engine: 'webkit', file: null, width: 0, height: 0, bytes: 0 },
    },
    serialisationOnly: [],
    ...over,
  } as EvidenceBundle;
}

const ancestor = (over: Partial<EvidenceBundle['ancestors'][0]> = {}) => ({
  path: 'BODY[1]', tag: 'DIV', selector: '', display: 'block', text: '', depth: 1,
  geometry: tri(box(400, 100), box(400, 100), box(400, 100)),
  styles: tri({ display: 'block' }, { display: 'block' }, { display: 'block' }),
  styleDiffs: {},
  ...over,
});

// ---------------------------------------------------------------- normalisation

test('font-family serialisation differences are not evidence', () => {
  const chromiumStyle = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  const webkitStyle = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif';
  assert.equal(classifyDiff('fontFamily', tri(chromiumStyle, chromiumStyle, webkitStyle)), 'serialisation');
});

test('Chromium\'s BlinkMacSystemFont -> system-ui aliasing is not evidence', () => {
  assert.equal(
    classifyDiff('fontFamily', tri('-apple-system, "system-ui", Arial', '-apple-system, BlinkMacSystemFont, Arial', '-apple-system, BlinkMacSystemFont, Arial')),
    'serialisation',
  );
});

test('a genuinely different resolved font IS evidence', () => {
  assert.equal(classifyDiff('fontFamily', tri('Arial', '-apple-system', 'system-ui')), 'value');
});

test('float noise below 2dp is classed as precision, not a value difference', () => {
  assert.equal(classifyDiff('lineHeight', tri('28.8px', '28.8px', '28.800001px')), 'precision');
});

test('only styles that bear on the divergent axis are collected', () => {
  const w = relevantStyleKeys([{ prop: 'width', deltaPx: 4, values: tri(1, 2, 3) }]);
  assert.ok(w.includes('paddingLeft') && w.includes('flexBasis'));
  assert.ok(!w.includes('lineHeight'), 'line-height cannot explain a width');
  const h = relevantStyleKeys([{ prop: 'height', deltaPx: 4, values: tri(1, 2, 3) }]);
  assert.ok(h.includes('lineHeight') && h.includes('paddingTop'));
});

// ---------------------------------------------------------------- rules

test('control-font-not-inherited: a button whose font-family resolves three ways', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/BUTTON[1]', tag: 'BUTTON', selector: '.chip', display: 'inline-flex', text: 'Filter' },
    properties: [{ prop: 'width', deltaPx: 3.94, values: tri(97.36, 101.3, 101.27) }],
    styleDiffs: { fontFamily: tri('Arial', '-apple-system', 'system-ui') },
    ancestors: [ancestor({ styles: tri({ display: 'flex', fontFamily: 'Inter, sans-serif' }, { display: 'flex', fontFamily: 'Inter, sans-serif' }, { display: 'flex', fontFamily: 'Inter, sans-serif' }) })],
  }));
  assert.equal(m?.ruleId, 'control-font-not-inherited');
  assert.equal(m?.verdict, 'defect');
  assert.match(m!.fix!.css!, /font: inherit/);
});

test('control-font-not-inherited does not fire when the parent font differs too', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/BUTTON[1]', tag: 'BUTTON', selector: '', display: 'inline-flex', text: 'x' },
    properties: [{ prop: 'width', deltaPx: 4, values: tri(97, 101, 101) }],
    styleDiffs: { fontFamily: tri('Arial', '-apple-system', 'system-ui') },
    ancestors: [ancestor({ styleDiffs: { fontFamily: tri('Arial', '-apple-system', 'system-ui') } })],
  }));
  assert.notEqual(m?.ruleId, 'control-font-not-inherited');
});

test('legend-shrink-to-fit: WebKit stretches the legend to the fieldset', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/FIELDSET[1]/LEGEND[1]', tag: 'LEGEND', selector: '', display: 'block', text: 'Cadence' },
    properties: [{ prop: 'width', deltaPx: 621.5, values: tri(144.5, 144.63, 766) }],
  }));
  assert.equal(m?.ruleId, 'legend-shrink-to-fit');
  assert.equal(m?.verdict, 'defect');
});

test('ua-button-padding: the width difference is exactly twice the padding difference', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/BUTTON[1]', tag: 'BUTTON', selector: '.py-3', display: 'block', text: 'Archived' },
    properties: [
      { prop: 'offset-x', deltaPx: 15.94, values: tri(323.34, 307.4, 323.33) },
      { prop: 'width', deltaPx: 3.99, values: tri(68.81, 64.82, 68.81) },
    ],
    styleDiffs: { paddingLeft: tri('6px', '4px', '6px') },
  }));
  assert.equal(m?.ruleId, 'ua-button-padding');
  assert.equal(m?.confidence, 'high', 'the 2x relationship is what makes it high confidence');
});

test('table-column-distribution abstains on defect/expected, because the owner\'s labels split', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/TABLE[1]/TBODY[1]/TR[1]/TD[2]', tag: 'TD', selector: '', display: 'table-cell', text: 'Owner' },
    properties: [{ prop: 'offset-x', deltaPx: 16.04, values: tri(219.61, 203.57, 203.59) }],
    symptomCount: 30,
  }));
  assert.equal(m?.ruleId, 'table-column-distribution');
  assert.equal(m?.verdict, 'unclear', '90 genuine / 230 expected on this one mechanism: it does not decide');
  assert.match(m!.summary, /30 cells/);
});

test('line-wrap-count: a height delta that is a whole multiple of line-height', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/LI[1]', tag: 'LI', selector: '', display: 'flex', text: 'Unlimited dashboards' },
    properties: [{ prop: 'height', deltaPx: 20, values: tri(80, 60, 80) }],
    styles: tri({ lineHeight: '20px' }, { lineHeight: '20px' }, { lineHeight: '20px' }),
  }));
  assert.equal(m?.ruleId, 'line-wrap-count');
  assert.equal(m?.verdict, 'defect');
  assert.match(m!.summary, /1 extra line/);
});

test('line-wrap-count ignores a height delta that is not a whole line', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/LI[1]', tag: 'LI', selector: '', display: 'flex', text: 'x' },
    properties: [{ prop: 'height', deltaPx: 7, values: tri(80, 73, 80) }],
    styles: tri({ lineHeight: '20px' }, { lineHeight: '20px' }, { lineHeight: '20px' }),
  }));
  assert.notEqual(m?.ruleId, 'line-wrap-count');
});

test('font-relative-length: a ch cap, re-centred by auto margins', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/DIV[1]/P[1]', tag: 'P', selector: '.lede', display: 'block', text: 'Meridian correlates metrics' },
    properties: [
      { prop: 'width', deltaPx: 26.18, values: tri(691.78, 692.13, 665.95) },
      { prop: 'offset-x', deltaPx: 13.09, values: tri(214.11, 213.93, 227.02) },
    ],
    styleDiffs: {
      width: tri('691.781px', '692.133px', '665.953125px'),
      marginLeft: tri('190.109px', '189.933px', '203.015625px'),
    },
    ancestors: [ancestor({ geometry: tri(box(1120, 300), box(1120, 300), box(1120, 300)) })],
  }));
  assert.equal(m?.ruleId, 'font-relative-length');
  assert.equal(m?.confidence, 'high', 'half the width delta showing up as margin is the confirming signal');
  assert.match(m!.mechanism, /ch/);
});

test('font-relative-length does not fire when the parent moved by the same amount', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/DIV[1]/P[1]', tag: 'P', selector: '', display: 'block', text: 'x' },
    properties: [{ prop: 'width', deltaPx: 26, values: tri(691, 692, 665) }],
    ancestors: [ancestor({ geometry: tri(box(720, 300), box(721, 300), box(694, 300)) })],
  }));
  assert.notEqual(m?.ruleId, 'font-relative-length');
});

test('symptom-absorbed-size names the descendant that actually changed', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/SECTION[1]', tag: 'SECTION', selector: '.flex', display: 'flex', text: '' },
    properties: [{ prop: 'height', deltaPx: 15, values: tri(560, 560, 545) }],
    descendantCulprits: [{
      path: 'BODY[1]/SECTION[1]/DIV[3]/LABEL[4]/SELECT[1]', tag: 'SELECT', selector: '#f-select-3',
      depth: 4, size: tri({ w: 270, h: 38 }, { w: 270, h: 38 }, { w: 270, h: 23 }),
      widthDelta: 0, heightDelta: 15, innermost: true,
    }],
  }));
  assert.equal(m?.ruleId, 'symptom-absorbed-size');
  assert.equal(m?.verdict, 'defect', 'a form control at the bottom of the chain makes it a page bug');
  assert.match(m!.summary, /<select>/);
});

test('propagated-displacement: position moved, box identical', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/DIV[9]', tag: 'DIV', selector: '', display: 'flex', text: '' },
    properties: [{ prop: 'offset-y', deltaPx: 15, values: tri(606, 606, 591) }],
    related: [{
      id: 'p13-form-wizard#1', path: 'BODY[1]/FIELDSET[1]/LEGEND[1]', tag: 'LEGEND', maxDeltaPx: 15,
      properties: [{ prop: 'height', deltaPx: 15, values: tri(35, 35, 20) }],
      isDescendant: false, isAncestor: false,
    }],
  }));
  assert.equal(m?.ruleId, 'propagated-displacement');
  assert.match(m!.summary, /p13-form-wizard#1/);
});

test('line-height-resolution: sub-0.05px differences, accumulated', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/DIV[1]', tag: 'DIV', selector: '.fgroup', display: 'block', text: 'x' },
    properties: [{ prop: 'offset-y', deltaPx: 4.22, values: tri(833.86, 838.08, 833.86) }],
    styleDiffs: { lineHeight: tri('22.475px', '22.4667px', '22.474998px') },
  }));
  assert.equal(m?.ruleId, 'line-height-resolution');
  assert.equal(m?.verdict, 'expected-engine-difference');
});

test('a large line-height difference is NOT filed as rounding', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/DIV[1]', tag: 'DIV', selector: '', display: 'block', text: 'x' },
    properties: [{ prop: 'height', deltaPx: 4, values: tri(100, 104, 100) }],
    styleDiffs: { lineHeight: tri('24px', '28px', '24px') },
  }));
  assert.notEqual(m?.ruleId, 'line-height-resolution');
});

test('nothing matches when there is genuinely no signature', () => {
  const m = matchKnownCause(bundle({
    element: { path: 'BODY[1]/CANVAS[1]', tag: 'CANVAS', selector: '', display: 'block', text: '' },
    properties: [{ prop: 'width', deltaPx: 9, values: tri(100, 109, 100) }],
    styleDiffs: { writingMode: tri('horizontal-tb', 'vertical-rl', 'horizontal-tb') },
  }));
  assert.equal(m, null, 'an unexplained finding must stay unexplained rather than be forced into a bucket');
});

// ---------------------------------------------------------------- corpus level

test('every rule is reachable on the measured corpus', () => {
  const corpus = new Corpus({ root: path.join(REPO, 'm0'), name: 'm0' });
  const fired = new Set<string>();
  for (const f of corpus.findings()) {
    const m = matchKnownCause(buildEvidence(corpus, f));
    if (m) fired.add(m.ruleId);
  }
  // The three B-derived rules (control-font-not-inherited, font-relative-length,
  // line-height-resolution) do not fire here, which is the point of tagging them:
  // this corpus has no `ch` caps, no control that misses `font: inherit`, and no
  // sub-0.05px line-height split. The other ten must all fire.
  const expectedHere = RULES.filter((r) => r.derivedFrom.includes('A')).map((r) => r.id);
  for (const id of expectedHere) {
    assert.ok(fired.has(id), `rule ${id} never fires on the 30-page corpus`);
  }
});

test('coverage on the 30-page corpus has not regressed', () => {
  const corpus = new Corpus({ root: path.join(REPO, 'm0'), name: 'm0' });
  const all = corpus.findings();
  const covered = all.filter((f) => matchKnownCause(buildEvidence(corpus, f)) != null).length;
  assert.equal(all.length, 475, 'the corpus is frozen; a different survivor count means something else changed');
  assert.ok(covered / all.length >= 0.95, `coverage fell to ${(100 * covered / all.length).toFixed(1)}%`);
});
