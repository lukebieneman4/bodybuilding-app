<script lang="ts">
  import { store } from '../data/store.svelte';

  // `implied` is the auto value derived from the log's cadence; used until the
  // user declares their real density. Drives every weekly-volume number + the coach.
  let { implied }: { implied: number } = $props();

  let mode = $state<'week' | 'days'>('week');
  const isAuto = $derived(store.liftSessionsPerWeek == null);
  const spw = $derived(store.liftSessionsPerWeek ?? implied);

  const round1 = (n: number): number => Math.round(n * 10) / 10;
  const shown = $derived(mode === 'week' ? round1(spw) : round1(7 / spw));

  function onChange(e: Event): void {
    const v = +(e.target as HTMLInputElement).value;
    if (!Number.isFinite(v) || v <= 0) return;
    store.setLiftSessionsPerWeek(mode === 'week' ? v : 7 / v);
  }
</script>

<div class="density">
  <span class="lbl">Training density</span>
  <span class="ctrl">
    <input type="number" min="0.5" step="0.5" value={shown} onchange={onChange} aria-label="training density" />
    <button class="unit" onclick={() => (mode = mode === 'week' ? 'days' : 'week')} title="Switch units">
      {mode === 'week' ? 'sessions/wk' : 'days between'} ⇄
    </button>
  </span>
  <span class="aux">
    {#if mode === 'week'}≈ every {round1(7 / spw)} days{:else}≈ {round1(spw)} sessions/wk{/if}
    {#if isAuto}
      · auto from log
    {:else}
      · <button class="link" onclick={() => store.setLiftSessionsPerWeek(null)}>reset</button>
    {/if}
  </span>
</div>

<style>
  .density {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 10px 14px;
    margin-bottom: 12px;
    background: #f6f2ea;
    border: 1px solid var(--line, #e7e2d8);
    border-radius: 10px;
  }
  .lbl { font-size: 12.5px; font-weight: 600; color: var(--ink, #1f2933); }
  .ctrl { display: inline-flex; align-items: center; gap: 6px; }
  .ctrl input {
    width: 58px;
    padding: 5px 8px;
    border: 1px solid var(--line, #e3ddd0);
    border-radius: 7px;
    font-size: 13px;
    background: #fff;
    color: var(--ink, #1f2933);
  }
  .unit {
    background: #fff;
    border: 1px solid var(--line, #e3ddd0);
    border-radius: 7px;
    padding: 5px 9px;
    font-size: 12px;
    color: var(--teal-d, #0a5f5e);
    cursor: pointer;
  }
  .aux { font-size: 11.5px; color: var(--sub, #6b7280); }
  .link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 11.5px;
    color: var(--teal-d, #0a5f5e);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
