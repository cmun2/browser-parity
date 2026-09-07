#!/usr/bin/env node
// Labelling pass. Serves a keyboard-driven local UI at http://localhost:8731.
//
//   node m0/scripts/label.mjs           label the real survivors
//   node m0/scripts/label.mjs --demo    walk the flow on clearly-marked synthetic
//                                       entries; writes labels.demo.jsonl, which
//                                       verdict.mjs never reads
//
// Every judgement is appended to disk before the UI advances, so killing the
// process loses nothing and re-running resumes at the first unlabelled item.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyCorpus } from './verify-corpus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = path.join(ROOT, 'results');
const DEMO = process.argv.includes('--demo');
const LABELS = path.join(RESULTS, DEMO ? 'labels.demo.jsonl' : 'labels.jsonl');
const PORT = 8731;

let items, meta;
if (DEMO) {
  const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/demo-survivors.json'), 'utf8'));
  items = demo.findings; meta = { demo: true, corpusHash: 'SYNTHETIC-DEMO-NOT-REAL-DATA' };
} else {
  verifyCorpus(ROOT, { quiet: true });
  const f = path.join(RESULTS, 'survivors.json');
  if (!fs.existsSync(f)) { console.error('No m0/results/survivors.json — run: node m0/scripts/run.mjs'); process.exit(1); }
  const s = JSON.parse(fs.readFileSync(f, 'utf8'));
  items = s.pages.flatMap(p => p.findings.map(x => ({ ...x, kind: p.kind, selfConsistent: p.selfConsistent })));
  meta = { demo: false, corpusHash: s.corpusHash, ranAt: s.ranAt, pages: s.totals.pages, engineVersions: s.environment.engineVersions };
}

fs.mkdirSync(RESULTS, { recursive: true });
const appendLabel = (rec) => fs.appendFileSync(LABELS, JSON.stringify(rec) + '\n');
function readLabels() {
  if (!fs.existsSync(LABELS)) return {};
  const out = {};
  for (const line of fs.readFileSync(LABELS, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.undo) delete out[r.findingId]; else out[r.findingId] = r;
  }
  return out;
}

const MIME = { '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };

  if (u.pathname === '/') return send(200, 'text/html; charset=utf-8', HTML);
  if (u.pathname === '/api/state') return send(200, 'application/json', JSON.stringify({ items, labels: readLabels(), meta }));

  if (u.pathname === '/api/judge' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d);
    return req.on('end', () => {
      const r = JSON.parse(b);
      appendLabel({ ...r, at: new Date().toISOString(), synthetic: DEMO || undefined });
      send(200, 'application/json', '{"ok":true}');
    });
  }
  if (u.pathname === '/api/undo' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d);
    return req.on('end', () => {
      appendLabel({ findingId: JSON.parse(b).findingId, undo: true, at: new Date().toISOString(), synthetic: DEMO || undefined });
      send(200, 'application/json', '{"ok":true}');
    });
  }
  if (u.pathname.startsWith('/shots/') || u.pathname.startsWith('/demoshots/')) {
    const base = u.pathname.startsWith('/demoshots/') ? path.join(ROOT, 'fixtures/demoshots') : path.join(RESULTS, 'shots');
    const f = path.join(base, path.basename(decodeURIComponent(u.pathname)));
    if (!f.startsWith(base) || !fs.existsSync(f)) return send(404, 'text/plain', 'no shot');
    return send(200, MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
  }
  if (u.pathname.startsWith('/page/')) {
    const f = path.join(ROOT, 'corpus/pages', path.basename(decodeURIComponent(u.pathname)));
    if (!f.startsWith(path.join(ROOT, 'corpus/pages')) || !fs.existsSync(f)) return send(404, 'text/plain', 'no page');
    return send(200, 'text/html; charset=utf-8', fs.readFileSync(f));
  }
  send(404, 'text/plain', 'not found');
});

