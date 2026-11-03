<!-- src/lib/trade/components/item/stats/ItemProperties.svelte -->
<script lang="ts">
  import type { Item } from "$lib/types/tradeItem";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import PropertyLine from "./PropertyLine.svelte";
  import SpecialProp from "./SpecialProp.svelte";
  import ItemSockets from "./ItemSockets.svelte";
  import {
    buildInlineGroups,
    buildKpiStats,
    getSpecialKind,
    isRenderableProp,
    toFormattedValues,
  } from "./propertyGroups";
  import { cleanBracketText } from "./statsUtils";
  import { getInlineSockets } from "./inlineSockets";

  export let item: Item;
  export let effectiveMode: string = "full";
  export let realm: string = "poe";

  $: isPoe2 = (item.realm || realm || "").toLowerCase() === "poe2";
  $: ilvl = item.ilvl || item.itemLevel || 0;
  $: kpiStats = buildKpiStats(item);
  // `properties` and `tamedBeastProperties`: one property per line
  $: lineProps = (item.properties ?? []).filter(isRenderableProp);
  $: tamedProps = (item.tamedBeastProperties ?? []).filter(isRenderableProp);
  // additional / requirements / weapon / support gem / next level: one wrapping line each
  $: groups = buildInlineGroups(item);
  $: sockets = getInlineSockets(item, effectiveMode);

  $: hasContent =
    kpiStats.length > 0 ||
    lineProps.length > 0 ||
    tamedProps.length > 0 ||
    groups.length > 0 ||
    ilvl > 0 ||
    sockets.length > 0;
</script>

{#if hasContent}
  <div class="top-stats-block" class:compact={effectiveMode === "compact"}>
    {#if kpiStats.length > 0}
      <div class="prop-line">
        {#each kpiStats as kpi}
          <span class="kpi-item">
            <span class="label"><StatColorText text={kpi.label} />:</span>
            <strong class:augmented={kpi.augmented}>{kpi.value}</strong>
          </span>
        {/each}
      </div>
    {/if}

    {#each lineProps as p}
      {@const special = getSpecialKind(p)}
      <div class="prop-line">
        {#if special}
          <SpecialProp
            kind={special}
            label={cleanBracketText(p.name).trim()}
            values={toFormattedValues(p, isPoe2)}
          />
        {:else}
          <PropertyLine prop={p} {isPoe2} />
        {/if}
      </div>
    {/each}

    {#each tamedProps as p}
      <div class="prop-line">
        <PropertyLine prop={p} {isPoe2} />
      </div>
    {/each}

    {#each groups as g (g.key)}
      <div class="prop-line wrap" class:comma={g.bare}>
        {#if g.label}<span class="group-label">{g.label}</span>{/if}
        {#each g.props as p}
          <PropertyLine prop={p} {isPoe2} noColon={g.bare} />
        {/each}
      </div>
    {/each}

    {#if ilvl > 0}
      <div class="prop-line">
        <span class="kpi-item">
          <span class="label">Item Level:</span>
          <strong>{ilvl}</strong>
        </span>
      </div>
    {/if}

    <ItemSockets {sockets} on:itemhover on:itemleave />
  </div>
{/if}

<style>
  .top-stats-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.12rem;
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  .prop-line {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    column-gap: 0.9rem;
    row-gap: 0.08rem;
    width: 100%;
    min-width: 0;
    text-align: center;
  }
  .prop-line.wrap {
    column-gap: 0.55rem;
  }
  .prop-line.comma > :global(.prop-item:not(:last-child)::after) {
    content: ",";
    margin-left: -0.3rem;
  }
  .group-label,
  .kpi-item .label {
    color: #8b9bb4;
  }
  .group-label {
    font-size: 0.95rem;
    line-height: 1.22;
  }
  .kpi-item {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.32rem;
    font-size: 0.95rem;
    line-height: 1.22;
    color: #cbd5e1;
  }
  .top-stats-block.compact .kpi-item,
  .top-stats-block.compact .group-label {
    font-size: 0.9rem;
  }
  .kpi-item strong {
    font-weight: 600;
    color: #f1f5f9;
  }
  .kpi-item strong.augmented {
    color: #6588ff;
  }
</style>
