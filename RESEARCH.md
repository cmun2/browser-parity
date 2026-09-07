# BrowserParity — Research & Decision Brief

Date 2026-09-07 · Playwright 1.63.0 · Chromium 153 / Firefox 155 / WebKit 26.6 · macOS arm64

Supporting detail: [`docs/research/papers.md`](docs/research/papers.md) · [`docs/research/landscape.md`](docs/research/landscape.md) · [`docs/research/experiment-01-divergence.md`](docs/research/experiment-01-divergence.md)

**Recommendation: BUILD-TO-TEST, with the thesis inverted from the original brief.** The citations are real. The competitive gap is real. But the stated problem — "AI writes a frontend, subtle WebKit layout bug appears" — is *much rarer in 2026 than the brief assumes*, and that is measured, not guessed. The project survives because engine convergence is what makes a low-false-positive oracle possible, not because cross-browser bugs are common. The risk to kill on is **base rate**, not noise.

---

## 1. Problem

An AI coding agent implements a frontend. Lint, typecheck and tests pass. It renders correctly in Chromium — the only engine most agents can see. Any divergence in Firefox or WebKit is invisible to the agent, so the human becomes the sensor: notice it, reproduce it, explain it in prose, wait for a fix, re-verify by hand. The agent's iteration loop is seconds; the human verification loop is minutes to hours, and it does not parallelise.

The existing tooling does not close this loop, because all of it compares **one browser against its own past self** and therefore requires a stored baseline that a freshly generated page does not have. On new code — exactly the AI-generated case — every visual regression tool in the market has nothing to compare against.

## 2. Why now

- **Playwright ships all three real engines behind one `npx playwright install`.** The previous generation of academic cross-browser tools (XFix, Browserbite, WebSee, X-PERT) was built on Selenium and is uniformly dead by ~2018. The distribution problem that killed them is solved.
- **Engines have converged.** Measured: after normalising fonts and UA control styles, nested-flex `min-width:auto`, grid `minmax(min-content,1fr)`, sticky, viewport units, subgrid, container-query units, `scrollbar-gutter`, `text-box-trim`, anchor positioning and `overflow:clip` all agree to **<0.5px across all three engines**. This is the enabling condition, not a threat: cross-engine agreement is only usable as an *oracle* if agreement is the normal case. In 2018 it wasn't.
- **AI agents generate frontends faster than humans verify them**, and they are structurally single-engine.
- **Mozilla is actively working this problem** (XBIDetective, ICSE-SEIP 2026) — but with VLMs on screenshots, and only Firefox vs Chrome.

## 3. Existing solutions

No tool, at any price, compares element geometry or computed styles *between engines* at one commit. Three of the most-used tools run all three engines and explicitly decline to compare them: Chromatic (*"does not programmatically compare snapshots from different browsers against each other"*), Playwright (*"you will need different snapshots for them"*), Storybook test-runner (*"does not compare results across browsers automatically"*).

Applitools markets exactly our pitch, but its baseline key (`appName`+`testName`+viewport+HostOS+**HostApp**+versions) makes cross-browser comparison structurally impossible, and its engines are **DOM-snapshot reproductions, not real Gecko/WebKit**. Closest real neighbour is `styleproof` (756 dl/wk) — our extraction layer and our thesis, but Chromium-only with a temporal baseline. Full survey in `docs/research/landscape.md`.

## 4. Exact gap / novelty

**The comparison axis, and the absence of a baseline.**

Everyone compares `t0 → t1` within one engine. We compare `chromium ↔ firefox ↔ webkit` at one commit. The three engines are each other's oracle, so there is **no baseline, no golden images, no storage, no cloud account, no history**. That deletes the entire persistence layer that Percy, Chromatic, Argos and Lost Pixel exist to *sell* — which is precisely why no incumbent would build it.

