import Foundation
import BodybuildingCore

// Dependency-free verification harness for BodybuildingCore.
//
// XCTest and Swift Testing both ship with Xcode, which isn't installed yet, so
// the core is verified here with a plain executable that exits non-zero on any
// failure. Run with: `swift run --package-path Core CoreCheck`.
// Migrates to a `swift test` XCTest target once Xcode lands; the dormant
// Tests/BodybuildingCoreTests/TrendTests.swift mirrors these checks for then.

/// Minimal assertion accumulator (kept out of global state for Swift 6).
struct Checker {
    var failures = 0

    mutating func check(_ ok: Bool, _ msg: String) {
        print(ok ? "  ✓ \(msg)" : "  ✗ FAIL: \(msg)")
        if !ok { failures += 1 }
    }

    mutating func checkClose(_ got: Double, _ want: Double, tol: Double, _ msg: String) {
        check(abs(got - want) <= tol,
              "\(msg) — got \(fmt(got)), want \(want) ± \(tol)")
    }
}

func fmt(_ x: Double) -> String { String(format: "%.5f", x) }

// MARK: - Deterministic synthetic data (fixed-seed LCG + Box–Muller)

struct SeededGaussian {
    private var state: UInt64
    init(seed: UInt64) { state = seed }

    private mutating func nextUnit() -> Double {       // uniform (0, 1)
        state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        return (Double(state >> 11) + 0.5) / Double(1 << 53)
    }

    mutating func nextNormal() -> Double {
        let u1 = nextUnit()
        let u2 = nextUnit()
        return (-2 * log(u1)).squareRoot() * cos(2 * .pi * u2)
    }
}

func syntheticCut(days: Int, startKg: Double, ratePerDay: Double,
                  noiseSDkg: Double, seed: UInt64) -> [BodyweightSample] {
    var rng = SeededGaussian(seed: seed)
    let day0 = Date(timeIntervalSince1970: 0)
    return (0..<days).map { d in
        let mass = startKg + ratePerDay * Double(d) + noiseSDkg * rng.nextNormal()
        return BodyweightSample(date: day0.addingTimeInterval(Double(d) * 86_400), massKg: mass)
    }
}

func varianceOfDiffs(_ xs: [Double]) -> Double {
    let diffs = zip(xs.dropFirst(), xs).map { $0 - $1 }
    let mean = diffs.reduce(0, +) / Double(diffs.count)
    return diffs.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(diffs.count)
}

// MARK: - Checks

var c = Checker()
print("BodybuildingCore verification\n")

// 1. Trend recovery: EWMA must recover the true −0.1 kg/day after a 20-day
//    warm-up window (the EWMA startup transient is curved and biases slope).
//    Noise SD 0.7 kg ≈ realistic daily fluctuation for a ~100 kg athlete.
do {
    let s = syntheticCut(days: 60, startKg: 100, ratePerDay: -0.1, noiseSDkg: 0.7, seed: 0xC0FFEE)
    let trend = EWMATrend(smoothingPerDay: 0.1).trend(of: s)
    let slope = Trend.slopePerDay(Array(trend.dropFirst(20)))!
    c.checkClose(slope, -0.1, tol: 0.02, "EWMA recovers true loss rate (kg/day)")
}

// 2. Noise rejection: the trend's day-to-day variance must be far below the
//    raw signal's (here, at least 4× lower).
do {
    let s = syntheticCut(days: 60, startKg: 100, ratePerDay: -0.1, noiseSDkg: 0.7, seed: 0xBEEF)
    let trend = EWMATrend(smoothingPerDay: 0.1).trend(of: s)
    let rawVar = varianceOfDiffs(s.map(\.massKg))
    let trendVar = varianceOfDiffs(trend.map(\.massKg))
    c.check(trendVar < rawVar * 0.25,
            "EWMA cuts day-to-day variance >4× — raw \(fmt(rawVar)), trend \(fmt(trendVar))")
}

// 3. Degenerate inputs: OLS slope is undefined below two samples.
do {
    c.check(Trend.slopePerDay([]) == nil, "slope is nil for an empty series")
    let one = [BodyweightSample(date: Date(timeIntervalSince1970: 0), massKg: 80)]
    c.check(Trend.slopePerDay(one) == nil, "slope is nil for a single sample")
}

print("")
if c.failures == 0 {
    print("All checks passed. ✅")
    exit(0)
} else {
    print("\(c.failures) check(s) failed. ❌")
    exit(1)
}
