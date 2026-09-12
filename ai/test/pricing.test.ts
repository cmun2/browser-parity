// Image-token and cost arithmetic, against the published formulas.
//
// These constants are the ones the owner's budget decision rests on, so they
// get checked rather than trusted.

import assert from 'node:assert/strict';
import test from 'node:test';
import { PRICING, PRICING_AS_OF, cost, imageTokens, pricingFor } from '../pricing.ts';
import { countText, initTokenizer, tokenBackend } from '../tokens.ts';

test('tile-based image tokens: base + 512px tiles', () => {
  // gpt-5: base 70, tile 140. A 380x260 crop is one tile.
  assert.equal(imageTokens('gpt-5', 380, 260), 70 + 140);
  // 900x640 is 2x2 tiles.
  assert.equal(imageTokens('gpt-5', 900, 640), 70 + 4 * 140);
  // 1024x1024 is 2x2 after the shortest side is capped at 768 -> 768x768.
  assert.equal(imageTokens('gpt-5', 1024, 1024), 70 + 4 * 140);
});

test('patch-based image tokens: ceil(w/32)*ceil(h/32) * multiplier', () => {
  // gpt-5-mini, multiplier 1.2. 380x260 -> ceil(11.875)=12 x ceil(8.125)=9 = 108 patches.
  assert.equal(imageTokens('gpt-5-mini', 380, 260), Math.ceil(108 * 1.2));
  // gpt-4.1-mini, multiplier 1.62.
  assert.equal(imageTokens('gpt-4.1-mini', 380, 260), Math.ceil(108 * 1.62));
});

test('the crops this project produces never hit the patch budget', () => {
  // Largest crop the M0 runner emits is 900x640 -> 29 x 20 = 580 patches,
  // against a published budget of 1536. The resize branch is dead code here,
  // which is why the estimate does not depend on it.
  const patches = Math.ceil(900 / 32) * Math.ceil(640 / 32);
  assert.ok(patches < (pricingFor('gpt-5-mini').image as { patchBudget: number }).patchBudget);
  assert.equal(imageTokens('gpt-5-mini', 900, 640), Math.ceil(patches * 1.2));
});

test('cost is linear in tokens at the published rates', () => {
  const c = cost('gpt-5-mini', { textInputTokens: 1_000_000, imageInputTokens: 0, outputTokens: 0 });
  assert.equal(+c.totalUsd.toFixed(6), PRICING['gpt-5-mini'].input);
  const o = cost('gpt-5-mini', { textInputTokens: 0, imageInputTokens: 0, outputTokens: 1_000_000 });
  assert.equal(+o.totalUsd.toFixed(6), PRICING['gpt-5-mini'].output);
});

test('cached input is billed at the cached rate', () => {
  const c = cost('gpt-5', { textInputTokens: 1_000_000, imageInputTokens: 0, cachedInputTokens: 1_000_000, outputTokens: 0 });
  assert.equal(+c.totalUsd.toFixed(6), PRICING['gpt-5'].cachedInput);
});

test('an unknown model is an error, not a default', () => {
  assert.throws(() => pricingFor('gpt-42'), /no published pricing recorded/);
});

test('the pricing snapshot carries a date', () => {
  assert.match(PRICING_AS_OF, /^\d{4}-\d{2}-\d{2}$/);
});

test('the tokenizer reports which backend produced the count', async () => {
  await initTokenizer();
  const b = tokenBackend();
  assert.ok(b === 'o200k_base (exact)' || b === 'structural estimate (±15%)');
  // Whatever the backend, the count must be plausible for known text.
  const n = countText('The quick brown fox jumps over the lazy dog.');
  assert.ok(n >= 8 && n <= 14, `got ${n} tokens for a 9-word sentence`);
});
