/**
 * Tolerant parser for the user's free-text workout-log format (M5).
 *
 * One exercise per line (as written in Notes); sessions are introduced by a
 * title line ending in ":". A line looks like:
 *
 *     Uni Machine Side Delt (5) 170- 10.1, 10.0
 *     └─────── name ───────┘ └┘  └┘  └── sets ──┘
 *                          setup load
 *
 *   • setup  — any `(...)` group; seat/pad settings. May appear before OR after
 *              the load, or several times. Ignored by the math, kept as metadata.
 *   • load   — stack units (self-relative, never kg). `+25` = "stack maxed +25 lb"
 *              (relative). `225/90` = per-limb left/right load on a "Uni" lift.
 *   • set    — `reps.rir`; `.f` = taken to failure (RIR 0). Bare `6` = reps with
 *              RIR unlogged. `12.2/10.1` = left/right split on a unilateral set.
 *   • a `/` that introduces a fresh `load-` starts a NEW load block on the same
 *              line (a back-off / second load), e.g. `220- 10.1/ 240- 7.0`.
 *
 * Anything irregular is FLAGGED (surfaced in the confirm/preview UI), never
 * silently dropped — data quality drives every downstream number. The grammar is
 * validated against the user's real log in parser.test.ts.
 */

import type { Limb, Load, LiftSet, LoggedExercise, LiftSession, ParseResult } from './types';

/** Title keyword → canonical split label. Longer keys checked first. */
const SPLIT_KEYWORDS: [RegExp, string][] = [
  [/\bfull\s*body\b/i, 'Full Body'],
  [/\bweak\s*point\b/i, 'Weak Point'],
  [/\bfbeod\b/i, 'FBEOD'],
  [/\banterior\b/i, 'Anterior'],
  [/\bposterior\b/i, 'Posterior'],
  [/\bupper\b/i, 'Upper'],
  [/\blower\b/i, 'Lower'],
  [/\bpush\b/i, 'Push'],
  [/\bpull\b/i, 'Pull'],
  [/\blegs?\b/i, 'Legs'],
  [/\barms\b/i, 'Arms'],
];

/** Implement / laterality tokens worth capturing as structured metadata. */
const MODIFIER_WORDS = ['uni', 'db', 'dumbbell', 'machine', 'cable', 'plate', 'tbar', 'smith', 'cuffed'];

// ---- token stream -----------------------------------------------------------

type TokType = 'NUM' | 'SLASH' | 'COMMA' | 'DASH';
interface Tok {
  t: TokType;
  v?: string;
}
/** A number: optional leading "+", digits, optional ".dd" or ".f". */
const NUM_RE = /^\+?\d+(?:\.(?:\d+|f))?/;

function tokenize(str: string): { toks: Tok[]; dirty: boolean } {
  const toks: Tok[] = [];
  let dirty = false;
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === ' ' || c === '\t') {
      i++;
    } else if (c === '-') {
      toks.push({ t: 'DASH' });
      i++;
    } else if (c === ',') {
      toks.push({ t: 'COMMA' });
      i++;
    } else if (c === '/') {
      toks.push({ t: 'SLASH' });
      i++;
    } else {
      const m = str.slice(i).match(NUM_RE);
      if (m) {
        toks.push({ t: 'NUM', v: m[0] });
        i += m[0].length;
      } else {
        dirty = true; // stray character — flag the line, keep going
        i++;
      }
    }
  }
  return { toks, dirty };
}

// ---- decoders ---------------------------------------------------------------

function decodeLoad(v: string): Load {
  const relative = v.startsWith('+');
  return { value: parseFloat(v.replace('+', '')), raw: v, relative };
}

interface Rep {
  reps: number;
  rir: number | null;
  failure: boolean;
}
function decodeRep(v: string): Rep {
  if (v.includes('.')) {
    const [a, b] = v.split('.');
    if (b === 'f') return { reps: parseInt(a, 10), rir: null, failure: true };
    return { reps: parseInt(a, 10), rir: parseInt(b, 10), failure: false };
  }
  return { reps: parseInt(v, 10), rir: null, failure: false };
}

// ---- block grammar ----------------------------------------------------------

