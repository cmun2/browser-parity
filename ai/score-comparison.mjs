// Semantic scoring of the three-model comparison.
//
// Slug equality is too crude: "ua-select-intrinsic-height" and
// "symptom-absorbed-size" are the same finding stated at different depth, while
// "upstream-table-layout" and "line-height-resolution" are genuinely different
// claims. Every cell that is not a plain slug match is classified by hand below,
// with the reason and — where the model contradicted a rule — whether its claim
// was checked against the evidence and held.
//
// The classification is a judgement. It is written down rather than folded into
// a number so it can be disagreed with.
import fs from 'node:fs';
const R = JSON.parse(fs.readFileSync(new URL('./model-comparison.json', import.meta.url), 'utf8'));

// findingId -> model -> { outcome, why }
const HAND = {
  'p07-dash-billing#42': {
    _all: { outcome: 'refined', why: 'Named the <select> and its UA control height. The rule says "a descendant carries this delta"; the model says which descendant and why. Same mechanism, stated one level deeper.' },
  },
  'p09-dash-infra-status#2': {
    'gpt-5-mini': { outcome: 'confirmed', why: 'Agreed with text-shrink-to-fit.' },
    'gpt-5.6-luna': { outcome: 'confirmed', why: 'cross-engine-text-metrics-in-flex-item is text-shrink-to-fit under another name.' },
    'gpt-5.6-terra': { outcome: 'overturned-correctly', why: 'Showed the 5.01px offset is the sum of the preceding siblings\' width excesses (1.47+1.67+1.88=5.02) while this element is only 1.67px wider. VERIFIED against the evidence dump: exact. The rule was over-claiming magnitude and has been fixed.' },
  },
  'v07-article-docs#15': {
    'gpt-5-mini': { outcome: 'confirmed-a-wrong-rule', why: 'Agreed with line-height-resolution, which was wrong. Not a contradiction, but a missed catch.' },
    'gpt-5.6-luna': { outcome: 'overturned-correctly', why: 'A 37.4 vs 37.400002px line-height cannot move a 46.4px heading 7.5px; the <article> ancestor is 7.5px shorter in WebKit. VERIFIED: ancestor heights are 2636.31 / 2636.13 / 2628.81. The rule has since been deleted.' },
    'gpt-5.6-terra': { outcome: 'overturned-correctly', why: 'Same critique as luna, reached independently, plus the table-column evidence above the heading. VERIFIED.' },
  },
};

const rows = R.results.filter((r) => r.bucket === 'control');
const ids = [...new Set(rows.map((r) => r.id))];
const score = {};
for (const m of R.models) score[m] = { confirmed: 0, refined: 0, overturnedCorrectly: 0, confirmedAWrongRule: 0, contradictedARightRule: 0, unanswered: 0, cells: [] };

for (const id of ids) {
  for (const m of R.models) {
    const r = rows.find((x) => x.id === id && x.model === m);
    const s = score[m];
    if (!r || !r.model_out) { s.unanswered++; s.cells.push({ id, outcome: 'unanswered' }); continue; }
    const hand = HAND[id]?.[m] ?? HAND[id]?._all;
    let outcome, why;
    if (hand) { outcome = hand.outcome; why = hand.why; }
    else if (r.model_out.cause === r.matcherCause) { outcome = 'confirmed'; why = 'same mechanism slug as the rule'; }
    else { outcome = 'contradicted-a-right-rule'; why = 'UNCLASSIFIED SLUG MISMATCH — review'; }
    const key = { confirmed: 'confirmed', refined: 'refined', 'overturned-correctly': 'overturnedCorrectly',
      'confirmed-a-wrong-rule': 'confirmedAWrongRule', 'contradicted-a-right-rule': 'contradictedARightRule' }[outcome];
    s[key]++;
    s.cells.push({ id, rule: r.matcherCause, modelCause: r.model_out.cause, outcome, why });
  }
}

// cost + stability
const perModel = {};
for (const m of R.models) {
  const rs = R.results.filter((x) => x.model === m && x.usage);
  const cost = rs.reduce((a, x) => a + x.usage.costUsd, 0);
  const inTok = rs.reduce((a, x) => a + x.usage.inputTokens, 0);
  const outTok = rs.reduce((a, x) => a + x.usage.outputTokens, 0);
  const reas = rs.reduce((a, x) => a + (x.usage.reasoningTokens || 0), 0);
  const wob = ['p13-form-wizard#9', 'p13-form-wizard#11', 'p13-form-wizard#13']
    .map((id) => R.results.find((x) => x.id === id && x.model === m)?.model_out?.verdict);
  perModel[m] = {
    answered: rs.length,
    totalCostUsd: +cost.toFixed(6),
    meanCostUsd: +(cost / rs.length).toFixed(6),
    meanInputTokens: Math.round(inTok / rs.length),
    meanOutputTokens: Math.round(outTok / rs.length),
    meanReasoningTokens: Math.round(reas / rs.length),
    requests: R.results.filter((x) => x.model === m).reduce((a, x) => a + x.requests, 0),
    controls: score[m],
    wobbleTriplet: wob,
    wobbleStable: new Set(wob.filter(Boolean)).size === 1 && wob.every(Boolean),
  };
}

const out = { schema: 'browser-parity/model-comparison-scored/1', scoredAt: new Date().toISOString(),
  evidence: R.evidence, budget: R.budget, totals: R.totals, perModel };
fs.writeFileSync(new URL('./model-comparison-scored.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');

for (const m of R.models) {
  const p = perModel[m], c = p.controls;
  console.log(`\n${m}`);
  console.log(`  answered ${p.answered}/27 · ${p.requests} requests · $${p.totalCostUsd.toFixed(5)} total · $${p.meanCostUsd.toFixed(5)}/investigation`);
  console.log(`  tokens   ${p.meanInputTokens} in · ${p.meanOutputTokens} out (${p.meanReasoningTokens} reasoning)`);
  console.log(`  controls confirmed ${c.confirmed} · refined ${c.refined} · overturned-correctly ${c.overturnedCorrectly} · confirmed-a-wrong-rule ${c.confirmedAWrongRule} · CONTRADICTED-A-RIGHT-RULE ${c.contradictedARightRule}`);
  console.log(`  wobble   ${p.wobbleTriplet.join(' / ')}  -> ${p.wobbleStable ? 'STABLE' : 'WOBBLE'}`);
}
