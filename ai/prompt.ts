// Prompt assembly and the structured-output schema.
//
// One place builds the request, so the mock and the real adapter cannot drift,
// and the dry run prints exactly what would be sent rather than an
// approximation of it.

import fs from 'node:fs';
import type { EvidenceBundle, Investigation } from './types.ts';
import { ENGINES } from './types.ts';
import { TOOL_SCHEMAS } from './provider.ts';
import type { ToolSchema } from './provider.ts';

export const SYSTEM_PROMPT = `You explain why three browser engines laid out the same element differently.

A deterministic pipeline has already done the measuring and the suppression. It compared Chromium, Firefox and WebKit rendering the same page at the same moment, discarded SVG interiors, inline text nodes, sub-tolerance deltas and parent-inherited deltas, and what reaches you is what survived. Your job is the one thing it cannot do: say WHY.

Rules:
- The measurements are ground truth. Never dispute a number you were given; explain it.
- Name a mechanism, not a category. "Text metrics differ" is not an answer. "The <button> sets font-size but not font-family, so it falls back to each engine's UA control font, and Chromium's Arial is narrower than WebKit's system-ui" is.
- Only cite evidence you were actually given. Computed styles outside the collected set come back as null from the tools; a null is not permission to assume a value.
- A difference in how an engine serialises a computed value is not a rendering difference. font-family quoting and BlinkMacSystemFont/system-ui aliasing have already been filtered out for you.
- Distinguish the element being wrong from the element being moved. If width and height agree in all three engines and only the offset differs, the cause is elsewhere in the flow; say where and stop.
- Playwright's WebKit is not Safari. Do not claim anything about Safari or iOS.
- If the evidence does not support a specific mechanism, say so and set confidence to low. An honest "I cannot tell from this" is worth more than a plausible story.

Use the tools when a specific measurement would settle the question. Do not use them to browse.`;

