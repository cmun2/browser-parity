# M0 corpus specifications

30 pages. Written and frozen **before** any cross-engine measurement was run.

**These pages are hand-authored in an AI-typical idiom, not emitted by a model.**
No hosted model was called (the study runs under a no-paid-API constraint), so
every page here was written by hand to look like what a coding agent produces:
utility classes or a single embedded stylesheet, inline stroke icons, system
font stacks, flex/grid scaffolding, native form controls, no build step. Each
page's `prompt` below is the brief it implements, so the identical study can be
re-run later against a real model's output using the same 30 briefs. Treat this
as the study's main external-validity limitation — see `m0/README.md`.

## Mix

- **landing** — 5 pages
- **dashboard** — 5 pages
- **form** — 4 pages
- **pricing** — 3 pages
- **article** — 4 pages
- **table** — 4 pages
- **modal** — 3 pages
- **nav** — 2 pages

Stylesheet delivery: 17 pages link a shared
`assets/util.css`, 13 inline the same
vocabulary in a `<style>` block (single-file output, as agents commonly emit).
Every page additionally carries its own page-specific CSS block, which is where
the layout variety lives.

## Determinism

No `Math.random`, no `Date`, no timers, no animation, no network requests. A page
that renders differently on two loads is indistinguishable from a page where the
engines disagree — the research fixtures demonstrate this directly, where a live
clock in `fixtures/cases.html` makes the funnel report 17 or 18 findings at
random. The runner re-collects one engine twice per page and flags any page that
disagrees with itself.

## The 30 briefs

### 1. `p01-landing-saas-hero`

- **kind:** landing
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> Build a landing page for an observability SaaS called Meridian. Centered hero with a headline and two CTAs, a logo cloud, a six-card feature grid, testimonials, a dark call-to-action band, and a four-column footer. Modern, clean, lots of whitespace.

### 2. `p02-landing-split-hero`

- **kind:** landing
- **font stack:** `"Inter"…`
- **stylesheet:** inlined (single file)

> Landing page for a developer tool called Kestrel. Split hero — copy on the left, product screenshot on the right. Then a three-up feature section, a stats strip, a testimonial, and a footer. Use Inter.

### 3. `p03-landing-feature-tour`

- **kind:** landing
- **font stack:** `-apple-system…`
- **stylesheet:** linked util.css

> Marketing page with alternating feature rows — image on one side, text on the other, flipping each row. Sticky nav at the top. Four rows, then an FAQ and a footer.

### 4. `p04-landing-changelog`

- **kind:** landing
- **font stack:** `system-ui…`
- **stylesheet:** inlined (single file)

> Public changelog page. Left rail with a sticky version index, right column with dated release entries containing headings, prose, bullet lists and badges. Nav on top, minimal footer.

### 5. `p05-landing-waitlist`

- **kind:** landing
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> Single-screen waitlist page for a product called Lumen. Full-height centered layout, big headline, email capture form, three small value props underneath, social proof avatars. Should fill the viewport.

### 6. `p06-dash-analytics`

- **kind:** dashboard
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> Analytics dashboard. Fixed left sidebar with nav, top bar with search and avatar, then four KPI cards, a big chart, and a recent-activity list in a two-column layout below.

### 7. `p07-dash-billing`

- **kind:** dashboard
- **font stack:** `-apple-system…`
- **stylesheet:** inlined (single file)

> Billing and usage dashboard inside an app shell. Show current plan card, usage meters with progress bars, an invoice table, and a payment-method section. Sidebar navigation.

### 8. `p08-dash-kanban`

- **kind:** dashboard
- **font stack:** `"Inter"…`
- **stylesheet:** linked util.css

> Project board with horizontally scrolling kanban columns. Four columns with draggable-looking cards containing avatars, labels and due dates. Toolbar above with filters and a view switcher.

### 9. `p09-dash-infra-status`

- **kind:** dashboard
- **font stack:** `ui-monospace…`
- **stylesheet:** inlined (single file)

> Infrastructure status console with a monospace, dense feel. Region grid, service health matrix, an incident timeline, and a log tail panel with its own scrollbar. Dark header.

### 10. `p10-dash-crm-detail`

- **kind:** dashboard
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> CRM record detail page. Left column with the account profile and key fields, main column with tabs (activity, notes, files), right rail with related records. Sticky page header with actions.

### 11. `p11-form-settings`

- **kind:** form
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> Account settings page. Left nav for settings sections, main panel with grouped form sections — profile, notifications, security — using real input types. Sticky save bar at the bottom.

### 12. `p12-form-checkout`

- **kind:** form
- **font stack:** `-apple-system…`
- **stylesheet:** inlined (single file)

> Two-column checkout. Left side has contact, shipping and payment fieldsets; right side is a sticky order summary with line items, discount code input and totals. Trust badges at the bottom.

### 13. `p13-form-wizard`

- **kind:** form
- **font stack:** `system-ui…`
- **stylesheet:** linked util.css

> Multi-step onboarding wizard, step 2 of 4. Progress indicator across the top, a centered card with the current step form, back/continue buttons, and a help panel to the side.

