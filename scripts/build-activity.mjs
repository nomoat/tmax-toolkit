import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { build } from '../tmux-mobile/node_modules/esbuild/lib/main.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] || path.join(root, 'dist/tmax-activity.cjs'));
await mkdir(path.dirname(output), { recursive: true });
await build({
  entryPoints: [path.join(root, 'tmux-jump/scripts/tmax-activity-bundle.mjs')],
  outfile: output, bundle: true, platform: 'node', format: 'cjs', target: 'node20',
  legalComments: 'eof', minify: false,
  external: ['bufferutil', 'utf-8-validate'],
});
console.log(output);
