# ROADMAP

Status: ✅ done · 🚧 in progress · ⬜ not started

**Direction change (2026-06-14):** pivoted from native iOS to a **client-side web
app** (`web/`, Vite + Svelte 5 + TypeScript, local-first). The Swift `Core/`
package and the Python `prototypes/` are now the validated *reference oracles*;
the living algorithm core is `web/src/lib/core/` (TS), verified to reproduce the
Python golden values. Apple Developer enrollment / App Store are deferred until
the web tool proves itself in real use (a diet phase). See
`.claude` memory and CLAUDE.md.

## M0 — Project setup ✅
- ✅ Git repo, `.gitignore`, `CLAUDE.md`, agent team, baseline commit
- ✅ Swift `Core/` (BodybuildingCore) + `CoreCheck` (EWMA baseline) — reference
- ✅ Python `prototypes/` M1 estimator (Kalman + ideal curve), Monte-Carlo validated
- ✅ Node toolchain installed (~/.local/node; PATH in shell profiles)

## M1 — Weight engine (TS core) ✅
- ✅ State-space (Kalman) trend estimator + RTS smoother: trend, slope, 95% band
- ✅ Trailing-rate, projection-to-goal (ETA + range), non-linear ideal-loss curve
- ✅ vitest parity suite vs Python golden values (8/8) — `prototypes/gen_golden.py`

## M2 — Weight app shell (web) ✅
- ✅ Signature trend chart (SVG/d3): dots + trend + band + ideal + projection + goal/target lines + stat card
- ✅ Intake form (profile, prefilled), quick daily weight+calorie logging
- ✅ localStorage persistence, CSV import/export, synthetic-data generator
- ⬜ (later) IndexedDB/Dexie migration if data volume grows

## M3 — Insights ✅
- ✅ Rule-based, cited recommendations (Helms 2014, Garthe 2011, Morton 2018, Byrne 2018, Tipton 2015)
- ✅ Recovery-aware (ACL): conservative-rate + protein cautions; rate/pace, goal-range, diet-break, protein, data-sufficiency rules
- ✅ 6 rule tests

## M4 — Calories + adaptive TDEE ✅
- ✅ Cited spec + estimator: energy balance `TDEE = meanIntake − ρ·rate` (ρ≈7700
  kcal/kg, Wishnofsky 1958 / Hall 2008) over a trailing 28-day window, fed by the
  shared trend slope (not raw weight diffs) — `web/src/lib/core/tdee.ts`
- ✅ Validation vs synthetic ground truth: clean-limit exact (<1 kcal), low-bias
  Monte-Carlo (|bias|<75, MAE≈140≈5%), honest CI band, no-bump bias-isolation
  test, forward-model self-consistency — 7 vitest tests; verification-engineer
  reviewed (band sd switched from filtered-endpoint to smoothed-slope after review)
- ✅ Weight read tie-in: cited "maintenance ~X, eating ~Y → predicted rate"
  insight (`analyzeIntake` + maintenance insight)
- ✅ Calorie/maintenance chart: intake scatter + rolling adaptive-TDEE line +
  95% band + stat card (`TDEEChart.svelte`, `rollingTDEE`); rendered & inspected
- Note: physics fix — synthetic intake now tracks the energy-driven base loss,
  not the water-contaminated latent weight (water carries no calories)

## M5 — Lift engine + UI ⬜
- ⬜ e1RM (formula choice + validity range), weekly hard sets per muscle (volume landmarks)
- ⬜ RIR / proximity-to-failure, strength trend via the shared estimator; tests
- ⬜ Lift charts

## Stretch
- ⬜ AI coach (Claude API over the structured data + rule engine) — intake interview, free-form Q&A
- ⬜ Deploy (static host), PWA/offline polish
- ⬜ Native iOS revisit only if web proves out

## Housekeeping
- ⬜ Resolve 5 high-severity npm advisories (transitive dev deps; `npm audit`)
- ⬜ Silence 6 benign svelte-check warnings (intake form one-time prefill)
