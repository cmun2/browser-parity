// The known-cause matcher.
//
// Most cross-engine divergence is not novel. Both measured corpora — the 475
// hand-labelled survivors of the 30-page study and the 106 survivors of the
// model-emitted validation set — collapse into a short list of recurring
// mechanisms. This file recognises those mechanisms from the evidence bundle
// alone and explains them with no model in the loop.
//
// The fraction of findings this covers is the number that decides where the
// seam between deterministic and probabilistic falls. `node ai/coverage.ts`
// measures it; do not quote a coverage figure that did not come out of that
// command.
//
// Each rule states the mechanism it recognises, the signature it matches on,
// and — where the mechanism was confirmed by reading the corpus CSS rather than
// inferred from geometry — the page that confirms it.

import type {
  Confidence, EvidenceBundle, Investigation, PropertyDivergence, Triple, Verdict,
} from './types.ts';
import { ENGINES } from './types.ts';
import { classifyDiff, pathTags } from './evidence.ts';

export interface RuleMatch {
  ruleId: string;
  cause: string;
  summary: string;
  mechanism: string;
  verdict: Verdict;
  confidence: Confidence;
  fix: { description: string; css?: string } | null;
  evidenceCited: string[];
  /** another finding this one is a symptom of. */
  rootCauseOf?: string;
}

export interface Rule {
  id: string;
  /** one line, for `ai/coverage.ts --rules`. */
  what: string;
  /**
   * Which corpus the mechanism was read off, recorded honestly at the time the
   * rule was written. Ten rules came out of corpus A's residual; three
   * (control-font-not-inherited, font-relative-length, line-height-resolution)
   * only became visible on B.
   *
   * Every rule here was derived from a corpus the matcher is then measured on,
   * so the headline coverage figure is in-sample by construction and means very
   * little on its own. `ai/coverage.ts --holdout` gives the number that does
   * mean something: coverage on B using only the A-derived rules, i.e. what the
   * matcher would have scored on a corpus it had never seen.
   */
  derivedFrom: Array<'A' | 'B'>;
  match(e: EvidenceBundle): RuleMatch | null;
}

// ---------------------------------------------------------------- helpers

const TABLE_TAGS = ['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'COL', 'COLGROUP', 'CAPTION'];
const CONTROL_TAGS = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];

function delta(e: EvidenceBundle, prop: PropertyDivergence['prop']): number {
  return e.properties.find((p) => p.prop === prop)?.deltaPx ?? 0;
}

function sizeDelta(e: EvidenceBundle): number {
  return Math.max(delta(e, 'width'), delta(e, 'height'));
}

function offsetDelta(e: EvidenceBundle): number {
  return Math.max(delta(e, 'offset-x'), delta(e, 'offset-y'));
}

/** Style diffs that are real value differences, not serialisation or float noise. */
function valueDiffs(e: EvidenceBundle): Record<string, Triple<string>> {
  const out: Record<string, Triple<string>> = {};
  for (const [k, v] of Object.entries(e.styleDiffs)) {
    if (classifyDiff(k, v) === 'value') out[k] = v;
  }
  return out;
}

/** `width`/`height` computed values restate the geometry; they explain nothing. */
function explanatoryDiffKeys(e: EvidenceBundle): string[] {
  return Object.keys(valueDiffs(e)).filter((k) => k !== 'width' && k !== 'height');
}

function px(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
  return m ? +m[1] : null;
}

function spread(values: Triple<number>): number {
  const v = ENGINES.map((e) => values[e]);
  return Math.max(...v) - Math.min(...v);
}

function styleSpread(e: EvidenceBundle, key: string): number | null {
  const v = e.styleDiffs[key];
  if (!v) return null;
  const nums = ENGINES.map((x) => px(v[x]));
  if (nums.some((n) => n == null)) return null;
  return Math.max(...(nums as number[])) - Math.min(...(nums as number[]));
}

/** Computed line-height in px, or null when it is `normal` / not collected. */
function lineHeight(e: EvidenceBundle): number | null {
  for (const eng of ENGINES) {
    const n = px(e.styles[eng]?.lineHeight ?? e.styleDiffs.lineHeight?.[eng]);
    if (n != null && n > 0) return n;
  }
  return null;
}

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

function engineList(values: Triple<number>, unit = 'px'): string {
  return ENGINES.map((e) => `${e} ${values[e]}${unit}`).join(', ');
}

function topProp(e: EvidenceBundle): PropertyDivergence | undefined {
  return e.properties[0];
}

