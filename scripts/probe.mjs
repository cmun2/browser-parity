import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ENGINES = { chromium, firefox, webkit };
const FIXTURE = 'file://' + path.resolve('fixtures/cases.html');
const STYLE_KEYS = ['display','position','fontFamily','fontSize','lineHeight','marginTop','marginBottom',
  'paddingTop','paddingLeft','borderTopWidth','borderLeftWidth','flexBasis','minWidth','width','height',
  'overflowX','appearance','boxSizing','whiteSpace'];

const out = {};
for (const [name, launcher] of Object.entries(ENGINES)) {
  const browser = await launcher.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(FIXTURE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const data = await page.evaluate((keys) => {
    const res = { probes: {}, env: {} };
    res.env = {
      innerWidth: innerWidth, innerHeight: innerHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      scrollbarWidth: innerWidth - document.documentElement.clientWidth,
      dpr: devicePixelRatio, ua: navigator.userAgent,
    };
    for (const el of document.querySelectorAll('[data-probe]')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const styles = {};
      for (const k of keys) styles[k] = cs[k];
      res.probes[el.dataset.probe] = {
        rect: { x: +r.x.toFixed(3), y: +r.y.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3) },
        scrollW: el.scrollWidth, scrollH: el.scrollHeight,
        clientW: el.clientWidth, clientH: el.clientHeight,
        text: (el.textContent || '').trim().slice(0, 60),
        styles,
      };
    }
    return res;
  }, STYLE_KEYS);
  out[name] = data;
  fs.mkdirSync('out', { recursive: true });
  await page.screenshot({ path: `out/${name}.png`, fullPage: true });
  await browser.close();
  console.error(`[${name}] ok — ${Object.keys(data.probes).length} probes`);
}
fs.writeFileSync('out/probes.json', JSON.stringify(out, null, 2));
console.error('wrote out/probes.json');
