#!/usr/bin/env node
// Bundle the canonical Web contract, never maintain a second action order.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const source = sourceIndex >= 0 ? args[sourceIndex + 1] : '../tmux-mobile/public/card-actions.js';
const deployedIndex = args.indexOf('--deployed');
if (!source) throw new Error('--source requires a local file or HTTPS URL');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'sources/tmux-mobile/card-actions.js');
const metadata = resolve(root, 'sources/tmux-mobile/card-actions.source.json');
const load = async path => {
  if (!path.startsWith('https://')) return readFile(path, 'utf8');
  const response = await fetch(path, { redirect: 'error' });
  if (!response.ok) throw new Error(`Cannot read card action contract: HTTP ${response.status}`);
  return response.text();
};
let content, license;
if (deployedIndex >= 0) {
  // Controller static assets require a browser session. Resolve the deployed
  // clean Git revision through public health, then read that exact source via
  // the publisher's existing GitHub login; do not copy browser credentials.
  const controller = new URL(args[deployedIndex + 1]);
  if (controller.protocol !== 'https:') throw new Error('--deployed requires HTTPS');
  const response = await fetch(new URL('/api/health', controller), { redirect: 'error' });
  if (!response.ok) throw new Error(`Cannot read deployed revision: HTTP ${response.status}`);
  const health = await response.json();
  const commit = /^([0-9a-f]{7,40})-\d{8}T\d{6}Z$/.exec(health.revision || '')?.[1];
  if (!commit) throw new Error('Controller must serve a clean, committed revision before OTA publication');
  const atCommit = name => execFileSync('gh', ['api', `repos/cjzeroxaa/tmux-mobile/contents/public/${name}?ref=${commit}`, '-H', 'Accept: application/vnd.github.raw+json'], { encoding: 'utf8' });
  content = atCommit('card-actions.js');
  license = atCommit('card-actions.LICENSE');
  console.log(`Checking card actions against deployed Web revision ${health.revision}.`);
} else {
  content = await load(source);
  license = await load(source.replace(/\.js$/, '.LICENSE'));
}
const receipt = JSON.stringify({ source: 'cjzeroxaa/tmux-mobile:public/card-actions.js', sha256: createHash('sha256').update(content).digest('hex') }, null, 2) + '\n';
if (args.includes('--check')) {
  if (await readFile(target, 'utf8') !== content || await readFile(metadata, 'utf8') !== receipt || await readFile(target.replace(/\.js$/, '.LICENSE'), 'utf8') !== license) {
    throw new Error('Card actions differ from Web. Run scripts/sync-card-actions.mjs, then test and commit.');
  }
  console.log('Card action order, labels and icon geometry match Web.');
} else {
  await writeFile(target, content);
  await writeFile(target.replace(/\.js$/, '.LICENSE'), license);
  await writeFile(metadata, receipt);
  console.log('Bundled canonical card actions and license.');
}
