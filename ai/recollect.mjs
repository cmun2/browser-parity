#!/usr/bin/env node
// Re-collect both frozen corpora with the widened computed-style set.
//
// Why this exists: `maxWidth` was added to scripts/funnel.mjs's SK list after
// the M0 study, because three of the seven findings the investigator could not
// explain were `max-width: <n>ch` caps and no rule can name a property that was
// never collected.
//
// What it does NOT do: regenerate m0/results/. The M0 numbers stand on the
// evidence they were measured from, and this writes to ai/.evidence-v2/
// instead. The corpora themselves are re-hashed and never written.
//
// It also checks the two things that would invalidate the exercise:
//   1. that the re-collected geometry matches the recorded run (engine drift), and
//   2. that the suppression funnel produces byte-identical counts.
// (2) is guaranteed structurally — no suppression rule reads `styles` — but
// "guaranteed" and "measured" are different words, so it is measured.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { LAUNCHERS, E, VIEWPORT, settle, collectFromPage, computeDeltas, funnel } from '../scripts/funnel.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const OUT = path.join(REPO, 'ai/.evidence-v2');

const SETS = [
  { name: 'm0', pages: path.join(REPO, 'm0/corpus/pages'), manifest: path.join(REPO, 'm0/corpus/manifest.json'),
    survivors: path.join(REPO, 'm0/results/survivors.json'), oldEvidence: path.join(REPO, 'm0/results/evidence') },
  { name: 'validation', pages: path.join(REPO, 'ai/.corpus-cache/validation-corpus/pages'),
    manifest: path.join(REPO, 'ai/.corpus-cache/validation-corpus/manifest.json'),
    survivors: path.join(REPO, 'ai/.corpus-cache/validation-survivors.json'),
    oldEvidence: path.join(REPO, 'm0/validation/results/evidence') },
];

const browsers = {}, pages = {}, engineVersions = {};
for (const [n, l] of Object.entries(LAUNCHERS)) {
  browsers[n] = await l.launch();
  engineVersions[n] = browsers[n].version();
  pages[n] = await (await browsers[n].newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage();
}
console.log('engines: ' + E.map(e => `${e} ${engineVersions[e]}`).join(' · '));

const report = { engineVersions, sets: {} };

for (const set of SETS) {
  const manifest = JSON.parse(fs.readFileSync(set.manifest, 'utf8'));
  const survivors = JSON.parse(fs.readFileSync(set.survivors, 'utf8'));
  // Re-hash the corpus. A byte that moved invalidates everything downstream.
  for (const p of manifest.pages) {
    const file = path.join(set.pages, path.basename(p.file));
    const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (sha !== p.sha256) { console.error(`CORPUS TAMPERED: ${p.id}`); process.exit(1); }
  }
  if (survivors.environment.engineVersions.chromium !== engineVersions.chromium
    || survivors.environment.engineVersions.firefox !== engineVersions.firefox
    || survivors.environment.engineVersions.webkit !== engineVersions.webkit) {
    console.error('ENGINE DRIFT — re-collected geometry is not comparable to the recorded run.');
    console.error('  recorded:', JSON.stringify(survivors.environment.engineVersions));
    console.error('  now     :', JSON.stringify(engineVersions));
    process.exit(1);
  }

  fs.mkdirSync(path.join(OUT, set.name), { recursive: true });
  const s = { pages: 0, nodes: 0, maxGeomDrift: 0, driftNodes: 0, funnelSame: 0, funnelDiff: [], withMaxWidth: 0, maxWidthNonNone: 0 };

  for (const p of manifest.pages) {
    const url = pathToFileURL(path.join(set.pages, path.basename(p.file))).href;
    const data = {};
    for (const e of E) { await settle(pages[e], url); data[e] = await collectFromPage(pages[e]); }

    // (1) geometry drift against the recorded dump, where one exists
    const oldFile = path.join(set.oldEvidence, p.id + '.json');
    if (fs.existsSync(oldFile)) {
      const old = JSON.parse(fs.readFileSync(oldFile, 'utf8')).data;
      for (const e of E) for (const k of Object.keys(data[e])) {
        const a = data[e][k], b = old[e]?.[k];
        if (!b) continue;
        const d = Math.max(Math.abs(a.w - b.w), Math.abs(a.h - b.h), Math.abs(a.rx - b.rx), Math.abs(a.ry - b.ry));
        if (d > s.maxGeomDrift) s.maxGeomDrift = d;
        if (d > 0.01) s.driftNodes++;
      }
    }

    // (2) funnel counts against the recorded survivors.json
    const { common, delta } = computeDeltas(data);
    const { stages, survivors: surv } = funnel(common, delta);
    const rec = survivors.pages.find(x => x.id === p.id);
    const now = Object.fromEntries(stages.map(x => [x.id, x.count]));
    if (rec && JSON.stringify(now) === JSON.stringify(rec.stageCounts) && surv.length === rec.survivorCount) s.funnelSame++;
    else s.funnelDiff.push({ page: p.id, recorded: rec?.stageCounts, now, recordedSurvivors: rec?.survivorCount, nowSurvivors: surv.length });

    for (const k of Object.keys(data.chromium)) {
      s.nodes++;
      if ('maxWidth' in (data.chromium[k].styles || {})) s.withMaxWidth++;
      if ((data.chromium[k].styles || {}).maxWidth && data.chromium[k].styles.maxWidth !== 'none') s.maxWidthNonNone++;
    }
    fs.writeFileSync(path.join(OUT, set.name, p.id + '.json'), JSON.stringify({ page: p.id, url, data }, null, 0));
    s.pages++;
    process.stdout.write('.');
  }
  console.log(`\n${set.name}: ${s.pages} pages, ${s.nodes} nodes · geometry drift max ${s.maxGeomDrift.toFixed(4)}px on ${s.driftNodes} nodes · funnel identical on ${s.funnelSame}/${s.pages} pages · maxWidth set (not "none") on ${s.maxWidthNonNone} nodes`);
  if (s.funnelDiff.length) console.log('  FUNNEL MOVED:', JSON.stringify(s.funnelDiff, null, 2));
  report.sets[set.name] = s;
}

for (const b of Object.values(browsers)) await b.close();
fs.writeFileSync(path.join(OUT, 'recollect-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('\nwrote ai/.evidence-v2/ — m0/results/ untouched');
