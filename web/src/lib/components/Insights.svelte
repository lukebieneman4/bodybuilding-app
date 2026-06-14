<script lang="ts">
  import type { Insight } from '../insights/insights';

  let { insights }: { insights: Insight[] } = $props();

  const color: Record<string, string> = {
    good: '#2E7D5B',
    info: '#0E7C7B',
    warn: '#B4690E',
  };
</script>

{#if insights.length}
  <section class="card insights">
    <h3>What this means</h3>
    <ul>
      {#each insights as ins (ins.id)}
        <li>
          <span class="dot" style="background:{color[ins.severity]}"></span>
          <div>
            <strong style="color:{color[ins.severity]}">{ins.title}</strong>
            <p>{ins.detail}</p>
            <span class="cite">{ins.cite}</span>
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .insights ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .insights li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-top: 5px;
    flex: 0 0 auto;
  }
  .insights strong {
    font-size: 14px;
  }
  .insights p {
    margin: 3px 0 2px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink);
  }
  .cite {
    font-size: 11px;
    color: var(--sub);
    font-style: italic;
  }
</style>
