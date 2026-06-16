/**
 * Exercise → muscle attribution and weekly-volume landmarks (SCIENCE.md §3–4).
 *
 * Attribution credit: primary mover 1.0, meaningfully-loaded secondary 0.5
 * (the fractional-volume convention — a modeling choice, not a measured ratio).
 * Landmarks (MEV/MAV/MRV, hard sets/week) are Israetel/RP coach-consensus values,
 * NOT meta-analytic constants — treat as defaults with ±2-set fuzz.
 */

export type Muscle =
  | 'chest' | 'lats' | 'side_delt' | 'rear_delt' | 'front_delt'
  | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes'
  | 'calves' | 'traps' | 'abs' | 'adductors' | 'erectors';

export interface Attribution {
  primary: Muscle[];
  secondary: Muscle[];
}

/** Ordered match rules (first hit wins); specific before general. (SCIENCE.md §4) */
const RULES: [RegExp, Muscle[], Muscle[]][] = [
  [/reverse pec deck/, ['rear_delt'], ['traps']], // rear-delt movement; mid-traps assist, no lats
  [/pec deck/, ['chest'], []], // a fly — near-pure chest, no meaningful front-delt
  [/kelso/, ['traps'], ['rear_delt']],
  [/rear[\s-]?delt/, ['rear_delt'], []], // isolated rear delts (e.g. cuffed cable fly)
  [/side delt|lat raise|side flap/, ['side_delt'], []],
  [/front raise|front flap/, ['front_delt'], []],
  [/pulldown/, ['lats'], ['biceps']],
  [/lat row/, ['lats'], ['traps', 'biceps']], // lat-biased row: lats lead, traps assist
  [/\bt[- ]?bar\b|wide grip row|\brow\b/, ['traps'], ['lats', 'biceps']], // wide-grip / other rows: trap-dominant
  [/overhead/, ['triceps'], []],
  [/tricep|tri ext|pushdown/, ['triceps'], []],
  [/ham(string)? curl|seated ham|lying ham|hamstring/, ['hamstrings'], []],
  [/preacher|curl/, ['biceps'], []],
  [/leg press/, ['quads'], ['glutes']], // quad/glute dominant; hamstring contribution negligible
  [/leg ext/, ['quads'], []],
  [/45 ext|back ext|hyperext/, ['glutes', 'hamstrings'], ['erectors']], // hip-hinge bias: glutes/hams lead
  [/calf/, ['calves'], []],
  [/adductor/, ['adductors'], []],
  [/abductor/, ['glutes'], []],
  [/kickback/, ['glutes'], ['hamstrings']],
  [/ab machine|crunch|\babs?\b/, ['abs'], []],
  [/press|bench/, ['chest'], ['front_delt', 'triceps']],
];

/** Resolve an exercise key (lower-cased rawName) to its muscles, or null if unknown. */
export function musclesFor(key: string): Attribution | null {
  for (const [re, primary, secondary] of RULES) {
    if (re.test(key)) return { primary, secondary };
  }
  return null;
}

export const PRIMARY_CREDIT = 1.0;
export const SECONDARY_CREDIT = 0.5;

export interface Landmark {
  /** Minimum effective volume — below this, little growth stimulus. */
  mev: number;
  /** Maximum adaptive volume band [lo, hi] — the productive target zone. */
  mav: [number, number];
  /** Maximum recoverable volume — above this risks under-recovery. */
  mrv: number;
}

/** Hard sets/week landmarks per muscle (SCIENCE.md §3). null = no published landmark. */
export const LANDMARKS: Partial<Record<Muscle, Landmark>> = {
  chest: { mev: 8, mav: [12, 20], mrv: 22 },
  lats: { mev: 10, mav: [14, 22], mrv: 25 },
  side_delt: { mev: 8, mav: [16, 22], mrv: 26 },
  rear_delt: { mev: 6, mav: [12, 18], mrv: 25 },
  front_delt: { mev: 6, mav: [6, 12], mrv: 18 },
  biceps: { mev: 8, mav: [14, 20], mrv: 26 },
  triceps: { mev: 6, mav: [10, 14], mrv: 18 },
  quads: { mev: 8, mav: [12, 18], mrv: 20 },
  hamstrings: { mev: 6, mav: [10, 16], mrv: 20 },
  glutes: { mev: 4, mav: [8, 16], mrv: 20 },
  calves: { mev: 8, mav: [12, 16], mrv: 20 },
  traps: { mev: 4, mav: [12, 20], mrv: 30 },
  abs: { mev: 6, mav: [16, 20], mrv: 25 },
};

export type VolumeStatus = 'below_mev' | 'minimum' | 'optimal' | 'high' | 'above_mrv' | 'none';

/** Classify a weekly hard-set count against a muscle's landmarks. */
export function volumeStatus(muscle: Muscle, setsPerWeek: number): VolumeStatus {
  const lm = LANDMARKS[muscle];
  if (!lm) return 'none';
  if (setsPerWeek < lm.mev) return 'below_mev';
  if (setsPerWeek < lm.mav[0]) return 'minimum';
  if (setsPerWeek <= lm.mav[1]) return 'optimal';
  if (setsPerWeek <= lm.mrv) return 'high';
  return 'above_mrv';
}
