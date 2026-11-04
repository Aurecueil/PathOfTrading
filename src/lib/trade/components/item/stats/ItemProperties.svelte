<!-- src/lib/trade/components/item/stats/ItemProperties.svelte -->
<script lang="ts">
  import type { Item } from "$lib/types/tradeItem";
  import PropertyLine from "./PropertyLine.svelte";
  import SpecialProp from "./SpecialProp.svelte";
  import ItemSockets from "./ItemSockets.svelte";
  import {
    buildInlineGroups,
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
  // `properties` and `tamedBeastProperties`: one property per line
  $: lineProps = (item.properties ?? []).filter(isRenderableProp);
  $: tamedProps = (item.tamedBeastProperties ?? []).filter(isRenderableProp);
  // item level / requirements / weapon / support gem / next level: one wrapping line each
  $: groups = buildInlineGroups(item);
  $: sockets = getInlineSockets(item, effectiveMode);

  $: hasLines = lineProps.length + tamedProps.length > 0;

  $: hasContent = hasLines || groups.length > 0 || sockets.length > 0;

  // A "separated" group gets a divider above/below, but only when something
  // else is actually rendered on that side (no dangling dividers at the edges).
  function sepAbove(i: number): boolean {
    return !!groups[i].separated && (hasLines || i > 0);
  }
  function sepBelow(i: number): boolean {
    return (
      !!groups[i].separated && (i < groups.length - 1 || sockets.length > 0)
    );
  }
</script>

{#if hasContent}
  <div class="top-stats-block" class:compact={effectiveMode === "compact"}>
    {#each lineProps as p}
      {@const special = getSpecialKind(p)}
      <div class="prop-line" data-prop-type={p.type}>
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
      <div class="prop-line" data-prop-type={p.type}>
        <PropertyLine prop={p} {isPoe2} />
      </div>
    {/each}

    {#each groups as g, i (g.key)}
      {#if sepAbove(i)}<div class="prop-divider" role="separator"></div>{/if}
      <div class="prop-line wrap" class:comma={g.bare}>
        {#if g.label}<span class="group-label">{g.label}</span>{/if}
        {#each g.props as p}
          <PropertyLine prop={p} {isPoe2} noColon={g.bare} />
        {/each}
      </div>
      {#if sepBelow(i)}<div class="prop-divider" role="separator"></div>{/if}
    {/each}

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
  .group-label {
    color: #8b9bb4;
    font-size: 0.95rem;
    line-height: 1.22;
  }
  .top-stats-block.compact .group-label {
    font-size: 0.9rem;
  }

  /* --sep-img / --sep-h are set on .stats-container by ItemStats (frame based) */
  .prop-divider {
    width: 100%;
    flex-shrink: 0;
    height: var(--sep-h, 8px);
    margin: 1px 0;
    background: var(--sep-img, none) center no-repeat;
  }
</style>
