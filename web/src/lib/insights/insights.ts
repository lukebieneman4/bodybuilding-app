import type { WeightAnalysis } from '../core/analysis';
import type { TDEEResult } from '../core/tdee';
import type { Profile, WeighIn, CalorieEntry } from '../data/types';
import { rateFromKg } from '../data/types';

/**
 * Rule-based, cited insights. Every recommendation traces to a reference — no
 * "plausible-looking" advice. Caloric adjustments are computed from the actual
 * gap to the ideal pace, not fixed numbers: a rate gap of Δ kg/wk needs about
 * Δ × 7700 / 7 kcal/day of intake change (≈7700 kcal per kg of body mass).
 *
 * Sources:
 *  - Helms, Aragon & Fitschen (2014), JISSN 11:20 — loss rate 0.5-1%/wk;
 *    protein 2.3-3.1 g/kg FFM in a deficit for natural lifters.
 *  - Garthe et al. (2011), IJSNEM 21(2):97-104 — slower loss (~0.7%/wk)
 *    preserved/built lean mass vs faster loss.
 *  - Morton et al. (2018), Br J Sports Med 52:376 — ~1.6 g/kg/day protein
 *    supports resistance-training adaptations.
 *  - Byrne et al. (2018) "MATADOR", Int J Obes 42:129 — intermittent diet
 *    breaks at maintenance improved fat loss and post-diet maintenance.
 *  - Tipton (2015), Sports Med 45(S1):S93 — adequate protein/energy supports
 *    recovery from injury; avoid large deficits while healing.
 *  - Hall et al. (2008), Am J Clin Nutr 88:1495 — energy density of body-mass
 *    change (~7700 kcal/kg) used for the intake-adjustment math.
 */

export type Severity = 'good' | 'info' | 'warn';

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  cite: string;
}

const RECOVERY_RE = /acl|surger|injur|recover|rehab/i;
const KCAL_PER_KG = 7700;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const bucket = (kcal: number): number => Math.max(25, Math.round(kcal / 25) * 25);

function recentIntake(calories: CalorieEntry[]): number | null {
  if (calories.length < 3) return null;
  const last = [...calories].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  return Math.round(last.reduce((s, c) => s + c.kcal, 0) / last.length);
}

/** Intake change (kcal/day) that would move the actual rate to the ideal pace. */
function kcalAdjustment(
  analysis: WeightAnalysis,
  calories: CalorieEntry[]
): { kcal: number; dir: 'cut' | 'add'; phrase: string } {
  const deltaSigned = ((analysis.current.idealRatePerWkKg - analysis.current.ratePerWkKg) * KCAL_PER_KG) / 7;
  const kcal = bucket(Math.abs(deltaSigned));
  const dir: 'cut' | 'add' = deltaSigned < 0 ? 'cut' : 'add';
  const change = dir === 'cut' ? `cut about ${kcal} kcal/day` : `add about ${kcal} kcal/day`;
  const ri = recentIntake(calories);
  let phrase = `${change}.`;
  if (ri != null) {
    const target = Math.round((ri + Math.sign(deltaSigned) * kcal) / 25) * 25;
    phrase = `${change} — about ${target} kcal/day vs your recent ~${ri}.`;
  }
  return { kcal, dir, phrase };
}

