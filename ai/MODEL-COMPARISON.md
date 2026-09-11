# Three models, one evidence set

27 pre-registered findings (`ai/step4-selection.json`), three models, **97 requests,
$0.340439** against ceilings of 120 requests and $0.80. Neither ceiling was raised.

![comparison](model-comparison.png)

Raw: `model-comparison.json` · scored: `model-comparison-scored.json` ·
transcripts: `model-comparison/exchanges.json` · artifact source: `model-comparison.html`

---

## How the comparison was made fair

`maxWidth` was added to the pipeline between step 4 and this run, so the evidence
gpt-5-mini saw in step 4 no longer exists. A table mixing the two would compare
models across different inputs.

**gpt-5-mini was re-run on the new evidence.** All three columns are byte-identical
inputs. The step-4 gpt-5-mini answers are kept as a separate before/after on the
evidence change (below) and are never mixed into the table.

---

## Q1 — Does the tail survive better evidence?

**It shrinks. The rule closed the gap; the models did not.**

The three `ch`-cap findings now carry the resolved cap in the evidence:

```
computed max-width   chromium 691.784px   firefox 692.133px   webkit 665.955444px
```

| | names the mechanism | cites `maxWidth` |
|---|---|---|
| **deterministic rule** | **3 / 3**, high confidence | 3 / 3 |
| gpt-5.6-terra | 1 / 3 explicitly font-relative | 3 / 3 |
| gpt-5.6-luna | 1 / 3 | 1 / 3 |
| gpt-5-mini | 0 / 3 | 1 / 3 |

gpt-5-mini still blames "auto-margin subpixel rounding" and "engine line-breaking
metrics" — the same wrong answers as step 4, with the answer now sitting in the
payload. terra got closest, on `v01-landing-saas-hero#2`:

> The paragraph is directly width-clamped by its resolved `max-width`; WebKit
> resolves that cap to 461.03px while Chromium and Firefox resolve it to about
> 478px.

The other four residual findings (`v10-table-catalog#1–4`) turned out not to be a
tail at all — see Q3. Out-of-sample coverage is now **97.2%** (103/106), up from
93.4%, and the three remaining unexplained findings are exactly the `ch` caps,
which only the B-derived rule explains.

---

## Q2 — Do the models agree with each other and with the matcher?

**On mechanism, yes. On verdict, they contradict each other flatly.**

The wobble test. `p13-form-wizard#9`, `#11` and `#13` are byte-identical in every
field that reaches a model:

| model | #9 | #11 | #13 | |
|---|---|---|---|---|
| gpt-5-mini | expected | expected | **defect** | wobbles |
| gpt-5.6-luna | defect | defect | defect | stable |
| gpt-5.6-terra | expected | expected | expected | stable |

**Both gpt-5.6 models are perfectly self-consistent, and gpt-5-mini is not.** That
is the single most useful thing this run measured, and it is worth more than any
quality ranking — an investigator that answers differently on identical input
cannot be audited.

But luna and terra are stable at *opposite* answers. Across all 7 disagreements the
models split 3 / 3 / 1 with no pattern. Defect-vs-expected is not decidable from
this evidence by anybody, which is why the matcher abstains on 83% of labelled
findings and why the model's `verdict` field should be treated as advisory at most.

---

## Q3 — Does any of them contradict a control?

**No. Zero, for all three.** That was the ship gate and it passes.

| | confirmed | refined | overturned a rule, correctly | agreed with a rule that was wrong | **contradicted a rule that was right** |
|---|---:|---:|---:|---:|---:|
| gpt-5.6-luna | 11 | 1 | 1 | 0 | **0** |
| gpt-5.6-terra | 10 | 1 | 2 | 0 | **0** |
| gpt-5-mini | 11 | 1 | 0 | 1 | **0** |

Scoring is by mechanism, not by slug, and every non-trivial cell is classified by
hand with its reason in `model-comparison-scored.json`. A model that named the same
cause one level deeper — all three identified the `<select>` behind
`symptom-absorbed-size` — counts as agreeing.

