#!/usr/bin/env node
// Generate the synthetic fixtures that `label.mjs --demo` walks.
//
// Every entry is visibly stamped SYNTHETIC, ids are prefixed DEMO-, and the demo
// writes to labels.demo.jsonl, which verdict.mjs refuses to read. This exists so
// the labelling flow can be exercised end to end without inventing a single real
// finding.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'fixtures');
const SHOTS = path.join(FIX, 'demoshots');
fs.mkdirSync(SHOTS, { recursive: true });

const E = ['chromium', 'firefox', 'webkit'];
const CASES = [
  { id: 'DEMO-1', tag: 'BUTTON', page: 'DEMO-page-a', kind: 'demo', path: 'BODY[1]/DIV[2]/BUTTON[1]', selector: '.btn.primary',
    text: 'Save changes', display: 'inline-flex', w: [140, 152, 138], h: [40, 42, 40], label: 'looks like a text-metric case' },
  { id: 'DEMO-2', tag: 'INPUT', page: 'DEMO-page-a', kind: 'demo', path: 'BODY[1]/FORM[1]/INPUT[3]', selector: '#date',
    text: '', display: 'inline-block', w: [143, 137.8, 98.1], h: [38, 38, 34], label: 'looks like a form control' },
  { id: 'DEMO-3', tag: 'DIV', page: 'DEMO-page-b', kind: 'demo', path: 'BODY[1]/MAIN[1]/DIV[1]/DIV[2]', selector: '.card',
    text: 'Ingest volume 1.4 TB', display: 'flex', w: [320, 320, 251], h: [128, 128, 128], label: 'looks like a real layout defect' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
for (const c of CASES) {
  for (let i = 0; i < E.length; i++) {
    const w = c.w[i], h = c.h[i];
    await page.setContent(`<body style="margin:0;font:13px system-ui;background:#fff">
      <div style="padding:24px">
        <div style="width:${w}px;height:${h}px;border:2px solid #4f46e5;border-radius:6px;
             display:flex;align-items:center;justify-content:center;background:#eef2ff;overflow:hidden">
          <span style="color:#4f46e5;font-weight:600">${w} × ${h}</span>
        </div>
      </div>
      <div style="position:absolute;top:0;left:0;background:#7c2d12;color:#fed7aa;font:11px/1 system-ui;padding:4px 8px">SYNTHETIC — ${E[i]}</div>
    </body>`);
    await page.screenshot({ path: path.join(SHOTS, `${c.id}.${E[i]}.png`), clip: { x: 0, y: 0, width: Math.max(...c.w) + 60, height: Math.max(...c.h) + 60 } });
  }
}
await browser.close();

const findings = CASES.map(c => ({
  id: c.id, page: c.page, kind: c.kind, path: c.path, selector: c.selector, tag: c.tag,
  display: c.display, text: c.text || `SYNTHETIC demo entry — ${c.label}`,
  selfConsistent: true,
  maxDeltaPx: +Math.max(Math.max(...c.w) - Math.min(...c.w), Math.max(...c.h) - Math.min(...c.h)).toFixed(2),
  properties: [
    { prop: 'width', deltaPx: +(Math.max(...c.w) - Math.min(...c.w)).toFixed(2), values: Object.fromEntries(E.map((e, i) => [e, c.w[i]])) },
    { prop: 'height', deltaPx: +(Math.max(...c.h) - Math.min(...c.h)).toFixed(2), values: Object.fromEntries(E.map((e, i) => [e, c.h[i]])) },
  ].filter(p => p.deltaPx > 0.5),
  geometry: Object.fromEntries(E.map((e, i) => [e, { w: c.w[i], h: c.h[i], rx: 0, ry: 0, ax: 24, ay: 24 }])),
  styleDiffs: { fontFamily: { chromium: '"Segoe UI", sans-serif', firefox: '"Segoe UI", sans-serif', webkit: 'Segoe UI, sans-serif' } },
  shots: Object.fromEntries(E.map(e => [e, `demoshots/${c.id}.${e}.png`])),
}));
fs.writeFileSync(path.join(FIX, 'demo-survivors.json'),
  JSON.stringify({ SYNTHETIC: true, warning: 'Fabricated entries for exercising the labelling UI. Never part of any real result. verdict.mjs refuses labels marked synthetic.', findings }, null, 2) + '\n');
console.log(`wrote ${findings.length} synthetic findings + ${findings.length * 3} demo crops`);
console.log('try it:  node m0/scripts/label.mjs --demo');
