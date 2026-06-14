import type { WeighIn, Units } from './types';
import { toKg } from './types';

/**
 * Parse a weigh-in CSV. Accepts `date,weight` rows (header optional), `#`
 * comments, and blank lines. Dates as YYYY-MM-DD or MM/DD/YYYY. Weights are in
 * `units` and stored canonically in kg. Rows that don't parse are skipped.
 */
export function parseWeighInCsv(text: string, units: Units): WeighIn[] {
  const out: WeighIn[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 2) continue;
    const w = Number(parts[1]);
    if (!Number.isFinite(w)) continue; // skips header / NA rows
    const iso = normalizeDate(parts[0]);
    if (!iso) continue;
    out.push({ date: iso, weightKg: toKg(w, units) });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Normalize a date string to ISO YYYY-MM-DD, or null if unparseable. */
export function normalizeDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    let [, m, d, y] = us;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

/** Export weigh-ins to `date,weight` CSV in the given display units. */
export function weighInsToCsv(weighIns: WeighIn[], units: Units): string {
  const fromKg = (kg: number) => (units === 'lb' ? kg / 0.45359237 : kg);
  const rows = weighIns.map((w) => `${w.date},${fromKg(w.weightKg).toFixed(1)}`);
  return `date,weight\n${rows.join('\n')}\n`;
}
