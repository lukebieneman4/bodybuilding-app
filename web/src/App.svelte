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
  import StatStrip, { type Stat } from './lib/components/StatStrip.svelte';
  import MacrosCard from './lib/components/MacrosCard.svelte';
  import Settings from './lib/components/Settings.svelte';
  import { macroTargets } from './lib/core/macros';
  import { KCAL_PER_KG_DEFAULT } from './lib/core/tdee';
  import LiftSection from './lib/components/LiftSection.svelte';
  import { parseWorkoutLog } from './lib/lift/parser';
  import { assignCadenceDates } from './lib/lift/dates';
  import { SAMPLE_LOG } from './lib/lift/sample';

  let editing = $state(false);
  let view = $state<'body' | 'lifts'>('body');
  let logMode = $state<'daily' | 'paste'>('daily');

  const title = $derived(editing ? 'Profile' : view === 'body' ? 'Diet' : 'Lifts');
  function go(v: 'body' | 'lifts'): void {
    view = v;
    editing = false;
  }

  // Demo hook: /?liftdemo seeds the bundled training log so the lift views can be
  // viewed (and headlessly rendered) without manual paste. No-op without the flag.
  $effect(() => {
    if (typeof location === 'undefined' || !new URLSearchParams(location.search).has('liftdemo')) return;
    if (!store.profile) {
      store.setProfile({ units: 'lb', goalKg: 85, paceMode: 'rate', targetRatePctPerWeek: 0.5, createdAt: new Date().toISOString() });
    }
    if (store.liftSessions.length === 0) {
      const today = todayISO();
      store.setLiftLog(SAMPLE_LOG, today, assignCadenceDates(parseWorkoutLog(SAMPLE_LOG).sessions, today));
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

  // macro targets: off current trend weight + a goal-driven calorie target
  // (maintenance shifted by the planned/ideal rate). Carbs fill the remainder.
  const proteinEntries = $derived(store.calories.filter((c) => c.protein != null));
  const bodyKg = $derived(analysis?.current.trendKg ?? store.weighIns.at(-1)?.weightKg ?? 0);
  const calorieTarget = $derived(
    intake && analysis ? intake.current.tdee + (analysis.current.idealRatePerWkKg * KCAL_PER_KG_DEFAULT) / 7 : 0
  );
  const macros = $derived(macroTargets(store.settings, bodyKg, calorieTarget));

  // rate value is colored by on-track status (green on / amber slow / red fast);
  // the Insights card below spells the status out in words. Folding the status
  // read into the rate keeps the strip to three roomy cells at phone width.
  const STATUS_COLOR = { on: '#2e7d5b', fast: '#c0392b', slow: '#b4690e' } as const;
  const dietStats = $derived.by<Stat[]>(() => {
    if (!analysis) return [];
    const c = analysis.current;
    const u = analysis.units;
    const out: Stat[] = [
      { label: 'Trend', value: c.trendDisplay.toFixed(1), sub: u },
      {
        label: 'Rate',
        value: `${c.ratePerWk >= 0 ? '+' : '−'}${Math.abs(c.ratePerWk).toFixed(1)}`,
        sub: `${u}/wk`,
        color: STATUS_COLOR[c.status],
      },
    ];
    if (intake) out.push({ label: 'Maintenance', value: Math.round(intake.current.tdee).toLocaleString(), sub: 'kcal' });
    return out;
  });

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

<header class="appbar">
  <h1>{title}</h1>
  {#if profile}
    <button class="ghost" onclick={() => (editing = !editing)}>
      {editing ? 'Done' : 'Profile'}
    </button>
  {/if}
</header>

<main>
  {#if !profile || editing}
    <IntakeForm initial={profile} />
    {#if profile}<Settings />{/if}
  {:else if view === 'body'}
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
      <StatStrip stats={dietStats} />
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
      {#if store.settings.trackProtein && bodyKg > 0}
        <MacrosCard targets={macros} {proteinEntries} />
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
</main>

{#if profile}
  <nav class="bottomnav">
    <button class:active={view === 'body'} onclick={() => go('body')} aria-label="Diet">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 16 9 10 13 14 21 6" /></svg>
      Diet
    </button>
    <button class:active={view === 'lifts'} onclick={() => go('lifts')} aria-label="Lifts">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" /></svg>
      Lifts
    </button>
  </nav>
{/if}
