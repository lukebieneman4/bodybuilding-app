<script lang="ts">
  import { store } from '../data/store.svelte';
  import { analyzeLifts } from '../lift/analysis';
  import LiftImport from './LiftImport.svelte';
  import StrengthChart from './StrengthChart.svelte';
  import StrengthSummaryChart from './StrengthSummaryChart.svelte';
  import VolumeChart from './VolumeChart.svelte';
  import SymmetryChart from './SymmetryChart.svelte';

  let reimport = $state(false);

  const sessions = $derived(store.liftSessions);
  // surgical side defaults to right (per the user's log); window ~2 cadence-weeks.
  const analysis = $derived(sessions.length ? analyzeLifts(sessions, { surgicalSide: 'R', windowDays: 14 }) : null);

  // strength series worth charting (≥2 points), most-logged first
  const series = $derived(
    (analysis?.strength ?? [])
      .filter((s) => s.points.length >= 2)
      .sort((a, b) => b.points.length - a.points.length)
  );
  const ids = $derived(series.map((s) => `${s.key}|${s.location ?? ''}|${s.limb ?? ''}`));
  let selected = $state('');
  // keep the selection valid as the available series change (initial load, reimport)
  // so the <select> and the charted series never disagree.
  $effect(() => {
    if (series.length && !ids.includes(selected)) selected = ids[0];
  });
  const current = $derived(series.find((s, i) => ids[i] === selected) ?? series[0]);
  const optLabel = (s: (typeof series)[number]): string =>
    `${s.rawName}${s.limb ? ' (' + s.limb + ')' : ''}${s.location ? ' · ' + s.location : ''} — ${s.points.length} sessions`;
</script>

{#if sessions.length === 0 || reimport}
  <LiftImport ondone={() => (reimport = false)} />
  {#if reimport}<button class="ghost center" onclick={() => (reimport = false)}>Cancel</button>{/if}
{:else if analysis}
  {#if analysis.summary.byMuscle.length || analysis.summary.byExercise.length}
    <section class="card">
      <div class="cardhead">
        <h2>Strength summary</h2>
        <span class="hint">overall progress · every lift indexed to its own start · grouped by muscle</span>
      </div>
      <StrengthSummaryChart summary={analysis.summary} />
    </section>
  {/if}

  <section class="card">
    <div class="cardhead">
      <h2>Strength trend</h2>
      <span class="hint">estimated top-set (e1RM) per exercise · self-relative index, not kg</span>
    </div>
    {#if series.length}
      <select bind:value={selected} class="picker">
        {#each series as s, i}
          <option value={ids[i]}>{optLabel(s)}</option>
        {/each}
      </select>
      {#if current}<StrengthChart series={current} />{/if}
    {:else}
      <p class="hint">Log a couple more sessions of the same lift to see a trend.</p>
    {/if}
  </section>

  <section class="card">
    <div class="cardhead">
      <h2>Weekly volume per muscle</h2>
      <span class="hint">hard sets/week (RIR ≤ 3) vs evidence-based landmarks · trailing 2 weeks</span>
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
      <button class="ghost" onclick={() => (reimport = true)}>Import more / replace</button>
      <button class="ghost danger" onclick={() => store.clearLifts()}>Clear lifts</button>
    </div>
    <p class="hint">{sessions.length} sessions loaded.</p>
  </section>
{/if}

<style>
  .picker {
    width: 100%;
    margin-bottom: 10px;
    padding: 8px 10px;
    border: 1px solid var(--line, #E3DDD0);
    border-radius: 8px;
    font-size: 13px;
    background: white;
  }
</style>
