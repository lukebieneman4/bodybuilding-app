import { describe, it, expect } from 'vitest';
import { buildInsights } from './insights';
import type { WeightAnalysis, TrackStatus } from '../core/analysis';
import type { Profile } from '../data/types';
import { lbToKg } from '../data/types';

function profile(over: Partial<Profile> = {}): Profile {
  return {
    units: 'lb',
    goalKg: lbToKg(187),
    paceMode: 'rate',
    targetRatePctPerWeek: 0.5,
    createdAt: '2026-01-01',
    ...over,
  };
}

interface AOpts {
  lastDay?: number;
  idealKgWk?: number;
  etaWeeks?: number | null;
  targetDateDay?: number | null;
  planLosing?: boolean;
}
function analysis(trendLb: number, ratePct: number, status: TrackStatus, o: AOpts = {}): WeightAnalysis {
  const trendKg = lbToKg(trendLb);
  const ratePerWkKg = (ratePct / 100) * trendKg;
  return {
    hasEnough: true,
    units: 'lb',
    lastDay: o.lastDay ?? 70,
    targetDateDay: o.targetDateDay ?? null,
    deadlineISO: null,
    planLosing: o.planLosing ?? true,
    current: {
      trendDisplay: trendLb,
      trendKg,
      ratePerWk: 0,
      ratePerWkKg,
      ratePct,
      idealRatePerWk: 0,
      idealRatePerWkKg: o.idealKgWk ?? -0.45,
      status,
      etaWeeks: o.etaWeeks ?? null,
      etaRange: null,
    },
  } as unknown as WeightAnalysis;
}

const ids = (p: Profile, a: WeightAnalysis, n: number) =>
  buildInsights(a, p, Array.from({ length: n }, (_, i) => ({ date: `2026-01-${i + 1}`, weightKg: 90 })));

describe('cited insights', () => {
  it('warns on fast loss (>1%/wk)', () => {
    const list = ids(profile(), analysis(200, -1.3, 'fast'), 30);
    expect(list.find((x) => x.id === 'too-fast')?.severity).toBe('warn');
  });

  it('flags goal arrival (single goal weight)', () => {
    const list = ids(profile(), analysis(187, -0.3, 'on'), 30);
    expect(list.some((x) => x.id === 'in-goal')).toBe(true);
  });

  it('does not flag goal arrival while still well above goal', () => {
    const list = ids(profile(), analysis(200, -0.6, 'on'), 30);
    expect(list.some((x) => x.id === 'in-goal')).toBe(false);
  });

  it('flags the deadline in duration mode (no explicit targetDate)', () => {
    const list = ids(
      profile({ paceMode: 'duration', durationWeeks: 12 }),
      analysis(195, -0.4, 'on', { targetDateDay: 84, etaWeeks: 8, lastDay: 70 }),
      30
    );
    expect(list.some((x) => x.id === 'target-date')).toBe(true);
  });

  it('adds recovery caution when notes mention surgery', () => {
    const list = ids(profile({ notes: 'ACL surgery recovery' }), analysis(200, -0.6, 'on'), 30);
    expect(list.some((x) => x.id === 'recovery')).toBe(true);
  });

  it('always gives a protein target while losing', () => {
    const list = ids(profile(), analysis(200, -0.6, 'on'), 30);
    const p = list.find((x) => x.id === 'protein');
    expect(p).toBeDefined();
    expect(p!.cite).toContain('Morton');
  });

  it('suggests a diet break after 10+ weeks', () => {
    const list = ids(profile(), analysis(195, -0.6, 'on', { lastDay: 84 }), 30);
    expect(list.some((x) => x.id === 'diet-break')).toBe(true);
  });

  it('gives a computed (non-fixed) kcal adjustment when behind pace', () => {
    // actual -0.3%/wk vs ideal -0.5 kg/wk → a specific, derived number (not 150)
    const list = ids(profile(), analysis(195, -0.3, 'slow', { idealKgWk: -0.5 }), 30);
    const behind = list.find((x) => x.id === 'behind');
    expect(behind).toBeDefined();
    expect(behind!.detail).toMatch(/cut about \d+ kcal\/day/);
    expect(behind!.detail).not.toMatch(/150 kcal/); // proves it is computed
  });

  it('reports being behind the target date', () => {
    const list = ids(
      profile({ targetDate: '2026-09-01' }),
      analysis(195, -0.4, 'on', { targetDateDay: 84, etaWeeks: 8, lastDay: 70 }),
      30
    );
    const td = list.find((x) => x.id === 'target-date');
    expect(td).toBeDefined();
    expect(td!.title.toLowerCase()).toContain('behind');
  });

  it('surfaces a cited maintenance read when a TDEE estimate is available', () => {
    const tdee = {
      tdee: 2900,
      sd: 60,
      ci95: [2782, 3018] as [number, number],
      intakeMean: 2400,
      rateKgPerDay: -500 / 7700,
      nIntake: 24,
      windowDays: 28,
      predictedRateKgPerWk: (at: number) => ((at - 2900) / 7700) * 7,
    };
    const list = buildInsights(
      analysis(200, -0.5, 'on'),
      profile(),
      Array.from({ length: 20 }, (_, i) => ({ date: `2026-01-${i + 1}`, weightKg: 90 })),
      [],
      tdee
    );
    const m = list.find((x) => x.id === 'maintenance');
    expect(m).toBeDefined();
    expect(m!.title).toContain('2900');
    expect(m!.detail).toContain('deficit');
    expect(m!.cite.length).toBeGreaterThan(0);
  });

  it('omits the maintenance read with no TDEE estimate', () => {
    const list = ids(profile(), analysis(200, -0.6, 'on'), 30);
    expect(list.some((x) => x.id === 'maintenance')).toBe(false);
  });

  it('every insight carries a citation', () => {
    const list = ids(profile({ notes: 'ACL' }), analysis(200, -1.2, 'fast'), 5);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((x) => x.cite.length > 0)).toBe(true);
  });
});