const HTML = String.raw`<!DOCTYPE html><html><head><meta charset="utf-8"><title>M0 labelling</title>
<style>
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#e2e8f0}
header{position:sticky;top:0;z-index:10;background:#0f172a;border-bottom:1px solid #1e293b;padding:.75rem 1.25rem;display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap}
.bar{flex:1;min-width:200px;height:6px;background:#1e293b;border-radius:99px;overflow:hidden}
.bar i{display:block;height:100%;background:#6366f1}
.dim{color:#64748b}
main{padding:1.25rem;max-width:1500px;margin:0 auto}
.meta{display:flex;gap:1.5rem;flex-wrap:wrap;align-items:baseline;margin-bottom:.75rem}
h1{font-size:1.05rem;margin:0;font-weight:600}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;background:#1e293b;padding:.1rem .35rem;border-radius:.25rem;word-break:break-all}
.shots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin:.75rem 0}
.shot{background:#1e293b;border:1px solid #334155;border-radius:.5rem;overflow:hidden;display:flex;flex-direction:column}
.shot h3{margin:0;padding:.45rem .65rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;border-bottom:1px solid #334155;display:flex;justify-content:space-between;gap:.5rem}
.shot .imgwrap{background:repeating-conic-gradient(#334155 0 25%,#1e293b 0 50%) 0 0/16px 16px;display:grid;place-items:center;padding:.5rem;min-height:120px;overflow:auto}
.shot img{display:block;max-width:100%;image-rendering:pixelated}
table{border-collapse:collapse;font-size:.85rem;width:100%}
th,td{text-align:left;padding:.3rem .6rem;border-bottom:1px solid #1e293b}
th{color:#94a3b8;font-weight:500}
td.num{font-family:ui-monospace,Menlo,monospace;text-align:right}
.hot{color:#fbbf24;font-weight:600}
.keys{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem}
.key{background:#1e293b;border:1px solid #334155;border-radius:.5rem;padding:.6rem .9rem;display:flex;align-items:center;gap:.6rem;cursor:pointer}
.key:hover{border-color:#6366f1}
.key b{display:grid;place-items:center;width:22px;height:22px;background:#334155;border-radius:.3rem;font-size:.78rem}
.key.g b{background:#065f46}.key.e b{background:#78350f}.key.a b{background:#7f1d1d}
.panel{background:#1e293b;border:1px solid #334155;border-radius:.5rem;padding:.85rem 1rem;margin-top:1rem}
details summary{cursor:pointer;color:#94a3b8}
input[type=text]{width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;border-radius:.4rem;padding:.5rem .65rem;font:inherit;margin-top:.5rem}
.done{text-align:center;padding:4rem 1rem}
.tag{background:#312e81;color:#c7d2fe;border-radius:99px;padding:.1rem .5rem;font-size:.72rem}
.warn{background:#7f1d1d;color:#fecaca;border-radius:.4rem;padding:.5rem .75rem;margin-bottom:.75rem}
.demo{background:#7c2d12;color:#fed7aa;padding:.5rem 1.25rem;font-weight:600;text-align:center}
a{color:#818cf8}
</style></head><body>
<div id="demoflag"></div>
<header>
  <strong>M0</strong>
  <div class="bar"><i id="prog" style="width:0"></i></div>
  <span id="count" class="dim"></span>
  <span id="pace" class="dim"></span>
  <span class="dim">1 genuine · 2 expected · 3 artifact · s skip · u undo · n note</span>
</header>
<main id="app"></main>
<script>
let S=null, idx=0, order=[], t0=Date.now(), sessionCount=0, pendingClass=null;
const LBL={genuine:'genuine defect',expected:'expected engine difference',artifact:'tool artifact (false positive)',skip:'skipped'};

async function load(){
  S=await (await fetch('/api/state')).json();
  if(S.meta.demo) document.getElementById('demoflag').innerHTML='<div class="demo">DEMO MODE — synthetic entries, written to labels.demo.jsonl, excluded from the verdict</div>';
  order=S.items.map((_,i)=>i);
  idx=order.findIndex(i=>!S.labels[S.items[i].id]);
  if(idx<0) idx=S.items.length;
  render();
}
function pace(){
  if(!sessionCount) return '';
  const m=(Date.now()-t0)/60000, rate=sessionCount/m;
  const left=S.items.filter(x=>!S.labels[x.id]).length;
  return rate>0? rate.toFixed(1)+'/min · ~'+Math.ceil(left/rate)+' min left' : '';
}
function render(){
  const done=S.items.filter(x=>S.labels[x.id]).length, n=S.items.length;
  document.getElementById('prog').style.width=(100*done/Math.max(1,n))+'%';
  document.getElementById('count').textContent=done+' / '+n+' labelled';
  document.getElementById('pace').textContent=pace();
  const app=document.getElementById('app');
  if(idx>=S.items.length||idx<0){
    const counts={};
    for(const it of S.items){const l=S.labels[it.id]; if(l) counts[l.label]=(counts[l.label]||0)+1;}
    app.innerHTML='<div class="done"><h1>All '+n+' labelled.</h1><p class="dim">'+
      Object.entries(counts).map(([k,v])=>v+' '+(LBL[k]||k)).join(' · ')+
      '</p><p>Now run <code>node m0/scripts/verdict.mjs</code></p>'+
      (counts.skip?'<p class="dim">You skipped '+counts.skip+'. Press <b>r</b> to revisit them.</p>':'')+'</div>';
    return;
  }
  const it=S.items[idx], prev=S.labels[it.id];
  const props=it.properties.map(p=>'<tr><td>'+p.prop+'</td><td class="num hot">'+p.deltaPx.toFixed(2)+'px</td>'+
    ['chromium','firefox','webkit'].map(e=>'<td class="num">'+p.values[e]+'</td>').join('')+'</tr>').join('');
  const sd=Object.entries(it.styleDiffs||{});
  app.innerHTML=
   (it.selfConsistent===false?'<div class="warn">This page rendered differently on two loads of the same engine — treat any finding on it as uninterpretable and mark it a tool artifact.</div>':'')+
   '<div class="meta"><h1>'+it.id+'</h1><span class="tag">'+(it.kind||'')+'</span>'+
     '<span class="dim">&lt;'+it.tag.toLowerCase()+'&gt; · display:'+it.display+'</span>'+
     '<span class="dim">max Δ <b class="hot">'+it.maxDeltaPx.toFixed(2)+'px</b></span>'+
     '<a href="/page/'+it.page+'.html" target="_blank">open page ↗</a></div>'+
   '<div><code>'+it.path+'</code>'+(it.selector?' <code>'+it.selector+'</code>':'')+'</div>'+
   (it.text?'<div class="dim" style="margin-top:.35rem">text: “'+it.text.replace(/</g,'&lt;')+'”</div>':'')+
   '<div class="shots">'+['chromium','firefox','webkit'].map(e=>
     '<div class="shot"><h3><span>'+e+'</span><span>'+it.geometry[e].w+' × '+it.geometry[e].h+'</span></h3>'+
     '<div class="imgwrap"><img src="'+(S.meta.demo?'/demoshots/':'/shots/')+it.shots[e].split("/").pop()+'" alt="'+e+'"></div></div>').join('')+'</div>'+
   '<table><thead><tr><th>property</th><th style="text-align:right">Δ</th><th style="text-align:right">chromium</th><th style="text-align:right">firefox</th><th style="text-align:right">webkit</th></tr></thead><tbody>'+props+'</tbody></table>'+
   (sd.length?'<details class="panel"><summary>'+sd.length+' computed style propert'+(sd.length>1?'ies':'y')+' also differ</summary><table><tbody>'+
      sd.map(([k,v])=>'<tr><td>'+k+'</td><td><code>'+String(v.chromium).slice(0,40)+'</code></td><td><code>'+String(v.firefox).slice(0,40)+'</code></td><td><code>'+String(v.webkit).slice(0,40)+'</code></td></tr>').join('')+'</tbody></table></details>':'')+
   (pendingClass?'<div class="panel"><b>Genuine defect — what kind?</b><div class="keys">'+
      [['f','form control'],['t','text / font metric'],['l','layout'],['o','other']].map(([k,l])=>'<span class="key" onclick="cls(\''+k+'\')"><b>'+k+'</b>'+l+'</span>').join('')+'</div></div>'
     :'<div class="keys">'+
      '<span class="key g" onclick="judge(\'genuine\')"><b>1</b>genuine defect</span>'+
      '<span class="key e" onclick="judge(\'expected\')"><b>2</b>expected engine difference</span>'+
      '<span class="key a" onclick="judge(\'artifact\')"><b>3</b>tool artifact</span>'+
      '<span class="key" onclick="judge(\'skip\')"><b>s</b>skip</span>'+
      '<span class="key" onclick="undo()"><b>u</b>undo last</span>'+
      '<span class="key" onclick="note()"><b>n</b>note</span></div>')+
   (prev?'<div class="panel dim">already labelled: <b>'+(LBL[prev.label]||prev.label)+'</b>'+(prev.defectClass?' ('+prev.defectClass+')':'')+(prev.note?' — “'+prev.note+'”':'')+'</div>':'')+
   '<div class="panel dim" id="notebox" style="display:none">note (Enter to save)<input type="text" id="noteinput"></div>';
}
async function post(u,b){await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});}
let noteText='';
async function judge(label){
  const it=S.items[idx];
  if(label==='genuine'){pendingClass=true;render();return;}
  await post('/api/judge',{findingId:it.id,page:it.page,label,note:noteText||undefined,elapsedMs:Date.now()-t0});
  S.labels[it.id]={label,note:noteText||undefined}; noteText=''; sessionCount++;
  idx=order.findIndex(i=>!S.labels[S.items[i].id]); if(idx<0)idx=S.items.length;
  render();
}
async function cls(c){
  const it=S.items[idx];
  const defectClass={f:'form-control',t:'text-metric',l:'layout',o:'other'}[c];
  await post('/api/judge',{findingId:it.id,page:it.page,label:'genuine',defectClass,note:noteText||undefined,elapsedMs:Date.now()-t0});
  S.labels[it.id]={label:'genuine',defectClass,note:noteText||undefined}; noteText=''; sessionCount++; pendingClass=null;
  idx=order.findIndex(i=>!S.labels[S.items[i].id]); if(idx<0)idx=S.items.length;
  render();
}
async function undo(){
  const done=S.items.map((x,i)=>i).filter(i=>S.labels[S.items[i].id]);
  if(!done.length)return;
  const last=done[done.length-1], it=S.items[last];
  await post('/api/undo',{findingId:it.id});
  delete S.labels[it.id]; idx=last; pendingClass=null; sessionCount=Math.max(0,sessionCount-1); render();
}
function note(){
  const b=document.getElementById('notebox'),i=document.getElementById('noteinput');
  b.style.display='block'; i.value=noteText; i.focus();
  i.onkeydown=(e)=>{if(e.key==='Enter'){noteText=i.value;b.style.display='none';i.blur();}
                    if(e.key==='Escape'){b.style.display='none';i.blur();}};
}
addEventListener('keydown',e=>{
  if(document.activeElement&&document.activeElement.tagName==='INPUT')return;
  if(pendingClass){ if('ftlo'.includes(e.key))cls(e.key); if(e.key==='Escape'){pendingClass=null;render();} return; }
  if(e.key==='1')judge('genuine'); else if(e.key==='2')judge('expected'); else if(e.key==='3')judge('artifact');
  else if(e.key==='s')judge('skip'); else if(e.key==='u')undo(); else if(e.key==='n')note();
  else if(e.key==='r'){ // revisit skipped
    const i=S.items.findIndex(x=>S.labels[x.id]&&S.labels[x.id].label==='skip');
    if(i>=0){delete S.labels[S.items[i].id];idx=i;post('/api/undo',{findingId:S.items[i].id});render();}
  }
});
load();
</script></body></html>`;

server.listen(PORT, () => {
  console.log(`\n${DEMO ? 'DEMO MODE — synthetic entries, writes labels.demo.jsonl' : `${items.length} survivors to label`}`);
  console.log(`open  http://localhost:${PORT}`);
  console.log(`keys  1 genuine · 2 expected engine difference · 3 tool artifact · s skip · u undo · n note`);
  console.log(`saves to m0/results/${path.basename(LABELS)} after every judgement — safe to quit and resume\n`);
});
