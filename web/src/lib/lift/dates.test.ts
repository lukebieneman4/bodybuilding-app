import { describe, it, expect } from 'vitest';
import { assignCadenceDates, cadenceOffsets } from './dates';
import type { LiftSession } from './types';

const session = (split: string | null): LiftSession => ({
  title: split ?? 'Session',
  split,
  location: null,
  exercises: [],
  date: null,
});

describe('cadenceOffsets', () => {
  it('spaces FBEOD sessions every other day (train 1, rest 1)', () => {
    const s = [session('FBEOD'), session('FBEOD'), session('FBEOD')];
    expect(cadenceOffsets(s)).toEqual([0, 2, 4]);
  });

  it('spaces a 2-on/1-off split as gaps 1,2,1,2…', () => {
    const s = ['Anterior', 'Posterior', 'Anterior', 'Posterior'].map(session);
    // day before each: 0, +1, +2, +1 → 0,1,3,4
    expect(cadenceOffsets(s)).toEqual([0, 1, 3, 4]);
  });
});

describe('assignCadenceDates', () => {
  it("end-anchored: the LAST session lands on the anchor (today) and earlier sessions run backward", () => {
    const s = [session('FBEOD'), session('FBEOD'), session('FBEOD')];
    const dated = assignCadenceDates(s, '2026-06-29'); // default anchor: 'end'
    // span = 4 days; first session = 2026-06-25, last = 2026-06-29
    expect(dated.map((d) => d.date)).toEqual(['2026-06-25', '2026-06-27', '2026-06-29']);
  });

  it("start-anchored keeps the legacy forward behaviour", () => {
    const s = [session('FBEOD'), session('FBEOD'), session('FBEOD')];
    const dated = assignCadenceDates(s, '2026-01-01', 'start');
    expect(dated.map((d) => d.date)).toEqual(['2026-01-01', '2026-01-03', '2026-01-05']);
  });

  it('does not mutate the input sessions', () => {
    const s = [session('FBEOD')];
    assignCadenceDates(s, '2026-06-29');
    expect(s[0].date).toBeNull();
  });

  it('handles a single session (lands on the anchor)', () => {
    const dated = assignCadenceDates([session('FBEOD')], '2026-06-29');
    expect(dated[0].date).toBe('2026-06-29');
  });

  it('handles an empty list', () => {
    expect(assignCadenceDates([], '2026-06-29')).toEqual([]);
  });
});
