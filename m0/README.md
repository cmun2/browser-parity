# M0 — base-rate measurement

**This milestone is a measurement, not a feature. It can only produce a kill or a go.**

The detector already works. Experiment 02 showed four deterministic rules take
638 / 611 / 74 raw cross-engine findings on real production sites down to
19 / 5 / 0, with zero AI calls. Precision is not the open question.

The open question is whether there is **anything left to find**. Modern engines
have converged: after normalisation, every construct on the classic
cross-browser-bug list — nested-flex `min-width:auto`, grid
`minmax(min-content,1fr)`, sticky, viewport units, subgrid, container-query
units, `overflow:clip` — agrees to under 0.5px across Chromium, Firefox and
WebKit. A tool that never fires cannot be adopted, however elegant.

So: **30 pages, no cherry-picking, every surviving finding labelled by hand.**

| outcome | decision |
|---|---|
| ≥3 of 30 pages yield a genuine defect, median ≤5 survivors/page | **GO** → M1 |
| 0 of 30 yield a genuine defect | **KILL**, and publish the negative result |
| defects are real but all form controls / text metrics | **PIVOT** to a cross-engine design-system linter |
| ≥3 pages but median >5 survivors/page | **GO-BLOCKED-ON-PRECISION** — one more suppression rule, then re-gate |
| 1–2 pages with a defect | **INCONCLUSIVE** — the pre-registered thresholds do not decide it |

The rule is in `scripts/verdict.mjs`, written before the labels existed, so the
verdict is a function of the data rather than of how the data reads on the day.

---

## Run it

Five commands. Only one of them needs you at the keyboard.

```sh
# 0. once, if you have not already
npx playwright install

# 1. run the pipeline over the frozen corpus            ~6 min, unattended
node m0/scripts/run.mjs                # 215s collect + 126s crops, measured

# 2. label the survivors                                ~20-40 min, YOU
node m0/scripts/label.mjs              # then open http://localhost:8731
                                       # 475 survivors, grouped into 138 units

# 3. compute the verdict                                instant
node m0/scripts/verdict.mjs
```

`m0/results/incidence-v0.1.json` is the deliverable. If the verdict is KILL, fill
in `m0/NEGATIVE-RESULT-TEMPLATE.md` and publish it.

**Try the labelling flow first** if you want to see what you are in for — it runs
on three clearly-marked synthetic entries and writes to a separate file that the
verdict refuses to read:

```sh
node m0/scripts/gen-demo.mjs && node m0/scripts/label.mjs --demo
```

The corpus is already generated and frozen. You only need these if you are
starting a **new** corpus version, and both refuse to clobber a frozen one:

```sh
node m0/scripts/gen-corpus.mjs                 # regenerate pages from the specs
node m0/scripts/run.mjs --shots-only           # ~2 min, re-render crops only
node m0/scripts/smoke.mjs --screenshots        # ~2 min, Chromium only, pre-freeze sanity
node m0/scripts/freeze.mjs                     # hash and lock
```

## The labelling pass

Three keys, auto-advance, and it saves to disk before it advances — quit any time
and re-running resumes exactly where you stopped.

| key | meaning |
|---|---|
| **1** | **genuine defect** — the page is wrong in one engine. Then pick a class: `f` form control · `t` text/font metric · `l` layout · `o` other |
| **2** | **expected engine difference** — real, but "browsers are different", not "the agent wrote a bug" |
| **3** | **tool artifact** — the finding is our bug: bad correspondence, dynamic content, a measurement error |
| **s** | skip / unsure — revisit later with `r` |
| **u** | undo the last judgement |
| **n** | attach a note to the current judgement |

Each screen shows the three engines cropped to the same element at the same crop
size, the element's structural path and selector, which property differs and by
how much, the per-engine values, and any computed styles that also differ. There
is an **open page ↗** link if you need to see the element in context.

**The defect class on key 1 is what separates GO from PIVOT.** `form-control` and
`text-metric` are the two known-expected classes; if every genuine defect is one
of those, the honest product is a design-system linter, not a bug detector. Be
strict here — that distinction is the whole point of asking.