/** Content width of the nearest ancestor, per engine; null when unmeasured. */
function parentBox(e: EvidenceBundle): Triple<number> | null {
  const a = e.ancestors[0];
  if (!a) return null;
  const w: Triple<number> = { chromium: a.geometry.chromium.w, firefox: a.geometry.firefox.w, webkit: a.geometry.webkit.w };
  if (ENGINES.every((x) => w[x] === 0)) return null;
  return w;
}

// ---------------------------------------------------------------- rules

const controlFontNotInherited: Rule = {
  id: 'control-font-not-inherited',
  what: 'A form control sets font-size but not font-family, so each engine uses its own UA control font.',
  derivedFrom: ['B'],
  match(e) {
    if (!CONTROL_TAGS.includes(e.element.tag)) return null;
    const ff = e.styleDiffs.fontFamily;
    if (!ff || classifyDiff('fontFamily', ff) !== 'value') return null;
    // If the parent disagrees too, the divergence is inherited, not created here.
    const parent = e.ancestors[0];
    if (parent && Object.keys(parent.styleDiffs).includes('fontFamily')) return null;
    const parentFont = parent?.styles.chromium?.fontFamily;
    return {
      ruleId: this.id,
      cause: 'control-font-not-inherited',
      summary: `<${e.element.tag.toLowerCase()}> falls back to each engine's UA control font, so its text is measured with three different fonts.`,
      mechanism:
        `The element's computed font-family differs by value across engines (${ENGINES.map((x) => `${x}: ${ff[x]}`).join(' · ')})` +
        (parentFont ? `, while its parent resolves to ${parentFont} in all three.` : '.') +
        ' Form controls do not inherit font by default; the UA stylesheet supplies one, and the three UA defaults are different fonts with different metrics.' +
        ` The box is content-sized, so the metric difference lands directly on ${e.properties.map((p) => p.prop).join(' and ')}.`,
      verdict: 'defect',
      confidence: 'high',
      fix: {
        description: 'Make controls inherit the page font. This is the single highest-value line in a cross-engine reset.',
        css: 'button, input, select, textarea { font: inherit; }',
      },
      evidenceCited: ['styleDiffs.fontFamily', 'element.tag', 'ancestors[0].styles.fontFamily'],
    };
  },
};

const legendShrinkToFit: Rule = {
  id: 'legend-shrink-to-fit',
  what: 'WebKit stretches a <legend> to the fieldset content box; Chromium and Firefox shrink it to fit.',
  derivedFrom: ['A'],
  match(e) {
    if (e.element.tag !== 'LEGEND') return null;
    const w = e.properties.find((p) => p.prop === 'width');
    if (!w || w.deltaPx < 20) return null;
    const vals = ENGINES.map((x) => w.values[x]);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    if (max / Math.max(min, 1) < 1.5) return null;
    const wide = ENGINES.find((x) => w.values[x] === max)!;
    return {
      ruleId: this.id,
      cause: 'legend-shrink-to-fit',
      summary: `<legend> is ${Math.round(w.deltaPx)}px wider in ${wide} — it fills the fieldset instead of shrinking to its text.`,
      mechanism:
        `The legend's used width is ${engineList(w.values)}. ` +
        `${wide} lays the legend out as a full-width block inside the fieldset; the other two size it to its text. ` +
        'The legend is also removed from the fieldset\'s normal flow differently, which is why the block below it starts at a different y. ' +
        'This is a long-standing divergence in how the fieldset/legend anonymous box is constructed, not a property the page set.',
      verdict: 'defect',
      confidence: 'high',
      fix: {
        description:
          'Do not rely on the UA legend box. Either give the legend an explicit width, or take it out of the fieldset layout entirely ' +
          'and use a normal heading element with aria-labelledby.',
        css: 'fieldset > legend { width: auto; float: left; } /* or: replace the legend with a <div role="heading"> */',
      },
      evidenceCited: ['properties[width]', 'element.tag', 'geometry'],
    };
  },
};

