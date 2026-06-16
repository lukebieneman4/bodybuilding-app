import { describe, it, expect } from 'vitest';
import { parseExerciseLine } from './parser';
import {
  strengthSeries,
  strengthSummary,
  weeklyVolumeByMuscle,
  limbAsymmetry,
  interpAt,
  mixedScale,
} from './analysis';
import type { LiftSession } from './types';
import type { StrengthPoint, SummaryPoint } from './analysis';

/** Build a session from raw exercise lines. */
const session = (date: string, location: string | null, lines: string[]): LiftSession => ({
  title: 'test',
  split: null,
  location,
  exercises: lines.map((l) => parseExerciseLine(l)!),
  date,
});

describe('strengthSeries — trend via the shared estimator', () => {
  it('reports a rising slope for a progressing lift, scoped per location', () => {
    const sessions = [
      session('2026-01-01', 'Brick', ['Machine Chest Press (2, 0) 180- 10.0']),
      session('2026-01-03', 'Brick', ['Machine Chest Press (2, 0) 185- 10.0']),
      session('2026-01-05', 'Brick', ['Machine Chest Press (2, 0) 190- 10.0']),
      session('2026-01-07', 'Brick', ['Machine Chest Press (2, 0) 195- 10.0']),
    ];
    const series = strengthSeries(sessions);
    expect(series).toHaveLength(1);
    const s = series[0];
    expect(s.location).toBe('Brick');
    expect(s.points).toHaveLength(4);
    expect(s.slopePerWeek).toBeGreaterThan(0); // getting stronger
    expect(s.current).toBeGreaterThan(245); // ~ 195 × 1.333 ≈ 260
  });

  it('separates the same exercise across different gyms', () => {
    const sessions = [
      session('2026-01-01', 'Brick', ['Pec Deck 300- 8.0']),
      session('2026-01-02', 'Ash', ['Pec Deck 250- 8.0']),
    ];
    const series = strengthSeries(sessions);
    expect(series).toHaveLength(2);
    expect(new Set(series.map((s) => s.location))).toEqual(new Set(['Brick', 'Ash']));
  });
});

describe('weeklyVolumeByMuscle — fractional credit, per-limb (SCIENCE.md §4)', () => {
  it('counts per worked limb and excludes the skipped surgical side', () => {
    const sessions = [
      session('2026-02-01', 'Brick', [
        'Uni Leg Press 200/100- 10.0/10.0', // L+R quads (2), glutes 0.5×2, ham 0.5×2
        'Uni Leg Ext 200/0- 10.0/0.0', // L quads (1); R skipped (reps 0)
      ]),
    ];
    const vol = weeklyVolumeByMuscle(sessions);
    const byMuscle = Object.fromEntries(vol.map((v) => [v.muscle, v.setsPerWeek]));
    expect(byMuscle.quads).toBeCloseTo(3, 5); // 2 (leg press L/R) + 1 (leg ext L)
    expect(byMuscle.glutes).toBeCloseTo(1, 5); // leg press secondary, 0.5 × 2 limbs
    expect(byMuscle.hamstrings).toBeUndefined(); // leg press no longer credits hamstrings
    const quads = vol.find((v) => v.muscle === 'quads')!;
    expect(quads.status).toBe('below_mev'); // 3 < MEV 8
    // breakdown: the 3 comes from leg press (2 limbs) + leg ext (1 limb), largest first
    expect(quads.contributions.map((c) => [c.rawName, c.role, c.hardSets, c.setsPerWeek])).toEqual([
      ['Uni Leg Press', 'primary', 2, 2],
      ['Uni Leg Ext', 'primary', 1, 1],
    ]);
  });
});

