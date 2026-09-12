# BrowserParity

**Baseline-free cross-engine UI verification.**

Every visual testing tool compares a browser to its own past self. That needs a baseline,
which means storage, an account, and a golden image you have to approve. On code an agent
generated a minute ago there is no past self to compare against.

BrowserParity compares the same page, at the same moment, across Chromium, Firefox and
WebKit, and treats the engines as each other's oracle. No baselines, no golden images,
no service.

```
npx browser-parity http://localhost:3000
```

## Status: pre-M0. Do not use this yet.

The detector is not the hard part; suppression is. On real sites, naive cross-engine
geometry diffing produces unusable noise, and four deterministic rules take it to something
a person can read:

| site | raw findings | after suppression |
|---|---:|---:|
| tailwindcss.com | 638 | 19 |
| react.dev | 611 | 5 |
| playwright.dev | 74 | 0 |

Zero AI calls. Dropping SVG interiors and `display:inline` nodes alone removes 92–98%.
That tolerance model is the project.

## The open question

Modern engines have converged. On current Chromium / Firefox / WebKit, nested-flex
`min-width:auto`, grid `minmax(min-content,1fr)`, sticky, viewport units, subgrid,
container-query units and `overflow:clip` all agree to **under 0.5px** once fonts and UA
styles are normalized. So the risk is not false positives. It is that there may be nothing
left to find.

**M0 answers that before anything else gets built:** 30 AI-generated pages, no
cherry-picking, every surviving finding labelled by hand.

- **Go** at 3+ genuine defects out of 30
- **Kill** at 0 — and publish the negative result
- **Pivot** to a cross-engine design-system linter if the findings are all form controls
  and text metrics

The harness is built and the corpus is frozen — see **[`m0/README.md`](m0/README.md)**.
The 30-page corpus was committed before it was measured, and every stage re-hashes
it, so the base rate cannot be tuned after the fact. The measurement has been run
(1722 raw findings → 475 survivors, median 4/page); the hand-labelling pass that
produces the verdict has not.

## Known ceiling

Playwright's WebKit is not Safari. A finding is credible; the absence of one does not clear
Safari, and iOS is not covered at all. Safari is the main reason people want this, so this
is a permanent limitation rather than a roadmap item.

## The optional AI investigator

The deterministic core never needs a model. On top of it there is an optional
layer that explains *why* a divergence happened — bring your own key; this
project never proxies a model request and never pays for anyone's inference.

How optional it is, is a measurement rather than a claim. A deterministic
known-cause matcher, built from the mechanisms in the labelled corpus, explains
**97.2% of the survivors on a corpus it was never derived from**, with a
mechanism and a fix and no model in the loop. See **[`ai/README.md`](ai/README.md)**
and `node --experimental-strip-types ai/coverage.ts`.

Three models were then run against the same findings to ask whether the layer is
worth switching on at all. None contradicted a rule that was right; two of them
caught rules that were wrong. **[`ai/MODEL-COMPARISON.md`](ai/MODEL-COMPARISON.md)**

`ai/` can be deleted; there is a test that deletes it and runs the core anyway.

## Research

`RESEARCH.md` · `ARCHITECTURE.md` · `ROADMAP.md` · `docs/research/landscape.md`
