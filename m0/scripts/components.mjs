// Component library for the M0 corpus generator.
//
// Everything here is a pure string builder. There is no Math.random(), no Date,
// no setTimeout and no animation: a page that disagrees with itself between two
// loads is indistinguishable from a page where the engines disagree, and the
// research fixtures already demonstrated that (a live clock in cases.html makes
// the funnel report 17 or 18 findings at random). Determinism is a correctness
// requirement of the study, not a style preference.

/** Deterministic 32-bit LCG so content varies per page but never per run. */
export function rng(seedStr) {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) { s ^= seedStr.charCodeAt(i); s = Math.imul(s, 16777619) >>> 0; }
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export const some = (r, arr, n) => { const c = [...arr], o = []; for (let i = 0; i < n && c.length; i++) o.push(c.splice(Math.floor(r() * c.length), 1)[0]); return o; };
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- content pools
export const WORDS = ['orchestration','throughput','latency','pipeline','ingestion','observability','provisioning','allocation','retention','segmentation','normalization','replication','federation','indexing','entitlement','reconciliation','attribution','forecasting'];
export const PRODUCTS = ['Northwind','Halyard','Cadence','Meridian','Kestrel','Lumen','Basalt','Torrent','Verdant','Anchorage','Slipstream','Quarry'];
export const PEOPLE = ['Amara Osei','Jonas Lindqvist','Priya Raghunathan','Diego Fuentes','Mei-Ling Chen','Tobias Brandt','Nadia Haddad','Ruben Oyelaran','Sofia Marchetti','Hiroshi Tanaka','Elena Volkova','Kwame Boateng'];
export const ROLES = ['Staff Engineer','VP Platform','Head of Data','Principal Designer','Engineering Manager','CTO','Site Reliability Lead','Product Lead'];
export const COMPANIES = ['Arclight','Bettermode','Corveta','Dunlin Labs','Everstack','Fathom','Gridline','Hollis & Co.'];
export const CITIES = ['Lisbon','Toronto','Osaka','Nairobi','Rotterdam','Austin','Tallinn','Medellín'];

