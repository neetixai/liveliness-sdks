# CocoaPods spec for the NeetixLiveliness SDK. Mirrors Package.swift
# (platforms iOS 14 / macOS 12, single library target, Apache-2.0).
#
# Paths are relative to the repo root, where CocoaPods checks out the tag, so
# everything below is prefixed `packages/swift/`. If this package is ever
# mirrored to the root of its own repo (which SPM's versioned git resolution
# wants — see PUBLISHING.md §3), drop those prefixes there. SPM consumers do
# not need this file; the package resolves via its git URL.
Pod::Spec.new do |s|
  s.name        = "NeetixLiveliness"
  s.version     = "0.2.0"
  s.summary     = "Neetix Liveliness API client + camera capture for iOS/macOS."
  s.description = <<-DESC
    Swift client for the Neetix Liveliness API — face match, passive/active
    liveliness (presentation-attack detection), biometric authentication and
    passport/ID MRZ parsing — plus an AVFoundation front-camera capture
    helper on iOS. Transport-only client; camera is gated behind UIKit so the
    library also builds for macOS. Same target as the Swift Package.
  DESC

  s.homepage = "https://github.com/neetixai/liveliness-sdks"
  s.license  = { :type => "Apache-2.0", :file => "packages/swift/LICENSE" }
  s.author   = { "Neetix" => "https://neetix.in" }
  s.source   = {
    :git => "https://github.com/neetixai/liveliness-sdks.git",
    :tag => s.version.to_s
  }

  s.swift_versions = ["5.9"]
  s.ios.deployment_target = "14.0"
  s.osx.deployment_target = "12.0"

  s.source_files = "packages/swift/Sources/NeetixLiveliness/**/*.swift"

  s.frameworks = "Foundation"
  s.ios.frameworks = "AVFoundation", "UIKit"
end
