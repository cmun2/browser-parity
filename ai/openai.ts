// The OpenAI adapter. Written, not exercised.
//
// BYOK. This project never proxies a model request and never pays for anyone's
// inference: the key comes from the user's environment, the request goes
// straight from their machine to OpenAI, and `store: false` means no copy of
// their page is retained server-side.
//
// Nothing here runs unless `investigate --provider openai` is passed AND
// OPENAI_API_KEY is set. `dryRun()` assembles and prices the exact request
// without sending it; that is the only path that has been executed.
//
// Zero dependencies: one `fetch` against the Responses API. No SDK.

import type {
  EvidenceBundle, Investigation, ToolCall, ToolName,
} from './types.ts';
import type { InvestigatorProvider, ProviderContext, ProviderTurn } from './provider.ts';
import { assembleRequest, INVESTIGATION_SCHEMA, SYSTEM_PROMPT } from './prompt.ts';
import type { AssembledRequest, RequestOptions } from './prompt.ts';
import { DEFAULT_MODEL, PRICING_AS_OF, PRICING_SOURCES, cost, pricingFor } from './pricing.ts';
import type { CostBreakdown } from './pricing.ts';
import {
  MESSAGE_OVERHEAD_TOKENS, countImage, countText, countToolSchemas, initTokenizer, tokenBackend,
} from './tokens.ts';

const ENDPOINT = 'https://api.openai.com/v1/responses';

export interface OpenAIOptions {
  model?: string;
  apiKey?: string;
  includeImages?: boolean;
  maxOutputTokens?: number;
  reasoningEffort?: RequestOptions['reasoningEffort'];
  /** hard ceiling in USD; the provider refuses to send past it. */
  spendCapUsd?: number;
  baseUrl?: string;
  timeoutMs?: number;
}

export class OpenAIProvider implements InvestigatorProvider {
  readonly id = 'openai';
  readonly tools: ToolName[] = ['inspect_element', 'read_computed_styles', 'rerun_engine', 'compare_screenshots'];
  readonly model: string;
  private opts: OpenAIOptions;
  private spent = 0;
  /** every HTTP request this provider has made, billed or not. */
  requests = 0;
  /** called with the raw request and response for every exchange. */
  onExchange?: (x: { findingId: string; turn: number; status: number; request: unknown; response: unknown }) => void;

  get spentUsd(): number { return this.spent; }

