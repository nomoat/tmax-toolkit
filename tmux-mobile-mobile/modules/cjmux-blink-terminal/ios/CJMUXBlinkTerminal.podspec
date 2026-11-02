Pod::Spec.new do |s|
  s.name             = 'CJMUXBlinkTerminal'
  s.version          = '1.0.0'
  s.summary          = 'Embedded Blink SSH terminal for CJMUX.'
  s.description      = 'Embeds Blink hterm rendering and Blink SSH.framework inside the CJMUX iOS app.'
  s.author           = 'CJMUX'
  s.homepage         = 'https://eng.impo.ai'
  s.license          = { type: 'GPL-3.0-or-later', file: 'Resources/Blink-COPYING' }
  s.platforms        = { ios: '16.4' }
  s.source           = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Keep framework headers out of this pod's generated umbrella header. CocoaPods
  # otherwise treats every header inside Vendor/*.xcframework as our public API,
  # which both selects the wrong architecture and imports libssh/openssl twice.
  s.source_files = '*.swift'
  s.resource_bundles = {
    'CJMUXBlinkTerminalResources' => [
      'Resources/term.html',
      'Resources/term.css',
      'Resources/term.js',
      'Resources/base64js.min.js',
      'Resources/hterm_all.min.js',
      'Resources/hterm_all.patches.js',
      'Resources/webfontloader.js',
      'Resources/Blink-COPYING',
      'Resources/Blink-UPSTREAM'
    ]
  }
  s.vendored_frameworks = [
    'Vendor/SSH.xcframework',
    'Vendor/BlinkFiles.xcframework',
    'Vendor/LibSSH.xcframework',
    'Vendor/OpenSSH.xcframework',
    'Vendor/openssl.xcframework'
  ]
  s.frameworks = 'UIKit', 'WebKit', 'Network', 'Security', 'Combine'
  s.libraries = 'z', 'c++'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'OTHER_LDFLAGS' => '$(inherited) -ObjC -lz -lc++',
  }
end
