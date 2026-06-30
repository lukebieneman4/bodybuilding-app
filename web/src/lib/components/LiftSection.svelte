<script lang="ts">
  import { store } from '../data/store.svelte';
  import { analyzeLifts, impliedSessionsPerWeek } from '../lift/analysis';
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
</script>

{#if sessions.length === 0 || reimport}
  <LiftImport ondone={() => (reimport = false)} />
  {#if reimport}<button class="ghost center" onclick={() => (reimport = false)}>Cancel</button>{/if}
{:else if analysis}
  <StatStrip stats={liftStats} />
  <TrainingDensity {implied} />

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
      <span class="hint">hard sets/week (RIR ≤ 3) vs evidence-based landmarks · at your training density</span>
    </div>
    <VolumeChart volume={analysis.volume} />
  </section>

  {#if analysis.asymmetry.length}
    <section class="card">
      <div class="cardhead">
        <h2>Left / right symmetry</h2>
        <span class="hint">surgical-vs-healthy strength (LSI) · the ACL-recovery view</span>
      </div>
      <SymmetryChart asymmetry={analysis.asymmetry} />
    </section>
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
