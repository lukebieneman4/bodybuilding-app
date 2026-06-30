# Lift-Tracking Analysis Layer — Cited Specification

> Provenance: produced by the `hypertrophy-scientist` agent on 2026-06-15 against
> the user's real training log (`prototypes/acl_training_log.txt`) and the
> hypertrophy/ACLR literature. This is the **source of truth** for the M5 science;
> every constant the estimators/insights use should cite back here (per CLAUDE.md
> "no magic numbers"). The ACL section is anchored to primary literature because
> the user's `Optimizing Recovery After ACL Reconstruction` review PDF could not
> be text-extracted (subsetted OpenType fonts / hex-encoded glyphs — needs a real
> PDF extractor like poppler `pdftotext`).

**Hard constraint:** all loads in this log are machine-stack/plate-relative
arbitrary units, NOT kg. Absolute 1RM and cross-exercise comparison are
meaningless. Load is an *ordinal, within-exercise* quantity, namespaced per
exercise × machine/location, never converted and never summed across machines.

---

## 1. e1RM estimation (within-exercise progression index)

- **Compute** `e1rm[exercise, date]` = estimated single-rep ceiling for that
  exercise on that machine — used only to detect progression over time within one
  exercise. Present as **"Strength Index"** / **"Est. top-set load,"** never "1RM."
- **Formula: Epley**, `e1RM = load × (1 + reps_to_failure / 30)`.
  - 1RM-prediction formulas are accurate in the **1–10 rep range** (~±5%) and
    degrade above ~10–12 reps. Epley fits 6–10 reps (the modal range here) well.
  - Use **one fixed formula** for every set of an exercise — consistency matters
    more than absolute accuracy for a monotone trend; a segmented formula would
    inject artificial discontinuities.
- **Validity tiering:** high-confidence when reps-to-failure ≤ 10; low-confidence
  (flag + down-weight in the trend filter) at 11–15; **do not emit e1RM above 15
  reps** (log the set for volume only). E.g. Recline Curl 50→12, Adductor 110→14,
  Pec Deck Light 248→12–13 are volume-counted but e1RM-suppressed/down-weighted.
- **RIR → reps-to-failure:** `reps_to_failure = reps + RIR`. `.f` (failure) = **RIR 0**
  (same as `.0`; `f` is just an explicit "actually hit failure" marker). Widen the
  e1RM band by ~1 rep-equivalent for any set logged at RIR ≥ 3.
- **Honest presentation:** label per-exercise; never plot two exercises' e1RM on
  one axis, never sum, never rank muscles by e1RM. Show trend + band via the shared
  Kalman estimator. Unilateral lifts → **two independent e1RM series** (L and R).

## 2. "Hard / stimulating set" definition

- **A set counts as one hard set if `RIR ≤ 3`** (within 3 reps of failure). Stopping
  1–3 reps short matches training-to-failure for hypertrophy in trained lifters;
  stimulus falls off steeply above ~5 RIR.
- Optional graded "quality-adjusted volume" (secondary metric): RIR 0–3 → 1.0,
  RIR 4–5 → 0.5, RIR > 5 → 0.0. The user trains ~0–2 RIR, so nearly all working
  sets clear the bar; the threshold mainly screens his explicit light/back-off
  sets (e.g. "Pec Deck Light"). Exclude warm-ups; when unsure, count it.

## 3. Weekly volume landmarks per muscle (hard sets/week, natural trained male)

General anchor (meta-analytic): **~10+ and roughly 12–20 hard sets/week per muscle**,
diminishing returns, spread over **2+ sessions/week**. Per-muscle MV/MEV/MAV/MRV
(Israetel/RP landmarks — coach consensus, **not** meta-analytic constants; ±2-set fuzz):

| Muscle | MV | MEV | MAV (target) | MRV |
|---|---|---|---|---|
| Chest | 4–8 | 8–10 | 12–20 | 20–22 |
| Back (lats/mid-back) | 6–8 | 10–12 | 14–22 | 22–25 |
| Side delts | 6–8 | 8 | 16–22 | 26 |
| Rear delts | 0–6 | 6–8 | 12–18 | 20–25 |
| Front delts | 0 | 0–6 | 6–12 | 12–18 |
| Biceps | 4–6 | 8 | 14–20 | 20–26 |
| Triceps | 4–6 | 6–8 | 10–14 | 18 |
| Quads | 6–8 | 8–12 | 12–18 | 20 |
| Hamstrings | 3–6 | 6–10 | 10–16 | 16–20 |
| Glutes | 0–4 | 4–8 | 8–16 | 16–20 |
| Calves | 6–8 | 8–12 | 12–16 | 16–20 |
| Traps | 0–4 | 4–8 | 12–20 | 20–30 |
| Abs | 0 | 6 | 16–20 | 25 |

Insights: below MEV → "below growth threshold," in MAV → "productive zone," above
MRV → "recovery risk, consider deload." For a natural lifter, land in MAV and avoid
chronic MRV. Front delts/triceps get heavy indirect work from pressing — don't nag
for direct volume. MV is the target for the **surgical leg in early rehab**.

