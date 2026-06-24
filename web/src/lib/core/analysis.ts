import { smooth, trailingRate, projectToGoal, idealCurve, type Mat2 } from './estimator';
import { estimateTDEE, rollingTDEE, type TDEEResult, type TDEEPoint } from './tdee';
import type { Profile, WeighIn, CalorieEntry } from '../data/types';
import { fromKg, rateFromKg } from '../data/types';

/** Days between two ISO dates (b - a). */
export function dayDiff(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000
  );
}

/** ISO date `days` after `start`. */
function isoPlus(start: string, days: number): string {
  const d = new Date(start + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type TrackStatus = 'on' | 'fast' | 'slow';

export interface WeightAnalysis {
  hasEnough: boolean;
  units: 'lb' | 'kg';
  days: number[]; // offsets from first weigh-in
  obs: number[]; // display units
  trend: number[];
  bandLo: number[];
  bandHi: number[];
  ideal: { days: number[]; values: number[] };
  projection: { days: number[]; level: number[]; goalEtaDay: number | null };
  goalDisplay: number;
  /** Day offset of the planned goal date (deadline), if the pace mode implies one. */
  targetDateDay: number | null;
  /** ISO date of the planned goal date, if the pace mode implies one. */
  deadlineISO: string | null;
  /** True when the plan moves weight down (goal below start). */
  planLosing: boolean;
  lastDay: number;
  current: {
    trendDisplay: number;
    trendKg: number;
    ratePerWk: number; // display units/wk, signed (negative = losing)
    ratePerWkKg: number; // kg/wk, signed (for energy math)
    ratePct: number; // %bodyweight/wk, signed
    idealRatePerWk: number;
    idealRatePerWkKg: number; // kg/wk, signed
    status: TrackStatus;
    etaWeeks: number | null;
    etaRange: [number, number] | null;
  };
  xDomain: [number, number];
  yDomain: [number, number];
}

const RATE_TOL_KG_WK = 0.12; // dead-band for "on track" vs fast/slow

export interface IntakeAnalysis {
  /** Current windowed maintenance estimate (most recent ~28 days). */
  current: TDEEResult;
  /** Rolling maintenance-over-time series for the chart. */
  series: TDEEPoint[];
  /** Daily intake scatter, in day offsets from the first weigh-in. */
  intake: { day: number; kcal: number }[];
  xDomain: [number, number];
  yDomain: [number, number];
}

/**
 * Adaptive-TDEE read: estimate maintenance energy from the intake↔weight-change
 * relationship. Runs the shared trend filter on the weigh-ins and feeds its
 * de-noised slope to the energy-balance estimator (tdee.ts). Returns null when
 * there isn't enough paired data. Day offsets are taken from the first weigh-in
 * so weight and intake share one time origin. Bundles the current estimate plus
 * the rolling series and intake scatter the calorie chart renders.
 */
export function analyzeIntake(weighIns: WeighIn[], calories: CalorieEntry[]): IntakeAnalysis | null {
  if (weighIns.length < 2 || calories.length === 0) return null;
  const sortedW = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const first = sortedW[0].date;
  const wDays = sortedW.map((w) => dayDiff(first, w.date));
  const wObs = sortedW.map((w) => w.weightKg);
  const sortedC = [...calories].sort((a, b) => a.date.localeCompare(b.date));
  const cDays = sortedC.map((c) => dayDiff(first, c.date));
  const cKcal = sortedC.map((c) => c.kcal);
  const s = smooth(wDays, wObs);
  const current = estimateTDEE(wDays, s.slope, s.slopeSd, cDays, cKcal);
  if (!current) return null;
  const series = rollingTDEE(wDays, s.slope, s.slopeSd, cDays, cKcal);
  const intake = cDays.map((day, i) => ({ day, kcal: cKcal[i] }));

  const lastDay = Math.max(wDays[wDays.length - 1], cDays[cDays.length - 1]);
  const bandLos = series.map((p) => p.tdee - 1.96 * p.sd);
  const bandHis = series.map((p) => p.tdee + 1.96 * p.sd);
  const ys = [...cKcal, ...bandLos, ...bandHis, current.tdee];
  const yMin = Math.min(...ys) - 80;
  const yMax = Math.max(...ys) + 80;

  return {
    current,
    series,
    intake,
    // include any intake logged before the first weigh-in (negative offset) so
    // those dots aren't drawn in the left margin
    xDomain: [Math.min(0, cDays[0]), lastDay],
    yDomain: [yMin, yMax],
  };
}

export function analyzeWeight(weighIns: WeighIn[], profile: Profile): WeightAnalysis | null {
  if (weighIns.length < 2) return null;
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].date;
  const days = sorted.map((w) => dayDiff(first, w.date));
  const obsKg = sorted.map((w) => w.weightKg);
  const units = profile.units;

  const s = smooth(days, obsKg);
  const trendKg = s.trend;
  const rateKgDay = trailingRate(days, s.slope);
  const lastDay = days[days.length - 1];
  const startKg = trendKg[0];
  const goalKg = profile.goalKg;
  const losing = goalKg < startKg;

  // horizon + deadline are set by the chosen pace mode:
  //   'date'     — an explicit goal date
  //   'duration' — N weeks from the first weigh-in (day 0)
  //   'rate'     — open-ended; horizon derived from the target rate, no deadline
  let prepDays: number;
  let targetDateDay: number | null = null;
  let deadlineISO: string | null = null;
  if (profile.paceMode === 'date' && profile.targetDate) {
    targetDateDay = dayDiff(first, profile.targetDate);
    deadlineISO = profile.targetDate;
    prepDays = Math.max(targetDateDay, lastDay + 1);
  } else if (profile.paceMode === 'duration' && profile.durationWeeks) {
    targetDateDay = Math.round(profile.durationWeeks * 7);
    deadlineISO = isoPlus(first, targetDateDay);
    prepDays = Math.max(targetDateDay, lastDay + 1);
  } else {
    const dailyKg = ((profile.targetRatePctPerWeek / 100) * startKg) / 7;
    prepDays = Math.round(lastDay + Math.abs(startKg - goalKg) / Math.max(dailyKg, 1e-6));
  }
  // clamp: keep the horizon sane even at-goal / near-zero rate
  prepDays = Math.min(Math.max(prepDays, lastDay + 1), lastDay + 730);

  const ideal = idealCurve(startKg, goalKg, prepDays);
  const idealSlopeNow = ideal.slopeAt(lastDay); // kg/day

  // Search far enough to find the goal crossing at the ACTUAL trailing rate
  // (which is often slower than the target rate — that is the behind-pace case
  // where an ETA matters most). projectToGoal stops ~2 weeks past the crossing,
  // so the drawn line stays short when a crossing exists; only when the trend
  // isn't heading toward goal (maintaining / wrong direction) do we truncate.
  const proj = projectToGoal(s.levelFilteredEnd, rateKgDay, s.PEnd, goalKg, { maxDays: 760 });
  const goalEtaDay = proj.goalEta === null ? null : proj.goalEta + lastDay;
  const drawTo = goalEtaDay === null ? Math.min(proj.days.length, 29) : proj.days.length;
  const projDaysAbs = proj.days.slice(0, drawTo).map((d) => d + lastDay);
  const projLevelKg = proj.level.slice(0, drawTo);

  // status
  const diffWk = (rateKgDay - idealSlopeNow) * 7;
  let status: TrackStatus = 'on';
  if (losing) {
    if (diffWk < -RATE_TOL_KG_WK) status = 'fast';
    else if (diffWk > RATE_TOL_KG_WK) status = 'slow';
  } else {
    if (diffWk > RATE_TOL_KG_WK) status = 'fast';
    else if (diffWk < -RATE_TOL_KG_WK) status = 'slow';
  }

  // ETA + uncertainty range from current-rate uncertainty
  const ssd = Math.sqrt((s.PEnd as Mat2)[1][1]);
  const level0 = s.levelFilteredEnd;
  const etaWk = (sl: number): number | null => {
    if ((sl < 0) === losing && Math.abs(sl) > 1e-6) return (goalKg - level0) / sl / 7;
    return null;
  };
  let etaWeeks: number | null = goalEtaDay === null ? null : (goalEtaDay - lastDay) / 7;
  const eFast = etaWk(rateKgDay - ssd);
  const eSlow = etaWk(rateKgDay + ssd);
  let etaRange: [number, number] | null = null;
  if (eFast !== null && eSlow !== null && eFast > 0 && eSlow > eFast && etaWeeks !== null) {
    etaRange = [eFast, eSlow];
  }

  const toDisp = (kg: number) => fromKg(kg, units);
  const obs = obsKg.map(toDisp);
  const trend = trendKg.map(toDisp);
  const bandLo = trendKg.map((v, i) => toDisp(v - 1.96 * s.trendSd[i]));
  const bandHi = trendKg.map((v, i) => toDisp(v + 1.96 * s.trendSd[i]));
  const idealVals = ideal.values.map(toDisp);
  const goalDisplay = toDisp(goalKg);

  const projLevelDisp = projLevelKg.map(toDisp);
  const allY = [...obs, ...trend, goalDisplay, ...projLevelDisp];
  const yMin = Math.min(...allY) - 1.5;
  const yMax = Math.max(...allY) + 1.5;
  const xMax = Math.max(prepDays, goalEtaDay ?? 0, projDaysAbs[projDaysAbs.length - 1] ?? 0) + 4;
  const lastTrendKg = trendKg[trendKg.length - 1];

  return {
    hasEnough: true,
    units,
    days,
    obs,
    trend,
    bandLo,
    bandHi,
    ideal: { days: ideal.values.map((_, i) => i), values: idealVals },
    projection: { days: projDaysAbs, level: projLevelDisp, goalEtaDay },
    goalDisplay,
    targetDateDay,
    deadlineISO,
    planLosing: losing,
    lastDay,
    current: {
      trendDisplay: toDisp(lastTrendKg),
      trendKg: lastTrendKg,
      ratePerWk: rateFromKg(rateKgDay * 7, units),
      ratePerWkKg: rateKgDay * 7,
      ratePct: (rateKgDay * 7 * 100) / lastTrendKg,
      idealRatePerWk: rateFromKg(idealSlopeNow * 7, units),
      idealRatePerWkKg: idealSlopeNow * 7,
      status,
      etaWeeks,
      etaRange,
    },
    xDomain: [-2, xMax],
    yDomain: [yMin, yMax],
  };
}