### What the models were actually worth: they broke two of my rules

**`text-shrink-to-fit` was over-claiming.** gpt-5.6-terra, on `p09-dash-infra-status#2`:

> A[4] is a flex item whose own content-sized width differs by 1.67px. Its 5.01px
> relative-x difference is instead explained by the preceding items: WebKit exceeds
> Chromium by 1.47px for A[1], 1.67px for A[2], and 1.88px for A[3], totaling 5.02px.

Verified exactly against the evidence dump. The rule now explains only the width
delta and says when the offset is carried from earlier siblings.

**`line-height-resolution` was simply wrong, and is deleted.** gpt-5.6-luna and
gpt-5.6-terra independently overturned it on `v07-article-docs#15`:

> The tiny line-height serialization difference (37.4px versus 37.400002px) cannot
> explain a 7.5px displacement in this single 46.4px h2, and the h2's measured
> height is effectively identical.

Verified: that H2 is 46.390 / 46.400 / 46.390px and 668px wide in all three, while
its `<article>` ancestor is 7.50px shorter in WebKit. Following the thread killed
the rule on the other corpus too — on `v10-table-catalog` the per-line error is
0.0083px (≈500 line boxes would be needed for the observed 4.26px) **and the sign
is backwards**: Firefox's lines are shorter yet Firefox's `<aside>` is taller. The
real cause is four levels down — a range `<input>` that is 20px tall in Firefox and
16px in Chromium and WebKit. A UA control metric, not a text metric.

That rule fired 14 times at "high" confidence. **Deleting it raised out-of-sample
coverage from 93.4% to 97.2%**, because the correct A-derived rules took those
findings and named the `<input>`.

---

## Cost, measured

| model | $/investigation | mean in / out tokens | 27 findings |
|---|---:|---|---:|
| gpt-5.6-luna | **$0.001009** | 3,393 / 443 (69 reasoning) | $0.0272 |
| gpt-5-mini | $0.002032 | 2,663 / 793 (287 reasoning) | $0.0467 |
| gpt-5.6-terra | $0.011120 | 3,622 / 531 (59 reasoning) | $0.2558 |

luna is **half the price of gpt-5-mini** and terra is **11× luna**. The gpt-5.6
models spend far fewer reasoning tokens at effort `low`, which is most of why luna
undercuts mini despite a similar headline rate. Their higher input counts are tool
round-trips: luna used 33 requests for 27 findings and terra 35, against mini's 27.

The re-calibrated dry-run estimate ($0.002314 for gpt-5-mini) against the measured
$0.002032 is **+14%** — the estimate now runs slightly high rather than 52% low.

---

## Gaps and limits

- **8 of 81 cells are missing**, all in the residual bucket on `v10-table-catalog#1–4`,
  from Tier-1 **daily request limits** (HTTP 429) on gpt-5-mini and gpt-5.6-terra —
  not from budget. The work was ordered controls → disagreements → residual
  precisely so a limit would cost the least, and it did: **controls and
  disagreements are complete for all three models**. Those four findings are near
  duplicates of each other and luna answered all four. Not retried: a
  requests-per-day limit does not clear within the session, and the coordinator's
  ceiling counts retries.
- Two gpt-5.6-terra cells ended in `max-turns` — it asked for tools twice and never
  concluded within the 2-request bound.
- The hand classification of control outcomes is a judgement. It is recorded
  per cell so it can be disagreed with.
- One run, one temperature setting, one effort level. Self-consistency was measured
  on three identical inputs, not by repeating one input three times.

## Recommendation

Unchanged from step 4, now with a default: **ship it off by default, and when it is
switched on, default to `gpt-5.6-luna`.** It is the cheapest, the only model that
answered everything, self-consistent, and it caught a rule bug. Nothing in this run
argues for the expensive model: terra's 11× premium bought one additional caught bug
out of 13 controls.

And the picture the table actually paints is the top row. The deterministic matcher
explains 97.2% of a corpus it never saw, for nothing.
