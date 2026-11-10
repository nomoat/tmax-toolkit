import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { ASSET_ORIGIN } from '../lib/draft-assets.mjs';

const listeners = {};
vm.runInNewContext(await readFile(new URL('../public/draft-frame.js', import.meta.url), 'utf8'), {
  URL,
  parent: { postMessage() {} },
  window: { addEventListener() {} },
  document: {
    addEventListener(type, callback) { listeners[type] = callback; },
    createElement() { return {}; },
    head: { append() {} },
  },
});
function blocked(href, { download = true, trusted = true } = {}) {
  let prevented = false;
  const link = { href, hasAttribute: name => name === 'download' && download };
  listeners.click({ isTrusted: trusted, target: { closest: () => link }, preventDefault() { prevented = true; } });
  return prevented;
}
const asset = `${ASSET_ORIGIN}/${'a'.repeat(64)}/${'b'.repeat(64)}.mp4`;
assert.equal(blocked(asset + '?token=signed-object'), false);
assert.equal(blocked(asset + '?token=signed-object', { trusted: false }), true);
assert.equal(blocked(asset + '?token=signed-object', { download: false }), true);
for (const href of [asset, '#chapter', 'https://example.com/file.mp4?token=x',
  `${ASSET_ORIGIN}/api/drafts?token=x`, asset.replace('https://', 'https://user@') + '?token=x',
  'javascript:alert(1)', 'data:text/html,hello']) assert.equal(blocked(href), true);
listeners.click({ target: { closest: () => null }, preventDefault() { assert.fail('non-link click blocked'); } });
console.log('Draft review downloads: trusted signed managed assets allowed; navigation, other origins, unsigned URLs and synthetic clicks blocked');
