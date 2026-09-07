import { chromium, firefox, webkit } from 'playwright';
const ENGINES = { chromium, firefox, webkit };
const SITES = process.argv.slice(2);
const collect = `() => {
  const path = (el) => { const p=[]; let n=el;
    while (n && n.nodeType===1 && n!==document.documentElement) {
      let i=1, s=n; while ((s=s.previousElementSibling)) if (s.tagName===n.tagName) i++;
      p.unshift(n.tagName+'['+i+']'); n=n.parentElement; }
    return p.join('/'); };
  const res={};
  for (const el of document.querySelectorAll('body *')) {
    const r=el.getBoundingClientRect();
    if (r.width===0 && r.height===0) continue;
    const pr=el.parentElement.getBoundingClientRect();
    res[path(el)] = { w:+r.width.toFixed(2), h:+r.height.toFixed(2),
      rx:+(r.x-pr.x).toFixed(2), ry:+(r.y-pr.y).toFixed(2), ax:+r.x.toFixed(2), ay:+r.y.toFixed(2),
      tag: el.tagName };
  }
  return res;
}`;
for (const site of SITES) {
  const data={};
  let ok=true;
  for (const [n,l] of Object.entries(ENGINES)) {
    const b=await l.launch();
    try {
      const p=await (await b.newContext({viewport:{width:1280,height:900}, deviceScaleFactor:1, reducedMotion:'reduce'})).newPage();
      await p.goto(site,{waitUntil:'networkidle',timeout:45000});
      await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1200);
      data[n]=await p.evaluate(eval('('+collect+')'));
    } catch(e){ console.log(`  !! ${n}: ${e.message.slice(0,80)}`); ok=false; }
    await b.close();
  }
  if(!ok){ console.log(`SKIP ${site}\n`); continue; }
  const E=['chromium','firefox','webkit'];
  const common=Object.keys(data.chromium).filter(k=>data.firefox[k]&&data.webkit[k]);
  const T=0.5; let abs=0,rel=0,size=0; const tagHist={};
  for(const k of common){
    const v=E.map(e=>data[e][k]);
    const d=f=>Math.max(...v.map(q=>q[f]))-Math.min(...v.map(q=>q[f]));
    const a=Math.max(d('ax'),d('ay')), rr=Math.max(d('rx'),d('ry')), s=Math.max(d('w'),d('h'));
    if(a>T)abs++; if(rr>T)rel++; if(s>T)size++;
    if(rr>T||s>T){ const t=v[0].tag; tagHist[t]=(tagHist[t]||0)+1; }
  }
  const pc=x=>`${x} (${(100*x/common.length).toFixed(1)}%)`;
  console.log(`\n### ${site}`);
  console.log(`  DOM nodes matched in all 3 engines: ${common.length} / chromium ${Object.keys(data.chromium).length}, firefox ${Object.keys(data.firefox).length}, webkit ${Object.keys(data.webkit).length}`);
  console.log(`  absolute-coord divergence >0.5px : ${pc(abs)}`);
  console.log(`  parent-relative divergence >0.5px: ${pc(rel)}`);
  console.log(`  size (w/h) divergence >0.5px     : ${pc(size)}`);
  console.log(`  top diverging tags: ${Object.entries(tagHist).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([t,c])=>`${t}:${c}`).join(' ')}`);
}
