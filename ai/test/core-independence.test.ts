// The dependency arrow must never reverse.
//
// ARCHITECTURE.md R7: core/ is a library with no knowledge that the AI layer
// exists, and the AI layer can be deleted without touching it. This test
// enforces that by actually deleting it: the repo is copied to a temp directory
// *without* ai/, and the suppression funnel — the interesting logic, the thing
// that is the product — is imported and run there.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('no file outside ai/ imports from ai/', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'ai', 'out'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(mjs|js|ts|cjs)$/.test(entry.name)) continue;
      const src = fs.readFileSync(full, 'utf8');
      if (/\bfrom\s+['"][^'"]*\bai\//.test(src) || /\bimport\s*\(\s*['"][^'"]*\bai\//.test(src)) {
        offenders.push(path.relative(REPO, full));
      }
    }
  };
  walk(REPO);
  assert.deepEqual(offenders, [], `core files importing ai/: ${offenders.join(', ')}`);
});

test('the deterministic core builds and runs with ai/ deleted', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-no-ai-'));
  try {
    for (const name of ['scripts', 'package.json']) {
      fs.cpSync(path.join(REPO, name), path.join(tmp, name), { recursive: true });
    }
    fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
    assert.equal(fs.existsSync(path.join(tmp, 'ai')), false, 'ai/ must not be present in the copy');

    // Import the funnel and run it on synthetic evidence: three engines, three
    // nodes, one real divergence. No browser, no network, no ai/.
    const probe = `
      import { computeDeltas, funnel, RULES } from './scripts/funnel.mjs';
      const node = (over) => ({ w: 100, h: 20, rx: 0, ry: 0, ax: 0, ay: 0, tag: 'DIV', ns: false,
        disp: 'block', ppath: 'BODY[1]', sel: '', text: '', styles: {}, ...over });
      const data = {
        chromium: { 'BODY[1]': node({}), 'BODY[1]/DIV[1]': node({ w: 100 }), 'BODY[1]/SPAN[1]': node({ disp: 'inline', w: 40 }) },
        firefox:  { 'BODY[1]': node({}), 'BODY[1]/DIV[1]': node({ w: 120 }), 'BODY[1]/SPAN[1]': node({ disp: 'inline', w: 48 }) },
        webkit:   { 'BODY[1]': node({}), 'BODY[1]/DIV[1]': node({ w: 100 }), 'BODY[1]/SPAN[1]': node({ disp: 'inline', w: 40 }) },
      };
      const { common, delta } = computeDeltas(data);
      const { stages, survivors } = funnel(common, delta);
      console.log(JSON.stringify({ rules: RULES.length, common: common.length, survivors }));
    `;
    fs.writeFileSync(path.join(tmp, 'probe.mjs'), probe);
    const out = execFileSync(process.execPath, ['probe.mjs'], { cwd: tmp, encoding: 'utf8' });
    const result = JSON.parse(out.trim().split('\n').pop()!);

    assert.equal(result.rules, 5, 'all five funnel stages present');
    assert.equal(result.common, 3, 'all three nodes corresponded');
    assert.deepEqual(result.survivors, ['BODY[1]/DIV[1]'], 'the 20px DIV survives; the inline SPAN is suppressed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
