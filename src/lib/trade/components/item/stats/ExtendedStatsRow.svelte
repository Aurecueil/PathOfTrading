<script lang="ts">
  import type { ExtendedCell } from "./propertyGroups";
  export let cells: (ExtendedCell | null)[] = [];
  export let compact = false;
</script>

<div class="ext-row" class:compact>
  {#each cells as c}
    <div class="ext-cell">
      {#if c}
        {#if c.pre}<span class="lbl">{c.pre}</span>{/if}<strong
          style="color: {c.color}">{c.value}</strong
        >{#if c.post}<span class="lbl">{c.post}</span>{/if}
      {/if}
    </div>
  {/each}
</div>

<style>
  .ext-row {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    column-gap: 0.3rem;
    width: 100%;
    text-align: center;
    font-size: 0.92rem;
    line-height: 1.2;
  }
  .ext-row.compact {
    font-size: 0.86rem;
  }
  .ext-cell {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .lbl {
    color: #8b9bb4;
  }
  strong {
    font-weight: 600;
  }
</style>
