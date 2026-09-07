#!/usr/bin/env node
// Freeze the corpus. Run once, before the first measurement, and never again.
//
// Writes m0/corpus/manifest.json with a SHA-256 per page and a corpus hash over
// all of them. Every later stage re-verifies those hashes, so a page edited
// after results exist turns into a loud failure rather than a quiet better number.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SPECS, KIND_MIX } from './specs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = path.join(ROOT, 'corpus/pages');
const MANIFEST = path.join(ROOT, 'corpus/manifest.json');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

if (fs.existsSync(MANIFEST) && !process.argv.includes('--refreeze')) {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  console.error(`REFUSING: already frozen at ${m.frozenAt}, corpus hash ${m.corpusHash.slice(0, 16)}.`);
  console.error('A frozen corpus is the whole anti-cherry-picking mechanism. Re-freezing after');
  console.error('results exist voids them. Use --refreeze only if no run has happened yet.');
  process.exit(1);
}

const files = fs.readdirSync(PAGES).filter(f => f.endsWith('.html')).sort();
if (files.length !== SPECS.length) { console.error(`expected ${SPECS.length} pages, found ${files.length}`); process.exit(1); }

const pages = files.map(f => {
  const spec = SPECS.find(s => s.id === f.replace('.html', ''));
  const bytes = fs.readFileSync(path.join(PAGES, f));
  return { id: spec.id, file: `corpus/pages/${f}`, kind: spec.kind, mode: spec.mode,
    fontStack: spec.font, bytes: bytes.length, sha256: sha(bytes), prompt: spec.prompt };
});

const assets = fs.readdirSync(path.join(ROOT, 'corpus/assets')).sort()
  .map(f => ({ file: `corpus/assets/${f}`, sha256: sha(fs.readFileSync(path.join(ROOT, 'corpus/assets', f))) }));

// The corpus hash covers page bytes AND shared assets: a page can also be changed
// by editing the stylesheet it links.
const corpusHash = sha([...pages.map(p => p.id + ':' + p.sha256), ...assets.map(a => a.file + ':' + a.sha256)].join('\n'));

const manifest = {
  corpusVersion: 'm0-corpus-v1',
  corpusHash,
  frozen: true,
  frozenAt: new Date().toISOString(),
  pageCount: pages.length,
  mix: KIND_MIX,
  provenance: {
    origin: 'hand-authored',
    note: 'Pages are hand-authored in an AI-typical idiom, NOT emitted by a model. No hosted model was called (no-paid-API constraint). Each page records the brief it implements so the study can be repeated against real model output using the same 30 prompts. This is the study\'s primary external-validity limitation.',
    generator: 'm0/scripts/gen-corpus.mjs + m0/scripts/specs.mjs',
    deterministic: 'no Math.random, no Date, no timers, no animation, no network',
  },
  assets,
  pages,
};
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log(`FROZEN  ${pages.length} pages`);
console.log(`corpus hash: ${corpusHash}`);
console.log(`mix: ${Object.entries(KIND_MIX).map(([k, v]) => `${k}:${v}`).join(' ')}`);
console.log('\nCommit m0/corpus/ now, before running anything. Then: node m0/scripts/run.mjs');
