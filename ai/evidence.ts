// Evidence assembly: survivors.json (+ the per-page evidence dump, when present)
// -> one EvidenceBundle per finding.
//
// The bundle is the cost budget. Everything here is a decision about what a
// model needs in order to explain a divergence, and nothing else is included:
// - the element's path, tag, selector and text
// - the differing properties and their three values
// - the three cropped screenshots
// - the computed styles that plausibly bear on *those* properties
// - the ancestor chain, with the same style filter
// - the other survivors on the page, so a symptom can be linked to its cause
//
// Not included: the DOM, the stylesheets, the full-page screenshots, or the
// ~28-property computed-style blob for every node.

import fs from 'node:fs';
import path from 'node:path';
import type {
  AncestorNode, Box, CropImage, DescendantCulprit, Engine, ElementRef, EvidenceBundle,
  PropName, PropertyDivergence, RelatedFinding, RunEnvironment, Triple,
} from './types.ts';
import { ENGINES } from './types.ts';

// ---------------------------------------------------------------- normalising

/**
 * Chromium serialises the `BlinkMacSystemFont` keyword as `system-ui`, and
 * WebKit serialises font-family lists without quotes. Neither is a rendering
 * difference, and both appear on nearly every finding in both corpora, so
 * treating them as evidence would poison every explanation.
 */
