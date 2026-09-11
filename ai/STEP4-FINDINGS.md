# Step 4 — what the model actually said

27 findings, pre-registered in `ai/step4-selection.json` before the run.
**28 requests** (1 probe + 27 findings, one turn each), **$0.061851** actual,
against ceilings of 54 requests and $0.15. Neither ceiling was approached.
`gpt-5-mini-2025-08-07`, reasoning effort `low`, `store: false`.

Raw transcripts: `ai/step4-transcripts/`. Structured results: `ai/step4-results.json`.

---

## The headline

**Mechanism: reliable. Verdict: not.**

On all 13 controls the model named the same mechanism as the deterministic rule.
It did not overturn a single correct rule — and on one finding it overturned an
*incorrect* rule, correctly.

But asked whether a mechanism is a *defect*, it contradicts itself on identical
inputs. `p13-form-wizard#9`, `#11` and `#13` are the same `<button>` mechanism on
the same page with the same deltas (`width Δ4, offset-x Δ4, height Δ1`) and the
same computed padding (`6px / 4px / 6px`) — byte-identical in every field that
reaches the model. It answered **expected, defect, expected**.

The same wobble shows up across buckets: `table-column-distribution` is
"expected" on `p06-dash-analytics#1` and "defect" on `v07-article-docs#1`;
`line-height-resolution` is "expected" four times on `v10-table-catalog` and
"defect" on `v07-article-docs#15`.

This vindicates the matcher's abstention policy and extends it: the model should
not be trusted with defect-vs-expected either. It is an explainer, not a judge.

---

## Q1 — Does the tail exist?

**Partly. 4 of 7, and the 3 failures trace to one missing field in the evidence
payload rather than to the model.**

| finding | true cause (read from the corpus CSS) | model | verdict |
|---|---|---|---|
| `v10-table-catalog#1..4` | unitless `line-height` resolving to 22.475 / 22.4667 / 22.475px, accumulating | **correct**, with the arithmetic | ✅ |
| `v01-landing-saas-hero#1` | `.lede { max-width: 58ch; margin: 0 auto }` | `auto-margin-subpixel-rounding` | ❌ |
| `v01-landing-saas-hero#2` | `.cta p { max-width: 46ch }` | `subpixel-line-wrapping-from-parent-width-rounding` | ❌ |
| `v06-pricing-calculator#1` | `.head p { max-width: 56ch }` | `percentage-margin-rounding-difference` | ❌ |

The four it got right are *checkable*: it traced the 4.22px shift to the
`<aside>` ancestor measuring 978.844 vs 983.10px, matched that against the
line-height spread, and noted the sibling symptoms. That is a real explanation,
not fluent text.

The three it got wrong are fluent text. Worse, one is internally inconsistent:
on `v01#2` it blames the parent `<div>` being narrower in Firefox (525.47 vs
527.55/527.39) for the paragraph being narrower — but the narrow paragraph is
**WebKit's**, whose parent is the *wide* one. The reasoning does not survive
being checked against the numbers it cites.

**The cause is an evidence gap, and the model said so itself.** All three flagged
in `unresolved` that they could not see the authored declaration. `maxWidth` is
not in the pipeline's collected computed-style set, so neither the model nor the
matcher can see `58ch` → `691.78px` vs `665.95px`. Adding `maxWidth` to the
`collect` snippet is a core change that would likely let the *deterministic* rule
name this cause outright — which would shrink the tail rather than justify paying
a model for it.

---

## Q2 — Are the rules miscalibrated in a knowable way?

**Yes, and in one case specifically enough to have already fixed it.**

Of the 7 disagreements the model sided with the owner 3 times, with the matcher 3
times, and split once. As a tie-breaker on defect-vs-expected it is worthless —
see the `p13` self-contradiction above, which accounts for all three of the
"sided with the owner" cases.

The one that mattered was not about a verdict. On `p20-article-magazine#1` the
matcher said `text-shrink-to-fit` — "the engines measure this element's text
differently". The model answered:

> The button measures the same width/height in all three engines (chromium
> 102.61×52, firefox 102.57×52, webkit 102.61×52) so the element itself isn't
> being sized differently. The only surviving positional delta is offset-x. The
> nearest ancestor `<form>` has a width that differs by the same amount
> (350.609 / 359.233 / 350.609). … the button moved because its parent's used
> width differs across engines, not because the button's own text or box sizing
> differs.

That is correct and the rule was wrong. `text-shrink-to-fit` accepted a finding
whose only property was `offset-x`, with no width delta at all. **Fixed**: the
rule now requires the element's own width to differ, and these findings fall
through to `propagated-displacement`, which names the culprit. Verdict agreement
with the owner rose from 91.9% to **92.6% (75/81)**, and out-of-sample coverage
is unchanged at 93.4%.

---

## Q3 — Does it contradict rules that are right?

**No. 13 of 13 controls, same mechanism, every time.** This is the question that
decides whether the layer ships, and the answer is that it is safe to ship.

It also added detail the rule did not have. On `p07-dash-billing#42` the rule says
"a descendant carries this delta"; the model named it — `<select> #f-select-1`,
38px in Chromium/Firefox against 23px in WebKit. On `p11-form-settings#6` it read
the three UA checkbox sizes straight out of the evidence: 12 / 13 / 14px.

The verdicts wobbled here too: where both committed, they agreed 3 times out of 8.

---

## Cost, and how good the estimate was

| | estimated | actual |
|---|---:|---:|
| input tokens / request | 2,442 | 2,590 (mean) |
| output tokens / request | 450 assumed | 822 (mean, incl. 280 reasoning) |
| $ / investigation | $0.001511 | **$0.002291** |
| the 27-finding set | $0.042 | **$0.0619** |

**The dry run under-estimated by 52%.** Input was close (+6%, the residue being
per-message framing the published format does not document). Output was the
miss: the estimate assumed 450 output tokens and the actual mean was 822, because
`gpt-5-mini` is a reasoning model and reasoning tokens are billed as output at 8×
the input rate. At `low` effort they averaged 280 tokens per response, a third of
the output bill.

`ASSUMED_OUTPUT_TOKENS` in `ai/openai.ts` has been raised from 450 to 850 and the
dry run now prints the reasoning-token assumption explicitly. Anyone reading the
dry run should treat the output half as the soft number and the input half as
firm.

---

## What this means for the layer

1. **Ship it, off by default.** It does not damage correct output, and it adds
   named culprits. 13/13 is as clean as that test can come back.
2. **Drop `verdict` from the model's job**, or never surface it without the word
   "suggested". It is not self-consistent on identical inputs, and M0's rule that
   verdicts are never auto-approved should apply to the model at least as
   strictly as it applies to the matcher.
3. **Spend the next effort on the evidence payload, not the model.** Three of the
   seven tail findings failed for want of one computed property. Widening
   `collect`'s property set is cheaper than inference and helps the deterministic
   path too.
4. **The tail is thin and getting thinner.** Of 7 out-of-sample residual findings,
   4 were already correctly handled by an in-sample rule and 3 need a field the
   pipeline does not collect. There is no evidence here of a class of divergence
   that is inherently probabilistic.
