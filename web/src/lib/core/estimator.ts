/**
 * Local-linear-trend Kalman filter + RTS smoother — the shared state estimator.
 *
 * State = [level_kg, slope_kg/day]. Faithful TypeScript port of the
 * Monte-Carlo-validated Python prototype (prototypes/bw_trend_prototype.py);
 * parity is enforced by estimator.test.ts against frozen golden values.
 *
 * All math is in SI units: mass in kilograms, time in days. Unit conversion
 * (kg <-> lb) is a display concern handled at the UI boundary, never here.
 *
 * Reference for the trend-weight idea: J. Walker, "The Hacker's Diet" (1991);
 * the state-space formulation is the production estimator, EWMA the baseline.
 */

export type Vec2 = [number, number];
export type Mat2 = [[number, number], [number, number]];

const DEFAULT_R = 0.8 ** 2; // daily weigh-in measurement variance (kg^2)
const DEFAULT_Q = 2.5e-4; // slope diffusion (kg/day per day) — smoothness knob

// ---- 2x2 linear algebra (mirrors numpy @, kept explicit for clarity) ----
function matmul(a: Mat2, b: Mat2): Mat2 {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}
function matvec(a: Mat2, v: Vec2): Vec2 {
  return [a[0][0] * v[0] + a[0][1] * v[1], a[1][0] * v[0] + a[1][1] * v[1]];
}
function transpose(a: Mat2): Mat2 {
  return [
    [a[0][0], a[1][0]],
    [a[0][1], a[1][1]],
  ];
}
function addMat(a: Mat2, b: Mat2): Mat2 {
  return [
    [a[0][0] + b[0][0], a[0][1] + b[0][1]],
    [a[1][0] + b[1][0], a[1][1] + b[1][1]],
  ];
}
function inv2(a: Mat2): Mat2 {
  const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
  return [
    [a[1][1] / det, -a[0][1] / det],
    [-a[1][0] / det, a[0][0] / det],
  ];
}
function Fmat(dt: number): Mat2 {
  return [
    [1, dt],
    [0, 1],
  ];
}
function Qmat(dt: number, q: number): Mat2 {
  return [
    [(q * dt ** 3) / 3, (q * dt ** 2) / 2],
    [(q * dt ** 2) / 2, q * dt],
  ];
}

export interface SmoothOptions {
  R?: number;
  q?: number;
}

export interface SmoothResult {
  /** Smoothed trend (level) at each input sample, kg. */
  trend: number[];
  /** 1σ uncertainty of the trend level at each sample, kg. */
  trendSd: number[];
  /** Smoothed slope at each sample, kg/day. */
  slope: number[];
  /** 1σ uncertainty of the smoothed slope at each sample, kg/day. */
  slopeSd: number[];
  /** Filtered (forward-only) level at the last sample, kg. */
  levelFilteredEnd: number;
  /** Filtered slope at the last sample, kg/day. */
  slopeFilteredEnd: number;
  /** Filtered covariance at the last sample (for projection). */
  PEnd: Mat2;
}

/**
 * Run the filter forward then the RTS smoother backward. `days` are day offsets
 * (need not be integer or evenly spaced); `obs` are masses in kg. Both sorted
 * ascending by day, same length, ≥ 2 points.
 */
export function smooth(days: number[], obs: number[], opts: SmoothOptions = {}): SmoothResult {
  const R = opts.R ?? DEFAULT_R;
  const q = opts.q ?? DEFAULT_Q;
  const n = obs.length;
  if (n < 2 || days.length !== n) {
    throw new Error('smooth() needs ≥2 samples with matching days and obs lengths');
  }

  const xf: Vec2[] = new Array(n);
  const Pf: Mat2[] = new Array(n);
  const xp: Vec2[] = new Array(n);
  const Pp: Mat2[] = new Array(n);
  const Fs: Mat2[] = new Array(n);

  let x: Vec2 = [obs[0], 0];
  let P: Mat2 = [
    [R, 0],
    [0, 0.01],
  ];
  xf[0] = x;
  Pf[0] = P;
  xp[0] = x;
  Pp[0] = P;
  Fs[0] = [
    [1, 0],
    [0, 1],
  ];

  for (let i = 1; i < n; i++) {
    const dt = days[i] - days[i - 1];
    const F = Fmat(dt);
    Fs[i] = F;
    // predict
    x = matvec(F, x);
    P = addMat(matmul(matmul(F, P), transpose(F)), Qmat(dt, q));
    xp[i] = x;
    Pp[i] = P;
    // update (H = [1, 0], scalar measurement)
    const S = P[0][0] + R;
    const K: Vec2 = [P[0][0] / S, P[1][0] / S];
    const innovation = obs[i] - x[0];
    x = [x[0] + K[0] * innovation, x[1] + K[1] * innovation];
    const ImKH: Mat2 = [
      [1 - K[0], 0],
      [-K[1], 1],
    ];
    P = matmul(ImKH, P);
    xf[i] = x;
    Pf[i] = P;
  }

  // RTS smoother (backward pass)
  const xs: Vec2[] = xf.slice();
  const Ps: Mat2[] = Pf.slice();
  for (let i = n - 2; i >= 0; i--) {
    const C = matmul(matmul(Pf[i], transpose(Fs[i + 1])), inv2(Pp[i + 1]));
    const dx: Vec2 = [xs[i + 1][0] - xp[i + 1][0], xs[i + 1][1] - xp[i + 1][1]];
    const corr = matvec(C, dx);
    xs[i] = [xf[i][0] + corr[0], xf[i][1] + corr[1]];
    const dP: Mat2 = [
      [Ps[i + 1][0][0] - Pp[i + 1][0][0], Ps[i + 1][0][1] - Pp[i + 1][0][1]],
      [Ps[i + 1][1][0] - Pp[i + 1][1][0], Ps[i + 1][1][1] - Pp[i + 1][1][1]],
    ];
    Ps[i] = addMat(Pf[i], matmul(matmul(C, dP), transpose(C)));
  }

  return {
    trend: xs.map((v) => v[0]),
    trendSd: Ps.map((p) => Math.sqrt(p[0][0])),
    slope: xs.map((v) => v[1]),
    slopeSd: Ps.map((p) => Math.sqrt(p[1][1])),
    levelFilteredEnd: xf[n - 1][0],
    slopeFilteredEnd: xf[n - 1][1],
    PEnd: Pf[n - 1],
  };
}

