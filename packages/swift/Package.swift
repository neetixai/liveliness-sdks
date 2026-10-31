// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "NeetixLiveliness",
    platforms: [.iOS(.v14), .macOS(.v12)],
    products: [
        .library(name: "NeetixLiveliness", targets: ["NeetixLiveliness"])
    ],
    targets: [
        .target(name: "NeetixLiveliness", path: "Sources/NeetixLiveliness"),
        .testTarget(
            name: "NeetixLivelinessTests",
            dependencies: ["NeetixLiveliness"],
            path: "Tests/NeetixLivelinessTests"
        ),
    ]
)
