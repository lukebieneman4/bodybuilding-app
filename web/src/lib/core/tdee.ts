/**
 * Adaptive TDEE (maintenance-energy) estimator from the intake↔weight-change
 * relationship — the MacroFactor / MASS "energy-balance" approach.
 *
 * Physics. Over any interval the first law gives
 *     ρ · ΔW = ΣIntake − ΣExpenditure          (energy stored = in − out)
 * so the average daily expenditure ("maintenance" / TDEE) is
 *     TDEE = meanIntake − ρ · rate
 * where `rate` is the energy-driven trend rate in kg/day (signed: < 0 losing,
 * so −ρ·rate > 0 — you expend more than you eat while losing) and ρ is the
 * energy density of body-mass change:
 *   - Wishnofsky (1958), Metabolism: 3500 kcal/lb ≈ 7716 kcal/kg — the classic
 *     constant; we use 7700.
 *   - Hall et al. (2008), Am J Clin Nutr 88:1495 — adipose energy density; notes
 *     the constant is a short/medium-term approximation, fine over a diet phase.
 *
 * Why the TREND rate, not raw daily weight diffs: water/glycogen/gut swings move
 * the scale but carry no logged calories. Differencing raw weight would charge
 * those swings to energy and bias TDEE badly. So a de-noised trend slope
 * (estimator.ts) is a prerequisite for an honest maintenance read — the same
 * reason MacroFactor estimates expenditure off its trend weight, not the scale.
 *
 * Adaptivity: estimation runs over a trailing window (default 28 days), so the
 * estimate tracks metabolic adaptation / activity drift rather than averaging
 * the whole history. Units are SI throughout (kg, days, kcal).
 */

import { trailingRate } from './estimator';

/** Energy density of body-mass change, kcal/kg (Wishnofsky 1958; Hall 2008). */
export const KCAL_PER_KG_DEFAULT = 7700;

export interface TDEEResult {
  /** Estimated maintenance energy, kcal/day. */
  tdee: number;
  /** 1σ uncertainty of the estimate, kcal/day. */
  sd: number;
  /** 95% confidence interval, kcal/day. */
  ci95: [number, number];
  /** Mean logged intake over the window, kcal/day. */
  intakeMean: number;
  /** Trend rate used, kg/day (signed; < 0 losing). */
  rateKgPerDay: number;
  /** Number of intake days in the window. */
  nIntake: number;
  /** Window length actually used, days. */
  windowDays: number;
  /** Predicted weekly trend rate (kg/wk, signed) if intake were `atIntake`. */
  predictedRateKgPerWk: (atIntake: number) => number;
}

export interface TDEEOptions {
  /** Trailing window for both the rate and the intake mean, days. */
  windowDays?: number;
  /** Energy density of body-mass change, kcal/kg. */
  rho?: number;
  /** Minimum intake days required in the window to return a result. */
  minIntakeDays?: number;
}

/**
 * Estimate maintenance energy by energy balance over a trailing window.
 *
 * @param weighDays day offsets of weigh-ins (ascending), as fed to `smooth`.
 * @param slope     smoothed slope kg/day at each weigh-in (`smooth().slope`).
 * @param slopeSd   1σ of the smoothed slope at each weigh-in (`smooth().slopeSd`);
 *                  the rate uncertainty is taken as the window-mean of these.
 *                  We use the SMOOTHED (not filtered-endpoint) slope sd: the
 *                  filtered endpoint variance `PEnd[1][1]` is the widest point of
 *                  the estimator and overstates the uncertainty of the window
 *                  *mean* rate by ~2×, producing an implausibly wide band.
 * @param calorieDays day offsets of intake logs (ascending), same origin as `weighDays`.
 * @param calorieKcal intake in kcal, aligned with `calorieDays`.
 * Returns null when there is too little data for an honest read.
 */
