// swift-tools-version:5.9
// Root manifest so SPM consumers can pin release tags:
//   .package(url: "https://github.com/neetixai/liveliness-sdks.git", from: "0.1.0")
// Sources live under swift/ to keep the per-language repo layout.
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
            path: "swift/Sources/NeetixLiveliness"
        ),
        .testTarget(
            name: "NeetixLivelinessTests",
            dependencies: ["NeetixLiveliness"],
            path: "swift/Tests/NeetixLivelinessTests"
        ),
    ]
)
