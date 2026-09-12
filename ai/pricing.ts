// Published OpenAI prices and image-token constants, copied by hand.
//
// This file exists so that a cost estimate is auditable: every number below has
// a source and a date, and nothing is inferred. Re-check it before quoting a
// figure — prices move, and a stale constant here silently becomes a wrong
// number in the dry run.
//
// Nothing in this file makes a network request.

export interface ModelPricing {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M cached input tokens. */
  cachedInput: number;
  /** USD per 1M output tokens. */
  output: number;
  /** how this model bills image input. */
  image:
    | { kind: 'patch'; multiplier: number; patchBudget: number }
    | { kind: 'tile'; baseTokens: number; tileTokens: number };
  multimodal: boolean;
}

/**
 * Checked against https://developers.openai.com/api/docs/pricing and
 * https://developers.openai.com/api/docs/guides/images-vision on this date.
 */
export const PRICING_AS_OF = '2026-09-11';
/** The gpt-5.6 family was added on this date, from the same two pages. */
export const PRICING_GPT56_AS_OF = '2026-09-11';
export const PRICING_SOURCES = [
  'https://developers.openai.com/api/docs/pricing',
  'https://developers.openai.com/api/docs/guides/images-vision',
];

export const PRICING: Record<string, ModelPricing> = {
  // gpt-5.6 family. Standard tier (the pricing page also lists batch, flex,
  // priority and fast rows; those are not what a plain Responses call bills at).
  // All three are patch-based with multiplier 1.2 and a 2,500-patch budget at
  // detail `high` — our largest crop is 900x640 = 580 patches, so the budget
  // never binds and the resize branch stays dead.
  'gpt-5.6-luna': {
    input: 0.20, cachedInput: 0.02, output: 1.20,
    image: { kind: 'patch', multiplier: 1.2, patchBudget: 2500 },
    multimodal: true,
  },
  'gpt-5.6-terra': {
    input: 2.00, cachedInput: 0.20, output: 12.00,
    image: { kind: 'patch', multiplier: 1.2, patchBudget: 2500 },
    multimodal: true,
  },
  'gpt-5': {
    input: 1.25, cachedInput: 0.125, output: 10.0,
    image: { kind: 'tile', baseTokens: 70, tileTokens: 140 },
    multimodal: true,
  },
  'gpt-5-mini': {
    input: 0.25, cachedInput: 0.025, output: 2.0,
    image: { kind: 'patch', multiplier: 1.2, patchBudget: 1536 },
    multimodal: true,
  },
  'gpt-5-nano': {
    input: 0.05, cachedInput: 0.005, output: 0.4,
    image: { kind: 'patch', multiplier: 1.5, patchBudget: 1536 },
    multimodal: true,
  },
  'gpt-4.1': {
    input: 2.0, cachedInput: 0.5, output: 8.0,
    image: { kind: 'tile', baseTokens: 85, tileTokens: 170 },
    multimodal: true,
  },
  'gpt-4.1-mini': {
    input: 0.4, cachedInput: 0.1, output: 1.6,
    image: { kind: 'patch', multiplier: 1.62, patchBudget: 1536 },
    multimodal: true,
  },
};

export const DEFAULT_MODEL = 'gpt-5-mini';

export function pricingFor(model: string): ModelPricing {
  const p = PRICING[model];
  if (!p) {
    throw new Error(
      `no published pricing recorded for "${model}". Known: ${Object.keys(PRICING).join(', ')}. ` +
      'Add it to ai/pricing.ts with its source and date rather than guessing.',
    );
  }
  return p;
}

export interface CostBreakdown {
  model: string;
  textInputTokens: number;
  imageInputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  inputUsd: number;
  cachedUsd: number;
  outputUsd: number;
  totalUsd: number;
}

export function cost(
  model: string,
  parts: { textInputTokens: number; imageInputTokens: number; cachedInputTokens?: number; outputTokens: number },
): CostBreakdown {
  const p = pricingFor(model);
  const cached = parts.cachedInputTokens ?? 0;
  const billedInput = parts.textInputTokens + parts.imageInputTokens - cached;
  const inputUsd = (billedInput / 1e6) * p.input;
  const cachedUsd = (cached / 1e6) * p.cachedInput;
  const outputUsd = (parts.outputTokens / 1e6) * p.output;
  return {
    model,
    textInputTokens: parts.textInputTokens,
    imageInputTokens: parts.imageInputTokens,
    cachedInputTokens: cached,
    outputTokens: parts.outputTokens,
    inputUsd, cachedUsd, outputUsd,
    totalUsd: inputUsd + cachedUsd + outputUsd,
  };
}

/**
 * Image input tokens for one image, by the published algorithm.
 *
 * Patch-based: `ceil(w/32) * ceil(h/32)`, shrunk proportionally if it exceeds
 * the model's patch budget, then multiplied by the model's multiplier.
 * Tile-based: fit inside 2048x2048, scale the shortest side to 768 if larger,
 * then `base + 512px-tile-count * tileTokens`.
 *
 * The element crops this project produces are at most 900x640, which is 580
 * patches and 4 tiles — an order of magnitude under any published budget — so
 * the resize branches never fire here. They are implemented anyway so the
 * estimate does not silently become wrong if the crop geometry changes.
 */
export function imageTokens(model: string, width: number, height: number): number {
  const p = pricingFor(model).image;
  if (width <= 0 || height <= 0) return 0;

  if (p.kind === 'tile') {
    let w = width;
    let h = height;
    const fit = Math.min(1, 2048 / Math.max(w, h));
    w = Math.floor(w * fit);
    h = Math.floor(h * fit);
    const short = Math.min(w, h);
    if (short > 768) {
      const s = 768 / short;
      w = Math.floor(w * s);
      h = Math.floor(h * s);
    }
    const tiles = Math.ceil(w / 512) * Math.ceil(h / 512);
    return p.baseTokens + tiles * p.tileTokens;
  }

  let patches = Math.ceil(width / 32) * Math.ceil(height / 32);
  if (patches > p.patchBudget) {
    const shrink = Math.sqrt((p.patchBudget * 32 * 32) / (width * height));
    const w = Math.floor(width * shrink);
    const h = Math.floor(height * shrink);
    // Re-snap so the width is a whole number of patches, as the published
    // algorithm does, then recount.
    const snap = (Math.floor(w / 32) * 32) / width;
    patches = Math.ceil((width * snap) / 32) * Math.ceil((height * snap) / 32);
    void h;
  }
  return Math.ceil(patches * p.multiplier);
}
