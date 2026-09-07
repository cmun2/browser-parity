# Experiment 01 — Does meaningful cross-engine layout divergence still exist?

Date: 2026-09-07 · Playwright 1.63.0 · Chromium 153.0.8010.12 · Firefox 155.0 · WebKit 26.6 (Safari 26.6-equivalent) · macOS arm64 · viewport 1280x800, DSF 1

Reproduce: `node scripts/probe.mjs && node scripts/diff.mjs`, `node scripts/probe2.mjs fixtures/<f>.html out/<f>.json`, `node scripts/support.mjs`

## Method

Two fixtures. `fixtures/cases.html` = 12 classic XBI-prone constructs (nested flex `min-width:auto`, grid `minmax(min-content,1fr)`, form controls, viewport units, sticky, typography, table overflow, UA defaults, flex-wrap, dynamic content, subpixel accumulation), 40 probed elements. `fixtures/modern.html` = 2026 interop-frontier CSS (anchor positioning, `field-sizing`, `text-wrap: balance/pretty`, subgrid, `line-clamp`, `scrollbar-gutter`, `text-box-trim`, container-query units, `overflow: clip` + sticky, popover, details), 16 probes.

For every probe we collect `getBoundingClientRect`, `scroll/client` box metrics, and 20 computed-style properties from all three engines, plus a parent-relative coordinate `(rx, ry) = elementRect - parentRect`.

`fixtures/cases-normalized.html` is byte-identical in body but adds a normalization layer: `box-sizing`, a pinned font stack (`Helvetica, Arial`), an explicit `line-height: 20px`, and `appearance: none` + uniform padding/border on form controls.

## Result 1 — raw absolute-coordinate diffing is 100% false positive

| Signal | cases.html (n=40) | cases-normalized.html (n=40) | modern.html (n=16) |
|---|---|---|---|
| diverges by **absolute** page coords (>0.5px) | **40 / 40** | 34 / 40 | 15 / 16 |
| diverges by **parent-relative** position | 21 / 40 | **12 / 40** | **3 / 16** |
| diverges by **size** (w/h) | 31 / 40 | **10 / 40** | 3 / 16 |

Not one element out of 40 had identical absolute geometry across all three engines.

The cause is a single root: Firefox's default `line-height` for a 16px `system-ui` line box is **20px**; Chromium and WebKit produce **18px**. That 2px per line box accumulates down the document, so by `y≈1200` every element is offset 36–41px. **One root cause produced 40 symptom rows.** A tool that ranks findings by pixel magnitude reports this as 40 critical bugs and buries anything real.

## Result 2 — the largest deltas are the least actionable

Ranked by magnitude, the top of the raw report is entirely native form controls:

```
c4-textarea  w: C=182    F=164.667 W=152      (Δ30.0)
c4-date      w: C=124.3  F=126.667 W=84.83    (Δ41.8)
c4-range     w: C=129    F=160     W=129      (Δ31.0)
c4-select    w: C=85     F=95.98   W=89       (Δ11.0)
c4-checkbox  w: C=13     F=14      W=12       (Δ2.0)
```

These are UA-stylesheet and native-widget-metric differences. They are *expected*, they are not defects, and they are the single loudest signal in the data. Magnitude ranking is actively inverted relative to usefulness.

## Result 3 — the target defect classes have converged

After normalization + parent-relative coordinates, these all agree to **<0.5px across all three engines**:

- C1/C2 nested flex `min-width: auto` overflow (the canonical XBI) — `563.125 / 562.833 / 563.125`
- C3 grid `minmax(min-content, 1fr)` — `403.797 / 403.8 / 403.797`
- C5 viewport units `vw / % / dvh / svh` — identical
- C6 sticky in a scroll container — identical
- C8 table intrinsic width, C10 flex-wrap + percentage height, C12 subpixel flex distribution — identical

`modern.html` is stronger still. `CSS.supports` probing shows Chromium/Firefox/WebKit **all** support anchor positioning, `field-sizing`, `text-wrap: balance`, subgrid, `scrollbar-gutter: stable`, `text-box-trim`, container-query units, `overflow: clip`, `dvh`, and view-transition names. Only `text-wrap: pretty` (absent in Firefox) and the standard `line-clamp` shorthand (absent in all three, so no divergence) differ. Measured geometry for subgrid, container-query units, `-webkit-line-clamp`, `scrollbar-gutter`, sticky-in-`overflow:clip`, `text-wrap: balance` and `pretty` is **bit-identical across engines**. Anchor positioning lands within 4.56px, and that residual comes from the anchor *button* being a form control, not from the anchoring math.

**CSS layout interop is substantially solved in 2026 for the defect classes the proposal targets.**

## Result 4 — what actually still diverges

Everything surviving normalization falls into exactly two buckets:

1. **Native form controls** — `appearance: none` closes most of it, but not `input[type=date]` (`143 / 137.8 / 98.1` wide), `input[type=range]` (`139 / 202 / 139`), or `progress`. WebKit's date input is 45px narrower than Chromium's after a full reset.
2. **Text shaping and font metrics** — glyph advance sums differ by 0.02–2.6px (`c7-sysui`: `420.953 / 423.55 / 420.953`), Firefox's default line box is 2px taller, and serif fallback heights differ (`18 / 16 / 18`). Sub-3px, and driven by the platform font stack as much as by the engine.

Both are "browsers are different," not "the agent wrote a bug."

## Result 5 — engine API divergence contaminates the evidence layer

Findings that any implementation must handle, discovered by accident:

