import { describe, it, expect } from 'vitest';
import { macroTargets } from './macros';
import { DEFAULT_SETTINGS, type Settings } from '../data/types';

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe('macroTargets — auto (science-based) split', () => {
  it('sets protein + fat by bodyweight and fills carbs from the calorie target', () => {
    const m = macroTargets(settings({ proteinTargetGPerKg: 2.2, fatTargetGPerKg: 0.8 }), 90, 2500);
    expect(m.protein).toBeCloseTo(198, 5); // 2.2 × 90
    expect(m.fat).toBeCloseTo(72, 5); // 0.8 × 90
    expect(m.carb).toBeCloseTo((2500 - 198 * 4 - 72 * 9) / 4, 5); // 265
    expect(m.clipped).toBe(false);
    expect(m.fatFloored).toBe(false);
  });

  it('raises fat to the 20%-of-calories hormonal floor when g/kg is too low', () => {
    const m = macroTargets(settings({ fatTargetGPerKg: 0.2 }), 90, 2500); // 18g < floor
    expect(m.fatFloored).toBe(true);
    expect(m.fat).toBeCloseTo((0.2 * 2500) / 9, 5); // ~55.6g
  });

  it('returns a null carb target when there is no calorie target', () => {
    const m = macroTargets(settings(), 90, 0);
    expect(m.carb).toBeNull();
    expect(m.protein).toBeGreaterThan(0);
  });

  it('clips carbs to 0 when protein + fat already exceed the calorie target', () => {
    const m = macroTargets(settings({ proteinTargetGPerKg: 3, fatTargetGPerKg: 1.5 }), 100, 1200);
    expect(m.carb).toBe(0);
    expect(m.clipped).toBe(true);
  });
});

describe('macroTargets — custom', () => {
  it('returns the athlete’s explicit gram targets and their calorie sum', () => {
    const m = macroTargets(settings({ macroMode: 'custom', customProteinG: 200, customCarbG: 250, customFatG: 70 }), 90, 2500);
    expect(m.source).toBe('custom');
    expect([m.protein, m.carb, m.fat]).toEqual([200, 250, 70]);
    expect(m.calories).toBe(200 * 4 + 250 * 4 + 70 * 9); // 2430
  });
});