const uaSelectMetrics: Rule = {
  id: 'ua-select-metrics',
  what: 'WebKit\'s native <select> ignores author padding and computes its own intrinsic height.',
  derivedFrom: ['A'],
  match(e) {
    if (e.element.tag !== 'SELECT') return null;
    const diffs = valueDiffs(e);
    const control = ['paddingTop', 'paddingLeft', 'appearance', 'minHeight', 'overflowX', 'overflowY', 'whiteSpace']
      .filter((k) => k in diffs);
    if (control.length === 0) return null;
    return {
      ruleId: this.id,
      cause: 'ua-select-metrics',
      summary: `<select> is ${Math.round(sizeDelta(e))}px shorter in one engine: author padding is not applied to the native control.`,
      mechanism:
        `The computed values the engines disagree on are ${control.join(', ')} — ` +
        control.map((k) => `${k} = ${ENGINES.map((x) => `${x} ${diffs[k][x]}`).join(' / ')}`).join('; ') + '. ' +
        'A native <select> is rendered by the platform widget, and the engines disagree about whether author padding, min-height ' +
        'and overflow apply to it at all. The page set padding; only two of the three engines honoured it.',
      verdict: 'defect',
      confidence: 'high',
      fix: {
        description: 'Opt out of the native widget before styling it, and set the height explicitly rather than deriving it from padding.',
        css: 'select { appearance: none; -webkit-appearance: none; height: 38px; padding: 0 12px; }',
      },
      evidenceCited: ['styleDiffs.paddingTop', 'styleDiffs.paddingLeft', 'styleDiffs.appearance', 'element.tag'],
    };
  },
};

const uaCheckboxRadioSize: Rule = {
  id: 'ua-checkbox-radio-size',
  what: 'Checkbox/radio intrinsic size and margins come from the UA stylesheet and differ by 1–3px.',
  derivedFrom: ['A'],
  match(e) {
    if (e.element.tag !== 'INPUT') return null;
    const diffs = valueDiffs(e);
    if (!('minWidth' in diffs) && !('minHeight' in diffs) && !('marginLeft' in diffs)) return null;
    if (sizeDelta(e) > 6 || offsetDelta(e) > 6) return null;
    return {
      ruleId: this.id,
      cause: 'ua-checkbox-radio-size',
      summary: `Unstyled <input> differs by ${sizeDelta(e).toFixed(1)}px — UA intrinsic size, not page CSS.`,
      mechanism:
        'The page never gave this control a width, height or margin, so all three come from the UA stylesheet, and the three UA ' +
        `stylesheets disagree slightly (${Object.keys(diffs).join(', ')}). ` +
        'The deltas are small and constant, which is the signature of a UA default rather than a layout computation.',
      // Labelled 16 genuine / 6 expected. The mechanism is the same in both,
      // so the split is about whether the drift is visible on that page.
      verdict: 'unclear',
      confidence: 'high',
      fix: {
        description:
          'If the control\'s box must be identical across engines, size it explicitly. Otherwise this is design-system drift, ' +
          'not a bug — it is the class of finding a cross-engine design-system linter reports.',
        css: 'input[type="checkbox"], input[type="radio"] { width: 16px; height: 16px; margin: 0; }',
      },
      evidenceCited: ['styleDiffs.minWidth', 'styleDiffs.minHeight', 'styleDiffs.marginLeft', 'element.tag'],
    };
  },
};

const uaButtonPadding: Rule = {
  id: 'ua-button-padding',
  what: 'A <button> with no author padding-inline picks up the UA default, which is 6px in Chromium/WebKit and 4px in Firefox.',
  derivedFrom: ['A'],
  match(e) {
    if (e.element.tag !== 'BUTTON') return null;
    const diffs = valueDiffs(e);
    const padKeys = ['paddingLeft', 'paddingTop'].filter((k) => k in diffs);
    if (padKeys.length === 0 && !('minHeight' in diffs)) return null;
    const padSpread = styleSpread(e, 'paddingLeft');
    const w = delta(e, 'width');
    const doubled = padSpread != null && padSpread > 0 && near(w, 2 * padSpread, 1.0);
    return {
      ruleId: this.id,
      cause: 'ua-button-padding',
      summary: `<button> inherits a different UA padding per engine (${padKeys.map((k) => ENGINES.map((x) => diffs[k]?.[x]).join('/')).join(', ') || 'min-height'}).`,
      mechanism:
        'The page styled this button\'s vertical padding but not its horizontal padding, so padding-inline comes from the UA stylesheet. ' +
        (padSpread != null ? `Computed padding-left is ${ENGINES.map((x) => `${x} ${diffs.paddingLeft?.[x]}`).join(' / ')}` : 'The UA min-height differs') +
        (doubled
          ? `, and the ${w.toFixed(2)}px width difference is exactly twice that — the padding is applied on both sides.`
          : `, and the box difference follows from it.`) +
        ' Every button in the row then shifts, which is why this appears as a run of offset-x findings.',
      verdict: 'defect',
      confidence: doubled ? 'high' : 'medium',
      fix: {
        description: 'Set horizontal padding explicitly on every button rather than leaving it to the UA stylesheet.',
        css: 'button { padding-inline: 0; } /* then set the padding the design actually wants */',
      },
      evidenceCited: ['styleDiffs.paddingLeft', 'properties[width]', 'element.tag'],
    };
  },
};

