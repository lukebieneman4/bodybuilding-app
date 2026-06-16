/**
 * Lift-tracking data model (M5).
 *
 * Loads are stored in the machine's own stack units, NOT kilograms: a pec-deck
 * "308" or "+25" (stack maxed + 25 lb) has no honest kg equivalent, and the user
 * trains across multiple gyms whose stacks differ. So load is a *self-relative*
 * quantity — comparable only within one exercise at one location over time. That
 * is why exercise identity is scoped per `location` for any load/e1RM math
 * (`Pec Deck @ Brick` ≠ `Pec Deck @ Ash`); weekly-volume-per-muscle, by contrast,
 * is location-agnostic (a hard set counts anywhere).
 *
 * Unilateral ("Uni") work is logged per limb with a `/` split; each side becomes
 * its own `LiftSet` tagged `limb`, so the left/right asymmetry (relevant to the
 * user's ACL recovery) is a first-class, trackable quantity.
 */

export type Limb = 'L' | 'R';

/** A load in machine stack units (self-relative; see module note). */
export interface Load {
  /** Numeric magnitude in stack units (best-effort; for `+25` this is 25). */
  value: number;
  /** Original token as written, e.g. "376", "+25". */
  raw: string;
  /** `+N` "stack maxed + N lb added" notation — only comparable to other `+N`. */
  relative: boolean;
}

/** One performed set (one limb's worth, if the exercise was split L/R). */
export interface LiftSet {
  /** Performed reps. 0 means the limb was logged but not worked (e.g. the
   * surgical leg skipping open-chain leg extension). */
  reps: number;
  /** Reps in reserve as logged, or null when the user omitted it. */
  rir: number | null;
  /** Logged as taken to momentary failure (`.f`). Treated as RIR 0 downstream. */
  failure: boolean;
  load: Load;
  /** 'L' / 'R' for a unilateral split; null for a bilateral / combined set. */
  limb: Limb | null;
}

/** One exercise within a session: a name, its setup, and its sets. */
export interface LoggedExercise {
  /** Name exactly as written, e.g. "Uni Machine Side Delt". */
  rawName: string;
  /** Normalized identity key (lower-cased, whitespace-collapsed rawName).
   * Location is applied on top of this where load comparability matters. */
  key: string;
  /** Recognized name modifiers (uni, db, machine, cable, plate, …). */
  modifiers: string[];
  /** Free-text setup tokens from parentheses, e.g. ["5","4","2"] (seat/pad). */
  setup: string[];
  sets: LiftSet[];
  /** True when parsing had to guess or hit something irregular — surfaces the
   * line in the confirm/preview UI rather than dropping or trusting it. */
  flagged: boolean;
  /** Human-readable reason the line was flagged. */
  note?: string;
}

export interface LiftSession {
  /** Raw title line, colon stripped, e.g. "Anterior Brick". */
  title: string;
  /** Derived split type, e.g. "Anterior" | "Posterior" | "FBEOD" | "Upper"… */
  split: string | null;
  /** Derived gym/location, e.g. "Brick" | "Ash"; null when none in the title. */
  location: string | null;
  exercises: LoggedExercise[];
  /** ISO date, assigned by the import/cadence step (null straight out of parse). */
  date: string | null;
}

export interface ParseResult {
  sessions: LiftSession[];
  /** Lines that could not be parsed at all — never silently dropped. */
  unparsed: { line: number; text: string }[];
}
