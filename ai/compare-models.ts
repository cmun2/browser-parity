#!/usr/bin/env node --experimental-strip-types
//
// The same 27 findings, the same evidence, three models.
//
//   node --experimental-strip-types ai/compare-models.ts --probe
//   node --experimental-strip-types ai/compare-models.ts --go
//
// COMPARABILITY. `maxWidth` was added to the collected style set after the
// step-4 run, so the evidence gpt-5-mini saw then is not the evidence that
// exists now. A table mixing the two would be comparing models across different
// inputs. gpt-5-mini is therefore re-run here on the new evidence: all three
// columns are byte-identical inputs, and the step-4 gpt-5-mini answers are kept
// separately as the before/after on the evidence change rather than folded in.
//
// Two hard ceilings, neither raised from in here:
//   MAX_REQUESTS  120 HTTP requests, including probes and including any request
//                 that failed after being billed.
//   SPEND_CAP     $0.80, shared across all three models.
//
// Findings are ordered controls -> disagreements -> residual, and the model loop
// is inside the finding loop, so if a ceiling trips the data lost is the least
// valuable rather than one whole model.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Corpus, buildEvidence } from './evidence.ts';
import { knownCauseInvestigation } from './known-causes.ts';
import { OpenAIProvider, dryRun, printableRequest } from './openai.ts';
import { runProvider } from './provider.ts';
import { CorpusToolExecutor } from './tools.ts';
import type { Investigation } from './types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MAX_REQUESTS = 120;
const SPEND_CAP = 0.80;
const MODELS = ['gpt-5-mini', 'gpt-5.6-luna', 'gpt-5.6-terra'];
const OUTDIR = path.join(HERE, 'model-comparison');

for (const line of fs.existsSync(path.join(REPO, '.env')) ? fs.readFileSync(path.join(REPO, '.env'), 'utf8').split('\n') : []) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const A = new Corpus({ root: path.join(REPO, 'm0'), name: 'A', evidenceDir: path.join(HERE, '.evidence-v2/m0') });
const B = new Corpus({
  root: path.join(REPO, 'm0/validation'), name: 'B',
  survivorsFile: path.join(HERE, '.corpus-cache/validation-survivors.json'),
  evidenceDir: path.join(HERE, '.evidence-v2/validation'),
});
const corpusOf = (n: string) => (n === 'A' ? A : B);

const sel = JSON.parse(fs.readFileSync(path.join(HERE, 'step4-selection.json'), 'utf8'));
// Most valuable first: the controls answer the ship question.
const plan = [
  ...sel.controls.map((r: any) => ({ bucket: 'control', ...r })),
  ...sel.disagreements.map((r: any) => ({ bucket: 'disagreement', ...r })),
  ...sel.residual.map((r: any) => ({ bucket: 'residual', ...r })),
];

fs.mkdirSync(OUTDIR, { recursive: true });

// ---------------------------------------------------------------- probes

if (process.argv.includes('--probe')) {
  const seed = await dryRun(buildEvidence(A, A.findings()[0]), { model: 'gpt-5-mini' });
  let n = 0;
  for (const model of ['gpt-5.6-luna', 'gpt-5.6-terra']) {
    const body = {
      model,
      instructions: 'Reply with the required JSON. This is a reachability probe.',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'Probe. cause="probe", verdict="unclear", confidence="low", everything else empty.' }] }],
      tools: seed.request.tools, text: seed.request.text,
      max_output_tokens: 3000, reasoning: { effort: 'low' }, store: false,
    };
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
    });
    n++;
    const raw = await res.text();
    let parsed: any; try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    fs.writeFileSync(path.join(OUTDIR, `probe-${model}.json`), JSON.stringify({ status: res.status, response: parsed }, null, 2) + '\n');
    const msg = parsed?.output?.find((o: any) => o.type === 'message');
    console.log(`${model.padEnd(15)} HTTP ${res.status}  ${res.ok ? `resolved as ${parsed.model} · usage ${JSON.stringify(parsed.usage?.input_tokens)}in/${parsed.usage?.output_tokens}out · text ${msg ? 'ok' : 'MISSING'}` : raw.slice(0, 300)}`);
  }
  console.log(`\n${n} probe requests used.`);
  process.exit(0);
}