export function buildInsights(
  analysis: WeightAnalysis,
  profile: Profile,
  weighIns: WeighIn[],
  calories: CalorieEntry[] = [],
  tdee: TDEEResult | null = null
): Insight[] {
  const out: Insight[] = [];
  const c = analysis.current;
  const units = analysis.units;
  const currentKg = c.trendKg;
  const losing = c.ratePct < 0;
  const ratePctAbs = Math.abs(c.ratePct);
  const idealPctAbs = Math.abs((c.idealRatePerWkKg * 100) / currentKg);
  const weeksLogged = analysis.lastDay / 7;
  const recovery = RECOVERY_RE.test(profile.notes ?? '');
  const inGoal =
    profile.goalLowKg != null &&
    profile.goalHighKg != null &&
    currentKg <= profile.goalHighKg &&
    currentKg >= profile.goalLowKg;

  // 1) goal proximity wins — if you're there, stop cutting
  if (inGoal) {
    out.push({
      id: 'in-goal',
      severity: 'good',
      title: 'You are in your goal range',
      detail:
        'Your trend is inside the range you set. Consider transitioning to maintenance calories to lock in the result rather than continuing to lose.',
      cite: 'Helms 2014',
    });
  }

  // 2) rate vs pace — with a computed, numeric intake adjustment
  if (!inGoal && losing && ratePctAbs > 1.0) {
    const adj = kcalAdjustment(analysis, calories);
    out.push({
      id: 'too-fast',
      severity: 'warn',
      title: `Losing fast (${ratePctAbs.toFixed(2)}%/wk)`,
      detail:
        `Above ~1%/wk, more of the loss tends to come from lean mass — worse while recovering. ` +
        `To return to your ~${idealPctAbs.toFixed(2)}%/wk plan, ${adj.phrase}`,
      cite: 'Garthe 2011; Helms 2014; Hall 2008',
    });
  } else if (!inGoal && c.status === 'fast') {
    const adj = kcalAdjustment(analysis, calories);
    out.push({
      id: 'slightly-fast',
      severity: 'info',
      title: `Slightly fast (${ratePctAbs.toFixed(2)}%/wk vs ${idealPctAbs.toFixed(2)}%/wk plan)`,
      detail: `Fine short-term. To ease back to plan, ${adj.phrase}`,
      cite: 'Helms 2014; Hall 2008',
    });
  } else if (!inGoal && c.status === 'slow') {
    const adj = kcalAdjustment(analysis, calories);
    out.push({
      id: 'behind',
      severity: 'info',
      title: `Behind pace (${ratePctAbs.toFixed(2)}%/wk vs ${idealPctAbs.toFixed(2)}%/wk plan)`,
      detail:
        `To get back on plan, ${adj.phrase} ` +
        `(or burn the equivalent — roughly ${Math.round((adj.kcal / 100) * 2)}k extra steps/day).`,
      cite: 'Helms 2014; Hall 2008',
    });
  } else if (!inGoal && analysis.hasEnough) {
    out.push({
      id: 'on-track',
      severity: 'good',
      title: `On track (${c.ratePct >= 0 ? '+' : ''}${c.ratePct.toFixed(2)}%/wk)`,
      detail: 'Your trend matches the conservative pace you set. Hold course and keep logging.',
      cite: 'Garthe 2011',
    });
  }

  // 2b) adaptive maintenance (TDEE) read — grounds the calorie numbers in the
  // user's own data (estimated, not a formula) and states the forward prediction.
  if (tdee) {
    const round10 = (v: number) => Math.round(v / 10) * 10;
    const maint = round10(tdee.tdee);
    const band = round10(1.96 * tdee.sd);
    const eating = round10(tdee.intakeMean);
    const deficit = eating - maint; // < 0 = deficit
    const predKgWk = tdee.predictedRateKgPerWk(tdee.intakeMean); // signed kg/wk
    const predDisp = rateFromKg(predKgWk, units);
    const predPct = (predKgWk * 100) / currentKg;
    const balance =
      deficit < 0
        ? `a ${-deficit} kcal/day deficit`
        : deficit > 0
          ? `a ${deficit} kcal/day surplus`
          : 'right at maintenance';
    out.push({
      id: 'maintenance',
      severity: 'info',
      title: `Estimated maintenance ~${maint} kcal/day (±${band})`,
      detail:
        `Backed out from your trend rate and logged intake — not a formula, so it adapts as you go. ` +
        `You're eating ~${eating} kcal/day (${balance}), which predicts ` +
        `~${predDisp >= 0 ? '+' : ''}${predDisp.toFixed(2)} ${units}/wk ` +
        `(${predPct >= 0 ? '+' : ''}${predPct.toFixed(2)}%/wk).`,
      cite: 'MacroFactor/MASS energy balance; Hall 2008',
    });
  }

  // 3) target-date reality check — makes the deadline matter
  if (profile.targetDate && analysis.targetDateDay != null) {
    const targetWeeks = (analysis.targetDateDay - analysis.lastDay) / 7;
    if (c.etaWeeks == null) {
      out.push({
        id: 'target-date',
        severity: 'warn',
        title: 'Not on track for your target date',
        detail: `At the current trend you are not heading to goal by ${profile.targetDate}. A deficit (or a larger one) is needed to make the date.`,
        cite: 'Helms 2014',
      });
    } else {
      const diff = c.etaWeeks - targetWeeks; // + = arriving late
      if (Math.abs(diff) <= 1) {
        out.push({
          id: 'target-date',
          severity: 'good',
          title: 'On pace for your target date',
          detail: `Projected to reach goal right around ${profile.targetDate}.`,
          cite: 'Helms 2014',
        });
      } else if (diff > 1) {
        out.push({
          id: 'target-date',
          severity: 'info',
          title: `~${Math.round(diff)} wk behind your target date`,
          detail: `Projected to hit goal about ${Math.round(diff)} week(s) after ${profile.targetDate}. The intake change above closes that gap; a softer date also works.`,
          cite: 'Helms 2014',
        });
      } else {
        out.push({
          id: 'target-date',
          severity: 'info',
          title: `~${Math.round(-diff)} wk ahead of your target date`,
          detail: `Projected to reach goal about ${Math.round(-diff)} week(s) before ${profile.targetDate} — you have buffer and could ease the deficit.`,
          cite: 'Helms 2014',
        });
      }
    }
  }

  // 4) recovery-aware caution
  if (recovery) {
    out.push({
      id: 'recovery',
      severity: losing && ratePctAbs > 0.8 ? 'warn' : 'info',
      title: 'Recovering — keep the deficit gentle',
      detail:
        'You flagged injury recovery. Keep loss at the conservative end (~0.5-0.7%/wk) and protein high — both protect lean mass and support tissue healing.',
      cite: 'Tipton 2015; Helms 2014',
    });
  }

  // 5) protein target
  if (losing) {
    const lo = Math.round(currentKg * 1.6);
    const hi = Math.round(currentKg * 2.2);
    out.push({
      id: 'protein',
      severity: 'info',
      title: `Protein target ~${lo}-${hi} g/day`,
      detail:
        'In a deficit, protein toward the higher end of this range best preserves muscle. Spread across 3-5 meals.',
      cite: 'Morton 2018; Helms 2014',
    });
  }

  // 6) diet-break suggestion for longer phases
  if (losing && weeksLogged >= 10) {
    out.push({
      id: 'diet-break',
      severity: 'info',
      title: `~${Math.round(weeksLogged)} weeks dieting — a break may help`,
      detail:
        'A 1-2 week diet break at maintenance can improve adherence, hormones, and recovery, often without slowing overall fat loss.',
      cite: 'Byrne 2018 (MATADOR)',
    });
  }

  // 7) data sufficiency
  if (weighIns.length < 10) {
    out.push({
      id: 'more-data',
      severity: 'info',
      title: 'Log daily for a tighter trend',
      detail:
        'With more weigh-ins the trend band narrows and the rate estimate stabilizes. Daily is ideal; the estimator handles missed days.',
      cite: 'Hacker’s Diet (trend weight)',
    });
  }

  const order: Record<Severity, number> = { warn: 0, good: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