export interface RequestOptions {
  model: string;
  /** attach the three element crops. */
  includeImages?: boolean;
  /** cap on output tokens. */
  maxOutputTokens?: number;
  /** the deterministic matcher's answer, offered for the model to confirm or overturn. */
  priorKnownCause?: Investigation | null;
  /** reasoning effort, for models that take it. */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

// ---------------------------------------------------------------- evidence text

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * The evidence, rendered for a model. Compact on purpose: this is the part of
 * the request whose size we control, and every line here is a line we pay for
 * on every investigation.
 */
export function renderEvidence(e: EvidenceBundle): string {
  const L: string[] = [];
  L.push(`# finding ${e.findingId}  (page ${e.page}, corpus ${e.corpus})`);
  L.push('');
  L.push(`element   <${e.element.tag.toLowerCase()}>${e.element.selector ? ' ' + e.element.selector : ''}   display: ${e.element.display}`);
  L.push(`path      ${e.element.path}`);
  if (e.element.text) L.push(`text      ${JSON.stringify(e.element.text)}`);
  L.push('');

  L.push('## what differs');
  for (const p of e.properties) {
    L.push(`${p.prop.padEnd(9)} Δ${num(p.deltaPx)}px   ` + ENGINES.map((x) => `${x} ${num(p.values[x])}`).join('   '));
  }
  L.push('');
  L.push('## box, per engine  (w h, parent-relative x y, absolute x y)');
  for (const x of ENGINES) {
    const g = e.geometry[x];
    L.push(`${x.padEnd(9)} ${num(g.w)} x ${num(g.h)}   rel ${num(g.rx)},${num(g.ry)}   abs ${num(g.ax)},${num(g.ay)}`);
  }
  L.push('');

  const diffKeys = Object.keys(e.styleDiffs);
  L.push('## computed styles that differ');
  if (!diffKeys.length) {
    L.push('(none — every collected style that bears on this property is identical in all three engines)');
  } else {
    for (const k of diffKeys) {
      L.push(`${k.padEnd(16)} ` + ENGINES.map((x) => `${x}: ${e.styleDiffs[k][x]}`).join('   '));
    }
  }
  if (e.serialisationOnly.length) {
    L.push(`(filtered as serialisation-only, not rendering differences: ${e.serialisationOnly.join(', ')})`);
  }
  L.push('');

  const shared = Object.keys(e.styles.chromium).filter((k) => !diffKeys.includes(k));
  if (shared.length) {
    L.push('## computed styles, same in all three');
    L.push(shared.map((k) => `${k}: ${e.styles.chromium[k]}`).join('; '));
    L.push('');
  }

  L.push('## ancestors  (nearest first)');
  for (const a of e.ancestors) {
    const g = a.geometry;
    const measured = ENGINES.some((x) => g[x].w || g[x].h);
    L.push(
      `${String(a.depth).padStart(2)}  <${a.tag.toLowerCase()}>${a.selector ? ' ' + a.selector : ''}` +
      (measured ? `   w ${ENGINES.map((x) => num(g[x].w)).join('/')}   h ${ENGINES.map((x) => num(g[x].h)).join('/')}` : '   (not measured)') +
      (a.styles.chromium?.display ? `   display: ${a.styles.chromium.display}` : ''),
    );
    const ad = Object.keys(a.styleDiffs);
    if (ad.length) L.push(`      differing styles: ${ad.map((k) => `${k} ${ENGINES.map((x) => a.styleDiffs[k][x]).join('/')}`).join('; ')}`);
  }
  L.push('');

  if (e.descendantCulprits.length) {
    L.push('## descendants carrying the same size delta  (innermost first)');
    for (const c of e.descendantCulprits) {
      L.push(
        `  +${c.depth}  <${c.tag.toLowerCase()}>${c.selector ? ' ' + c.selector : ''}   ` +
        `w ${ENGINES.map((x) => num(c.size[x].w)).join('/')}   h ${ENGINES.map((x) => num(c.size[x].h)).join('/')}   ` +
        `Δw ${num(c.widthDelta)} Δh ${num(c.heightDelta)}${c.innermost ? '   <- innermost' : ''}`,
      );
    }
    L.push('');
  }

  if (e.related.length) {
    L.push(`## other survivors on this page  (${e.related.length} shown)`);
    for (const r of e.related) {
      L.push(
        `  ${r.id}  <${r.tag.toLowerCase()}>  ` +
        r.properties.map((p) => `${p.prop} Δ${num(p.deltaPx)}`).join(' ') +
        (r.isAncestor ? '   [ancestor of the subject]' : r.isDescendant ? '   [descendant of the subject]' : ''),
      );
    }
    L.push('');
  }

  L.push(`symptoms sharing this exact delta on this page: ${e.symptomCount}`);
  if (e.oddEngineOut) L.push(`engine furthest from the other two on the largest-delta property: ${e.oddEngineOut}`);
  L.push('');
  L.push('## environment');
  L.push(
    `${ENGINES.map((x) => `${x} ${e.environment.engineVersions[x]}`).join(' · ')} · playwright ${e.environment.playwrightVersion} · ` +
    `${e.environment.os} · viewport ${e.environment.viewport.width}x${e.environment.viewport.height} @${e.environment.deviceScaleFactor}x · ` +
    `normalization: ${e.environment.normalizationPreset}`,
  );
  L.push(`font fingerprint: ${e.environment.fontFingerprint}`);

  return L.join('\n');
}

export function renderPriorCause(prior: Investigation): string {
  return [
    '## the deterministic matcher already has an answer',
    `rule       ${prior.ruleId}`,
    `cause      ${prior.cause}`,
    `confidence ${prior.confidence}`,
    `summary    ${prior.summary}`,
    `mechanism  ${prior.mechanism}`,
    '',
    'Confirm it or overturn it. If you confirm it, say so and stop — do not re-derive it at length. ' +
    'If you overturn it, say exactly which piece of evidence the rule mis-read.',
  ].join('\n');
}

// ---------------------------------------------------------------- output schema

/**
 * Strict JSON schema for the Responses API. Typed output, not prose: the report
 * renderer consumes fields, and a model that has to fill in `mechanism` and
 * `evidenceCited` separately is harder to hand-wave with.
 */
export const INVESTIGATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cause', 'summary', 'mechanism', 'verdict', 'confidence', 'oddEngineOut', 'fix', 'evidenceCited', 'unresolved'],
  properties: {
    cause: { type: 'string', description: 'Short stable slug for the mechanism, e.g. control-font-not-inherited.' },
    summary: { type: 'string', description: 'One sentence. What is wrong and where.' },
    mechanism: { type: 'string', description: 'Why the engines disagree, in terms of the evidence given.' },
    verdict: { type: 'string', enum: ['defect', 'expected-engine-difference', 'unclear'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    oddEngineOut: { type: ['string', 'null'], enum: ['chromium', 'firefox', 'webkit', null] },
    fix: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['description', 'css'],
      properties: {
        description: { type: 'string' },
        css: { type: ['string', 'null'] },
      },
    },
    evidenceCited: {
      type: 'array',
      items: { type: 'string' },
      description: 'Dotted paths into the evidence bundle that the conclusion rests on.',
    },
    unresolved: {
      type: 'array',
      items: { type: 'string' },
      description: 'Anything you needed and could not get. Empty array if nothing.',
    },
  },
} as const;

// ---------------------------------------------------------------- request

export interface ResponsesRequest {
  model: string;
  instructions: string;
  input: unknown[];
  tools?: unknown[];
  text?: unknown;
  max_output_tokens?: number;
  reasoning?: { effort: string };
  store: false;
}

export interface AssembledRequest {
  request: ResponsesRequest;
  /** the evidence text, for counting and for the dry run. */
  evidenceText: string;
  /** crops actually attached, with their pixel dimensions. */
  images: Array<{ engine: string; width: number; height: number; bytes: number; base64Bytes: number }>;
  toolSchemas: ToolSchema[];
}

function dataUrl(file: string): { url: string; base64Bytes: number } {
  const b = fs.readFileSync(file);
  const b64 = b.toString('base64');
  return { url: `data:image/png;base64,${b64}`, base64Bytes: b64.length };
}

export function assembleRequest(e: EvidenceBundle, opts: RequestOptions): AssembledRequest {
  const evidenceText = renderEvidence(e);
  const content: unknown[] = [{ type: 'input_text', text: evidenceText }];
  const images: AssembledRequest['images'] = [];

  if (opts.includeImages !== false) {
    for (const engine of ENGINES) {
      const c = e.crops[engine];
      if (!c.file) continue;
      const { url, base64Bytes } = dataUrl(c.file);
      content.push({
        type: 'input_text',
        text: `crop: ${engine}, ${c.width}x${c.height}px, element outlined in red, all three crops framed identically`,
      });
      content.push({ type: 'input_image', image_url: url, detail: 'high' });
      images.push({ engine, width: c.width, height: c.height, bytes: c.bytes, base64Bytes });
    }
  }

  if (opts.priorKnownCause) {
    content.push({ type: 'input_text', text: renderPriorCause(opts.priorKnownCause) });
  }

  const request: ResponsesRequest = {
    model: opts.model,
    instructions: SYSTEM_PROMPT,
    input: [{ role: 'user', content }],
    tools: TOOL_SCHEMAS.map((t) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      strict: true,
    })),
    text: {
      format: {
        type: 'json_schema',
        name: 'investigation',
        strict: true,
        schema: INVESTIGATION_SCHEMA,
      },
    },
    max_output_tokens: opts.maxOutputTokens ?? 1200,
    // Nothing is stored on OpenAI's side. This project does not keep a
    // conversation, and a stored response is a copy of the user's page.
    store: false,
  };
  if (opts.reasoningEffort) request.reasoning = { effort: opts.reasoningEffort };

  return { request, evidenceText, images, toolSchemas: TOOL_SCHEMAS };
}
