Pod::Spec.new do |s|
  s.name             = 'CJMUXKeyboardShortcuts'
  s.version          = '1.0.0'
  s.summary          = 'Hardware keyboard shortcuts for the CJMUX command center.'
  s.description      = 'Exposes iPad UIKeyCommand events to the CJMUX React Native application.'
  s.author           = 'CJMUX'
  s.homepage         = 'https://eng.impo.ai'
  s.platforms        = { :ios => '16.4' }
  s.source           = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
