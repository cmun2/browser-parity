#!/usr/bin/env node
// Freeze a corpus. Run once per corpus, before its first measurement, and never
// again.
//
// Writes <set>/corpus/manifest.json with a SHA-256 per page and a corpus hash
// over all of them. Every later stage re-verifies those hashes, so a page edited
// after results exist turns into a loud failure rather than a quiet better number.
//
//   node m0/scripts/freeze.mjs                  freeze m0/corpus
//   node m0/scripts/freeze.mjs --set validation freeze m0/validation/corpus
//
// Each set is frozen independently and refuses to re-freeze independently.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolveSet, M0 } from './paths.mjs';

const SET = resolveSet();
const ROOT = SET.root;
const PAGES = SET.pagesDir;
const MANIFEST = SET.manifestPath;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

// The specs module for this set: m0/scripts/specs.mjs for the default corpus,
// <set>/specs.mjs for any other. It supplies the briefs, the corpus version and
// the provenance statement — freeze.mjs asserts, it does not author.
const { SPECS, KIND_MIX, CORPUS_VERSION, PROVENANCE, CORPUS_LIMITATIONS } = await import(pathToFileURL(SET.specsPath).href);

if (fs.existsSync(MANIFEST) && !process.argv.includes('--refreeze')) {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  console.error(`REFUSING: ${m.corpusVersion} already frozen at ${m.frozenAt}, corpus hash ${m.corpusHash.slice(0, 16)}.`);
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

// A corpus of self-contained single-file pages has no shared assets; that is a
// legitimate shape, not a missing directory.
const assets = fs.existsSync(SET.assetsDir)
  ? fs.readdirSync(SET.assetsDir).sort()
      .map(f => ({ file: `corpus/assets/${f}`, sha256: sha(fs.readFileSync(path.join(SET.assetsDir, f))) }))
  : [];

// The corpus hash covers page bytes AND shared assets: a page can also be changed
// by editing the stylesheet it links.
const corpusHash = sha([...pages.map(p => p.id + ':' + p.sha256), ...assets.map(a => a.file + ':' + a.sha256)].join('\n'));

const manifest = {
  corpusVersion: CORPUS_VERSION ?? 'm0-corpus-v1',
  corpusHash,
  frozen: true,
  frozenAt: new Date().toISOString(),
  pageCount: pages.length,
  mix: KIND_MIX,
  provenance: PROVENANCE ?? {
    origin: 'hand-authored',
    note: 'Pages are hand-authored in an AI-typical idiom, NOT emitted by a model. No hosted model was called (no-paid-API constraint). Each page records the brief it implements so the study can be repeated against real model output using the same 30 prompts. This is the study\'s primary external-validity limitation.',
    generator: 'm0/scripts/gen-corpus.mjs + m0/scripts/specs.mjs',
    deterministic: 'no Math.random, no Date, no timers, no animation, no network',
  },
  // Corpus-specific caveats, frozen with the corpus so verdict.mjs reports the
  // caveats belonging to the corpus it actually measured.
  limitations: CORPUS_LIMITATIONS,
  assets,
  pages,
};
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

const setArg = SET.isDefault ? '' : ` --set ${path.relative(M0, ROOT)}`;
console.log(`FROZEN  ${manifest.corpusVersion} — ${pages.length} pages`);
console.log(`corpus hash: ${corpusHash}`);
console.log(`mix: ${Object.entries(KIND_MIX).map(([k, v]) => `${k}:${v}`).join(' ')}`);
console.log(`\nCommit ${SET.rel}/corpus/ now, before running anything. Then: node m0/scripts/run.mjs${setArg}`);
