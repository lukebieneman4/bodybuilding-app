<script lang="ts">
  import type { VolumeAction } from '../lift/advice';
  import { isTodo } from '../lift/advice';

  let { actions }: { actions: VolumeAction[] } = $props();

  const KIND_COLOR: Record<string, string> = {
    add: '#B4690E',
    grow: '#C08552',
    reduce: '#C0392B',
    hold: '#2E7D5B',
    watch: '#B4690E',
  };
  const name = (m: string): string => m.replace('_', ' ');

  const todos = $derived(actions.filter(isTodo));
  const holds = $derived(actions.filter((a) => a.kind === 'hold'));
  const watches = $derived(actions.filter((a) => a.kind === 'watch'));
</script>

<section class="card coach">
  <div class="cardhead">
    <h2>This week — volume coach</h2>
    <span class="hint">what to adjust next week · zones are coach landmarks (±2 sets), not exact prescriptions</span>
  </div>

  {#if todos.length}
    <ul class="todos">
      {#each todos as a (a.muscle)}
        <li>
          <span class="chip" style="background:{KIND_COLOR[a.kind]}">{a.headline}</span>
          <div class="body">
            <strong>{name(a.muscle)}</strong>
            <p>{a.detail}</p>
            <span class="cite">{a.cite}</span>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="allgood">✓ Every muscle with a target is in (or above) its productive zone this week — nothing to add.</p>
  {/if}

  {#if holds.length || watches.length}
    <div class="status">
      {#if holds.length}
        <span class="line"><b style="color:{KIND_COLOR.hold}">In the zone</b> {holds.map((h) => name(h.muscle)).join(', ')}</span>
      {/if}
      {#if watches.length}
        <span class="line"><b style="color:{KIND_COLOR.watch}">Near ceiling</b> {watches.map((w) => name(w.muscle)).join(', ')}</span>
      {/if}
    </div>
  {/if}
</section>

<style>
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
</style>