const tableColumnDistribution: Rule = {
  id: 'table-column-distribution',
  what: 'Auto table layout distributes column widths from intrinsic text measurements, which differ per engine.',
  derivedFrom: ['A'],
  match(e) {
    const tags = pathTags(e.element.path);
    if (!tags.includes('TABLE')) return null;
    if (!TABLE_TAGS.includes(e.element.tag)) return null;
    const top = topProp(e);
    if (!top || (top.prop !== 'width' && top.prop !== 'offset-x')) return null;
    // A value diff on something other than the used width/height would mean the
    // column distribution is not the whole story.
    const unexplained = explanatoryDiffKeys(e).filter((k) => k !== 'fontFamily');
    if (unexplained.length) return null;

    const run = e.symptomCount;
    return {
      ruleId: this.id,
      cause: 'table-column-distribution',
      summary:
        `Auto table layout gives this column a different width in each engine (${top.prop} ${engineList(top.values)})` +
        (run > 1 ? `; ${run} cells in the table share the identical delta.` : '.'),
      mechanism:
        'The table has no fixed layout, so each engine measures the intrinsic min/max content width of every cell in the column and ' +
        'distributes the available width from those measurements. Text measurement differs between engines at the sub-pixel level, ' +
        'the distribution algorithm amplifies it to whole pixels, and the result cascades along the row: every cell to the right of ' +
        `the affected column is offset by the same amount. The ${run > 1 ? `${run} findings sharing this delta are ` : 'finding is '}` +
        'one cause, not many.',
      // The owner labelled 90 of these genuine and 230 expected in the 30-page
      // study — the same mechanism on both sides. So the mechanism does not
      // decide the verdict and the matcher does not pretend it does. What it
      // can say is the magnitude and the blast radius; a human decides whether
      // a 16px column shift matters on this page.
      verdict: 'unclear',
      confidence: 'high',
      fix: {
        description:
          'Take the column widths away from the intrinsic sizing algorithm. `table-layout: fixed` plus explicit column widths makes ' +
          'the distribution a function of the CSS rather than of the font.',
        css: 'table { table-layout: fixed; width: 100%; }\n/* then: <col style="width: 20%"> per column */',
      },
      evidenceCited: ['element.path', 'properties[0]', 'symptomCount'],
    };
  },
};

const lineWrapCount: Rule = {
  id: 'line-wrap-count',
  what: 'The text wraps onto a different number of lines, so the box height differs by a whole multiple of line-height.',
  derivedFrom: ['A'],
  match(e) {
    const h = e.properties.find((p) => p.prop === 'height');
    if (!h) return null;
    const lh = lineHeight(e);
    if (!lh) return null;
    const lines = h.deltaPx / lh;
    if (lines < 0.9) return null;
    const rounded = Math.round(lines);
    if (!near(lines, rounded, 0.08)) return null;
    const tall = ENGINES.reduce((a, b) => (h.values[a] > h.values[b] ? a : b));
    return {
      ruleId: this.id,
      cause: 'line-wrap-count',
      summary: `The text wraps to ${rounded} extra line${rounded === 1 ? '' : 's'} in ${tall} — height differs by exactly ${rounded} × ${lh}px.`,
      mechanism:
        `Computed line-height is ${lh}px and the height difference is ${h.deltaPx.toFixed(2)}px, i.e. ${rounded} whole line${rounded === 1 ? '' : 's'} ` +
        `(${engineList(h.values)}). The content is the same in all three engines, so the wrap point moved: the available width or the ` +
        'measured text width differs enough to push a word onto another line. That is a visible layout break, not sub-pixel noise — ' +
        'whatever sits below this box moves by a full line.',
      verdict: 'defect',
      confidence: 'high',
      fix: {
        description:
          'Find what changed the available width (usually an intrinsically-sized ancestor or a font-relative length) and pin it. ' +
          'A wrap difference is always downstream of a width difference.',
      },
      evidenceCited: ['properties[height]', 'styles.lineHeight'],
    };
  },
};

