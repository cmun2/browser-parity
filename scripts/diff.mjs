import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('out/probes.json','utf8'));
const E = ['chromium','firefox','webkit'];
console.log('=== ENV ===');
for (const e of E) console.log(e.padEnd(9), JSON.stringify(d[e].env, (k,v)=> k==='ua'?undefined:v));
console.log('\n=== GEOMETRY DIVERGENCE (max abs delta across engines, px) ===');
const ids = Object.keys(d.chromium.probes);
const rows = [];
for (const id of ids) {
  const p = E.map(e => d[e].probes[id]);
  const r = {};
  for (const k of ['w','h','x','y']) {
    const vals = p.map(q => q.rect[k]);
    r[k] = { vals, delta: Math.max(...vals) - Math.min(...vals) };
  }
  const maxDelta = Math.max(...Object.values(r).map(v=>v.delta));
  rows.push({ id, r, maxDelta, text: p[0].text });
}
rows.sort((a,b)=>b.maxDelta-a.maxDelta);
for (const row of rows) {
  if (row.maxDelta < 0.02) continue;
  const parts = Object.entries(row.r).filter(([,v])=>v.delta>=0.02)
    .map(([k,v])=>`${k}: C=${v.vals[0]} F=${v.vals[1]} W=${v.vals[2]} (Δ${v.delta.toFixed(2)})`);
  console.log(`${row.maxDelta.toFixed(2).padStart(8)}px  ${row.id.padEnd(14)} ${parts.join('  |  ')}`);
}
console.log('\n=== IDENTICAL GEOMETRY (Δ<0.02) ===');
console.log(rows.filter(r=>r.maxDelta<0.02).map(r=>r.id).join(', ') || '(none)');

console.log('\n=== COMPUTED STYLE DIVERGENCE ===');
for (const id of ids) {
  const p = E.map(e => d[e].probes[id]);
  const keys = Object.keys(p[0].styles);
  const diffs = keys.filter(k => new Set(p.map(q=>q.styles[k])).size > 1);
  if (diffs.length) {
    console.log(`\n${id}:`);
    for (const k of diffs) console.log(`   ${k.padEnd(16)} C=${JSON.stringify(p[0].styles[k])} F=${JSON.stringify(p[1].styles[k])} W=${JSON.stringify(p[2].styles[k])}`);
  }
}
console.log('\n=== SCROLL OVERFLOW DIVERGENCE ===');
for (const id of ids) {
  const p = E.map(e => d[e].probes[id]);
  for (const k of ['scrollW','scrollH','clientW','clientH']) {
    const v = p.map(q=>q[k]);
    if (new Set(v).size>1) console.log(`${id.padEnd(14)} ${k.padEnd(8)} C=${v[0]} F=${v[1]} W=${v[2]}`);
  }
}
