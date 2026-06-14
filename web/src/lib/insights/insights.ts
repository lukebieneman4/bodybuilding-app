import type { WeightAnalysis } from '../core/analysis';
import type { Profile, WeighIn } from '../data/types';
import { toKg } from '../data/types';

/**
 * Rule-based, cited insights. Every recommendation traces to a reference — no
 * "plausible-looking" advice. Tuned to be conservative for injury recovery.
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

export function buildInsights(
  analysis: WeightAnalysis,
  profile: Profile,
  weighIns: WeighIn[]
): Insight[] {
  const out: Insight[] = [];
  const units = profile.units;
  const currentKg = toKg(analysis.current.trendDisplay, units);
  const ratePct = analysis.current.ratePct; // signed, %bw/wk (negative = losing)
  const losing = ratePct < 0;
  const ratePctAbs = Math.abs(ratePct);
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

  // 2) rate vs pace
  if (losing && ratePctAbs > 1.0) {
    out.push({
      id: 'too-fast',
      severity: 'warn',
      title: `Losing fast (${ratePctAbs.toFixed(2)}%/wk)`,
      detail:
        'Above ~1%/wk, more of the loss tends to come from lean mass — a poor trade, and worse while recovering. Ease the deficit (about +200-300 kcal/day) or add a refeed and re-check in a week.',
      cite: 'Garthe 2011; Helms 2014',
    });
  } else if (analysis.current.status === 'fast') {
    out.push({
      id: 'slightly-fast',
      severity: 'info',
      title: 'Slightly ahead of target pace',
      detail:
        'Fine short-term. If it persists 1-2 weeks, a small intake bump (~+150 kcal/day) brings you back toward your planned rate.',
      cite: 'Helms 2014',
    });
  } else if (analysis.current.status === 'slow') {
    out.push({
      id: 'behind',
      severity: 'info',
      title: 'Behind your target pace',
      detail:
        'To hit your date, a modest change — about -150 kcal/day or a few thousand more daily steps — nudges the trend back to plan.',
      cite: 'Helms 2014',
    });
  } else if (analysis.hasEnough && !inGoal) {
    out.push({
      id: 'on-track',
      severity: 'good',
      title: `On track (${ratePct >= 0 ? '+' : ''}${ratePct.toFixed(2)}%/wk)`,
      detail: 'Your trend matches the conservative pace you set. Hold course and keep logging.',
      cite: 'Garthe 2011',
    });
  }

  // 3) recovery-aware caution
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

  // 4) protein target (always useful in a deficit)
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

  // 5) diet-break suggestion for longer phases
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

  // 6) data sufficiency
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
