// Shared guard: re-hash the corpus and compare to the frozen manifest.
// Imported by run.mjs, label.mjs and verdict.mjs so no stage can operate on a
// corpus that drifted from the one that was frozen.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

export function verifyCorpus(ROOT, { quiet = false } = {}) {
  const MANIFEST = path.join(ROOT, 'corpus/manifest.json');
  if (!fs.existsSync(MANIFEST)) {
    console.error('No m0/corpus/manifest.json — the corpus is not frozen. Run: node m0/scripts/freeze.mjs');
    process.exit(1);
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const bad = [];
  for (const p of m.pages) {
    const f = path.join(ROOT, p.file);
    if (!fs.existsSync(f)) { bad.push(`${p.id}: MISSING`); continue; }
    const h = sha(fs.readFileSync(f));
    if (h !== p.sha256) bad.push(`${p.id}: CHANGED (${p.sha256.slice(0, 8)} -> ${h.slice(0, 8)})`);
  }
  for (const a of m.assets) {
    const f = path.join(ROOT, a.file);
    if (!fs.existsSync(f)) { bad.push(`${a.file}: MISSING`); continue; }
    if (sha(fs.readFileSync(f)) !== a.sha256) bad.push(`${a.file}: CHANGED`);
  }
  if (bad.length) {
    console.error(`\nCORPUS TAMPERED — ${bad.length} file(s) differ from the frozen manifest:`);
    for (const b of bad) console.error('  ' + b);
    console.error('\nThe frozen corpus is what makes this measurement a base rate rather than a');
    console.error('demo. Restore the files (git checkout m0/corpus) or start a new corpus version.');
    process.exit(1);
  }
  if (!quiet) console.log(`corpus verified: ${m.pageCount} pages, hash ${m.corpusHash.slice(0, 16)}…`);
  return m;
}