**Findings are grouped by root cause.** Findings on one page sharing a tag and a
delta to the quarter-pixel are one cause with N symptoms (experiment 02 saw 16
`SPAN`s in a `<code>` block all at exactly 36.0px). The UI shows them as one unit
and your judgement applies to all members. This changes how long review takes,
not what was measured — the survivor count in the verdict is the ungrouped one.

## How to read the verdict

`m0/results/incidence-v0.1.json`, top to bottom:

- **`verdict`** and **`rationale`** — the decision and why, in one line each.
- **`incidence`** — the number this milestone exists to produce. Read
  `pagesWithGenuineDefect` out of `pagesTotal`, then read
  `confidenceInterval95` immediately after, because 30 pages is a small sample
  and the interval is wide by construction. If the count is zero,
  `ruleOfThreeUpperBound` gives the 95% upper bound on the true rate — with 0/30
  that is 10%, which rules out a *common* defect and says nothing about a rare one.
- **`precision`** — the ≤5-survivors/page half. Largely de-risked already; it is
  a sanity check here, not the gate. Watch `survivorsPerPage.median`, not the
  mean: the distribution is long-tailed, and one dense page can carry hundreds.
- **`labels`** — including `skipped`. If skips could flip the verdict, the
  rationale says so explicitly.
- **`nondeterministicPages`** — pages that rendered differently on two loads of
  the *same* engine. Should be empty. Any finding on such a page is uninterpretable.
- **`perPage`** — every finding with its label, so anyone can audit the call.
- **`limitations`** — read this before quoting any number from the file.

## Why you can trust the number

Cherry-picking is the one thing that would invalidate this study, so the design
tries to make it hard rather than merely discouraged:

1. **The corpus was frozen before it was measured.** `corpus/manifest.json`
   carries a SHA-256 per page and a corpus hash over all of them, and it was
   committed in its own commit *before* the first run — the ordering is visible
   in `git log`, not merely asserted.
2. **Every later stage re-hashes the corpus** and exits loudly if a byte moved.
   `gen-corpus.mjs` and `freeze.mjs` both refuse to overwrite a frozen corpus.
3. **The pre-freeze sanity check is single-engine on purpose.** `smoke.mjs` runs
   Chromium only, so nothing about cross-engine agreement could leak back into
   how the pages were authored.
4. **The pages are generated from written briefs**, all 30 published in
   `corpus/SPECS.md`, so the mix is reviewable as a mix rather than taken on trust.
5. **The suppression rules are imported from `scripts/funnel.mjs`**, the same code
   that produced the published 638→19 numbers. M0 adds no detection logic and
   cannot quietly tune the rules.
6. **The decision thresholds are in code, written before the labels existed.**
7. **The corpus is deterministic** — no `Math.random`, no `Date`, no timers, no
   network — and the runner re-collects one engine twice per page to prove it.
   A page that disagrees with itself is flagged, not silently averaged away.

The honest residual risk: one person wrote both the briefs and the renderer. The
freeze protects against tuning *after* results; it cannot protect against a
corpus that was unrepresentative from the start. Which is the next section.

## What a result here does and does not prove

**Playwright's WebKit is not Safari.** It is a real WebKit layout engine driven by
Playwright's own embedder — not Apple's shipping configuration, without Safari's
UI chrome and proprietary layers, and **iOS Safari is not covered at all**.

- A **positive** finding is credible evidence of genuine cross-engine divergence.
- A **negative** result does **not** clear Safari. "No divergence in Playwright
  WebKit" is not "works in Safari," and Safari is the reason most teams want
  cross-browser testing in the first place.

This is a permanent ceiling on the value proposition, not a roadmap item. It is
restated in the verdict file so the number cannot travel without it.

