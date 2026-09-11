// Data shapes shared by the investigator layer.
//
// Nothing in core/ (scripts/, m0/scripts/) imports this file, and nothing here
// imports core/. The investigator reads the deterministic pipeline's JSON output
// and adds an explanation; it never changes what the pipeline measured.
//
// Written for `node --experimental-strip-types`, so every construct here must be
// erasable: interfaces and type aliases only, no enums, no namespaces.

export type Engine = 'chromium' | 'firefox' | 'webkit';

export const ENGINES: Engine[] = ['chromium', 'firefox', 'webkit'];

export type Triple<T> = { chromium: T; firefox: T; webkit: T };

/** Parent-relative and absolute box, exactly as `collect` records it. */
export interface Box {
  /** border-box width */ w: number;
  /** border-box height */ h: number;
  /** x relative to the parent's border box */ rx: number;
  /** y relative to the parent's border box */ ry: number;
  /** absolute page x */ ax: number;
  /** absolute page y */ ay: number;
}

export type PropName = 'width' | 'height' | 'offset-x' | 'offset-y';

export interface PropertyDivergence {
  prop: PropName;
  deltaPx: number;
  values: Triple<number>;
}

export interface ElementRef {
  /** `BODY[1]/DIV[2]/TABLE[1]/...` — the correspondence key. */
  path: string;
  tag: string;
  /** `#id.class.class` as collected; may be empty. */
  selector: string;
  /** computed `display` in Chromium. */
  display: string;
  /** first 80 chars of textContent, whitespace-collapsed. */
  text: string;
}

export interface AncestorNode extends ElementRef {
  /** distance from the finding's element: 1 = parent. */
  depth: number;
  geometry: Triple<Box>;
  /** only the styles that plausibly bear on the divergence. */
  styles: Triple<Record<string, string>>;
  /** of those, the ones that actually differ after normalisation. */
  styleDiffs: Record<string, Triple<string>>;
}

export interface CropImage {
  engine: Engine;
  /** absolute path on disk; absent when the crop was not rendered. */
  file: string | null;
  width: number;
  height: number;
  bytes: number;
}

export interface RunEnvironment {
  playwrightVersion: string;
  engineVersions: Triple<string>;
  os: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  fontFingerprint: string;
  normalizationPreset: string;
}

/**
 * A descendant of the subject element whose own box changes size by the amount
 * the subject does. A container that is 15px shorter in one engine is almost
 * never wrong itself; something inside it is. This is the cheapest possible
 * answer to "which one", computed deterministically from the recorded nodes —
 * and it is why `inspect_element` is rarely needed.
 */
export interface DescendantCulprit {
  path: string;
  tag: string;
  selector: string;
  /** depth below the subject element. */
  depth: number;
  /** per-engine width/height of the culprit. */
  size: Triple<{ w: number; h: number }>;
  widthDelta: number;
  heightDelta: number;
  /** true when no descendant of *this* node also carries the delta. */
  innermost: boolean;
}

/** A compact reference to another survivor on the same page. */
export interface RelatedFinding {
  id: string;
  path: string;
  tag: string;
  maxDeltaPx: number;
  properties: PropertyDivergence[];
  /** true when `path` is a strict descendant of the subject element. */
  isDescendant: boolean;
  /** true when `path` is a strict ancestor of the subject element. */
  isAncestor: boolean;
}

/**
 * Everything a model is given about one finding. Deliberately narrow: no DOM
 * dump, no stylesheet, no full-page screenshot. Adding a field here is a
 * decision about cost, so the shape is the budget.
 */
export interface EvidenceBundle {
  schema: 'browser-parity/investigation-evidence/1';
  findingId: string;
  page: string;
  /** the URL that was measured (file:// for the corpora). */
  url: string;
  corpus: string;
  environment: RunEnvironment;

  element: ElementRef;
  /** what differs, largest delta first. */
  properties: PropertyDivergence[];
  geometry: Triple<Box>;
  /** the curated computed styles filtered to those that bear on `properties`. */
  styles: Triple<Record<string, string>>;
  /** of those, the ones that genuinely differ (serialisation noise removed). */
  styleDiffs: Record<string, Triple<string>>;
  /** root-ward, nearest first. */
  ancestors: AncestorNode[];
  /** innermost-first descendants that carry the same size delta. */
  descendantCulprits: DescendantCulprit[];
  /** other survivors on the same page, for root-cause linking. */
  related: RelatedFinding[];
  /** how many survivors on this page share this element's root-cause key. */
  symptomCount: number;
  /** engine furthest from both others on the largest-delta property. */
  oddEngineOut: Engine | null;
  crops: Triple<CropImage>;
  /** styleDiffs discarded as per-engine serialisation of the same value. */
  serialisationOnly: string[];
}

export type Verdict = 'defect' | 'expected-engine-difference' | 'unclear';
export type Confidence = 'high' | 'medium' | 'low';

export interface ProposedFix {
  description: string;
  css?: string;
}

/** The structured result of investigating one finding. */
export interface Investigation {
  schema: 'browser-parity/investigation/1';
  findingId: string;
  /** stable slug, e.g. `table-column-distribution`. */
  cause: string;
  /** one line, for the report header. */
  summary: string;
  /** why the engines disagree, in terms of the evidence. */
  mechanism: string;
  verdict: Verdict;
  confidence: Confidence;
  oddEngineOut: Engine | null;
  fix: ProposedFix | null;
  /** which evidence fields the conclusion rests on, by dotted path. */
  evidenceCited: string[];
  /** who produced this. */
  source: 'known-cause' | 'model' | 'mock';
  /** set when `source` is `known-cause`. */
  ruleId?: string;
  /** set when a model produced it. */
  usage?: TokenUsage;
  /** anything the investigator wanted but could not get. */
  unresolved?: string[];
}

export interface TokenUsage {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  imageTokens: number;
  /** USD, at the pricing snapshot in ai/pricing.ts. */
  costUsd: number;
}

// ---------------------------------------------------------------- tools

export type ToolName =
  | 'inspect_element'
  | 'read_computed_styles'
  | 'rerun_engine'
  | 'compare_screenshots';

export interface ToolCall {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: ToolName;
  /** JSON-serialisable payload, or an error explanation. */
  ok: boolean;
  content: unknown;
}

/**
 * Executes the investigator's tool calls. The corpus-backed implementation
 * answers from the recorded evidence; a live implementation would drive
 * Playwright. Either way the provider never touches a browser itself.
 */
export interface ToolExecutor {
  readonly id: string;
  /** which tools this executor can actually answer. */
  readonly supports: ToolName[];
  run(call: ToolCall, evidence: EvidenceBundle): Promise<ToolResult>;
}
