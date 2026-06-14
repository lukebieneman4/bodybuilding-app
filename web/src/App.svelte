<script lang="ts">
  import { store } from './lib/data/store.svelte';
  import { analyzeWeight } from './lib/core/analysis';
  import { parseWeighInCsv, weighInsToCsv } from './lib/data/csv';
  import { generateSynthetic } from './lib/data/synthetic';
  import IntakeForm from './lib/components/IntakeForm.svelte';
  import QuickLog from './lib/components/QuickLog.svelte';
  import WeightChart from './lib/components/WeightChart.svelte';

  let editing = $state(false);

  const profile = $derived(store.profile);
  const analysis = $derived(
    profile && store.weighIns.length >= 2 ? analyzeWeight(store.weighIns, profile) : null
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
      maintenanceKcal: profile.currentIntakeKcal ?? 2900,
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
    <QuickLog />

    {#if analysis}
      <section class="card chartcard">
        <div class="cardhead">
          <h2>Bodyweight trend</h2>
          <span class="hint">trend from noisy weigh-ins · honest uncertainty · ideal vs actual</span>
        </div>
        <WeightChart {analysis} />
      </section>
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
  {/if}

  <footer>Local-first · your data stays in this browser</footer>
</main>
