// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BodybuildingCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "BodybuildingCore", targets: ["BodybuildingCore"]),
    ],
    targets: [
        .target(name: "BodybuildingCore"),
        // Dependency-free verification harness — runs on the bare Swift
        // toolchain (XCTest / Swift Testing ship only with Xcode). Run with
        // `swift run --package-path Core CoreCheck`. Once Xcode is installed
        // this is superseded by an XCTest target and `swift test`
        // (see Tests/BodybuildingCoreTests/, dormant until then).
        .executableTarget(
            name: "CoreCheck",
            dependencies: ["BodybuildingCore"]
        ),
    ]
)
