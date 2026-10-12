Pod::Spec.new do |s|
  s.name = 'ShroomUsbSerial'
  s.version = '0.1.0'
  s.summary = 'DriverKit user client for Shroom pressure sensors on iPadOS.'
  s.description = 'Reads CH340 data through the bundled ShroomCH340 DriverKit extension.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Shroom'
  s.homepage = 'https://shroom.jq-industries.com'
  s.platform = :ios, '16.0'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,hpp,m,mm,swift}'
  s.private_header_files = ['ShroomDriverABI.h', 'PressureFrameParser.hpp']
  s.public_header_files = 'ShroomDriverClient.h'
  s.frameworks = 'IOKit', 'UIKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_VERSION' => '5.0', 'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17' }
end
