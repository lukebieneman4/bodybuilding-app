/**
 * Volume Coach — turns the descriptive weekly-volume-per-muscle numbers into
 * ranked, concrete-but-hedged training actions ("add ~2 sets", "trim ~3 sets").
 *
 * Pure and dependency-free so it can be unit-tested against the landmark zones.
 * Every action carries a citation (CLAUDE.md: no magic numbers). Guardrails,
 * straight from SCIENCE.md:
 *   • §3  numbers are RP coach-consensus landmarks with ±2-set fuzz → hedge.
 *   • §6  past MRV, extra volume buys little (Pelland 2025 dose-response) →
 *         "reduce" is a soft suggestion, never a hard "deload now".
 *   • §3  front delts are fed indirectly by pressing → never nag direct volume.
 *   • §5  ACL surgical-leg muscles target MV→MEV and progress only as the knee
 *         tolerates → no aggressive "add N sets" for rehab muscles; defer to physio.
 */

import type { MuscleVolume } from './analysis';
import type { Muscle, VolumeStatus } from './muscles';

export type ActionKind = 'add' | 'grow' | 'hold' | 'watch' | 'reduce';

export interface VolumeAction {
  muscle: Muscle;
  setsPerWeek: number;
  status: VolumeStatus;
  kind: ActionKind;
  /** Suggested change in sets/week (signed); null for status-only (hold/watch). */
  deltaSets: number | null;
  /** Short chip, e.g. "Add ~2 sets". */
  headline: string;
  /** One concrete-but-hedged sentence. */
  detail: string;
  /** Source for the recommendation. */
  cite: string;
  /** Sort key — higher = more urgent. */
  severity: number;
}

export interface AdviceOptions {
  /** Muscles under injury rehab: soften "add" to conservative, defer to clinician. */
  rehabMuscles?: Muscle[];
  /** Muscles never nagged to add direct volume (fed indirectly, e.g. front delts). */
  noAddNag?: Muscle[];
}

const DEFAULT_NO_ADD_NAG: Muscle[] = ['front_delt'];

/** Volume is progressed gradually across a mesocycle, not jumped in one week —
 *  cap any single-week add/trim at ~1–2 sets/muscle (RP progressive overload). */
const WEEKLY_STEP = 2;

const LM_CITE = 'RP landmarks; Schoenfeld dose-response (SCIENCE.md §3)';
const ADD_CITE = 'RP landmarks + ~1–2 sets/wk progression (SCIENCE.md §3)';
const MRV_CITE = 'Pelland 2025 dose-response; RP MRV (SCIENCE.md §3, §6)';
const REHAB_CITE = 'ACL: surgical leg MV→MEV (SCIENCE.md §5)';

const fmt = (n: number): string => n.toFixed(1);
const plural = (n: number): string => (n === 1 ? '' : 's');

/**
 * Build the ranked action list from the weekly-volume table. `add`/`grow`/`reduce`
 * are real to-dos; `hold`/`watch` are status lines. Muscles with no landmark
 * (adductors, erectors) produce nothing.
 */
export function volumeAdvice(volume: MuscleVolume[], opts: AdviceOptions = {}): VolumeAction[] {
  const rehab = new Set(opts.rehabMuscles ?? []);
  const noAdd = new Set(opts.noAddNag ?? DEFAULT_NO_ADD_NAG);
  const out: VolumeAction[] = [];

  for (const v of volume) {
    const lm = v.landmark;
    if (!lm) continue; // no published landmark → no nag
    const sets = v.setsPerWeek;
    const [mavLo, mavHi] = lm.mav;
    const isRehab = rehab.has(v.muscle);
    const base = { muscle: v.muscle, setsPerWeek: sets, status: v.status };

    switch (v.status) {
      case 'below_mev':
      case 'minimum': {
        const gap = Math.max(1, Math.round(mavLo - sets)); // sets to reach the zone
        const step = Math.min(gap, WEEKLY_STEP); // but only nudge ~1–2/week
        const below = v.status === 'below_mev';
        const building = gap > step; // a long way to go → "keep building"
        if (noAdd.has(v.muscle)) {
          out.push({
            ...base, kind: 'hold', deltaSets: null, headline: 'Fed indirectly',
            detail: `${fmt(sets)} direct sets/wk — front delts get plenty from your pressing, so direct work is optional.`,
            cite: LM_CITE, severity: 5,
          });
          break;
        }
        if (isRehab) {
          out.push({
            ...base, kind: 'grow', deltaSets: null,
            headline: 'Build gradually',
            detail: `${fmt(sets)} sets/wk — ${below ? `below MEV (${lm.mev})` : `below the ${mavLo}–${mavHi} zone`}. Build leg volume gradually as the knee tolerates (rehab: maintenance→MEV first) — defer load/progression to your physio.`,
            cite: REHAB_CITE, severity: below ? 55 : 35,
          });
          break;
        }
        out.push({
          ...base, kind: below ? 'add' : 'grow', deltaSets: step,
          headline: `Add ~${step} set${plural(step)}`,
          detail: `${fmt(sets)} sets/wk — ${below ? `below MEV (${lm.mev})` : `above MEV but under the ${mavLo}–${mavHi} zone`}. Add ~${step} set${plural(step)} next week${building ? `, building toward the ${mavLo}–${mavHi} zone` : ` to reach the ${mavLo}–${mavHi} zone`} (±2-set fuzz).`,
          cite: ADD_CITE, severity: below ? 100 : 70,
        });
        break;
      }
      case 'above_mrv': {
        const over = Math.max(1, Math.round(sets - mavHi)); // sets above the productive band
        const step = Math.min(over, WEEKLY_STEP);
        out.push({
          ...base, kind: 'reduce', deltaSets: -step,
          headline: `Trim ~${step} set${plural(step)}`,
          detail: `${fmt(sets)} sets/wk — over your MRV (${lm.mrv}). Pull back ~${step} set${plural(step)} next week${over > step ? ' and keep easing toward the productive band' : ''}; past here extra volume buys little and adds fatigue.`,
          cite: MRV_CITE, severity: 85,
        });
        break;
      }
      case 'high':
        out.push({
          ...base, kind: 'watch', deltaSets: null, headline: 'Near your ceiling',
          detail: `${fmt(sets)} sets/wk — above the productive band, approaching MRV (${lm.mrv}). Fine short-term; just don't let it creep up.`,
          cite: LM_CITE, severity: 30,
        });
        break;
      case 'optimal':
        out.push({
          ...base, kind: 'hold', deltaSets: null, headline: 'In the zone',
          detail: `${fmt(sets)} sets/wk — right in your ${mavLo}–${mavHi} productive zone. Hold.`,
          cite: LM_CITE, severity: 10,
        });
        break;
    }
  }

  out.sort((a, b) => b.severity - a.severity || Math.abs(b.deltaSets ?? 0) - Math.abs(a.deltaSets ?? 0));
  return out;
}

/** The action kinds that are real to-dos (vs status lines). */
export const TODO_KINDS: ActionKind[] = ['add', 'grow', 'reduce'];
export const isTodo = (a: VolumeAction): boolean => TODO_KINDS.includes(a.kind);
