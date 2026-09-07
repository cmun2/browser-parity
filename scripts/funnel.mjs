// Cross-engine suppression funnel.
//
// Originally a one-shot research script (experiment 02: 638->19, 611->5, 74->0).
// Now also the single definition of the pipeline that m0/ imports, so the M0
// incidence study measures the same four rules that were published, not a copy.
// The CLI below is unchanged; `node scripts/funnel.mjs <url>` prints what it
// always printed.
import { chromium, firefox, webkit } from 'playwright';
import { pathToFileURL } from 'node:url';

export const LAUNCHERS = { chromium, firefox, webkit };
export const E = ['chromium', 'firefox', 'webkit'];
export const VIEWPORT = { width: 1280, height: 900 };

// Evidence collection, evaluated in the page. `ax`/`ay` (absolute page coords),
// `styles`, `text` and `sel` are additive: they exist for the M0 labelling UI
// (element crops + human context) and are never read by the delta computation
// or by any suppression rule, so funnel counts are unaffected.
export const collectSource = `() => {
  const path=(el)=>{const p=[];let n=el;
    while(n&&n.nodeType===1&&n!==document.documentElement){let i=1,s=n;
      while((s=s.previousElementSibling))if(s.tagName===n.tagName)i++;
      p.unshift(n.tagName+'['+i+']');n=n.parentElement;}return p.join('/');};
  const SK=['display','position','fontFamily','fontSize','lineHeight','fontWeight','whiteSpace',
    'overflowX','overflowY','flexBasis','flexGrow','flexShrink','minWidth','minHeight','width','height',
    'boxSizing','appearance','marginTop','marginLeft','paddingTop','paddingLeft',
    'borderTopWidth','borderLeftWidth','gap','gridTemplateColumns','textOverflow','writingMode'];
  const res={};
  for(const el of document.querySelectorAll('body *')){
    const r=el.getBoundingClientRect(); if(r.width===0&&r.height===0)continue;
    const pe=el.parentElement, pr=pe.getBoundingClientRect(); const cs=getComputedStyle(el);
    const styles={}; for(const k of SK) styles[k]=cs[k];
    res[path(el)]={w:+r.width.toFixed(2),h:+r.height.toFixed(2),
      rx:+(r.x-pr.x).toFixed(2),ry:+(r.y-pr.y).toFixed(2),
      tag:el.tagName, ns:el.namespaceURI!=='http://www.w3.org/1999/xhtml',
      disp:cs.display, ppath:path(pe),
      ax:+(r.x+scrollX).toFixed(2), ay:+(r.y+scrollY).toFixed(2),
      sel:(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\\s+/).slice(0,4).join('.'):''),
      text:(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80),
      styles};
  }
  return res;
}`;

export const collectFn = eval('(' + collectSource + ')');

/** Navigate + settle exactly as experiment 02 did. */
export async function settle(page, url, { timeout = 45000 } = {}) {
  await page.goto(url, { waitUntil: 'networkidle', timeout });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
}

export async function collectFromPage(page) {
  return page.evaluate(collectFn);
}

/** One-shot: launch all three engines, collect one URL. */
export async function collectAll(url) {
  const data = {};
  for (const [n, l] of Object.entries(LAUNCHERS)) {
    const b = await l.launch();
    const p = await (await b.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage();
    await settle(p, url);
    data[n] = await collectFromPage(p);
    await b.close();
  }
  return data;
}

/** Correspondence by structural path + per-node cross-engine deltas. */
export function computeDeltas(data) {
  const common = Object.keys(data.chromium).filter(k => data.firefox[k] && data.webkit[k]);
  const d = (v, f) => Math.max(...v.map(q => q[f])) - Math.min(...v.map(q => q[f]));
  const delta = {};
  for (const k of common) {
    const v = E.map(e => data[e][k]);
    delta[k] = {
      rel: Math.max(d(v, 'rx'), d(v, 'ry')), size: Math.max(d(v, 'w'), d(v, 'h')),
      dx: d(v, 'rx'), dy: d(v, 'ry'), dw: d(v, 'w'), dh: d(v, 'h'), m: data.chromium[k],
    };
  }
  return { common, delta };
}

// The four published suppression rules, in order. Each is a keep-predicate over
// the survivors of the previous stage. Verbatim logic from experiment 02.
export const RULES = [
  { id: 'raw', label: '0. raw: any parent-relative or size delta >0.5px', keep: (k, x) => x.rel > 0.5 || x.size > 0.5 },
  { id: 'svg-interior', label: '1. + drop SVG-internal nodes', keep: (k, x) => !x.m.ns },
  { id: 'inline-text', label: '2. + drop display:inline (text metrics)', keep: (k, x) => x.m.disp !== 'inline' },
  { id: 'tolerance', label: '3. + tolerance 2px OR 1% of box',
    keep: (k, x) => { const m = x.m; const tol = Math.max(2, 0.01 * Math.max(m.w, m.h)); return x.rel > tol || x.size > tol; } },
  { id: 'inherited-delta', label: '4. + collapse inherited (parent has same delta)',
    keep: (k, x, delta) => { const p = delta[x.m.ppath]; if (!p) return true;
      const near = (a, b) => Math.abs(a - b) <= 0.75;
      return !(near(x.dw, p.dw) && near(x.dh, p.dh)); } },
];

/** Run the funnel. Returns per-stage counts and the surviving keys. */
export function funnel(common, delta) {
  let keys = common;
  const stages = [];
  for (const rule of RULES) {
    keys = keys.filter(k => rule.keep(k, delta[k], delta));
    stages.push({ id: rule.id, label: rule.label, count: keys.length });
  }
  return { stages, survivors: keys };
}

// ---------------------------------------------------------------- CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const site = process.argv[2];
  const data = await collectAll(site);
  const { common, delta } = computeDeltas(data);
  console.log(`\n### ${site}   (${common.length} nodes matched in all 3 engines)`);
  const { stages, survivors: s } = funnel(common, delta);
  for (const st of stages) console.log(`  ${st.label.padEnd(46)} ${String(st.count).padStart(5)}`);
  console.log(`  ---> reviewable findings per page: ${s.length}`);
  const byTag = {}; for (const k of s) { const t = delta[k].m.tag; byTag[t] = (byTag[t] || 0) + 1; }
  console.log(`  residual by tag: ${Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, c]) => `${t}:${c}`).join(' ')}`);
  console.log('  top 8 residuals:');
  for (const k of s.sort((a, b) => Math.max(delta[b].rel, delta[b].size) - Math.max(delta[a].rel, delta[a].size)).slice(0, 8)) {
    const x = delta[k]; console.log(`    Δ${Math.max(x.rel, x.size).toFixed(1).padStart(7)}px  ${x.m.tag.padEnd(6)} ${k.split('/').slice(-3).join('/')}`);
  }
}
