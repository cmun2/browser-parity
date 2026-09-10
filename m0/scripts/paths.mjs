// Which corpus is a given run operating on?
//
// M0 measured one corpus (m0/corpus + m0/results). The follow-up named in
// NEGATIVE-RESULT-TEMPLATE.md — "run the same briefs through a real coding agent
// and re-measure" — needs a SECOND corpus measured by the SAME pipeline, because
// changing the tool between the two corpora would make the comparison
// meaningless. So every stage takes an optional `--set <dir>`, and nothing else
// about any stage changes.
//
//   node m0/scripts/run.mjs                     -> m0/corpus,            m0/results
//   node m0/scripts/run.mjs --set validation    -> m0/validation/corpus, m0/validation/results
//
// A set directory holds `corpus/` (pages + manifest, frozen and hashed on its
// own) and `results/`. The two sets never share a manifest, a hash, a
// survivors.json or a labels file.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const M0 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(M0, '..');

export function resolveSet(argv = process.argv) {
  const i = argv.indexOf('--set');
  const raw = i >= 0 ? argv[i + 1] : null;
  if (i >= 0 && (!raw || raw.startsWith('--'))) {
    console.error('--set needs a directory, e.g. --set validation');
    process.exit(1);
  }
  const root = raw ? path.resolve(M0, raw) : M0;
  const rel = path.relative(REPO, root) || '.';
  return {
    name: raw || 'm0 (default)',
    isDefault: !raw,
    root,
    rel,
    corpusDir: path.join(root, 'corpus'),
    pagesDir: path.join(root, 'corpus/pages'),
    assetsDir: path.join(root, 'corpus/assets'),
    manifestPath: path.join(root, 'corpus/manifest.json'),
    specsPath: path.join(raw ? root : path.join(M0, 'scripts'), 'specs.mjs'),
    resultsDir: path.join(root, 'results'),
  };
}