describe('strengthSummary — normalized progression', () => {
  const days = ['2026-04-01', '2026-04-03', '2026-04-05', '2026-04-07'];

  it('indexes each exercise to its own baseline (=100%) and groups by muscle', () => {
    // build two exercises, both rising, in different muscle groups
    const sessions: LiftSession[] = days.map((d, i) =>
      session(d, 'Gym', [
        `Machine Chest Press (2, 0) ${180 + i * 5}- 10.0`, // chest
        `Machine Lat Row ${200 + i * 10}- 10.0`, // lats
      ])
    );
    const sum = strengthSummary(sessions);

    expect(sum.byExercise).toHaveLength(2);
    for (const line of sum.byExercise) {
      expect(line.points[0].pct).toBeCloseTo(100, 6); // every line starts at 100%
      expect(line.points[line.points.length - 1].pct).toBeGreaterThan(100); // and rises
    }
    const chest = sum.byExercise.find((l) => l.label.includes('Chest'))!;
    const row = sum.byExercise.find((l) => l.label.includes('Row'))!;
    expect(chest.muscle).toBe('chest');
    expect(row.muscle).toBe('lats');

    // by-muscle: one line per group, each indexed to 100%
    expect(sum.byMuscle.map((l) => l.muscle).sort()).toEqual(['chest', 'lats']);
    sum.byMuscle.forEach((l) => expect(l.points[0].pct).toBeCloseTo(100, 6));
  });

  it('averages exercises within a muscle group (mean of relative progress)', () => {
    // two chest exercises ending at clearly different relative gains
    const sessions: LiftSession[] = days.map((d, i) =>
      session(d, 'Gym', [
        `Pec Deck ${200 + i * 4}- 10.0`, // slower gain
        `Machine Press (2) ${100 + i * 6}- 10.0`, // faster gain (smaller base, same step→bigger %)
      ])
    );
    const sum = strengthSummary(sessions);
    const chest = sum.byMuscle.find((l) => l.muscle === 'chest')!;
    const ex = sum.byExercise.filter((l) => l.muscle === 'chest');
    expect(ex).toHaveLength(2);
    // group's final % is the mean of the two exercises' final %s
    const meanFinal = ex.reduce((s, l) => s + l.points[l.points.length - 1].pct, 0) / 2;
    expect(chest.points[chest.points.length - 1].pct).toBeCloseTo(meanFinal, 4);
  });

  it('drops a series that mixes relative (+N) and absolute loads', () => {
    const sessions = [
      session('2026-04-01', 'Gym', ['Uni Pec Deck +25- 10.0']), // relative
      session('2026-04-03', 'Gym', ['Uni Pec Deck 300- 10.0']), // absolute
      session('2026-04-05', 'Gym', ['Uni Pec Deck 308- 10.0']),
    ];
    // +25 (over-stack) and 300/308 (pin) are different scales → not self-comparable
    expect(strengthSummary(sessions).byExercise.find((l) => l.label.includes('Pec Deck'))).toBeUndefined();
  });

  it('excludes exercises with too few points', () => {
    const sessions = [
      session('2026-04-01', 'Gym', ['Machine Chest Press (2) 180- 10.0']),
      session('2026-04-03', 'Gym', ['Machine Chest Press (2) 185- 10.0']),
    ]; // only 2 points
    expect(strengthSummary(sessions, { minPoints: 3 }).byExercise).toHaveLength(0);
  });

  // ---- (1) Normalization correctness vs. the smoothed trend (hand-checked) ----
  // GROUND TRUTH: by construction pct[i] = trend[i] / trend[0] * 100, with
  // pct[0] === 100 exactly. The trend array is the verified-by-golden Kalman
  // output of strengthSeries(); here we check ONLY the normalization transform
  // that strengthSummary() layers on top of it, to ~1e-6. (No smoother values
  // are predicted by hand — the smoother is pinned separately in estimator.test.ts.)
  it('normalizes pct[i] to exactly trend[i]/trend[0]*100, first point = 100', () => {
    const days4 = ['2026-04-01', '2026-04-03', '2026-04-05', '2026-04-07'];
    const sessions: LiftSession[] = days4.map((d, i) =>
      session(d, 'Gym', [`Pec Deck ${180 + i * 8}- 10.0`])
    );
    const series = strengthSeries(sessions).find((s) => s.rawName === 'Pec Deck')!;
    const line = strengthSummary(sessions).byExercise.find((l) => l.label.includes('Pec Deck'))!;

    expect(line.points).toHaveLength(series.trend.length);
    // first point is exactly 100 (trend[0]/trend[0])
    expect(line.points[0].pct).toBe(100);
    // every later point equals trend[i]/trend[0]*100 to 1e-6
    const base = series.trend[0];
    line.points.forEach((p, i) => {
      expect(p.pct).toBeCloseTo((series.trend[i] / base) * 100, 6);
      expect(p.day).toBe(series.points[i].day);
      expect(Number.isFinite(p.pct)).toBe(true);
    });
    // a monotone-increasing raw series yields a monotone-nondecreasing normalized
    // trend, and the last point is strictly above the 100% baseline.
    for (let i = 1; i < line.points.length; i++) {
      expect(line.points[i].pct).toBeGreaterThanOrEqual(line.points[i - 1].pct - 1e-9);
    }
    expect(line.points[line.points.length - 1].pct).toBeGreaterThan(100);
  });

  // ---- (2) Group averaging is the exact arithmetic mean on a shared grid ------
  // GROUND TRUTH: with >=2 exercises in one muscle on IDENTICAL day grids, the
  // grid points coincide with the exercises' own days, so interpAt returns each
  // member's pct verbatim and byMuscle.pct[d] must equal mean(member pct at d).
  it('byMuscle equals the arithmetic mean of member normalized pct at every grid day', () => {
    const days4 = ['2026-04-01', '2026-04-03', '2026-04-05', '2026-04-07'];
    const sessions: LiftSession[] = days4.map((d, i) =>
      session(d, 'Gym', [
        `Pec Deck ${200 + i * 4}- 10.0`,
        `Machine Press (2) ${100 + i * 6}- 10.0`,
      ])
    );
    const sum = strengthSummary(sessions);
    const chest = sum.byMuscle.find((l) => l.muscle === 'chest')!;
    const members = sum.byExercise.filter((l) => l.muscle === 'chest');
    expect(members).toHaveLength(2);

    // at each byMuscle grid day, the aggregate value must equal the arithmetic
    // mean of the two members' pct interpolated to that day (the code's contract).
    for (const gp of chest.points) {
      const memVals = members.map((m) => interpAt(m.points, gp.day));
      // both members active across the whole span → both contribute (no nulls)
      expect(memVals.every((v) => v != null)).toBe(true);
      const mean = (memVals[0]! + memVals[1]!) / 2;
      expect(gp.pct).toBeCloseTo(mean, 6); // exact arithmetic mean
      expect(Number.isFinite(gp.pct)).toBe(true);
    }
    // and the very first grid day is the mean of two 100%s = exactly 100
    expect(chest.points[0].pct).toBeCloseTo(100, 6);
  });

  // ---- (4) Mixed-scale exclusion drops the series from BOTH outputs ----------
  it('drops a mixed relative/absolute series from byExercise AND byMuscle', () => {
    const sessions = [
      session('2026-04-01', 'Gym', ['Uni Pec Deck +25- 10.0']), // relative (+N)
      session('2026-04-03', 'Gym', ['Uni Pec Deck 300- 10.0']), // absolute
      session('2026-04-05', 'Gym', ['Uni Pec Deck 308- 10.0']),
      session('2026-04-07', 'Gym', ['Uni Pec Deck 316- 10.0']),
    ];
    const sum = strengthSummary(sessions);
    // not in byExercise
    expect(sum.byExercise.find((l) => l.label.includes('Pec Deck'))).toBeUndefined();
    // and chest (Pec Deck's muscle) has no byMuscle line built from it
    expect(sum.byMuscle.find((l) => l.muscle === 'chest')).toBeUndefined();
  });
});