Two secondary novelties: **real engines instead of emulated ones** (a checkable claim of being more truthful than the $667/mo incumbent on its own headline), and a **published deterministic tolerance model** for cross-engine geometry, which nobody has.

## 5. Technical hypothesis — the smallest falsifiable one

> On a corpus of AI-generated frontend pages, a purely deterministic cross-engine geometry comparison surfaces **≥1 human-confirmed true layout defect per 10 pages**, while emitting **≤5 findings per page**, with **zero AI calls and zero stored baselines**.

Two numbers, two failure modes, both cheap to measure:

- **≤5 findings/page** is the precision/noise bound. **Already substantially de-risked:** measured 638→19, 611→5, 74→0 on tailwindcss.com, react.dev and playwright.dev using four deterministic rules (drop SVG interiors, drop `display:inline`, tolerance `max(2px, 1%)`, collapse inherited deltas). A fifth validated rule (sibling-uniform delta collapse) should take tailwindcss.com's 19 to ~4.
- **≥1 true defect per 10 pages** is the **base rate**, and it is the real kill criterion. It is *not* de-risked. Engines agree so well now that the tool may simply have nothing to report. A tool that never fires cannot be adopted, however elegant.

## 6. MVP scope (v0.1 — no AI)

`npx browser-parity <url>` →

1. Load the URL in Chromium, Firefox and WebKit at a fixed viewport, waiting on `networkidle` + `document.fonts.ready`.
2. Per engine, per element: structural path, `getBoundingClientRect`, parent-relative offset, `scroll`/`client` box, a curated computed-style set, `namespaceURI`, `display`.
3. Correspond elements across engines by structural path; report unmatched nodes separately (they mean DOM-level divergence, a different and louder finding).
4. Apply the suppression pipeline; classify each survivor into `expected-engine-difference` / `candidate-divergence` / `dom-mismatch`.
5. Emit `parity.json` and a self-contained static HTML report with the three screenshots and the finding list.
6. Exit non-zero if any `candidate-divergence` survives.

**Explicitly in scope because measurement demands it:** a normalization preset (`--normalize`) that injects the font/line-height/`appearance:none` layer, since form controls and text metrics are the two irreducible noise classes.

**Not in the MVP:** pixel comparison of any kind, source attribution, fix proposal, any model call.

## 7. Architecture

Order of derivation is Problem → Requirements → Architecture → Technology; see `ARCHITECTURE.md`. Summary:

`core/` (zero AI, zero network beyond the page under test) = `collect` → `correspond` → `diff` → `classify` → `report`. Each stage is a pure function over serialisable data. `collect` output is a versioned on-disk artifact, so `correspond`/`diff`/`classify` are testable against fixture JSON with no browser at all — the entire interesting logic runs in milliseconds in unit tests.

`agents/` and `ui/` sit strictly downstream of `core/`'s JSON and are optional.

**Runtime:** native Node CLI, local-first, single process, three sequential browser launches. **No client/server, no daemon, no service.**

**Docker: not a default, and deliberately so.** Playwright already solves browser distribution. More importantly, our two dominant noise sources are font metrics and font *availability* — so containerising changes the fonts and therefore changes the results, which is a correctness hazard dressed as reproducibility. Docker is provided for exactly one job: the **benchmark corpus**, where a pinned font set is required for numbers to be comparable across machines. Day-to-day use must run against the developer's real fonts, because that is the environment whose bugs matter.

**CI:** a GitHub Action running the same CLI. Determinism is enforced by pinning the Playwright version (engine versions are a function of it), fixing viewport and `deviceScaleFactor`, forcing `reducedMotion`, and recording `{playwrightVersion, engineVersions, os, fontFingerprint}` into every report so two runs can be told apart when they disagree.

## 8. Biggest technical risks