const fontRelativeLength: Rule = {
  id: 'font-relative-length',
  what: 'A max-width in a font-relative unit (ch/ex/em) resolves against per-engine font metrics.',
  derivedFrom: ['B'],
  match(e) {
    const w = e.properties.find((p) => p.prop === 'width');
    if (!w) return null;

    // Direct evidence, available since `maxWidth` was added to the collected
    // set. getComputedStyle resolves `max-width: 58ch` to pixels, so the
    // declared unit is not visible — but a cap that differs BETWEEN ENGINES is
    // conclusive on its own: `px` and `rem` caps resolve identically
    // everywhere, and only a font-relative unit (ch, ex, em against a differing
    // font) or a percentage of a differing basis can move. The parent is
    // stable, so it is the former.
    const capTriple = e.styleDiffs.maxWidth ?? (() => {
      const v = { chromium: e.styles.chromium?.maxWidth, firefox: e.styles.firefox?.maxWidth, webkit: e.styles.webkit?.maxWidth };
      return v.chromium != null ? (v as Triple<string>) : undefined;
    })();
    const capSpread = capTriple && ENGINES.every((x) => px(capTriple[x]) != null)
      ? Math.max(...ENGINES.map((x) => px(capTriple[x])!)) - Math.min(...ENGINES.map((x) => px(capTriple[x])!))
      : null;
    const capMoved = capSpread != null && capSpread > 0.5;

    if (!capMoved) {
      // No usable max-width evidence. Fall back to the geometric signature,
      // which is weaker and must not claim a mechanism it cannot see.
      const known = capTriple != null && ENGINES.every((x) => capTriple[x] != null);
      if (known) return null;  // maxWidth was collected and does NOT differ: not this cause.
    }

    if (explanatoryDiffKeys(e).filter((k) => k !== 'marginLeft' && k !== 'fontFamily' && k !== 'maxWidth').length) return null;
    const disp = e.element.display;
    if (!['block', 'flow-root', 'list-item'].includes(disp)) return null;

    // A cap only means anything when the element's width is its own. Inside a
    // flex or grid parent the width is assigned by the container's distribution
    // algorithm, and a narrower box there is free-space arithmetic over measured
    // text, not a resolved length.
    const parentDisplay = e.ancestors[0]?.styles.chromium?.display ?? '';
    if (['flex', 'inline-flex', 'grid', 'inline-grid'].includes(parentDisplay)) return null;

    const parent = parentBox(e);
    if (!parent) return null;
    const parentSpread = spread(parent);
    if (parentSpread > Math.max(0.5, w.deltaPx / 3)) return null;
    const widest = Math.max(...ENGINES.map((x) => w.values[x]));
    if (widest >= parent.chromium - 0.5) return null;

    const rel = w.deltaPx / widest;
    if (rel < 0.005) return null;

    const mSpread = styleSpread(e, 'marginLeft');
    const centred = mSpread != null && near(mSpread, w.deltaPx / 2, 0.6);
    const odd = e.oddEngineOut;

    const capLine = capMoved
      ? `Computed max-width is ${ENGINES.map((x) => `${x} ${capTriple![x]}`).join(' / ')} — the cap itself differs by ${capSpread!.toFixed(2)}px, ` +
        'and the used width equals it. A cap declared in `px` or `rem` resolves to the same number in every engine; one declared in `ch`, ' +
        '`ex` or `em` does not, because those units are defined in terms of the font\'s "0" advance, its x-height and its size. ' +
        'The declared unit is not recoverable from a computed value, but a cap that moved is a font-relative cap.'
      : 'No max-width was collected for this element, so the cap is inferred from the geometry rather than read: the box is narrower than ' +
        'its stable parent and differs by a percentage rather than by a pixel or two, which is the signature of a length resolved against font metrics.';

    return {
      ruleId: this.id,
      cause: 'font-relative-length',
      summary: capMoved
        ? `max-width resolves ${capSpread!.toFixed(1)}px shorter in ${odd ?? 'one engine'} — the cap is in a font-relative unit (ch/ex/em), not px.`
        : `The box is capped ${w.deltaPx.toFixed(1)}px (${(rel * 100).toFixed(1)}%) narrower in ${odd ?? 'one engine'} while its parent is identical.`,
      mechanism:
        `The parent measures ${parent.chromium.toFixed(2)}px, varying by only ${parentSpread.toFixed(2)}px across engines, so the available width is not in question. ` +
        `This box resolves to ${engineList(w.values)}. ` + capLine +
        (centred ? ` margin-left differs by ${mSpread!.toFixed(2)}px, exactly half the width difference, which is what auto margins do when the box changes size.` : ''),
      verdict: rel >= 0.02 ? 'defect' : 'unclear',
      confidence: capMoved ? 'high' : centred ? 'high' : 'medium',
      fix: {
        description:
          'Express the measure in absolute units. `max-width: 58ch` is a different number of pixels in every engine; `max-width: 42rem` is not.',
        css: '/* was: max-width: 58ch */\nmax-width: 42rem;',
      },
      evidenceCited: capMoved
        ? ['styles.maxWidth', 'properties[width]', 'ancestors[0].geometry']
        : ['properties[width]', 'ancestors[0].geometry', 'styleDiffs.marginLeft'],
    };
  },
};