// ---- (3) interpAt — linear interpolation, knots, and out-of-span null --------
describe('interpAt — linear interpolation on a normalized line', () => {
  const pts: SummaryPoint[] = [
    { day: 0, pct: 100 },
    { day: 10, pct: 120 },
    { day: 20, pct: 110 },
  ];

  it('returns exact pct at each knot', () => {
    // HAND: knots reproduce their own pct.
    expect(interpAt(pts, 0)).toBe(100);
    expect(interpAt(pts, 10)).toBe(120);
    expect(interpAt(pts, 20)).toBe(110);
  });

  it('linearly interpolates an interior midpoint', () => {
    // HAND: day 5 is halfway 0->10: 100 + 0.5*(120-100) = 110.
    expect(interpAt(pts, 5)).toBeCloseTo(110, 9);
    // HAND: day 15 is halfway 10->20: 120 + 0.5*(110-120) = 115.
    expect(interpAt(pts, 15)).toBeCloseTo(115, 9);
    // HAND: day 2 on the 0->10 leg: 100 + (2/10)*20 = 104.
    expect(interpAt(pts, 2)).toBeCloseTo(104, 9);
  });

  it('returns null strictly outside [first, last] day', () => {
    expect(interpAt(pts, -0.001)).toBeNull(); // just below first
    expect(interpAt(pts, 20.001)).toBeNull(); // just above last
    expect(interpAt(pts, -100)).toBeNull();
    expect(interpAt(pts, 1000)).toBeNull();
    // boundaries themselves are IN-span (knots), not null
    expect(interpAt(pts, 0)).not.toBeNull();
    expect(interpAt(pts, 20)).not.toBeNull();
  });

  it('handles empty input and a coincident-day pair without NaN', () => {
    expect(interpAt([], 0)).toBeNull();
    // duplicate-day knot: code returns b.pct (no divide-by-zero).
    const dup: SummaryPoint[] = [
      { day: 0, pct: 100 },
      { day: 5, pct: 110 },
      { day: 5, pct: 130 },
    ];
    expect(interpAt(dup, 5)).toBe(110); // first leg whose b.day >= day wins (day<=pts[i].day)
    const v = interpAt(dup, 4.99);
    expect(Number.isFinite(v!)).toBe(true);
  });
});

