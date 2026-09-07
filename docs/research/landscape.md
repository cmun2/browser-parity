# Competitive landscape

Surveyed 2026-09-07. Sources: primary vendor docs, the npm registry + downloads API, and the GitHub REST API. Download figures are the week of 2026-08-31 → 2026-09-06.

**Headline:** no tool — open source, commercial, or academic — runs Chromium, Firefox and WebKit at a *single commit* and diffs element **geometry** or **computed styles** *between the engines*. The entire market compares one browser against **its own past self**.

---

## Existing — does what BrowserParity proposes

**Nothing.** The two candidates that look like it on the surface both fail on inspection:

- **Applitools Ultrafast Grid** markets exactly this ("Visual AI compares what actually renders in each browser… Font rendering, flexbox quirks, and CSS support gaps between Chromium, WebKit, and Gecko show up as real, visible diffs"). Its own baseline documentation contradicts the marketing: a baseline is keyed by `appName` + `testName` + viewport + **HostOS** + **HostApp (the browser)** + version, and Eyes matches baselines with *"identical HostOS and HostApp names and Viewport sizes."* Chrome-vs-Firefox comparison is **structurally impossible** in that data model. It is N parallel same-browser-over-time comparisons. Additionally its engines are **emulated**: rendering runs "from a DOM snapshot instead of an open connection to a remote browser… without spinning up a real one for every test." Applitools' "WebKit" is Applitools' reproduction of WebKit.
- **`github.com/SemperSupra/BrowserParity`** (0★) is a name collision — a bookmark/settings sync toolkit. **npm `browser-parity` and `browserparity` are both unregistered.**

Three of the most-used tools in the space run all three engines and then *explicitly decline* to compare them:

| tool | verbatim |
|---|---|
| Chromatic | *"Chromatic does not programmatically compare snapshots from different browsers against each other. Instead, we compare the snapshots for each browser against the baseline for that browser."* |
| Playwright | *"Screenshots differ between browsers and platforms due to different rendering, fonts and more, so you will need different snapshots for them."* |
| Storybook test-runner | *"does not compare results across browsers automatically — you'd need to run separate test sessions per browser and implement your own comparison logic."* |

---

## Partially overlapping

Ranked by how much they should worry us.

1. **`styleproof`** — MIT, v6.3.0, **756 dl/wk**, Playwright-based. *"Catch every CSS change before it ships — review PRs and certify refactors by the browser's computed styles, not pixels."* Captures resolved longhands, pseudo-elements, **layout boxes**, forced `:hover`/`:focus`/`:active`, and CSS Typed OM values (to tell `auto` from a real change). **This is our extraction layer and our thesis, already published.** It differs on one axis: its baseline is `base commit → head commit`, and forced states are *"Chromium-only."* Read this repo before writing code; adding an engine axis to it may be a PR rather than a new project.
2. **`acoyfellow/visual-diff`** (20★, created 2026-07-03, abandoned 2026-07-05) — *"3-tier visual-diff cascade: DOM structure + computed style + pixel comparison."* Architecturally the right cascade, but drives a *"pinned Playwright Chromium over raw CDP"* — single engine. Cross-*implementation* (React vs Svelte), not cross-*engine*.
3. **Playwright ARIA snapshots** (`toMatchAriaSnapshot`) — the important precedent. *"As snapshots should be the same across browsers, only one snapshot is saved even if testing with multiple browsers."* Playwright already accepts that a **browser-independent, non-pixel baseline** is legitimate. It just carries roles/names/states — zero geometry, zero computed styles. Also: omitting `{projectName}` from `snapshotPathTemplate` already forces one shared *pixel* baseline across engines. Cross-engine pixel diffing is a config one-liner today; it is useless because font hinting and antialiasing swamp it. That is the strongest argument that the *primitive*, not the plumbing, is what's wrong.
4. **Sauce Labs Visual** — the only vendor holding DOM data at diff time ("DOM diffs inspection"), but as diagnostic garnish on per-browser-over-time pixel comparison. Baselines keyed by *"browser, operating system, and device."* Paid.
5. **`creevey`** (433★, 908 dl/wk) — "cross-browser screenshot testing for Storybook" via Selenium Grid. "Cross-browser" = *executes on* many browsers. Same category error as Applitools.
6. **`Layout-Oracle`** (0★, 2026-04) — *"Cross-browser text wrapping diffs, without launching browsers"*; simulates line-breaking from a vendored font-metrics profile. Right problem, much weaker method, no traction. Weak evidence someone else felt the pain.
7. **`@decocms/parity`** — A-vs-B parity, but the axis is environment (prod vs candidate), not engine.

