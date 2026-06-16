/**
 * Session-cadence dating. The user's log has no dates — sessions are sequential,
 * spaced by his training rhythm:
 *   • FBEOD (full-body every other day) → +2 days each (train 1, rest 1).
 *   • Anterior/Posterior and Upper/Lower → 2-on / 1-off (gaps 1, 2, 1, 2…).
 *   • (weak-point days extend a block to 3-on/1-off — not auto-detected; the
 *     import preview lets the user correct the rare case.)
 * Given a start date, this lays the sessions onto a realistic calendar so the
 * strength estimator has an honest per-week axis.
 */

import type { LiftSession } from './types';

function isoPlus(startISO: string, days: number): string {
  const d = new Date(startISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Return copies of `sessions` with `date` assigned from `startISO` by cadence. */
export function assignCadenceDates(sessions: LiftSession[], startISO: string): LiftSession[] {
  let day = 0;
  let pairPos = 0; // position within a 2-on/1-off block
  return sessions.map((s) => {
    const dated: LiftSession = { ...s, date: isoPlus(startISO, day) };
    if (s.split === 'FBEOD' || s.split == null) {
      day += 2; // train-1-rest-1
      pairPos = 0;
    } else {
      pairPos++;
      day += pairPos % 2 === 1 ? 1 : 2; // within-block then rest
    }
    return dated;
  });
}