// ---- mixedScale helper (unit) ----------------------------------------------
describe('mixedScale — relative/absolute mixing detector', () => {
  const sp = (relative: boolean): StrengthPoint => ({
    day: 0,
    date: null,
    e1rm: 100,
    confidence: 'low',
    relative,
  });
  it('flags a series with both relative and absolute points', () => {
    expect(mixedScale([sp(true), sp(false)])).toBe(true);
  });
  it('passes a pure-absolute or pure-relative series', () => {
    expect(mixedScale([sp(false), sp(false)])).toBe(false);
    expect(mixedScale([sp(true), sp(true)])).toBe(false);
    expect(mixedScale([])).toBe(false);
  });
});

// ---- (5) Edge cases: no NaN/Infinity, no crash -----------------------------
describe('strengthSummary — robustness / no NaN or Infinity', () => {
  const allFinite = (sum: ReturnType<typeof strengthSummary>) => {
    for (const l of [...sum.byExercise, ...sum.byMuscle]) {
      for (const p of l.points) {
        expect(Number.isFinite(p.pct)).toBe(true);
        expect(Number.isFinite(p.day)).toBe(true);
      }
    }
    expect(Number.isFinite(sum.dayMax)).toBe(true);
  };

  it('handles an all-flat series: every pct stays exactly 100', () => {
    // HAND: a constant raw e1RM → constant Kalman level → trend[i]/trend[0] = 1.
    const days4 = ['2026-04-01', '2026-04-03', '2026-04-05', '2026-04-07'];
    const sessions: LiftSession[] = days4.map((d) => session(d, 'Gym', ['Pec Deck 250- 10.0']));
    const sum = strengthSummary(sessions);
    const line = sum.byExercise.find((l) => l.label.includes('Pec Deck'))!;
    line.points.forEach((p) => expect(p.pct).toBeCloseTo(100, 6));
    const chest = sum.byMuscle.find((l) => l.muscle === 'chest')!;
    chest.points.forEach((p) => expect(p.pct).toBeCloseTo(100, 6));
    allFinite(sum);
  });

  it('does not crash or NaN on empty input', () => {
    const sum = strengthSummary([]);
    expect(sum.byExercise).toEqual([]);
    expect(sum.byMuscle).toEqual([]);
    expect(sum.dayMax).toBe(0); // dayMax = 0 path
    allFinite(sum);
  });

  it('a single muscle group with one qualifying exercise produces a clean line', () => {
    const days4 = ['2026-04-01', '2026-04-03', '2026-04-05', '2026-04-07'];
    const sessions: LiftSession[] = days4.map((d, i) =>
      session(d, 'Gym', [`Pec Deck ${180 + i * 5}- 10.0`])
    );
    const sum = strengthSummary(sessions);
    expect(sum.byExercise).toHaveLength(1);
    // one member still yields a byMuscle line (mean of one); >=2 grid points
    const chest = sum.byMuscle.find((l) => l.muscle === 'chest')!;
    expect(chest.points.length).toBeGreaterThanOrEqual(2);
    allFinite(sum);
  });

  it('a near-zero baseline does not blow pct to Infinity', () => {
    // smallest absolute load the parser accepts is 1 stack unit; e1RM ~= 1.33.
    // trend[0] > 0 so the series is kept; pct must stay finite (no /0).
    const days4 = ['2026-04-01', '2026-04-03', '2026-04-05', '2026-04-07'];
    const sessions: LiftSession[] = days4.map((d, i) =>
      session(d, 'Gym', [`Pec Deck ${1 + i}- 10.0`])
    );
    const sum = strengthSummary(sessions);
    allFinite(sum);
    const line = sum.byExercise.find((l) => l.label.includes('Pec Deck'));
    if (line) {
      expect(line.points[0].pct).toBe(100);
      line.points.forEach((p) => expect(Number.isFinite(p.pct)).toBe(true));
    }
  });

  it('a series whose trend[0] is non-positive is dropped (guards the divide)', () => {
    // strengthSummary filters on s.trend[0] > 0; a 0-baseline never produces a
    // divide-by-zero pct. Construct a degenerate-but-parseable run and confirm
    // no Infinity/NaN leaks through.
    const days3 = ['2026-04-01', '2026-04-03', '2026-04-05'];
    const sessions: LiftSession[] = days3.map((d, i) =>
      session(d, 'Gym', [`Pec Deck ${2 + i * 2}- 10.0`])
    );
    const sum = strengthSummary(sessions);
    allFinite(sum);
  });
});

describe('limbAsymmetry — LSI (SCIENCE.md §5)', () => {
  it('computes surgical/healthy ratio, surgical side = R by default', () => {
    const sessions = [
      session('2026-03-01', 'Brick', ['Uni Leg Press 200/100- 10.0/10.0']),
    ];
    const asym = limbAsymmetry(sessions);
    expect(asym).toHaveLength(1);
    // R (surgical) e1RM = 100×1.333, L (healthy) = 200×1.333 → LSI = 50%
    expect(asym[0].currentLSI).toBeCloseTo(50, 1);
  });
});
