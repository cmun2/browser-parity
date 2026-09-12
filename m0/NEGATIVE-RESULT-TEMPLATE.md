# Cross-engine layout divergence has largely stopped happening

*A negative result on Chromium, Firefox and WebKit, 2026.*

> **Status: DRAFT TEMPLATE.** Written before the measurement, deliberately, so
> that a null result gets published with the same care a positive one would get.
> Fill the bracketed values from `m0/results/incidence-v0.1.json`. If the verdict
> was not KILL, this file is not the right document — see `m0/README.md`.
>
> Every `[[...]]` below is a placeholder. Do not publish with any remaining.

---

## Summary

We built a cross-browser UI checker on a premise that turned out to be false.

The premise: an AI coding agent writes a frontend, sees it only in Chromium, and
ships a layout bug that appears in Firefox or Safari. The fix: compare the same
page across three real engines at one commit and use them as each other's oracle
— no baseline, no golden image, no stored history.

The detector worked. The premise did not. Across **[[N]] AI-style frontend pages**,
after deterministic suppression, a human reviewer labelled **[[G]] genuine layout
defects**. The per-page defect rate was **[[RATE]]%** (95% CI [[CI_LOW]]–[[CI_HIGH]]%).

We are publishing the measurement, the corpus and the harness rather than the
tool. On modern engines, for this class of page, **there is very little left to
find** — and that is worth knowing before anyone else spends a quarter on it.

## Why we expected otherwise

Cross-browser inconsistency (XBI) has a real literature and a real toolchain
history — XFix, Browserbite, WebSee, X-PERT — all built on Selenium, all
effectively dead by 2018. The distribution problem that killed them is now
solved: Playwright ships Chromium, Firefox and WebKit behind one install.

Meanwhile no product compares engines *to each other*. Chromatic states it "does
not programmatically compare snapshots from different browsers against each
other." Playwright's own docs tell you that for different browsers "you will need
different snapshots." Applitools markets the pitch but keys baselines on
`HostApp`, which makes cross-browser comparison structurally impossible, and its
engines are DOM-snapshot reproductions rather than real Gecko and WebKit.

So: a real gap, a newly-solved distribution problem, and an obvious mechanism.
The one thing nobody had measured recently was whether the bugs still exist.

## What we measured

**Corpus.** [[N]] frontend pages across [[K]] categories — [[MIX]]. Generated
deterministically from [[N]] written briefs, then **frozen and committed before a
single measurement was run** (`corpus hash [[HASH]]`). Every later stage re-hashes
the corpus and fails if a byte moved. No page was touched after seeing a result.

**Pipeline.** Each page loaded in Chromium [[CHROME_V]], Firefox [[FF_V]] and
WebKit [[WK_V]] (Playwright [[PW_V]]) at 1280×900, `deviceScaleFactor: 1`,
`reducedMotion: reduce`, waiting on `networkidle` and `document.fonts.ready`.
Per element: bounding rect, parent-relative offset, and a curated computed-style
set. Elements corresponded across engines by structural path.

**Suppression.** Four deterministic rules, zero AI calls, published in advance:

1. drop SVG-internal nodes (rasterizer geometry)
2. drop `display: inline` (glyph shaping)
3. tolerance `max(2px, 1% of box)`
4. collapse inherited deltas (a node whose delta equals its parent's is a symptom,
   not a cause)

On real production sites these took 638 → 19, 611 → 5 and 74 → 0 findings. On
this corpus: **[[RAW]] raw → [[SURV]] survivors**, a [[SUPP]]% reduction, median
[[MEDIAN]] survivors per page.

**Labelling.** Every survivor reviewed by hand against three engine screenshots
cropped to the element, and labelled *genuine defect* / *expected engine
difference* / *tool artifact*. [[LABEL_TIME]] of reviewer time.

## Result

| | |
|---|---|
| Pages | [[N]] |
| Raw cross-engine findings | [[RAW]] |
| Survivors after suppression | [[SURV]] (median [[MEDIAN]]/page) |
| **Genuine defects** | **[[G]]** |
| Pages with ≥1 genuine defect | [[K_PAGES]] / [[N]] |
| Expected engine differences | [[EXPECTED]] |
| Tool artifacts | [[ARTIFACT]] |

[[IF ZERO: With 0 defects in [[N]] pages, the rule of three puts the 95% upper
bound on the true per-page defect rate at [[ROT]]% — that rules out a *common*
defect, not a rare one.]]

