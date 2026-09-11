// Token counting for the dry run.
//
// The dry-run output is what the owner reads when deciding a budget, so this
// counts rather than guesses. When `js-tiktoken` resolves, the count is the
// real o200k_base BPE count and is exact. When it does not, a structural
// estimator stands in and the dry run says so on its face — an estimate
// labelled as an estimate is honest; an estimate printed as a count is not.
//
// `js-tiktoken` is an optional devDependency, loaded by dynamic import and
// never imported by anything in core/. Deleting it degrades this file and
// nothing else. No network request is made either way.

import { imageTokens } from './pricing.ts';

export type TokenBackend = 'o200k_base (exact)' | 'structural estimate (±15%)';

type Encoder = { encode(s: string): unknown[] };
let encoder: Encoder | null = null;
let backend: TokenBackend = 'structural estimate (±15%)';
let initialised = false;

export async function initTokenizer(): Promise<TokenBackend> {
  if (initialised) return backend;
  initialised = true;
  try {
    const mod = (await import('js-tiktoken')) as { getEncoding(n: string): Encoder };
    encoder = mod.getEncoding('o200k_base');
    backend = 'o200k_base (exact)';
  } catch {
    encoder = null;
    backend = 'structural estimate (±15%)';
  }
  return backend;
}

export function tokenBackend(): TokenBackend {
  return backend;
}

/**
 * The o200k_base pre-tokenizer split, used by the fallback estimator. Tokens
 * never span these boundaries, so splitting on them and costing each piece is
 * structurally right even without the merge table — which is what makes this
 * better than dividing by four.
 */
const PRETOKEN = /[^\r\n\p{L}\p{N}]?[\p{L}]+|[\p{N}]{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;

function estimate(text: string): number {
  let total = 0;
  for (const m of text.matchAll(PRETOKEN)) {
    const piece = m[0];
    const bytes = Buffer.byteLength(piece, 'utf8');
    if (/^\s+$/.test(piece)) {
      // Runs of whitespace merge aggressively.
      total += Math.max(1, Math.ceil(bytes / 8));
    } else if (/^[\p{N}]+$/u.test(piece.trim())) {
      // Digits are grouped in 1-3s by the pre-tokenizer and rarely merge further.
      total += 1;
    } else if (/[\p{L}]/u.test(piece)) {
      // Common words are one token; long or unusual ones split. ~4.1 bytes per
      // token for English prose in o200k_base, floored at one.
      total += Math.max(1, Math.round(bytes / 4.1));
    } else {
      // Punctuation runs: roughly one token per two characters.
      total += Math.max(1, Math.ceil(bytes / 2));
    }
  }
  return total;
}

export function countText(text: string): number {
  if (!text) return 0;
  if (encoder) return encoder.encode(text).length;
  return estimate(text);
}

export function countImage(model: string, width: number, height: number): number {
  return imageTokens(model, width, height);
}

/** Per-message overhead in the Responses API: role/type framing around content. */
export const MESSAGE_OVERHEAD_TOKENS = 4;

/**
 * Tool definitions are serialised into the request and billed as input. Counting
 * the JSON is the right approximation: the exact wire format is not published,
 * and the difference is a few tokens against a few thousand.
 */
export function countToolSchemas(schemas: unknown): number {
  return countText(JSON.stringify(schemas));
}