export function lorem(r, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(pick(r, WORDS));
  const s = out.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
export function sentence(r, min = 8, max = 18) { return lorem(r, min + Math.floor(r() * (max - min))); }
export function paragraph(r, sentences = 4) { const o = []; for (let i = 0; i < sentences; i++) o.push(sentence(r)); return o.join(' '); }

// ---------------------------------------------------------------- icons
// 24x24 stroke icons in the idiom every model emits (lucide/heroicons shape).
// These exist so the corpus exercises the SVG-interior suppression rule at a
// realistic frequency rather than an invented one.
const ICON_PATHS = {
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a5 5 0 015-5h4a5 5 0 015 5v2"/><path d="M17 3.5a4 4 0 010 7"/>',
  bolt: '<path d="M13 2L4.5 13H11l-1 9 8.5-11H12z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  doc: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v10"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18"/>',
  star: '<path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  filter: '<path d="M3 4h18l-7 8v7l-4 2v-9z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
};
export function icon(name, cls = 'w-5 h-5', stroke = 1.75) {
  const p = ICON_PATHS[name] || ICON_PATHS.box;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
export const ICON_NAMES = Object.keys(ICON_PATHS);

/** Gradient/pattern placeholder standing in for an <img>. No network in the corpus. */
export function placeholder(r, cls = 'aspect-video', label = '') {
  const a = pick(r, ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6']);
  const b = pick(r, ['#1e293b', '#0f172a', '#334155', '#4c1d95', '#064e3b']);
  return `<div class="${cls} rounded-lg overflow-hidden relative" style="background:linear-gradient(135deg,${a},${b})">
      ${label ? `<span class="absolute bottom-0 left-0 px-3 py-2 text-xs text-white opacity-80">${esc(label)}</span>` : ''}
    </div>`;
}

export function avatar(r, name, size = 'w-10 h-10') {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2);
  const c = pick(r, ['#4f46e5', '#0891b2', '#059669', '#d97706', '#be123c', '#7c3aed']);
  return `<div class="${size} rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0" style="background:${c}">${esc(initials)}</div>`;
}

export function badge(text, tone = 'slate') {
  const tones = { slate: 'bg-slate-100 text-slate-600', green: 'bg-emerald-50 text-emerald-600', red: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', indigo: 'bg-indigo-50 text-indigo-600' };
  return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tones[tone] || tones.slate}">${esc(text)}</span>`;
}

export function btn(text, variant = 'primary', extra = '') {
  const v = {
    primary: 'bg-indigo-600 text-white',
    secondary: 'bg-white text-slate-700 border',
    ghost: 'bg-transparent text-slate-600',
    dark: 'bg-slate-900 text-white',
  }[variant] || 'bg-indigo-600 text-white';
  return `<button type="button" class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${v} ${extra}">${text}</button>`;
}

// ---------------------------------------------------------------- sections
export function navbar(r, { sticky = true, product, links, cta = true, blur = false } = {}) {
  return `<header class="${sticky ? 'sticky top-0 z-30' : ''} ${blur ? 'backdrop-blur' : 'bg-white'} border-b">
  <div class="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
    <a class="flex items-center gap-2 font-semibold shrink-0">${icon('box', 'w-6 h-6 text-indigo-600')}<span>${esc(product)}</span></a>
    <nav class="flex items-center gap-6 text-sm text-slate-600">
      ${links.map(l => `<a class="whitespace-nowrap">${esc(l)}</a>`).join('\n      ')}
    </nav>
    <div class="ml-auto flex items-center gap-3">
      ${cta ? `<a class="text-sm text-slate-600 whitespace-nowrap">Sign in</a>${btn('Get started', 'primary')}` : `<a class="text-sm text-slate-600">Docs</a>`}
    </div>
  </div>
</header>`;
}

export function hero(r, { product, headline, sub, layout = 'center' } = {}) {
  const cta = `<div class="flex flex-wrap items-center gap-3 ${layout === 'center' ? 'justify-center' : ''}">
      ${btn('Start free trial', 'primary', 'px-5 py-3')}
      ${btn(`${icon('arrow', 'w-4 h-4')} Book a demo`, 'secondary', 'px-5 py-3')}
    </div>`;
  if (layout === 'split') {
    return `<section class="max-w-7xl mx-auto px-6 py-20 grid grid-cols-2 gap-12 items-center">
  <div class="flex flex-col gap-6">
    ${badge('New — ' + pick(r, WORDS) + ' engine', 'indigo')}
    <h1 class="text-5xl font-extrabold tracking-tight text-balance">${esc(headline)}</h1>
    <p class="text-lg text-slate-600 leading-relaxed">${esc(sub)}</p>
    ${cta}
    <p class="text-sm text-slate-500">No credit card required · SOC 2 Type II</p>
  </div>
  ${placeholder(r, 'aspect-video shadow-xl', product + ' dashboard')}
</section>`;
  }
  return `<section class="px-6 py-20 text-center">
  <div class="max-w-3xl mx-auto flex flex-col gap-6 items-center">
    ${badge('Backed by ' + pick(r, COMPANIES), 'indigo')}
    <h1 class="text-6xl font-extrabold tracking-tight text-balance">${esc(headline)}</h1>
    <p class="text-xl text-slate-600 leading-relaxed">${esc(sub)}</p>
    ${cta}
  </div>
  <div class="max-w-5xl mx-auto mt-12">${placeholder(r, 'aspect-video shadow-xl', '')}</div>
</section>`;
}

export function logoCloud(r) {
  return `<section class="px-6 py-12 border-t border-b bg-slate-50">
  <p class="text-center text-xs uppercase tracking-wide text-slate-500 mb-8">Trusted by teams at</p>
  <div class="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-12 opacity-60">
    ${COMPANIES.slice(0, 6).map(c => `<div class="flex items-center gap-2 font-semibold text-slate-700">${icon(pick(r, ICON_NAMES), 'w-5 h-5')}<span class="whitespace-nowrap">${esc(c)}</span></div>`).join('\n    ')}
  </div>
</section>`;
}

export function featureGrid(r, { cols = 'auto-fit-280', n = 6, title = 'Everything you need' } = {}) {
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push(`<div class="p-6 rounded-xl border bg-white flex flex-col gap-3">
      <div class="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">${icon(pick(r, ICON_NAMES), 'w-5 h-5')}</div>
      <h3 class="text-lg font-semibold">${esc(pick(r, WORDS).replace(/^./, c => c.toUpperCase()))} ${esc(pick(r, ['controls', 'insights', 'routing', 'policies', 'budgets', 'sync']))}</h3>
      <p class="text-sm text-slate-600 leading-relaxed">${esc(sentence(r, 12, 22))}</p>
    </div>`);
  }
  return `<section class="max-w-7xl mx-auto px-6 py-20">
  <div class="max-w-2xl mb-12 flex flex-col gap-3">
    <h2 class="text-3xl font-bold tracking-tight">${esc(title)}</h2>
    <p class="text-slate-600">${esc(sentence(r, 14, 24))}</p>
  </div>
  <div class="grid ${cols} gap-6">
    ${items.join('\n    ')}
  </div>
</section>`;
}

export function testimonial(r, { n = 3 } = {}) {
  const people = some(r, PEOPLE, n);
  return `<section class="bg-slate-50 border-t border-b px-6 py-20">
  <div class="max-w-7xl mx-auto grid auto-fit-320 gap-6">
    ${people.map(p => `<figure class="bg-white p-6 rounded-xl border flex flex-col gap-4">
      <div class="flex gap-1 text-amber-600">${'x'.repeat(5).split('').map(() => icon('star', 'w-4 h-4')).join('')}</div>
      <blockquote class="text-slate-700 leading-relaxed">"${esc(sentence(r, 16, 28))}"</blockquote>
      <figcaption class="flex items-center gap-3 mt-auto">
        ${avatar(r, p)}
        <div class="min-w-0">
          <div class="text-sm font-semibold truncate">${esc(p)}</div>
          <div class="text-xs text-slate-500 truncate">${esc(pick(r, ROLES))}, ${esc(pick(r, COMPANIES))}</div>
        </div>
      </figcaption>
    </figure>`).join('\n    ')}
  </div>
</section>`;
}

export function statCards(r, { n = 4, layout = 'grid' } = {}) {
  const labels = ['Monthly active', 'Ingest volume', 'p95 latency', 'Error budget', 'Open incidents', 'Cost per unit'];
  const values = ['48,219', '1.4 TB', '182 ms', '96.4%', '3', '$0.0031'];
  const cards = [];
  for (let i = 0; i < n; i++) {
    const up = i % 3 !== 1;
    cards.push(`<div class="${layout === 'flex' ? 'flex-1 min-w-0' : ''} bg-white border rounded-xl p-5 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-slate-500 truncate">${esc(labels[i % labels.length])}</span>
        ${icon(pick(r, ICON_NAMES), 'w-4 h-4 text-slate-400')}
      </div>
      <div class="text-3xl font-bold tracking-tight">${esc(values[i % values.length])}</div>
      <div class="flex items-center gap-1 text-xs ${up ? 'text-emerald-600' : 'text-rose-600'}">
        ${icon('arrow', 'w-3 h-3')}<span>${up ? '+' : '−'}${(i + 2) * 3}.${i}% vs last week</span>
      </div>
    </div>`);
  }
  return layout === 'flex'
    ? `<div class="flex flex-wrap gap-4">${cards.join('')}</div>`
    : `<div class="grid auto-fit-240 gap-4">${cards.join('')}</div>`;
}

/** Inline SVG line chart — deterministic geometry, no library. */
export function chartCard(r, { title = 'Throughput', h = 200 } = {}) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const y = 40 + Math.round(Math.sin(i / 3.1) * 22 + (i * 1.4)); pts.push(`${i * 24},${120 - Math.min(110, y)}`); }
  const bars = [];
  for (let i = 0; i < 12; i++) bars.push(`<rect x="${i * 48 + 8}" y="${120 - (18 + (i * 7) % 90)}" width="30" height="${18 + (i * 7) % 90}" rx="3" fill="#c7d2fe"/>`);
  return `<div class="bg-white border rounded-xl p-5 flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <div><h3 class="font-semibold">${esc(title)}</h3><p class="text-xs text-slate-500">Last 24 hours</p></div>
    <div class="flex gap-2">${btn('Day', 'secondary', 'px-3 py-1 text-xs')}${btn('Week', 'ghost', 'px-3 py-1 text-xs')}</div>
  </div>
  <svg viewBox="0 0 576 130" class="w-full" style="height:${h}px" preserveAspectRatio="none" aria-hidden="true">
    ${bars.join('')}
    <polyline points="${pts.join(' ')}" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linejoin="round"/>
  </svg>
  <div class="flex justify-between text-xs text-slate-400"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
</div>`;
}