const textShrinkToFit: Rule = {
  id: 'text-shrink-to-fit',
  what: 'A content-sized box (inline-block, inline-flex, flex item, table cell) inherits the engines\' text-measurement difference.',
  derivedFrom: ['A'],
  match(e) {
    if (explanatoryDiffKeys(e).filter((k) => k !== 'fontFamily' && k !== 'marginLeft').length) return null;
    // The box must actually be sized differently. Without this the rule claims
    // pure displacements: p20-article-magazine#1 measures 102.61/102.57/102.61
    // — identical to a twentieth of a pixel — and only its offset-x moves,
    // because its parent <form> is 8.62px wider in Firefox. Calling that
    // "the engines measure its text differently" is false; the text was never
    // measured differently. Found by the step-4 model run, which overturned
    // this rule on exactly that finding and was right.
    const w = e.properties.find((p) => p.prop === 'width');
    if (!w) return null;
    const ox = e.properties.find((p) => p.prop === 'offset-x');
    const d = Math.max(w.deltaPx, ox?.deltaPx ?? 0);
    if (d > 12) return null;

    const disp = e.element.display;
    const contentSized =
      ['inline-block', 'inline-flex', 'inline-grid', 'table-cell', 'table'].includes(disp) ||
      (e.ancestors[0] && ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(e.ancestors[0].styles.chromium?.display ?? ''));
    if (!contentSized) return null;
    if (!e.element.text) return null;

    return {
      ruleId: this.id,
      cause: 'text-shrink-to-fit',
      summary: `Content-sized box differs by ${d.toFixed(2)}px because the three engines measure its text differently.`,
      mechanism:
        `display is ${disp}${e.ancestors[0] ? ` inside a ${e.ancestors[0].styles.chromium?.display ?? 'block'} parent` : ''}, so the box is sized by its ` +
        'contents rather than by a length in the stylesheet. No computed style differs by value — the only thing that differs is the ' +
        `measured text (${engineList(w.values)}). ` +
        'Glyph advances, hinting and sub-pixel rounding are not specified to the pixel, so a text run of this length lands a few pixels ' +
        'apart. This is the noise floor of cross-engine geometry, not a bug in the page.',
      verdict: 'expected-engine-difference',
      confidence: d < 6 ? 'high' : 'medium',
      fix: {
        description:
          'Nothing to fix unless the box must be pixel-identical. If it must be, give it an explicit width — text measurement is not ' +
          'interoperable to the pixel and never has been.',
      },
      evidenceCited: ['element.display', 'properties', 'styleDiffs'],
    };
  },
};

const symptomAbsorbedSize: Rule = {
  id: 'symptom-absorbed-size',
  what: 'A container reports a descendant\'s size difference as its own; the named descendant is the cause.',
  derivedFrom: ['A'],
  match(e) {
    const culprit = e.descendantCulprits.find((c) => c.innermost);
    if (!culprit) return null;
    if (explanatoryDiffKeys(e).length) return null;
    const vertical = delta(e, 'height') >= delta(e, 'width');
    const d = vertical ? delta(e, 'height') : delta(e, 'width');
    if (d <= 0.6) return null;

    // Naming the tag of the innermost node is most of the explanation: a
    // <select> or a <legend> down there is a known UA-metric divergence.
    const known = CONTROL_TAGS.includes(culprit.tag) || culprit.tag === 'LEGEND';
    const size = vertical
      ? ENGINES.map((x) => `${x} ${culprit.size[x].h}px`).join(', ')
      : ENGINES.map((x) => `${x} ${culprit.size[x].w}px`).join(', ');
    return {
      ruleId: this.id,
      cause: 'symptom-absorbed-size',
      summary:
        `${vertical ? 'Height' : 'Width'} differs by ${d.toFixed(2)}px because <${culprit.tag.toLowerCase()}>${culprit.selector ? ' ' + culprit.selector : ''}, ` +
        `${culprit.depth} level${culprit.depth === 1 ? '' : 's'} inside it, is that much different.`,
      mechanism:
        `No computed style on this element differs by value, and its box changes by exactly the amount one of its descendants does. ` +
        `The innermost node carrying the same delta is ${culprit.path.split('/').slice(-2).join('/')} (<${culprit.tag.toLowerCase()}>), measuring ${size}. ` +
        (known
          ? `That is a form control, and the page is relying on the UA stylesheet for part of its box — the three UA stylesheets disagree.`
          : `Everything between it and this element is just reporting the difference upward.`) +
        ' The suppression funnel drops the intermediate nodes as inherited, which is why the container is what gets reported and the ' +
        'cause is not in the findings list at all.',
      verdict: known ? 'defect' : 'unclear',
      confidence: 'high',
      fix: {
        description: known
          ? `Give the <${culprit.tag.toLowerCase()}> an explicit box (height/padding, or \`appearance: none\` first) instead of inheriting the UA widget metrics.`
          : `Symptom only. Investigate ${culprit.path.split('/').slice(-1)[0]} at ${culprit.path}.`,
      },
      evidenceCited: ['descendantCulprits[0]', 'properties', 'styleDiffs'],
      rootCauseOf: culprit.path,
    };
  },
};