The surviving findings were dominated by [[DOMINANT_CLASSES]]. These are
"browsers are different," not "the agent wrote a bug": native form-control
metrics (`input[type=date]` is ~45px narrower in WebKit even after a full reset)
and text shaping (Firefox's default line box for 16px `system-ui` is 20px against
18px elsewhere, which then accumulates down the document).

## Why the bugs went away

The convergence is measurable directly. After normalising fonts and UA styles,
every construct on the classic XBI list agrees to **under 0.5px** across all
three engines: nested-flex `min-width: auto`, grid `minmax(min-content, 1fr)`,
sticky positioning, viewport units, table intrinsic width, flex-wrap with
percentage heights, subpixel flex distribution.

The 2026 frontier is *stronger*, not weaker. `CSS.supports` probing shows all
three engines support anchor positioning, `field-sizing`, `text-wrap: balance`,
subgrid, `scrollbar-gutter: stable`, `text-box-trim`, container-query units,
`overflow: clip` and `dvh`. Measured geometry for subgrid, container-query units,
`-webkit-line-clamp`, `scrollbar-gutter` and sticky-inside-`overflow:clip` is
bit-identical across engines.

Interop, WPT and a decade of standards work did the thing they were meant to do.

## What this does not show

**Playwright's WebKit is not Safari.** It is a real WebKit layout engine, so a
positive finding would have been credible. But it is not Apple's shipping
configuration, and **iOS Safari is not covered at all**. Safari is the reason
most teams want cross-browser testing, so a null result here is *not* a clean
bill of health for Safari, and we are not claiming one.

**The corpus is hand-authored in an AI-typical idiom, not model-emitted.** The
study ran under a no-paid-API constraint, so the pages were written by hand to
look like coding-agent output — utility classes or a single embedded stylesheet,
inline stroke icons, system font stacks, flex/grid scaffolding, native form
controls, no build step. The [[N]] briefs are published so the study can be
re-run against real model output. Until someone does that, this measures one
author's model of AI frontends. **This is the result's biggest weakness and the
cheapest thing for a critic to attack — which is exactly why it is stated here
and not buried.**

**Static, local, single-machine.** No network, no JS-driven layout, no
hydration, no web fonts, one OS, one font set. That removes DOM-level engine
divergence — where the engines disagree about the *tree*, not the geometry —
which is a real finding class this study cannot see.

**n = [[N]].** The confidence interval is wide by construction.

## What would overturn this

In rough order of how cheaply it could be done, and how much it would move us:

1. **Run the same [[N]] briefs through a real coding agent** and re-measure. The
   harness takes a directory of HTML files; this is an afternoon. If model-emitted
   pages produce defects where hand-authored ones do not, the negative result is
   about our corpus, not about the engines. **This is the first thing to try.**
2. **Real Safari and iOS Safari**, via a device cloud. A positive rate there
   would not contradict this measurement but would restore the product thesis
   outright, since that is where the demand actually is.
3. **Framework-rendered and hydrated pages.** DOM-level divergence during
   hydration is a finding class this corpus structurally cannot contain.
4. **Older engine versions.** Convergence is recent. Teams supporting a browser
   floor of two or three years back may sit on a completely different base rate,
   and that is a legitimately different product.
5. **A larger corpus.** At [[N]] pages a rate of 1-in-50 is invisible. If a
   1-in-50 defect rate is still worth tooling for — and for a large org it might
   be — this study is simply too small to see it.
6. **Interaction and viewport states.** Everything here was measured at one
   viewport in the initial state. Hover, focus, open menus and narrow viewports
   are unexplored.

## Artifacts

- Corpus, harness and verdict: `m0/` — `corpus/` (frozen, hashed),
  `scripts/` (generator, runner, labelling UI, verdict), `results/incidence-v0.1.json`
- The [[N]] briefs: `m0/corpus/SPECS.md`
- Prior measurements: `docs/research/experiment-01-divergence.md`
- Landscape survey: `docs/research/landscape.md`

Everything is reproducible with `npx playwright install` and Node. No accounts,
no API keys, no service.

## Standing offer

If you re-run this against real model output, or against Safari proper, and get
a different number — send it. The corpus is frozen and the harness is
deterministic, so disagreement should be traceable to a specific cause rather
than to vibes.
