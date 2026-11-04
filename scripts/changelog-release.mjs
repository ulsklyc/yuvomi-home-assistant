// Keeps yuvomi/CHANGELOG.md in step with the app version, which Home Assistant
// shows on every update.
//
//   node scripts/changelog-release.mjs          names the release: turns
//                                               "## Unreleased" (or nothing) into
//                                               "## <version>" with the Yuvomi link
//   node scripts/changelog-release.mjs --check  fails without a "## <version>" block
//
// Renovate bumps config.yaml and the Dockerfile but cannot write the changelog;
// the Changelog workflow runs the first form on its pull requests.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CONFIG = path.join(ROOT, 'yuvomi/config.yaml');
const CHANGELOG = path.join(ROOT, 'yuvomi/CHANGELOG.md');
const RELEASES = 'https://github.com/ulsklyc/yuvomi/releases/tag';

const version = readFileSync(CONFIG, 'utf8').match(/^version: "([^"]+)"$/m)?.[1];
if (!version) throw new Error('No version in yuvomi/config.yaml');

const text = readFileSync(CHANGELOG, 'utf8');
const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());

if (headings.includes(version)) {
  console.log(`CHANGELOG has a ${version} block.`);
  process.exit(0);
}
if (process.argv.includes('--check')) {
  console.error(
    `yuvomi/config.yaml says ${version}, but yuvomi/CHANGELOG.md has no "## ${version}" block. `
    + 'Home Assistant shows that block on the update; run node scripts/changelog-release.mjs.',
  );
  process.exit(1);
}

const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};
const isVersion = (v) => /^\d+\.\d+\.\d+$/.test(v);
const previous = headings.find(isVersion);

// Yuvomi releases this bump skips over, so the block links each of them.
async function skippedReleases() {
  if (!previous) return [];
  try {
    const res = await fetch('https://api.github.com/repos/ulsklyc/yuvomi/releases?per_page=50', {
      headers: process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {},
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json())
      .filter((r) => !r.draft && !r.prerelease)
      .map((r) => r.tag_name.replace(/^v/, ''))
      .filter((v) => isVersion(v) && cmp(v, previous) > 0 && cmp(v, version) < 0)
      .sort(cmp);
  } catch (err) {
    console.error(`Could not list the Yuvomi releases (${err.message}); linking ${version} only.`);
    return [];
  }
}

const link = (v) => `[${v}](${RELEASES}/v${v})`;
const skipped = await skippedReleases();
let basedOn = `- Based on [Yuvomi ${version}](${RELEASES}/v${version})`;
if (skipped.length) basedOn += `\n  (changes since ${previous}: ${skipped.map(link).join(',\n  ')})`;
basedOn += '.';

const block = `## ${version}\n\n${basedOn}\n`;
let out;
if (/^## Unreleased\s*$/m.test(text)) {
  out = text.replace(/^## Unreleased\s*\n\n?/m, `${block}`);
} else {
  const first = text.search(/^## /m);
  out = first === -1 ? `${text.trimEnd()}\n\n${block}` : `${text.slice(0, first)}${block}\n${text.slice(first)}`;
}
writeFileSync(CHANGELOG, out);
console.log(`Named the ${version} block in yuvomi/CHANGELOG.md.`);
