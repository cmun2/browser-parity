// The 30 corpus specifications.
//
// `prompt` is the natural-language brief each page implements — the thing you
// would paste into a coding agent. It is recorded so the corpus is reviewable
// (you can judge whether these are representative asks) and so the study can be
// repeated later against a real model's output using the same 30 briefs.
//
// IMPORTANT: these were written, and the pages generated and frozen, before any
// cross-engine measurement was run. See m0/README.md ("Why you can trust the
// number").
import * as C from './components.mjs';

const FONTS = {
  systemUi: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  apple: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  inter: '"Inter", "Inter var", system-ui, sans-serif',
  plain: 'system-ui, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

export const SPECS = [
  // ============================================================ LANDING (5)
  {
    id: 'p01-landing-saas-hero', kind: 'landing', font: FONTS.systemUi, mode: 'linked',
    prompt: 'Build a landing page for an observability SaaS called Meridian. Centered hero with a headline and two CTAs, a logo cloud, a six-card feature grid, testimonials, a dark call-to-action band, and a four-column footer. Modern, clean, lots of whitespace.',
    css: `.hero-glow{background:radial-gradient(60% 60% at 50% 0%,#eef2ff 0%,#fff 70%)}`,
    build: (r) => [
      C.navbar(r, { product: 'Meridian', links: ['Product', 'Solutions', 'Pricing', 'Docs'] }),
      `<div class="hero-glow">${C.hero(r, { product: 'Meridian', layout: 'center', headline: 'Ship faster without flying blind', sub: C.sentence(r, 16, 24) })}</div>`,
      C.logoCloud(r),
      C.featureGrid(r, { n: 6, cols: 'auto-fit-280' }),
      C.testimonial(r, { n: 3 }),
      C.ctaBand(r, { product: 'Meridian', dark: true }),
      C.footer(r, { product: 'Meridian', cols: 4 }),
    ].join('\n'),
  },
  {
    id: 'p02-landing-split-hero', kind: 'landing', font: FONTS.inter, mode: 'inline',
    prompt: 'Landing page for a developer tool called Kestrel. Split hero — copy on the left, product screenshot on the right. Then a three-up feature section, a stats strip, a testimonial, and a footer. Use Inter.',
    css: `.stats-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e2e8f0;border-block:1px solid #e2e8f0}
.stats-strip>div{background:#fff;padding:2.5rem 1.5rem;text-align:center}
.stats-strip dt{font-size:clamp(1.75rem,3vw,2.5rem);font-weight:800;letter-spacing:-.02em}
.stats-strip dd{margin:.5rem 0 0;font-size:.875rem;color:#64748b}`,
    build: (r) => [
      C.navbar(r, { product: 'Kestrel', links: ['Features', 'Changelog', 'Customers', 'Blog'], sticky: false }),
      C.hero(r, { product: 'Kestrel', layout: 'split', headline: 'The build system your CI has been waiting for', sub: C.sentence(r, 14, 22) }),
      `<dl class="stats-strip">${[['4.2×', 'faster cold builds'], ['99.98%', 'cache hit rate'], ['180+', 'supported toolchains'], ['12k', 'teams onboarded']].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`,
      C.featureGrid(r, { n: 3, cols: 'grid-cols-3', title: 'Built for monorepos' }),
      C.testimonial(r, { n: 2 }),
      C.footer(r, { product: 'Kestrel', cols: 3 }),
    ].join('\n'),
  },
  {
    id: 'p03-landing-feature-tour', kind: 'landing', font: FONTS.apple, mode: 'linked',
    prompt: 'Marketing page with alternating feature rows — image on one side, text on the other, flipping each row. Sticky nav at the top. Four rows, then an FAQ and a footer.',
    css: `.row{display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center;padding:5rem 0}
.row:nth-child(even) .row-media{order:-1}
@media (max-width:900px){.row{grid-template-columns:1fr}}`,
    build: (r) => [
      C.navbar(r, { product: 'Halyard', links: ['Platform', 'Security', 'Pricing'], blur: true }),
      `<main class="max-w-6xl mx-auto px-6">
  <div class="py-16 max-w-2xl flex flex-col gap-4"><h1 class="text-4xl font-extrabold tracking-tight text-balance">A control plane for every environment you run</h1><p class="text-lg text-slate-600">${C.sentence(r, 16, 24)}</p></div>
  ${[0, 1, 2, 3].map(i => `<section class="row">
    <div class="flex flex-col gap-4">
      <span class="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Step ${i + 1}</span>
      <h2 class="text-3xl font-bold tracking-tight">${C.pick(r, C.WORDS).replace(/^./, c => c.toUpperCase())} without the yak-shaving</h2>
      <p class="text-slate-600 leading-relaxed">${C.paragraph(r, 2)}</p>
      <ul class="flex flex-col gap-2 mt-2">${[0, 1, 2].map(() => `<li class="flex items-start gap-2 text-sm text-slate-600">${C.icon('check', 'w-4 h-4 text-emerald-600 shrink-0 mt-1')}<span>${C.sentence(r, 6, 12)}</span></li>`).join('')}</ul>
    </div>
    <div class="row-media">${C.placeholder(r, 'aspect-video shadow-lg')}</div>
  </section>`).join('\n  ')}
</main>`,
      `<section class="bg-slate-50 border-t px-6 py-20"><h2 class="text-3xl font-bold text-center mb-10">Questions</h2>${C.faq(r, { n: 5 })}</section>`,
      C.footer(r, { product: 'Halyard', cols: 4 }),
    ].join('\n'),
  },
  {
    id: 'p04-landing-changelog', kind: 'landing', font: FONTS.plain, mode: 'inline',
    prompt: 'Public changelog page. Left rail with a sticky version index, right column with dated release entries containing headings, prose, bullet lists and badges. Nav on top, minimal footer.',
    css: `.log{display:grid;grid-template-columns:220px minmax(0,1fr);gap:4rem;max-width:64rem;margin:0 auto;padding:3rem 1.5rem}
.log-index{position:sticky;top:5rem;align-self:start;display:flex;flex-direction:column;gap:.5rem;font-size:.875rem}
.log-entry{padding-block:2.5rem;border-top:1px solid #e2e8f0}
.log-entry:first-child{border-top:0}
@media (max-width:820px){.log{grid-template-columns:1fr}.log-index{position:static}}`,
    build: (r) => [
      C.navbar(r, { product: 'Cadence', links: ['Docs', 'Changelog', 'Status'] }),
      `<div class="log">
  <nav class="log-index">
    <span class="text-xs uppercase tracking-wide text-slate-500 mb-2">Releases</span>
    ${['2026.9', '2026.8', '2026.7', '2026.6', '2026.5'].map((v, i) => `<a class="${i === 0 ? 'text-indigo-600 font-medium' : 'text-slate-500'}">${v}</a>`).join('\n    ')}
  </nav>
  <div>
    ${[0, 1, 2, 3].map(i => `<article class="log-entry flex flex-col gap-4">
      <div class="flex items-center gap-3 flex-wrap"><h2 class="text-2xl font-bold tracking-tight">2026.${9 - i}</h2>${C.badge(i === 0 ? 'Latest' : 'Stable', i === 0 ? 'green' : 'slate')}<span class="text-sm text-slate-500">${['March 2', 'February 11', 'January 20', 'December 14'][i]}, 2026</span></div>
      <p class="text-slate-600 leading-relaxed">${C.paragraph(r, 2)}</p>
      <h3 class="font-semibold mt-2">Added</h3>
      <ul class="list-disc flex flex-col gap-2 text-slate-600">${[0, 1, 2].map(() => `<li>${C.sentence(r, 9, 16)}</li>`).join('')}</ul>
      <h3 class="font-semibold mt-2">Fixed</h3>
      <ul class="list-disc flex flex-col gap-2 text-slate-600">${[0, 1].map(() => `<li>${C.sentence(r, 9, 16)}</li>`).join('')}</ul>
    </article>`).join('\n    ')}
  </div>
</div>`,
      `<footer class="border-t px-6 py-10 text-center text-sm text-slate-500">© 2026 Cadence</footer>`,
    ].join('\n'),
  },
  {
    id: 'p05-landing-waitlist', kind: 'landing', font: FONTS.systemUi, mode: 'linked',
    prompt: 'Single-screen waitlist page for a product called Lumen. Full-height centered layout, big headline, email capture form, three small value props underneath, social proof avatars. Should fill the viewport.',
    css: `.screen{min-height:100vh;display:grid;place-items:center;padding:3rem 1.5rem;
  background:linear-gradient(180deg,#fff 0%,#f8fafc 100%)}
.waitlist{display:flex;gap:.75rem;flex-wrap:wrap}
.waitlist input{flex:1 1 260px;padding:.875rem 1rem;border:1px solid #cbd5e1;border-radius:.75rem}
.props{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.5rem;margin-top:3rem}
@media (max-width:760px){.props{grid-template-columns:1fr}}`,
    build: (r) => `<main class="screen"><div class="max-w-2xl w-full flex flex-col items-center text-center gap-6">
  <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">${C.icon('bolt', 'w-6 h-6')}</div>
  ${C.badge('Private beta · 2,140 on the list', 'indigo')}
  <h1 class="text-5xl font-extrabold tracking-tight text-balance">Lumen turns your logs into answers</h1>
  <p class="text-lg text-slate-600 leading-relaxed">${C.sentence(r, 16, 26)}</p>
  <form class="waitlist w-full max-w-md"><input type="email" placeholder="you@company.com" aria-label="Email">${C.btn('Join waitlist', 'primary', 'px-5 py-3 shrink-0')}</form>
  <div class="flex items-center gap-3 mt-2">
    <div class="flex">${C.some(r, C.PEOPLE, 5).map((p, i) => `<span style="margin-left:${i ? '-10px' : '0'}">${C.avatar(r, p, 'w-8 h-8')}</span>`).join('')}</div>
    <span class="text-sm text-slate-500">Joined this week</span>
  </div>
  <div class="props w-full">${[0, 1, 2].map(() => `<div class="flex flex-col items-center gap-2">${C.icon(C.pick(r, C.ICON_NAMES), 'w-5 h-5 text-indigo-600')}<h3 class="font-semibold text-sm">${C.pick(r, C.WORDS).replace(/^./, c => c.toUpperCase())}</h3><p class="text-sm text-slate-500">${C.sentence(r, 6, 11)}</p></div>`).join('')}</div>
</div></main>`,
  },

  // ============================================================ DASHBOARD (5)
  {
    id: 'p06-dash-analytics', kind: 'dashboard', font: FONTS.systemUi, mode: 'linked',
    prompt: 'Analytics dashboard. Fixed left sidebar with nav, top bar with search and avatar, then four KPI cards, a big chart, and a recent-activity list in a two-column layout below.',
    css: `.shell{display:flex;min-height:100vh;background:#f8fafc}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.lower{display:grid;grid-template-columns:2fr 1fr;gap:1.5rem}
@media (max-width:1100px){.lower{grid-template-columns:1fr}}`,
    build: (r) => `<div class="shell">
  ${C.sidebar(r, { product: 'Meridian', items: ['Overview', 'Analytics', 'Sources', 'Alerts', 'Reports', 'Settings'] })}
  <div class="main">
    <header class="h-16 bg-white border-b flex items-center gap-4 px-6">
      <div class="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg w-80 max-w-full">${C.icon('search', 'w-4 h-4 text-slate-400 shrink-0')}<input class="bg-transparent border-0 text-sm w-full" placeholder="Search dashboards…" style="outline:none"></div>
      <div class="ml-auto flex items-center gap-3">${C.icon('bell', 'w-5 h-5 text-slate-400')}${C.btn('New report', 'primary', 'text-sm')}${C.avatar(r, C.pick(r, C.PEOPLE), 'w-9 h-9')}</div>
    </header>
    <main class="p-6 flex flex-col gap-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div><h1 class="text-2xl font-bold tracking-tight">Overview</h1><p class="text-sm text-slate-500">Last 24 hours across 6 sources</p></div>
        <div class="flex gap-2">${C.btn('Export', 'secondary', 'text-sm')}${C.btn(C.icon('filter', 'w-4 h-4') + ' Filters', 'secondary', 'text-sm')}</div>
      </div>
      ${C.statCards(r, { n: 4 })}
      ${C.chartCard(r, { title: 'Request throughput', h: 220 })}
      <div class="lower">${C.dataTable(r, { rows: 6 })}${C.activityFeed(r, { n: 5, scroll: true })}</div>
    </main>
  </div>
</div>`,
  },
  {
    id: 'p07-dash-billing', kind: 'dashboard', font: FONTS.apple, mode: 'inline',
    prompt: 'Billing and usage dashboard inside an app shell. Show current plan card, usage meters with progress bars, an invoice table, and a payment-method section. Sidebar navigation.',
    css: `.shell{display:flex;min-height:100vh;background:#f8fafc}
.main{flex:1;min-width:0}
.grid2{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:1.5rem;align-items:start}
@media (max-width:1000px){.grid2{grid-template-columns:1fr}}
.meter-row{display:flex;flex-direction:column;gap:.5rem}
.meter-row progress{width:100%;height:8px}`,
    build: (r) => `<div class="shell">
  ${C.sidebar(r, { product: 'Basalt', items: ['Home', 'Billing', 'Team', 'Usage', 'Audit log', 'Settings'], width: 'w-56' })}
  <div class="main p-6 flex flex-col gap-6">
    ${C.breadcrumb(r, ['Settings', 'Billing'])}
    <h1 class="text-2xl font-bold tracking-tight">Billing &amp; usage</h1>
    <div class="grid2">
      <div class="flex flex-col gap-6">
        <div class="bg-white border rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-col gap-1"><div class="flex items-center gap-2"><h2 class="font-semibold">Business plan</h2>${C.badge('Annual', 'indigo')}</div><p class="text-sm text-slate-500">Renews 14 March 2027 · 25 seats</p></div>
          <div class="flex gap-2">${C.btn('Change plan', 'secondary', 'text-sm')}${C.btn('Cancel', 'ghost', 'text-sm')}</div>
        </div>
        <div class="bg-white border rounded-xl p-6 flex flex-col gap-5">
          <h2 class="font-semibold">Usage this cycle</h2>
          ${['Events ingested', 'Storage', 'Seats', 'API calls'].map((l, i) => `<div class="meter-row"><div class="flex justify-between text-sm"><span>${l}</span><span class="text-slate-500 font-mono">${[62, 88, 24, 41][i]}%</span></div><progress value="${[62, 88, 24, 41][i]}" max="100"></progress></div>`).join('\n          ')}
        </div>
        ${C.dataTable(r, { rows: 7, dense: true })}
      </div>
      <div class="flex flex-col gap-6">
        <div class="bg-white border rounded-xl p-6 flex flex-col gap-4">
          <h2 class="font-semibold">Payment method</h2>
          <div class="flex items-center gap-3 p-3 border rounded-lg"><div class="w-10 h-6 rounded bg-slate-900 shrink-0"></div><div class="min-w-0"><div class="text-sm font-medium">•••• 4242</div><div class="text-xs text-slate-500">Expires 09/2029</div></div></div>
          ${C.btn('Update card', 'secondary', 'w-full text-sm')}
        </div>
        <div class="bg-white border rounded-xl p-6 flex flex-col gap-4">
          <h2 class="font-semibold">Billing contact</h2>
          ${C.formFields(r, { kinds: ['email', 'select'] })}
        </div>
      </div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'p08-dash-kanban', kind: 'dashboard', font: FONTS.inter, mode: 'linked',
    prompt: 'Project board with horizontally scrolling kanban columns. Four columns with draggable-looking cards containing avatars, labels and due dates. Toolbar above with filters and a view switcher.',
    css: `.board{display:flex;gap:1rem;overflow-x:auto;padding:1.5rem;align-items:flex-start}
.col{flex:0 0 300px;background:#f1f5f9;border-radius:.75rem;padding:.75rem;display:flex;flex-direction:column;gap:.75rem}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:.5rem;padding:.75rem;display:flex;flex-direction:column;gap:.5rem}`,
    build: (r) => `<div class="min-h-screen flex flex-col">
  ${C.navbar(r, { product: 'Torrent', links: ['Boards', 'Backlog', 'Roadmap'], cta: false })}
  <div class="px-6 pt-6 flex flex-col gap-4">
    ${C.breadcrumb(r, ['Workspace', 'Platform', 'Sprint 42'])}
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-bold tracking-tight">Sprint 42</h1>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex">${C.some(r, C.PEOPLE, 4).map((p, i) => `<span style="margin-left:${i ? '-8px' : '0'}">${C.avatar(r, p, 'w-8 h-8')}</span>`).join('')}</div>
        ${C.btn(C.icon('filter', 'w-4 h-4') + ' Filter', 'secondary', 'text-sm')}${C.btn('New issue', 'primary', 'text-sm')}
      </div>
    </div>
    ${C.tabs(r, ['Board', 'List', 'Timeline', 'Insights'], 0)}
  </div>
  <div class="board">
    ${['Backlog', 'In progress', 'In review', 'Done'].map((col, ci) => `<section class="col">
      <div class="flex items-center justify-between px-1"><h2 class="text-sm font-semibold">${col}</h2><span class="text-xs text-slate-500">${4 - ci}</span></div>
      ${Array.from({ length: 4 - ci }, (_, i) => `<article class="card">
        <div class="flex items-start justify-between gap-2"><span class="text-xs font-mono text-slate-400">PLT-${100 + ci * 10 + i}</span>${C.badge(['bug', 'feat', 'chore'][i % 3], ['red', 'indigo', 'slate'][i % 3])}</div>
        <p class="text-sm font-medium leading-tight">${C.sentence(r, 5, 10)}</p>
        <div class="flex items-center justify-between gap-2 mt-1">
          <div class="flex items-center gap-2 min-w-0">${C.avatar(r, C.PEOPLE[(ci * 3 + i) % C.PEOPLE.length], 'w-6 h-6')}<span class="text-xs text-slate-500 truncate">${C.PEOPLE[(ci * 3 + i) % C.PEOPLE.length].split(' ')[0]}</span></div>
          <span class="text-xs text-slate-400 whitespace-nowrap">Mar ${i + 3}</span>
        </div>
      </article>`).join('\n      ')}
      <button type="button" class="text-sm text-slate-500 px-1 py-2 text-left">+ Add card</button>
    </section>`).join('\n    ')}
  </div>
</div>`,
  },
  {
    id: 'p09-dash-infra-status', kind: 'dashboard', font: FONTS.mono, mode: 'inline',
    prompt: 'Infrastructure status console with a monospace, dense feel. Region grid, service health matrix, an incident timeline, and a log tail panel with its own scrollbar. Dark header.',
    css: `body{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-size:13px}
.regions{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.75rem}
.matrix{display:grid;grid-template-columns:200px repeat(6,minmax(0,1fr));gap:1px;background:#e2e8f0;border:1px solid #e2e8f0;border-radius:.5rem;overflow:hidden}
.matrix>*{background:#fff;padding:.6rem .75rem}
.dot{width:10px;height:10px;border-radius:9999px;display:inline-block}
.logtail{background:#0f172a;color:#cbd5e1;border-radius:.5rem;padding:1rem;max-height:280px;overflow-y:auto;white-space:pre;overflow-x:auto;line-height:1.7}`,
    build: (r) => `<div class="min-h-screen bg-slate-50">
  <header class="bg-slate-900 text-white px-6 h-14 flex items-center gap-6">
    <span class="font-semibold flex items-center gap-2">${C.icon('globe', 'w-5 h-5')} anchorage/status</span>
    <nav class="flex gap-5 text-slate-400">${['regions', 'services', 'incidents', 'runbooks'].map(l => `<a>${l}</a>`).join('')}</nav>
    <span class="ml-auto flex items-center gap-2 text-emerald-400"><span class="dot" style="background:currentColor"></span>all systems nominal</span>
  </header>
  <main class="p-6 flex flex-col gap-6">
    <section class="flex flex-col gap-3"><h2 class="text-sm uppercase tracking-wide text-slate-500">Regions</h2>
      <div class="regions">${['eu-central-1', 'eu-west-2', 'us-east-1', 'us-west-2', 'ap-northeast-1', 'ap-south-1', 'sa-east-1', 'af-south-1'].map((rg, i) => `<div class="bg-white border rounded-lg p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between"><span class="font-medium">${rg}</span><span class="dot" style="background:${i === 2 ? '#f59e0b' : '#10b981'}"></span></div>
        <div class="flex justify-between text-slate-500"><span>p95</span><span>${120 + i * 17}ms</span></div>
        <div class="flex justify-between text-slate-500"><span>rps</span><span>${(2400 + i * 311).toLocaleString('en-US')}</span></div>
      </div>`).join('\n      ')}</div>
    </section>
    <section class="flex flex-col gap-3"><h2 class="text-sm uppercase tracking-wide text-slate-500">Service matrix</h2>
      <div class="matrix">
        <div class="font-semibold">service</div>${['eu-c1', 'eu-w2', 'us-e1', 'us-w2', 'ap-n1', 'ap-s1'].map(h => `<div class="font-semibold text-center">${h}</div>`).join('')}
        ${['ingest', 'query', 'alerting', 'billing', 'webhooks'].map((s, si) => `<div>${s}</div>${[0, 1, 2, 3, 4, 5].map(ci => `<div class="text-center"><span class="dot" style="background:${(si + ci) % 7 === 3 ? '#f59e0b' : (si * ci) % 11 === 5 ? '#f43f5e' : '#10b981'}"></span></div>`).join('')}`).join('\n        ')}
      </div>
    </section>
    <section class="grid grid-cols-2 gap-6" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
      <div class="flex flex-col gap-3"><h2 class="text-sm uppercase tracking-wide text-slate-500">Incident timeline</h2>
        <ol class="bg-white border rounded-lg divide-y">${[0, 1, 2, 3].map(i => `<li class="p-3 flex gap-3"><span class="text-slate-400 shrink-0">0${i + 1}:${(i * 17) % 60 < 10 ? '0' : ''}${(i * 17) % 60}</span><span class="min-w-0">${C.sentence(r, 6, 12)}</span></li>`).join('')}</ol>
      </div>
      <div class="flex flex-col gap-3"><h2 class="text-sm uppercase tracking-wide text-slate-500">Log tail</h2>
        <div class="logtail">${Array.from({ length: 14 }, (_, i) => `[2026-03-14T0${i % 10}:12:0${i % 10}Z] level=info svc=ingest region=eu-central-1 msg="${C.lorem(r, 5)}" dur=${12 + i * 3}ms`).join('\n')}</div>
      </div>
    </section>
  </main>
</div>`,
  },
  {
    id: 'p10-dash-crm-detail', kind: 'dashboard', font: FONTS.systemUi, mode: 'linked',
    prompt: 'CRM record detail page. Left column with the account profile and key fields, main column with tabs (activity, notes, files), right rail with related records. Sticky page header with actions.',
    css: `.detail{display:grid;grid-template-columns:280px minmax(0,1fr) 260px;gap:1.5rem;padding:1.5rem;align-items:start}
@media (max-width:1200px){.detail{grid-template-columns:1fr}}
.pagehead{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #e2e8f0}
.field{display:flex;justify-content:space-between;gap:1rem;padding:.5rem 0;border-bottom:1px solid #f1f5f9;font-size:.875rem}
.field dt{color:#64748b}.field dd{margin:0;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
    build: (r) => `<div class="min-h-screen bg-slate-50">
  <div class="pagehead px-6 py-4 flex flex-col gap-3">
    ${C.breadcrumb(r, ['Accounts', 'Enterprise', 'Everstack'])}
    <div class="flex items-center gap-4 flex-wrap">
      ${C.avatar(r, 'Everstack Inc', 'w-12 h-12')}
      <div class="min-w-0"><h1 class="text-xl font-bold tracking-tight truncate">Everstack Inc.</h1><p class="text-sm text-slate-500 truncate">${C.pick(r, C.CITIES)} · 1,200 employees · everstack.example</p></div>
      <div class="ml-auto flex gap-2">${C.btn('Log call', 'secondary', 'text-sm')}${C.btn('Add note', 'secondary', 'text-sm')}${C.btn('Create deal', 'primary', 'text-sm')}</div>
    </div>
  </div>
  <div class="detail">
    <div class="flex flex-col gap-6">
      <div class="bg-white border rounded-xl p-5 flex flex-col gap-3"><h2 class="font-semibold">Details</h2>
        <dl>${[['Owner', C.pick(r, C.PEOPLE)], ['Stage', 'Negotiation'], ['ARR', '$248,000'], ['Renewal', '14 Mar 2027'], ['Region', C.pick(r, C.CITIES)], ['Health', 'Good']].map(([k, v]) => `<div class="field"><dt>${k}</dt><dd>${C.esc(v)}</dd></div>`).join('')}</dl>
      </div>
      <div class="bg-white border rounded-xl p-5 flex flex-col gap-3"><h2 class="font-semibold">Contacts</h2>
        ${C.some(r, C.PEOPLE, 4).map(p => `<div class="flex items-center gap-3">${C.avatar(r, p, 'w-8 h-8')}<div class="min-w-0"><div class="text-sm font-medium truncate">${C.esc(p)}</div><div class="text-xs text-slate-500 truncate">${C.pick(r, C.ROLES)}</div></div></div>`).join('\n        ')}
      </div>
    </div>
    <div class="flex flex-col gap-4">
      ${C.tabs(r, ['Activity', 'Notes', 'Files', 'Emails'], 0)}
      ${C.activityFeed(r, { n: 7 })}
      ${C.chartCard(r, { title: 'Product usage', h: 160 })}
    </div>
    <div class="flex flex-col gap-4">
      <div class="bg-white border rounded-xl p-5 flex flex-col gap-3"><h2 class="font-semibold text-sm">Open deals</h2>
        ${[0, 1, 2].map(i => `<div class="flex flex-col gap-1 pb-3 border-b"><span class="text-sm font-medium truncate">${C.pick(r, C.PRODUCTS)} expansion</span><span class="text-xs text-slate-500">$${(40 + i * 13)}k · closes Q${i + 1}</span></div>`).join('')}
      </div>
      <div class="bg-white border rounded-xl p-5 flex flex-col gap-3"><h2 class="font-semibold text-sm">Tickets</h2>
        ${[0, 1].map(i => `<div class="flex items-start gap-2">${C.icon('doc', 'w-4 h-4 text-slate-400 shrink-0 mt-1')}<span class="text-sm line-clamp-2">${C.sentence(r, 10, 18)}</span></div>`).join('')}
      </div>
    </div>
  </div>
</div>`,
  },

  // ============================================================ FORMS (4)
  {
    id: 'p11-form-settings', kind: 'form', font: FONTS.systemUi, mode: 'linked',
    prompt: 'Account settings page. Left nav for settings sections, main panel with grouped form sections — profile, notifications, security — using real input types. Sticky save bar at the bottom.',
    css: `.settings{display:grid;grid-template-columns:220px minmax(0,1fr);gap:3rem;max-width:70rem;margin:0 auto;padding:2rem 1.5rem 6rem}
.settings-nav{position:sticky;top:2rem;align-self:start;display:flex;flex-direction:column;gap:.25rem}
.settings-nav a{padding:.5rem .75rem;border-radius:.5rem;font-size:.875rem;color:#475569}
.settings-nav a.on{background:#eef2ff;color:#4f46e5;font-weight:500}
.savebar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:1rem 1.5rem;display:flex;justify-content:flex-end;gap:.75rem;z-index:40}
@media (max-width:820px){.settings{grid-template-columns:1fr}.settings-nav{position:static;flex-direction:row;overflow-x:auto}}`,
    build: (r) => `${C.navbar(r, { product: 'Verdant', links: ['Dashboard', 'Projects', 'Team'], cta: false })}
<div class="settings">
  <nav class="settings-nav">${['Profile', 'Account', 'Notifications', 'Security', 'Billing', 'Integrations', 'Danger zone'].map((s, i) => `<a class="${i === 0 ? 'on' : ''}">${s}</a>`).join('')}</nav>
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-5"><div><h2 class="text-lg font-semibold">Profile</h2><p class="text-sm text-slate-500">${C.sentence(r, 8, 14)}</p></div>
      <div class="flex items-center gap-4">${C.avatar(r, C.pick(r, C.PEOPLE), 'w-16 h-16')}<div class="flex flex-col gap-2">${C.btn('Upload new photo', 'secondary', 'text-sm')}<span class="text-xs text-slate-500">JPG or PNG, max 2 MB</span></div></div>
      ${C.formFields(r, { kinds: ['text', 'email', 'textarea', 'select'] })}
    </section>
    <section class="flex flex-col gap-5 pt-8 border-t"><div><h2 class="text-lg font-semibold">Notifications</h2><p class="text-sm text-slate-500">${C.sentence(r, 8, 14)}</p></div>
      ${C.formFields(r, { kinds: ['radio', 'checkbox', 'switch', 'range'] })}
    </section>
    <section class="flex flex-col gap-5 pt-8 border-t"><div><h2 class="text-lg font-semibold">Security</h2><p class="text-sm text-slate-500">${C.sentence(r, 8, 14)}</p></div>
      ${C.formFields(r, { kinds: ['password', 'date', 'file'] })}
    </section>
  </div>
</div>
<div class="savebar">${C.btn('Discard', 'secondary')}${C.btn('Save changes', 'primary')}</div>`,
  },
  {
    id: 'p12-form-checkout', kind: 'form', font: FONTS.apple, mode: 'inline',
    prompt: 'Two-column checkout. Left side has contact, shipping and payment fieldsets; right side is a sticky order summary with line items, discount code input and totals. Trust badges at the bottom.',
    css: `.checkout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:3rem;max-width:66rem;margin:0 auto;padding:2rem 1.5rem}
.summary{position:sticky;top:2rem;align-self:start}
.line{display:flex;gap:1rem;padding:.75rem 0;border-bottom:1px solid #f1f5f9}
.totals{display:flex;justify-content:space-between;padding:.4rem 0;font-size:.875rem}
.totals.grand{font-size:1.125rem;font-weight:700;border-top:1px solid #e2e8f0;margin-top:.5rem;padding-top:.75rem}
@media (max-width:880px){.checkout{grid-template-columns:1fr}.summary{position:static}}`,
    build: (r) => `<header class="border-b px-6 h-16 flex items-center justify-between">
  <span class="font-semibold flex items-center gap-2">${C.icon('box', 'w-6 h-6 text-indigo-600')}Quarry</span>
  <span class="flex items-center gap-2 text-sm text-slate-500">${C.icon('shield', 'w-4 h-4')} Secure checkout</span>
</header>
<div class="checkout">
  <form class="flex flex-col gap-8">
    <section class="flex flex-col gap-5"><h2 class="text-lg font-semibold">Contact</h2>${C.formFields(r, { kinds: ['email', 'text'] })}</section>
    <section class="flex flex-col gap-5"><h2 class="text-lg font-semibold">Shipping address</h2>
      ${C.formFields(r, { kinds: ['text', 'text'], columns: 2 })}
      ${C.formFields(r, { kinds: ['select', 'number'], columns: 2 })}
      ${C.formFields(r, { kinds: ['checkbox'] })}
    </section>
    <section class="flex flex-col gap-5"><h2 class="text-lg font-semibold">Payment</h2>
      ${C.formFields(r, { kinds: ['text'] })}
      ${C.formFields(r, { kinds: ['date', 'number'], columns: 2 })}
      ${C.formFields(r, { kinds: ['radio'] })}
    </section>
    ${C.btn('Pay $248.00', 'primary', 'w-full py-3')}
    <div class="flex items-center justify-center gap-6 text-slate-400">${C.some(r, C.ICON_NAMES, 4).map(i => C.icon(i, 'w-6 h-6')).join('')}</div>
  </form>
  <aside class="summary bg-slate-50 border rounded-xl p-6 flex flex-col gap-4">
    <h2 class="font-semibold">Order summary</h2>
    ${[0, 1, 2].map(i => `<div class="line">${C.placeholder(r, 'w-16 h-16 shrink-0')}<div class="min-w-0 flex-1"><div class="text-sm font-medium truncate">${C.pick(r, C.PRODUCTS)} ${C.pick(r, ['Pro', 'Kit', 'Bundle'])}</div><div class="text-xs text-slate-500 truncate">${C.sentence(r, 4, 8)}</div></div><div class="text-sm font-medium whitespace-nowrap">$${(49 + i * 30)}.00</div></div>`).join('\n    ')}
    <div class="flex gap-2"><input type="text" placeholder="Discount code" class="flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm">${C.btn('Apply', 'secondary', 'text-sm shrink-0')}</div>
    <div><div class="totals"><span>Subtotal</span><span>$228.00</span></div><div class="totals"><span>Shipping</span><span>$12.00</span></div><div class="totals"><span>Tax</span><span>$8.00</span></div><div class="totals grand"><span>Total</span><span>$248.00</span></div></div>
  </aside>
</div>`,
  },
  {
    id: 'p13-form-wizard', kind: 'form', font: FONTS.plain, mode: 'linked',
    prompt: 'Multi-step onboarding wizard, step 2 of 4. Progress indicator across the top, a centered card with the current step form, back/continue buttons, and a help panel to the side.',
    css: `.steps{display:flex;align-items:center;gap:.75rem;justify-content:center;padding:2rem 1rem}
.step{display:flex;align-items:center;gap:.5rem;font-size:.875rem;color:#94a3b8}
.step .n{width:28px;height:28px;border-radius:9999px;display:grid;place-items:center;border:1px solid #cbd5e1;font-size:.75rem}
.step.on{color:#4f46e5;font-weight:600}.step.on .n{background:#4f46e5;color:#fff;border-color:#4f46e5}
.step.done .n{background:#10b981;color:#fff;border-color:#10b981}
.bar{flex:1;height:2px;background:#e2e8f0;max-width:60px}
.wizard{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:2rem;max-width:56rem;margin:0 auto;padding:0 1.5rem 4rem;align-items:start}
@media (max-width:800px){.wizard{grid-template-columns:1fr}}`,
    build: (r) => `<div class="min-h-screen bg-slate-50">
  <header class="bg-white border-b h-16 flex items-center px-6"><span class="font-semibold flex items-center gap-2">${C.icon('box', 'w-6 h-6 text-indigo-600')}Slipstream setup</span><a class="ml-auto text-sm text-slate-500">Save &amp; exit</a></header>
  <div class="steps">
    ${['Workspace', 'Team', 'Integrations', 'Review'].map((s, i) => `<div class="step ${i === 1 ? 'on' : i < 1 ? 'done' : ''}"><span class="n">${i < 1 ? '✓' : i + 1}</span><span class="whitespace-nowrap">${s}</span></div>${i < 3 ? '<span class="bar"></span>' : ''}`).join('')}
  </div>
  <div class="wizard">
    <div class="bg-white border rounded-2xl p-8 flex flex-col gap-6">
      <div class="flex flex-col gap-2"><h1 class="text-2xl font-bold tracking-tight">Invite your team</h1><p class="text-slate-600">${C.sentence(r, 12, 20)}</p></div>
      ${C.formFields(r, { kinds: ['email', 'select', 'radio', 'checkbox'] })}
      <div class="flex flex-col gap-3 pt-2">
        <span class="text-sm font-medium">Pending invites</span>
        ${C.some(r, C.PEOPLE, 3).map(p => `<div class="flex items-center gap-3 p-2 border rounded-lg">${C.avatar(r, p, 'w-8 h-8')}<div class="min-w-0 flex-1"><div class="text-sm truncate">${C.esc(p)}</div><div class="text-xs text-slate-500 truncate">${C.esc(p.split(' ')[0].toLowerCase())}@everstack.example</div></div><button type="button" class="text-slate-400 shrink-0">${C.icon('trash', 'w-4 h-4')}</button></div>`).join('\n        ')}
      </div>
      <div class="flex items-center justify-between gap-3 pt-4 border-t">${C.btn('Back', 'secondary')}<div class="flex gap-2">${C.btn('Skip for now', 'ghost')}${C.btn('Continue', 'primary')}</div></div>
    </div>
    <aside class="bg-indigo-50 border border-indigo-600 rounded-2xl p-6 flex flex-col gap-3">
      <div class="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">${C.icon('bolt', 'w-5 h-5')}</div>
      <h2 class="font-semibold">Why invite now?</h2>
      <p class="text-sm text-slate-600 leading-relaxed">${C.paragraph(r, 2)}</p>
      <a class="text-sm text-indigo-600 font-medium mt-2">Read the guide →</a>
    </aside>
  </div>
</div>`,
  },
  {
    id: 'p14-form-auth', kind: 'form', font: FONTS.inter, mode: 'inline',
    prompt: 'Sign-up page with a split layout: form on the left half, a testimonial and gradient panel on the right half filling the viewport height. OAuth buttons above a divider, then email and password fields.',
    css: `.split{display:grid;grid-template-columns:1fr 1fr;min-height:100vh}
.panel{background:linear-gradient(160deg,#312e81,#0f172a);color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:3rem}
.formside{display:grid;place-items:center;padding:3rem 1.5rem}
.divider{display:flex;align-items:center;gap:1rem;color:#94a3b8;font-size:.75rem}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:#e2e8f0}
@media (max-width:900px){.split{grid-template-columns:1fr}.panel{display:none}}`,
    build: (r) => `<div class="split">
  <div class="formside"><div class="w-full max-w-sm flex flex-col gap-6">
    <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">${C.icon('box', 'w-5 h-5')}</div>
    <div class="flex flex-col gap-2"><h1 class="text-3xl font-bold tracking-tight">Create your account</h1><p class="text-slate-600">Start your 14-day trial. No card needed.</p></div>
    <div class="flex flex-col gap-3">
      ${['Continue with Google', 'Continue with GitHub'].map((l, i) => C.btn(C.icon(['globe', 'box'][i], 'w-4 h-4') + ' ' + l, 'secondary', 'w-full py-2.5')).join('')}
    </div>
    <div class="divider">OR</div>
    ${C.formFields(r, { kinds: ['text', 'email', 'password'] })}
    <label class="flex items-start gap-3"><input type="checkbox" class="mt-1 shrink-0"><span class="text-sm text-slate-600">I agree to the <a class="text-indigo-600">Terms</a> and <a class="text-indigo-600">Privacy Policy</a></span></label>
    ${C.btn('Create account', 'primary', 'w-full py-3')}
    <p class="text-sm text-center text-slate-500">Already have an account? <a class="text-indigo-600 font-medium">Sign in</a></p>
  </div></div>
  <div class="panel">
    <span class="font-semibold flex items-center gap-2">${C.icon('bolt', 'w-5 h-5')} Anchorage</span>
    <div class="flex flex-col gap-6 max-w-md">
      <p class="text-2xl leading-relaxed">"${C.sentence(r, 18, 28)}"</p>
      <div class="flex items-center gap-3">${C.avatar(r, C.pick(r, C.PEOPLE), 'w-11 h-11')}<div><div class="font-medium">${C.pick(r, C.PEOPLE)}</div><div class="text-sm opacity-60">${C.pick(r, C.ROLES)}, ${C.pick(r, C.COMPANIES)}</div></div></div>
    </div>
    <div class="flex gap-6 text-sm opacity-60"><span>SOC 2 Type II</span><span>GDPR</span><span>HIPAA</span></div>
  </div>
</div>`,
  },

  // ============================================================ PRICING (3)
  {
    id: 'p15-pricing-tiers', kind: 'pricing', font: FONTS.systemUi, mode: 'linked',
    prompt: 'Pricing page with three tiers, the middle one highlighted with a "most popular" badge, a monthly/annual toggle, a full feature comparison table below, and an FAQ.',
    css: `.toggle{display:inline-flex;background:#f1f5f9;border-radius:9999px;padding:.25rem}
.toggle button{padding:.5rem 1.25rem;border-radius:9999px;border:0;font-size:.875rem;background:transparent}
.toggle button.on{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08);font-weight:600}`,
    build: (r) => `${C.navbar(r, { product: 'Fathom', links: ['Product', 'Pricing', 'Docs', 'Blog'] })}
<main class="px-6 py-16 flex flex-col gap-16">
  <div class="max-w-2xl mx-auto text-center flex flex-col items-center gap-5">
    <h1 class="text-5xl font-extrabold tracking-tight">Simple, predictable pricing</h1>
    <p class="text-lg text-slate-600">${C.sentence(r, 14, 22)}</p>
    <div class="toggle"><button class="on" type="button">Monthly</button><button type="button">Annual · save 20%</button></div>
  </div>
  <div class="max-w-6xl mx-auto w-full">${C.pricingTiers(r, { n: 3, highlight: 1 })}</div>
  <div class="max-w-5xl mx-auto w-full flex flex-col gap-6"><h2 class="text-2xl font-bold tracking-tight text-center">Compare plans</h2>${C.comparisonTable(r)}</div>
  <div class="flex flex-col gap-6"><h2 class="text-2xl font-bold tracking-tight text-center">Frequently asked</h2>${C.faq(r, { n: 6 })}</div>
</main>
${C.ctaBand(r, { product: 'Fathom', dark: false })}
${C.footer(r, { product: 'Fathom', cols: 4 })}`,
  },
  {
    id: 'p16-pricing-calculator', kind: 'pricing', font: FONTS.apple, mode: 'inline',
    prompt: 'Usage-based pricing page with an interactive-looking calculator: sliders for volume, a live estimate card, and a breakdown table. Four plan cards laid out with flexbox below.',
    css: `.calc{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:2rem;align-items:start;
  background:#f8fafc;border:1px solid #e2e8f0;border-radius:1rem;padding:2rem}
@media (max-width:900px){.calc{grid-template-columns:1fr}}
.estimate{background:#0f172a;color:#fff;border-radius:.75rem;padding:1.5rem;display:flex;flex-direction:column;gap:1rem}
.estimate .big{font-size:2.5rem;font-weight:800;letter-spacing:-.02em;line-height:1}`,
    build: (r) => `${C.navbar(r, { product: 'Gridline', links: ['Platform', 'Pricing', 'Enterprise'] })}
<main class="max-w-6xl mx-auto px-6 py-16 flex flex-col gap-16">
  <div class="max-w-2xl flex flex-col gap-4"><h1 class="text-4xl font-extrabold tracking-tight">Pay for what you ingest</h1><p class="text-lg text-slate-600">${C.sentence(r, 14, 22)}</p></div>
  <section class="calc">
    <div class="flex flex-col gap-6">
      <h2 class="font-semibold text-lg">Estimate your bill</h2>
      ${C.formFields(r, { kinds: ['range', 'range', 'number', 'select'] })}
      <div class="border-t pt-4"><table class="w-full text-sm"><tbody>
        ${[['Base platform', '$99.00'], ['Events (48M @ $0.12/M)', '$5.76'], ['Storage (1.4 TB)', '$28.00'], ['Support (Business)', '$0.00']].map(([a, b]) => `<tr class="border-b"><td class="py-2 text-slate-600">${a}</td><td class="py-2 text-right font-mono">${b}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="estimate">
      <span class="text-sm opacity-60">Estimated monthly</span>
      <span class="big">$132.76</span>
      <p class="text-sm opacity-80 leading-relaxed">${C.sentence(r, 10, 16)}</p>
      ${C.btn('Start free trial', 'secondary', 'w-full py-2.5')}
    </div>
  </section>
  <div class="flex flex-col gap-6"><h2 class="text-2xl font-bold tracking-tight">Plans</h2>${C.pricingTiers(r, { n: 4, highlight: 2, layout: 'flex' })}</div>
</main>
${C.footer(r, { product: 'Gridline', cols: 3 })}`,
  },
  {
    id: 'p17-pricing-compare-dense', kind: 'pricing', font: FONTS.plain, mode: 'linked',
    prompt: 'Enterprise pricing page that leads with a dense feature comparison matrix (many rows, sticky header row) and puts the plan cards below it. Include a contact-sales band.',
    css: `.matrix-wrap{border:1px solid #e2e8f0;border-radius:.75rem;overflow:auto;max-height:520px;background:#fff}
.matrix-wrap table{width:100%;font-size:.875rem;border-collapse:separate;border-spacing:0}
.matrix-wrap thead th{position:sticky;top:0;background:#f8fafc;z-index:2;border-bottom:1px solid #e2e8f0;padding:.9rem 1rem;text-align:center;white-space:nowrap}
.matrix-wrap thead th:first-child{text-align:left;left:0;z-index:3}
.matrix-wrap td{padding:.7rem 1rem;border-bottom:1px solid #f1f5f9;text-align:center}
.matrix-wrap td:first-child{text-align:left;color:#334155}
.matrix-wrap tr.group td{background:#f8fafc;font-weight:600;color:#0f172a}`,
    build: (r) => {
      const groups = [['Core', ['Projects', 'Environments', 'Retention', 'Data residency', 'Seats']], ['Security', ['SSO / SAML', 'SCIM provisioning', 'Audit log', 'IP allowlist', 'Custom roles']], ['Support', ['Response SLA', 'Named CSM', 'Onboarding', 'Quarterly review']]];
      let rows = '';
      for (const [g, feats] of groups) {
        rows += `<tr class="group"><td colspan="4">${g}</td></tr>`;
        for (const f of feats) rows += `<tr><td>${f}</td><td>${C.pick(r, ['—', '✓', '3', 'Limited'])}</td><td>${C.pick(r, ['✓', '25', '90 days'])}</td><td>✓</td></tr>`;
      }
      return `${C.navbar(r, { product: 'Corveta', links: ['Product', 'Pricing', 'Security'] })}
<main class="max-w-6xl mx-auto px-6 py-16 flex flex-col gap-12">
  <div class="max-w-2xl flex flex-col gap-4"><h1 class="text-4xl font-extrabold tracking-tight">Compare every plan</h1><p class="text-lg text-slate-600">${C.sentence(r, 12, 20)}</p></div>
  <div class="matrix-wrap"><table>
    <thead><tr><th>Feature</th><th>Starter</th><th>Business</th><th>Enterprise</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  ${C.pricingTiers(r, { n: 3, highlight: 2 })}
  <section class="bg-slate-900 text-white rounded-2xl p-10 flex flex-wrap items-center justify-between gap-6">
    <div class="max-w-lg flex flex-col gap-2"><h2 class="text-2xl font-bold">Need something bespoke?</h2><p class="opacity-80">${C.sentence(r, 10, 18)}</p></div>
    ${C.btn('Contact sales', 'secondary', 'px-5 py-3')}
  </section>
</main>
${C.footer(r, { product: 'Corveta', cols: 4 })}`;
    },
  },

  // ============================================================ ARTICLE (4)
  {
    id: 'p18-article-blogpost', kind: 'article', font: FONTS.serif, mode: 'inline',
    prompt: 'Long-form blog post in a serif typeface. Centered measure of about 68 characters, author byline with avatar and date, drop-cap first paragraph, pull quote, code block, figure with caption, and related-posts cards at the end.',
    css: `body{font-family:Georgia,Cambria,"Times New Roman",Times,serif;color:#1e293b}
.post{max-width:44rem;margin:0 auto;padding:3rem 1.5rem}
.post p{font-size:1.125rem;line-height:1.75;margin:0}
.post>*+*{margin-top:1.5rem}
.post>p:first-of-type::first-letter{float:left;font-size:3.6rem;line-height:.85;padding:.1em .1em 0 0;font-weight:700}
.related{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem}`,
    build: (r) => `${C.navbar(r, { product: 'Dunlin Labs', links: ['Engineering', 'Research', 'Careers'], cta: false })}
<article class="post flex flex-col">
  <div class="flex flex-col gap-4">
    ${C.badge('Engineering', 'indigo')}
    <h1 class="text-4xl font-bold tracking-tight leading-tight">What we learned rewriting our ${C.pick(r, C.WORDS)} layer</h1>
    <p class="text-lg text-slate-500">${C.sentence(r, 14, 22)}</p>
    <div class="flex items-center gap-3 py-4 border-t border-b">
      ${C.avatar(r, C.pick(r, C.PEOPLE), 'w-11 h-11')}
      <div class="min-w-0"><div class="font-semibold">${C.pick(r, C.PEOPLE)}</div><div class="text-sm text-slate-500">${C.pick(r, C.ROLES)} · 14 March 2026 · 11 min read</div></div>
      <div class="ml-auto flex gap-2 text-slate-400">${C.some(r, C.ICON_NAMES, 3).map(i => C.icon(i, 'w-5 h-5')).join('')}</div>
    </div>
  </div>
  ${C.prose(r, { paras: 7 })}
  <div class="flex flex-wrap gap-2 pt-6 border-t">${C.some(r, C.WORDS, 5).map(w => C.badge(w, 'slate')).join('')}</div>
  <section class="pt-10 flex flex-col gap-6"><h2 class="text-2xl font-bold">Related reading</h2>
    <div class="related">${[0, 1, 2].map(() => `<a class="flex flex-col gap-3">${C.placeholder(r, 'aspect-video')}<h3 class="font-semibold leading-tight">${C.sentence(r, 5, 9)}</h3><p class="text-sm text-slate-500 line-clamp-2">${C.sentence(r, 12, 20)}</p></a>`).join('\n    ')}</div>
  </section>
</article>
${C.footer(r, { product: 'Dunlin Labs', cols: 3 })}`,
  },
  {
    id: 'p19-article-docs', kind: 'article', font: FONTS.systemUi, mode: 'linked',
    prompt: 'Documentation page with three columns: left sidebar navigation tree, main content, right-hand sticky table of contents. Include code blocks, callout boxes, a parameters table and prev/next links.',
    css: `.docs{display:grid;grid-template-columns:260px minmax(0,1fr) 220px;gap:2.5rem;max-width:88rem;margin:0 auto;padding:2rem 1.5rem}
.docnav{position:sticky;top:5rem;align-self:start;max-height:calc(100vh - 7rem);overflow-y:auto;font-size:.875rem}
.docnav ul{padding-left:.75rem;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;gap:.4rem;margin:.4rem 0 1rem}
.toc{position:sticky;top:5rem;align-self:start;font-size:.8125rem;display:flex;flex-direction:column;gap:.5rem}
.callout{border-left:4px solid #4f46e5;background:#eef2ff;padding:1rem 1.25rem;border-radius:0 .5rem .5rem 0}
.docmain>*+*{margin-top:1.25rem}
@media (max-width:1150px){.docs{grid-template-columns:240px minmax(0,1fr)}.toc{display:none}}`,
    build: (r) => `${C.navbar(r, { product: 'Torrent Docs', links: ['Guides', 'API', 'SDKs', 'Changelog'], blur: true })}
<div class="docs">
  <nav class="docnav flex flex-col gap-2">
    ${['Getting started', 'Core concepts', 'API reference', 'Deployment'].map((g, gi) => `<div><span class="font-semibold">${g}</span><ul>${[0, 1, 2, 3].map(i => `<li><a class="${gi === 1 && i === 2 ? 'text-indigo-600 font-medium' : 'text-slate-600'}">${C.pick(r, C.WORDS).replace(/^./, c => c.toUpperCase())}</a></li>`).join('')}</ul></div>`).join('\n    ')}
  </nav>
  <main class="docmain">
    ${C.breadcrumb(r, ['Docs', 'Core concepts', 'Pipelines'])}
    <h1 class="text-3xl font-bold tracking-tight">Pipelines</h1>
    <p class="text-lg text-slate-600 leading-relaxed">${C.sentence(r, 16, 26)}</p>
    <div class="callout flex gap-3">${C.icon('bolt', 'w-5 h-5 text-indigo-600 shrink-0')}<div><strong class="block mb-1">Note</strong><span class="text-sm text-slate-700">${C.sentence(r, 12, 20)}</span></div></div>
    <h2 class="text-xl font-bold mt-8">Defining a pipeline</h2>
    <p class="text-slate-600 leading-relaxed">${C.paragraph(r, 2)}</p>
    <pre class="bg-slate-900 text-white rounded-xl p-5 overflow-x-auto text-sm font-mono"><code>import { definePipeline } from "@torrent/sdk";

export default definePipeline({
  name: "events-normalize",
  source: { kind: "kafka", topic: "raw.events", group: "normalize-v2" },
  steps: [dedupe({ window: "5m" }), enrich({ from: "accounts" }), sink("warehouse")],
});</code></pre>
    <h2 class="text-xl font-bold mt-8">Parameters</h2>
    <div class="border rounded-xl overflow-x-auto"><table class="w-full text-sm">
      <thead class="bg-slate-50 border-b"><tr>${['Name', 'Type', 'Default', 'Description'].map(h => `<th class="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">${h}</th>`).join('')}</tr></thead>
      <tbody>${['name', 'source', 'steps', 'concurrency', 'retries'].map((n, i) => `<tr class="border-b"><td class="px-4 py-3 font-mono whitespace-nowrap">${n}</td><td class="px-4 py-3 font-mono text-indigo-600 whitespace-nowrap">${['string', 'Source', 'Step[]', 'number', 'number'][i]}</td><td class="px-4 py-3 font-mono text-slate-500">${['—', '—', '[]', '4', '3'][i]}</td><td class="px-4 py-3 text-slate-600">${C.sentence(r, 6, 12)}</td></tr>`).join('')}</tbody>
    </table></div>
    <h2 class="text-xl font-bold mt-8">Error handling</h2>
    <p class="text-slate-600 leading-relaxed">${C.paragraph(r, 3)}</p>
    <div class="flex justify-between gap-4 pt-8 mt-8 border-t">
      <a class="flex-1 border rounded-xl p-4"><span class="text-xs text-slate-500">Previous</span><div class="font-medium">Sources</div></a>
      <a class="flex-1 border rounded-xl p-4 text-right"><span class="text-xs text-slate-500">Next</span><div class="font-medium">Sinks</div></a>
    </div>
  </main>
  <nav class="toc">
    <span class="text-xs uppercase tracking-wide text-slate-500">On this page</span>
    ${['Defining a pipeline', 'Parameters', 'Error handling', 'Examples'].map((t, i) => `<a class="${i === 0 ? 'text-indigo-600' : 'text-slate-500'}">${t}</a>`).join('')}
  </nav>
</div>`,
  },
  {
    id: 'p20-article-magazine', kind: 'article', font: FONTS.serif, mode: 'inline',
    prompt: 'Editorial magazine-style index page. A large lead story with an overlaid headline on the image, then a masonry-ish grid of secondary stories in mixed sizes, and a newsletter signup band.',
    css: `body{font-family:Georgia,Cambria,"Times New Roman",Times,serif}
.lead{position:relative;border-radius:1rem;overflow:hidden;aspect-ratio:21/9}
.lead .overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(15,23,42,.85),transparent 60%);
  display:flex;flex-direction:column;justify-content:flex-end;padding:2.5rem;color:#fff;gap:.75rem}
.mag{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1.5rem}
.mag .big{grid-column:span 3}.mag .med{grid-column:span 2}.mag .sm{grid-column:span 2}
@media (max-width:900px){.mag{grid-template-columns:1fr}.mag>*{grid-column:auto !important}}`,
    build: (r) => `<header class="border-b"><div class="max-w-6xl mx-auto px-6 py-6 flex flex-col items-center gap-4">
  <h1 class="text-3xl font-bold tracking-tight">The Hollis Review</h1>
  <nav class="flex flex-wrap justify-center gap-6 text-sm uppercase tracking-wide text-slate-600">${['Technology', 'Climate', 'Markets', 'Culture', 'Long reads'].map(l => `<a>${l}</a>`).join('')}</nav>
</div></header>
<main class="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-12">
  <a class="lead" style="background:linear-gradient(135deg,#4c1d95,#0f172a)"><div class="overlay">
    <span class="text-xs uppercase tracking-wide opacity-80">Long read</span>
    <h2 class="text-4xl font-bold leading-tight max-w-2xl">${C.sentence(r, 8, 14)}</h2>
    <p class="max-w-xl opacity-80">${C.sentence(r, 14, 22)}</p>
  </div></a>
  <div class="mag">
    ${[['big', 'aspect-video'], ['med', 'aspect-square'], ['sm', 'aspect-video'], ['med', 'aspect-video'], ['big', 'aspect-square'], ['sm', 'aspect-video']].map(([cls, ratio]) => `<article class="${cls} flex flex-col gap-3">
      ${C.placeholder(r, ratio)}
      <span class="text-xs uppercase tracking-wide text-indigo-600">${C.pick(r, ['Technology', 'Climate', 'Markets', 'Culture'])}</span>
      <h3 class="text-xl font-bold leading-tight">${C.sentence(r, 6, 11)}</h3>
      <p class="text-slate-600 line-clamp-3">${C.paragraph(r, 2)}</p>
      <div class="flex items-center gap-2 text-sm text-slate-500 mt-auto">${C.avatar(r, C.pick(r, C.PEOPLE), 'w-6 h-6')}<span class="truncate">${C.pick(r, C.PEOPLE)}</span><span>·</span><span class="whitespace-nowrap">6 min</span></div>
    </article>`).join('\n    ')}
  </div>
  <section class="bg-slate-900 text-white rounded-2xl p-10 flex flex-wrap items-center justify-between gap-6">
    <div class="max-w-md flex flex-col gap-2"><h2 class="text-2xl font-bold">The weekly dispatch</h2><p class="opacity-80">${C.sentence(r, 10, 16)}</p></div>
    <form class="flex gap-2 flex-wrap"><input type="email" placeholder="you@example.com" class="px-4 py-3 rounded-lg text-slate-900" style="min-width:240px">${C.btn('Subscribe', 'secondary', 'px-5 py-3')}</form>
  </section>
</main>
${C.footer(r, { product: 'Hollis', cols: 4 })}`,
  },
  {
    id: 'p21-article-help-center', kind: 'article', font: FONTS.plain, mode: 'linked',
    prompt: 'Help center landing. Big search bar in a hero, a grid of category cards with icons and article counts, a popular-articles list, and a contact-support band at the bottom.',
    css: `.helphero{background:linear-gradient(180deg,#eef2ff,#fff);padding:4rem 1.5rem;text-align:center}
.searchbox{max-width:36rem;margin:1.5rem auto 0;display:flex;align-items:center;gap:.75rem;
  background:#fff;border:1px solid #cbd5e1;border-radius:9999px;padding:.875rem 1.25rem;box-shadow:0 4px 12px rgba(15,23,42,.06)}
.searchbox input{border:0;outline:none;flex:1;min-width:0;font-size:1rem}
.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem}`,
    build: (r) => `${C.navbar(r, { product: 'Bettermode Help', links: ['Docs', 'Community', 'Status'], cta: false })}
<section class="helphero">
  <h1 class="text-4xl font-extrabold tracking-tight">How can we help?</h1>
  <p class="text-slate-600 mt-3">${C.sentence(r, 10, 16)}</p>
  <div class="searchbox">${C.icon('search', 'w-5 h-5 text-slate-400 shrink-0')}<input placeholder="Search 340 articles…"><kbd class="text-xs text-slate-400 border rounded px-1.5 py-0.5 shrink-0">⌘K</kbd></div>
</section>
<main class="max-w-6xl mx-auto px-6 py-16 flex flex-col gap-16">
  <div class="cats">
    ${['Getting started', 'Account & billing', 'Integrations', 'Security', 'Troubleshooting', 'API & webhooks'].map((c, i) => `<a class="border rounded-xl p-6 flex flex-col gap-3 bg-white">
      <div class="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">${C.icon(C.ICON_NAMES[i % C.ICON_NAMES.length], 'w-5 h-5')}</div>
      <h2 class="font-semibold">${c}</h2><p class="text-sm text-slate-600 line-clamp-2">${C.sentence(r, 10, 18)}</p>
      <span class="text-xs text-slate-400 mt-auto">${12 + i * 7} articles</span>
    </a>`).join('\n    ')}
  </div>
  <div class="grid grid-cols-2 gap-12" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
    <div class="flex flex-col gap-4"><h2 class="text-xl font-bold">Popular articles</h2>
      <ul class="flex flex-col divide-y border rounded-xl bg-white">${[0, 1, 2, 3, 4].map(i => `<li class="px-5 py-4 flex items-center gap-3">${C.icon('doc', 'w-4 h-4 text-slate-400 shrink-0')}<span class="text-sm truncate flex-1">${C.sentence(r, 6, 12)}</span>${C.icon('arrow', 'w-4 h-4 text-slate-300 shrink-0')}</li>`).join('')}</ul>
    </div>
    <div class="flex flex-col gap-4"><h2 class="text-xl font-bold">Recently updated</h2>
      <ul class="flex flex-col divide-y border rounded-xl bg-white">${[0, 1, 2, 3, 4].map(i => `<li class="px-5 py-4 flex flex-col gap-1"><span class="text-sm font-medium line-clamp-1">${C.sentence(r, 6, 12)}</span><span class="text-xs text-slate-500">Updated ${i + 1} day${i ? 's' : ''} ago · ${C.pick(r, ['Billing', 'API', 'Security'])}</span></li>`).join('')}</ul>
    </div>
  </div>
  <section class="border rounded-2xl p-10 flex flex-wrap items-center justify-between gap-6 bg-slate-50">
    <div class="max-w-lg flex flex-col gap-2"><h2 class="text-2xl font-bold">Still stuck?</h2><p class="text-slate-600">${C.sentence(r, 10, 16)}</p></div>
    <div class="flex gap-3">${C.btn('Browse community', 'secondary', 'px-5 py-3')}${C.btn('Contact support', 'primary', 'px-5 py-3')}</div>
  </section>
</main>`,
  },

  // ============================================================ DATA TABLE (4)
  {
    id: 'p22-table-users', kind: 'table', font: FONTS.systemUi, mode: 'linked',
    prompt: 'User management table. Toolbar with search, filter chips and bulk actions, a table with checkboxes, avatars, role badges and a row menu, then pagination. Everything inside an app shell with a sidebar.',
    css: `.shell{display:flex;min-height:100vh;background:#f8fafc}
.main{flex:1;min-width:0;padding:1.5rem;display:flex;flex-direction:column;gap:1.25rem}
.chips{display:flex;gap:.5rem;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:.4rem;border:1px solid #cbd5e1;border-radius:9999px;padding:.35rem .75rem;font-size:.8125rem;background:#fff}`,
    build: (r) => `<div class="shell">
  ${C.sidebar(r, { product: 'Everstack', items: ['Home', 'Users', 'Teams', 'Roles', 'Audit', 'Settings'] })}
  <div class="main">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div><h1 class="text-2xl font-bold tracking-tight">Users</h1><p class="text-sm text-slate-500">248 members · 12 pending invites</p></div>
      <div class="flex gap-2">${C.btn('Import CSV', 'secondary', 'text-sm')}${C.btn('Invite people', 'primary', 'text-sm')}</div>
    </div>
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg w-72 max-w-full">${C.icon('search', 'w-4 h-4 text-slate-400 shrink-0')}<input class="border-0 text-sm w-full min-w-0" placeholder="Search users…" style="outline:none"></div>
      <div class="chips">${['Role: Admin', 'Status: Active', 'Region: EU'].map(c => `<span class="chip">${c}${C.icon('x', 'w-3 h-3 text-slate-400')}</span>`).join('')}<button type="button" class="chip">${C.icon('filter', 'w-3 h-3')} Add filter</button></div>
      <span class="ml-auto text-sm text-slate-500 whitespace-nowrap">3 selected</span>
      ${C.btn('Bulk edit', 'secondary', 'text-sm')}
    </div>
    <div class="border rounded-xl bg-white overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm text-left">
      <thead class="bg-slate-50 border-b"><tr>
        <th class="px-4 py-3 w-10"><input type="checkbox" checked></th>
        ${['User', 'Role', 'Teams', 'Status', 'Last active', ''].map(h => `<th class="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${Array.from({ length: 12 }, (_, i) => { const p = C.PEOPLE[i % C.PEOPLE.length]; return `<tr class="border-b">
        <td class="px-4 py-3"><input type="checkbox" ${i < 3 ? 'checked' : ''}></td>
        <td class="px-4 py-3"><div class="flex items-center gap-3 min-w-0">${C.avatar(r, p, 'w-8 h-8')}<div class="min-w-0"><div class="font-medium truncate">${C.esc(p)}</div><div class="text-xs text-slate-500 truncate">${C.esc(p.split(' ')[0].toLowerCase())}@everstack.example</div></div></div></td>
        <td class="px-4 py-3">${C.badge(['Admin', 'Member', 'Viewer'][i % 3], ['indigo', 'slate', 'slate'][i % 3])}</td>
        <td class="px-4 py-3"><div class="flex gap-1 flex-wrap">${['Platform', 'Data', 'Growth'].slice(0, (i % 3) + 1).map(t => C.badge(t, 'slate')).join('')}</div></td>
        <td class="px-4 py-3">${C.badge(i % 5 === 4 ? 'Invited' : 'Active', i % 5 === 4 ? 'amber' : 'green')}</td>
        <td class="px-4 py-3 text-slate-500 whitespace-nowrap">${i + 1}h ago</td>
        <td class="px-4 py-3 text-right"><button type="button" class="text-slate-400">${C.icon('menu', 'w-4 h-4')}</button></td>
      </tr>`; }).join('\n      ')}</tbody>
    </table></div>
    <div class="flex items-center justify-between gap-4 px-4 py-3 border-t flex-wrap">
      <span class="text-sm text-slate-500">Showing 1–12 of 248</span>
      <div class="flex gap-1">${['Previous', '1', '2', '3', '…', '21', 'Next'].map((p, i) => `<button type="button" class="px-3 py-1.5 rounded-lg text-sm ${p === '1' ? 'bg-indigo-600 text-white' : 'border'}">${p}</button>`).join('')}</div>
    </div></div>
  </div>
</div>`,
  },
  {
    id: 'p23-table-wide-scroll', kind: 'table', font: FONTS.mono, mode: 'inline',
    prompt: 'Wide financial data grid with 14 columns that must scroll horizontally, a frozen first column, right-aligned numeric cells in a monospace font, and a totals footer row.',
    css: `body{font-size:13px}
.gridwrap{border:1px solid #e2e8f0;border-radius:.5rem;overflow:auto;max-height:70vh;background:#fff}
table{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%}
th,td{padding:.55rem .85rem;border-bottom:1px solid #f1f5f9;white-space:nowrap}
thead th{position:sticky;top:0;background:#f8fafc;z-index:2;font-weight:600;text-align:right;border-bottom:1px solid #e2e8f0}
thead th:first-child,tbody td:first-child{position:sticky;left:0;background:#fff;z-index:1;text-align:left;border-right:1px solid #e2e8f0}
thead th:first-child{z-index:3;background:#f8fafc}
td{text-align:right;font-variant-numeric:tabular-nums}
tfoot td{position:sticky;bottom:0;background:#f8fafc;font-weight:700;border-top:1px solid #e2e8f0}
tfoot td:first-child{z-index:2}`,
    build: (r) => {
      const cols = ['Account', 'Q1 actual', 'Q1 plan', 'Δ', 'Q2 actual', 'Q2 plan', 'Δ', 'Q3 actual', 'Q3 plan', 'Δ', 'Q4 fcst', 'FY actual', 'FY plan', 'Variance %'];
      const rows = ['Subscription revenue', 'Services revenue', 'Cost of revenue', 'Gross profit', 'Sales & marketing', 'Research & development', 'General & admin', 'Operating income', 'Interest & other', 'Net income'];
      return `<div class="p-6 flex flex-col gap-4 bg-slate-50 min-h-screen">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div><h1 class="text-xl font-bold">FY2026 plan vs actual</h1><p class="text-slate-500">Consolidated · USD thousands · updated 14 Mar</p></div>
    <div class="flex gap-2">${C.btn('Columns', 'secondary', 'text-sm')}${C.btn('Export XLSX', 'secondary', 'text-sm')}${C.btn('Share', 'primary', 'text-sm')}</div>
  </div>
  <div class="gridwrap"><table>
    <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((rw, i) => `<tr><td>${rw}</td>${cols.slice(1).map((_, j) => `<td class="${(i * 7 + j) % 9 === 4 ? 'text-rose-600' : ''}">${((i + 1) * (j + 3) * 137 % 9000 + 210).toLocaleString('en-US')}</td>`).join('')}</tr>`).join('\n    ')}</tbody>
    <tfoot><tr><td>Total</td>${cols.slice(1).map((_, j) => `<td>${((j + 2) * 4831 % 40000 + 12000).toLocaleString('en-US')}</td>`).join('')}</tr></tfoot>
  </table></div>
  <p class="text-xs text-slate-500">Figures are unaudited. ${C.sentence(r, 10, 16)}</p>
</div>`;
    },
  },
  {
    id: 'p24-table-inbox', kind: 'table', font: FONTS.apple, mode: 'linked',
    prompt: 'Three-pane inbox layout: folder list, message list in the middle with unread indicators and truncated previews, and a reading pane on the right. Each pane scrolls independently and the whole thing fills the viewport.',
    css: `.inbox{display:grid;grid-template-columns:220px 340px minmax(0,1fr);height:100vh;overflow:hidden}
.pane{overflow-y:auto;border-right:1px solid #e2e8f0}
.pane:last-child{border-right:0}
.msg{padding:.9rem 1rem;border-bottom:1px solid #f1f5f9;display:flex;flex-direction:column;gap:.25rem;cursor:pointer}
.msg.unread{background:#fff}.msg.on{background:#eef2ff}
@media (max-width:1000px){.inbox{grid-template-columns:1fr}}`,
    build: (r) => `<div class="inbox">
  <nav class="pane bg-slate-50 p-3 flex flex-col gap-1">
    <div class="px-2 py-3 font-semibold flex items-center gap-2">${C.icon('box', 'w-5 h-5 text-indigo-600')}Inbox</div>
    ${C.btn('Compose', 'primary', 'w-full text-sm mb-2')}
    ${[['Inbox', 24], ['Starred', 3], ['Snoozed', 0], ['Sent', 0], ['Drafts', 2], ['Archive', 0], ['Spam', 11], ['Trash', 0]].map(([l, n], i) => `<a class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${i === 0 ? 'bg-white font-medium' : 'text-slate-600'}">${C.icon(C.ICON_NAMES[i % C.ICON_NAMES.length], 'w-4 h-4 shrink-0')}<span class="truncate flex-1">${l}</span>${n ? `<span class="text-xs text-slate-500">${n}</span>` : ''}</a>`).join('\n    ')}
  </nav>
  <div class="pane">
    <div class="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-2 z-10">
      <input type="checkbox"><span class="text-sm font-medium">Inbox</span><span class="ml-auto text-xs text-slate-500">24 unread</span>
    </div>
    ${Array.from({ length: 14 }, (_, i) => { const p = C.PEOPLE[i % C.PEOPLE.length]; return `<article class="msg ${i === 2 ? 'on' : i < 6 ? 'unread' : ''}">
      <div class="flex items-center gap-2">
        ${i < 6 ? '<span class="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>' : '<span class="w-2 h-2 shrink-0"></span>'}
        <span class="text-sm ${i < 6 ? 'font-semibold' : ''} truncate flex-1">${C.esc(p)}</span>
        <span class="text-xs text-slate-400 whitespace-nowrap shrink-0">${i + 1}:0${i % 6} PM</span>
      </div>
      <span class="text-sm truncate pl-4">${C.sentence(r, 5, 9)}</span>
      <span class="text-xs text-slate-500 line-clamp-2 pl-4">${C.sentence(r, 14, 24)}</span>
    </article>`; }).join('\n    ')}
  </div>
  <div class="pane">
    <div class="sticky top-0 bg-white border-b px-6 py-4 flex items-start gap-4 z-10">
      <div class="min-w-0 flex-1"><h1 class="text-lg font-semibold truncate">${C.sentence(r, 5, 9)}</h1><p class="text-sm text-slate-500 truncate">${C.pick(r, C.PEOPLE)} to me, ${C.pick(r, C.PEOPLE)} · 2:04 PM</p></div>
      <div class="flex gap-1 text-slate-400 shrink-0">${C.some(r, C.ICON_NAMES, 4).map(i => `<button type="button" class="p-2">${C.icon(i, 'w-4 h-4')}</button>`).join('')}</div>
    </div>
    <div class="px-6 py-6 flex flex-col gap-4 leading-relaxed text-slate-700" style="max-width:44rem">
      ${[0, 1, 2, 3, 4].map(() => `<p>${C.paragraph(r, 3)}</p>`).join('\n      ')}
      <div class="border rounded-xl p-4 flex items-center gap-3">${C.icon('doc', 'w-8 h-8 text-slate-400 shrink-0')}<div class="min-w-0"><div class="text-sm font-medium truncate">Q1-forecast-consolidated-final-v3.xlsx</div><div class="text-xs text-slate-500">248 KB</div></div>${C.btn('Download', 'secondary', 'text-sm ml-auto shrink-0')}</div>
      <div class="flex gap-2 pt-2">${C.btn('Reply', 'primary')}${C.btn('Forward', 'secondary')}</div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'p25-table-catalog', kind: 'table', font: FONTS.systemUi, mode: 'inline',
    prompt: 'E-commerce product catalog: filter sidebar on the left with checkboxes and a price range, product cards in a responsive grid with badges and star ratings, sort dropdown and result count above.',
    css: `.catalog{display:grid;grid-template-columns:260px minmax(0,1fr);gap:2rem;max-width:80rem;margin:0 auto;padding:2rem 1.5rem}
.filters{position:sticky;top:1.5rem;align-self:start;display:flex;flex-direction:column;gap:1.5rem}
.fgroup{display:flex;flex-direction:column;gap:.6rem;padding-bottom:1.25rem;border-bottom:1px solid #e2e8f0}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.5rem}
.pcard{display:flex;flex-direction:column;gap:.6rem;position:relative}
@media (max-width:820px){.catalog{grid-template-columns:1fr}.filters{position:static}}`,
    build: (r) => `${C.navbar(r, { product: 'Quarry', links: ['Shop', 'Collections', 'Journal'], cta: false })}
<div class="catalog">
  <aside class="filters">
    <div class="fgroup"><h2 class="font-semibold text-sm">Category</h2>
      ${['Desks', 'Seating', 'Lighting', 'Storage', 'Textiles'].map((c, i) => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" ${i < 2 ? 'checked' : ''}><span class="flex-1">${c}</span><span class="text-xs text-slate-400">${12 + i * 9}</span></label>`).join('\n      ')}
    </div>
    <div class="fgroup"><h2 class="font-semibold text-sm">Price</h2>
      <input type="range" min="0" max="2000" value="900" class="w-full">
      <div class="flex items-center gap-2"><input type="number" value="0" class="w-full min-w-0 px-2 py-1.5 border rounded text-sm"><span class="text-slate-400">–</span><input type="number" value="900" class="w-full min-w-0 px-2 py-1.5 border rounded text-sm"></div>
    </div>
    <div class="fgroup"><h2 class="font-semibold text-sm">Material</h2>
      ${['Oak', 'Walnut', 'Steel', 'Linen'].map(c => `<label class="flex items-center gap-2 text-sm"><input type="checkbox"><span>${c}</span></label>`).join('\n      ')}
    </div>
    <div class="fgroup" style="border-bottom:0"><h2 class="font-semibold text-sm">Availability</h2>
      ${C.formFields(r, { kinds: ['switch'] })}
    </div>
  </aside>
  <main class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div><h1 class="text-2xl font-bold tracking-tight">Workspace</h1><p class="text-sm text-slate-500">64 products</p></div>
      <label class="flex items-center gap-2 text-sm"><span class="text-slate-500 whitespace-nowrap">Sort by</span><select class="px-3 py-2 border rounded-lg"><option>Featured</option><option>Price: low to high</option><option>Newest</option></select></label>
    </div>
    <div class="products">
      ${Array.from({ length: 12 }, (_, i) => `<article class="pcard">
        ${i % 4 === 0 ? `<span class="absolute top-2 left-2 z-10">${C.badge('Sale', 'red')}</span>` : ''}
        ${C.placeholder(r, 'aspect-square')}
        <div class="flex items-start justify-between gap-2"><h3 class="font-medium leading-tight">${C.pick(r, C.PRODUCTS)} ${C.pick(r, ['Desk', 'Chair', 'Lamp', 'Shelf', 'Rug'])}</h3><button type="button" class="text-slate-300 shrink-0">${C.icon('star', 'w-4 h-4')}</button></div>
        <div class="flex items-center gap-1 text-amber-600">${[0, 1, 2, 3, 4].map(() => C.icon('star', 'w-3 h-3')).join('')}<span class="text-xs text-slate-500 ml-1">(${18 + i * 4})</span></div>
        <div class="flex items-baseline gap-2"><span class="font-semibold">$${180 + i * 47}</span>${i % 4 === 0 ? `<span class="text-sm text-slate-400" style="text-decoration:line-through">$${240 + i * 47}</span>` : ''}</div>
      </article>`).join('\n      ')}
    </div>
    <div class="flex justify-center gap-1 pt-4">${['1', '2', '3', '4', '5', 'Next'].map(p => `<button type="button" class="px-3 py-1.5 rounded-lg text-sm ${p === '1' ? 'bg-slate-900 text-white' : 'border'}">${p}</button>`).join('')}</div>
  </main>
</div>
${C.footer(r, { product: 'Quarry', cols: 4 })}`,
  },

  // ============================================================ MODAL / OVERLAY (3)
  {
    id: 'p26-modal-invite', kind: 'modal', font: FONTS.systemUi, mode: 'linked',
    prompt: 'Dashboard page with a modal dialog open on top of it. Dimmed backdrop, centered dialog with a header, scrollable body containing a form, and a footer with cancel/confirm. Toast notifications stacked in the bottom-right corner.',
    css: `.shell{display:flex;min-height:100vh;background:#f8fafc}
.main{flex:1;min-width:0;padding:1.5rem;display:flex;flex-direction:column;gap:1.5rem}`,
    build: (r) => `<div class="shell">
  ${C.sidebar(r, { product: 'Northwind', items: ['Overview', 'Team', 'Projects', 'Alerts', 'Settings'] })}
  <div class="main">
    <div class="flex items-center justify-between flex-wrap gap-3"><h1 class="text-2xl font-bold tracking-tight">Team</h1>${C.btn('Invite people', 'primary', 'text-sm')}</div>
    ${C.statCards(r, { n: 3 })}
    ${C.dataTable(r, { rows: 8 })}
  </div>
</div>
${C.modal(r, { size: 'max-w-lg', withForm: true })}
${C.toasts(r, { n: 3 })}`,
  },
  {
    id: 'p27-modal-drawer', kind: 'modal', font: FONTS.apple, mode: 'inline',
    prompt: 'Right-hand slide-over drawer open over a data table. The drawer is full height, has a header with a close button, a scrollable detail body with a definition list and an activity timeline, and a sticky action footer. Also show an open dropdown menu in the page behind it.',
    css: `.drawer{position:fixed;top:0;right:0;bottom:0;width:min(480px,100%);background:#fff;
  box-shadow:-16px 0 40px rgba(15,23,42,.12);display:flex;flex-direction:column;z-index:60}
.drawer-body{flex:1;overflow-y:auto;padding:1.5rem;display:flex;flex-direction:column;gap:1.5rem}
.scrim{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:50}
.dropdown{position:absolute;top:calc(100% + .5rem);right:0;width:220px;background:#fff;border:1px solid #e2e8f0;
  border-radius:.75rem;box-shadow:0 12px 24px rgba(15,23,42,.12);padding:.35rem;z-index:40}
.dropdown a{display:flex;align-items:center;gap:.6rem;padding:.5rem .65rem;border-radius:.5rem;font-size:.875rem;color:#334155}
.timeline{display:flex;flex-direction:column;gap:0}
.timeline li{display:flex;gap:.9rem;padding-bottom:1.25rem;position:relative}
.timeline li::before{content:"";position:absolute;left:11px;top:24px;bottom:0;width:1px;background:#e2e8f0}
.timeline li:last-child::before{display:none}`,
    build: (r) => `<div class="min-h-screen bg-slate-50">
  ${C.navbar(r, { product: 'Anchorage', links: ['Deployments', 'Services', 'Logs'], cta: false })}
  <main class="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-5">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <h1 class="text-2xl font-bold tracking-tight">Deployments</h1>
      <div class="relative">${C.btn('Actions ' + C.icon('chevron', 'w-4 h-4'), 'secondary', 'text-sm')}
        <div class="dropdown">${[['gear', 'Configure'], ['doc', 'View manifest'], ['bolt', 'Redeploy'], ['trash', 'Delete']].map(([ic, l]) => `<a>${C.icon(ic, 'w-4 h-4 text-slate-400')}${l}</a>`).join('')}</div>
      </div>
    </div>
    ${C.dataTable(r, { rows: 10 })}
  </main>
</div>
<div class="scrim"></div>
<aside class="drawer">
  <header class="px-6 py-5 border-b flex items-start justify-between gap-4">
    <div class="min-w-0"><div class="flex items-center gap-2 mb-1"><h2 class="text-lg font-semibold truncate">meridian-ingest</h2>${C.badge('Healthy', 'green')}</div><p class="text-sm text-slate-500 truncate">Deployed 14 minutes ago by ${C.pick(r, C.PEOPLE)}</p></div>
    <button type="button" class="p-2 text-slate-400 shrink-0">${C.icon('x', 'w-5 h-5')}</button>
  </header>
  <div class="drawer-body">
    <dl class="flex flex-col gap-0">${[['Environment', 'production'], ['Region', 'eu-central-1'], ['Image', 'ghcr.io/everstack/ingest:2026.9.1'], ['Replicas', '6 / 6'], ['CPU request', '500m'], ['Memory limit', '2 Gi']].map(([k, v]) => `<div class="flex justify-between gap-4 py-2 border-b text-sm"><dt class="text-slate-500 shrink-0">${k}</dt><dd class="m-0 font-mono truncate">${C.esc(v)}</dd></div>`).join('')}</dl>
    <div class="flex flex-col gap-3"><h3 class="font-semibold text-sm">Timeline</h3>
      <ul class="timeline">${[0, 1, 2, 3, 4].map(i => `<li>
        <span class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 z-10">${C.icon(['check', 'bolt', 'gear', 'users', 'bell'][i], 'w-3 h-3 text-slate-500')}</span>
        <div class="min-w-0"><p class="text-sm">${C.sentence(r, 6, 12)}</p><p class="text-xs text-slate-500 mt-1">${i + 1}h ago · ${C.pick(r, C.PEOPLE)}</p></div>
      </li>`).join('\n      ')}</ul>
    </div>
    ${C.formFields(r, { kinds: ['textarea'] })}
  </div>
  <footer class="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">${C.btn('Roll back', 'secondary')}${C.btn('Redeploy', 'primary')}</footer>
</aside>`,
  },
  {
    id: 'p28-modal-command-palette', kind: 'modal', font: FONTS.inter, mode: 'linked',
    prompt: 'Command palette open over a docs page. Blurred backdrop, a centered search box near the top with grouped results, keyboard-shortcut hints on the right of each row, and a footer strip with navigation hints. Also include a tooltip and a cookie banner.',
    css: `.palette-scrim{position:fixed;inset:0;background:rgba(15,23,42,.4);backdrop-filter:blur(4px);z-index:60;
  display:flex;justify-content:center;align-items:flex-start;padding-top:12vh}
.palette{width:min(560px,100%);background:#fff;border-radius:.9rem;box-shadow:0 24px 60px rgba(15,23,42,.28);
  display:flex;flex-direction:column;overflow:hidden;max-height:60vh}
.palette-input{display:flex;align-items:center;gap:.75rem;padding:1rem 1.25rem;border-bottom:1px solid #e2e8f0}
.palette-input input{border:0;outline:none;flex:1;min-width:0;font-size:1rem}
.palette-list{overflow-y:auto;padding:.5rem}
.prow{display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;border-radius:.5rem;font-size:.875rem}
.prow.on{background:#eef2ff}
kbd{border:1px solid #cbd5e1;border-bottom-width:2px;border-radius:.35rem;padding:.1rem .4rem;font-size:.7rem;font-family:inherit}
.cookie{position:fixed;left:1.5rem;bottom:1.5rem;z-index:70;max-width:420px;background:#0f172a;color:#fff;
  border-radius:.9rem;padding:1.25rem;display:flex;flex-direction:column;gap:.9rem}
.tip{position:absolute;top:-2.25rem;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;
  font-size:.75rem;padding:.35rem .6rem;border-radius:.4rem;white-space:nowrap}`,
    build: (r) => `<div class="min-h-screen">
  ${C.navbar(r, { product: 'Lumen Docs', links: ['Guides', 'API', 'Examples'], cta: false })}
  <div class="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-5">
    <h1 class="text-3xl font-bold tracking-tight">Query language reference</h1>
    <div class="relative inline-flex" style="align-self:flex-start">${C.btn('Copy page ' + C.icon('doc', 'w-4 h-4'), 'secondary', 'text-sm')}<span class="tip">Copied to clipboard</span></div>
    ${C.prose(r, { paras: 6, withImage: false })}
  </div>
</div>
<div class="palette-scrim"><div class="palette">
  <div class="palette-input">${C.icon('search', 'w-5 h-5 text-slate-400 shrink-0')}<input value="depl" aria-label="Command"><kbd>ESC</kbd></div>
  <div class="palette-list">
    ${[['Recent', [['doc', 'Deploying to production', '⏎'], ['gear', 'Deployment settings', '']]], ['Actions', [['bolt', 'Create deployment', '⌘D'], ['box', 'Roll back last deploy', ''], ['users', 'Invite teammate', '⌘I']]], ['Documentation', [['doc', 'Deployment targets', ''], ['doc', 'Deploy hooks and webhooks', ''], ['doc', 'Zero-downtime deploys', '']]]].map(([g, rows]) => `<div class="px-2 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-400">${g}</div>${rows.map(([ic, l, k], i) => `<div class="prow ${g === 'Recent' && i === 0 ? 'on' : ''}">${C.icon(ic, 'w-4 h-4 text-slate-400 shrink-0')}<span class="flex-1 truncate">${l}</span>${k ? `<kbd>${k}</kbd>` : ''}</div>`).join('')}`).join('\n    ')}
  </div>
  <div class="px-4 py-3 border-t bg-slate-50 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
    <span class="flex items-center gap-1"><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span class="flex items-center gap-1"><kbd>⏎</kbd> select</span><span class="flex items-center gap-1"><kbd>ESC</kbd> close</span>
  </div>
</div></div>
<div class="cookie">
  <p class="text-sm leading-relaxed opacity-90">${C.sentence(r, 14, 22)}</p>
  <div class="flex gap-2 flex-wrap">${C.btn('Accept all', 'secondary', 'text-sm')}${C.btn('Reject', 'ghost', 'text-sm text-white')}${C.btn('Preferences', 'ghost', 'text-sm text-white')}</div>
</div>`,
  },

  // ============================================================ NAV SHELL (2)
  {
    id: 'p29-nav-megamenu', kind: 'nav', font: FONTS.systemUi, mode: 'linked',
    prompt: 'Marketing site header with an open mega menu: four columns of links with icons and descriptions, a featured card on the right, and a promo strip along the bottom of the panel. Page content behind is a simple hero.',
    css: `.mega{position:absolute;top:100%;left:0;right:0;background:#fff;border-bottom:1px solid #e2e8f0;
  box-shadow:0 24px 40px rgba(15,23,42,.08);z-index:50}
.mega-inner{max-width:80rem;margin:0 auto;padding:2.5rem 1.5rem;display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr)) 300px;gap:2.5rem}
.mega-link{display:flex;gap:.75rem;padding:.5rem;border-radius:.5rem}
.promo{border-top:1px solid #e2e8f0;background:#f8fafc}
.promo-inner{max-width:80rem;margin:0 auto;padding:1rem 1.5rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
@media (max-width:1000px){.mega-inner{grid-template-columns:1fr 1fr}}`,
    build: (r) => `<div class="relative">
  <header class="border-b bg-white relative" style="z-index:51">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
      <a class="flex items-center gap-2 font-semibold shrink-0">${C.icon('box', 'w-6 h-6 text-indigo-600')}Northwind</a>
      <nav class="flex items-center gap-6 text-sm">
        <button type="button" class="flex items-center gap-1 text-indigo-600 font-medium border-0 bg-transparent">Platform ${C.icon('chevron', 'w-4 h-4')}</button>
        ${['Solutions', 'Developers', 'Pricing', 'Company'].map(l => `<a class="text-slate-600 whitespace-nowrap">${l}</a>`).join('')}
      </nav>
      <div class="ml-auto flex items-center gap-3">${C.btn('Sign in', 'ghost', 'text-sm')}${C.btn('Get a demo', 'primary', 'text-sm')}</div>
    </div>
  </header>
  <div class="mega">
    <div class="mega-inner">
      ${[['Build', ['Pipelines', 'Transforms', 'Schedules', 'Secrets']], ['Observe', ['Metrics', 'Traces', 'Alerting', 'SLOs']], ['Govern', ['Access control', 'Audit log', 'Data residency', 'Retention']]].map(([g, links]) => `<div class="flex flex-col gap-1">
        <span class="text-xs uppercase tracking-wide text-slate-400 px-2 mb-1">${g}</span>
        ${links.map((l, i) => `<a class="mega-link"><span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">${C.icon(C.ICON_NAMES[i % C.ICON_NAMES.length], 'w-4 h-4')}</span><span class="min-w-0"><span class="block text-sm font-medium">${l}</span><span class="block text-xs text-slate-500 line-clamp-2">${C.sentence(r, 6, 11)}</span></span></a>`).join('\n        ')}
      </div>`).join('\n      ')}
      <div class="flex flex-col gap-3 bg-slate-50 rounded-xl p-5">
        ${C.placeholder(r, 'aspect-video')}
        ${C.badge('New', 'indigo')}
        <h3 class="font-semibold leading-tight">${C.sentence(r, 5, 9)}</h3>
        <p class="text-sm text-slate-600 line-clamp-3">${C.sentence(r, 14, 22)}</p>
        <a class="text-sm font-medium text-indigo-600 mt-auto">Read the announcement →</a>
      </div>
    </div>
    <div class="promo"><div class="promo-inner">
      ${C.icon('bolt', 'w-5 h-5 text-indigo-600 shrink-0')}
      <span class="text-sm flex-1 min-w-0">${C.sentence(r, 10, 16)}</span>
      <a class="text-sm font-medium text-indigo-600 whitespace-nowrap">See what's new →</a>
    </div></div>
  </div>
  <main class="max-w-4xl mx-auto px-6 text-center flex flex-col items-center gap-6" style="padding-top:6rem;padding-bottom:6rem">
    <h1 class="text-5xl font-extrabold tracking-tight text-balance">One platform for every data path</h1>
    <p class="text-xl text-slate-600">${C.sentence(r, 14, 22)}</p>
    <div class="flex gap-3 flex-wrap justify-center">${C.btn('Start free', 'primary', 'px-5 py-3')}${C.btn('Talk to us', 'secondary', 'px-5 py-3')}</div>
  </main>
</div>`,
  },
  {
    id: 'p30-nav-app-shell', kind: 'nav', font: FONTS.plain, mode: 'inline',
    prompt: 'Application shell with a collapsed icon-only rail on the far left, a secondary nav column next to it, a top bar with breadcrumbs and a workspace switcher, tabs under the top bar, and a placeholder content area. A mobile drawer overlay is also visible.',
    css: `.app{display:grid;grid-template-columns:64px 240px minmax(0,1fr);height:100vh;overflow:hidden}
.rail{background:#0f172a;color:#94a3b8;display:flex;flex-direction:column;align-items:center;gap:.5rem;padding:.75rem 0}
.rail a{width:40px;height:40px;border-radius:.6rem;display:grid;place-items:center}
.rail a.on{background:#1e293b;color:#fff}
.subnav{border-right:1px solid #e2e8f0;display:flex;flex-direction:column;overflow-y:auto;background:#f8fafc}
.content{display:flex;flex-direction:column;min-width:0;overflow:hidden}
.canvas{flex:1;overflow:auto;padding:1.5rem;background:#f8fafc}
.mobile-drawer{position:fixed;top:0;left:0;bottom:0;width:300px;background:#fff;z-index:80;
  box-shadow:16px 0 40px rgba(15,23,42,.14);display:flex;flex-direction:column}
.mobile-scrim{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:79}`,
    build: (r) => `<div class="app">
  <nav class="rail">
    <a class="on">${C.icon('box', 'w-5 h-5')}</a>
    ${['chart', 'users', 'doc', 'bell', 'gear'].map(i => `<a>${C.icon(i, 'w-5 h-5')}</a>`).join('')}
    <span style="flex:1"></span>
    ${C.avatar(r, C.pick(r, C.PEOPLE), 'w-9 h-9')}
  </nav>
  <div class="subnav">
    <div class="px-4 h-16 flex items-center gap-2 border-b shrink-0">
      <div class="min-w-0 flex-1"><div class="text-sm font-semibold truncate">Everstack</div><div class="text-xs text-slate-500 truncate">Business · 25 seats</div></div>
      ${C.icon('chevron', 'w-4 h-4 text-slate-400 shrink-0')}
    </div>
    <div class="p-3 flex flex-col gap-4">
      ${[['Workspace', ['Overview', 'Activity', 'Insights']], ['Data', ['Sources', 'Pipelines', 'Destinations', 'Schemas']], ['Admin', ['Members', 'Roles', 'Billing']]].map(([g, items]) => `<div class="flex flex-col gap-1">
        <span class="text-xs uppercase tracking-wide text-slate-400 px-3">${g}</span>
        ${items.map((it, i) => `<a class="px-3 py-2 rounded-lg text-sm ${g === 'Data' && i === 1 ? 'bg-white border font-medium' : 'text-slate-600'} truncate">${it}</a>`).join('\n        ')}
      </div>`).join('\n      ')}
    </div>
  </div>
  <div class="content">
    <header class="h-16 border-b flex items-center gap-4 px-6 shrink-0">
      ${C.breadcrumb(r, ['Everstack', 'Data', 'Pipelines'])}
      <div class="ml-auto flex items-center gap-3">
        <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">${C.icon('search', 'w-4 h-4 text-slate-400')}<span class="text-sm text-slate-400">Search</span><kbd class="text-xs text-slate-400">⌘K</kbd></div>
        ${C.btn('New pipeline', 'primary', 'text-sm')}
      </div>
    </header>
    <div class="px-6 shrink-0">${C.tabs(r, ['All', 'Running', 'Failed', 'Drafts', 'Archived'], 1)}</div>
    <div class="canvas flex flex-col gap-4">
      ${C.statCards(r, { n: 4, layout: 'flex' })}
      ${C.dataTable(r, { rows: 9, sticky: true })}
    </div>
  </div>
</div>
<div class="mobile-scrim"></div>
<aside class="mobile-drawer">
  <div class="h-16 px-4 flex items-center justify-between border-b"><span class="font-semibold flex items-center gap-2">${C.icon('box', 'w-5 h-5 text-indigo-600')}Everstack</span><button type="button" class="p-2 text-slate-400">${C.icon('x', 'w-5 h-5')}</button></div>
  <nav class="p-3 flex flex-col gap-1 overflow-y-auto">
    ${['Overview', 'Activity', 'Sources', 'Pipelines', 'Destinations', 'Members', 'Billing', 'Settings'].map((it, i) => `<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${i === 3 ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-600'}">${C.icon(C.ICON_NAMES[i % C.ICON_NAMES.length], 'w-4 h-4 shrink-0')}<span class="truncate">${it}</span></a>`).join('\n    ')}
  </nav>
  <div class="mt-auto p-3 border-t flex items-center gap-3">${C.avatar(r, C.pick(r, C.PEOPLE), 'w-9 h-9')}<div class="min-w-0"><div class="text-sm font-medium truncate">${C.pick(r, C.PEOPLE)}</div><div class="text-xs text-slate-500 truncate">Signed in</div></div></div>
</aside>`,
  },
];

export const KIND_MIX = SPECS.reduce((a, s) => (a[s.kind] = (a[s.kind] || 0) + 1, a), {});
