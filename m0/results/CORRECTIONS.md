# Corrections to the M0 write-up

The measurements in `incidence-v0.1.json` stand. What follows are claims made
*about* them that did not survive a second look, recorded here because the
commit messages cannot be edited without rewriting history.

## The engine distribution was computed with a method that does not hold up

The M0 commit (`5957ce3`) and the summary given to the repository owner both say:

> No single engine is the culprit — Firefox is the outlier in 40%, WebKit 35%,
> Chromium 25%.

**Do not cite those numbers.** They came from a throwaway heuristic written in the
moment — an engine was called the outlier when the other two agreed to within 20%
of its deviation — which is not a defined statistic and was never applied to any
other dataset.

Re-measured with the method in `m0/scripts/compare.mjs` (the engine furthest from
both others on the finding's largest-delta property), applied identically to every
corpus:

| | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| genuine defects, 30-page corpus | 42% | 22% | 36% |
| survivors, 30-page corpus | 61% | 16% | 23% |
| survivors, model-emitted validation corpus | 4.7% | 3.8% | **91.5%** |

The original figures could not be reproduced by any metric tried.

**What replaces the claim:** the even split was an artifact. On the corpus a real
coding agent produced, WebKit is the outlier on nine findings in ten, and on the
one-per-category subset Firefox is the outlier on none. That matters more than the
retraction does, because the project's permanent ceiling is that Playwright's
WebKit is not Safari — and the divergence now appears to live almost entirely on
the engine the tool can say the least about.

## What is unaffected

The suppression funnel (1722 → 475), the survivor counts, the per-page defect
labels, the 16-of-30 pages, and the element-family distribution were all computed
by committed scripts and reproduce byte for byte. The GO verdict does not rest on
the engine split.
