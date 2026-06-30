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

## M5 — Lift engine + UI ✅
- ✅ Cited science spec (`web/src/lib/lift/SCIENCE.md`): Epley e1RM + validity tiers,
  RIR→reps-to-failure (`.f`=RIR0), hard-set RIR≤3, per-muscle MV/MEV/MAV/MRV
  landmarks, muscle attribution (primary 1.0 / secondary 0.5), ACL LSI layer —
  hypertrophy-scientist, anchored to primary literature
- ✅ Tolerant log parser + data model (`web/src/lib/lift/`): handles the user's real
  Notes format — floating `()` setup, overloaded `/` (L/R limb vs back-off block),
  `+N` over-stack load, `.f` failure, bare reps, surgical-side zeros, multi-gym
  titles; 12 golden tests vs the real `2026 Post ACL Training` log (parser.test.ts)
- ✅ Analysis core (`web/src/lib/lift/`): Epley e1RM + validity tiers (`e1rm.ts`);
  muscle attribution + MV/MEV/MAV/MRV landmarks (`muscles.ts`); strength trend per
  exercise×location×limb via the shared Kalman, weekly hard-sets-per-muscle vs
  landmarks, L/R asymmetry/LSI (`analysis.ts`) — 31 tests vs spec values (58 total green)
- ✅ Paste-and-confirm import UI (`LiftImport.svelte`): live preview (sessions/exercises/
  flagged/skipped), per-location identity, "Load my training log" one-click sample
- ✅ Session-cadence dating (`dates.ts`): FBEOD=+2d; Ant/Post & Upper/Lower 2-on-1-off
- ✅ Lift charts: strength trend (e1RM + band, exercise picker), weekly volume-per-muscle
  vs landmark zones, L/R symmetry/LSI (`StrengthChart`/`VolumeChart`/`SymmetryChart` +
  `LiftSection`); Body/Lifts tabs in `App.svelte`; rendered & inspected (headless)
- ✅ End-to-end validation on the real `2026 Post ACL Training` log (PDFKit-extracted,
  one-per-line): 30 sessions / 469 lifts parse, sane strength/volume/LSI output;
  fixed a decimal-load parser bug (`32.5/17.5`) found on real data; real-log smoke test
- ✅ Athlete-refined muscle attribution (lats/traps split, lat-vs-wide row, pec-deck no
  front-delt, 45° glute/ham, leg press no hams); auditable volume breakdown (click a bar)
- ✅ Strength summary chart (`StrengthSummaryChart`): each lift's e1RM indexed to its own
  baseline (=100%), lines coloured by muscle, by-muscle/by-exercise toggle; mixed
  relative/absolute-load series excluded as not self-comparable; math verified (80 tests)
- ⬜ Polish (nice-to-have): RIR/failure-frequency chart; reconcile mixed +N/pin loads into
  one comparable series (currently excluded from the summary); fuzzy exercise-name merging;
  label FBEOD sessions' gym; surgical side from profile (defaults R)

## M6 — Installable web app (PWA + GitHub Pages) ✅
- ✅ PWA manifest (`web/public/manifest.webmanifest`): standalone display, teal
  theme, maskable icons → "Add to Home Screen" gives a fullscreen app on iOS
- ✅ App icons (192/512/180) generated from `web/public/app-icon.svg` (teal
  dumbbell, matches the app palette) via `qlmanage` + `sips`; iOS
  `apple-touch-icon` + apple-mobile-web-app meta tags in `index.html`
- ✅ Offline service worker (`web/public/sw.js`): network-first navigations
  (always fresh online, opens offline in a no-signal gym), cache-first for
  Vite's hashed assets; caches only `response.ok`. localStorage data untouched.
  Registered in `main.ts` (production builds only)
- ✅ `base: './'` in `vite.config.ts` so the build works under any Pages subpath
  without hardcoding the repo name
- ✅ GitHub Actions deploy (`.github/workflows/deploy.yml`): build `web/` and
  publish `web/dist` to Pages on push to `main`
- ⬜ (user step) push to GitHub, set Pages source = GitHub Actions, Add to Home Screen

## M7 — Profile simplification + faster logging ✅
- ✅ Profile overhaul: single goal weight (dropped goal *range* and current-intake
  inputs; height no longer collected). Pace toward goal is one of three modes —
  **rate** (%/wk, open-ended), **end date**, or **duration** (weeks) — via
  `Profile.paceMode`; `analyzeWeight` derives the horizon + deadline per mode and
  exposes `planLosing` / `deadlineISO` (4 new pace-mode tests)
- ✅ Insights: range-based "in goal" → single-goal "reached your goal" (±~1 lb);
  target-date reality-check now fires for duration mode too