interface ParsedSet {
  repL: Rep;
  repR: Rep | null;
}
interface Block {
  load: { l: string; r: string | null };
  sets: ParsedSet[];
}

/**
 * Parse the token tail (`load - sets [ / load - sets ]…`) into load blocks.
 * The one ambiguity is the overloaded `/`: it splits left/right within a load
 * or a set, UNLESS it introduces a fresh `load-`, in which case it starts a new
 * block. `loadDashAt` decides that by lookahead.
 */
function parseBlocks(toks: Tok[]): { blocks: Block[]; dirty: boolean } {
  let i = 0;
  let dirty = false;
  const at = (k: number): Tok | undefined => toks[k];

  // toks[j..] is `NUM (SLASH NUM)? DASH` — i.e. the head of a new load block.
  const loadDashAt = (j: number): boolean => {
    if (at(j)?.t !== 'NUM') return false;
    let k = j + 1;
    if (at(k)?.t === 'SLASH' && at(k + 1)?.t === 'NUM') k += 2;
    return at(k)?.t === 'DASH';
  };

  const parseSet = (): ParsedSet => {
    const repL = decodeRep(toks[i++].v!);
    let repR: Rep | null = null;
    // a SLASH here is a left/right split unless it begins the next load block
    if (at(i)?.t === 'SLASH' && at(i + 1)?.t === 'NUM' && !loadDashAt(i + 1)) {
      i++; // consume SLASH
      repR = decodeRep(toks[i++].v!);
    }
    return { repL, repR };
  };

  const blocks: Block[] = [];
  while (at(i)) {
    if (at(i)!.t !== 'NUM') {
      dirty = true;
      break;
    }
    const l = toks[i++].v!;
    let r: string | null = null;
    if (at(i)?.t === 'SLASH' && at(i + 1)?.t === 'NUM') {
      i++;
      r = toks[i++].v!;
    }
    if (at(i)?.t !== 'DASH') {
      dirty = true;
      break;
    }
    i++; // consume DASH
    const sets: ParsedSet[] = [];
    while (at(i)?.t === 'NUM') {
      sets.push(parseSet());
      if (at(i)?.t === 'COMMA') {
        i++;
        continue;
      }
      break;
    }
    blocks.push({ load: { l, r }, sets });
    if (sets.length === 0) dirty = true;
    // a trailing SLASH that heads a fresh load block → continue with next block
    if (at(i)?.t === 'SLASH' && loadDashAt(i + 1)) {
      i++;
      continue;
    }
    break;
  }
  if (i < toks.length) dirty = true; // unconsumed tokens — something odd
  return { blocks, dirty };
}

/** Flatten parsed blocks into individual LiftSets, splitting limbs as needed. */
function flatten(blocks: Block[]): LiftSet[] {
  const out: LiftSet[] = [];
  for (const b of blocks) {
    const loadL = decodeLoad(b.load.l);
    const loadR = b.load.r != null ? decodeLoad(b.load.r) : null;
    for (const set of b.sets) {
      const isSplit = set.repR != null || loadR != null;
      if (!isSplit) {
        out.push({ ...set.repL, load: loadL, limb: null });
      } else {
        out.push({ ...set.repL, load: loadL, limb: 'L' as Limb });
        const rRep = set.repR ?? { reps: 0, rir: null, failure: false };
        out.push({ ...rRep, load: loadR ?? loadL, limb: 'R' as Limb });
      }
    }
  }
  return out;
}

// ---- public API -------------------------------------------------------------

/** True for a session header (a short line ending in ":"). */
function isTitle(line: string): boolean {
  return /:\s*$/.test(line) && !/\d\s*-/.test(line);
}

