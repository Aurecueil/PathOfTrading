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
  /**
   * Which slice to render. ItemStats calls this once per slice and puts each
   * in its own block, so ItemStats alone draws the separators.
   *   props   = properties, tamed beast, next level
   *   level   = item level + requirements
   *   sockets = inline sockets
   */
  export let part: "props" | "level" | "sockets" = "props";

  $: isPoe2 = (item.realm || realm || "").toLowerCase() === "poe2";
  $: lineProps = (item.properties ?? []).filter(isRenderableProp);
  $: tamedProps = (item.tamedBeastProperties ?? []).filter(isRenderableProp);
  $: nextLevelProps = (item.nextLevelRequirements ?? []).filter(
    isRenderableProp,
  );
  $: groups = buildInlineGroups(item);
  $: sockets = getInlineSockets(item, effectiveMode);

  $: hasContent =
    part === "props"
      ? lineProps.length + tamedProps.length + nextLevelProps.length > 0
      : part === "level"
        ? groups.length > 0
        : sockets.length > 0;
</script>

{#if hasContent}
  <div class="top-stats-block" class:compact={effectiveMode === "compact"}>
    {#if part === "props"}
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

      {#each nextLevelProps as p}
        <div class="prop-line" data-prop-type={p.type}>
          <PropertyLine prop={p} {isPoe2} />
        </div>
      {/each}
    {:else if part === "level"}
      {#each groups as g (g.key)}
        <div class="prop-line wrap" class:comma={g.bare}>
          {#if g.label}<span class="group-label">{g.label}</span>{/if}
          {#each g.props as p}
            <PropertyLine prop={p} {isPoe2} noColon={g.bare} />
          {/each}
        </div>
      {/each}
    {:else}
      <ItemSockets {sockets} on:itemhover on:itemleave />
    {/if}
  </div>
{/if}

<style>
  .top-stats-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.06rem; /* was 0 (original 0.12rem) */
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
    row-gap: 0.04rem;
    width: 100%;
    min-width: 0;
    text-align: center;
  }

  /* normal property lines: slightly tighter than the original */
  .prop-line:not([data-prop-type="99"]):not([data-prop-type="110"])
    :global(.prop-item) {
    line-height: 1.14; /* was 1.05 (original 1.22) */
    row-gap: 0.04rem;
  }

  /* special lines (memory / intangibility): unchanged */
  .prop-line[data-prop-type="99"],
  .prop-line[data-prop-type="110"] {
    margin: 0.12rem 0;
  }
  .prop-line.wrap {
    column-gap: 0.55rem;
  }
  .prop-line.comma > :global(.prop-item:not(:last-child)::after) {
    content: ",";
    margin-left: -0.3rem;
  }
  .group-label {
    color: #7f7f7f;
    font-size: 0.95rem;
    line-height: 1.22;
  }
  .top-stats-block.compact .group-label {
    font-size: 0.9rem;
  }
</style>