**Progression rate (Volume Coach default):** volume is added *gradually* across a
mesocycle, not jumped in one week — recommend **~1–2 sets/muscle/week** toward the
zone (RP progressive-overload methodology). So the coach caps any single-week
"add"/"trim" suggestion at ~2 sets even when the gap to MAV is large.

## 4. Muscle attribution (primary 1.0 / secondary 0.5 fractional credit — a convention)

Single-joint isolation = primary only.

**One unilateral set = one set, same as a bilateral set.** A left+right round of a
unilateral lift (e.g. Uni Pec Deck) counts as **one** set toward weekly volume,
exactly like one bilateral Pec Deck set — *not* two. The volume landmarks in §3
are per muscle, and one round of unilateral work delivers one set's worth of
stimulus, so summing the two limbs would read unilateral training as 2× its real
volume against those landmarks (8 single-leg-press rounds = 8 for quads, not 16).
Implementation: `effectiveHardSets = bilateral + max(L, R)` — the L/R pair
collapses to one, and taking the working side means a skipped/zero-rep
surgical-side limb credits **0** without dragging the number down. This also makes
the count independent of *how* a set was written — `200/200- 8,8` (with a `/`
split) and two plain `200- 8,8` sets now give the same volume. Left vs. right is
still tracked independently for the asymmetry view (§5).

| Logged exercise | Primary (1.0) | Secondary (0.5) |
|---|---|---|
| Machine/Plate/Machine Press (chest press) | Chest | Front delts, Triceps |
| Pec Deck / Uni Pec Deck / Pec Deck Light | Chest | Front delts |
| Reverse Pec Deck / Uni Reverse Pec Deck | Rear delts | Mid-back/traps |
| Cuffed Cable Rear Delt Fly | Rear delts | — |
| Wide/Close/Straight-Bar Pulldown | Lats (Back) | Biceps |
| Machine Lat Row | Back | Biceps, Rear delts |
| T-bar Wide Grip Row | Back | Biceps, Rear delts |
| Machine Kelso / Kelso Shrug | Mid-back/Traps | Rear delts |
| Lat-raise variants / Side Delt / Side Flap | Side delts | — |
| Uni Front Flap / DB Front Raise | Front delts | — |
| Triceps ext (cable/straight-bar/cuffed) | Triceps | — |
| Overhead triceps ext | Triceps (long head) | — |
| Preacher Curl (machine/DB) | Biceps | — |
| Recline Curl | Biceps (long head) | — |
| Uni Leg Press | Quads | Glutes, Hamstrings |
| Uni Leg Ext | Quads | — |
| Hamstring Curl (seated/lying) | Hamstrings | — |
| Uni 45 Ext (45° back ext) | Erectors / Glutes | Hamstrings |
| Adductor(s) | Adductors | — |
| Abductor(s) | Glute medius/Abductors | — |
| Calf Press (machine/uni) | Calves | — |
| Uni Cable Kickback | Glutes | Hamstrings |
| Ab Machine | Abs | — |

Abductors → bucket under **glutes** for landmark comparison; **adductors** = own
small bucket, no growth nag. Parenthetical `(a, b)` = machine seat/setting metadata.

**Athlete-refined attributions (2026-06-16):** the implemented map in `muscles.ts`
intentionally diverges from the generic table above per the athlete's own execution
(he knows his movement bias better than the textbook default):
- "back" is split into **lats** vs **traps** (separate buckets/landmarks).
- A **lat-biased row** (Machine Lat Row) → lats-primary, traps + biceps partial;
  a **wide-grip row** (T-bar) → traps-primary, lats + biceps partial.
- **Pec-deck flye** → chest only (no front-delt credit; front delts stay on presses).
- **45° back extension** → glutes + hamstrings primary, erectors secondary (hip-hinge).
- **Leg press** → quads primary, glutes secondary (no hamstrings).
- Reverse pec deck → rear-delt primary, traps partial; cuffed cable rear fly →
  isolated rear delt (no traps); abductor stays in the glute bucket.
These override the generic defaults and are locked by `muscles.test.ts`.

## 5. ACL-rehab layer (safety-first, informational — defers to surgeon/physio)

- **Open vs closed chain:** leg extension = OKC (more graft strain, esp. loaded
  terminal extension 0–45°, though recent evidence finds early concern may be
  overstated when load/ROM controlled); leg press = CKC (rehab standard, lower
  strain). The user's pattern (surgical side 0 reps on Uni Leg Ext, lighter on Uni
  Leg Press) is textbook-conservative — affirm it; flag graded OKC reintroduction
  when surgical leg-ext reps go 0 → >0.
