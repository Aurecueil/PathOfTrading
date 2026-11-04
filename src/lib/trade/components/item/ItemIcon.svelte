<!-- src/lib/trade/components/item/ItemIcon.svelte -->
<script lang="ts">
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import type { Item } from "$lib/types/tradeItem";
  import ItemSockets from "./ItemSockets.svelte";
  import CdnImage from "./CdnImage.svelte";

  export let item: Item;
  export let styleMode: ResolvedDisplayStyle = "full";
  /** Base size (px) of a 1x1 inventory cell; scales down automatically if container is narrower */
  export let baseCellSize: number = 62;

  let hostWidth = 0;

  $: itemW = Math.max(1, item.w || 1);
  $: itemH = Math.max(1, item.h || 1);

  // Target cell size adapts to available host width while keeping exact w:h proportions
  $: effectiveCellSize = (() => {
    if (styleMode === "minimal") return 48 / Math.max(itemW, itemH);
    if (hostWidth > 0) {
      // Allow growing/shrinking based on available column space (clamped to sensible bounds)
      const maxFromHost = hostWidth / 2; // 2-col item fills hostWidth; 1-col item takes half
      return Math.min(Math.max(maxFromHost, 38), 84);
    }
    return baseCellSize;
  })();

  $: iconDimensions = (() => {
    if (styleMode === "minimal") {
      return { w: 48, h: 48 };
    }
    return {
      w: Math.round(itemW * effectiveCellSize),
      h: Math.round(itemH * effectiveCellSize),
    };
  })();

  // Actual rendered cell size inside the 92% padded image area
  $: renderedCellSize = (iconDimensions.w * 0.92) / itemW;

  $: stackMaxed =
    item.stackSize !== undefined &&
    item.maxStackSize !== undefined &&
    item.stackSize >= item.maxStackSize;

  $: nonGemSockets = (item.sockets || []).filter(
    (s) => (s.type || "").toLowerCase() !== "gem",
  );
  $: hasEquipmentSockets = nonGemSockets.length > 0;
</script>

<div class="item-icon-host" bind:clientWidth={hostWidth}>
  <div
    class="item-icon-wrapper mode-{styleMode}"
    class:is-corrupted={styleMode !== "minimal" &&
      (item.corrupted || item.doubleCorrupted)}
    class:is-sanctified={styleMode !== "minimal" && item.sanctified}
    class:is-fractured={styleMode !== "minimal" && item.fractured}
    class:is-unidentified={styleMode !== "minimal" && item.identified === false}
    style:width="{iconDimensions.w}px"
    style:height="{iconDimensions.h}px"
    style:aspect-ratio={styleMode === "minimal"
      ? "1 / 1"
      : `${itemW} / ${itemH}`}
  >
    {#if item.icon}
      <CdnImage
        src={item.icon}
        alt={item.typeLine || item.name}
        className="item-icon"
        loading="lazy"
      />
    {/if}

    <!-- Minimal mode: image only, never any socket graphics -->
    {#if styleMode !== "minimal" && hasEquipmentSockets}
      <ItemSockets
        sockets={item.sockets ?? []}
        socketedItems={item.socketedItems ?? []}
        w={itemW}
        h={itemH}
        realm={item.realm === "poe2" ? "poe2" : "poe"}
        cellSize={renderedCellSize}
      />
    {/if}

    {#if item.stackSize}
      <span class="stack-badge" class:maxed={stackMaxed}>
        {item.stackSize}{styleMode === "full" && item.maxStackSize
          ? `/${item.maxStackSize}`
          : ""}
      </span>
    {/if}
    {#if item.iconTierText}
      <span class="tier-text">{item.iconTierText}</span>
    {/if}
  </div>
</div>

<style>
  .item-icon-host {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .item-icon-wrapper {
    --_rgb: var(--rc-rgb, 127, 127, 127);
    position: relative;
    background: radial-gradient(
        circle at 50% 42%,
        rgba(var(--_rgb), 0.2) 0%,
        rgba(var(--_rgb), 0.05) 48%,
        transparent 78%
      ),
      linear-gradient(180deg, #11141b 0%, #05070a 100%);
    border: 1px solid rgba(var(--_rgb), 0.38);
    border-radius: 0;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.8),
      inset 0 0 14px rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .item-icon-wrapper::after {
    content: "";
    position: absolute;
    inset: 3px;
    border: 1px solid rgba(var(--_rgb), 0.12);
    pointer-events: none;
    z-index: 0;
  }

  .item-icon-wrapper.is-unidentified {
    background: radial-gradient(
        circle at 50% 42%,
        rgba(210, 0, 0, 0.22) 0%,
        transparent 75%
      ),
      linear-gradient(180deg, #1a0c0c 0%, #060304 100%);
  }
  .item-icon-wrapper.is-corrupted {
    border-color: rgba(210, 0, 0, 0.6);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.8),
      inset 0 0 16px rgba(210, 0, 0, 0.25);
  }
  .item-icon-wrapper.is-sanctified {
    border-color: rgba(162, 145, 98, 0.8);
  }
  .item-icon-wrapper.is-fractured {
    border-color: rgba(162, 145, 98, 0.7);
  }

  :global(.item-icon-wrapper .item-icon) {
    position: relative;
    width: 92%;
    height: 92%;
    max-width: 92%;
    max-height: 92%;
    object-fit: contain;
    z-index: 1;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
    user-select: none;
    -webkit-user-drag: none;
  }

  .stack-badge {
    position: absolute;
    top: 2px;
    left: 5px;
    z-index: 3;
    font-family: "FontinRegular", Georgia, serif;
    font-size: 0.95rem;
    font-weight: 400;
    line-height: 1.1;
    color: #fff;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 4px #000;
    pointer-events: none;
  }
  .stack-badge.maxed {
    color: #00bafe;
  }
  .mode-minimal .stack-badge {
    font-size: 0.78rem;
    left: 3px;
  }
  .tier-text {
    position: absolute;
    bottom: 2px;
    left: 5px;
    z-index: 3;
    font-family: "FontinRegular", Georgia, serif;
    font-size: 0.85rem;
    font-weight: 400;
    line-height: 1.1;
    color: #fff;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 4px #000;
    pointer-events: none;
  }
  .mode-minimal .tier-text {
    font-size: 0.7rem;
    left: 3px;
  }
</style>
