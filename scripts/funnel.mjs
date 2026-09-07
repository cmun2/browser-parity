import { chromium, firefox, webkit } from 'playwright';
const ENGINES={chromium,firefox,webkit};
const collect=`() => {
  const path=(el)=>{const p=[];let n=el;
    while(n&&n.nodeType===1&&n!==document.documentElement){let i=1,s=n;
      while((s=s.previousElementSibling))if(s.tagName===n.tagName)i++;
      p.unshift(n.tagName+'['+i+']');n=n.parentElement;}return p.join('/');};
  const res={};
  for(const el of document.querySelectorAll('body *')){
    const r=el.getBoundingClientRect(); if(r.width===0&&r.height===0)continue;
    const pe=el.parentElement, pr=pe.getBoundingClientRect(); const cs=getComputedStyle(el);
    res[path(el)]={w:+r.width.toFixed(2),h:+r.height.toFixed(2),
      rx:+(r.x-pr.x).toFixed(2),ry:+(r.y-pr.y).toFixed(2),
      tag:el.tagName, ns:el.namespaceURI!=='http://www.w3.org/1999/xhtml',
      disp:cs.display, ppath:path(pe)};
  }
  return res;
}`;
const site=process.argv[2];
const data={};
for(const [n,l] of Object.entries(ENGINES)){
  const b=await l.launch();
  const p=await (await b.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'})).newPage();
  await p.goto(site,{waitUntil:'networkidle',timeout:45000});
  await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1200);
  data[n]=await p.evaluate(eval('('+collect+')')); await b.close();
}
const E=['chromium','firefox','webkit'];
const common=Object.keys(data.chromium).filter(k=>data.firefox[k]&&data.webkit[k]);
const d=(v,f)=>Math.max(...v.map(q=>q[f]))-Math.min(...v.map(q=>q[f]));
const delta={};
for(const k of common){const v=E.map(e=>data[e][k]);
  delta[k]={rel:Math.max(d(v,'rx'),d(v,'ry')),size:Math.max(d(v,'w'),d(v,'h')),
    dx:d(v,'rx'),dy:d(v,'ry'),dw:d(v,'w'),dh:d(v,'h'),m:data.chromium[k]};}
const stage=(name,keep)=>{const s=common.filter(k=>keep(k,delta[k]));
  console.log(`  ${name.padEnd(46)} ${String(s.length).padStart(5)}`); return s;};
console.log(`\n### ${site}   (${common.length} nodes matched in all 3 engines)`);
let s = stage('0. raw: any parent-relative or size delta >0.5px', (k,x)=>x.rel>0.5||x.size>0.5);
const S=new Set(s);
s = stage('1. + drop SVG-internal nodes',            k=>S.has(k)&&!delta[k].m.ns);
const S1=new Set(s);
s = stage('2. + drop display:inline (text metrics)', k=>S1.has(k)&&delta[k].m.disp!=='inline');
const S2=new Set(s);
s = stage('3. + tolerance 2px OR 1% of box',         k=>{const x=delta[k],m=x.m;
  const tol=Math.max(2, 0.01*Math.max(m.w,m.h)); return S2.has(k)&&(x.rel>tol||x.size>tol);});
const S3=new Set(s);
// 4. root-cause collapse: drop if delta vector ~= parent's delta vector (inherited, not independent)
s = stage('4. + collapse inherited (parent has same delta)', k=>{
  if(!S3.has(k))return false; const x=delta[k], pk=x.m.ppath, p=delta[pk];
  if(!p)return true;
  const near=(a,b)=>Math.abs(a-b)<=0.75;
  return !(near(x.dw,p.dw)&&near(x.dh,p.dh));
});
console.log(`  ---> reviewable findings per page: ${s.length}`);
const byTag={}; for(const k of s){const t=delta[k].m.tag;byTag[t]=(byTag[t]||0)+1;}
console.log(`  residual by tag: ${Object.entries(byTag).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([t,c])=>`${t}:${c}`).join(' ')}`);
console.log('  top 8 residuals:');
for(const k of s.sort((a,b)=>Math.max(delta[b].rel,delta[b].size)-Math.max(delta[a].rel,delta[a].size)).slice(0,8)){
  const x=delta[k];console.log(`    Δ${Math.max(x.rel,x.size).toFixed(1).padStart(7)}px  ${x.m.tag.padEnd(6)} ${k.split('/').slice(-3).join('/')}`);}