- **Limb Symmetry Index:** `LSI = surgical/healthy × 100%`, using within-exercise
  e1RM (or top working load at matched reps), tracked per knee exercise over time.
  Target **≥ 90%** ("approaching symmetry") — but label as a **training-progress
  proxy, not medical clearance** (LSI can overestimate recovery; 90% is contested
  as a sole criterion). Interim ~80% around 5–6 months is normal; a slow climb is
  expected — do not flag a low LSI as "behind."
- **Progression cautions:** surgical leg target = MV→MEV (maintain, gently grow),
  not MAV/MRV. Progress surgical-knee load only when pain-free; **never** auto-suggest
  a load jump for the surgical side. ACLR rehab is a 9–12 month arc.
- **Automated insight templates:** (1) LSI report per knee exercise; (2) OKC
  reintroduction flag; (3) progression gate (pain-free + LSI ≥ ~80–90%); (4)
  asymmetry-widening alarm if surgical e1RM flattens while healthy climbs; (5)
  surgical-side load as % of healthy on calf/leg press, charted toward parity.
- **Safety rails:** not medical advice; RTS and load-progression decisions belong
  to the surgeon/physio. The surgical knee never gets an automated "add load" rec.

## 6. Contested / not-to-over-claim

Per-muscle landmarks are coach consensus, not constants. Fractional 0.5 secondary
credit is a convention. The "0–3 RIR = hard set" cutoff is reasonable consensus but
the curve's exact shape is unresolved. Machine-stack e1RM is ordinal only. RIR
self-report degrades at high RIR / for novices (mitigated: experienced user, low
RIR). OKC-after-ACLR safety is genuinely contested — reflect both sides, defer to
the clinician. 90% LSI is common but contested and can overestimate recovery.

## 7. ACL-review corroboration & nutrition addenda

Cross-check against the user's own review (`prototypes/acl_recovery_review.txt`,
"Optimizing Recovery After ACL Reconstruction: An Evidence-Based Review"). It
**corroborates** §5 and adds actionable nutrition floors:

- **LSI / timeline confirmed:** RTS needs **≥90–100% quad/ham strength + hop LSI**,
  full ROM, minimal effusion, ligament laxity ≤grade 1, and psychological readiness
  (ACL-RSI); biological graft remodeling is **9–12 months**; return-to-running often
  ~3–4 months once **quad LSI ≥80%**. Returning <7 months ~doubles re-tear risk. So
  the app's ≥90% LSI goal line and "slow climb is normal" framing are correct.
- **Chain choice confirmed:** blend open- and closed-chain, **emphasize eccentric
  work**; CKC (leg press, 0–45°) from ~3 weeks, low-load OKC knee extension (0–30°)
  from ~week 4. The user's conservative surgical-side pattern fits.
- **Nutrition floors (feed the calorie/protein insights — ties to M3/M4):**
  - **Protein ≥1.6–2.0 g/kg/day** to preserve/rebuild lean mass post-op (already in
    insights at 1.6–2.2; consistent). 20–40 g whey + ~3 g leucine post-exercise.
  - **Energy ~30–35 kcal/kg/day floor to avoid catabolism while healing** — this is
    a NEW, usable constraint: it should *cap how aggressive a deficit the app
    recommends during recovery*, reinforcing the existing recovery insight.
  - Optional informational adjuncts (clinician-directed, not app recommendations):
    collagen 10–15 g + ~1 g vitamin C 30–60 min pre-resistance (one RCT: faster graft
    maturation), creatine 3–5 g/day, vitamin D to ≥30 ng/mL, omega-3 1–3 g.
- **Modalities (out of app scope, informational only):** NMES, low-load BFR
  (~50% AOP, 20–30% 1RM) both strongly evidenced for quad recovery; cryotherapy
  early; ESWT promising (one RCT). The app may *mention* these as clinician options.
- **Hormonal/ergogenic:** testosterone/SARMs/GH are experimental, risky, and banned
  in sport — the app must never suggest them (matches the natural-athlete mandate).

## References

Schoenfeld/Ogborn/Krieger dose-response; 2025 dose-response meta-regression
(PubMed 41343037); Baz-Valle 2022 (30063555); Refalo proximity-to-failure
(PMC9935748); proximity dose-response (SportRxiv #295); trained-lifter RIR-vs-failure
RCT (10.1080/02640414.2024.2321021); Zourdos RIR-RPE (PMC4961270); MASS RPE/RIR guide;
Brzycki/Epley validation (OpenSIUC); RP volume landmarks (rpstrength.com);
Israetel MV/MEV/MAV/MRV; IJSPT OKC considerations (article/18983); Frontiers 2024
OKC-vs-CKC meta-analysis; in-vivo ACL length change (S2468781222002168); RTS scoping
review (39565551); JOSPT LSI overestimates function; LSI critical analysis
(PMC11874420); quad LSI benchmarks (IJSPT 94602); RTS pass rates at 9mo (PMC6267144);
BFR post-ACLR (PMC11729412); BFR/quad strength (PMC10683393); rehab-timeline scoping
review (S2773157X25002565). Full URLs in the agent transcript / commit history.