- `element.scrollWidth/scrollHeight` on an **inline** element returns `0` in Chromium and WebKit but the real content size in Firefox (`c7-sysui`: `0 / 424 / 0`). Naive collection produces phantom divergences.
- `getComputedStyle().fontFamily` is serialized **without quotes** by WebKit (`system-ui, -apple-system, Segoe UI, ...`) and **with** quotes by Chromium/Firefox. String equality on computed styles is wrong; every property needs a per-property normalizer.
- `overflow-x` computes to `clip` in Chromium/Firefox but `visible` in WebKit on the same `<input>` — a *computed-value* divergence with no *used-behavior* divergence.
- Layout quantization differs per engine: Firefox uses 1/60px app units (`142.85`), Chromium and WebKit use 1/64px (`142.859375`). A noise floor must be quantization-aware, not a flat epsilon.
- `c9-fieldset` `clientHeight` = `50 / 54 / 34` — a genuine, large, real divergence in `<fieldset>` content-box resolution that survives everything. Rare, but real.

## Conclusions

1. The premise "cross-engine layout divergence exists and is measurable" is **true but trivially so** — everything diverges. The premise that matters, "divergence indicates a *defect*," is **largely false** on modern engines.
2. The hard problem is **not detection. It is suppression and root-cause collapse.** Parent-relative coordinates plus a normalization layer cut the finding count 40 → 12; nearly all of the remaining 12 are two known-expected classes.
3. This independently corroborates XBIDetective (arXiv 2512.15804): Mozilla's own results spend most of their accuracy budget on classifying **dynamic elements (84%)** and **advertisements (85%)** versus 79% on inconsistency detection. Their hard problem was noise too.
4. **Playwright's WebKit is not Safari.** It is a WebKit build driven by Playwright's own embedder, without Safari's UI chrome, WebKit's ITP/proprietary layers, or Apple's shipping configuration. UA reports `Version/26.6 Safari/605.1.15`, and the layout engine is genuinely WebKit — so *positive* findings (a divergence Playwright-WebKit shows) are usually credible. But *negative* findings do not clear Safari: "no divergence in Playwright WebKit" is not "works in Safari," and Safari-on-iOS — the highest-value target for most teams — is not covered at all. The tool cannot honestly market "prove it works in Safari."

---

# Experiment 02 — Real-world noise floor and whether it can be suppressed deterministically

Synthetic fixtures could flatter the idea. So: three real production sites, all three engines, 1280x900, `networkidle` + `document.fonts.ready` + 1.2s settle. Element correspondence by structural path (`TAG[nth-of-same-tag]` chain from `<body>`), matched only where the path exists in all three engines.

Reproduce: `node scripts/realworld.mjs <urls>` and `node scripts/funnel.mjs <url>`

## Raw divergence is catastrophic

| site | nodes matched in all 3 | absolute-coord Δ>0.5px | parent-relative Δ>0.5px | size Δ>0.5px |
|---|---|---|---|---|
| tailwindcss.com | 2103 | 637 (30.3%) | 515 (24.5%) | 570 (27.1%) |
| react.dev | 1514 | 1448 (**95.6%**) | 164 (10.8%) | 573 (37.8%) |
| playwright.dev | 233 | 48 (20.6%) | 74 (31.8%) | 56 (24.0%) |

**Hundreds of diverging nodes per page.** Naive cross-engine geometry diffing is unshippable — this confirms the risk directly. Note also that parent-relative coordinates alone are *not* sufficient on real pages (react.dev 95.6% → 10.8% is a big win; playwright.dev 20.6% → 31.8% is a *regression*, because relative coords surface divergences that absolute coords happened to cancel).

Diverging nodes are dominated by `SPAN` and by SVG-internal tags (`path`, `rect`, `circle`, `g`, `ellipse`, `use`).

## The suppression funnel — deterministic, no ML

Applying four rules in order:

| stage | tailwindcss.com | react.dev | playwright.dev |
|---|---|---|---|
| 0. raw (parent-relative or size Δ > 0.5px) | 638 | 611 | 74 |
| 1. drop SVG-internal nodes | 452 | 483 | 54 |
| 2. drop `display: inline` (text-metric noise) | **36** | **80** | **1** |
| 3. tolerance: max(2px, 1% of box) | 36 | 10 | 0 |
| 4. collapse inherited (parent carries same Δ) | **19** | **5** | **0** |

**638 → 19, 611 → 5, 74 → 0.** A 97–100% reduction with four deterministic rules and zero AI calls.

Rules 1 and 2 do almost all the work: SVG interiors and inline text boxes are ~92–98% of raw signal, and both are *categorically* expected divergence (rasterizer geometry; glyph shaping). This is the tolerance model the landscape review identified as unclaimed and as "the whole product." It is buildable, cheap, and testable.

## Honest caveat: the residual is still mostly noise

tailwindcss.com's 19 survivors are 16 `SPAN`s inside a `<CODE>` block **all at exactly Δ36.0px** plus 3 `DIV`s. Sixteen identical deltas among siblings is one root cause, not sixteen findings — a *sibling-uniform delta collapse* rule would take 19 → ~4. That rule is validated by this data and belongs in v0.1.

react.dev's survivors (Δ170.2 / 81.0 / 25.3px `DIV`s) are large enough to be real layout divergence or dynamic content; distinguishing those two is not yet solved and is the honest open risk.

So: **recall is not the problem and suppression is tractable. Final-stage precision is unproven.** That is where the remaining risk lives, and it is the first thing v0.1 must measure rather than assume.