  constructor(opts: OpenAIOptions = {}) {
    this.opts = opts;
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  /**
   * Never throws. A missing key is the normal case — most users of this tool
   * will never set one — and it must read as a supported configuration, not as
   * a crash.
   */
  available(): { ok: true } | { ok: false; reason: string } {
    const key = this.opts.apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      return {
        ok: false,
        reason:
          'OPENAI_API_KEY is not set, so the AI investigator is off. The deterministic findings and the known-cause ' +
          'explanations above are complete without it — the model layer only ever adds explanations for the residue.\n' +
          '  To turn it on:  export OPENAI_API_KEY=sk-...\n' +
          '  To see what one investigation would cost first, and send nothing:  investigate --dry-run\n' +
          '  BrowserParity never proxies model requests: your key is used from your machine, against your account.',
      };
    }
    if (!key.startsWith('sk-')) {
      return { ok: false, reason: 'OPENAI_API_KEY does not look like an OpenAI key (expected it to start with "sk-"). Nothing was sent.' };
    }
    try {
      pricingFor(this.model);
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
    return { ok: true };
  }

  async investigate(evidence: EvidenceBundle, ctx: ProviderContext): Promise<ProviderTurn> {
    const avail = this.available();
    if (!avail.ok) throw new Error(avail.reason);

    const assembled = assembleRequest(evidence, {
      model: this.model,
      includeImages: this.opts.includeImages,
      maxOutputTokens: this.opts.maxOutputTokens,
      // Low, not default. The evidence is already assembled and the question is
      // narrow; on a reasoning model the default effort mostly buys reasoning
      // tokens, which are billed as output at 8x the input rate.
      reasoningEffort: this.opts.reasoningEffort ?? 'low',
      priorKnownCause: ctx.priorKnownCause,
    });

    // Multi-turn, statelessly.
    //
    // `previous_response_id` is the obvious way to continue a conversation and
    // it does not work here: it resolves against a response OpenAI stored, and
    // we send `store: false` precisely so that no copy of the user's page is
    // kept server-side. Privacy wins, so the whole conversation is resent each
    // turn — the original user message, the model's function_call items, and
    // our function_call_output items, in order.
    const body: Record<string, unknown> = { ...assembled.request };
    const prior = (ctx.state as ConversationState | undefined);
    if (ctx.turn > 0 && prior) {
      body.input = [
        ...prior.input,
        ...prior.calls,
        ...ctx.toolResults.map((r) => ({
          type: 'function_call_output',
          call_id: r.id,
          output: JSON.stringify(r.ok ? r.content : { error: r.content }),
        })),
      ];
    }
    const sentInput = body.input as unknown[];

    if (this.opts.spendCapUsd != null) {
      const est = estimateCost(assembled, this.model);
      if (this.spent + est.totalUsd > this.opts.spendCapUsd) {
        throw new Error(
          `refusing to send: estimated $${est.totalUsd.toFixed(4)} would take this run past the --spend-cap of ` +
          `$${this.opts.spendCapUsd.toFixed(2)} (already spent $${this.spent.toFixed(4)}).`,
        );
      }
    }

    const key = this.opts.apiKey ?? process.env.OPENAI_API_KEY!;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 120_000);
    let res: Response;
    try {
      res = await fetch(this.opts.baseUrl ?? ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    this.requests++;
    const raw = await res.text();
    if (!res.ok) {
      this.onExchange?.({ findingId: evidence.findingId, turn: ctx.turn, status: res.status, request: body, response: raw });
      throw new Error(`OpenAI responded ${res.status}: ${raw.slice(0, 600)}`);
    }
    const json = JSON.parse(raw) as OpenAIResponse;
    this.onExchange?.({ findingId: evidence.findingId, turn: ctx.turn, status: res.status, request: body, response: json });
    return this.parse(json, evidence, sentInput);
  }

  private parse(json: OpenAIResponse, evidence: EvidenceBundle, sentInput: unknown[]): ProviderTurn {
    const usage = usageFrom(json, this.model);
    if (usage) this.spent += usage.costUsd;

    const calls: ToolCall[] = [];
    let text = '';
    for (const item of json.output ?? []) {
      if (item.type === 'function_call') {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(item.arguments ?? '{}'); } catch { /* keep {} */ }
        calls.push({ id: item.call_id ?? item.id ?? '', name: item.name as ToolName, args });
      } else if (item.type === 'message') {
        for (const c of item.content ?? []) if (c.type === 'output_text') text += c.text ?? '';
      }
    }

    if (calls.length) {
      // Carry the model's own function_call items forward verbatim; the API
      // requires each function_call_output to be preceded by its call.
      const rawCalls = (json.output ?? []).filter((i) => i.type === 'function_call' || i.type === 'reasoning');
      return { toolCalls: calls, state: { input: sentInput, calls: rawCalls } as ConversationState, usage };
    }

    if (!text.trim()) {
      const why = json.status === 'incomplete'
        ? `the response came back incomplete (${json.incomplete_details?.reason ?? 'unknown reason'}) — it was billed and produced no text. Raise max_output_tokens.`
        : 'the model returned neither a verdict nor a tool call';
      return { investigation: unresolvedInvestigation(evidence, why), state: undefined, usage };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        investigation: unresolvedInvestigation(evidence, `the model returned text that is not valid JSON: ${text.slice(0, 200)}`),
        state: undefined, usage,
      };
    }

    const fix = parsed.fix as { description?: string; css?: string | null } | null;
    return {
      investigation: {
        findingId: evidence.findingId,
        cause: String(parsed.cause ?? 'unknown'),
        summary: String(parsed.summary ?? ''),
        mechanism: String(parsed.mechanism ?? ''),
        verdict: (parsed.verdict as Investigation['verdict']) ?? 'unclear',
        confidence: (parsed.confidence as Investigation['confidence']) ?? 'low',
        oddEngineOut: (parsed.oddEngineOut as Investigation['oddEngineOut']) ?? evidence.oddEngineOut,
        fix: fix?.description ? { description: fix.description, css: fix.css ?? undefined } : null,
        evidenceCited: Array.isArray(parsed.evidenceCited) ? (parsed.evidenceCited as string[]) : [],
        unresolved: Array.isArray(parsed.unresolved) ? (parsed.unresolved as string[]) : [],
      },
      state: undefined,
      usage,
    };
  }
}

/** Everything needed to resend a conversation that the server did not store. */
interface ConversationState {
  input: unknown[];
  calls: unknown[];
}

function unresolvedInvestigation(e: EvidenceBundle, why: string): Omit<Investigation, 'schema' | 'source'> {
  return {
    findingId: e.findingId,
    cause: 'unresolved',
    summary: 'The investigator did not reach a conclusion.',
    mechanism: why,
    verdict: 'unclear',
    confidence: 'low',
    oddEngineOut: e.oddEngineOut,
    fix: null,
    evidenceCited: [],
    unresolved: [why],
  };
}

// ---------------------------------------------------------------- wire types

interface OpenAIResponse {
  id?: string;
  status?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{
    type: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
  };
}

function usageFrom(json: OpenAIResponse, model: string): Investigation['usage'] {
  const u = json.usage;
  if (!u) return undefined;
  const cached = u.input_tokens_details?.cached_tokens ?? 0;
  const c = cost(model, {
    textInputTokens: (u.input_tokens ?? 0) - cached,
    imageInputTokens: 0,  // already inside input_tokens as reported by the API
    cachedInputTokens: cached,
    outputTokens: u.output_tokens ?? 0,
  });
  return {
    model,
    inputTokens: u.input_tokens ?? 0,
    cachedInputTokens: cached,
    outputTokens: u.output_tokens ?? 0,
    imageTokens: 0,
    reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
    costUsd: +c.totalUsd.toFixed(6),
  };
}

