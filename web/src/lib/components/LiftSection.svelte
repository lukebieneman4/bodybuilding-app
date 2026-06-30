<script lang="ts">
  import { store } from '../data/store.svelte';
  import { analyzeLifts, impliedSessionsPerWeek, volumeWindow } from '../lift/analysis';
  import { volumeAdvice, regressingLifts } from '../lift/advice';
  import LiftImport from './LiftImport.svelte';
  import StatStrip, { type Stat } from './StatStrip.svelte';
  import TrainingDensity from './TrainingDensity.svelte';
  import VolumeCoach from './VolumeCoach.svelte';
  import StrengthLeaderboard from './StrengthLeaderboard.svelte';
  import VolumeChart from './VolumeChart.svelte';
  import SymmetryChart from './SymmetryChart.svelte';

  let reimport = $state(false);

  const sessions = $derived(store.liftSessions);
  // Training density (sessions/week) drives weekly volume: the user can declare it,
  // else we infer it from the log's cadence. surgical side defaults to right.
  const implied = $derived(impliedSessionsPerWeek(sessions));
  const spw = $derived(store.liftSessionsPerWeek ?? implied);
  const analysis = $derived(sessions.length ? analyzeLifts(sessions, { surgicalSide: 'R', sessionsPerWeek: spw }) : null);
  // Volume Coach: knee-crossing muscles get rehab-aware (conservative) advice
  // per SCIENCE.md §5 while the ACL graft remodels.
  const advice = $derived(analysis ? volumeAdvice(analysis.volume, { rehabMuscles: ['quads', 'hamstrings', 'calves'] }) : []);
  const flags = $derived(analysis ? regressingLifts(analysis.strength) : []);
  // the session window weekly volume is averaged over — surfaced so the breakdown
  // can show its math (sets/session × frequency = sets/week).
  const window = $derived(volumeWindow(sessions.length, spw));

  const liftStats = $derived.by<Stat[]>(() => {
    if (!analysis) return [];
    const withLm = analysis.volume.filter((v) => v.landmark);
    const inZone = withLm.filter((v) => v.status === 'optimal').length;
    const lifts = new Set(analysis.strength.map((s) => s.key)).size;
    return [
      { label: 'Sessions', value: String(sessions.length) },
      { label: 'Lifts', value: String(lifts) },
      { label: 'In zone', value: `${inZone}/${withLm.length}`, color: inZone > 0 ? '#2e7d5b' : undefined },
    ];
  });

  // one-line LSI summary shown on the collapsed symmetry card
  const symSummary = $derived.by(() => {
    const a = analysis?.asymmetry ?? [];
    if (!a.length) return null;
    return {
      worst: Math.min(...a.map((s) => s.currentLSI)),
      below: a.filter((s) => s.currentLSI < 90).length,
      total: a.length,
    };
  });
</script>

{#if sessions.length === 0 || reimport}
  <LiftImport ondone={() => (reimport = false)} />
  {#if reimport}<button class="ghost center" onclick={() => (reimport = false)}>Cancel</button>{/if}
{:else if analysis}
  <StatStrip stats={liftStats} />

  {#if advice.length || flags.length}
    <VolumeCoach actions={advice} {flags} />
  {/if}

  {#if analysis.strength.length}
    <section class="card">
      <div class="cardhead">
        <h2>Strength progress</h2>
        <span class="hint">estimated top-set (e1RM) per lift · indexed to its own start · tap a lift for its trend</span>
      </div>
      <StrengthLeaderboard strength={analysis.strength} />
    </section>
  {/if}

  <section class="card">
    <div class="cardhead">
      <h2>Weekly volume per muscle</h2>
      <span class="hint">hard sets/week (RIR ≤ 3) vs evidence-based landmarks · at the density below</span>
    </div>
    <TrainingDensity {implied} />
    <VolumeChart volume={analysis.volume} {window} />
  </section>

  {#if analysis.asymmetry.length}
    <details class="card collapsible">
      <summary>
        <div class="cardhead">
          <h2>Left / right symmetry</h2>
          <span class="hint">surgical-vs-healthy strength (LSI) · the ACL-recovery view</span>
        </div>
        {#if symSummary}
          <span class="collapsed-note">
            worst <b style="color:{symSummary.worst >= 90 ? '#2e7d5b' : symSummary.worst >= 75 ? '#c08552' : '#b4690e'}">{symSummary.worst.toFixed(0)}%</b>
            · {symSummary.below}/{symSummary.total} below goal
          </span>
        {/if}
        <span class="chev" aria-hidden="true">▸</span>
      </summary>
      <div class="reveal">
        <SymmetryChart asymmetry={analysis.asymmetry} />
      </div>
    </details>
  {/if}

  <section class="card tools">
    <h3>Lift data</h3>
    <div class="row wrap">
      <button class="ghost" onclick={() => (reimport = true)}>View / edit log</button>
      <button class="ghost danger" onclick={() => store.clearLifts()}>Clear lifts</button>
    </div>
    <p class="hint">{sessions.length} sessions loaded.</p>
  </section>
{/if}

<style>
  .collapsible {
    cursor: pointer;
  }
  .collapsible > summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .collapsible > summary::-webkit-details-marker {
    display: none;
  }
  .collapsible > summary .cardhead {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;
  }
  .collapsed-note {
    font-size: 12px;
    color: var(--sub, #6b7280);
    white-space: nowrap;
  }
  .collapsed-note b {
    font-weight: 700;
  }
  .collapsible[open] .collapsed-note {
    display: none;
  }
  .chev {
    color: var(--sub, #6b7280);
    font-size: 12px;
    transition: transform 0.15s ease;
  }
  .collapsible[open] .chev {
    transform: rotate(90deg);
  }
  .reveal {
    margin-top: 14px;
    cursor: default;
  }
</style>
