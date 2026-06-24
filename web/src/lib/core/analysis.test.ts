import { describe, it, expect } from 'vitest';
import { analyzeWeight } from './analysis';
import type { Profile, WeighIn } from '../data/types';
import { lbToKg } from '../data/types';

// A simple ~0.5 lb/day descending series starting 2026-06-01.
function series(): WeighIn[] {
  const start = new Date('2026-06-01T00:00:00Z');
  const out: WeighIn[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    out.push({ date: d.toISOString().slice(0, 10), weightKg: lbToKg(200 - i * 0.5) });
  }
  return out;
}

function profile(over: Partial<Profile> = {}): Profile {
  return {
    units: 'lb',
    goalKg: lbToKg(185),
    paceMode: 'rate',
    targetRatePctPerWeek: 0.5,
    createdAt: '2026-06-01',
    ...over,
  };
}

describe('analyzeWeight pace modes', () => {
  it('rate mode: no deadline, planLosing reflects goal below start', () => {
    const a = analyzeWeight(series(), profile({ paceMode: 'rate' }))!;
    expect(a.targetDateDay).toBeNull();
    expect(a.deadlineISO).toBeNull();
    expect(a.planLosing).toBe(true);
  });

  it('date mode: deadline maps to the chosen date', () => {
    const a = analyzeWeight(series(), profile({ paceMode: 'date', targetDate: '2026-09-01' }))!;
    expect(a.deadlineISO).toBe('2026-09-01');
    // 2026-06-01 -> 2026-09-01 is 92 days
    expect(a.targetDateDay).toBe(92);
  });

  it('duration mode: deadline is N weeks after the first weigh-in', () => {
    const a = analyzeWeight(series(), profile({ paceMode: 'duration', durationWeeks: 12 }))!;
    expect(a.targetDateDay).toBe(84); // 12 * 7
    expect(a.deadlineISO).toBe('2026-08-24'); // 2026-06-01 + 84 days
  });

  it('planLosing is false when the goal is above the start (gain phase)', () => {
    const a = analyzeWeight(series(), profile({ goalKg: lbToKg(210) }))!;
    expect(a.planLosing).toBe(false);
  });
});