export function sidebar(r, { product, items, width = 'w-64', collapsedIcons = false } = {}) {
  return `<aside class="${width} shrink-0 border-r bg-white flex flex-col">
  <div class="h-16 flex items-center gap-2 px-5 border-b font-semibold">${icon('box', 'w-6 h-6 text-indigo-600')}<span class="truncate">${esc(product)}</span></div>
  <nav class="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
    ${items.map((it, i) => `<a class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${i === 1 ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-600'}">
      ${icon(ICON_NAMES[i % ICON_NAMES.length], 'w-4 h-4 shrink-0')}${collapsedIcons ? '' : `<span class="truncate">${esc(it)}</span>`}
      ${i === 3 ? `<span class="ml-auto">${badge('12', 'slate')}</span>` : ''}
    </a>`).join('\n    ')}
  </nav>
  <div class="p-3 border-t flex items-center gap-3">
    ${avatar(r, pick(r, PEOPLE), 'w-9 h-9')}
    <div class="min-w-0 flex-1"><div class="text-sm font-medium truncate">${esc(pick(r, PEOPLE))}</div><div class="text-xs text-slate-500 truncate">${esc(pick(r, ROLES))}</div></div>
    ${icon('chevron', 'w-4 h-4 text-slate-400 shrink-0')}
  </div>
</aside>`;
}

export function dataTable(r, { rows = 8, sticky = false, wrap = true, dense = false } = {}) {
  const cols = ['Name', 'Owner', 'Region', 'Status', 'Requests', 'Updated'];
  const body = [];
  for (let i = 0; i < rows; i++) {
    const p = PEOPLE[i % PEOPLE.length];
    const st = ['Healthy', 'Degraded', 'Paused'][i % 3];
    body.push(`<tr class="border-b">
      <td class="${dense ? 'px-3 py-2' : 'px-4 py-3'} font-medium"><div class="flex items-center gap-2 min-w-0">${icon('doc', 'w-4 h-4 text-slate-400 shrink-0')}<span class="truncate">${esc(PRODUCTS[i % PRODUCTS.length])}-${esc(WORDS[i % WORDS.length])}</span></div></td>
      <td class="${dense ? 'px-3 py-2' : 'px-4 py-3'}"><div class="flex items-center gap-2">${avatar(r, p, 'w-6 h-6')}<span class="truncate">${esc(p)}</span></div></td>
      <td class="${dense ? 'px-3 py-2' : 'px-4 py-3'} text-slate-600 whitespace-nowrap">${esc(CITIES[i % CITIES.length])}</td>
      <td class="${dense ? 'px-3 py-2' : 'px-4 py-3'}">${badge(st, st === 'Healthy' ? 'green' : st === 'Degraded' ? 'amber' : 'slate')}</td>
      <td class="${dense ? 'px-3 py-2' : 'px-4 py-3'} text-right font-mono text-sm">${(i * 1487 + 903).toLocaleString('en-US')}</td>
      <td class="${dense ? 'px-3 py-2' : 'px-4 py-3'} text-slate-500 text-sm whitespace-nowrap">${i + 1} day${i ? 's' : ''} ago</td>
    </tr>`);
  }
  const table = `<table class="w-full text-sm text-left">
    <thead class="${sticky ? 'sticky top-0 z-10' : ''} bg-slate-50 border-b">
      <tr>${cols.map(c => `<th class="px-4 py-3 font-medium text-slate-500 whitespace-nowrap ${c === 'Requests' ? 'text-right' : ''}">${esc(c)}</th>`).join('')}</tr>
    </thead>
    <tbody>${body.join('')}</tbody>
  </table>`;
  return wrap ? `<div class="border rounded-xl overflow-hidden bg-white"><div class="overflow-x-auto">${table}</div></div>` : table;
}

export function pricingTiers(r, { n = 3, highlight = 1, layout = 'grid' } = {}) {
  const names = ['Starter', 'Team', 'Business', 'Enterprise'];
  const prices = ['$0', '$29', '$99', 'Custom'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const hi = i === highlight;
    out.push(`<div class="${layout === 'flex' ? 'flex-1' : ''} relative rounded-2xl border ${hi ? 'border-indigo-600 shadow-lg' : ''} bg-white p-8 flex flex-col gap-6">
      ${hi ? `<span class="absolute -top-2 left-8">${badge('Most popular', 'indigo')}</span>` : ''}
      <div class="flex flex-col gap-2">
        <h3 class="text-lg font-semibold">${esc(names[i % names.length])}</h3>
        <p class="text-sm text-slate-600">${esc(sentence(r, 7, 12))}</p>
      </div>
      <div class="flex items-baseline gap-1">
        <span class="text-4xl font-extrabold tracking-tight">${esc(prices[i % prices.length])}</span>
        <span class="text-sm text-slate-500">/user/month</span>
      </div>
      ${btn(i === n - 1 ? 'Contact sales' : 'Start free', hi ? 'primary' : 'secondary', 'w-full py-3')}
      <ul class="flex flex-col gap-3 text-sm">
        ${[0, 1, 2, 3, 4].map(k => `<li class="flex items-start gap-2">${icon('check', 'w-4 h-4 text-emerald-600 shrink-0 mt-1')}<span class="text-slate-600">${esc(lorem(r, 3 + k % 4))}</span></li>`).join('\n        ')}
      </ul>
    </div>`);
  }
  return layout === 'flex'
    ? `<div class="flex flex-wrap items-stretch gap-6">${out.join('')}</div>`
    : `<div class="grid auto-fit-280 gap-6 items-start">${out.join('')}</div>`;
}

export function comparisonTable(r) {
  const feats = ['Seats included', 'Retention window', 'SSO / SAML', 'Audit log export', 'Custom regions', 'Support SLA'];
  const vals = [['3', '25', 'Unlimited'], ['7 days', '90 days', '2 years'], ['—', '✓', '✓'], ['—', '✓', '✓'], ['—', '—', '✓'], ['Community', 'Next business day', '1 hour']];
  return `<div class="border rounded-xl overflow-x-auto bg-white">
  <table class="w-full text-sm">
    <thead class="bg-slate-50 border-b"><tr>
      <th class="px-6 py-4 text-left font-medium text-slate-500">Feature</th>
      ${['Starter', 'Team', 'Business'].map(t => `<th class="px-6 py-4 text-center font-medium whitespace-nowrap">${t}</th>`).join('')}
    </tr></thead>
    <tbody>${feats.map((f, i) => `<tr class="border-b"><td class="px-6 py-4 text-slate-700">${esc(f)}</td>${vals[i].map(v => `<td class="px-6 py-4 text-center text-slate-600">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
</div>`;
}

export function faq(r, { n = 5 } = {}) {
  const qs = ['How does billing work?', 'Can I change plans later?', 'Where is my data stored?', 'Do you offer a nonprofit discount?', 'What happens when I hit a limit?', 'Is there an on-premise option?'];
  return `<div class="max-w-3xl mx-auto flex flex-col gap-3">
    ${qs.slice(0, n).map((q, i) => `<details class="border rounded-xl bg-white px-5 py-4"${i === 0 ? ' open' : ''}>
      <summary class="flex items-center justify-between gap-4 cursor-pointer font-medium select-none">${esc(q)}${icon('chevron', 'w-4 h-4 text-slate-400 shrink-0')}</summary>
      <p class="mt-3 text-sm text-slate-600 leading-relaxed">${esc(paragraph(r, 2))}</p>
    </details>`).join('\n    ')}
  </div>`;
}

/** Native form controls: the loudest known-expected divergence class. Included at
    the frequency a real settings/checkout page would have them, not amplified. */
export function formFields(r, { kinds, columns = 1 } = {}) {
  const F = {
    text: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><input type="text" id="${id}" class="w-full px-3 py-2 border rounded-lg" placeholder="${esc(pick(r, PRODUCTS))}"></label>`,
    email: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><input type="email" id="${id}" class="w-full px-3 py-2 border rounded-lg" placeholder="you@company.com"></label>`,
    password: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><input type="password" id="${id}" class="w-full px-3 py-2 border rounded-lg" value="hunter2hunter2"></label>`,
    number: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><input type="number" id="${id}" class="w-full px-3 py-2 border rounded-lg" value="25" min="0" max="500"></label>`,
    date: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><input type="date" id="${id}" class="w-full px-3 py-2 border rounded-lg" value="2026-03-14"></label>`,
    select: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><select id="${id}" class="w-full px-3 py-2 border rounded-lg">${CITIES.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>`,
    textarea: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><textarea id="${id}" rows="4" class="w-full px-3 py-2 border rounded-lg">${esc(sentence(r, 10, 16))}</textarea></label>`,
    range: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><input type="range" id="${id}" min="0" max="100" value="62" class="w-full"></label>`,
    checkbox: (id, l) => `<label class="flex items-start gap-3"><input type="checkbox" id="${id}" checked class="mt-1 shrink-0"><span class="flex flex-col gap-1"><span class="text-sm font-medium">${l}</span><span class="text-xs text-slate-500">${esc(sentence(r, 8, 14))}</span></span></label>`,
    radio: (id, l) => `<fieldset class="flex flex-col gap-3 border rounded-lg p-4"><legend class="text-sm font-medium px-1">${l}</legend>
        ${['Weekly digest', 'Daily summary', 'Realtime'].map((o, i) => `<label class="flex items-center gap-3"><input type="radio" name="${id}" ${i === 1 ? 'checked' : ''} class="shrink-0"><span class="text-sm">${o}</span></label>`).join('')}</fieldset>`,
    file: (id, l) => `<label class="flex flex-col gap-2"><span class="text-sm font-medium">${l}</span><input type="file" id="${id}" class="w-full text-sm"></label>`,
    color: (id, l) => `<label class="flex items-center justify-between gap-4"><span class="text-sm font-medium">${l}</span><input type="color" id="${id}" value="#4f46e5"></label>`,
    switch: (id, l) => `<div class="flex items-center justify-between gap-4"><span class="flex flex-col"><span class="text-sm font-medium">${l}</span><span class="text-xs text-slate-500">${esc(sentence(r, 6, 11))}</span></span>
        <span class="relative w-10 h-6 rounded-full bg-indigo-600 shrink-0"><span class="absolute top-1 right-1 w-4 h-4 rounded-full bg-white"></span></span></div>`,
    progress: (id, l) => `<div class="flex flex-col gap-2"><div class="flex justify-between text-sm"><span class="font-medium">${l}</span><span class="text-slate-500">62%</span></div><progress id="${id}" value="62" max="100" class="w-full"></progress></div>`,
  };
  const labels = { text: 'Workspace name', email: 'Billing email', password: 'Current password', number: 'Seat count', date: 'Renewal date', select: 'Primary region', textarea: 'Description', range: 'Sampling rate', checkbox: 'Email me about incidents', radio: 'Notification cadence', file: 'Upload logo', color: 'Brand colour', switch: 'Require two-factor', progress: 'Storage used' };
  const body = kinds.map((k, i) => F[k](`f-${k}-${i}`, labels[k])).join('\n    ');
  return columns > 1
    ? `<div class="grid grid-cols-${columns} gap-5">${body}</div>`
    : `<div class="flex flex-col gap-5">${body}</div>`;
}

export function modal(r, { size = 'max-w-lg', withForm = true, centered = true } = {}) {
  return `<div class="fixed inset-0 z-50 flex ${centered ? 'items-center' : 'items-start pt-20'} justify-center p-6" style="background:rgba(15,23,42,.55)">
  <div class="${size} w-full bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden" style="max-height:calc(100vh - 6rem)">
    <div class="flex items-start justify-between gap-4 px-6 py-5 border-b">
      <div class="flex flex-col gap-1 min-w-0">
        <h2 class="text-lg font-semibold truncate">Invite people to ${esc(pick(r, PRODUCTS))}</h2>
        <p class="text-sm text-slate-500">${esc(sentence(r, 8, 14))}</p>
      </div>
      <button type="button" class="p-2 rounded-lg text-slate-400 shrink-0">${icon('x', 'w-5 h-5')}</button>
    </div>
    <div class="px-6 py-5 overflow-y-auto flex flex-col gap-5">
      ${withForm ? formFields(r, { kinds: ['email', 'select', 'checkbox'] }) : `<p class="text-slate-600 leading-relaxed">${esc(paragraph(r, 3))}</p>`}
    </div>
    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-end gap-3">
      ${btn('Cancel', 'secondary')}${btn('Send invites', 'primary')}
    </div>
  </div>
</div>`;
}

export function toasts(r, { n = 2 } = {}) {
  const tones = [['check', 'emerald', 'Deployment succeeded'], ['bell', 'amber', 'Usage at 82% of quota'], ['x', 'rose', 'Sync failed for 2 sources']];
  return `<div class="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80">
  ${tones.slice(0, n).map(([ic, tone, msg]) => `<div class="bg-white border rounded-xl shadow-lg p-4 flex items-start gap-3">
    <span class="text-${tone}-600 shrink-0">${icon(ic, 'w-5 h-5')}</span>
    <div class="min-w-0 flex-1"><div class="text-sm font-medium">${esc(msg)}</div><div class="text-xs text-slate-500 truncate">${esc(sentence(r, 6, 10))}</div></div>
    <button type="button" class="text-slate-400 shrink-0">${icon('x', 'w-4 h-4')}</button>
  </div>`).join('\n  ')}
</div>`;
}

export function breadcrumb(r, parts) {
  return `<nav class="flex items-center gap-2 text-sm text-slate-500 flex-wrap">
    ${parts.map((p, i) => `${i ? `<span class="text-slate-300">/</span>` : ''}<a class="${i === parts.length - 1 ? 'text-slate-900 font-medium' : ''} whitespace-nowrap">${esc(p)}</a>`).join('')}
  </nav>`;
}

export function tabs(r, items, active = 0) {
  return `<div class="border-b"><div class="flex gap-6 overflow-x-auto">
    ${items.map((t, i) => `<button type="button" class="py-3 text-sm whitespace-nowrap border-b-2 ${i === active ? 'border-indigo-600 text-indigo-600 font-medium' : 'border-0 text-slate-500'}" style="${i === active ? '' : 'border-bottom-color:transparent'}">${esc(t)}${i === 2 ? ` ${badge('3', 'slate')}` : ''}</button>`).join('\n    ')}
  </div></div>`;
}

export function activityFeed(r, { n = 6, scroll = false } = {}) {
  const acts = ['deployed', 'commented on', 'closed', 'reopened', 'assigned', 'merged'];
  return `<div class="bg-white border rounded-xl ${scroll ? 'overflow-y-auto' : ''}" ${scroll ? 'style="max-height:320px"' : ''}>
  <div class="px-5 py-4 border-b flex items-center justify-between"><h3 class="font-semibold">Recent activity</h3><a class="text-sm text-indigo-600">View all</a></div>
  <ul class="divide-y">
    ${Array.from({ length: n }, (_, i) => { const p = PEOPLE[i % PEOPLE.length]; return `<li class="px-5 py-4 flex items-start gap-3">
      ${avatar(r, p, 'w-8 h-8')}
      <div class="min-w-0 flex-1">
        <p class="text-sm"><span class="font-medium">${esc(p)}</span> ${acts[i % acts.length]} <a class="text-indigo-600">${esc(PRODUCTS[i % PRODUCTS.length])}/${esc(WORDS[i % WORDS.length])}</a></p>
        <p class="text-xs text-slate-500 mt-1 truncate">${esc(sentence(r, 8, 16))}</p>
      </div>
      <span class="text-xs text-slate-400 whitespace-nowrap shrink-0">${i + 1}h</span>
    </li>`; }).join('\n    ')}
  </ul>
</div>`;
}

export function footer(r, { product, cols = 4 } = {}) {
  const groups = { Product: ['Overview', 'Pricing', 'Integrations', 'Changelog'], Company: ['About', 'Careers', 'Press', 'Contact'], Resources: ['Docs', 'API reference', 'Status', 'Community'], Legal: ['Privacy', 'Terms', 'Security', 'DPA'] };
  return `<footer class="border-t bg-slate-50 px-6 py-16">
  <div class="max-w-7xl mx-auto grid grid-cols-${cols + 1} gap-8">
    <div class="col-span-2 flex flex-col gap-4">
      <div class="flex items-center gap-2 font-semibold">${icon('box', 'w-6 h-6 text-indigo-600')}<span>${esc(product)}</span></div>
      <p class="text-sm text-slate-600 max-w-xs leading-relaxed">${esc(sentence(r, 12, 20))}</p>
      <div class="flex gap-3 text-slate-400">${some(r, ICON_NAMES, 4).map(i => icon(i, 'w-5 h-5')).join('')}</div>
    </div>
    ${Object.entries(groups).slice(0, cols - 1).map(([g, links]) => `<div class="flex flex-col gap-3">
      <h4 class="text-sm font-semibold">${g}</h4>
      ${links.map(l => `<a class="text-sm text-slate-600">${l}</a>`).join('\n      ')}
    </div>`).join('\n    ')}
  </div>
  <div class="max-w-7xl mx-auto mt-12 pt-4 border-t flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
    <span>© 2026 ${esc(product)}, Inc. All rights reserved.</span>
    <span class="flex items-center gap-2">${icon('globe', 'w-4 h-4')} English (US)</span>
  </div>
</footer>`;
}

export function prose(r, { paras = 6, withCode = true, withQuote = true, withImage = true } = {}) {
  const out = [];
  for (let i = 0; i < paras; i++) {
    out.push(`<p>${esc(paragraph(r, 4))}</p>`);
    if (i === 1 && withQuote) out.push(`<blockquote class="border-l-4 pl-5 py-1 text-lg text-slate-700 italic">${esc(sentence(r, 14, 24))}</blockquote>`);
    if (i === 2 && withCode) out.push(`<pre class="bg-slate-900 text-white rounded-xl p-5 overflow-x-auto text-sm font-mono"><code>export async function ${pick(r, WORDS)}(input: Options): Promise&lt;Result&gt; {
  const client = await connect({ region: "eu-central-1", retries: 3 });
  return client.submit(input).then((r) =&gt; r.records.map(normalize));
}</code></pre>`);
    if (i === 3 && withImage) out.push(`<figure class="flex flex-col gap-2">${placeholder(r, 'aspect-video')}<figcaption class="text-sm text-slate-500">${esc(sentence(r, 8, 14))}</figcaption></figure>`);
    if (i === 4) out.push(`<h2 class="text-2xl font-bold tracking-tight mt-4">${esc(pick(r, WORDS).replace(/^./, c => c.toUpperCase()))} in practice</h2>`);
    if (i === 5) out.push(`<ul class="list-disc flex flex-col gap-2"><li>${esc(sentence(r, 8, 14))}</li><li>${esc(sentence(r, 8, 14))}</li><li>${esc(sentence(r, 8, 14))}</li></ul>`);
  }
  return out.join('\n    ');
}

export function ctaBand(r, { product, dark = true } = {}) {
  return `<section class="${dark ? 'bg-slate-900 text-white' : 'bg-indigo-50'} px-6 py-20">
  <div class="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
    <h2 class="text-4xl font-bold tracking-tight text-balance">Ready to try ${esc(product)}?</h2>
    <p class="text-lg ${dark ? 'opacity-80' : 'text-slate-600'} leading-relaxed">${esc(sentence(r, 12, 20))}</p>
    <div class="flex flex-wrap justify-center gap-3">${btn('Create free account', dark ? 'secondary' : 'primary', 'px-5 py-3')}${btn('Talk to sales', dark ? 'ghost' : 'secondary', 'px-5 py-3')}</div>
  </div>
</section>`;
}