- ✅ Notes-style bulk logging (`BulkLog.svelte` + Daily/Paste toggle): pick a start
  date, paste `weight - calories` one line per day, `NA`/blank skips a field but
  still consumes the day so dates stay aligned. Pure tested parser
  (`lib/data/bulklog.ts`, 6 tests vs the user's exact format)
- ✅ Back-compat: a stored profile from before paceMode existed falls back to rate mode
- Note: verified the trend filter on the user's first 3 real days — the conservative
  ~0.12 lb/wk (vs −3.85 raw) with a ±3 lb/wk band is correct small-sample Kalman
  behavior; converges to the true rate by ~2–3 weeks as the band tightens

## M8 — Current-data timeline + editable logs ✅
- ✅ Lift timeline anchored to **now**: cadence dating lands the MOST RECENT
  session on the anchor date (default today) and runs earlier sessions backward
  (`assignCadenceDates` `anchor:'end'`), instead of marching forward from a
  "first session" start that stranded recent weeks in the future. 7 dates tests.
- ✅ Real calendar-date x-axis on the strength trend + summary charts (was an
  abstract "Day 0..N"); `StrengthSummary.startDate` + `shortDate` helper.
- ✅ Weekly volume window 14d → **7d** ("this week"), ending at the most recent
  session, so volume reflects the current microcycle, not a 2-week blend.
- ✅ Editable running **lift log**: raw pasted text is the source of truth
  (`store.liftLog` + `liftLogEndDate`); the import screen doubles as a
  view/edit/append editor that re-derives sessions on Save. Per-session date
  editing in the preview (seeded from cadence, individually overridable).
- ✅ Bodyweight **log parity**: `formatBulkLog` serializes weigh-ins+calories
  back into the `weight - calories` paste format (round-trip tested); the Paste
  tab prefills from existing data and Save replaces the series (edits/deletions
  take effect) instead of blind-appending.
- ✅ vitest 101/101, svelte-check 0 errors; every change rendered & inspected
  headlessly (Playwright) — timeline ends at today, editors round-trip.

## M9 — Lift coach (rule-based) + chart readability ✅
- ✅ Volume Coach (`lib/lift/advice.ts` `volumeAdvice`): ranked, cited "this week"
  to-dos from the volume-vs-landmark table — below MEV → "add ~N sets", above MRV
  → soft "trim ~N" (Pelland 2025 dose-response), in MAV → hold. Guardrails: front
  delts never nagged (fed by pressing); ACL knee muscles get "build gradually,
  defer to physio" framing (§5); single-week add/trim capped at ~1–2 sets (RP
  progressive overload, documented in §3). Concrete-but-hedged tone. 9 tests.
- ✅ Verified landmark accuracy against RP source + the 2025 Pelland meta-regression
  (which validates the fractional set-counting); fixed front-delt MEV 6→0 (it was
  false-flagging the one muscle §3 says not to nag) + stale "÷2" volume label.
- ✅ Regressing-lift watch (`regressingLifts`): flags lifts whose Kalman e1RM slope
  falls faster than −1%/wk (informational; ≥4 sessions; skips mixed-load series). 5 tests.
- ✅ Coach card (`VolumeCoach.svelte`) at the top of the Lifts tab: volume to-dos +
  in-zone/near-ceiling status + strength watch.
- ✅ Strength summary chart: replaced the crowded all-lines view with an
  Overview (one line per muscle) + per-muscle-group drill-down (distinct
  categorical palette + legend, rescaled y) — `StrengthSummaryChart`.
- ✅ vitest 116/116, svelte-check 0 errors; rendered & inspected (live DOM).

## Stretch
- ⬜ AI coach (Claude API, free-form Q&A) — **rule-based coach now shipped (M9)**;
  Claude API layer over the structured data + rule engine is the remaining piece
- ⬜ Progression coach: per-exercise next-session load/rep cues (Tier 2); stall detection
- ⬜ ACL coach: OKC-reintroduction flag + asymmetry-widening alarm (SCIENCE.md §5 templates)
- ⬜ Cross-device sync / cloud backup (currently data is local to one device)
- ⬜ Native iOS revisit only if web proves out

## Housekeeping
- ✅ npm advisories: the 5 high-severity ones are gone (resolved by the vite 8 /
  modern-toolchain upgrade). One **low**-severity remains — esbuild dev-server
  arbitrary file read, **Windows-only, dev-server-only** (GHSA-g7r4-m6w7-qqqr),
  a vite transitive dep that never ships in the production build. Its only fix is
  a breaking `npm audit fix --force` major bump; not worth the toolchain risk.
- ⬜ Silence 6 benign svelte-check warnings (intake form one-time prefill)
- ⬜ Swift `CoreCheck` can't build in this environment: the Command Line Tools
  SDK fails to build `Foundation` (`'CarbonCore/Folders.h' file not found` →
  `could not build module 'CoreServices'`). Pre-existing toolchain breakage,
  unrelated to the TS app; repair via `xcode-select --install` / reinstall CLT.
  The web suite (vitest 80/80, svelte-check 0 errors) is the active verification.
