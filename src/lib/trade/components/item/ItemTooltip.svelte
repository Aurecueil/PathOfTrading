<!-- src/lib/trade/components/item/ItemTooltip.svelte -->
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
  $: frameId = String(item.frameTypeId ?? (item as any).frameType ?? "");
  $: foilVariation = Number(item.foilVariation ?? 0);
  $: name = cleanBracketText(item.name || "").trim();
  $: base = (() => {
    const b = cleanBracketText(item.baseType || item.typeLine || "").trim();
    return b && b !== name ? b : "";
  })();
  $: double = !!name && !!base;
  $: foil = getFoilGradient(frameId, foilVariation);
  $: itemStyle = resolveItemStyle(frameId);
  $: rarityTint = item.rarity
    ? resolveRarityTint(item.rarity)
    : resolveRarityTint(frameId);
  $: vars = styleToCssVars(itemStyle, 1, {
    corrupted: !!(item.corrupted || item.doubleCorrupted),
    runic: isRunicFrame(frameId),
    foilGradient: foil,
    tint: rarityTint,
  });
  $: leftTintOverride = rarityTint
    ? `--left-tint: ${rarityTint};`
    : (itemStyle as any)?.leftTint
      ? `--left-tint: ${(itemStyle as any).leftTint};`
      : "";
  $: foilTitleVars = resolveFoilTitleVars(frameId, foilVariation, foil);
  $: headerBg = getStyledHeaderBg(frameId, double, isPoe2);
  $: symbols = getCategorySymbols(item, isPoe2);

  const FOIL_VARIATION_COLORS: Record<number, [string, string]> = {
    0: ["#50d890", "#a8ffce"],
    1: ["#d667ff", "#f0b8ff"],
    2: ["#4bb8ff", "#aee2ff"],
    3: ["#ff5252", "#ffb4b4"],
    4: ["#ffbe42", "#ffe6a3"],
    5: ["#e2e8f0", "#ffffff"],
    6: ["#ff7847", "#ffc2a8"],
  };

  function resolveFoilTitleVars(
    fId: string,
    variation: number,
    foilGrad: string | null | undefined,
  ): string {
    if (
      !foilGrad &&
      fId.toLowerCase() !== "foil" &&
      fId.toLowerCase() !== "supporter_foil" &&
      (item as any)?.frameType !== 9
    ) {
      return "";
    }
    const colorMatches = foilGrad
      ? foilGrad.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g)
      : null;
    const c1 =
      colorMatches?.[0] ??
      (FOIL_VARIATION_COLORS[variation] ?? FOIL_VARIATION_COLORS[0])[0];
    const c2 =
      colorMatches?.[1] ??
      colorMatches?.[0] ??
      (FOIL_VARIATION_COLORS[variation] ?? FOIL_VARIATION_COLORS[0])[1];
    return `--foil-c1: ${c1}; --foil-c2: ${c2};`;
  }

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
  class:is-foil={!!foilTitleVars}
  class:is-double-title={double}
  use:portal
  use:measure
  style="{vars}; {leftTintOverride} {foilTitleVars}"
  style:left="{pos.left}px"
  style:top="{pos.top}px"
  style:width="{TIP_W}px"
  style:max-height="{pos.maxH}px"
  style:z-index={100000 + depth}
>
  <div class="tooltip-title-wrap">
    <ItemTitleBar
      {name}
      baseType={base}
      {double}
      isStyled={true}
      hasOverlay={!!foil}
      {symbols}
      styledHeaderBg={headerBg}
    />
  </div>
  <div class="tip-body"><slot /></div>
</div>

<style>
  .item-tooltip {
    position: fixed;
    box-sizing: border-box;
    overflow-y: auto;
    scrollbar-width: thin;
    pointer-events: none;
    font-family: "FontinRegular", Georgia, serif;
    font-weight: 400;
    color: #c8c8c8;
    border: 1px solid color-mix(in srgb, var(--rc, #7f7f7f) 55%, transparent);
    background-color: #06080b;
    background-image: linear-gradient(
        90deg,
        var(--corrupt-tint, transparent),
        transparent 65%
      ),
      linear-gradient(90deg, var(--left-tint, transparent), transparent 65%),
      linear-gradient(270deg, var(--right-tint, transparent), transparent 55%);
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.85),
      0 0 0 1px #000;
  }
  .item-tooltip :global(*) {
    font-family: "FontinRegular", Georgia, serif;
  }
  .tooltip-title-wrap :global(*) {
    font-weight: 700 !important;
  }
  .tip-body {
    padding: 0.45rem 0.6rem 0.55rem;
  }
  .tip-body :global(*) {
    font-weight: 400 !important;
  }

  /* Supporter Foil Title Colors: 1 line = 1st color, 2 lines = 1st + 2nd color */
  .item-tooltip.is-foil:not(.is-double-title) .tooltip-title-wrap :global(*) {
    color: var(--foil-c1, var(--rc)) !important;
  }
  .item-tooltip.is-foil.is-double-title
    .tooltip-title-wrap
    :global(.title-name),
  .item-tooltip.is-foil.is-double-title .tooltip-title-wrap :global(.name),
  .item-tooltip.is-foil.is-double-title .tooltip-title-wrap :global(.line-1),
  .item-tooltip.is-foil.is-double-title
    .tooltip-title-wrap
    :global(:is(div, span, h1, h2, h3, p):first-of-type),
  .item-tooltip.is-foil.is-double-title
    .tooltip-title-wrap
    :global(:is(div, span, h1, h2, h3, p):first-of-type *) {
    color: var(--foil-c1, var(--rc)) !important;
  }
  .item-tooltip.is-foil.is-double-title
    .tooltip-title-wrap
    :global(.title-base),
  .item-tooltip.is-foil.is-double-title .tooltip-title-wrap :global(.base),
  .item-tooltip.is-foil.is-double-title .tooltip-title-wrap :global(.base-type),
  .item-tooltip.is-foil.is-double-title .tooltip-title-wrap :global(.line-2),
  .item-tooltip.is-foil.is-double-title
    .tooltip-title-wrap
    :global(:is(div, span, h1, h2, h3, p):nth-of-type(2)),
  .item-tooltip.is-foil.is-double-title
    .tooltip-title-wrap
    :global(:is(div, span, h1, h2, h3, p):nth-of-type(2) *) {
    color: var(--foil-c2, var(--rc)) !important;
  }
</style>
