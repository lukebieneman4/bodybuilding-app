import { describe, it, expect } from 'vitest';
import { smooth, trailingRate, projectToGoal, idealCurve, type Mat2 } from './estimator';
import golden from './__fixtures__/golden.json';

/**
 * Parity test: the TS estimator must reproduce the validated Python prototype's
 * outputs on a frozen input (prototypes/gen_golden.py → golden.json). This is
 * the verification gate for the port — if these pass, the TS math is the same
 * math the Monte-Carlo check in bw_trend_prototype.py proved unbiased.
 */
const TOL = 1e-6;

describe('estimator parity vs Python golden values', () => {
  const { days, obs } = golden.input;
  const res = smooth(days, obs, { R: golden.params.R, q: golden.params.q });

  it('reproduces the smoothed trend', () => {
    expect(res.trend.length).toBe(golden.expected.trend.length);
    res.trend.forEach((v, i) => expect(v).toBeCloseTo(golden.expected.trend[i], 6));
  });

  it('reproduces the trend uncertainty band (1σ)', () => {
    res.trendSd.forEach((v, i) => expect(v).toBeCloseTo(golden.expected.trendSd[i], 6));
  });

  it('reproduces the filtered end slope', () => {
    expect(res.slopeFilteredEnd).toBeCloseTo(golden.expected.slopeFilteredEnd, 6);
  });

  it('reproduces the trailing 21-day rate', () => {
    const rate = trailingRate(days, res.slope);
    expect(rate).toBeCloseTo(golden.expected.slopeRobust, 6);
  });

  it('reproduces the end covariance', () => {
    const Pe = golden.expected.Pend as number[][];
    expect(res.PEnd[0][0]).toBeCloseTo(Pe[0][0], 6);
    expect(res.PEnd[0][1]).toBeCloseTo(Pe[0][1], 6);
    expect(res.PEnd[1][0]).toBeCloseTo(Pe[1][0], 6);
    expect(res.PEnd[1][1]).toBeCloseTo(Pe[1][1], 6);
  });

  it('reproduces the projected goal ETA', () => {
    const rate = trailingRate(days, res.slope);
    const proj = projectToGoal(res.levelFilteredEnd, rate, res.PEnd, golden.ideal.goal, {
      qProj: golden.params.qProj,
    });
    const lastDay = days[days.length - 1];
    expect(proj.goalEta).not.toBeNull();
    expect((proj.goalEta as number) + lastDay).toBe(golden.expected.goalEta);
  });

  it('reproduces the ideal curve', () => {
    const ideal = idealCurve(golden.ideal.start, golden.ideal.goal, golden.ideal.prepDays);
    expect(ideal.values.length).toBe(golden.ideal.values.length);
    ideal.values.forEach((v, i) => expect(v).toBeCloseTo(golden.ideal.values[i], 6));
  });

  it('rejects degenerate input', () => {
    expect(() => smooth([0], [80])).toThrow();
  });
});

// Keep TOL referenced (documents the intended tolerance for toBeCloseTo(…, 6)).
void TOL;