function normFontFamily(v: string): string {
  return v
    .replace(/["']/g, '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .map((s) => (s === 'blinkmacsystemfont' ? 'system-ui' : s))
    .join(',');
}

const PX = /^-?\d+(?:\.\d+)?px$/;

function normStyle(key: string, v: string): string {
  if (v == null) return '';
  if (key === 'fontFamily') return normFontFamily(v);
  if (PX.test(v)) return (+v.slice(0, -2)).toFixed(2) + 'px';
  return v.trim();
}

export type DiffKind = 'value' | 'precision' | 'serialisation';

/**
 * Classify a computed-style difference.
 *  - `serialisation` — the same value, spelled differently by one engine.
 *  - `precision`     — the same value to 2dp; float noise (28.8 vs 28.800001).
 *  - `value`         — a real difference. Only these are evidence.
 */
export function classifyDiff(key: string, values: Triple<string>): DiffKind {
  const raw = new Set(ENGINES.map((e) => values[e]));
  if (raw.size === 1) return 'serialisation';
  const normed = new Set(ENGINES.map((e) => normStyle(key, values[e])));
  if (normed.size === 1) {
    // Equal after normalisation. Numeric-but-equal-to-2dp is float precision;
    // anything else is a serialisation quirk.
    return ENGINES.every((e) => PX.test(values[e])) ? 'precision' : 'serialisation';
  }
  return 'value';
}

// ---------------------------------------------------------------- style relevance

const WIDTH_STYLES = [
  'display', 'position', 'boxSizing', 'width', 'minWidth', 'flexBasis', 'flexGrow', 'flexShrink',
  'marginLeft', 'paddingLeft', 'borderLeftWidth', 'whiteSpace', 'textOverflow', 'overflowX',
  'fontFamily', 'fontSize', 'fontWeight', 'gap', 'gridTemplateColumns', 'writingMode', 'appearance',
];
const HEIGHT_STYLES = [
  'display', 'position', 'boxSizing', 'height', 'minHeight', 'lineHeight', 'fontFamily', 'fontSize',
  'fontWeight', 'marginTop', 'paddingTop', 'borderTopWidth', 'overflowY', 'gap', 'whiteSpace',
  'flexBasis', 'flexGrow', 'flexShrink', 'writingMode', 'appearance',
];

/** The computed styles that could bear on the properties that diverged. */
export function relevantStyleKeys(props: PropertyDivergence[]): string[] {
  const wants = new Set<string>();
  const horizontal = props.some((p) => p.prop === 'width' || p.prop === 'offset-x');
  const vertical = props.some((p) => p.prop === 'height' || p.prop === 'offset-y');
  for (const k of horizontal ? WIDTH_STYLES : []) wants.add(k);
  for (const k of vertical ? HEIGHT_STYLES : []) wants.add(k);
  if (wants.size === 0) for (const k of WIDTH_STYLES) wants.add(k);
  return [...wants];
}

// ---------------------------------------------------------------- paths

export function pathTags(structuralPath: string): string[] {
  return structuralPath.split('/').map((s) => s.replace(/\[\d+\]$/, ''));
}

export function parentPath(structuralPath: string): string | null {
  const i = structuralPath.lastIndexOf('/');
  return i < 0 ? null : structuralPath.slice(0, i);
}

export function isDescendantOf(child: string, ancestor: string): boolean {
  return child.length > ancestor.length && child.startsWith(ancestor + '/');
}

// ---------------------------------------------------------------- source data

/** The subset of survivors.json this module reads. */
export interface SurvivorFinding {
  id: string; page: string; path: string; selector: string; tag: string;
  display: string; text: string; maxDeltaPx: number;
  properties: PropertyDivergence[];
  geometry: Triple<Box>;
  styleDiffs: Record<string, Triple<string>>;
  shots: Triple<string>;
}

export interface SurvivorPage {
  id: string; kind: string; survivorCount: number; findings: SurvivorFinding[];
}

export interface SurvivorsFile {
  corpusVersion: string;
  environment: RunEnvironment;
  pages: SurvivorPage[];
}

/** One page's per-engine node dump, written by m0/scripts/run.mjs. */
interface EvidenceDump {
  page: string; url: string;
  data: Record<Engine, Record<string, {
    w: number; h: number; rx: number; ry: number; ax: number; ay: number;
    tag: string; disp: string; ppath: string; sel: string; text: string;
    styles: Record<string, string>;
  }>>;
}

export interface CorpusPaths {
  /** directory holding results/evidence/ and results/shots/ */
  root: string;
  name: string;
  /** defaults to `<root>/results/survivors.json`; override to read a copy. */
  survivorsFile?: string;
}

export class Corpus {
  readonly name: string;
  readonly root: string;
  readonly survivors: SurvivorsFile;
  private dumps = new Map<string, EvidenceDump | null>();

  constructor(p: CorpusPaths) {
    this.name = p.name;
    this.root = p.root;
    const file = p.survivorsFile ?? path.join(p.root, 'results', 'survivors.json');
    this.survivors = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  findings(): SurvivorFinding[] {
    return this.survivors.pages.flatMap((pg) => pg.findings);
  }

  pageUrl(pageId: string): string {
    return this.dump(pageId)?.url ?? `file://${path.join(this.root, 'corpus', 'pages', pageId + '.html')}`;
  }

  /** null when the (gitignored) per-page dump is not on disk. */
  dump(pageId: string): EvidenceDump | null {
    if (!this.dumps.has(pageId)) {
      const f = path.join(this.root, 'results', 'evidence', pageId + '.json');
      this.dumps.set(pageId, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
    }
    return this.dumps.get(pageId)!;
  }

  get hasDumps(): boolean {
    return fs.existsSync(path.join(this.root, 'results', 'evidence'));
  }

  shotPath(file: string): string {
    return path.join(this.root, 'results', 'shots', file);
  }
}

// ---------------------------------------------------------------- bundle

const MAX_ANCESTORS = 4;
const MAX_RELATED = 12;

/** The engine furthest from both others on the largest-delta property. */
export function oddEngineOut(props: PropertyDivergence[]): Engine | null {
  const top = props[0];
  if (!top) return null;
  let best: Engine | null = null;
  let bestDist = -1;
  for (const e of ENGINES) {
    const others = ENGINES.filter((x) => x !== e);
    const d = Math.min(...others.map((x) => Math.abs(top.values[e] - top.values[x])));
    if (d > bestDist) { bestDist = d; best = e; }
  }
  return bestDist > 0.01 ? best : null;
}

/** Root-cause key: page + tag + the quarter-pixel-rounded delta vector. */
export function rootCauseKey(f: { page: string; tag: string; properties: PropertyDivergence[] }): string {
  const props: PropName[] = ['width', 'height', 'offset-x', 'offset-y'];
  return `${f.page}|${f.tag}|` + props
    .map((p) => {
      const q = f.properties.find((x) => x.prop === p);
      return q ? Math.round(q.deltaPx * 4) / 4 : 0;
    })
    .join('/');
}

const MAX_CULPRITS = 3;

/**
 * Walk the subject's descendants and find the ones whose own box changes size
 * by the amount the subject does.
 *
 * A flex column that is 15px shorter in WebKit has not made a mistake; the
 * `<select>` four levels down has. The suppression funnel deliberately drops
 * that select (its delta matches its parent's, so it is collapsed as inherited),
 * which means the culprit is frequently *not* in the findings list at all and
 * cannot be found by looking at sibling findings. It can always be found here,
 * because `collect` recorded every node.
 *
 * Returns nothing when the per-page evidence dump is not on disk.
 */
function findDescendantCulprits(
  dump: ReturnType<Corpus['dump']>,
  subjectPath: string,
  widthDelta: number,
  heightDelta: number,
): DescendantCulprit[] {
  if (!dump) return [];
  const want = Math.max(widthDelta, heightDelta);
  if (want <= 0.6) return [];
  const tol = Math.max(0.75, want * 0.05);
  const base = dump.data.chromium;
  const hits: DescendantCulprit[] = [];

  for (const key of Object.keys(base)) {
    if (!isDescendantOf(key, subjectPath)) continue;
    const nodes = ENGINES.map((e) => dump.data[e]?.[key]);
    if (nodes.some((n) => !n)) continue;
    const ws = nodes.map((n) => n!.w);
    const hs = nodes.map((n) => n!.h);
    const dw = Math.max(...ws) - Math.min(...ws);
    const dh = Math.max(...hs) - Math.min(...hs);
    const matches =
      (widthDelta > 0.6 && Math.abs(dw - widthDelta) <= tol) ||
      (heightDelta > 0.6 && Math.abs(dh - heightDelta) <= tol);
    if (!matches) continue;
    hits.push({
      path: key,
      tag: base[key].tag,
      selector: base[key].sel,
      depth: key.split('/').length - subjectPath.split('/').length,
      size: {
        chromium: { w: nodes[0]!.w, h: nodes[0]!.h },
        firefox: { w: nodes[1]!.w, h: nodes[1]!.h },
        webkit: { w: nodes[2]!.w, h: nodes[2]!.h },
      },
      widthDelta: +dw.toFixed(2),
      heightDelta: +dh.toFixed(2),
      innermost: false,
    });
  }

  // Deepest first: the innermost node carrying the delta is the cause, the ones
  // above it are the chain that reported it upward.
  hits.sort((a, b) => b.depth - a.depth);
  for (const h of hits) h.innermost = !hits.some((o) => o !== h && isDescendantOf(o.path, h.path));
  return hits.filter((h) => h.innermost).concat(hits.filter((h) => !h.innermost)).slice(0, MAX_CULPRITS);
}

function pickStyles(styles: Record<string, string> | undefined, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!styles) return out;
  for (const k of keys) if (k in styles) out[k] = styles[k];
  return out;
}

function cropFor(corpus: Corpus, engine: Engine, file: string): CropImage {
  const full = corpus.shotPath(file);
  if (!fs.existsSync(full)) return { engine, file: null, width: 0, height: 0, bytes: 0 };
  const buf = fs.readFileSync(full);
  // PNG IHDR: width at byte 16, height at byte 20.
  const width = buf.length > 24 ? buf.readUInt32BE(16) : 0;
  const height = buf.length > 24 ? buf.readUInt32BE(20) : 0;
  return { engine, file: full, width, height, bytes: buf.length };
}

export function buildEvidence(corpus: Corpus, finding: SurvivorFinding): EvidenceBundle {
  const dump = corpus.dump(finding.page);
  const keys = relevantStyleKeys(finding.properties);

  // The element's own styles: from the dump when available, otherwise
  // reconstructed from styleDiffs (which only carries the differing ones).
  const styles: Triple<Record<string, string>> = { chromium: {}, firefox: {}, webkit: {} };
  for (const e of ENGINES) {
    const node = dump?.data?.[e]?.[finding.path];
    styles[e] = node ? pickStyles(node.styles, keys) : {};
    for (const [k, v] of Object.entries(finding.styleDiffs)) {
      if (keys.includes(k)) styles[e][k] = v[e];
    }
  }

  const styleDiffs: Record<string, Triple<string>> = {};
  const serialisationOnly: string[] = [];
  for (const [k, v] of Object.entries(finding.styleDiffs)) {
    const kind = classifyDiff(k, v);
    if (kind === 'value' || kind === 'precision') styleDiffs[k] = v;
    else serialisationOnly.push(k);
  }

  // Ancestor chain. Without the per-page dump we can still name the ancestors
  // from the structural path, but not measure them — and the bundle says so by
  // leaving geometry at zero and styles empty.
  const ancestors: AncestorNode[] = [];
  let p = parentPath(finding.path);
  let depth = 1;
  while (p && ancestors.length < MAX_ANCESTORS) {
    const geometry: Triple<Box> = {
      chromium: { w: 0, h: 0, rx: 0, ry: 0, ax: 0, ay: 0 },
      firefox: { w: 0, h: 0, rx: 0, ry: 0, ax: 0, ay: 0 },
      webkit: { w: 0, h: 0, rx: 0, ry: 0, ax: 0, ay: 0 },
    };
    const aStyles: Triple<Record<string, string>> = { chromium: {}, firefox: {}, webkit: {} };
    let ref: ElementRef | null = null;
    for (const e of ENGINES) {
      const node = dump?.data?.[e]?.[p];
      if (!node) continue;
      geometry[e] = { w: node.w, h: node.h, rx: node.rx, ry: node.ry, ax: node.ax, ay: node.ay };
      aStyles[e] = pickStyles(node.styles, keys);
      if (!ref) ref = { path: p, tag: node.tag, selector: node.sel, display: node.disp, text: node.text };
    }
    const tags = pathTags(p);
    if (!ref) ref = { path: p, tag: tags[tags.length - 1], selector: '', display: '', text: '' };
    const aDiffs: Record<string, Triple<string>> = {};
    for (const k of keys) {
      const v: Triple<string> = {
        chromium: aStyles.chromium[k], firefox: aStyles.firefox[k], webkit: aStyles.webkit[k],
      };
      if (v.chromium == null) continue;
      if (classifyDiff(k, v) === 'value') aDiffs[k] = v;
    }
    ancestors.push({ ...ref, depth, geometry, styles: aStyles, styleDiffs: aDiffs });
    p = parentPath(p);
    depth++;
  }

  // Other survivors on the same page, nearest-in-tree first.
  const page = corpus.survivors.pages.find((pg) => pg.id === finding.page);
  const siblings = (page?.findings ?? []).filter((f) => f.id !== finding.id);
  const related: RelatedFinding[] = siblings
    .map((f) => ({
      id: f.id, path: f.path, tag: f.tag, maxDeltaPx: f.maxDeltaPx, properties: f.properties,
      isDescendant: isDescendantOf(f.path, finding.path),
      isAncestor: isDescendantOf(finding.path, f.path),
    }))
    .sort((a, b) => rank(a) - rank(b) || b.maxDeltaPx - a.maxDeltaPx)
    .slice(0, MAX_RELATED);

  const myKey = rootCauseKey(finding);
  const symptomCount = 1 + siblings.filter((f) => rootCauseKey(f) === myKey).length;

  return {
    schema: 'browser-parity/investigation-evidence/1',
    findingId: finding.id,
    page: finding.page,
    url: corpus.pageUrl(finding.page),
    corpus: corpus.name,
    environment: corpus.survivors.environment,
    element: {
      path: finding.path, tag: finding.tag, selector: finding.selector,
      display: finding.display, text: finding.text,
    },
    properties: finding.properties,
    geometry: finding.geometry,
    styles,
    styleDiffs,
    ancestors,
    descendantCulprits: findDescendantCulprits(
      dump,
      finding.path,
      finding.properties.find((p) => p.prop === 'width')?.deltaPx ?? 0,
      finding.properties.find((p) => p.prop === 'height')?.deltaPx ?? 0,
    ),
    related,
    symptomCount,
    oddEngineOut: oddEngineOut(finding.properties),
    crops: {
      chromium: cropFor(corpus, 'chromium', finding.shots.chromium),
      firefox: cropFor(corpus, 'firefox', finding.shots.firefox),
      webkit: cropFor(corpus, 'webkit', finding.shots.webkit),
    },
    serialisationOnly,
  };
}

function rank(r: RelatedFinding): number {
  if (r.isAncestor) return 0;
  if (r.isDescendant) return 1;
  return 2;
}
