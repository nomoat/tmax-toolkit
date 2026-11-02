Pod::Spec.new do |s|
  s.name             = 'CJMUXVisionDevice'
  s.version          = '1.0.0'
  s.summary          = 'Detects iOS compatibility mode on Apple Vision Pro.'
  s.description      = 'Exposes the Apple-supported iOS-on-Vision runtime signal to CJMUX.'
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
