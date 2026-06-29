/**
 * Session-cadence dating. The user's log has no dates — sessions are sequential,
 * spaced by his training rhythm:
 *   • FBEOD (full-body every other day) → +2 days each (train 1, rest 1).
 *   • Anterior/Posterior and Upper/Lower → 2-on / 1-off (gaps 1, 2, 1, 2…).
 *   • (weak-point days extend a block to 3-on/1-off — not auto-detected; the
 *     import preview lets the user correct the rare case.)
 *
 * Given an anchor date, this lays the sessions onto a realistic calendar so the
 * strength estimator has an honest per-week axis. The anchor is the MOST RECENT
 * session by default (`anchor: 'end'`): the last session lands on `anchorISO`
 * (normally today) and earlier sessions run backward from it, so the charts end
 * at "now" and show current training — not data stranded weeks in the future.
 * `anchor: 'start'` keeps the old behaviour (first session on `anchorISO`).
 */

import type { LiftSession } from './types';

function isoPlus(startISO: string, days: number): string {
  const d = new Date(startISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Forward day offset of each session from the first (first session = 0). */
export function cadenceOffsets(sessions: LiftSession[]): number[] {
  let day = 0;
  let pairPos = 0; // position within a 2-on/1-off block
  const offsets: number[] = [];
  for (const s of sessions) {
    offsets.push(day);
    if (s.split === 'FBEOD' || s.split == null) {
      day += 2; // train-1-rest-1
      pairPos = 0;
    } else {
      pairPos++;
      day += pairPos % 2 === 1 ? 1 : 2; // within-block then rest
    }
  }
  return offsets;
}

/**
 * Return copies of `sessions` with `date` assigned from `anchorISO` by cadence.
 * With `anchor: 'end'` (default) the last session is dated `anchorISO` and the
 * rest run backward; with `anchor: 'start'` the first session is dated `anchorISO`.
 */
export function assignCadenceDates(
  sessions: LiftSession[],
  anchorISO: string,
  anchor: 'start' | 'end' = 'end',
): LiftSession[] {
  const offsets = cadenceOffsets(sessions);
  const span = offsets.length ? offsets[offsets.length - 1] : 0;
  return sessions.map((s, i) => ({
    ...s,
    date: isoPlus(anchorISO, anchor === 'end' ? offsets[i] - span : offsets[i]),
  }));
}
