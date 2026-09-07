import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const ENGINES = { chromium, firefox, webkit };
const file = process.argv[2];
const out = {};
for (const [name, launcher] of Object.entries(ENGINES)) {
  const b = await launcher.launch();
  const p = await (await b.newContext({ viewport:{width:1280,height:800}, deviceScaleFactor:1 })).newPage();
  await p.goto('file://' + path.resolve(file), { waitUntil:'load' });
  await p.waitForTimeout(200);
  out[name] = await p.evaluate(() => {
    const res = {};
    for (const el of document.querySelectorAll('[data-probe]')) {
      const r = el.getBoundingClientRect();
      const pr = el.parentElement.getBoundingClientRect();
      res[el.dataset.probe] = {
        w:+r.width.toFixed(3), h:+r.height.toFixed(3),
        // parent-relative offsets: cancels inherited vertical cascade
        rx:+(r.x-pr.x).toFixed(3), ry:+(r.y-pr.y).toFixed(3),
        ax:+r.x.toFixed(3), ay:+r.y.toFixed(3),
      };
    }
    return res;
  });
  await b.close();
}
fs.writeFileSync(process.argv[3], JSON.stringify(out,null,2));
const E=['chromium','firefox','webkit'];
const ids=Object.keys(out.chromium);
const cnt={abs:0,rel:0,size:0};
const detail=[];
for (const id of ids){
  const v=E.map(e=>out[e][id]);
  const d=k=>Math.max(...v.map(q=>q[k]))-Math.min(...v.map(q=>q[k]));
  const abs=Math.max(d('ax'),d('ay')), rel=Math.max(d('rx'),d('ry')), size=Math.max(d('w'),d('h'));
  if(abs>0.5)cnt.abs++; if(rel>0.5)cnt.rel++; if(size>0.5)cnt.size++;
  if(rel>0.5||size>0.5) detail.push(`  ${id.padEnd(14)} relΔ=${rel.toFixed(2).padStart(7)} sizeΔ=${size.toFixed(2).padStart(7)}  w:${v.map(q=>q.w).join('/')} h:${v.map(q=>q.h).join('/')}`);
}
console.log(`\n### ${file}  (n=${ids.length} probes, threshold 0.5px)`);
console.log(`  diverging by ABSOLUTE page coords : ${cnt.abs}/${ids.length}`);
console.log(`  diverging by PARENT-RELATIVE pos  : ${cnt.rel}/${ids.length}`);
console.log(`  diverging by SIZE (w/h)           : ${cnt.size}/${ids.length}`);
console.log('  --- surviving signals ---'); console.log(detail.join('\n')||'  (none)');
