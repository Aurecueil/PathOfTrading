<!-- src/lib/components/item/ItemIcon.svelte -->
<script lang="ts">
  import type { Item } from "$lib/types/item";
  import ItemSockets from "./ItemSockets.svelte";
  import CdnImage from "$lib/trade/componenets/item/CdnImage.svelte";

  export let item: Item;
</script>

<div class="item-icon-wrapper" style="--w: {item.w || 2}; --h: {item.h || 2}">
  {#if item.icon}
    <CdnImage
      src={item.icon}
      alt={item.typeLine || item.name}
      className="item-icon"
      loading="lazy"
    />
  {/if}

  {#if item.sockets && item.sockets.length > 0}
    <ItemSockets sockets={item.sockets} />
  {/if}

  {#if item.stackSize}
    <span class="stack-badge">
      {item.stackSize}{item.maxStackSize ? `/${item.maxStackSize}` : ""}
    </span>
  {/if}
</div>

<style>
  .item-icon-wrapper {
    position: relative;
    width: 84px;
    height: 136px;
    background: radial-gradient(circle at center, #171b26 0%, #080a0f 100%);
    border: 1px solid #232938;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  :global(.item-icon-wrapper .item-icon) {
    max-width: 95%;
    max-height: 95%;
    object-fit: contain;
    z-index: 1;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
  }

  .stack-badge {
    position: absolute;
    bottom: 3px;
    right: 4px;
    background: rgba(0, 0, 0, 0.85);
    color: #e2e8f0;
    font-size: 0.65rem;
    padding: 1px 4px;
    border-radius: 2px;
    z-index: 3;
    font-family: monospace;
    border: 1px solid #334155;
  }
</style>
