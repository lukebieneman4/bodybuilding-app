import XCTest
@testable import BodybuildingCore

final class TrendTests: XCTestCase {

    // MARK: - Deterministic synthetic data

    /// Standard-normal noise via Box–Muller over a fixed-seed LCG, so the
    /// verification is reproducible on any machine (no platform RNG).
    private struct SeededGaussian {
        private var state: UInt64
        init(seed: UInt64) { state = seed }

        private mutating func nextUnit() -> Double {     // uniform (0, 1)
            state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
            let bits = state >> 11                         // top 53 bits
            return (Double(bits) + 0.5) / Double(1 << 53)
        }

        mutating func nextNormal() -> Double {
            let u1 = nextUnit()
            let u2 = nextUnit()
            return (-2 * log(u1)).squareRoot() * cos(2 * .pi * u2)
        }
    }

    /// `days` daily weigh-ins on a linear true trend plus Gaussian noise.
    private func syntheticCut(days: Int, startKg: Double, ratePerDay: Double,
                              noiseSDkg: Double, seed: UInt64) -> [BodyweightSample] {
        var rng = SeededGaussian(seed: seed)
        let day0 = Date(timeIntervalSince1970: 0)
        return (0..<days).map { d in
            let trueMass = startKg + ratePerDay * Double(d)
            let observed = trueMass + noiseSDkg * rng.nextNormal()
            return BodyweightSample(date: day0.addingTimeInterval(Double(d) * 86_400),
                                    massKg: observed)
        }
    }

    /// Variance of the day-to-day first differences of a series.
    private func varianceOfDiffs(_ xs: [Double]) -> Double {
        let diffs = zip(xs.dropFirst(), xs).map { $0 - $1 }
        let mean = diffs.reduce(0, +) / Double(diffs.count)
        return diffs.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(diffs.count)
    }

    // MARK: - Tests

    /// The smoother must recover the true loss rate from a noisy cut.
    /// Ground truth: −0.1 kg/day. Tolerance ±0.02 kg/day, measured after a
    /// 20-day warm-up window is dropped (the EWMA startup transient is curved
    /// and would bias the slope). Daily noise SD 0.7 kg ≈ realistic for a
    /// ~100 kg athlete (~0.7% BW).
    func testEWMARecoversTrueLossRate() {
        let samples = syntheticCut(days: 60, startKg: 100, ratePerDay: -0.1,
                                   noiseSDkg: 0.7, seed: 0xC0FFEE)
        let trend = EWMATrend(smoothingPerDay: 0.1).trend(of: samples)
        let steady = Array(trend.dropFirst(20))
        let slope = Trend.slopePerDay(steady)!
        XCTAssertEqual(slope, -0.1, accuracy: 0.02,
                       "EWMA trend slope should recover the true −0.1 kg/day rate")
    }

    /// Smoothing must actually reject noise: the trend's day-to-day variance
    /// should be far below the raw signal's (here, at least 4× lower).
    func testEWMARejectsNoise() {
        let samples = syntheticCut(days: 60, startKg: 100, ratePerDay: -0.1,
                                   noiseSDkg: 0.7, seed: 0xBEEF)
        let trend = EWMATrend(smoothingPerDay: 0.1).trend(of: samples)
        let rawVar = varianceOfDiffs(samples.map(\.massKg))
        let trendVar = varianceOfDiffs(trend.map(\.massKg))
        XCTAssertLessThan(trendVar, rawVar * 0.25,
                          "EWMA trend should cut day-to-day variance by >4×")
    }

    /// OLS slope is undefined for fewer than two samples.
    func testSlopeDegenerateInputs() {
        XCTAssertNil(Trend.slopePerDay([]))
        let one = [BodyweightSample(date: Date(timeIntervalSince1970: 0), massKg: 80)]
        XCTAssertNil(Trend.slopePerDay(one))
    }
}
