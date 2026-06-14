import { smooth, trailingRate, projectToGoal, idealCurve, type Mat2 } from './estimator';
import type { Profile, WeighIn } from '../data/types';
import { fromKg, rateFromKg } from '../data/types';

/** Days between two ISO dates (b - a). */
export function dayDiff(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000
  );
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
  targetDateDay: number | null;
  lastDay: number;
  current: {
    trendDisplay: number;
    ratePerWk: number; // display units/wk, signed (negative = losing)
    ratePct: number; // %bodyweight/wk, signed
    idealRatePerWk: number;
    status: TrackStatus;
    etaWeeks: number | null;
    etaRange: [number, number] | null;
  };
  xDomain: [number, number];
  yDomain: [number, number];
}

const RATE_TOL_KG_WK = 0.12; // dead-band for "on track" vs fast/slow

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

  // horizon: explicit deadline, else derived from the target rate
  let prepDays: number;
  if (profile.targetDate) {
    prepDays = Math.max(dayDiff(first, profile.targetDate), lastDay + 1);
  } else {
    const dailyKg = ((profile.targetRatePctPerWeek / 100) * startKg) / 7;
    prepDays = Math.round(lastDay + Math.abs(startKg - goalKg) / Math.max(dailyKg, 1e-6));
  }
  // clamp: keep the horizon sane even at-goal / near-zero rate
  prepDays = Math.min(Math.max(prepDays, lastDay + 1), lastDay + 730);

  const ideal = idealCurve(startKg, goalKg, prepDays);
  const idealSlopeNow = ideal.slopeAt(lastDay); // kg/day

  // projection (line only; uncertainty surfaced as an ETA range, not a cone)
  const proj = projectToGoal(s.levelFilteredEnd, rateKgDay, s.PEnd, goalKg, {
    maxDays: prepDays - lastDay + 21,
  });
  const projDaysAbs = proj.days.map((d) => d + lastDay);
  const goalEtaDay = proj.goalEta === null ? null : proj.goalEta + lastDay;

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

  const allY = [...obs, ...trend, goalDisplay, toDisp(proj.level[proj.level.length - 1])];
  const yMin = Math.min(...allY) - 1.5;
  const yMax = Math.max(...obs, ...trend) + 1.5;

  return {
    hasEnough: true,
    units,
    days,
    obs,
    trend,
    bandLo,
    bandHi,
    ideal: { days: ideal.values.map((_, i) => i), values: idealVals },
    projection: { days: projDaysAbs, level: proj.level.map(toDisp), goalEtaDay },
    goalDisplay,
    targetDateDay: profile.targetDate ? dayDiff(first, profile.targetDate) : null,
    lastDay,
    current: {
      trendDisplay: toDisp(trendKg[trendKg.length - 1]),
      ratePerWk: rateFromKg(rateKgDay * 7, units),
      ratePct: (rateKgDay * 7 * 100) / trendKg[trendKg.length - 1],
      idealRatePerWk: rateFromKg(idealSlopeNow * 7, units),
      status,
      etaWeeks,
      etaRange,
    },
    xDomain: [-2, prepDays + 4],
    yDomain: [yMin, yMax],
  };
}
