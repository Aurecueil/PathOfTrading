<!-- src/lib/components/item/ItemIcon.svelte -->
<script lang="ts">
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import type { Item } from "$lib/types/tradeItem";
  import ItemSockets from "./ItemSockets.svelte";
  import CdnImage from "./CdnImage.svelte";

  export let item: Item;
  export let styleMode: ResolvedDisplayStyle = "full";

  $: iconDimensions = (() => {
    if (styleMode === "minimal") {
      return { w: 48, h: 48 };
    }
    // Full mode: significantly larger container & scaled-up artwork
    const cellW = 62;
    const cellH = 62;
    const w = Math.min(Math.max((item.w || 1) * cellW, 116), 136);
    const h = Math.min(Math.max((item.h || 1) * cellH, 136), 192);
    return { w, h };
  })();

  $: stackMaxed =
    item.stackSize !== undefined &&
    item.maxStackSize !== undefined &&
    item.stackSize >= item.maxStackSize;

  $: hasSockets = Boolean(item.sockets && item.sockets.length > 0);
</script>

<div
  class="item-icon-wrapper mode-{styleMode}"
  class:is-corrupted={item.corrupted}
  class:is-sanctified={item.sanctified}
  class:is-fractured={item.fractured}
  class:is-unidentified={item.identified === false}
  style:width="{iconDimensions.w}px"
  style:height="{iconDimensions.h}px"
  title={item.typeLine || item.name}
>
  {#if item.icon}
    <CdnImage
      src={item.icon}
      alt={item.typeLine || item.name}
      className="item-icon"
      loading="lazy"
    />
  {/if}

  {#if styleMode !== "minimal" && hasSockets}
    <ItemSockets
      sockets={item.sockets ?? []}
      socketedItems={item.socketedItems ?? []}
      w={item.w}
      h={item.h}
      realm={item.realm === "poe2" ? "poe2" : "poe"}
      on:gems
    />
  {:else if styleMode === "minimal" && hasSockets}
    <span class="mini-socket-pill" title="{item.sockets?.length} sockets">
      {item.sockets?.length}S
    </span>
  {/if}

  {#if item.stackSize}
    <span class="stack-badge" class:maxed={stackMaxed}>
      {item.stackSize}{styleMode === "full" && item.maxStackSize
        ? `/${item.maxStackSize}`
        : ""}
    </span>
  {/if}
</div>

<style>
  /*
    --rc / --rc-rgb are set by the row (SearchItemRow) and inherited here, so
    the icon tile picks up the item's rarity colour. Fallbacks keep the
    component usable on its own.
  */
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

  /* inner hairline frame, like an inventory cell */
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

  /* Explicitly set width & height so 1x1 / 1x2 CDN images scale up to fill the box */
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

  /* Stack size reads like the in-game number: bold, top-left, outlined */
  .stack-badge {
    position: absolute;
    top: 2px;
    left: 5px;
    z-index: 3;
    font-family: "FontinBold", "FontinRegular", Georgia, serif;
    font-size: 0.95rem;
    font-weight: 700;
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

  .mini-socket-pill {
    position: absolute;
    bottom: 1px;
    right: 1px;
    background: rgba(0, 0, 0, 0.85);
    color: #d8d8d8;
    border: 1px solid #3a3a3a;
    font-size: 0.56rem;
    font-weight: 700;
    line-height: 1.3;
    padding: 0 3px;
    z-index: 3;
  }
</style>
