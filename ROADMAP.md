# ROADMAP

Status: ✅ done · 🚧 in progress · ⬜ not started

## M0 — Project setup 🚧
- ✅ Git repo, `.gitignore`, `CLAUDE.md`
- ✅ Agent team (`.claude/agents/`)
- ✅ Algorithm-core Swift package (`Core/`, module `BodybuildingCore`), verified via the dependency-free `CoreCheck` harness (`swift run`) — no Xcode needed
- ✅ First verified brick: `EWMATrend` baseline + trend-recovery / noise-rejection / degenerate-input checks (all pass)
- ⬜ Install Xcode (Mac App Store); migrate `CoreCheck` to an XCTest target (`swift test`)
- ⬜ Decide app working name; first commit

## M1 — Weight engine (core only — no Xcode) ⬜
The hard, novel part. All verified with `swift test` against synthetic ground truth.
- ⬜ State-space (Kalman) trend estimator: trend + slope + **confidence interval**, irregular sampling
- ⬜ Ideal rate-of-loss curve: **non-linear** (target %BW/week, deceleration toward goal leanness, metabolic-adaptation aware, arrive-early buffer)
- ⬜ Change detection: on-track / too-slow / too-fast with controlled false-positive rate and bounded detection latency
- ⬜ Recommendation rules (rule-based, cited): hold / adjust intake / add activity / diet break
- ⬜ Projection-to-goal with uncertainty

## M2 — Weight app shell (needs Xcode) ⬜
- ⬜ SwiftData model + iCloud/CloudKit sync
- ⬜ Manual weigh-in entry + HealthKit read (smart scales)
- ⬜ Goal setup (e.g., "16-week prep from 15% BF")
- ⬜ Signature trend chart: faint raw dots + trend line + confidence band + ideal curve + projection
- ⬜ On/off-track status + recommendation surface

## M3 — Lift engine (core) ⬜
- ⬜ e1RM estimation (formula choice + validity range; down-weight high-rep)
- ⬜ Weekly hard sets per muscle (volume landmarks)
- ⬜ RIR / proximity-to-failure tracking
- ⬜ Strength trend via the shared estimator; tests

## M4 — Lift app UI ⬜

## M5 — Adaptive TDEE + nutrition bridge ⬜
- ⬜ Estimate maintenance from the intake↔weight-change relationship (MacroFactor-style)
- ⬜ HealthKit nutrition read (MyFitnessPal / Cronometer write to Health → we read)

## Stretch
- ⬜ AI coach (Claude API over the structured data + rule engine)
- ⬜ CV body-composition / measurement aid (honest about ±accuracy)
- ⬜ Android (would require revisiting the native-only stack decision)

## Pre-ship checklist (later)
- ⬜ Apple Developer Program enrollment ($99/yr)
- ⬜ App icon, screenshots, privacy nutrition labels, App Store listing
