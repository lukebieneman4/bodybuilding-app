<script lang="ts">
  import { store, todayISO } from './lib/data/store.svelte';
  import { analyzeWeight, analyzeIntake } from './lib/core/analysis';
  import { parseWeighInCsv, weighInsToCsv } from './lib/data/csv';
  import { generateSynthetic } from './lib/data/synthetic';
  import { buildInsights } from './lib/insights/insights';
  import IntakeForm from './lib/components/IntakeForm.svelte';
  import QuickLog from './lib/components/QuickLog.svelte';
  import BulkLog from './lib/components/BulkLog.svelte';
  import WeightChart from './lib/components/WeightChart.svelte';
  import TDEEChart from './lib/components/TDEEChart.svelte';
  import Insights from './lib/components/Insights.svelte';
  import LiftSection from './lib/components/LiftSection.svelte';
  import { parseWorkoutLog } from './lib/lift/parser';
  import { assignCadenceDates } from './lib/lift/dates';
  import { SAMPLE_LOG } from './lib/lift/sample';

  let editing = $state(false);
  let view = $state<'body' | 'lifts'>('body');
  let logMode = $state<'daily' | 'paste'>('daily');

  // Demo hook: /?liftdemo seeds the bundled training log so the lift views can be
  // viewed (and headlessly rendered) without manual paste. No-op without the flag.
  $effect(() => {
    if (typeof location === 'undefined' || !new URLSearchParams(location.search).has('liftdemo')) return;
    if (!store.profile) {
      store.setProfile({ units: 'lb', goalKg: 85, paceMode: 'rate', targetRatePctPerWeek: 0.5, createdAt: new Date().toISOString() });
    }
    if (store.liftSessions.length === 0) {
      store.setLiftSessions(assignCadenceDates(parseWorkoutLog(SAMPLE_LOG).sessions, todayISO()));
    }
    view = 'lifts';
  });

  const profile = $derived(store.profile);
  const analysis = $derived(
    profile && store.weighIns.length >= 2 ? analyzeWeight(store.weighIns, profile) : null
  );
  const intake = $derived(
    profile && store.weighIns.length >= 2 ? analyzeIntake(store.weighIns, store.calories) : null
  );
  const insights = $derived(
    analysis && profile
      ? buildInsights(analysis, profile, store.weighIns, store.calories, intake?.current ?? null)
      : []
  );

  async function onImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !profile) return;
    const text = await file.text();
    store.importWeighIns(parseWeighInCsv(text, profile.units));
    input.value = '';
  }

  function loadSynthetic(): void {
    if (!profile) return;
    const start = profile.units === 'lb' ? 90.7 : 90; // ~200 lb
    const d = generateSynthetic({
      startKg: start,
      goalKg: profile.goalKg,
      ratePctPerWeek: profile.targetRatePctPerWeek,
      days: 84,
    });
    store.setData(d.weighIns, d.calories);
  }

  function exportCsv(): void {
    if (!profile) return;
    const blob = new Blob([weighInsToCsv(store.weighIns, profile.units)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weighins.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<main>
  <header class="topbar">
    <div>
      <h1>Trend</h1>
      <span class="tag">evidence-based body &amp; diet tracking</span>
    </div>
    {#if profile}
      <button class="ghost" onclick={() => (editing = !editing)}>
        {editing ? 'Close' : 'Profile'}
      </button>
    {/if}
  </header>

  {#if !profile || editing}
    <IntakeForm initial={profile} />
    {#if editing}<button class="ghost center" onclick={() => (editing = false)}>Done</button>{/if}
  {:else}
    <nav class="tabs">
      <button class:active={view === 'body'} onclick={() => (view = 'body')}>Bodyweight</button>
      <button class:active={view === 'lifts'} onclick={() => (view = 'lifts')}>Lifts</button>
    </nav>

    {#if view === 'body'}
    <div class="tabs logtoggle">
      <button class:active={logMode === 'daily'} onclick={() => (logMode = 'daily')}>Daily</button>
      <button class:active={logMode === 'paste'} onclick={() => (logMode = 'paste')}>Paste log</button>
    </div>
    {#if logMode === 'daily'}
      <QuickLog />
    {:else}
      <BulkLog />
    {/if}

    {#if analysis}
      <section class="card chartcard">
        <div class="cardhead">
          <h2>Bodyweight trend</h2>
          <span class="hint">trend from noisy weigh-ins · honest uncertainty · ideal vs actual</span>
        </div>
        <WeightChart {analysis} />
      </section>
      {#if intake}
        <section class="card chartcard">
          <div class="cardhead">
            <h2>Calories &amp; maintenance</h2>
            <span class="hint">maintenance estimated from your data · adapts over time</span>
          </div>
          <TDEEChart analysis={intake} />
        </section>
      {/if}
      <Insights {insights} />
    {:else}
      <section class="card empty">
        <h2>Add a few weigh-ins to see your trend</h2>
        <p class="hint">Log daily above, import a CSV, or load synthetic data to explore.</p>
      </section>
    {/if}

    <section class="card tools">
      <h3>Data</h3>
      <div class="row wrap">
        <label class="filebtn">
          Import CSV
          <input type="file" accept=".csv,text/csv" onchange={onImport} hidden />
        </label>
        <button class="ghost" onclick={loadSynthetic}>Load synthetic</button>
        <button class="ghost" onclick={exportCsv}>Export CSV</button>
        <button class="ghost danger" onclick={() => store.clearLogs()}>Clear logs</button>
      </div>
      <p class="hint">
        {store.weighIns.length} weigh-ins · {store.calories.length} calorie days logged
      </p>
    </section>
    {:else}
      <LiftSection />
    {/if}
  {/if}

  <footer>Local-first · your data stays in this browser</footer>
</main>
