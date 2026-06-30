import { describe, it, expect } from 'vitest';
import { proteinTargetGrams, leanMassKg } from './protein';
import { DEFAULT_SETTINGS, type Settings } from '../data/types';

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe('leanMassKg', () => {
  it('computes fat-free mass from bodyweight and body-fat %', () => {
    expect(leanMassKg(100, 20)).toBeCloseTo(80, 5);
  });
  it('returns null for missing or nonsensical body-fat %', () => {
    expect(leanMassKg(100, undefined)).toBeNull();
    expect(leanMassKg(100, 0)).toBeNull();
    expect(leanMassKg(100, 100)).toBeNull();
  });
});

describe('proteinTargetGrams', () => {
  it('scales off total bodyweight by default (Morton 2018 basis)', () => {
    expect(proteinTargetGrams(settings({ proteinTargetGPerKg: 2.2 }), 90)).toBeCloseTo(198, 5);
  });

  it('scales off fat-free mass on the lean-mass basis when body-fat % is given (Helms 2014)', () => {
    const s = settings({ proteinBasis: 'leanmass', proteinTargetGPerKg: 2.6, bodyFatPct: 15 });
    expect(proteinTargetGrams(s, 90)).toBeCloseTo(2.6 * (90 * 0.85), 5); // 198.9
  });

  it('falls back to bodyweight on the lean-mass basis when body-fat % is absent', () => {
    const s = settings({ proteinBasis: 'leanmass', proteinTargetGPerKg: 2.6, bodyFatPct: undefined });
    expect(proteinTargetGrams(s, 90)).toBeCloseTo(2.6 * 90, 5);
  });

  it('returns 0 when bodyweight is unknown', () => {
    expect(proteinTargetGrams(settings(), 0)).toBe(0);
  });
});
