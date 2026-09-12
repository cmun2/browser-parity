#!/usr/bin/env node --experimental-strip-types
//
// investigate — explain findings the deterministic pipeline produced.
//
//   node --experimental-strip-types ai/cli.ts                        every finding, matcher only
//   node --experimental-strip-types ai/cli.ts --finding p12-form-checkout#2
//   node --experimental-strip-types ai/cli.ts --provider mock        run the full loop from fixtures
//   node --experimental-strip-types ai/cli.ts --dry-run --finding X  assemble and price one request, send nothing
//   node --experimental-strip-types ai/cli.ts --markdown report.md
//
// Defaults to the deterministic matcher alone. A provider is opt-in, and when
// OPENAI_API_KEY is absent the tool says so and carries on rather than failing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Corpus, buildEvidence } from './evidence.ts';
import type { SurvivorFinding } from './evidence.ts';
import { knownCauseInvestigation } from './known-causes.ts';
import { MockProvider } from './mock.ts';
import { OpenAIProvider, dryRun, printableRequest } from './openai.ts';
import { runProvider } from './provider.ts';
import { renderMarkdown, renderTerminal } from './render.ts';
import { CorpusToolExecutor } from './tools.ts';
import type { EvidenceBundle, Investigation } from './types.ts';
import { DEFAULT_MODEL, PRICING, imageTokens } from './pricing.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const arg = (n: string, d: string | null = null): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? (process.argv[i + 1] ?? null) : d;
};
const has = (n: string) => process.argv.includes(n);