export function estimateTDEE(
  weighDays: number[],
  slope: number[],
  slopeSd: number[],
  calorieDays: number[],
  calorieKcal: number[],
  opts: TDEEOptions = {}
): TDEEResult | null {
  const windowDays = opts.windowDays ?? 28;
  const rho = opts.rho ?? KCAL_PER_KG_DEFAULT;
  const minIntakeDays = opts.minIntakeDays ?? 7;
  if (
    weighDays.length < 2 ||
    calorieDays.length === 0 ||
    calorieKcal.length !== calorieDays.length ||
    slopeSd.length !== weighDays.length
  ) {
    return null;
  }

  const lastDay = Math.max(weighDays[weighDays.length - 1], calorieDays[calorieDays.length - 1]);
  const cutoff = lastDay - windowDays;

  // Trend rate over the window — the shared trailing-rate helper (mean smoothed
  // slope), so the rate here is the same quantity the weight read reports.
  const rateKgPerDay = trailingRate(weighDays, slope, windowDays);

  // Rate uncertainty: mean smoothed-slope 1σ over the same window.
  let sdSum = 0;
  let sdN = 0;
  for (let i = 0; i < weighDays.length; i++) {
    if (weighDays[i] >= cutoff) {
      sdSum += slopeSd[i];
      sdN++;
    }
  }
  const rateSd = sdN > 0 ? sdSum / sdN : slopeSd[slopeSd.length - 1];

  // Mean logged intake over the same trailing window.
  const win: number[] = [];
  for (let i = 0; i < calorieDays.length; i++) {
    if (calorieDays[i] >= cutoff) win.push(calorieKcal[i]);
  }
  if (win.length < minIntakeDays) return null;
  const intakeMean = win.reduce((s, v) => s + v, 0) / win.length;
  const intakeVar =
    win.length > 1 ? win.reduce((s, v) => s + (v - intakeMean) ** 2, 0) / (win.length - 1) : 0;
  const intakeSE2 = intakeVar / win.length; // squared standard error of the mean

  // Energy balance.
  const tdee = intakeMean - rho * rateKgPerDay;
  // Propagate intake sampling error and trend-rate uncertainty (independent).
  const sd = Math.sqrt(intakeSE2 + (rho * rateSd) ** 2);
  const ci95: [number, number] = [tdee - 1.96 * sd, tdee + 1.96 * sd];

  return {
    tdee,
    sd,
    ci95,
    intakeMean,
    rateKgPerDay,
    nIntake: win.length,
    windowDays,
    predictedRateKgPerWk: (atIntake: number) => ((atIntake - tdee) / rho) * 7,
  };
}

export interface TDEEPoint {
  /** As-of day offset (the right edge of the trailing window). */
  day: number;
  /** Estimated maintenance at that day, kcal/day. */
  tdee: number;
  /** 1σ uncertainty at that day, kcal/day. */
  sd: number;
}

/**
 * Rolling adaptive-TDEE series for the chart: for each day `D` with a full
 * trailing window behind it, the same energy-balance estimate over `(D −
 * windowDays, D]`. This is the maintenance-over-time line — it shows the
 * estimate adapting as the diet progresses. Like the weight trend, it uses the
 * full-data smoothed slope (a retrospective view), only the trailing window
 * moves. Cost is O(days × samples); fine for local-first single-user data.
 */
export function rollingTDEE(
  weighDays: number[],
  slope: number[],
  slopeSd: number[],
  calorieDays: number[],
  calorieKcal: number[],
  opts: TDEEOptions = {}
): TDEEPoint[] {
  const windowDays = opts.windowDays ?? 28;
  const rho = opts.rho ?? KCAL_PER_KG_DEFAULT;
  const minIntakeDays = opts.minIntakeDays ?? 7;
  const out: TDEEPoint[] = [];
  if (
    weighDays.length < 2 ||
    calorieDays.length === 0 ||
    calorieKcal.length !== calorieDays.length ||
    slopeSd.length !== weighDays.length
  ) {
    return out;
  }
  const lastDay = Math.max(weighDays[weighDays.length - 1], calorieDays[calorieDays.length - 1]);
  for (let D = weighDays[0] + windowDays; D <= lastDay; D++) {
    const cutoff = D - windowDays;
    let rSum = 0;
    let sdSum = 0;
    let rN = 0;
    for (let i = 0; i < weighDays.length; i++) {
      if (weighDays[i] >= cutoff && weighDays[i] <= D) {
        rSum += slope[i];
        sdSum += slopeSd[i];
        rN++;
      }
    }
    if (rN === 0) continue;
    let iSum = 0;
    let iSumSq = 0;
    let iN = 0;
    for (let i = 0; i < calorieDays.length; i++) {
      if (calorieDays[i] >= cutoff && calorieDays[i] <= D) {
        iSum += calorieKcal[i];
        iSumSq += calorieKcal[i] * calorieKcal[i];
        iN++;
      }
    }
    if (iN < minIntakeDays) continue;
    const intakeMean = iSum / iN;
    const intakeVar = iN > 1 ? (iSumSq - iN * intakeMean * intakeMean) / (iN - 1) : 0;
    const rateSd = sdSum / rN;
    const tdee = intakeMean - rho * (rSum / rN);
    const sd = Math.sqrt(Math.max(intakeVar, 0) / iN + (rho * rateSd) ** 2);
    out.push({ day: D, tdee, sd });
  }
  return out;
}