/**
 * Robust "current rate": mean smoothed slope over the trailing `windowDays`
 * (a single-sample instantaneous slope is too jumpy to surface to a user).
 * Returns kg/day.
 */
export function trailingRate(days: number[], slope: number[], windowDays = 21): number {
  const cutoff = days[days.length - 1] - windowDays;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < days.length; i++) {
    if (days[i] >= cutoff) {
      sum += slope[i];
      count++;
    }
  }
  return count > 0 ? sum / count : slope[slope.length - 1];
}

export interface Projection {
  days: number[];
  level: number[];
  sd: number[];
  /** Day offset at which the trend is projected to reach the goal, or null. */
  goalEta: number | null;
}

/**
 * Project the trend forward from the last filtered state, assuming the recent
 * trailing rate roughly persists (gentler process noise `qProj` than the
 * historical smoother). Stops ~2 weeks past the projected goal crossing so the
 * band stays readable.
 */
export function projectToGoal(
  levelEnd: number,
  slope: number,
  PEnd: Mat2,
  goalKg: number,
  opts: { qProj?: number; maxDays?: number } = {}
): Projection {
  const qProj = opts.qProj ?? DEFAULT_Q * 0.15;
  const maxDays = opts.maxDays ?? 365;
  const losing = goalKg < levelEnd;
  let x: Vec2 = [levelEnd, slope];
  let P: Mat2 = PEnd;
  const days: number[] = [0];
  const level: number[] = [x[0]];
  const sd: number[] = [Math.sqrt(P[0][0])];
  let goalEta: number | null = null;
  const F = Fmat(1);
  for (let dd = 1; dd <= maxDays; dd++) {
    x = matvec(F, x);
    P = addMat(matmul(matmul(F, P), transpose(F)), Qmat(1, qProj));
    days.push(dd);
    level.push(x[0]);
    sd.push(Math.sqrt(P[0][0]));
    const crossed = losing ? x[0] <= goalKg : x[0] >= goalKg;
    if (goalEta === null && crossed) goalEta = dd;
    if (goalEta !== null && dd >= goalEta + 14) break;
  }
  return { days, level, sd, goalEta };
}

export interface IdealCurve {
  /** Ideal target weight at day offset 0..prepDays, kg. */
  values: number[];
  /** Ideal instantaneous slope at a given day offset, kg/day. */
  slopeAt: (day: number) => number;
}

/**
 * Non-linear decelerating ideal-loss (or -gain) curve that crosses the goal at
 * `prepDays`. Rate target lives with the caller; the shape is an exponential
 * approach with a small buffer past goal ("arrive-early"). See insights layer
 * for the cited rate guidance (Helms 2014 / Garthe 2011).
 */
export function idealCurve(startKg: number, goalKg: number, prepDays: number): IdealCurve {
  const losing = goalKg < startKg;
  const asym = goalKg - (losing ? 0.5 : -0.5);
  const ratio = (goalKg - asym) / (startKg - asym);
  const k = ratio > 0 && ratio < 1 ? -Math.log(ratio) / prepDays : 0;
  const values: number[] = [];
  for (let t = 0; t <= prepDays; t++) {
    values.push(asym + (startKg - asym) * Math.exp(-k * t));
  }
  return {
    values,
    slopeAt: (day: number) => -(startKg - asym) * k * Math.exp(-k * day),
  };
}
