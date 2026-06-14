import Foundation

/// A single bodyweight measurement.
///
/// Mass is stored canonically in **kilograms** (SI). Display-unit conversion
/// (kg ↔ lb) is a UI concern and is never persisted in the core.
public struct BodyweightSample: Sendable, Equatable {
    /// The instant the measurement was taken.
    public let date: Date
    /// Body mass in kilograms.
    public let massKg: Double

    public init(date: Date, massKg: Double) {
        self.date = date
        self.massKg = massKg
    }
}
