import { chromium, firefox, webkit } from 'playwright';
const F=['anchor-name:--a','position-anchor:--a','field-sizing:content','text-wrap:balance','text-wrap:pretty',
 'line-clamp:2','scrollbar-gutter:stable','text-box-trim:trim-both','grid-template-columns:subgrid',
 'container-type:inline-size','aspect-ratio:16/9','overflow:clip','width:50cqw','height:100dvh','view-transition-name:x'];
for (const [n,l] of Object.entries({chromium,firefox,webkit})) {
  const b=await l.launch(); const p=await b.newPage();
  const r=await p.evaluate((F)=>F.map(f=>{const [k,v]=[f.slice(0,f.indexOf(':')),f.slice(f.indexOf(':')+1)];
    return CSS.supports(k,v)?'Y':'.'}), F);
  console.log(n.padEnd(9), r.join(' '));
  await b.close();
}
console.log('props    ', F.map(f=>f.split(':')[0].slice(0,1)).join(' '));
console.log(F.map((f,i)=>`${i}:${f}`).join('  '));
