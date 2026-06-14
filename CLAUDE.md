# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A bodybuilding logging app for iOS (Apple App Store), built for **natural** (drug-free) athletes. Two non-negotiable goals:

1. **Evidence-based.** Every target, default, and recommendation traces to current hypertrophy/nutrition research with a citation in code or docs. "Plausible-looking" is not enough — algorithms are validated against synthetic ground truth and literature values.
2. **Presentation-quality UX.** The charts *are* the product. Trend visualization must be clear, honest, and beautiful — not a debug plot.

Tier-1 features:
- **Bodyweight tracking** — trend extraction from noisy daily weigh-ins, a non-linear ideal rate-of-loss curve, on-track / too-slow / too-fast detection with confidence, and recommendations.
- **Lift tracking** — estimated 1RM, weekly volume per muscle, proximity-to-failure (RIR), and long- vs short-term strength trend.

**Key insight:** both features are the same problem — *state estimation on a noisy biological time series*. One shared estimator (trend + rate + confidence interval + change detection) underpins both. Build and verify it once.

Stack: native **SwiftUI** + **SwiftData/CloudKit** (local-first, iCloud sync). The algorithm core is a platform-agnostic Swift package (`Core/`, module `BodybuildingCore`), testable with `swift test` on the command-line toolchain — no Xcode required. The app shell needs Xcode.

Milestones and status live in `ROADMAP.md` — read it at the start of a session and keep it current as work lands.

## Commands

```bash
swift run --package-path Core CoreCheck   # verify the algorithm core (works today, no Xcode)
swift build --package-path Core           # build the core package
cd Core && swift test                     # full XCTest suite — ONCE Xcode is installed
# App build/run requires Xcode (Mac App Store) + an iOS simulator — not yet installed.
```

Note: `XCTest` and Swift Testing ship only with Xcode, which isn't installed yet, so verification currently runs through the dependency-free `CoreCheck` harness (exits non-zero on failure). The XCTest target in `Core/Tests/` is dormant until Xcode lands.

## Architecture

- `Core/Sources/BodybuildingCore/` — the pure-Swift algorithm engine. **No SwiftUI / SwiftData / HealthKit / UIKit imports here, ever** — that is what keeps it CLI-testable and portable. The app is a thin layer over this.
  - **Units:** mass is stored canonically in **kilograms** (SI); time in days. kg↔lb conversion is a display concern, never persisted.
  - `Trend` / `EWMATrend` — the shared trend estimator. EWMA is the **baseline**; the production estimator is a state-space (Kalman) filter reporting trend, slope, and a confidence band. EWMA stays as the reference the Kalman version is validated against.
  - (planned) ideal-curve generator (non-linear loss target), change detection (on/off-track), e1RM, weekly volume per muscle, adaptive TDEE.
- `App/` — (added once Xcode is installed) SwiftUI views, SwiftData models, HealthKit read, iCloud sync, Swift Charts. Thin over the core; no algorithms here.

## Conventions

- SI units in the core (kg, days); convert at the UI boundary only.
- Route nothing scientific through magic numbers — named constants with a comment citing the source (mirror the spec's citation into the code).
- A feature is done only when a check verifies it against synthetic ground truth or a literature value, with an explicit tolerance and a comment citing the reference — in the `CoreCheck` harness now, in an XCTest target under `Core/Tests/` once Xcode is installed.
- Evidence provenance: rate targets, volume landmarks, formula choices, and RIR guidance each carry a citation (Schoenfeld meta-analyses; Helms / 3DMJ natural prep; Stronger By Science / MASS / MacroFactor; RP volume landmarks).
- Visualization changes are rendered and visually inspected before being called done.

## Agent team

Specialized subagents live in `.claude/agents/`. Use them at the right stage:

- **hypertrophy-scientist** — before implementing any new training/nutrition behavior: produces a cited spec of what the research supports (rates, volume/intensity landmarks, refeed logic). Returns a spec, not code.
- **quant-modeler** — designs the estimators and statistics (trend filter, change detection, e1RM, TDEE) and their acceptance tests; may prototype numerically. Returns an algorithm spec.
- **ios-engineer** — implements the Swift core and the SwiftUI/SwiftData/HealthKit app from specs.
- **verification-engineer** — writes and runs the `swift test` suite against synthetic ground truth and literature values, with explicit tolerances.
- **ux-designer** — presentation-quality charts and app UX; owns the visual-style source of truth; renders and inspects before finishing.

Typical feature flow: hypertrophy-scientist spec → quant-modeler algorithm design → ios-engineer implement → verification-engineer tests → ux-designer visuals.

## Hotfire mode

`/hotfire on|off` toggles the autonomous work mode (defined in
`.claude/skills/hotfire/SKILL.md`). If `permissions.defaultMode` is
`"dontAsk"` in `.claude/settings.local.json`, Hotfire is ACTIVE and its
contract is binding: a review of every milestone diff (verification-engineer
for algorithm/math changes, `/code-review` at medium+), the full `swift test`
suite green before every commit, a cited source for every new science default,
render-and-inspect any visualization (once Xcode/simulator is available),
checkpoint commits pre-authorized at milestone boundaries, and stop at the
~20%-usage signal (harness limit warnings, or the second auto-compaction) —
finish the current item, commit, update ROADMAP.md, and end with a
cold-readable handoff report. Ships OFF by default; turn it on with
`/hotfire on`.