### 14. `p14-form-auth`

- **kind:** form
- **font stack:** `"Inter"…`
- **stylesheet:** inlined (single file)

> Sign-up page with a split layout: form on the left half, a testimonial and gradient panel on the right half filling the viewport height. OAuth buttons above a divider, then email and password fields.

### 15. `p15-pricing-tiers`

- **kind:** pricing
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> Pricing page with three tiers, the middle one highlighted with a "most popular" badge, a monthly/annual toggle, a full feature comparison table below, and an FAQ.

### 16. `p16-pricing-calculator`

- **kind:** pricing
- **font stack:** `-apple-system…`
- **stylesheet:** inlined (single file)

> Usage-based pricing page with an interactive-looking calculator: sliders for volume, a live estimate card, and a breakdown table. Four plan cards laid out with flexbox below.

### 17. `p17-pricing-compare-dense`

- **kind:** pricing
- **font stack:** `system-ui…`
- **stylesheet:** linked util.css

> Enterprise pricing page that leads with a dense feature comparison matrix (many rows, sticky header row) and puts the plan cards below it. Include a contact-sales band.

### 18. `p18-article-blogpost`

- **kind:** article
- **font stack:** `Georgia…`
- **stylesheet:** inlined (single file)

> Long-form blog post in a serif typeface. Centered measure of about 68 characters, author byline with avatar and date, drop-cap first paragraph, pull quote, code block, figure with caption, and related-posts cards at the end.

### 19. `p19-article-docs`

- **kind:** article
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> Documentation page with three columns: left sidebar navigation tree, main content, right-hand sticky table of contents. Include code blocks, callout boxes, a parameters table and prev/next links.

### 20. `p20-article-magazine`

- **kind:** article
- **font stack:** `Georgia…`
- **stylesheet:** inlined (single file)

> Editorial magazine-style index page. A large lead story with an overlaid headline on the image, then a masonry-ish grid of secondary stories in mixed sizes, and a newsletter signup band.

### 21. `p21-article-help-center`

- **kind:** article
- **font stack:** `system-ui…`
- **stylesheet:** linked util.css

> Help center landing. Big search bar in a hero, a grid of category cards with icons and article counts, a popular-articles list, and a contact-support band at the bottom.

### 22. `p22-table-users`

- **kind:** table
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> User management table. Toolbar with search, filter chips and bulk actions, a table with checkboxes, avatars, role badges and a row menu, then pagination. Everything inside an app shell with a sidebar.

### 23. `p23-table-wide-scroll`

- **kind:** table
- **font stack:** `ui-monospace…`
- **stylesheet:** inlined (single file)

> Wide financial data grid with 14 columns that must scroll horizontally, a frozen first column, right-aligned numeric cells in a monospace font, and a totals footer row.

### 24. `p24-table-inbox`

- **kind:** table
- **font stack:** `-apple-system…`
- **stylesheet:** linked util.css

> Three-pane inbox layout: folder list, message list in the middle with unread indicators and truncated previews, and a reading pane on the right. Each pane scrolls independently and the whole thing fills the viewport.

### 25. `p25-table-catalog`

- **kind:** table
- **font stack:** `ui-sans-serif…`
- **stylesheet:** inlined (single file)

> E-commerce product catalog: filter sidebar on the left with checkboxes and a price range, product cards in a responsive grid with badges and star ratings, sort dropdown and result count above.

### 26. `p26-modal-invite`

- **kind:** modal
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> Dashboard page with a modal dialog open on top of it. Dimmed backdrop, centered dialog with a header, scrollable body containing a form, and a footer with cancel/confirm. Toast notifications stacked in the bottom-right corner.

### 27. `p27-modal-drawer`

- **kind:** modal
- **font stack:** `-apple-system…`
- **stylesheet:** inlined (single file)

> Right-hand slide-over drawer open over a data table. The drawer is full height, has a header with a close button, a scrollable detail body with a definition list and an activity timeline, and a sticky action footer. Also show an open dropdown menu in the page behind it.

### 28. `p28-modal-command-palette`

- **kind:** modal
- **font stack:** `"Inter"…`
- **stylesheet:** linked util.css

> Command palette open over a docs page. Blurred backdrop, a centered search box near the top with grouped results, keyboard-shortcut hints on the right of each row, and a footer strip with navigation hints. Also include a tooltip and a cookie banner.

### 29. `p29-nav-megamenu`

- **kind:** nav
- **font stack:** `ui-sans-serif…`
- **stylesheet:** linked util.css

> Marketing site header with an open mega menu: four columns of links with icons and descriptions, a featured card on the right, and a promo strip along the bottom of the panel. Page content behind is a simple hero.

### 30. `p30-nav-app-shell`

- **kind:** nav
- **font stack:** `system-ui…`
- **stylesheet:** inlined (single file)

> Application shell with a collapsed icon-only rail on the far left, a secondary nav column next to it, a top bar with breadcrumbs and a workspace switcher, tabs under the top bar, and a placeholder content area. A mobile drawer overlay is also visible.

