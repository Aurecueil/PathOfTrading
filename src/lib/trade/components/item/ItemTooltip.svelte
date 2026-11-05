<!-- src/lib/trade/components/item/ItemTooltip.svelte -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { Item } from "$lib/types/tradeItem";
  import ItemTitleBar from "./ItemTitleBar.svelte";
  import { getCategorySymbols } from "./categorySymbols";
  import { cleanBracketText } from "./stats/statsUtils";
  import { getFoilGradient, getStyledHeaderBg } from "./itemStyles";
  import { rectToWorld, placeBeside } from "./tooltipPlacement";
  import "./foilTitle.css";
  import { buildItemVisuals } from "./itemStyles";
  import { getBaseTypeLabel } from "$lib/trade/components/item/stats/statsUtils";

  export let item: Item;
  export let realm: string = "poe";
  export let rect: DOMRect;
  export let depth: number = 0;
  export let locked: boolean = false;

  const TIP_W = 500;

  const canvas = getContext<{ getWorld: () => HTMLElement | null } | undefined>(
    "canvasWorld",
  );

  let tipH = 0;

  $: isPoe2 = (item.realm || realm || "").toLowerCase() === "poe2";
  $: frameId = String(item.frameTypeId ?? (item as any).frameType ?? "");
  $: foilVariation = Number(item.foilVariation ?? 0);
  $: name = cleanBracketText(item.name || "").trim();
  $: base = (() => {
    const b = cleanBracketText(getBaseTypeLabel(item)).trim();
    return b && b !== name ? b : "";
  })();
  $: double = !!name && !!base;
  $: foil = getFoilGradient(frameId, foilVariation);

  $: headerBg = getStyledHeaderBg(frameId, double, isPoe2);
  $: v = buildItemVisuals(item, realm, 1, double);
  $: symbols = getCategorySymbols(item, v.isPoe2);

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
  class:is-locked={locked}
  class:is-foil={!!v.foilTitleVars}
  class:is-double-title={double}
  style="{v.styleVars}; {v.foilTitleVars}"
  use:portal
  use:measure
  style:left="{pos.left}px"
  style:top="{pos.top}px"
  style:width="{TIP_W}px"
  style:max-height="{pos.maxH}px"
  style:z-index={100000 + depth}
>
  <div class="tooltip-title-wrap foil-title-host">
    <ItemTitleBar
      {name}
      baseType={base}
      {double}
      isStyled={true}
      {symbols}
      hasOverlay={!!v.foilGradient}
      styledHeaderBg={v.headerBg}
    />
  </div>
  <div class="tip-body"><slot /></div>
</div>

<style>
  .item-tooltip.is-locked {
    pointer-events: auto;
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.85),
      0 0 0 1px var(--rc, #7f7f7f);
  }
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
</style>
