<script lang="ts">
  /** A compact row of headline numbers (MacroFactor-style dashboard strip). */
  export interface Stat {
    label: string;
    value: string;
    /** Small unit/qualifier under the value, e.g. "lb/wk". */
    sub?: string;
    /** Optional accent color for the value. */
    color?: string;
  }

  let { stats }: { stats: Stat[] } = $props();
</script>

<div class="strip" style="--n:{stats.length}">
  {#each stats as s (s.label)}
    <div class="stat">
      <div class="val" style={s.color ? `color:${s.color}` : ''}>{s.value}</div>
      <div class="lbl">{s.label}{#if s.sub} <span class="sub">{s.sub}</span>{/if}</div>
    </div>
  {/each}
</div>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    gap: 6px;
    background: var(--card, #fff);
    border: 1px solid var(--line, #e7e2d8);
    border-radius: var(--radius, 16px);
    box-shadow: var(--shadow-1, 0 1px 2px rgba(31, 41, 51, 0.05));
    padding: 12px 6px;
  }
  .stat {
    text-align: center;
    padding: 0 4px;
    min-width: 0;
  }
  .stat + .stat {
    border-left: 1px solid var(--line, #eee);
  }
  .val {
    font-size: 19px;
    font-weight: 700;
    color: var(--ink, #1f2933);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.3px;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lbl {
    margin-top: 3px;
    font-size: 11px;
    color: var(--sub, #6b7280);
    line-height: 1.25;
  }
  .sub { white-space: nowrap; }

  @media (max-width: 380px) {
    .val { font-size: 17px; }
    .lbl { font-size: 10px; }
  }
</style>
