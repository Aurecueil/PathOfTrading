<!-- src/lib/trade/components/item/stats/StatGroupSummary.svelte -->
<script lang="ts">
  import type { ItemMod } from "$lib/types/tradeItem";
  import { cleanBracketText } from "./statsUtils";

  /** Server-provided `statgroup.N` pseudo mods, e.g. { description: "Sum: 12" } */
  export let mods: ItemMod[] = [];
  export let compact: boolean = false;

  // "Sum: 12" -> { label: "Sum", value: "12" }
  $: summaries = mods.map((m) => {
    const desc = cleanBracketText(m.description || "").trim();
    const i = desc.indexOf(":");
    return i >= 0
      ? { label: desc.slice(0, i).trim(), value: desc.slice(i + 1).trim() }
      : { label: "", value: desc };
  });
</script>

{#if summaries.length > 0}
  <div class="stat-group-summary-line" class:compact>
    {#each summaries as sg, sgi}
      <span class="sg-entry"
        >{#if sg.label}<span class="sg-label">{sg.label}:</span
          >&nbsp;{/if}<strong class="sg-val">{sg.value}</strong>{sgi <
        summaries.length - 1
          ? ","
          : ""}</span
      >
    {/each}
  </div>
{/if}

<style>
  .stat-group-summary-line {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    column-gap: 0.65rem;
    row-gap: 0.1rem;
    width: 100%;
    font-size: 0.95rem;
    line-height: 1.22;
    color: #cbd5e1;
    text-align: center;
  }
  .stat-group-summary-line.compact {
    font-size: 0.9rem;
  }
  .sg-entry {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }
  .sg-label {
    color: #8b9bb4;
  }
  .sg-val {
    font-weight: 600;
    color: #f1f5f9;
  }
</style>