const symptomInheritedSize: Rule = {
  id: 'symptom-inherited-size',
  what: 'The element is the size its ancestor made it; the divergence was created further up.',
  derivedFrom: ['A'],
  match(e) {
    if (explanatoryDiffKeys(e).filter((k) => k !== 'fontFamily').length) return null;
    const dw = delta(e, 'width');
    const dh = delta(e, 'height');
    const vertical = dh > dw;
    const d = vertical ? dh : dw;
    if (d <= 0.6) return null;

    const anc = e.ancestors.find((a) => {
      const g = a.geometry;
      if (ENGINES.every((x) => g[x].w === 0 && g[x].h === 0)) return false;
      const ad = vertical
        ? spread({ chromium: g.chromium.h, firefox: g.firefox.h, webkit: g.webkit.h })
        : spread({ chromium: g.chromium.w, firefox: g.firefox.w, webkit: g.webkit.w });
      return ad > 0.6 && near(ad, d, Math.max(0.75, d * 0.05));
    });
    if (!anc) return null;

    return {
      ruleId: this.id,
      cause: 'symptom-inherited-size',
      summary:
        `${vertical ? 'Height' : 'Width'} differs by ${d.toFixed(2)}px, the same amount as its ancestor <${anc.tag.toLowerCase()}>${anc.selector ? ' ' + anc.selector : ''} ` +
        `${anc.depth} level${anc.depth === 1 ? '' : 's'} up.`,
      mechanism:
        'This element sets no width or height of its own and no computed style on it differs by value; it fills the space its ancestor gives it. ' +
        `That ancestor (${anc.path.split('/').slice(-2).join('/')}) differs by the same ${d.toFixed(2)}px. ` +
        'The funnel\'s inherited-delta rule only collapses a node against its *direct parent* on both axes at once, so a chain like this ' +
        'survives even though it is one cause.',
      verdict: 'unclear',
      confidence: 'high',
      fix: { description: `Symptom only. The cause is at or above ${anc.path}.` },
      evidenceCited: ['ancestors', 'properties', 'styleDiffs'],
      rootCauseOf: anc.path,
    };
  },
};

const propagatedDisplacement: Rule = {
  id: 'propagated-displacement',
  what: 'The element\'s own box is identical everywhere; it is displaced by a size difference elsewhere on the page.',
  derivedFrom: ['A'],
  match(e) {
    const size = sizeDelta(e);
    const off = offsetDelta(e);
    if (size > 0.6 || off <= 0.6) return null;
    if (explanatoryDiffKeys(e).length) return null;

    const vertical = delta(e, 'offset-y') >= delta(e, 'offset-x');
    const want = off;
    // Look for a survivor whose *size* changed by the amount this one moved.
    const culprit = e.related.find((r) => {
      const rs = Math.max(
        r.properties.find((p) => p.prop === 'width')?.deltaPx ?? 0,
        r.properties.find((p) => p.prop === 'height')?.deltaPx ?? 0,
      );
      return rs > 0.6 && near(rs, want, Math.max(0.75, want * 0.05));
    });

    const dir = vertical ? 'down the page' : 'along the row';
    return {
      ruleId: this.id,
      cause: 'propagated-displacement',
      summary: culprit
        ? `Displaced ${off.toFixed(2)}px ${dir} by ${culprit.id} — this element's own box is identical in all three engines.`
        : `Displaced ${off.toFixed(2)}px ${dir}; this element's own box is identical in all three engines.`,
      mechanism:
        `width and height agree to within ${size.toFixed(2)}px across all three engines, and no computed style differs by value. ` +
        `Only the position differs (${vertical ? 'offset-y' : 'offset-x'} ${off.toFixed(2)}px). ` +
        (culprit
          ? `${culprit.id} (${culprit.tag} at ${culprit.path.split('/').slice(-2).join('/')}) changes size by the same amount, and this element sits after it in flow. ` +
            'Fix that one and this finding disappears.'
          : 'Nothing on this element is wrong; something earlier in the flow is a different size. The suppression funnel already ' +
            'collapses the parent-inherited case, so the cause is a sibling or an ancestor\'s earlier child, not the direct parent.'),
      verdict: 'unclear',
      confidence: culprit ? 'high' : 'medium',
      fix: culprit
        ? { description: `Symptom only. Fix ${culprit.id}.` }
        : { description: 'Symptom only. Look at what precedes this element in flow, not at the element itself.' },
      evidenceCited: ['properties', 'related', 'styleDiffs'],
      rootCauseOf: culprit?.id,
    };
  },
};

