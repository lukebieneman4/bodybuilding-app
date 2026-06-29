/** Small display-formatting helpers (UI boundary; never used in the core math). */

/**
 * Format a day-offset from a base ISO date as a short calendar label, e.g.
 * `shortDate('2026-06-01', 28)` → "Jun 29". UTC throughout so the label matches
 * the stored ISO date regardless of the viewer's timezone.
 */
export function shortDate(baseISO: string, day: number): string {
  const d = new Date(baseISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.round(day));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
