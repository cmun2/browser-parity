// The constraint that matters most, enforced in code.
//
// These tests fail loudly if anything in the investigator layer can reach the
// network on a path the user did not explicitly opt into. `fetch` is replaced
// with a trap for the duration; any call is a test failure, not a warning.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Corpus, buildEvidence } from '../evidence.ts';
import { knownCauseInvestigation } from '../known-causes.ts';
import { MockProvider } from '../mock.ts';
import { OpenAIProvider, dryRun } from '../openai.ts';
import { runProvider } from '../provider.ts';
import { CorpusToolExecutor } from '../tools.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const corpus = new Corpus({ root: path.join(REPO, 'm0'), name: 'm0' });
const findings = corpus.findings();
const pick = (id: string) => buildEvidence(corpus, findings.find((f) => f.id === id)!);

function withNetworkTrap<T>(fn: () => T | Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    calls.push(String(input));
    throw new Error(`network call attempted: ${String(input)}`);
  }) as typeof fetch;
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = real;
    assert.deepEqual(calls, [], `no network call may happen here, but got: ${calls.join(', ')}`);
  });
}

test('dryRun assembles and prices a request without touching the network', async () => {
  await withNetworkTrap(async () => {
    const e = pick('p12-form-checkout#2');
    const d = await dryRun(e, { model: 'gpt-5-mini' });
    assert.equal(d.model, 'gpt-5-mini');
    assert.ok(d.counts.totalInputTokens > 500, 'a real request was assembled');
    assert.ok(d.cost.totalUsd > 0, 'a price was computed');
    assert.ok(d.images.length === 3, 'three crops attached');
    assert.equal((d.request as { store: boolean }).store, false, 'store must be false: no copy of the page kept server-side');
  });
});

test('the mock provider runs the whole loop with no network', async () => {
  await withNetworkTrap(async () => {
    const e = pick('p12-form-checkout#2');
    const provider = new MockProvider();
    const run = await runProvider(provider, e, new CorpusToolExecutor(corpus), { maxTurns: 5 });
    assert.equal(run.stopReason, 'done');
    assert.ok(run.investigation, 'the loop reached a verdict');
    assert.equal(run.investigation!.source, 'mock');
    assert.ok(run.turns >= 3, 'the fixture exercises at least two tool round-trips');
    assert.ok(run.toolCalls.length >= 3, 'tools were actually called');
  });
});

test('the known-cause matcher never touches the network', async () => {
  await withNetworkTrap(() => {
    let explained = 0;
    for (const f of findings.slice(0, 200)) {
      if (knownCauseInvestigation(buildEvidence(corpus, f))) explained++;
    }
    assert.ok(explained > 150, 'the matcher explained most of the sample');
  });
});

test('OpenAIProvider reports a missing key instead of throwing, and sends nothing', async () => {
  await withNetworkTrap(async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const p = new OpenAIProvider();
      const a = p.available();
      assert.equal(a.ok, false);
      assert.match((a as { reason: string }).reason, /OPENAI_API_KEY is not set/);
      assert.match((a as { reason: string }).reason, /never proxies/);

      // The loop must treat it as a configuration, not an error.
      const run = await runProvider(p, pick('p11-form-settings#1'), new CorpusToolExecutor(corpus));
      assert.equal(run.stopReason, 'provider-unavailable');
      assert.equal(run.investigation, null);
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev;
    }
  });
});

test('a malformed key is rejected before any request is built', async () => {
  await withNetworkTrap(() => {
    const p = new OpenAIProvider({ apiKey: 'not-a-key' });
    const a = p.available();
    assert.equal(a.ok, false);
    assert.match((a as { reason: string }).reason, /Nothing was sent/);
  });
});

test('an unpriced model is refused rather than guessed at', async () => {
  await withNetworkTrap(() => {
    const p = new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-9-imaginary' });
    const a = p.available();
    assert.equal(a.ok, false);
    assert.match((a as { reason: string }).reason, /no published pricing recorded/);
  });
});