const lineHeightResolution: Rule = {
  id: 'line-height-resolution',
  what: 'A unitless line-height resolves to a very slightly different pixel value per engine, and per-line rounding accumulates.',
  derivedFrom: ['B'],
  match(e) {
    const lh = e.styleDiffs.lineHeight;
    if (!lh) return null;
    const kind = classifyDiff('lineHeight', lh);
    const lhSpread = styleSpread(e, 'lineHeight');
    // Either float noise below 2dp, or a genuine but sub-0.05px difference in
    // how the engines resolve `line-height: <number>` against the font size.
    // Anything larger is a real line-height difference and not this mechanism.
    if (kind !== 'precision' && !(kind === 'value' && lhSpread != null && lhSpread <= 0.05)) return null;
    if (explanatoryDiffKeys(e).filter((k) => k !== 'lineHeight').length) return null;
    const d = Math.max(sizeDelta(e), offsetDelta(e));
    if (d > 10) return null;
    return {
      ruleId: this.id,
      cause: 'line-height-resolution',
      summary: `Sub-pixel line-height rounding (${ENGINES.map((x) => lh[x]).join(' / ')}) accumulating to ${d.toFixed(2)}px.`,
      mechanism:
        `The page specifies line-height as a unitless multiplier. Resolved against the font size it becomes ` +
        `${ENGINES.map((x) => `${x} ${lh[x]}`).join(', ')} — a spread of ${(lhSpread ?? 0).toFixed(4)}px, far below anything that can be seen on one line. ` +
        'Each line box rounds independently, so over a long block the error accumulates into whole pixels and everything below shifts. ' +
        'The engines are not disagreeing about layout; they are disagreeing about the last bit of a float.',
      verdict: 'expected-engine-difference',
      confidence: 'medium',
      fix: {
        description:
          'If the accumulation matters, specify line-height in px so every line box rounds the same way. Otherwise this is below the ' +
          'threshold at which anyone can see it.',
        css: '/* was: line-height: 1.7 */\nline-height: 23.8px;',
      },
      evidenceCited: ['styleDiffs.lineHeight', 'properties'],
    };
  },
};

/**
 * Ordered. First match wins, so the specific mechanisms come before the general
 * ones: a <button> whose font is not inherited must not be filed as generic
 * text-measurement noise.
 */
export const RULES: Rule[] = [
  // Specific mechanisms first: a <button> whose font is not inherited must not
  // be filed as generic text-measurement noise.
  controlFontNotInherited,
  legendShrinkToFit,
  uaSelectMetrics,
  uaCheckboxRadioSize,
  uaButtonPadding,
  tableColumnDistribution,
  lineWrapCount,
  fontRelativeLength,
  lineHeightResolution,
  // Then the symptom-linkers, which name a specific other node as the cause.
  symptomAbsorbedSize,
  symptomInheritedSize,
  // Then the general ones, which explain a class rather than an instance.
  textShrinkToFit,
  propagatedDisplacement,
];

export function matchKnownCause(e: EvidenceBundle): RuleMatch | null {
  for (const rule of RULES) {
    const m = rule.match(e);
    if (m) return m;
  }
  return null;
}

/** The matcher's output in the same shape a model would produce. */
export function knownCauseInvestigation(e: EvidenceBundle): Investigation | null {
  const m = matchKnownCause(e);
  if (!m) return null;
  return {
    schema: 'browser-parity/investigation/1',
    findingId: e.findingId,
    cause: m.cause,
    summary: m.summary,
    mechanism: m.mechanism,
    verdict: m.verdict,
    confidence: m.confidence,
    oddEngineOut: e.oddEngineOut,
    fix: m.fix,
    evidenceCited: m.evidenceCited,
    source: 'known-cause',
    ruleId: m.ruleId,
  };
}
