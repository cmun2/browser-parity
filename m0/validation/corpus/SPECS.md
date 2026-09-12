# M0 validation corpus — the same briefs, emitted by a model

10 pages. Written and frozen **before** any cross-engine measurement was run on
them, in their own commit.

**These pages are model-emitted, not hand-authored.** The M0 corpus states its
own primary limitation plainly: its 30 pages were *hand-written in an
AI-typical idiom*, and `m0/NEGATIVE-RESULT-TEMPLATE.md` names re-running the
briefs through a real coding agent as the single cheapest thing that could
overturn the result. That caveat applies to the GO exactly as much as it would
have applied to a KILL — a defect rate measured on pages a person wrote while
imagining what an agent writes is evidence about that person's imagination
until it is checked.

This set checks it. Ten of the thirty briefs were handed, as text, to the
coding agent working on this repository (Claude Opus 5). It wrote each page the
way it would if asked to build it: single self-contained HTML file, its own
`<style>` block, CSS custom properties, semantic class names, inline stroke
SVG icons, native form controls, no build step, no JavaScript. It did **not**
read `m0/corpus/pages/` while writing and made no attempt to reproduce the
frozen pages.

No hosted model API was called and nothing was paid for.

## Mix, and why it is weighted

- **landing** — 1 page
- **dashboard** — 2 pages
- **form** — 2 pages
- **pricing** — 1 page
- **article** — 1 page
- **table** — 3 pages

The ten are drawn from the same spread as the original, **weighted toward the
categories where M0 actually found defects** (of M0's 180 genuine defects:
table 87, dashboard 51, form 19, pricing 12, nav 5, modal 4, article 2,
landing 0). One landing page is included deliberately as a negative control,
since landing pages produced zero defects across five pages in M0. `modal` and
`nav` are not represented; between them they held 9 of the 180.

**A defect or survivor rate over these ten is therefore not directly comparable
to M0's 53.3% over thirty.** Two comparisons that *are* fair, both fixed in
advance:

1. **Paired** — each of the ten implements a brief that also exists in the M0
   corpus, named in `pairedWith` below. Compare page against page.
2. **One-per-category subset (n=6)**, fixed in `specs.mjs` as
   `UNWEIGHTED_SUBSET` before the run: `v01-landing-saas-hero`, `v02-dash-analytics`, `v04-form-settings`, `v06-pricing-calculator`, `v07-article-docs`, `v08-table-users`.

## Determinism

No `Math.random`, no `Date`, no timers, no animation, no network requests, and
no JavaScript at all. The runner re-collects one engine twice per page and
flags any page that disagrees with itself.

## What is different from the M0 corpus, other than the author

Every page here is a self-contained single file with its own `<style>` block.
The M0 corpus split 17 linked / 13 inlined against one shared
`assets/util.css` vocabulary; this set has no shared asset, because building
one would have meant reading the frozen corpus. So the two corpora differ in
stylesheet delivery as well as in authorship, and that is a confound worth
naming.

## The 10 briefs

### 1. `v01-landing-saas-hero`

- **kind:** landing
- **font stack:** `ui-sans-serif…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p01-landing-saas-hero` in the M0 corpus
- **in the unweighted subset:** yes

> Build a landing page for an observability SaaS called Meridian. Centered hero with a headline and two CTAs, a logo cloud, a six-card feature grid, testimonials, a dark call-to-action band, and a four-column footer. Modern, clean, lots of whitespace.

### 2. `v02-dash-analytics`

- **kind:** dashboard
- **font stack:** `ui-sans-serif…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p06-dash-analytics` in the M0 corpus
- **in the unweighted subset:** yes

> Analytics dashboard. Fixed left sidebar with nav, top bar with search and avatar, then four KPI cards, a big chart, and a recent-activity list in a two-column layout below.

### 3. `v03-dash-billing`

- **kind:** dashboard
- **font stack:** `-apple-system…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p07-dash-billing` in the M0 corpus
- **in the unweighted subset:** no

> Billing and usage dashboard inside an app shell. Show current plan card, usage meters with progress bars, an invoice table, and a payment-method section. Sidebar navigation.

### 4. `v04-form-settings`

- **kind:** form
- **font stack:** `system-ui…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p11-form-settings` in the M0 corpus
- **in the unweighted subset:** yes

> Account settings page. Left nav for settings sections, main panel with grouped form sections — profile, notifications, security — using real input types. Sticky save bar at the bottom.

### 5. `v05-form-wizard`

- **kind:** form
- **font stack:** `system-ui…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p13-form-wizard` in the M0 corpus
- **in the unweighted subset:** no

> Multi-step onboarding wizard, step 2 of 4. Progress indicator across the top, a centered card with the current step form, back/continue buttons, and a help panel to the side.

### 6. `v06-pricing-calculator`

- **kind:** pricing
- **font stack:** `-apple-system…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p16-pricing-calculator` in the M0 corpus
- **in the unweighted subset:** yes

> Usage-based pricing page with an interactive-looking calculator: sliders for volume, a live estimate card, and a breakdown table. Four plan cards laid out with flexbox below.

### 7. `v07-article-docs`

- **kind:** article
- **font stack:** `ui-sans-serif…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p19-article-docs` in the M0 corpus
- **in the unweighted subset:** yes

> Documentation page with three columns: left sidebar navigation tree, main content, right-hand sticky table of contents. Include code blocks, callout boxes, a parameters table and prev/next links.

### 8. `v08-table-users`

- **kind:** table
- **font stack:** `ui-sans-serif…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p22-table-users` in the M0 corpus
- **in the unweighted subset:** yes

> User management table. Toolbar with search, filter chips and bulk actions, a table with checkboxes, avatars, role badges and a row menu, then pagination. Everything inside an app shell with a sidebar.

### 9. `v09-table-wide-scroll`

- **kind:** table
- **font stack:** `ui-sans-serif…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p23-table-wide-scroll` in the M0 corpus
- **in the unweighted subset:** no

> Wide financial data grid with 14 columns that must scroll horizontally, a frozen first column, right-aligned numeric cells in a monospace font, and a totals footer row.

### 10. `v10-table-catalog`

- **kind:** table
- **font stack:** `ui-sans-serif…`
- **stylesheet:** inlined (single self-contained file)
- **paired with:** `p25-table-catalog` in the M0 corpus
- **in the unweighted subset:** no

> E-commerce product catalog: filter sidebar on the left with checkboxes and a price range, product cards in a responsive grid with badges and star ratings, sort dropdown and result count above.

