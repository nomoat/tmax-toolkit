const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// WebView has a separate, default-routed recorder. Do not let embedded pages
// bypass phone-only capture. Native T-MAX dictation remains available.
function restrictWebViewMicrophone(source) {
  const marker = '// T-MAX phone-only capture: embedded pages cannot select an input device.';
  if (source.includes(marker)) return source;
  const original = 'if (requestedResource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {\n                androidPermission = Manifest.permission.RECORD_AUDIO;';
  if (source.split(original).length !== 2) {
    throw new Error('Review react-native-webview microphone permissions before building phone-only capture.');
  }
  return source.replace(original,
    'if (requestedResource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {\n                ' + marker + '\n                continue;');
}

module.exports = config => withDangerousMod(config, ['android', async config => {
  const file = path.join(config.modRequest.projectRoot, 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java');
  const original = fs.readFileSync(file, 'utf8');
  const updated = restrictWebViewMicrophone(original);
  if (updated !== original) fs.writeFileSync(file, updated);
  return config;
}]);
module.exports.restrictWebViewMicrophone = restrictWebViewMicrophone;