// ---------------------------------------------------------------- dry run

export interface DryRun {
  model: string;
  pricingAsOf: string;
  pricingSources: string[];
  tokenBackend: string;
  request: AssembledRequest['request'];
  counts: {
    systemPromptTokens: number;
    evidenceTokens: number;
    imageLabelTokens: number;
    toolSchemaTokens: number;
    outputSchemaTokens: number;
    messageOverheadTokens: number;
    textInputTokens: number;
    imageInputTokens: number;
    totalInputTokens: number;
    assumedOutputTokens: number;
  };
  images: AssembledRequest['images'];
  cost: CostBreakdown;
  /** what a multi-turn investigation costs, with turn 1 priced as above. */
  withToolTurns: { turns: number; totalUsd: number };
  payloadBytes: number;
}

const ASSUMED_OUTPUT_TOKENS = 450;

function estimateCost(a: AssembledRequest, model: string): CostBreakdown {
  const counts = countRequest(a, model);
  return cost(model, {
    textInputTokens: counts.textInputTokens,
    imageInputTokens: counts.imageInputTokens,
    outputTokens: ASSUMED_OUTPUT_TOKENS,
  });
}

function countRequest(a: AssembledRequest, model: string) {
  const systemPromptTokens = countText(SYSTEM_PROMPT);
  const evidenceTokens = countText(a.evidenceText);
  // The per-image caption lines, which are text and are billed as text.
  const imageLabelTokens = a.images.reduce(
    (n, im) => n + countText(`crop: ${im.engine}, ${im.width}x${im.height}px, element outlined in red, all three crops framed identically`),
    0,
  );
  const toolSchemaTokens = countToolSchemas(a.request.tools);
  const outputSchemaTokens = countText(JSON.stringify(INVESTIGATION_SCHEMA));
  const messageOverheadTokens = MESSAGE_OVERHEAD_TOKENS * (1 + a.images.length);
  const textInputTokens =
    systemPromptTokens + evidenceTokens + imageLabelTokens + toolSchemaTokens + outputSchemaTokens + messageOverheadTokens;
  const imageInputTokens = a.images.reduce((n, im) => n + countImage(model, im.width, im.height), 0);
  return {
    systemPromptTokens, evidenceTokens, imageLabelTokens, toolSchemaTokens, outputSchemaTokens,
    messageOverheadTokens, textInputTokens, imageInputTokens,
    totalInputTokens: textInputTokens + imageInputTokens,
    assumedOutputTokens: ASSUMED_OUTPUT_TOKENS,
  };
}

/**
 * Assemble the exact request, price it, and send nothing.
 *
 * This is the only function in this file that has been run. It makes no network
 * call of any kind — not to OpenAI, not to a tokenizer service, not to a
 * pricing endpoint. The prices are the hand-copied constants in ai/pricing.ts.
 */
export async function dryRun(
  evidence: EvidenceBundle,
  opts: OpenAIOptions & { priorKnownCause?: Investigation | null; toolTurns?: number } = {},
): Promise<DryRun> {
  await initTokenizer();
  const model = opts.model ?? DEFAULT_MODEL;
  const assembled = assembleRequest(evidence, {
    model,
    includeImages: opts.includeImages,
    maxOutputTokens: opts.maxOutputTokens,
    reasoningEffort: opts.reasoningEffort,
    priorKnownCause: opts.priorKnownCause ?? null,
  });
  const counts = countRequest(assembled, model);
  const c = cost(model, {
    textInputTokens: counts.textInputTokens,
    imageInputTokens: counts.imageInputTokens,
    outputTokens: counts.assumedOutputTokens,
  });

  // A tool turn resends the conversation. The images are attached once, and
  // OpenAI's automatic prompt caching discounts the repeated prefix, so a
  // follow-up turn is priced with the whole input at the cached rate plus a
  // small tool-output payload.
  const turns = opts.toolTurns ?? 2;
  const p = pricingFor(model);
  const perFollowUp =
    (counts.totalInputTokens / 1e6) * p.cachedInput +
    (300 / 1e6) * p.input +
    (counts.assumedOutputTokens / 1e6) * p.output;
  const withToolTurns = { turns, totalUsd: c.totalUsd + Math.max(0, turns - 1) * perFollowUp };

  return {
    model,
    pricingAsOf: PRICING_AS_OF,
    pricingSources: PRICING_SOURCES,
    tokenBackend: tokenBackend(),
    request: assembled.request,
    counts,
    images: assembled.images,
    cost: c,
    withToolTurns,
    payloadBytes: JSON.stringify(assembled.request).length,
  };
}

/** Redact the base64 image blobs so the assembled request can be printed. */
export function printableRequest(req: AssembledRequest['request']): unknown {
  return JSON.parse(JSON.stringify(req, (k, v) => {
    if (k === 'image_url' && typeof v === 'string' && v.startsWith('data:')) {
      return `data:image/png;base64,<${v.length - 22} base64 chars elided>`;
    }
    return v;
  }));
}