**The corpus is hand-authored in an AI-typical idiom, not model-emitted.** The
study ran under a no-paid-API constraint, so no hosted model was called. The 30
pages were written by hand to look like coding-agent output: utility classes or a
single embedded stylesheet, inline stroke icons, system font stacks, flex/grid
scaffolding, native form controls, no build step. The briefs are published so the
identical study can be re-run against real model output — **that is the single
cheapest thing that could overturn a KILL, and it should be the first follow-up.**

Further limits, all recorded in the verdict file: one machine, one OS, one font
set; static local pages with no network, no JS-driven layout and no hydration
(which removes DOM-level correspondence failures, a real finding class this
corpus cannot contain); one viewport in the initial state, so no hover, focus or
narrow-viewport behaviour; and no normalization preset, so the font and
form-control noise classes are present exactly as the tool would report them on
the page as written.

## Files

```
m0/
  corpus/
    SPECS.md              the 30 briefs, and the mix
    manifest.json         frozen: per-page SHA-256 + corpus hash
    pages/*.html          the corpus (30 files, do not edit)
    assets/util.css       shared utility stylesheet
  scripts/
    specs.mjs             the 30 specifications as data
    components.mjs        deterministic component library
    gen-corpus.mjs        specs -> pages          (refuses once frozen)
    smoke.mjs             pre-freeze sanity       (Chromium only, by design)
    freeze.mjs            hash and lock           (refuses to re-freeze)
    verify-corpus.mjs     shared tamper check
    run.mjs               3 engines -> survivors + element crops
    label.mjs             the labelling UI
    gen-demo.mjs          synthetic fixtures for --demo
    verdict.mjs           survivors + labels -> incidence-v0.1.json
  results/
    survivors.json        every finding, per page       (committed)
    labels.jsonl          your judgements, append-only  (committed)
    incidence-v0.1.json   the verdict                   (committed)
    shots/ evidence/ smoke/   large artifacts           (gitignored)
  NEGATIVE-RESULT-TEMPLATE.md
```

## The validation set — the same briefs, emitted by a model

The limitation above ("hand-authored in an AI-typical idiom, not model-emitted")
applies to a GO exactly as much as it would have applied to a KILL. A defect rate
measured on pages a person wrote while imagining what an agent writes is evidence
about that person's imagination until it is checked.

`m0/validation/` checks it. Ten of the thirty briefs, handed as text to a coding
agent, written in whatever idiom it produces by default, frozen in its own commit
before anything was run against it, then put through **the same pipeline, the
same four suppression rules and the same thresholds** — every stage takes
`--set`, and nothing else about any stage changes.

```sh
node m0/scripts/run.mjs      --set validation   # done: 821 raw -> 106 survivors
node m0/scripts/label.mjs    --set validation   # NOT done — this is yours
node m0/scripts/verdict.mjs  --set validation   # only meaningful after labelling
node m0/scripts/compare.mjs  --a . --b validation
```

**The survivors exist; the defect rate does not yet.** Nobody but you can say
which survivors are genuine, so none were labelled. What is objective, and what
`compare.mjs` reports:

| same ten briefs | hand-authored | model-emitted |
|---|---:|---:|
| raw findings | 1054 | 821 |
| survivors | 428 | 106 |
| survivors/page, median | 29 | 1.5 |
| pages with ≥1 survivor | 9/10 | 6/10 |
| survivors on tables | 74.8% | 76.4% |
| survivors on form controls | 13.8% | 2.8% |
| width + offset-x share | 84.8% | 83.1% |
| WebKit is the odd engine out | 62.1% | 91.5% |

Model output diverges in the same element families at a quarter of the rate, and
the whole gap sits at the tolerance rule — hand-authored deltas mostly clear
`max(2px, 1% of box)`, model-emitted deltas mostly do not. The mix of the ten is
weighted toward the categories where M0 found defects, so read the paired and
one-per-category columns, never the raw 10-page rate against 53.3%.
`m0/validation/corpus/SPECS.md` has the briefs and the caveats.

## Not in M0

No packaging, no CLI polish, no `--normalize` preset in the measured path, no
source attribution, no VLM layer, no MCP server, no docs site. Those are M1+ and
they are all downstream of this number.
