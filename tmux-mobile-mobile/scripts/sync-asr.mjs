#!/usr/bin/env node
// Canonical browser/native ASR transport and provider preferences live in Web.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const targetIndex = process.argv.indexOf('--target');
if (targetIndex >= 0 && !process.argv[targetIndex + 1]) throw new Error('--target requires the native source directory');
const targetRoot = targetIndex >= 0 ? pathToFileURL(resolve(process.argv[targetIndex + 1]) + '/') : new URL('../sources/tmux-mobile/', import.meta.url);
for (const name of ['asr-provider.js', 'streaming-asr-session.js']) {
  const source = new URL(`../../tmux-mobile/public/${name}`, import.meta.url);
  const target = new URL(name, targetRoot);
  const content = await readFile(source, 'utf8');
  if (process.argv.includes('--check')) {
    if (await readFile(target, 'utf8') !== content) throw new Error(`Run scripts/sync-asr.mjs: ${name} differs from Web`);
  } else await writeFile(target, content);
}
console.log('Shared ASR provider preferences and transport match Web.');
