#!/usr/bin/env node
// Canonical browser/native ASR transport and provider preferences live in Web.
import { readFile, writeFile } from 'node:fs/promises';
for (const name of ['asr-provider.js', 'streaming-asr-session.js']) {
  const source = new URL(`../../tmux-mobile/public/${name}`, import.meta.url);
  const target = new URL(`../sources/tmux-mobile/${name}`, import.meta.url);
  const content = await readFile(source, 'utf8');
  if (process.argv.includes('--check')) {
    if (await readFile(target, 'utf8') !== content) throw new Error(`Run scripts/sync-asr.mjs: ${name} differs from Web`);
  } else await writeFile(target, content);
}
console.log('Shared ASR provider preferences and transport match Web.');
