// The 10 validation specifications.
//
// These are the SAME briefs as m0/corpus/SPECS.md, ten of the thirty, re-used
// verbatim. The difference is the author: the M0 corpus was hand-written by the
// repository owner in an AI-typical idiom, and these pages were emitted by a
// coding agent (Claude Opus 5) working from the brief text alone, without
// reading the frozen corpus, in whatever idiom it produces by default.
//
// That is the whole point of the set. m0/NEGATIVE-RESULT-TEMPLATE.md names
// "run the same briefs through a real coding agent and re-measure" as the
// cheapest thing that could overturn the M0 result — the caveat applies to a GO
// exactly as much as to a KILL, because a defect rate measured on pages a
// person wrote while imagining what an agent writes is evidence about that
// person's imagination until it is checked.
//
// Unlike specs.mjs for the M0 corpus there is no `build` function here: nothing
// generated these pages from a component library, so there is nothing to
// regenerate. The HTML in corpus/pages/ IS the artifact. This module records
// which brief each page implements, what it was paired with, and the provenance
// that freeze.mjs stamps into the manifest.
//
// IMPORTANT: written and frozen BEFORE any cross-engine measurement was run on
// them, in their own commit, so the ordering is in `git log` rather than
// asserted. Same discipline as the M0 corpus.

export const CORPUS_VERSION = 'm0-validation-v1';

// prompt strings are copied verbatim from m0/corpus/SPECS.md.
export const SPECS = [
  {
    id: 'v01-landing-saas-hero', kind: 'landing', mode: 'inline',
    font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    pairedWith: 'p01-landing-saas-hero',
    prompt: 'Build a landing page for an observability SaaS called Meridian. Centered hero with a headline and two CTAs, a logo cloud, a six-card feature grid, testimonials, a dark call-to-action band, and a four-column footer. Modern, clean, lots of whitespace.',
  },
  {
    id: 'v02-dash-analytics', kind: 'dashboard', mode: 'inline',
    font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    pairedWith: 'p06-dash-analytics',
    prompt: 'Analytics dashboard. Fixed left sidebar with nav, top bar with search and avatar, then four KPI cards, a big chart, and a recent-activity list in a two-column layout below.',
  },
  {
    id: 'v03-dash-billing', kind: 'dashboard', mode: 'inline',
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    pairedWith: 'p07-dash-billing',
    prompt: 'Billing and usage dashboard inside an app shell. Show current plan card, usage meters with progress bars, an invoice table, and a payment-method section. Sidebar navigation.',
  },
  {
    id: 'v04-form-settings', kind: 'form', mode: 'inline',
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    pairedWith: 'p11-form-settings',
    prompt: 'Account settings page. Left nav for settings sections, main panel with grouped form sections — profile, notifications, security — using real input types. Sticky save bar at the bottom.',
  },
  {
    id: 'v05-form-wizard', kind: 'form', mode: 'inline',
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    pairedWith: 'p13-form-wizard',
    prompt: 'Multi-step onboarding wizard, step 2 of 4. Progress indicator across the top, a centered card with the current step form, back/continue buttons, and a help panel to the side.',
  },
  {
    id: 'v06-pricing-calculator', kind: 'pricing', mode: 'inline',
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    pairedWith: 'p16-pricing-calculator',
    prompt: 'Usage-based pricing page with an interactive-looking calculator: sliders for volume, a live estimate card, and a breakdown table. Four plan cards laid out with flexbox below.',
  },
  {
    id: 'v07-article-docs', kind: 'article', mode: 'inline',
    font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    pairedWith: 'p19-article-docs',
    prompt: 'Documentation page with three columns: left sidebar navigation tree, main content, right-hand sticky table of contents. Include code blocks, callout boxes, a parameters table and prev/next links.',
  },
  {
    id: 'v08-table-users', kind: 'table', mode: 'inline',
    font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    pairedWith: 'p22-table-users',
    prompt: 'User management table. Toolbar with search, filter chips and bulk actions, a table with checkboxes, avatars, role badges and a row menu, then pagination. Everything inside an app shell with a sidebar.',
  },
  {
    id: 'v09-table-wide-scroll', kind: 'table', mode: 'inline',
    font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    pairedWith: 'p23-table-wide-scroll',
    prompt: 'Wide financial data grid with 14 columns that must scroll horizontally, a frozen first column, right-aligned numeric cells in a monospace font, and a totals footer row.',
  },
  {
    id: 'v10-table-catalog', kind: 'table', mode: 'inline',
    font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    pairedWith: 'p25-table-catalog',
    prompt: 'E-commerce product catalog: filter sidebar on the left with checkboxes and a price range, product cards in a responsive grid with badges and star ratings, sort dropdown and result count above.',
  },
];

export const KIND_MIX = SPECS.reduce((a, s) => (a[s.kind] = (a[s.kind] || 0) + 1, a), {});

// The one-per-category subset, fixed here BEFORE the run so it cannot be chosen
// after seeing which pages produced survivors. Six of the ten, one from each
// category present, used to report a rate that is not tilted toward the
// categories where M0 found its defects.
export const UNWEIGHTED_SUBSET = [
  'v01-landing-saas-hero', 'v02-dash-analytics', 'v04-form-settings',
  'v06-pricing-calculator', 'v07-article-docs', 'v08-table-users',
];

export const PROVENANCE = {
  origin: 'model-emitted',
  note: 'Pages were written by a coding agent (Claude Opus 5, running as the Claude Code agent) from the brief text alone. The agent did not read m0/corpus/ while writing and did not attempt to reproduce the frozen pages; the idiom is whatever it produces by default. No hosted model API was called and nothing was paid for — the agent doing the study wrote the corpus as part of its own work, which is exactly the population the study is about. This set exists to test the M0 corpus\'s primary external-validity limitation.',
  generator: 'none — the HTML in corpus/pages/ is the artifact, not a render of a spec',
  deterministic: 'no Math.random, no Date, no timers, no animation, no network, no JavaScript at all',
  authoredBy: 'claude-opus-5 (Claude Code agent)',
  writtenAgainst: 'm0/corpus/SPECS.md brief text only',
};

export const CORPUS_LIMITATIONS = [
  'The corpus is model-emitted, which is the point, but it is ONE model in ONE session. A different model, or the same model on a different day, would produce different markup. This measures whether the M0 result survives contact with real agent output; it does not establish a rate across "AI-generated frontends" in general.',
  'The agent that wrote these pages is also the agent that ran the pipeline and wrote this note. It did not see any per-page result before freezing (the freeze is its own commit, before the first run), but it is not an independent party, and the M0 corpus author is not the labeller of record for this set either.',
  'The ten briefs are a deliberately WEIGHTED subset of the thirty: table 3, dashboard 2, form 2, pricing 1, article 1, landing 1, chosen toward the categories where M0 found defects. A rate over these ten is therefore NOT comparable to M0\'s 53.3% over thirty. Compare against the same ten briefs in the M0 corpus (9 of those 10 pages carried a genuine defect), or against the pre-registered one-per-category subset.',
  'Every page is a self-contained single file with its own <style> block and no shared stylesheet, where the M0 corpus split 17 linked / 13 inlined against one shared utility vocabulary. Two corpora therefore differ in stylesheet delivery as well as in authorship.',
  'No page carries any JavaScript. Interactive-looking controls (sliders, checkboxes, tabs) are rendered in a fixed state, as in the M0 corpus.',
];
