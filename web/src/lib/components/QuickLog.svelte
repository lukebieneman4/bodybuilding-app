<script lang="ts">
  import { store, todayISO } from '../data/store.svelte';
  import { toKg, fromKg } from '../data/types';

  const units = $derived(store.profile?.units ?? 'lb');

  let date = $state(todayISO());
  let weight = $state<number | null>(null);
  let kcal = $state<number | null>(null);

  // prefill weight with the most recent entry as a convenience
  $effect(() => {
    if (weight === null && store.weighIns.length) {
      const last = store.weighIns[store.weighIns.length - 1];
      weight = Number(fromKg(last.weightKg, units).toFixed(1));
    }
  });

  function logIt(): void {
    if (weight !== null && Number.isFinite(weight)) {
      store.addWeighIn({ date, weightKg: toKg(weight, units) });
    }
    if (kcal !== null && Number.isFinite(kcal)) {
      store.addCalorie({ date, kcal });
    }
    kcal = null;
  }
</script>

<div class="card quicklog">
  <div class="row">
    <label>Date<input type="date" bind:value={date} /></label>
    <label>Weight ({units})<input type="number" step="0.1" bind:value={weight} placeholder="—" /></label>
    <label>Calories<input type="number" step="10" bind:value={kcal} placeholder="optional" /></label>
    <button class="primary" onclick={logIt}>Log</button>
  </div>
  <p class="hint">One tap a day — weight is what drives the trend; calories feed the maintenance estimate.</p>
</div>
