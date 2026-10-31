// swift-tools-version:5.9
// Root manifest so SPM consumers can pin release tags:
//   .package(url: "https://github.com/neetixai/liveliness-sdks.git", from: "0.2.0")
// SwiftPM only looks for Package.swift at the repository root, so this has to
// live here even though the sources sit under packages/swift/ with every other
// platform. packages/swift/Package.swift stays for local `swift build` inside
// that directory; keep the two in step.
import PackageDescription

let package = Package(
    name: "NeetixLiveliness",
    platforms: [.iOS(.v14), .macOS(.v12)],
    products: [
        .library(name: "NeetixLiveliness", targets: ["NeetixLiveliness"])
    ],
    targets: [
        .target(
            name: "NeetixLiveliness",
            path: "packages/swift/Sources/NeetixLiveliness"
        ),
        .testTarget(
            name: "NeetixLivelinessTests",
            dependencies: ["NeetixLiveliness"],
            path: "packages/swift/Tests/NeetixLivelinessTests"
        ),
    ]
)
