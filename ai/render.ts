// Verdict rendering. Terminal and Markdown; no web UI, no service.

import type { EvidenceBundle, Investigation } from './types.ts';
import { ENGINES } from './types.ts';

const SOURCE_LABEL: Record<Investigation['source'], string> = {
  'known-cause': 'deterministic rule',
  mock: 'mock provider (fixture)',
  model: 'model',
};

const VERDICT_LABEL: Record<Investigation['verdict'], string> = {
  defect: 'DEFECT',
  'expected-engine-difference': 'EXPECTED',
  unclear: 'UNDECIDED',
};

function wrap(s: string, width: number, indent: string): string {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line.length + w.length + 1 > width) { lines.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  return lines.map((l) => indent + l).join('\n');
}

export function renderTerminal(inv: Investigation, e: EvidenceBundle): string {
  const L: string[] = [];
  L.push(`${inv.findingId}   <${e.element.tag.toLowerCase()}>${e.element.selector ? ' ' + e.element.selector : ''}`);
  L.push(`  ${VERDICT_LABEL[inv.verdict]}  ·  ${inv.cause}  ·  confidence ${inv.confidence}  ·  ${SOURCE_LABEL[inv.source]}${inv.ruleId ? ` (${inv.ruleId})` : ''}`);
  L.push('');
  L.push(wrap(inv.summary, 96, '  '));
  L.push('');
  for (const p of e.properties) {
    L.push(`    ${p.prop.padEnd(9)} Δ${p.deltaPx.toFixed(2).padStart(8)}px   ` + ENGINES.map((x) => `${x} ${p.values[x]}`).join('   '));
  }
  L.push('');
  L.push(wrap(inv.mechanism, 96, '  '));
  if (inv.fix) {
    L.push('');
    L.push('  fix');
    L.push(wrap(inv.fix.description, 92, '    '));
    if (inv.fix.css) for (const line of inv.fix.css.split('\n')) L.push('      ' + line);
  }
  if (inv.unresolved?.length) {
    L.push('');
    L.push('  unresolved');
    for (const u of inv.unresolved) L.push(wrap(u, 92, '    '));
  }
  if (e.crops.chromium.file) {
    L.push('');
    L.push('  crops   ' + ENGINES.map((x) => `${x} ${e.crops[x].width}x${e.crops[x].height}`).join('   '));
  }
  return L.join('\n');
}

export function renderMarkdown(items: Array<{ inv: Investigation; evidence: EvidenceBundle }>): string {
  const L: string[] = [];
  L.push('# BrowserParity — investigation report');
  L.push('');
  const byVerdict = { defect: 0, 'expected-engine-difference': 0, unclear: 0 };
  const bySource = { 'known-cause': 0, model: 0, mock: 0 };
  for (const { inv } of items) { byVerdict[inv.verdict]++; bySource[inv.source]++; }
  L.push(`${items.length} finding${items.length === 1 ? '' : 's'} · ` +
    `${byVerdict.defect} defect, ${byVerdict['expected-engine-difference']} expected, ${byVerdict.unclear} undecided`);
  L.push('');
  L.push(`Explained without a model: **${bySource['known-cause']} of ${items.length}**. ` +
    (bySource.model + bySource.mock > 0
      ? `${bySource.model + bySource.mock} went to the investigator.`
      : 'The investigator was not used.'));
  L.push('');

  const env = items[0]?.evidence.environment;
  if (env) {
    L.push('```');
    L.push(ENGINES.map((x) => `${x} ${env.engineVersions[x]}`).join(' · '));
    L.push(`playwright ${env.playwrightVersion} · ${env.os} · ${env.viewport.width}x${env.viewport.height} @${env.deviceScaleFactor}x · normalization: ${env.normalizationPreset}`);
    L.push('```');
    L.push('');
    L.push('> Playwright\'s WebKit is not Safari. A finding here is credible evidence of cross-engine divergence; the absence of one does not clear Safari, and iOS is not covered.');
    L.push('');
  }

  for (const { inv, e } of items.map((i) => ({ inv: i.inv, e: i.evidence }))) {
    L.push(`## ${inv.findingId} — ${inv.cause}`);
    L.push('');
    L.push(`**${VERDICT_LABEL[inv.verdict]}** · confidence ${inv.confidence} · ${SOURCE_LABEL[inv.source]}${inv.ruleId ? ` \`${inv.ruleId}\`` : ''}`);
    L.push('');
    L.push(inv.summary);
    L.push('');
    L.push(`\`<${e.element.tag.toLowerCase()}>${e.element.selector ? ' ' + e.element.selector : ''}\` at \`${e.element.path}\``);
    L.push('');
    L.push('| property | Δ | chromium | firefox | webkit |');
    L.push('|---|---:|---:|---:|---:|');
    for (const p of e.properties) {
      L.push(`| ${p.prop} | ${p.deltaPx.toFixed(2)}px | ${p.values.chromium} | ${p.values.firefox} | ${p.values.webkit} |`);
    }
    L.push('');
    L.push(inv.mechanism);
    L.push('');
    if (inv.fix) {
      L.push(`**Fix.** ${inv.fix.description}`);
      if (inv.fix.css) { L.push(''); L.push('```css'); L.push(inv.fix.css); L.push('```'); }
      L.push('');
    }
    if (inv.unresolved?.length) {
      L.push('**Unresolved.** ' + inv.unresolved.join(' '));
      L.push('');
    }
    if (inv.evidenceCited.length) {
      L.push(`<sub>evidence: ${inv.evidenceCited.map((x) => `\`${x}\``).join(', ')}</sub>`);
      L.push('');
    }
  }
  return L.join('\n');
}
