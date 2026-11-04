<script lang="ts">
  import { getContext } from "svelte";
  import type { Item } from "$lib/types/tradeItem";
  import ItemTitleBar from "./ItemTitleBar.svelte";
  import { getCategorySymbols } from "./categorySymbols";
  import { cleanBracketText } from "./stats/statsUtils";
  import {
    getFoilGradient,
    getStyledHeaderBg,
    isRunicFrame,
    resolveItemStyle,
    resolveRarityTint,
    styleToCssVars,
  } from "./itemStyles";
  import { rectToWorld, placeBeside } from "./tooltipPlacement";

  export let item: Item;
  export let realm: string = "poe";
  export let rect: DOMRect;
  export let depth: number = 0;

  const TIP_W = 450;

  const canvas = getContext<{ getWorld: () => HTMLElement | null } | undefined>(
    "canvasWorld",
  );

  let tipH = 0;

  $: isPoe2 = (item.realm || realm || "").toLowerCase() === "poe2";
  $: frameId = item.frameTypeId ?? "";
  $: name = cleanBracketText(item.name || "").trim();
  $: base = (() => {
    const b = cleanBracketText(item.baseType || item.typeLine || "").trim();
    return b && b !== name ? b : "";
  })();
  $: double = !!name && !!base;
  $: foil = getFoilGradient(frameId, Number(item.foilVariation ?? 0));
  $: vars = styleToCssVars(resolveItemStyle(frameId), 1, {
    corrupted: !!(item.corrupted || item.doubleCorrupted),
    runic: isRunicFrame(frameId),
    foilGradient: foil,
    tint: resolveRarityTint(item.rarity),
  });
  $: headerBg = getStyledHeaderBg(frameId, double, isPoe2);
  $: symbols = getCategorySymbols(item, isPoe2);

  // Only recomputed when the hover rect changes (not on zoom/pan)
  $: anchor = rectToWorld(canvas, rect);
  $: pos = placeBeside(anchor, TIP_W, tipH || 200);

  function measure(node: HTMLElement) {
    const update = () => (tipH = node.offsetHeight || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return { destroy: () => ro.disconnect() };
  }

  function portal(node: HTMLElement) {
    (canvas?.getWorld() ?? document.body).appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<div
  class="item-tooltip"
  use:portal
  use:measure
  style={vars}
  style:left="{pos.left}px"
  style:top="{pos.top}px"
  style:width="{TIP_W}px"
  style:max-height="{pos.maxH}px"
  style:z-index={100000 + depth}
>
  <ItemTitleBar
    {name}
    baseType={base}
    {double}
    isStyled={true}
    hasOverlay={!!foil}
    {symbols}
    styledHeaderBg={headerBg}
  />
  <div class="tip-body"><slot /></div>
</div>

<style>
  .item-tooltip {
    position: fixed;
    box-sizing: border-box;
    overflow-y: auto;
    scrollbar-width: thin;
    pointer-events: none;
    color: #c8c8c8;
    border: 1px solid color-mix(in srgb, var(--rc) 55%, transparent);
    background: linear-gradient(90deg, var(--corrupt-tint), transparent 65%),
      linear-gradient(90deg, var(--left-tint), transparent 65%),
      linear-gradient(270deg, var(--right-tint), transparent 55%),
      rgba(4, 5, 7, 0.97);
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.85),
      0 0 0 1px #000;
  }
  .tip-body {
    padding: 0.45rem 0.6rem 0.55rem;
  }
</style>
