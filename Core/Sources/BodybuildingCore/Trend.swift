import Foundation

/// Seconds in a day — converts `Date` intervals to days.
private let secondsPerDay: Double = 86_400

/// Trend / rate utilities over a bodyweight series.
public enum Trend {
    /// Ordinary-least-squares slope of mass vs. time, in **kg per day**.
    ///
    /// Time is measured in days relative to the first sample. Returns `nil`
    /// for fewer than two samples, or when all samples share an instant
    /// (zero time variance).
    public static func slopePerDay(_ samples: [BodyweightSample]) -> Double? {
        guard samples.count >= 2 else { return nil }
        let sorted = samples.sorted { $0.date < $1.date }
        let t0 = sorted[0].date
        let ts = sorted.map { $0.date.timeIntervalSince(t0) / secondsPerDay }
        let ys = sorted.map(\.massKg)
        let n = Double(ts.count)
        let tMean = ts.reduce(0, +) / n
        let yMean = ys.reduce(0, +) / n
        var sxx = 0.0
        var sxy = 0.0
        for i in ts.indices {
            let dt = ts[i] - tMean
            sxx += dt * dt
            sxy += dt * (ys[i] - yMean)
        }
        guard sxx > 0 else { return nil }
        return sxy / sxx
    }
}

/// Exponentially-weighted moving-average trend smoother — the **baseline**
/// trend estimator (cf. the "trend weight" of TrendWeight / The Hacker's Diet).
///
/// This is the baseline, not the final estimator: it lags the true trend by
/// ~(1−α)/α days and reports no uncertainty. The production engine will be a
/// state-space (Kalman) filter that reports a confidence band; EWMA stays as
/// the reference the Kalman version is validated against.
/// Reference: J. Walker, "The Hacker's Diet" (1991), trend chapter.
public struct EWMATrend: Sendable {
    /// Per-day smoothing factor α ∈ (0, 1]. Smaller = smoother, more lag.
    public let smoothingPerDay: Double

    public init(smoothingPerDay: Double = 0.1) {
        precondition(smoothingPerDay > 0 && smoothingPerDay <= 1,
                     "smoothingPerDay must be in (0, 1]")
        self.smoothingPerDay = smoothingPerDay
    }

    /// Smoothed trend, one point per input sample (sorted by date).
    ///
    /// Irregular spacing is handled by compounding the smoothing over the
    /// elapsed days: α_eff = 1 − (1−α)^Δdays, so a long gap pulls the trend
    /// most of the way toward the next observation instead of under-reacting.
    public func trend(of samples: [BodyweightSample]) -> [BodyweightSample] {
        let sorted = samples.sorted { $0.date < $1.date }
        guard let first = sorted.first else { return [] }
        var t = first.massKg
        var out: [BodyweightSample] = [first]
        out.reserveCapacity(sorted.count)
        for i in 1..<sorted.count {
            let dDays = sorted[i].date.timeIntervalSince(sorted[i - 1].date) / secondsPerDay
            let aEff = 1 - pow(1 - smoothingPerDay, max(dDays, 0))
            t += aEff * (sorted[i].massKg - t)
            out.append(BodyweightSample(date: sorted[i].date, massKg: t))
        }
        return out
    }
}