1. **Base rate ≈ 0 (kill risk).** Modern engines agree on modern CSS. Measured directly: the brief's entire target list (flex intrinsic sizing, grid, overflow, sticky, viewport units) converged to <0.5px. If real AI-generated pages produce no true findings, there is no product. *Measure before building anything else.*
2. **Playwright's WebKit is not Safari.** It is a real WebKit layout engine (so *positive* findings are credible), but not Apple's shipping configuration, and **iOS Safari is not covered at all**. A negative result does not clear Safari. The tool cannot honestly promise "proves it works in Safari" — and Safari is the reason most teams want cross-browser testing. This is a permanent ceiling on the value proposition, not a bug to fix.
3. **Node identity across engines.** Structural paths break the moment engines disagree at the DOM level (hydration order, `<tbody>` insertion, error recovery). Identified in the survey as *the* unclaimed hard problem. Mitigation: treat path mismatch as a first-class finding, not a failure.
4. **Final-stage precision unproven.** Suppression works, but the survivors are still majority noise (16 of tailwindcss.com's 19 are one root cause). Distinguishing "real layout divergence" from "dynamic content" at the residual stage is unsolved.
5. **Engine-API divergence contaminates evidence collection.** Measured: `scrollWidth` on inline elements returns `0` in Chromium/WebKit and the real value in Firefox; `getComputedStyle().fontFamily` is unquoted in WebKit; `overflow-x` computes `clip` vs `visible` for identical behaviour; layout quantization is 1/60px in Firefox and 1/64px elsewhere. Every extracted property needs a per-property, per-engine normalizer, and each is a latent false-positive source.
6. **Adoption, evidenced.** `styleproof` (this thesis, 756 dl/wk), `lost-pixel` (1,684★, **archived 2026-04**), `acoyfellow/visual-diff` (abandoned after two days) versus `pixelmatch` at 6.8M/wk. The market has repeatedly chosen dumb pixels over smart structural comparison.

## 9. What NOT to build yet

- **Any VLM/AI layer.** The closest published benchmark (WUICC-bench) scores zero-shot VLMs at **0.0363–0.0920 BLEU-4**; the best *trained* model reaches 0.2571. Off-the-shelf models are weak at this task today. The deterministic core must be useful alone, and if it is, the AI layer may never be needed.
- **Pixel diffing.** Playwright can already share one screenshot baseline across engines by omitting `{projectName}` from `snapshotPathTemplate`. Nobody does it because antialiasing and font hinting swamp the signal. Adding pixels re-imports the exact problem the incumbents burned a decade of ML on.
- **Source attribution, fix proposal, rerun-and-prove.** All are downstream of a finding being *correct*, which is unproven.
- **MCP server / Claude Code skill / GitHub Action.** Distribution for a tool with an unvalidated base rate.
- **A hosted service, dashboard, or account system.** The no-baseline property is the differentiator; adding storage destroys it.
- **Safari-proper or iOS support.** Requires paid device clouds.

## 10. First implementation milestone

**Not a feature — a measurement.** Two weeks, and it can only produce a kill or a go.

Assemble a corpus of **30 AI-generated pages** (prompt a coding agent for varied UI: dashboard, pricing table, settings form, nav + sidebar, data grid, modal, marketing hero — no cherry-picking for known-hard CSS). Run the v0.1 pipeline over all 30. Then **manually inspect every survivor in all three engines** and label it `true defect` / `expected engine difference` / `dynamic content` / `tool artifact`.

Ship exactly enough to do that: `collect`, `correspond`, `diff`, the five suppression rules, JSON out, and a bare HTML report. No packaging, no CLI polish, no docs site.

**Go** if ≥3 of 30 pages yield a human-confirmed true defect at ≤5 findings/page median.
**Kill** if 0 of 30 yield a true defect — the gap is empty because the problem is gone, and that is a genuinely valuable thing to have learned in two weeks.
**Pivot** if findings are real but all trace to form controls and text metrics: the honest product is then a *cross-engine design-system linter* ("your component library renders 45px narrower in WebKit"), not a bug detector.
