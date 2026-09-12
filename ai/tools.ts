// Tool execution for the investigator loop.
//
// The provider asks; this answers. Every answer comes from data the
// deterministic pipeline already recorded, so a tool call costs a file read,
// not a browser launch — and the loop is identical whether the asker is the
// mock or a real model.
//
// `rerun_engine` is the exception: it is the one tool that genuinely needs a
// browser. Offline it returns a clean "not available", which is a result, not
// an error, and the provider is told to answer from what it has.

import fs from 'node:fs';
import type { EvidenceBundle, ToolCall, ToolExecutor, ToolName, ToolResult } from './types.ts';
import { ENGINES } from './types.ts';
import type { Corpus } from './evidence.ts';

const bad = (call: ToolCall, why: string): ToolResult =>
  ({ id: call.id, name: call.name, ok: false, content: why });

export class CorpusToolExecutor implements ToolExecutor {
  readonly id = 'corpus';
  readonly supports: ToolName[] = ['inspect_element', 'read_computed_styles', 'compare_screenshots', 'rerun_engine'];
  private corpus: Corpus;

  constructor(corpus: Corpus) {
    this.corpus = corpus;
  }

  async run(call: ToolCall, evidence: EvidenceBundle): Promise<ToolResult> {
    const dump = this.corpus.dump(evidence.page);

    switch (call.name) {
      case 'inspect_element': {
        const p = String(call.args.path ?? '');
        if (!p) return bad(call, 'path is required');
        if (!dump) return bad(call, 'the per-page node dump is not on disk for this run; use the evidence you were given');
        const out: Record<string, unknown> = { path: p };
        let found = false;
        for (const e of ENGINES) {
          const n = dump.data[e]?.[p];
          if (!n) continue;
          found = true;
          out[e] = { w: n.w, h: n.h, rx: n.rx, ry: n.ry, ax: n.ax, ay: n.ay, tag: n.tag, display: n.disp, selector: n.sel };
        }
        if (!found) return bad(call, `no element at path ${p}. Paths are TAG[nth-of-same-tag] segments joined by "/", starting at BODY[1].`);
        return { id: call.id, name: call.name, ok: true, content: out };
      }

      case 'read_computed_styles': {
        const p = String(call.args.path ?? '');
        if (!p) return bad(call, 'path is required');
        if (!dump) return bad(call, 'the per-page node dump is not on disk for this run; use the evidence you were given');
        const wanted = Array.isArray(call.args.properties) ? (call.args.properties as string[]) : null;
        const out: Record<string, unknown> = { path: p };
        let found = false;
        const missing = new Set<string>();
        for (const e of ENGINES) {
          const n = dump.data[e]?.[p];
          if (!n) continue;
          found = true;
          const styles: Record<string, string | null> = {};
          for (const k of wanted ?? Object.keys(n.styles)) {
            if (k in n.styles) styles[k] = n.styles[k];
            else { styles[k] = null; missing.add(k); }
          }
          out[e] = styles;
        }
        if (!found) return bad(call, `no element at path ${p}`);
        if (missing.size) {
          out.note =
            `${[...missing].join(', ')} ${missing.size === 1 ? 'was' : 'were'} not collected by this pipeline and comes back null. ` +
            'The collected set is fixed; do not infer a value for a null.';
        }
        return { id: call.id, name: call.name, ok: true, content: out };
      }

      case 'compare_screenshots': {
        const crops = ENGINES.map((e) => evidence.crops[e]);
        const hashes = new Map<string, string[]>();
        for (const c of crops) {
          if (!c.file) continue;
          const h = fs.readFileSync(c.file).toString('base64').slice(0, 64);
          const arr = hashes.get(h) ?? [];
          arr.push(c.engine);
          hashes.set(h, arr);
        }
        const identical = [...hashes.values()].filter((g) => g.length > 1);
        return {
          id: call.id, name: call.name, ok: true,
          content: {
            crops: crops.map((c) => ({ engine: c.engine, width: c.width, height: c.height, bytes: c.bytes, rendered: c.file != null })),
            identicalGroups: identical,
            note: identical.length
              ? `${identical.map((g) => g.join(' and ')).join('; ')} rendered byte-identically at this crop; the divergence is in the remaining engine.`
              : 'No two crops are byte-identical. Note that all three crops are the same pixel size by construction, so a size difference shows as content shifting inside the frame, not as a different frame.',
          },
        };
      }

      case 'rerun_engine': {
        // A rerun needs a browser. This executor is deliberately offline — the
        // determinism question it would answer was already answered once, by
        // m0/scripts/run.mjs re-collecting Chromium twice per page.
        const engine = String(call.args.engine ?? '');
        const selfConsistent = (this.corpus.survivors as unknown as { pages: Array<{ id: string; selfConsistent?: boolean; selfDeltaPx?: number }> })
          .pages.find((p) => p.id === evidence.page);
        return {
          id: call.id, name: call.name, ok: true,
          content: {
            available: false,
            reason: 'This run is offline; re-collecting an engine requires launching a browser.',
            recordedDeterminism: selfConsistent
              ? {
                  engine: 'chromium',
                  selfConsistent: selfConsistent.selfConsistent ?? null,
                  maxSelfDeltaPx: selfConsistent.selfDeltaPx ?? null,
                  note: 'The pipeline re-collected this page twice in the same engine. A page that disagrees with itself would be flagged here.',
                }
              : null,
            asked: engine,
          },
        };
      }

      default:
        return bad(call, `unknown tool ${call.name}`);
    }
  }
}

/**
 * An executor that supports nothing. Useful for proving that the loop
 * terminates cleanly when a provider asks for evidence that cannot be fetched.
 */
export class NullToolExecutor implements ToolExecutor {
  readonly id = 'null';
  readonly supports: ToolName[] = [];
  async run(call: ToolCall): Promise<ToolResult> {
    return bad(call, 'no tools are available in this run');
  }
}
