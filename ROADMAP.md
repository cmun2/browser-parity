# Roadmap

Gated, not scheduled. Each milestone must produce a number that permits the next one. The first gate can kill the project, and is designed to.

## M0 — Base-rate measurement (2 weeks) · **GATE: build or kill**

The first milestone is a measurement, not a feature.

Build only: `collect`, `correspond`, `diff`, the six `classify` rules, `findings.json`, a bare HTML report. No packaging, no CLI polish, no docs site, no tests beyond the tolerance model.

Then: assemble **30 AI-generated pages** by prompting a coding agent for varied UI (dashboard, pricing table, settings form, nav + sidebar, data grid, modal, marketing hero). No cherry-picking for known-hard CSS — cherry-picking invalidates the base rate, which is the entire point. Run the pipeline over all 30 and **manually inspect every survivor in all three engines**, labelling each `true defect` / `expected engine difference` / `dynamic content` / `tool artifact`.

| outcome | decision |
|---|---|
| ≥3 of 30 pages yield a human-confirmed true defect, median ≤5 findings/page | **Go** → M1 |
| 0 of 30 yield a true defect | **Kill.** Engines have converged; the problem is gone. Publish the measurement — it is a genuinely useful negative result and the corpus is reusable. |
| Findings real but all trace to form controls / text metrics | **Pivot** to a cross-engine *design-system linter* ("your button is 45px narrower in WebKit"), which is a different and smaller product. |
| Median >5 findings/page | Suppression insufficient → one more rule iteration, then re-gate. Do not proceed on hope. |

**Deliverable: a number and a labelled corpus.** Nothing else.

## M1 — Deterministic core, made real (post-go)

Harden what M0 proved. `npx browser-parity <url>` as a genuine CLI: exit codes, `--normalize` preset (font/line-height/`appearance:none`), per-rule toggles, `--viewport`, multi-URL runs. Per-property `R5` normalizers for every extracted property, each with a regression test. The tolerance model gets a unit-test suite running against checked-in evidence JSON with no browser. Benchmark corpus + its Dockerfile (pinned fonts) so precision changes are visible as committed diffs.

Ship it. This is the point at which the project is publicly useful and the point at which the adoption question gets a real answer.

## M2 — Element correspondence, properly

Only once M1 is in real use and correspondence failures are observed rather than imagined. Structural paths break on DOM-level engine disagreement (hydration order, `<tbody>` insertion, error recovery). This is the unclaimed hard problem in the field; attempting it before having failure cases would be guessing. Attribute-and-content-anchored matching with structural-path fallback, and `dom-mismatch` promoted to a fully reported finding class.

## M3 — Source attribution

Map a finding back to the CSS rule and source location responsible. Deterministic first — `getMatchedCSSRules`-equivalents, stylesheet provenance, CSSOM walking — before any model is considered. Attribution is only meaningful if findings are correct, which M0/M1 establish.

## Deferred — with the condition that would un-defer each

| deferred | un-defer when |
|---|---|
| **VLM / agent layer** | The deterministic core is in real use *and* a specific residual class is provably unclassifiable deterministically. Published zero-shot VLMs score 0.036–0.092 BLEU-4 on the nearest benchmark; this is not a freebie. |
| **Pixel comparison** | Probably never. Playwright can already share one baseline across engines via `snapshotPathTemplate`; nobody does it because antialiasing swamps the signal. Adding pixels re-imports the problem the incumbents spent a decade on. |
| **MCP server / Claude Code skill** | M1 has external users. Distribution for an unvalidated base rate is wasted work. |
| **GitHub Action PR reports** | Same gate as above. |
| **Fix-and-prove loop** | M3 lands and attribution is measured accurate. |
| **Hosted service / dashboard / accounts** | Never. The no-baseline property is the differentiator; adding storage destroys it. |
| **Safari-proper, iOS** | Requires paid device clouds — out of scope under current constraints. Must be stated as a known limitation in the README rather than implied away. |

## Standing honesty requirement

The README must state plainly that **Playwright's WebKit is not Safari**: positive findings are credible, negative findings do not clear Safari, and iOS Safari is not covered. Overselling this is the fastest way to lose the credibility that the "real engines, not emulated" differentiator depends on.
