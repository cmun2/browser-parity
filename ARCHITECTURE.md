# Architecture

Derived strictly Problem → Technical Requirements → Architecture → Technology. Nothing below is chosen because it is pleasant; each element traces to a requirement, and each requirement traces to the problem.

## 1. Problem (restated as a system statement)

Given one URL at one commit and no baseline, decide which differences between three rendering engines are **defects** rather than **expected engine behaviour**, and present them so a human or an agent can act without opening DevTools.

## 2. Technical requirements

Derived from the problem and from the measurements in `docs/research/experiment-01-divergence.md`.

| # | Requirement | Forced by |
|---|---|---|
| R1 | No stored baseline, no history, no account. The engines are each other's oracle. | The AI-generated case has no past self to compare to. This is also the differentiator (§4 of RESEARCH.md). |
| R2 | Evidence collection must be deterministic and reproducible, and must record the exact environment. | Two runs that disagree must be distinguishable from two engines that disagree. |
| R3 | Suppression is a first-class pipeline stage, not a threshold. | Measured: raw comparison yields 638/611/74 findings per real page. Naive diffing is unshippable. |
| R4 | Findings must collapse to **root causes**, not symptoms. | Measured: one 2px `line-height` difference produced 40 symptom rows; 16 of tailwindcss.com's 19 survivors are one cause. |
| R5 | Every extracted property needs a per-property, per-engine normalizer. | Measured: `scrollWidth`=0 on inline in Chromium/WebKit but not Firefox; unquoted `fontFamily` in WebKit; `overflow-x` `clip` vs `visible`; 1/60px vs 1/64px quantization. |
| R6 | Element correspondence must degrade gracefully and report its own failure. | Engines can disagree at the DOM level; a mismatch is a *finding*, not a crash. |
| R7 | Zero AI calls and zero network egress in the core path. | Hard constraint; also RESEARCH.md §9 — the AI layer is unproven and must never be load-bearing. |
| R8 | The interesting logic must be testable without launching a browser. | Otherwise the tolerance model — the entire product — is untestable in CI at reasonable cost. |
| R9 | Must not alter the font environment of the page under test by default. | Font metrics and font *availability* are two of the three noise classes; changing them changes the answer. |

## 3. Architecture

```
                    ┌─────────────────── core/  (zero AI, zero egress) ───────────────────┐
                    │                                                                      │
  url ──▶  collect ─┼─▶ evidence.json ──▶ correspond ──▶ diff ──▶ classify ──▶ findings.json
                    │      (R2, R5)          (R6)        (R3)      (R3,R4)        │
                    │   3 engines, one                                             │
                    │   process, sequential                                        │
                    └──────────────────────────────────────────────────────────────┼───────┘
                                                                                   │
                                              ┌────────────────────────────────────┴────────┐
                                              ▼                                             ▼
                                    report/ (static HTML)                        agents/ (OPTIONAL)
                                    zero AI, ships in v0.1                       attribute · propose · verify
                                                                                 consumes findings.json only
```

Five pure stages over serialisable data. `collect` is the only stage that touches a browser; `correspond`, `diff` and `classify` are pure functions from JSON to JSON, satisfying **R8** — the tolerance model is unit-testable against checked-in fixture evidence in milliseconds, with no browser.

### Stage responsibilities

**`collect`** — for each engine: launch, fixed viewport + `deviceScaleFactor: 1` + `reducedMotion: 'reduce'`, `goto(networkidle)`, `await document.fonts.ready`, settle, then one `page.evaluate` extracting per element: structural path, `getBoundingClientRect`, parent-relative offset, `scroll`/`client` box, curated computed styles, `namespaceURI`, `display`, plus a full-page screenshot (report only — never compared). Applies the **R5** normalizers at the point of extraction so downstream stages never see engine-specific serialisations. Writes `{playwrightVersion, engineVersions, os, viewport, fontFingerprint}` (**R2**).

**`correspond`** — keys elements across engines by structural path (`TAG[nth-of-same-tag]` chain). Nodes present in some engines but not others are emitted as `dom-mismatch` findings and excluded from geometry comparison (**R6**).

**`diff`** — per corresponded node, computes deltas on parent-relative position and size. **Parent-relative is the primary signal; absolute coordinates are reported but never thresholded**, because a single inherited difference shifts everything below it (measured: 40/40 and 95.6% absolute-divergence rates).

**`classify`** — the product. An ordered, individually-toggleable rule chain, each rule attributing a reason to what it suppresses:

1. `svg-interior` — drop non-HTML-namespace descendants (rasterizer geometry).
2. `inline-text` — drop `display: inline` (glyph shaping).
3. `tolerance` — `max(2px, 1% of box)`, quantization-aware.
4. `inherited-delta` — drop nodes whose delta matches their parent's (**R4**).
5. `sibling-uniform` — collapse N siblings sharing one delta into one root-cause finding (**R4**).
6. `known-class` — tag survivors as `form-control` or `font-metric` rather than dropping them; these are real but expected, and belong in a separate report section.

Measured on real pages: 638→19, 611→5, 74→0.

**`report`** — one self-contained HTML file, three screenshots side by side, findings grouped by root cause with the evidence (which engines, which property, which delta) inline. No AI, ships in v0.1.

### Separability

`core/` is a library and a CLI with no knowledge that `agents/` or `ui/` exist; it is useful and complete on its own (**R7**). `agents/` consumes `findings.json` as its sole input and can be deleted without touching `core/`. The dependency arrow never reverses.

## 4. Technology

Chosen last, and only where a requirement forces it.

- **Playwright** — the only tool that drives all three real engines from one API with one install. Non-negotiable; it *is* the "why now."
- **Node + TypeScript** — Playwright's first-class runtime; the ecosystem the target users already have.
- **Zero runtime dependencies beyond Playwright.** No image library (we never compare pixels), no cloud SDK (**R1**), no model client (**R7**).
- **JSON artifacts on disk between stages** — makes **R8** free and makes every bug reproducible from a checked-in file.
- **Runtime shape: native, local-first, single process, three sequential browser launches.** No daemon, no client/server, no service. There is no shared state to coordinate and no reason to pay for a network hop.

### Docker — not a default; here is the justification both ways

**Default: no Docker.** Playwright already solves browser distribution. Containerising *changes the installed font set*, and font metrics plus font availability are two of our three noise classes — so a container would silently change the answers (**R9**). Day-to-day the tool must run against the developer's real fonts, because that is the environment whose bugs matter. Docker here would be reproducibility theatre that costs correctness.

**Exception: the benchmark corpus ships a Dockerfile.** Comparing tolerance-model numbers across machines and across time requires a pinned font set, or the measurements are not comparable. That is a genuine need, it is confined to benchmarking, and it must never become the default execution path.

### CI and benchmark reproducibility

A GitHub Action runs the same CLI — no separate code path. Determinism comes from pinning the Playwright version (engine versions are a pure function of it), fixing viewport and `deviceScaleFactor`, forcing `reducedMotion`, and stamping `{playwrightVersion, engineVersions, os, fontFingerprint}` into every report (**R2**). The benchmark corpus is versioned alongside the tolerance rules, so a rule change that regresses precision is visible as a diff in committed finding counts.
