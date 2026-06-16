import { describe, it, expect } from 'vitest';
import { musclesFor, volumeStatus } from './muscles';

describe('musclesFor — attribution for the user\'s real exercises (SCIENCE.md §4)', () => {
  it('maps compound and isolation lifts to primary + fractional secondaries', () => {
    expect(musclesFor('uni leg press')).toEqual({ primary: ['quads'], secondary: ['glutes'] });
    expect(musclesFor('uni leg ext')).toEqual({ primary: ['quads'], secondary: [] });
    expect(musclesFor('pec deck')).toEqual({ primary: ['chest'], secondary: [] });
    expect(musclesFor('reverse pec deck')).toEqual({ primary: ['rear_delt'], secondary: ['traps'] });
    expect(musclesFor('wide grip pulldown')).toEqual({ primary: ['lats'], secondary: ['biceps'] });
    expect(musclesFor('machine side delt')).toEqual({ primary: ['side_delt'], secondary: [] });
    expect(musclesFor('machine calf press')).toEqual({ primary: ['calves'], secondary: [] });
    expect(musclesFor('abductors')).toEqual({ primary: ['glutes'], secondary: [] });
    expect(musclesFor('uni 45 ext')).toEqual({ primary: ['glutes', 'hamstrings'], secondary: ['erectors'] });
  });

  it('does not let "ham curl" fall through to the generic curl→biceps rule', () => {
    expect(musclesFor('uni hamstring curl')).toEqual({ primary: ['hamstrings'], secondary: [] });
    expect(musclesFor('uni machine preacher curl')).toEqual({ primary: ['biceps'], secondary: [] });
  });

  it('falls back to chest for a generic machine press', () => {
    expect(musclesFor('machine press')).toEqual({ primary: ['chest'], secondary: ['front_delt', 'triceps'] });
  });

  it('does not match the "t bar" inside "straight bar" (tricep ≠ row)', () => {
    expect(musclesFor('straight bar tricep ext')).toEqual({ primary: ['triceps'], secondary: [] });
    expect(musclesFor('shrugged straight bar tricep ext')).toEqual({ primary: ['triceps'], secondary: [] });
    expect(musclesFor('straight bar pulldown')).toEqual({ primary: ['lats'], secondary: ['biceps'] });
  });

  it('splits rows by grip: lat-biased row → lats, wide-grip row → traps', () => {
    expect(musclesFor('machine lat row')).toEqual({ primary: ['lats'], secondary: ['traps', 'biceps'] });
    expect(musclesFor('tbar wide grip row')).toEqual({ primary: ['traps'], secondary: ['lats', 'biceps'] });
  });

  it('returns null for an unrecognized exercise', () => {
    expect(musclesFor('mystery contraption')).toBeNull();
  });
});

describe('volumeStatus — landmark zones (SCIENCE.md §3)', () => {
  it('classifies against MEV / MAV / MRV', () => {
    expect(volumeStatus('chest', 6)).toBe('below_mev'); // < MEV 8
    expect(volumeStatus('chest', 10)).toBe('minimum'); // MEV..MAV-lo
    expect(volumeStatus('chest', 15)).toBe('optimal'); // in MAV [12,20]
    expect(volumeStatus('chest', 21)).toBe('high'); // MAV-hi..MRV
    expect(volumeStatus('chest', 25)).toBe('above_mrv'); // > MRV 22
  });
  it('reports no landmark for adductors', () => {
    expect(volumeStatus('adductors', 10)).toBe('none');
  });
});