if (!process.argv.includes('--go')) { console.log('pass --probe or --go'); process.exit(2); }

// ---------------------------------------------------------------- run

const already = +(process.argv[process.argv.indexOf('--already') + 1] || 0);
let requests = already;
let spent = 0;
const exchanges: any[] = [];
const results: any[] = [];
let stopped: string | null = null;

outer:
for (const item of plan) {
  const corpus = corpusOf(item.corpus);
  const f = corpus.findings().find((x) => x.id === item.id)!;
  const evidence = buildEvidence(corpus, f);
  const prior = knownCauseInvestigation(evidence);

  for (const model of MODELS) {
    if (requests + 2 > MAX_REQUESTS) { stopped = `request ceiling: ${requests}/${MAX_REQUESTS} used`; break outer; }
    if (spent >= SPEND_CAP) { stopped = `spend cap: $${spent.toFixed(4)} of $${SPEND_CAP}`; break outer; }

    const provider = new OpenAIProvider({ model, spendCapUsd: SPEND_CAP, initialSpentUsd: spent, maxOutputTokens: 3000 });
    provider.onExchange = (x) => exchanges.push({
      model, findingId: x.findingId, turn: x.turn, status: x.status,
      request: printableRequest(x.request as any), response: x.response,
    });

    let inv: Investigation | null = null;
    let error: string | null = null;
    try {
      const run = await runProvider(provider, evidence, new CorpusToolExecutor(corpus), {
        maxTurns: 2,
        priorKnownCause: item.bucket === 'residual' ? null : prior,
      });
      inv = run.investigation;
      if (!inv) error = `stopped: ${run.stopReason}`;
    } catch (err) {
      error = (err as Error).message;
    }
    requests += provider.requests;
    spent = provider.spentUsd;

    results.push({
      model, bucket: item.bucket, corpus: item.corpus, id: item.id,
      matcherRule: prior?.ruleId ?? null, matcherVerdict: prior?.verdict ?? null, matcherCause: prior?.cause ?? null,
      ownerSaid: item.ownerSaid ?? null,
      requests: provider.requests,
      model_out: inv ? {
        cause: inv.cause, verdict: inv.verdict, confidence: inv.confidence,
        summary: inv.summary, mechanism: inv.mechanism, fix: inv.fix,
        evidenceCited: inv.evidenceCited, unresolved: inv.unresolved, oddEngineOut: inv.oddEngineOut,
      } : null,
      usage: inv?.usage ?? null,
      error,
    });

    const u = inv?.usage;
    console.log(
      `${String(requests).padStart(3)}req $${spent.toFixed(4)}  ${model.padEnd(14)} ${item.bucket.padEnd(12)} ${item.id.padEnd(28)} ` +
      `${(inv?.cause ?? error ?? '?').slice(0, 30).padEnd(31)} ${(inv?.verdict ?? '').padEnd(26)}` +
      (u ? ` ${u.inputTokens}in ${u.outputTokens}out` : ''),
    );
    if (error?.includes('spend-cap')) { stopped = error; break outer; }
  }
}

const out = {
  schema: 'browser-parity/model-comparison/1',
  ranAt: new Date().toISOString(),
  evidence: 'ai/.evidence-v2 (re-collected, includes maxWidth) — identical bytes for all three models',
  models: MODELS,
  budget: { maxRequests: MAX_REQUESTS, spendCapUsd: SPEND_CAP, maxTurnsPerFinding: 2 },
  totals: { requests, spentUsd: +spent.toFixed(6), answered: results.filter((r) => r.model_out).length, stopped },
  results,
};
fs.writeFileSync(path.join(HERE, 'model-comparison.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(OUTDIR, 'exchanges.json'), JSON.stringify(exchanges, null, 2) + '\n');
console.log(`\n${results.length} answers · ${requests} requests · $${spent.toFixed(5)}`);
if (stopped) console.log(`STOPPED: ${stopped}`);