### The rest of the market: pixel diffing, over time, single engine

| tool | status | dl/wk | notes |
|---|---|---|---|
| `pixelmatch` | active | **6,799,380** | the primitive everything is built on |
| `jest-image-snapshot` | active | 611,462 | pixel baseline matcher |
| `@argos-ci/playwright` | active | 185,481 | Argos (620★, MIT, but self-hosting *"not officially supported"* — SaaS with public source) |
| `odiff-bin` | active | 164,269 | SIMD pixel diff, 3,184★ |
| `reg-suit` | active | 114,320 | 1,291★; never launches a browser at all |
| `backstopjs` | **unmaintained** (last push 2024-09) | 74,580 | 7,176★, 578 open issues; Chrome-only |
| `cypress-image-snapshot` | active | 67,980 | Cypress has no real WebKit — cross-engine impossible in principle |
| `lost-pixel` | **ARCHIVED 2026-04** | 29,949 | 1,684★; *"Open source alternative to Percy, Chromatic, Applitools"* |
| Wraith (BBC) | **ARCHIVED** | — | 4,819★ |
| Percy (BrowserStack) | active, paid | — | DOM snapshot is transport; comparison is pixels vs *"baseline screenshots from a previous build"* |

### Academic XBI tooling: all dead

**XFix** (*"Automated Repair of Layout Cross Browser Issues"*) — 6★, Java, last push **2018**. **Fighting Layout Bugs** — Google Code exports, dead ~2015. **Browserbite / WebSee / X-PERT / crossT** — papers, no maintained code. **Mozilla webcompat** is human bug reporting plus shipped UA/CSS interventions — zero automated geometry diffing. Mozilla, who co-authored XBIDetective, does not have this tool.

---

## Missing

Nobody ships, at any price:

1. Same-commit, **real-engine** (not emulated) Chromium ↔ Firefox ↔ WebKit comparison.
2. Element **geometry** (`getBoundingClientRect` per node) as a first-class cross-engine signal.
3. Cross-engine **computed-style** diffing (styleproof has the extractor — Chromium-only, temporal baseline).
4. A **deterministic, non-ML verdict.** The whole paid market moved the opposite way (Applitools Visual AI, Percy "Visual Review Agent") precisely because pixel noise forces fuzzy matching. Skipping pixels sidesteps the problem incumbents threw a decade of ML at.
5. **A stable DOM-node identity scheme across engines** — keying node N in Gecko's tree to node N in WebKit's. This is the actual unclaimed hard problem.

---

## Our differentiation

1. **Real engines, not reproductions.** A Playwright-driven tool is *more truthful than the $667/mo incumbent on the incumbent's own headline claim.* That is a defensible, checkable statement.
2. **Different comparison axis.** Everyone compares `t0 → t1` in one engine. We compare `engine_a ↔ engine_b ↔ engine_c` at one commit. This needs **no baseline, no stored golden images, no cloud account, no history** — the three engines are each other's oracle. That removes the entire storage/SaaS layer that Percy, Chromatic, Argos and Lost Pixel exist to sell, which is also why none of them would build it.
3. **Geometry as the primitive, not pixels.** Validated in Experiment 02: deterministic rules take a real page from 638 findings to 19 with zero AI calls. Nobody has published this tolerance model.

---

## The case against building it — recorded honestly

The gap being empty is not the same as it being worth filling.

- **The closest neighbour has 756 downloads/week.** `styleproof` built the extraction layer and the "computed styles, not pixels" thesis, shipped to v6, got near-zero adoption. **Lost Pixel — the flagship OSS alternative, 1,684★ — archived within the last five months.** `acoyfellow/visual-diff` shipped a DOM + computed-style + pixel cascade and was abandoned after two days. Meanwhile `pixelmatch` does 6.8M/week. **The market has repeatedly voted for dumb pixels over smart structural comparison.**
- **The moat is thin.** `page.$$eval` → `getBoundingClientRect` + `getComputedStyle` across three engines is trivial. The value is entirely in tolerance modelling and node identity.
- **Demand signal is weak and stale.** Playwright issue #7247 ("One snapshot for all browsers") — one request from 2021, 11 comments, closed in four days by pointing at a config workaround. No active thread anywhere demands cross-engine layout diffing.

**Counterweight (why now):** Playwright now bundles all three real engines behind one `npx playwright install` — untrue when XFix/Browserbite/WebSee/X-PERT were built on Selenium and all died by ~2018. And Playwright's own ARIA snapshots establish the precedent for a browser-independent non-pixel baseline. The pieces exist now that didn't then.
