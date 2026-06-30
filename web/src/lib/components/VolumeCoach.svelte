<script lang="ts">
  import type { VolumeAction, StrengthFlag } from '../lift/advice';
  import { isTodo } from '../lift/advice';
  import type { Muscle } from '../lift/muscles';
  import PriorityMuscles from './PriorityMuscles.svelte';

  let {
    actions,
    flags = [],
    priorities = [],
    autoDetected = [],
  }: {
    actions: VolumeAction[];
    flags?: StrengthFlag[];
    /** Active priority muscles (manual or auto) — their to-dos lead and get marked. */
    priorities?: Muscle[];
    /** Auto-detected priorities, for the editor's "auto" display. */
    autoDetected?: Muscle[];
  } = $props();

  const prioSet = $derived(new Set<Muscle>(priorities));

  const KIND_COLOR: Record<string, string> = {
    add: '#B4690E',
    grow: '#C08552',
    reduce: '#C0392B',
    hold: '#2E7D5B',
    watch: '#B4690E',
  };
  const name = (m: string): string => m.replace('_', ' ');

  const todos = $derived(actions.filter(isTodo));
  // 'hold' covers two cases: genuinely in the MAV band (status optimal) and
  // "fed indirectly" muscles (e.g. front delts below MEV but driven by pressing).
  // Keep them apart so "in the zone" means exactly that — and matches the strip.
  const holds = $derived(actions.filter((a) => a.kind === 'hold' && a.status === 'optimal'));
  const fedIndirect = $derived(actions.filter((a) => a.kind === 'hold' && a.status !== 'optimal'));
  const watches = $derived(actions.filter((a) => a.kind === 'watch'));

  // summary counts (the one-line picture, so the collapsed list still informs)
  const adds = $derived(todos.filter((a) => a.kind === 'add' || a.kind === 'grow'));
  const trims = $derived(todos.filter((a) => a.kind === 'reduce'));

  // show the few most urgent to-dos (already severity-sorted); collapse the rest
  const TOP = 3;
  const FLAG_TOP = 2;
  let showAllTodos = $state(false);
  let showAllFlags = $state(false);
  // priority muscles' to-dos lead; stable sort keeps severity order within groups
  const rankedTodos = $derived(
    [...todos].sort((a, b) => (prioSet.has(b.muscle) ? 1 : 0) - (prioSet.has(a.muscle) ? 1 : 0))
  );
  const visibleTodos = $derived(showAllTodos ? rankedTodos : rankedTodos.slice(0, TOP));
  const visibleFlags = $derived(showAllFlags ? flags : flags.slice(0, FLAG_TOP));
</script>

<section class="card coach">
  <div class="cardhead">
    <h2>This week — coach</h2>
    <span class="hint">your most urgent moves first · zones are coach landmarks (±2 sets), not exact prescriptions</span>
  </div>

  <PriorityMuscles auto={autoDetected} />

  {#if todos.length}
    <p class="summary">
      {#if adds.length}<span><b style="color:{KIND_COLOR.add}">{adds.length}</b> to add</span>{/if}
      {#if trims.length}<span><b style="color:{KIND_COLOR.reduce}">{trims.length}</b> to ease back</span>{/if}
      {#if holds.length}<span><b style="color:{KIND_COLOR.hold}">{holds.length}</b> in the zone</span>{/if}
    </p>

    <ul class="todos">
      {#each visibleTodos as a (a.muscle)}
        <li>
          <span class="chip" style="background:{KIND_COLOR[a.kind]}">{a.headline}</span>
          <div class="body">
            <strong>{name(a.muscle)}</strong>{#if prioSet.has(a.muscle)}<span class="prio-tag">★ priority</span>{/if}
            <p>{a.detail}</p>
            <span class="cite">{a.cite}</span>
          </div>
        </li>
      {/each}
    </ul>
    {#if todos.length > TOP}
      <button class="more" onclick={() => (showAllTodos = !showAllTodos)}>
        {showAllTodos ? 'Show fewer' : `Show ${todos.length - TOP} more`}
      </button>
    {/if}
  {:else}
    <p class="allgood">✓ Every muscle with a target is in (or above) its productive zone this week — nothing to add.</p>
  {/if}

  {#if holds.length || watches.length || fedIndirect.length}
    <div class="status">
      {#if holds.length}
        <span class="line"><b style="color:{KIND_COLOR.hold}">In the zone</b> {holds.map((h) => name(h.muscle)).join(', ')}</span>
      {/if}
      {#if watches.length}
        <span class="line"><b style="color:{KIND_COLOR.watch}">Near ceiling</b> {watches.map((w) => name(w.muscle)).join(', ')}</span>
      {/if}
      {#if fedIndirect.length}
        <span class="line"><b>Fed indirectly</b> {fedIndirect.map((f) => name(f.muscle)).join(', ')} — direct work optional</span>
      {/if}
    </div>
  {/if}

  {#if flags.length}
    <div class="watch">
      <h3 class="subhead">Strength watch — lifts trending down</h3>
      <ul class="todos">
        {#each visibleFlags as f (f.name)}
          <li>
            <span class="chip" style="background:#C0392B">▼ {Math.abs(Math.round(f.pctPerWeek))}%/wk</span>
            <div class="body">
              <strong style="text-transform:none">{f.name}</strong>
              <p>{f.detail}</p>
              <span class="cite">{f.cite}</span>
            </div>
          </li>
        {/each}
      </ul>
      {#if flags.length > FLAG_TOP}
        <button class="more" onclick={() => (showAllFlags = !showAllFlags)}>
          {showAllFlags ? 'Show fewer' : `Show ${flags.length - FLAG_TOP} more`}
        </button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin: 0 0 14px;
    font-size: 13px;
    color: var(--sub, #6b7280);
  }
  .summary b {
    font-size: 15px;
    margin-right: 3px;
  }

  .todos {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .todos li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .chip {
    flex: 0 0 auto;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
    margin-top: 1px;
  }
  .body strong {
    font-size: 14px;
    text-transform: capitalize;
    color: var(--ink, #1f2933);
  }
  .prio-tag {
    margin-left: 7px;
    font-size: 10px;
    font-weight: 700;
    color: #b4690e;
    text-transform: none;
    white-space: nowrap;
  }
  .body p {
    margin: 3px 0 2px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink, #1f2933);
  }
  .cite {
    font-size: 11px;
    color: var(--sub, #6b7280);
    font-style: italic;
  }
  .more {
    margin-top: 12px;
    background: none;
    border: none;
    padding: 0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--teal-d, #0a5f5e);
    cursor: pointer;
  }
  .more:hover { text-decoration: underline; }
  .allgood {
    margin: 0;
    font-size: 13px;
    color: #2e7d5b;
  }
  .status {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid #f0ece3;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .status .line {
    font-size: 12px;
    color: var(--sub, #6b7280);
    text-transform: capitalize;
  }
  .status b {
    font-weight: 600;
    margin-right: 6px;
    text-transform: none;
  }
  .watch {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #f0ece3;
  }
  .subhead {
    margin: 0 0 10px;
    font-size: 12.5px;
    font-weight: 600;
    color: #c0392b;
  }
</style>
