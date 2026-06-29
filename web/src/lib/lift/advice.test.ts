import { describe, it, expect } from 'vitest';
import { volumeAdvice, isTodo } from './advice';
import { LANDMARKS, volumeStatus, type Muscle } from './muscles';
import type { MuscleVolume } from './analysis';

/** Build a realistic MuscleVolume using the real landmarks + classifier. */
function mv(muscle: Muscle, setsPerWeek: number): MuscleVolume {
  return {
    muscle,
    setsPerWeek,
    status: volumeStatus(muscle, setsPerWeek),
    landmark: LANDMARKS[muscle] ?? null,
    contributions: [],
  };
}

const findFor = (muscle: Muscle, vols: MuscleVolume[]) =>
  volumeAdvice(vols).find((a) => a.muscle === muscle);

describe('volumeAdvice', () => {
  it('below MEV → gradual "add ~2 sets" capped per week, building toward MAV', () => {
    // side delts: MEV 8, MAV [16,22]; at 6 → far below, but cap the weekly nudge at 2
    const a = findFor('side_delt', [mv('side_delt', 6)])!;
    expect(a.kind).toBe('add');
    expect(a.deltaSets).toBe(2); // capped, not the full 10-set gap
    expect(a.headline).toBe('Add ~2 sets');
    expect(a.detail).toMatch(/below MEV/);
    expect(a.detail).toMatch(/building toward/);
    expect(a.cite).toMatch(/SCIENCE\.md §3/);
  });

  it('small gap → suggests just the remaining sets (not a full step)', () => {
    // triceps: MEV 6, MAV [10,14]; at 9 → minimum, gap to 10 = 1 → add ~1
    const a = findFor('triceps', [mv('triceps', 9)])!;
    expect(a.kind).toBe('grow');
    expect(a.deltaSets).toBe(1);
    expect(a.detail).toMatch(/to reach the/);
  });

  it('above MRV → soft, gradual "trim ~2 sets", cited to the dose-response', () => {
    // biceps: MAV [14,20], MRV 26; at 28 → above MRV, but trim gradually (cap 2)
    const a = findFor('biceps', [mv('biceps', 28)])!;
    expect(a.kind).toBe('reduce');
    expect(a.deltaSets).toBe(-2);
    expect(a.detail).toMatch(/buys little/);
    expect(a.cite).toMatch(/Pelland 2025/);
  });

  it('in MAV → hold, not a to-do', () => {
    const a = findFor('chest', [mv('chest', 15)])!; // MAV [12,20]
    expect(a.kind).toBe('hold');
    expect(a.deltaSets).toBeNull();
    expect(isTodo(a)).toBe(false);
  });

  it('high (above MAV, below MRV) → watch, not a to-do', () => {
    const a = findFor('chest', [mv('chest', 21)])!; // MAV hi 20, MRV 22
    expect(a.kind).toBe('watch');
    expect(isTodo(a)).toBe(false);
  });

  it('never nags front delts to add direct volume (fed by pressing)', () => {
    const a = findFor('front_delt', [mv('front_delt', 3)])!; // minimum zone now (MEV 0)
    expect(a.kind).toBe('hold');
    expect(isTodo(a)).toBe(false);
    expect(a.detail).toMatch(/pressing/);
  });

  it('softens rehab-leg advice: "build gradually", no set count, physio deferral', () => {
    const a = volumeAdvice([mv('quads', 6)], { rehabMuscles: ['quads'] })[0]; // MEV 8 → below
    expect(a.kind).toBe('grow'); // not 'add'
    expect(a.headline).toBe('Build gradually');
    expect(a.deltaSets).toBeNull(); // no prescribed count for the rehab leg
    expect(a.detail).toMatch(/physio/);
    expect(a.cite).toMatch(/SCIENCE\.md §5/);
  });

  it('emits nothing for muscles with no landmark (adductors, erectors)', () => {
    expect(volumeAdvice([mv('adductors', 10), mv('erectors', 4)])).toEqual([]);
  });

  it('ranks below-MEV and above-MRV to-dos above in-zone holds', () => {
    const actions = volumeAdvice([
      mv('chest', 15), // optimal (hold)
      mv('side_delt', 7), // below MEV (add)
      mv('biceps', 28), // above MRV (reduce)
    ]);
    expect(actions[0].muscle).toBe('side_delt'); // severity 100
    expect(actions[1].muscle).toBe('biceps'); // severity 85
    expect(actions[2].muscle).toBe('chest'); // severity 10
  });
});