export function parseTitle(raw: string): { title: string; split: string | null; location: string | null } {
  const title = raw.replace(/:\s*$/, '').trim();
  let split: string | null = null;
  let rest = title;
  for (const [re, label] of SPLIT_KEYWORDS) {
    if (re.test(title)) {
      split = label;
      rest = title.replace(re, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }
  const location = split && rest.length > 0 ? rest : null;
  return { title, split, location };
}

/** Parse one exercise line. Returns null when it isn't an exercise at all. */
export function parseExerciseLine(raw: string): LoggedExercise | null {
  // pull out every (...) as setup metadata, wherever it sits on the line
  const setup: string[] = [];
  let s = raw.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    for (const t of inner.split(',').map((x) => x.trim()).filter(Boolean)) setup.push(t);
    return ' ';
  });
  // repair "10 .0" / "10. 0" stray spaces inside a decimal, then collapse junk
  s = s.replace(/(\d)\s*\.\s*(\d|f)/g, '$1.$2');
  s = s.replace(/-\s*-/g, '-').replace(/\s+/g, ' ').trim();

  const dash = s.indexOf('-');
  if (dash < 0) return null; // no load/sets separator — not an exercise line
  const left = s.slice(0, dash);
  const right = s.slice(dash + 1);
  const lm = left.match(/(\+?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*$/);
  if (!lm || lm.index === undefined) return null; // no load before the dash
  const loadStr = lm[1].replace(/\s+/g, '');
  const rawName = left.slice(0, lm.index).trim();
  if (!rawName) return null;

  const tail = `${loadStr}-${right}`;
  const { toks, dirty: tdirty } = tokenize(tail);
  const { blocks, dirty: bdirty } = parseBlocks(toks);
  const sets = flatten(blocks);
  const flagged = tdirty || bdirty || sets.length === 0;

  const key = rawName.toLowerCase().replace(/\s+/g, ' ').trim();
  const words = key.split(' ');
  const modifiers = MODIFIER_WORDS.filter((m) => words.includes(m));

  return {
    rawName,
    key,
    modifiers,
    setup,
    sets,
    flagged,
    note: flagged ? 'Parsed with uncertainty — please verify.' : undefined,
  };
}

/** Per-line problem for the paste-box underline overlay (0-based line index). */
export interface LineDiagnostic {
  /** 0-based index into text.split(/\r?\n/). */
  line: number;
  /**
   * 'skipped' = not a recognized exercise line; 'flagged' = parsed but uncertain;
   * 'unilateral' = a "Uni" lift logged without an L/R split (asymmetry not tracked).
   */
  kind: 'skipped' | 'flagged' | 'unilateral';
  message: string;
}

/**
 * Line-level diagnostics for the import textarea, mirroring parseWorkoutLog's
 * line walk: a non-blank, non-title line is 'skipped' when it isn't an exercise,
 * 'flagged' when it parses with uncertainty, or 'unilateral' when a "Uni" lift was
 * logged without a left/right split (so the L/R asymmetry can't be tracked for it).
 * The UI underlines each in place. Same classification the preview's counts use.
 */
export function lineDiagnostics(text: string): LineDiagnostic[] {
  const out: LineDiagnostic[] = [];
  const lines = text.split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (!line || isTitle(line)) continue;
    const ex = parseExerciseLine(line);
    if (!ex) {
      out.push({ line: n, kind: 'skipped', message: 'Not a recognized exercise line — it will be skipped.' });
    } else if (ex.flagged) {
      out.push({ line: n, kind: 'flagged', message: ex.note ?? 'Parsed with uncertainty — please verify.' });
    } else if (ex.modifiers.includes('uni') && ex.sets.length > 0 && ex.sets.every((s) => s.limb == null)) {
      out.push({
        line: n,
        kind: 'unilateral',
        message: 'Unilateral lift without a left/right split — log e.g. "100/100- 8/7" to track left vs right.',
      });
    }
  }
  return out;
}

/** Parse a whole pasted log into sessions. Lines that fail are returned in `unparsed`. */
export function parseWorkoutLog(text: string): ParseResult {
  const sessions: LiftSession[] = [];
  const unparsed: { line: number; text: string }[] = [];
  let current: LiftSession | null = null;

  const lines = text.split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (!line) continue;
    if (isTitle(line)) {
      const { title, split, location } = parseTitle(line);
      current = { title, split, location, exercises: [], date: null };
      sessions.push(current);
      continue;
    }
    const ex = parseExerciseLine(line);
    if (ex && current) {
      current.exercises.push(ex);
    } else if (ex && !current) {
      // exercises before any title — open an untitled session so nothing is lost
      current = { title: '(untitled)', split: null, location: null, exercises: [ex], date: null };
      sessions.push(current);
    } else {
      unparsed.push({ line: n + 1, text: line });
    }
  }
  return { sessions, unparsed };
}
