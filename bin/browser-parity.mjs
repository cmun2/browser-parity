#!/usr/bin/env node
// browser-parity — baseline-free cross-engine UI verification.
//
// Loads one URL in Chromium, Firefox and WebKit at the same moment, corresponds
// elements by structural path, and reports the geometry differences that survive
// the four suppression rules measured in M0. There is no baseline: the engines
// are each other's oracle.
//
// The detection logic lives in scripts/funnel.mjs and is not duplicated here —
// this file is argument parsing, output formatting and an exit code.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const { LAUNCHERS, settle, collectFromPage, computeDeltas, funnel, RULES, E, VIEWPORT } =
  await import(pathToFileURL(path.join(HERE, '..', 'scripts', 'funnel.mjs')).href);

const HELP = `browser-parity — baseline-free cross-engine UI verification

  npx browser-parity <url> [<url>...]

Options
  --viewport <WxH>  viewport for all three engines (default: 1280x900)
  --rules <list>    comma-separated suppression rules to apply, in order.
                    default: svg-interior,inline-text,tolerance,inherited-delta
                    'none' keeps every raw difference. Use this to see what a
                    rule is actually removing before trusting it.
  --json <file>     write findings as JSON instead of printing a table
  --max <n>         exit 1 when a page has more than n findings (default: off)
  --quiet           only print the per-URL finding count
  -h, --help        this

Exit codes
  0   ran, and no page exceeded --max
  1   a page exceeded --max
  2   could not load a URL in one or more engines

What a finding is, and is not
  A finding is credible evidence that Chromium, Firefox and WebKit lay the same
  element out differently. It is not proof of a visual bug — an engine difference
  can be correct. Playwright's WebKit is not Safari: a clean run does not clear
  Safari, and iOS is not covered at all.
`;

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('-h') || argv.includes('--help')) {
  process.stdout.write(HELP);
  process.exit(argv.length ? 0 : 2);
}

const opt = (name, fallback = undefined) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const jsonOut = opt('--json');
const max = opt('--max') === undefined ? null : Number(opt('--max'));
const quiet = argv.includes('--quiet');

// --viewport WxH. Engines must share one viewport or the comparison is void.
let viewport = VIEWPORT;
const vp = opt('--viewport');
if (vp !== undefined) {
  const m = /^(\d+)x(\d+)$/.exec(vp.trim());
  if (!m) { process.stderr.write(`--viewport wants WxH, e.g. 1280x900 (got ${vp})\n`); process.exit(2); }
  viewport = { width: Number(m[1]), height: Number(m[2]) };
}

// --rules. 'raw' is the floor and is always applied; the other four are opt-out,
// because a rule you cannot switch off is a rule you cannot check.
const OPTIONAL = RULES.filter(r => r.id !== 'raw').map(r => r.id);
let activeRules = RULES;
const rulesArg = opt('--rules');
if (rulesArg !== undefined) {
  const want = rulesArg.trim() === 'none' ? [] : rulesArg.split(',').map(x => x.trim()).filter(Boolean);
  const bad = want.filter(x => !OPTIONAL.includes(x));
  if (bad.length) {
    process.stderr.write(`unknown rule(s): ${bad.join(', ')}\nknown: ${OPTIONAL.join(', ')} (or 'none')\n`);
    process.exit(2);
  }
  activeRules = [RULES[0], ...want.map(id => RULES.find(r => r.id === id))];
}

/** Launch the three engines once and collect every URL through them. */
async function collectAllWith(url, pagesByEngine) {
  const data = {};
  for (const e of E) { await settle(pagesByEngine[e], url); data[e] = await collectFromPage(pagesByEngine[e]); }
  return data;
}

/** funnel() with only the selected rules. */
function funnelWith(common, delta, rules) {
  let keys = common; const stages = [];
  for (const rule of rules) {
    keys = keys.filter(k => rule.keep(k, delta[k], delta));
    stages.push({ id: rule.id, label: rule.label, count: keys.length });
  }
  return { stages, survivors: keys };
}
const urls = argv.filter((a, i) =>
  !a.startsWith('--') && argv[i - 1] !== '--json' && argv[i - 1] !== '--max');

if (!urls.length) { process.stderr.write('no URL given\n\n' + HELP); process.exit(2); }

const report = { tool: 'browser-parity', engines: E, viewport,
                 rules: activeRules.map(r => r.id), pages: [] };
let exceeded = false, failed = false;

// One launch per engine for the whole run, not one per URL.
const browsers = {}, pagesByEngine = {};
for (const e of E) {
  browsers[e] = await LAUNCHERS[e].launch();
  pagesByEngine[e] = await (await browsers[e].newContext(
    { viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage();
}

for (const url of urls) {
  let data;
  try {
    data = await collectAllWith(url, pagesByEngine);
  } catch (err) {
    failed = true;
    process.stderr.write(`\n${url}\n  could not load in all three engines: ${err.message}\n`);
    report.pages.push({ url, error: String(err.message) });
    continue;
  }
  const { common, delta } = computeDeltas(data);
  const { stages, survivors } = funnelWith(common, delta, activeRules);
  if (max !== null && survivors.length > max) exceeded = true;

  const findings = survivors.map(k => ({
    path: k, tag: delta[k].m.tag,
    relPx: +delta[k].rel.toFixed(2), sizePx: +delta[k].size.toFixed(2),
    dw: +delta[k].dw.toFixed(2), dh: +delta[k].dh.toFixed(2),
  })).sort((a, b) => Math.max(b.relPx, b.sizePx) - Math.max(a.relPx, a.sizePx));
  report.pages.push({ url, matched: common.length, stages, findings });

  if (quiet) { console.log(`${survivors.length}\t${url}`); continue; }
  if (jsonOut) continue;

  console.log(`\n${url}`);
  console.log(`  ${common.length} elements matched in all three engines`);
  for (const st of stages) console.log(`  ${st.label.padEnd(48)} ${String(st.count).padStart(5)}`);
  console.log(`  ${'findings'.padEnd(48)} ${String(findings.length).padStart(5)}`);
  if (findings.length) {
    console.log('\n  largest differences');
    for (const f of findings.slice(0, 10)) {
      console.log(`    ${String(Math.max(f.relPx, f.sizePx)).padStart(7)}px  ${f.tag.padEnd(8)} ${f.path.slice(-72)}`);
    }
    if (findings.length > 10) console.log(`    … ${findings.length - 10} more (use --json for all)`);
  }
}

for (const e of E) await browsers[e].close();

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  if (!quiet) console.log(`\nwrote ${jsonOut}`);
}
process.exit(failed ? 2 : exceeded ? 1 : 0);
