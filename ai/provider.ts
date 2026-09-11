// The provider seam.
//
// Everything above this line in the stack — evidence assembly, the known-cause
// matcher, the tool loop, the report — is deterministic and model-free. A
// provider is the only thing that may be probabilistic, and it is optional: if
// none is configured, `investigate()` still returns known-cause investigations
// and says plainly which findings it could not explain.

import type {
  EvidenceBundle, Investigation, ToolCall, ToolExecutor, ToolName, ToolResult,
} from './types.ts';

/** What a provider returns for one turn: either a verdict or tool calls. */
export interface ProviderTurn {
  /** set when the provider is done. */
  investigation?: Omit<Investigation, 'schema' | 'source'>;
  /** set when the provider wants evidence it does not have. */
  toolCalls?: ToolCall[];
  /** opaque provider state threaded through the loop (e.g. response id). */
  state?: unknown;
  usage?: Investigation['usage'];
}

export interface ProviderContext {
  /** turns already taken, 0 on the first call. */
  turn: number;
  /** results of the tool calls the provider asked for last turn. */
  toolResults: ToolResult[];
  /** provider state returned last turn. */
  state?: unknown;
  /** the deterministic matcher's opinion, when it had one. */
  priorKnownCause?: Investigation | null;
}

export interface InvestigatorProvider {
  readonly id: string;
  /** tools this provider is allowed to call. */
  readonly tools: ToolName[];
  /** true when the provider can actually run right now (key present, etc.). */
  available(): { ok: true } | { ok: false; reason: string };
  investigate(evidence: EvidenceBundle, ctx: ProviderContext): Promise<ProviderTurn>;
}

// ------------------------------------------------------------ tool schemas
//
// One definition, shared by every provider, so the mock and the real adapter
// cannot drift. Kept minimal on purpose: each tool returns something the
// deterministic side already knows how to produce.

export interface ToolSchema {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'inspect_element',
    description:
      'Return the recorded box (width, height, parent-relative and absolute offset) for one element, in all three engines. ' +
      'Use it to walk up or down from the finding — e.g. to check whether the parent is the same width everywhere.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          description: 'Structural path, e.g. BODY[1]/DIV[1]/TABLE[1]/TBODY[1]/TR[3]/TD[2].',
        },
      },
    },
  },
  {
    name: 'read_computed_styles',
    description:
      'Return the collected computed styles for one element in all three engines. ' +
      'Only the curated property set is collected; unknown properties come back as null rather than a guess.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      // Strict function schemas require every property to appear in `required`,
      // so an optional argument is expressed as a nullable one.
      required: ['path', 'properties'],
      properties: {
        path: { type: 'string', description: 'Structural path of the element.' },
        properties: {
          type: ['array', 'null'],
          items: { type: 'string' },
          description: 'CSS property names in camelCase. Pass null for the whole collected set.',
        },
      },
    },
  },
  {
    name: 'rerun_engine',
    description:
      'Re-collect one engine on the same page and report whether the element measures the same as it did in the run under review. ' +
      'Use it to separate "the engines disagree" from "the measurement is unstable".',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['engine', 'path'],
      properties: {
        engine: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
        path: { type: 'string', description: 'Structural path of the element to re-measure.' },
      },
    },
  },
  {
    name: 'compare_screenshots',
    description:
      'Return the pixel dimensions and on-disk paths of the three element crops, plus which pairs are byte-identical. ' +
      'The crops are already attached to the first message; this is for checking whether two engines rendered identically.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {},
    },
  },
];

export function toolSchema(name: ToolName): ToolSchema {
  const s = TOOL_SCHEMAS.find((t) => t.name === name);
  if (!s) throw new Error(`unknown tool: ${name}`);
  return s;
}

// ------------------------------------------------------------ the loop

export interface RunOptions {
  /** hard cap on provider turns. Exceeding it is an outcome, not an error. */
  maxTurns?: number;
  priorKnownCause?: Investigation | null;
}

export interface RunResult {
  investigation: Investigation | null;
  turns: number;
  toolCalls: ToolCall[];
  /** why the loop stopped without an investigation, if it did. */
  stopReason: 'done' | 'max-turns' | 'no-tools' | 'provider-unavailable';
  usage?: Investigation['usage'];
}

/**
 * Drive one provider to a verdict, executing its tool calls locally.
 *
 * The loop is the same for the mock and for a real model, which is the point:
 * prompt assembly, tool calling, the rerun step and verdict rendering are all
 * exercised at zero cost by the mock.
 */
export async function runProvider(
  provider: InvestigatorProvider,
  evidence: EvidenceBundle,
  executor: ToolExecutor,
  opts: RunOptions = {},
): Promise<RunResult> {
  const maxTurns = opts.maxTurns ?? 4;
  const avail = provider.available();
  if (!avail.ok) {
    return { investigation: null, turns: 0, toolCalls: [], stopReason: 'provider-unavailable' };
  }

  const allCalls: ToolCall[] = [];
  let toolResults: ToolResult[] = [];
  let state: unknown = undefined;
  let usage: Investigation['usage'] | undefined;

  for (let turn = 0; turn < maxTurns; turn++) {
    const out = await provider.investigate(evidence, {
      turn,
      toolResults,
      state,
      priorKnownCause: opts.priorKnownCause ?? null,
    });
    state = out.state;
    if (out.usage) usage = mergeUsage(usage, out.usage);

    if (out.investigation) {
      return {
        investigation: { ...out.investigation, schema: 'browser-parity/investigation/1', source: providerSource(provider.id), usage },
        turns: turn + 1,
        toolCalls: allCalls,
        stopReason: 'done',
        usage,
      };
    }

    const calls = out.toolCalls ?? [];
    if (calls.length === 0) {
      return { investigation: null, turns: turn + 1, toolCalls: allCalls, stopReason: 'no-tools', usage };
    }

    allCalls.push(...calls);
    toolResults = [];
    for (const call of calls) {
      if (!executor.supports.includes(call.name)) {
        toolResults.push({
          id: call.id, name: call.name, ok: false,
          content: `tool "${call.name}" is not available in this run (executor: ${executor.id}). Answer from the evidence you already have.`,
        });
        continue;
      }
      toolResults.push(await executor.run(call, evidence));
    }
  }

  return { investigation: null, turns: maxTurns, toolCalls: allCalls, stopReason: 'max-turns', usage };
}

function providerSource(id: string): Investigation['source'] {
  return id.startsWith('mock') ? 'mock' : 'model';
}

function mergeUsage(a: Investigation['usage'], b: Investigation['usage']): Investigation['usage'] {
  if (!a) return b;
  if (!b) return a;
  return {
    model: b.model,
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    imageTokens: a.imageTokens + b.imageTokens,
    costUsd: +(a.costUsd + b.costUsd).toFixed(6),
  };
}
