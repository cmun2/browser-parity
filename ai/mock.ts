// The mock provider.
//
// Runs the whole investigator flow — prompt assembly, tool calling, the rerun
// step, structured output, verdict rendering — from recorded fixtures. Zero
// cost, zero network, deterministic, and therefore runnable in CI forever.
//
// The fixtures in ai/fixtures/ are hand-authored stand-ins, not captured model
// output: this milestone made no paid API calls. They are shaped exactly like a
// real response so that swapping OpenAIProvider in changes nothing but the
// source of the bytes. When a real run is eventually recorded, it replaces the
// file and nothing else.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvidenceBundle, Investigation, ToolCall, ToolName } from './types.ts';
import type { InvestigatorProvider, ProviderContext, ProviderTurn } from './provider.ts';
import { assembleRequest } from './prompt.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));

interface FixtureTurn {
  toolCalls?: Array<{ id: string; name: ToolName; args: Record<string, unknown> }>;
  investigation?: Omit<Investigation, 'schema' | 'source'>;
  /** asserted against the tool results before continuing; a mismatch is a test failure. */
  expectToolResults?: number;
}

interface FixtureFile {
  schema: string;
  recordedFrom: string;
  byFinding: Record<string, { turns: FixtureTurn[] }>;
  byRule?: Record<string, { turns: FixtureTurn[] }>;
  fallback: { turns: FixtureTurn[] };
}

export interface MockOptions {
  fixtureFile?: string;
  /** assemble the real request on every turn, so the mock exercises that code too. */
  assemble?: boolean;
  model?: string;
}

export class MockProvider implements InvestigatorProvider {
  readonly id = 'mock';
  readonly tools: ToolName[] = ['inspect_element', 'read_computed_styles', 'rerun_engine', 'compare_screenshots'];
  /** every request the mock assembled, for tests that assert on prompt shape. */
  readonly assembled: Array<{ findingId: string; turn: number; bytes: number; hasImages: boolean }> = [];
  readonly toolResultsSeen: Array<{ turn: number; ok: boolean; name: string }> = [];

  private fixtures: FixtureFile;
  private opts: MockOptions;

  constructor(opts: MockOptions = {}) {
    this.opts = opts;
    const file = opts.fixtureFile ?? path.join(HERE, 'fixtures', 'investigations.json');
    this.fixtures = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  available(): { ok: true } | { ok: false; reason: string } {
    return { ok: true };
  }

  async investigate(evidence: EvidenceBundle, ctx: ProviderContext): Promise<ProviderTurn> {
    // Assemble the request even though nothing is sent. This is the point of the
    // mock: the expensive path and the free path differ only in the last hop, so
    // a bug in prompt assembly fails in CI rather than on the owner's card.
    if (this.opts.assemble !== false) {
      const a = assembleRequest(evidence, {
        model: this.opts.model ?? 'gpt-5-mini',
        priorKnownCause: ctx.priorKnownCause,
      });
      this.assembled.push({
        findingId: evidence.findingId,
        turn: ctx.turn,
        bytes: JSON.stringify(a.request).length,
        hasImages: a.images.length > 0,
      });
    }
    for (const r of ctx.toolResults) {
      this.toolResultsSeen.push({ turn: ctx.turn, ok: r.ok, name: r.name });
    }

    const script =
      this.fixtures.byFinding[evidence.findingId] ??
      (ctx.priorKnownCause?.ruleId ? this.fixtures.byRule?.[ctx.priorKnownCause.ruleId] : undefined) ??
      this.fixtures.fallback;

    const turn = script.turns[Math.min(ctx.turn, script.turns.length - 1)];
    if (!turn) return { toolCalls: [] };

    if (turn.expectToolResults != null && ctx.toolResults.length !== turn.expectToolResults) {
      throw new Error(
        `mock fixture for ${evidence.findingId} turn ${ctx.turn} expected ${turn.expectToolResults} tool results, got ${ctx.toolResults.length}`,
      );
    }

    if (turn.toolCalls) {
      const calls: ToolCall[] = turn.toolCalls.map((c) => ({
        ...c,
        // Let a fixture say `"args": {"path": "$element"}` and get the real path.
        args: Object.fromEntries(Object.entries(c.args).map(([k, v]) => [k, resolve(v, evidence)])),
      }));
      return { toolCalls: calls, state: `mock-turn-${ctx.turn}` };
    }

    if (turn.investigation) {
      const inv = { ...turn.investigation, findingId: evidence.findingId };
      // Templated fields, so one fixture can stand in for a family of findings.
      inv.summary = fill(inv.summary, evidence);
      inv.mechanism = fill(inv.mechanism, evidence);
      inv.oddEngineOut = inv.oddEngineOut ?? evidence.oddEngineOut;
      return {
        investigation: inv,
        state: `mock-turn-${ctx.turn}`,
        usage: { model: 'mock', inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, imageTokens: 0, costUsd: 0 },
      };
    }

    return { toolCalls: [] };
  }
}

function resolve(v: unknown, e: EvidenceBundle): unknown {
  if (v === '$element') return e.element.path;
  if (v === '$parent') return e.ancestors[0]?.path ?? e.element.path;
  if (v === '$culprit') return e.descendantCulprits[0]?.path ?? e.element.path;
  return v;
}

function fill(s: string, e: EvidenceBundle): string {
  const top = e.properties[0];
  return s
    .replaceAll('{tag}', e.element.tag.toLowerCase())
    .replaceAll('{selector}', e.element.selector)
    .replaceAll('{prop}', top?.prop ?? 'width')
    .replaceAll('{delta}', top ? top.deltaPx.toFixed(2) : '0')
    .replaceAll('{odd}', e.oddEngineOut ?? 'one engine')
    .replaceAll('{page}', e.page);
}
