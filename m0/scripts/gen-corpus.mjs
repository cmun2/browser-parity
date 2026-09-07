#!/usr/bin/env node
// Generate the 30-page M0 corpus from m0/scripts/specs.mjs.
//
// Deterministic: same input -> byte-identical output. Refuses to run once the
// corpus is frozen, because regenerating a page after seeing how it scored is
// the exact failure mode this study exists to avoid.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS, KIND_MIX } from './specs.mjs';
import { rng } from './components.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = path.join(ROOT, 'corpus/pages');
const ASSETS = path.join(ROOT, 'corpus/assets');
const MANIFEST = path.join(ROOT, 'corpus/manifest.json');

const force = process.argv.includes('--unfreeze-and-regenerate');
if (fs.existsSync(MANIFEST)) {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (m.frozen && !force) {
    console.error(`REFUSING: corpus was frozen at ${m.frozenAt} (hash ${m.corpusHash.slice(0, 12)}).`);
    console.error('Regenerating after measurement invalidates the base rate. If you genuinely need a');
    console.error('new corpus, run with --unfreeze-and-regenerate; that stamps the manifest as a NEW');
    console.error('corpus version and any existing results become void.');
    process.exit(1);
  }
}

const util = fs.readFileSync(path.join(ASSETS, 'util.css'), 'utf8');

function render(spec) {
  const r = rng(spec.id);
  const body = spec.build(r, spec);
  const styleHref = spec.mode === 'inline'
    ? `<style>\n${util}\n</style>`
    : `<link rel="stylesheet" href="../assets/util.css">`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${spec.id}</title>
<!-- M0 corpus page. Spec: ${spec.kind}. See m0/corpus/SPECS.md for the brief. -->
${styleHref}
<style>
body{font-family:${spec.font}}
${spec.css || ''}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

fs.mkdirSync(PAGES, { recursive: true });
for (const f of fs.readdirSync(PAGES)) if (f.endsWith('.html')) fs.unlinkSync(path.join(PAGES, f));

let bytes = 0;
for (const spec of SPECS) {
  const html = render(spec);
  fs.writeFileSync(path.join(PAGES, spec.id + '.html'), html);
  bytes += Buffer.byteLength(html);
}

// SPECS.md — the human-readable record of what was asked for.
const md = `# M0 corpus specifications

30 pages. Written and frozen **before** any cross-engine measurement was run.

**These pages are hand-authored in an AI-typical idiom, not emitted by a model.**
No hosted model was called (the study runs under a no-paid-API constraint), so
every page here was written by hand to look like what a coding agent produces:
utility classes or a single embedded stylesheet, inline stroke icons, system
font stacks, flex/grid scaffolding, native form controls, no build step. Each
page's \`prompt\` below is the brief it implements, so the identical study can be
re-run later against a real model's output using the same 30 briefs. Treat this
as the study's main external-validity limitation — see \`m0/README.md\`.

## Mix

${Object.entries(KIND_MIX).map(([k, v]) => `- **${k}** — ${v} page${v > 1 ? 's' : ''}`).join('\n')}

Stylesheet delivery: ${SPECS.filter(s => s.mode === 'linked').length} pages link a shared
\`assets/util.css\`, ${SPECS.filter(s => s.mode === 'inline').length} inline the same
vocabulary in a \`<style>\` block (single-file output, as agents commonly emit).
Every page additionally carries its own page-specific CSS block, which is where
the layout variety lives.

## Determinism

No \`Math.random\`, no \`Date\`, no timers, no animation, no network requests. A page
that renders differently on two loads is indistinguishable from a page where the
engines disagree — the research fixtures demonstrate this directly, where a live
clock in \`fixtures/cases.html\` makes the funnel report 17 or 18 findings at
random. The runner re-collects one engine twice per page and flags any page that
disagrees with itself.

## The 30 briefs

${SPECS.map((s, i) => `### ${i + 1}. \`${s.id}\`

- **kind:** ${s.kind}
- **font stack:** \`${s.font.split(',')[0]}…\`
- **stylesheet:** ${s.mode === 'inline' ? 'inlined (single file)' : 'linked util.css'}

> ${s.prompt}
`).join('\n')}
`;
fs.writeFileSync(path.join(ROOT, 'corpus/SPECS.md'), md);

console.log(`generated ${SPECS.length} pages (${(bytes / 1024).toFixed(0)} KB) -> m0/corpus/pages/`);
console.log(`mix: ${Object.entries(KIND_MIX).map(([k, v]) => `${k}:${v}`).join(' ')}`);
console.log('wrote m0/corpus/SPECS.md');
console.log('\nnext: node m0/scripts/smoke.mjs   (sanity-check pages in one engine, before freezing)');