if (has('--help') || has('-h')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(2, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

// ---------------------------------------------------------------- corpus

const corpusArg = arg('--corpus', 'm0')!;
const corpusRoot = path.resolve(REPO, corpusArg);
const survivorsFile = arg('--survivors') ?? undefined;
let corpus: Corpus;
try {
  corpus = new Corpus({ root: corpusRoot, name: corpusArg, survivorsFile });
} catch (err) {
  console.error(`could not read a corpus at ${corpusRoot}: ${(err as Error).message}`);
  console.error('pass --corpus <dir> (a directory containing results/survivors.json) or --survivors <file>.');
  process.exit(2);
}

const wanted = arg('--finding');
const wantedPage = arg('--page');
const limit = +(arg('--limit', '0') ?? 0);

let findings: SurvivorFinding[] = corpus.findings();
if (wanted) findings = findings.filter((f) => f.id === wanted);
if (wantedPage) findings = findings.filter((f) => f.page === wantedPage);
if (limit > 0) findings = findings.slice(0, limit);

if (!findings.length) {
  console.error(wanted ? `no finding with id ${wanted}` : 'no findings selected');
  process.exit(2);
}

// ---------------------------------------------------------------- dry run

if (has('--dry-run')) {
  const model = arg('--model', DEFAULT_MODEL)!;
  const e = buildEvidence(corpus, findings[0]);
  const prior = has('--no-prior') ? null : knownCauseInvestigation(e);
  const d = await dryRun(e, { model, priorKnownCause: prior, includeImages: !has('--no-images') });

  console.log('\n' + '='.repeat(78));
  console.log('DRY RUN — the exact request that would be sent. Nothing was sent.');
  console.log('='.repeat(78));
  console.log(`\nfinding        ${e.findingId}   <${e.element.tag.toLowerCase()}> on ${e.page}`);
  console.log(`model          ${d.model}`);
  console.log(`endpoint       POST https://api.openai.com/v1/responses   (store: false)`);
  console.log(`token counts   ${d.tokenBackend}`);
  console.log(`prices as of   ${d.pricingAsOf}`);
  for (const s of d.pricingSources) console.log(`               ${s}`);

  console.log('\ninput tokens');
  const c = d.counts;
  const row = (k: string, v: number) => console.log(`  ${k.padEnd(26)} ${String(v).padStart(7)}`);
  row('system prompt', c.systemPromptTokens);
  row('evidence', c.evidenceTokens);
  row('image captions', c.imageLabelTokens);
  row('tool schemas (4 tools)', c.toolSchemaTokens);
  row('output json schema', c.outputSchemaTokens);
  row('message framing', c.messageOverheadTokens);
  row('  text subtotal', c.textInputTokens);
  for (const im of d.images) {
    row(`image ${im.engine} ${im.width}x${im.height}`, imageTokens(d.model, im.width, im.height));
  }
  row('  image subtotal', c.imageInputTokens);
  row('TOTAL INPUT', c.totalInputTokens);
  console.log(`  ${'assumed output'.padEnd(26)} ${String(c.assumedOutputTokens).padStart(7)}`);
  console.log(`\n  ${d.outputAssumption}`);

  console.log('\nimages attached');
  for (const im of d.images) {
    console.log(`  ${im.engine.padEnd(10)} ${im.width}x${im.height}px   ${(im.bytes / 1024).toFixed(1)} KiB png   ${(im.base64Bytes / 1024).toFixed(1)} KiB base64`);
  }
  console.log(`  wire payload  ${(d.payloadBytes / 1024).toFixed(1)} KiB`);

  console.log('\ncost, one investigation, single turn');
  console.log(`  input   ${c.totalInputTokens.toLocaleString()} tok   $${d.cost.inputUsd.toFixed(6)}`);
  console.log(`  output  ${c.assumedOutputTokens.toLocaleString()} tok   $${d.cost.outputUsd.toFixed(6)}`);
  console.log(`  TOTAL                     $${d.cost.totalUsd.toFixed(6)}`);
  console.log(`\n  with ${d.withToolTurns.turns} turns (one tool round-trip, cached prefix)   $${d.withToolTurns.totalUsd.toFixed(6)}`);

  console.log('\nthe same request on every model with recorded pricing');
  console.log('  model            input tok   image tok   $/investigation   $/100');
  for (const m of Object.keys(PRICING)) {
    const dm = await dryRun(e, { model: m, priorKnownCause: prior, includeImages: !has('--no-images') });
    console.log(
      `  ${m.padEnd(16)} ${String(dm.counts.textInputTokens).padStart(9)}   ${String(dm.counts.imageInputTokens).padStart(9)}   ` +
      `$${dm.cost.totalUsd.toFixed(6).padStart(11)}   $${(dm.cost.totalUsd * 100).toFixed(2).padStart(6)}`,
    );
  }

  if (has('--print-request')) {
    console.log('\nrequest body (base64 image data elided)');
    console.log(JSON.stringify(printableRequest(d.request), null, 2));
  } else {
    console.log('\n(--print-request to print the full request body)');
  }
  // Budget shape across a set of findings, which is what a spend decision
  // actually needs: not one request, but how the request sizes are distributed.
  if (findings.length > 1) {
    const each: number[] = [];
    let tokens = 0;
    for (const f of findings) {
      const ev = buildEvidence(corpus, f);
      const dd = await dryRun(ev, {
        model, priorKnownCause: has('--no-prior') ? null : knownCauseInvestigation(ev),
        includeImages: !has('--no-images'),
      });
      each.push(dd.cost.totalUsd);
      tokens += dd.counts.totalInputTokens;
    }
    each.sort((a, b) => a - b);
    const sum = each.reduce((a, b) => a + b, 0);
    console.log(`\nacross the ${each.length} selected findings, on ${model}`);
    console.log(`  input tokens   total ${tokens.toLocaleString()}   mean ${Math.round(tokens / each.length).toLocaleString()}`);
    console.log(`  $/investigation   min $${each[0].toFixed(6)}   median $${each[Math.floor(each.length / 2)].toFixed(6)}   max $${each[each.length - 1].toFixed(6)}`);
    console.log(`  TOTAL if every one were investigated once:  $${sum.toFixed(4)}`);
    console.log(`  with one tool round-trip each:              $${(sum * 1.69).toFixed(4)}   (cached-prefix ratio from the single-request figure above)`);
  }

  const out = arg('--json');
  if (out) {
    fs.writeFileSync(path.resolve(out), JSON.stringify({ ...d, request: printableRequest(d.request) }, null, 2) + '\n');
    console.log(`\nwrote ${out}`);
  }
  console.log('\nNothing was sent. No API call was made.\n');
  process.exit(0);
}

// ---------------------------------------------------------------- investigate

const providerName = arg('--provider', 'none')!;
const executor = new CorpusToolExecutor(corpus);
const results: Array<{ inv: Investigation; evidence: EvidenceBundle }> = [];
let unexplained = 0;
let providerNote: string | null = null;

const provider =
  providerName === 'mock' ? new MockProvider({ fixtureFile: arg('--fixtures') ?? undefined })
  : providerName === 'openai' ? new OpenAIProvider({
      model: arg('--model', DEFAULT_MODEL)!,
      spendCapUsd: arg('--spend-cap') ? +arg('--spend-cap')! : undefined,
    })
  : null;

if (provider) {
  const a = provider.available();
  if (!a.ok) {
    providerNote = a.reason;
  }
}

for (const f of findings) {
  const evidence = buildEvidence(corpus, f);
  const known = knownCauseInvestigation(evidence);

  // The deterministic answer is the answer unless the user asked for more. A
  // provider is only consulted when the matcher has nothing, or when --always
  // asks it to second-guess the matcher.
  const needsProvider = provider && provider.available().ok && (!known || has('--always'));
  if (!needsProvider) {
    if (known) results.push({ inv: known, evidence });
    else { unexplained++; results.push({ inv: unexplainedInvestigation(evidence), evidence }); }
    continue;
  }

  const run = await runProvider(provider!, evidence, executor, {
    maxTurns: +(arg('--max-turns', '4') ?? 4),
    priorKnownCause: known,
  });
  if (run.investigation) results.push({ inv: run.investigation, evidence });
  else {
    unexplained++;
    results.push({ inv: unexplainedInvestigation(evidence, `investigator stopped: ${run.stopReason}`), evidence });
  }
}

function unexplainedInvestigation(e: EvidenceBundle, why?: string): Investigation {
  return {
    schema: 'browser-parity/investigation/1',
    findingId: e.findingId,
    cause: 'unexplained',
    summary: 'No known cause matched, and no investigator was available.',
    mechanism: why ?? 'The deterministic matcher has no rule for this shape. The measurement stands; the explanation does not exist yet.',
    verdict: 'unclear',
    confidence: 'low',
    oddEngineOut: e.oddEngineOut,
    fix: null,
    evidenceCited: [],
    source: 'known-cause',
    unresolved: ['no rule matched'],
  };
}

// ---------------------------------------------------------------- output

const md = arg('--markdown');
if (md) {
  fs.writeFileSync(path.resolve(md), renderMarkdown(results) + '\n');
  console.log(`wrote ${md}  (${results.length} findings)`);
} else {
  for (const r of results) {
    console.log('\n' + '-'.repeat(78));
    console.log(renderTerminal(r.inv, r.evidence));
  }
  console.log('\n' + '-'.repeat(78));
}

const bySource = { 'known-cause': 0, model: 0, mock: 0 };
for (const r of results) bySource[r.inv.source]++;
console.log(
  `\n${results.length} finding${results.length === 1 ? '' : 's'} · ` +
  `${bySource['known-cause']} explained by rule · ${bySource.model + bySource.mock} by the investigator · ${unexplained} unexplained`,
);
if (providerNote) console.log('\n' + providerNote);
console.log('');
