import { describe, it, expect } from 'vitest';
import { smooth } from './estimator';
import { dayDiff } from './analysis';
import { estimateTDEE, KCAL_PER_KG_DEFAULT } from './tdee';
import { generateSynthetic } from '../data/synthetic';

/**
 * Verification: the adaptive TDEE estimator must recover the maintenance energy
 * that GENERATED a synthetic diet phase. The synthetic data ties intake to the
 * energy-driven trend (water/scale noise carry no calories — see synthetic.ts),
 * so an honest energy-balance estimator should back out maintenance from the
 * de-noised trend rate. We check a single draw, then unbiasedness across many
 * draws (mirroring the Monte-Carlo philosophy of the weight estimator).
 */

const TRUE_MAINT = 2900;

function runOne(seed: number, bumpKg?: number) {
  const { weighIns, calories } = generateSynthetic({
    startKg: 90,
    goalKg: 80,
    days: 84,
    ratePctPerWeek: 0.6,
    maintenanceKcal: TRUE_MAINT,
    startDate: '2026-01-01',
    seed,
    bumpKg,
  });
  const first = weighIns[0].date;
  const wDays = weighIns.map((w) => dayDiff(first, w.date));
  const wObs = weighIns.map((w) => w.weightKg);
  const cDays = calories.map((c) => dayDiff(first, c.date));
  const cKcal = calories.map((c) => c.kcal);
  const s = smooth(wDays, wObs);
  return estimateTDEE(wDays, s.slope, s.slopeSd, cDays, cKcal);
}

describe('adaptive TDEE estimator vs synthetic ground truth', () => {
  it('is exact in the clean limit (linear loss, constant intake, full logging)', () => {
    // Isolates the energy-balance math from synthetic-data noise: a perfectly
    // linear cut at −0.05 kg/day eating 2400 kcal must back out 2400+7700·0.05.
    const N = 84;
    const rateDay = -0.05;
    const intake = 2400;
    const wd: number[] = [];
    const wo: number[] = [];
    const cd: number[] = [];
    const ck: number[] = [];
    for (let t = 0; t < N; t++) {
      wd.push(t);
      wo.push(90 + rateDay * t);
      cd.push(t);
      ck.push(intake);
    }
    const s = smooth(wd, wo);
    const r = estimateTDEE(wd, s.slope, s.slopeSd, cd, ck)!;
    expect(r.rateKgPerDay).toBeCloseTo(rateDay, 4);
    // exact to < 1 kcal; residual is only the RTS smoother's boundary transient
    expect(Math.abs(r.tdee - (intake - KCAL_PER_KG_DEFAULT * rateDay))).toBeLessThan(1); // 2785
  });

  it('recovers maintenance on a single draw within 150 kcal', () => {
    const r = runOne(7);
    expect(r).not.toBeNull();
    expect(r!.rateKgPerDay).toBeLessThan(0); // it is a cut
    expect(Math.abs(r!.tdee - TRUE_MAINT)).toBeLessThan(150);
  });

  it('is low-bias across 100 synthetic cuts (|mean bias| < 75, MAE < 160 kcal ≈ 5%)', () => {
    // The clean-limit test proves the arithmetic is exact, so MAE here (~140 kcal,
    // ≈5% of 2900) is the synthetic data's irreducible noise floor: ±180 kcal/day
    // intake jitter, AR(1) water, ~25% missing days over a 28-day window.
    // The mean bias (~+54 kcal) is REAL, not noise: the mid-cut water bump's
    // decaying tail sheds non-caloric weight inside the trailing window, which the
    // trend rate charges to energy. The no-bump test below isolates this — with
    // the bump off the bias collapses to ~0, confirming the estimator itself is
    // unbiased and the residual is a property of the (realistic) water dynamics.
    const errs: number[] = [];
    for (let seed = 0; seed < 100; seed++) {
      const r = runOne(seed);
      if (r) errs.push(r.tdee - TRUE_MAINT);
    }
    expect(errs.length).toBeGreaterThan(90);
    const mean = errs.reduce((s, v) => s + v, 0) / errs.length;
    const mae = errs.reduce((s, v) => s + Math.abs(v), 0) / errs.length;
    expect(Math.abs(mean)).toBeLessThan(75);
    expect(mae).toBeLessThan(160);
  });

  it('is unbiased with no water bump (isolates the bump as the bias source)', () => {
    // Same generator, water-retention plateau disabled (bumpKg = 0). If the bias
    // above were an estimator defect it would persist; instead it vanishes.
    const errs: number[] = [];
    for (let seed = 0; seed < 100; seed++) {
      const r = runOne(seed, 0);
      if (r) errs.push(r.tdee - TRUE_MAINT);
    }
    const mean = errs.reduce((s, v) => s + v, 0) / errs.length;
    expect(Math.abs(mean)).toBeLessThan(15);
  });

  it('reports an honest uncertainty band — covers the truth, not absurdly wide', () => {
    let covered = 0;
    let widthSum = 0;
    let n = 0;
    for (let seed = 0; seed < 100; seed++) {
      const r = runOne(seed);
      if (!r) continue;
      n++;
      widthSum += r.ci95[1] - r.ci95[0];
      if (TRUE_MAINT >= r.ci95[0] && TRUE_MAINT <= r.ci95[1]) covered++;
    }
    // Two-sided guard: high coverage (band not too narrow) AND a bounded mean
    // 95% width (band not uselessly wide). The earlier filtered-endpoint sd gave
    // ~1520 kcal width / 100% coverage — this < 1200 ceiling would catch that.
    expect(covered / n).toBeGreaterThanOrEqual(0.9);
    expect(widthSum / n).toBeLessThan(1200);
  });

  it('predicted-rate forward model is self-consistent and physical', () => {
    const r = runOne(7)!;
    // at the eaten intake, the predicted rate is exactly the observed trend rate
    expect(r.predictedRateKgPerWk(r.intakeMean)).toBeCloseTo(r.rateKgPerDay * 7, 9);
    // at maintenance, weight is predicted stable
    expect(r.predictedRateKgPerWk(r.tdee)).toBeCloseTo(0, 9);
    // a 550 kcal/day deficit ⇒ ≈ −0.5 kg/wk (550*7/7700)
    expect(r.predictedRateKgPerWk(r.tdee - 550)).toBeCloseTo((-550 / KCAL_PER_KG_DEFAULT) * 7, 9);
  });

  it('returns null without enough intake data', () => {
    const s = smooth([0, 1, 2], [90, 89.9, 89.8]);
    expect(estimateTDEE([0, 1, 2], s.slope, s.slopeSd, [0, 1], [2500, 2400])).toBeNull();
  });
});
