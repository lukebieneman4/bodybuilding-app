<script lang="ts">
  import { store } from '../data/store.svelte';
  import { SELECTABLE_MUSCLES, PRIORITY_PRESETS, sanitizePriorities } from '../lift/priority';
  import type { Muscle } from '../lift/muscles';

  // `auto` = the auto-detected priorities, shown (read-only) until the user pins
  // their own. The coach ranks/marks using whichever is active.
  let { auto = [] }: { auto?: Muscle[] } = $props();

  let editing = $state(false);

  const manual = $derived(sanitizePriorities(store.liftPriorities ?? []));
  const isAuto = $derived(manual.length === 0);
  const active = $derived(isAuto ? auto : manual);
  const activeSet = $derived(new Set<Muscle>(active));

  const name = (m: string): string => m.replace('_', ' ');

  function toggle(m: Muscle): void {
    const base = new Set<Muscle>(active);
    base.has(m) ? base.delete(m) : base.add(m);
    store.setLiftPriorities([...base]); // empty → null (back to auto) handled in store
  }
  function applyPreset(muscles: Muscle[]): void {
    store.setLiftPriorities([...muscles]);
  }
  function reset(): void {
    store.setLiftPriorities(null);
  }
</script>

<div class="prio">
  <div class="head">
    <span class="lbl">Focus</span>
    <span class="chips">
      {#if active.length}
        {#each active as m}<span class="chip">{name(m)}</span>{/each}
        {#if isAuto}<span class="auto">auto</span>{/if}
      {:else}
        <span class="none">none detected — pick below</span>
      {/if}
    </span>
    <button class="edit" onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Edit'}</button>
  </div>

  {#if editing}
    <div class="editor">
      <div class="presets">
        {#each PRIORITY_PRESETS as p}
          <button class="preset" onclick={() => applyPreset(p.muscles)}>{p.label}</button>
        {/each}
        <button class="preset auto-btn" class:on={isAuto} onclick={reset}>Auto-detect</button>
      </div>
      <div class="picker">
        {#each SELECTABLE_MUSCLES as m}
          <button class="tog" class:on={activeSet.has(m)} onclick={() => toggle(m)}>{name(m)}</button>
        {/each}
      </div>
      <p class="hint">
        Priority muscles surface first in the coach. Leave it on <b>Auto-detect</b> to infer them from what you
        program first each session, or pin your own here.
      </p>
    </div>
  {/if}
</div>

<style>
  .prio { margin-bottom: 12px; }
  .head { display: flex; align-items: center; gap: 8px; }
  .lbl { font-size: 12.5px; font-weight: 700; color: var(--ink, #1f2933); flex: 0 0 auto; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; flex: 1; min-width: 0; }
  .chip {
    font-size: 11px;
    font-weight: 600;
    color: var(--teal-d, #0a5f5e);
    background: #e3efee;
    border-radius: 999px;
    padding: 2px 9px;
    text-transform: capitalize;
  }
  .auto { font-size: 10.5px; color: var(--sub, #6b7280); font-style: italic; }
  .none { font-size: 12px; color: var(--sub, #6b7280); }
  .edit {
    flex: 0 0 auto;
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--teal-d, #0a5f5e);
    cursor: pointer;
  }
  .edit:hover { text-decoration: underline; }

  .editor { margin-top: 10px; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .preset {
    font-size: 12px;
    font-weight: 600;
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid var(--line, #e3ddd0);
    background: #fff;
    color: var(--ink, #1f2933);
    cursor: pointer;
  }
  .preset:hover { background: #f4f1ea; }
  .preset.auto-btn.on { border-color: var(--teal, #0e7c7b); color: var(--teal-d, #0a5f5e); background: #eaf2f1; }

  .picker { display: flex; flex-wrap: wrap; gap: 5px; }
  .tog {
    font-size: 11.5px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--line, #e3ddd0);
    background: #fff;
    color: var(--sub, #6b7280);
    cursor: pointer;
    text-transform: capitalize;
  }
  .tog.on { background: var(--teal, #0e7c7b); border-color: var(--teal, #0e7c7b); color: #fff; }
</style>
