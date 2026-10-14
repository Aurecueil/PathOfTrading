<!-- src/lib/components/item/ItemIcon.svelte -->
<script lang="ts">
  import type { ResolvedDisplayStyle } from "$lib/types";
  import type { Item } from "$lib/types/item";
  import ItemSockets from "./ItemSockets.svelte";
  import CdnImage from "$lib/trade/componenets/item/CdnImage.svelte";

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
</script>

<div
  class="item-icon-wrapper mode-{styleMode}"
  class:is-corrupted={item.corrupted}
  class:is-sanctified={item.sanctified}
  class:is-fractured={item.fractured}
  style:width="{iconDimensions.w}px"
  style:height="{iconDimensions.h}px"
>
  {#if item.icon}
    <CdnImage
      src={item.icon}
      alt={item.typeLine || item.name}
      className="item-icon"
      loading="lazy"
    />
  {/if}

  {#if styleMode !== "minimal" && item.sockets && item.sockets.length > 0}
    <ItemSockets sockets={item.sockets} />
  {:else if styleMode === "minimal" && item.sockets && item.sockets.length > 0}
    <span class="mini-socket-pill" title="{item.sockets.length} Sockets">
      {item.sockets.length}S
    </span>
  {/if}

  {#if item.stackSize}
    <span class="stack-badge">
      {item.stackSize}{styleMode === "full" && item.maxStackSize
        ? `/${item.maxStackSize}`
        : ""}
    </span>
  {/if}
</div>

<style>
  .item-icon-wrapper {
    position: relative;
    background: radial-gradient(circle at center, #171b26 0%, #080a0f 100%);
    border: 1px solid #232938;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .item-icon-wrapper.is-corrupted {
    border-color: rgba(239, 68, 68, 0.45);
  }
  .item-icon-wrapper.is-sanctified {
    border-color: rgba(250, 204, 21, 0.5);
  }
  .item-icon-wrapper.is-fractured {
    border-color: rgba(234, 179, 8, 0.45);
  }
  /* Explicitly set width & height so 1x1 / 1x2 CDN images scale up to fill the box */
  :global(.item-icon-wrapper .item-icon) {
    width: 92%;
    height: 92%;
    max-width: 92%;
    max-height: 92%;
    object-fit: contain;
    z-index: 1;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.65));
  }
  .stack-badge {
    position: absolute;
    bottom: 3px;
    right: 4px;
    background: rgba(0, 0, 0, 0.88);
    color: #e2e8f0;
    font-size: 0.68rem;
    padding: 1px 5px;
    border-radius: 2px;
    z-index: 3;
    font-family: monospace;
    border: 1px solid #334155;
  }
  .mini-socket-pill {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(15, 23, 42, 0.92);
    color: #93c5fd;
    font-size: 0.56rem;
    font-weight: 700;
    padding: 0 3px;
    border-radius: 2px;
    z-index: 3;
  }
</style>
