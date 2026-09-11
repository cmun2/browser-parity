#!/usr/bin/env node --experimental-strip-types
//
// The step-4 verification run. Bounded, recorded, and refuses to exceed budget.
//
//   node --experimental-strip-types ai/step4-run.ts --probe
//   node --experimental-strip-types ai/step4-run.ts --go
//
// Two independent ceilings, both hard:
//   MAX_REQUESTS  54 HTTP requests total, including the probe and including any
//                 request that failed after being billed.
//   --spend-cap   $0.15, enforced inside OpenAIProvider before each send.
// If either trips the run stops and reports. Neither is raised from in here.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Corpus, buildEvidence } from './evidence.ts';
import { knownCauseInvestigation } from './known-causes.ts';
import { OpenAIProvider, printableRequest } from './openai.ts';
import { runProvider } from './provider.ts';
import { CorpusToolExecutor } from './tools.ts';
import { dryRun } from './openai.ts';
import type { Investigation } from './types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MAX_REQUESTS = 54;
const SPEND_CAP = 0.15;
const MODEL = 'gpt-5-mini';
const TRANSCRIPTS = path.join(HERE, 'step4-transcripts');

// .env, read here rather than assumed to be exported.
for (const line of fs.existsSync(path.join(REPO, '.env')) ? fs.readFileSync(path.join(REPO, '.env'), 'utf8').split('\n') : []) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const A = new Corpus({ root: path.join(REPO, 'm0'), name: 'A' });
const B = new Corpus({ root: path.join(REPO, 'm0/validation'), name: 'B', survivorsFile: path.join(HERE, '.corpus-cache/validation-survivors.json') });
const corpusOf = (n: string) => (n === 'A' ? A : B);

const selection = JSON.parse(fs.readFileSync(path.join(HERE, 'step4-selection.json'), 'utf8'));
const plan: Array<{ bucket: string; corpus: string; id: string; rule?: string; matcherSaid?: string; ownerSaid?: string }> = [
  ...selection.residual.map((r: any) => ({ bucket: 'residual', ...r })),
  ...selection.disagreements.map((r: any) => ({ bucket: 'disagreement', ...r })),
  ...selection.controls.map((r: any) => ({ bucket: 'control', ...r })),
];

const provider = new OpenAIProvider({ model: MODEL, spendCapUsd: SPEND_CAP, maxOutputTokens: 3000 });
const exchanges: any[] = [];
provider.onExchange = (x) => {
  exchanges.push({
    findingId: x.findingId, turn: x.turn, status: x.status,
    request: printableRequest(x.request as any), response: x.response,
  });
};

const avail = provider.available();
if (!avail.ok) { console.error(avail.reason); process.exit(2); }

fs.mkdirSync(TRANSCRIPTS, { recursive: true });

// ---------------------------------------------------------------- probe
//
// One request, exercising the real tool schemas and the real strict output
// format on a trivial input. If gpt-5-mini is not reachable on this tier, or a
// schema is rejected, it fails here for one request instead of 27.

if (process.argv.includes('--probe')) {
  const body = {
    model: MODEL,
    instructions: 'Reply with the required JSON. This is a reachability probe.',
    input: [{ role: 'user', content: [{ type: 'input_text', text: 'Probe. Set cause to "probe", verdict to "unclear", confidence to "low", everything else empty.' }] }],
    tools: (await dryRun(buildEvidence(A, A.findings()[0]), { model: MODEL })).request.tools,
    text: (await dryRun(buildEvidence(A, A.findings()[0]), { model: MODEL })).request.text,
    max_output_tokens: 3000,
    reasoning: { effort: 'low' },
    store: false,
  };
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  fs.writeFileSync(path.join(TRANSCRIPTS, '00-probe.json'), JSON.stringify({ status: res.status, request: body, response: tryParse(raw) }, null, 2) + '\n');
  console.log(`probe: HTTP ${res.status}`);
  console.log(raw.slice(0, 1400));
  process.exit(res.ok ? 0 : 1);
}

// ---------------------------------------------------------------- the run

if (!process.argv.includes('--go')) {
  console.log('pass --probe or --go'); process.exit(2);
}

const startedRequests = +(process.argv[process.argv.indexOf('--already') + 1] || 0);
const results: any[] = [];
let stopped: string | null = null;

for (const item of plan) {
  const used = startedRequests + provider.requests;
  if (used + 2 > MAX_REQUESTS) { stopped = `request ceiling: ${used} of ${MAX_REQUESTS} used, and a finding may need 2 more`; break; }

  const corpus = corpusOf(item.corpus);
  const f = corpus.findings().find((x) => x.id === item.id);
  if (!f) { results.push({ ...item, error: 'finding not found' }); continue; }
  const evidence = buildEvidence(corpus, f);
  const prior = knownCauseInvestigation(evidence);

  let inv: Investigation | null = null;
  let error: string | null = null;
  const before = provider.requests;
  try {
    const run = await runProvider(provider, evidence, new CorpusToolExecutor(corpus), {
      maxTurns: 2,                       // two requests per finding, hard
      priorKnownCause: item.bucket === 'residual' ? null : prior,
    });
    inv = run.investigation;
    if (!inv) error = `stopped: ${run.stopReason}`;
  } catch (err) {
    error = (err as Error).message;
    if (error.includes('spend-cap')) { stopped = error; results.push({ ...item, error }); break; }
  }

  const spent = provider.requests - before;
  results.push({
    ...item,
    requests: spent,
    matcherRule: prior?.ruleId ?? null,
    matcherVerdict: prior?.verdict ?? null,
    matcherCause: prior?.cause ?? null,
    model: inv ? {
      cause: inv.cause, verdict: inv.verdict, confidence: inv.confidence,
      summary: inv.summary, mechanism: inv.mechanism,
      fix: inv.fix, evidenceCited: inv.evidenceCited, unresolved: inv.unresolved,
      oddEngineOut: inv.oddEngineOut,
    } : null,
    usage: inv?.usage ?? null,
    error,
  });
  const u = inv?.usage;
  console.log(
    `${String(startedRequests + provider.requests).padStart(2)}req  ${item.bucket.padEnd(12)} ${item.id.padEnd(28)} ` +
    `${(inv?.cause ?? error ?? '?').slice(0, 34).padEnd(35)} ${inv?.verdict ?? ''}` +
    (u ? `   in ${u.inputTokens} out ${u.outputTokens} (reason ${u.reasoningTokens ?? 0})  $${u.costUsd.toFixed(5)}` : ''),
  );
}

const totalRequests = startedRequests + provider.requests;
const out = {
  schema: 'browser-parity/step4-result/1',
  ranAt: new Date().toISOString(),
  model: MODEL,
  budget: { maxRequests: MAX_REQUESTS, spendCapUsd: SPEND_CAP, maxTurnsPerFinding: 2 },
  totals: {
    findingsAsked: results.length,
    requests: totalRequests,
    actualCostUsd: +provider.spentUsd.toFixed(6),
    stopped,
  },
  results,
};
fs.writeFileSync(path.join(HERE, 'step4-results.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(TRANSCRIPTS, 'exchanges.json'), JSON.stringify(exchanges, null, 2) + '\n');
console.log(`\n${results.length} findings · ${totalRequests} requests · $${provider.spentUsd.toFixed(5)} actual`);
if (stopped) console.log(`STOPPED: ${stopped}`);

function tryParse(s: string) { try { return JSON.parse(s); } catch { return s; } }
