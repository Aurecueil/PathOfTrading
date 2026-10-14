<!-- src/lib/SearchItemRow.svelte -->
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { PoETradeItemEntry } from "$lib/types/types";
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import type { Item } from "$lib/types/tradeItem";
  import ItemIcon from "$lib/trade/components/item/ItemIcon.svelte";
  import ItemStats from "$lib/trade/components/drawer/ItemStats.svelte";
  import ItemListing from "$lib/trade/components/item/ItemListing.svelte";
  import ItemJsonModal from "$lib/trade/components/item/ItemJsonModal.svelte";

  export let id: string;
  export let data: PoETradeItemEntry | null = null;
  export let sortValue: any = null;
  export let isLive: boolean = false;
  export let realm: string = "poe";
  export let league: string = "";
  export let searchId: string = "";
  export let effectiveStyle: ResolvedDisplayStyle = "full";
  export let tileWidth: number = 600;
  export let tileHeight: number = 400;

  let isTraveling = false;
  let isQueued = false;
  let travelError: string | null = null;
  let isJsonModalOpen = false;

  $: item = data?.item as Item | undefined;
  $: listing = data?.listing;

  function getRarityBorderClass(it?: Item): string {
    if (!it) return "rarity-border-default";
    const rarity = (it.rarity || "").toLowerCase();
    if (rarity) return `rarity-border-${rarity}`;
    switch (it.frameType) {
      case 0:
        return "rarity-border-normal";
      case 1:
        return "rarity-border-magic";
      case 2:
        return "rarity-border-rare";
      case 3:
        return "rarity-border-unique";
      case 4:
        return "rarity-border-gem";
      case 5:
        return "rarity-border-currency";
      default:
        return "rarity-border-rare";
    }
  }

  async function handleTravel() {
    if (!listing || isTraveling) return;
    const token = listing.hideout_token ?? listing.whisper_token;
    if (!token) {
      travelError = "No hideout token";
      return;
    }

    isTraveling = true;
    travelError = null;
    try {
      await invoke("whisper", {
        token,
        realm,
        league,
        searchId,
      });
    } catch (err: any) {
      travelError = typeof err === "string" ? err : err?.message || "Failed";
    } finally {
      isTraveling = false;
    }
  }
</script>

{#if !data || !item}
  <div class="item-row skeleton-row mode-{effectiveStyle}">
    {#if effectiveStyle !== "compact"}
      <div class="skel-icon"></div>
    {/if}
    <div class="skel-content">
      <div class="skel-line title"></div>
      {#if effectiveStyle !== "minimal"}
        <div class="skel-line sub"></div>
        <div class="skel-line mod"></div>
      {/if}
    </div>
    <div class="skel-listing">
      <div class="skel-line price"></div>
    </div>
  </div>
{:else}
  <div
    class="item-row mode-{effectiveStyle} {getRarityBorderClass(item)}"
    class:is-live-entry={isLive}
    data-item-id={id}
  >
    <!-- Small Top-Right Raw JSON Button -->
    <button
      type="button"
      class="btn-top-json"
      title="View full raw JSON received for this item"
      on:click|stopPropagation={() => (isJsonModalOpen = true)}
    >
      &#123;&nbsp;&#125;
    </button>

    <!-- Left: Vertically Centered Icon (Full & Minimal modes only; hidden in Compact) -->
    {#if effectiveStyle !== "compact"}
      <div class="col-icon">
        <ItemIcon {item} styleMode={effectiveStyle} />
      </div>
    {/if}

    <!-- Center: Stats & Modifiers -->
    <div class="col-stats">
      <ItemStats {item} {realm} styleMode={effectiveStyle} {tileWidth} />
    </div>

    <!-- Right / Bottom: Listing & Trade Actions -->
    <div class="col-listing">
      <ItemListing
        {listing}
        {sortValue}
        {isTraveling}
        {isQueued}
        {travelError}
        {league}
        {searchId}
        styleMode={effectiveStyle}
        onTravel={handleTravel}
      />
    </div>
  </div>

  <ItemJsonModal
    isOpen={isJsonModalOpen}
    rawData={data}
    title="{item.name ? `${item.name} ` : ''}{item.typeLine ||
      item.baseType} ({id.slice(0, 8)})"
    onClose={() => (isJsonModalOpen = false)}
  />
{/if}

<style>
  .item-row {
    position: relative;
    display: grid;
    background: #10141d;
    border-top: 1px solid #22293a;
    border-right: 1px solid #22293a;
    border-bottom: 1px solid #22293a;
    border-left: 3px solid #334155;
    border-radius: 6px;
    transition:
      background 0.15s ease,
      border-top-color 0.15s ease,
      border-right-color 0.15s ease,
      border-bottom-color 0.15s ease;
    overflow: hidden;
  }

  /* Hover preserves border-left-color (rarity bar) */
  .item-row:hover {
    background: #141926;
    border-top-color: #334155;
    border-right-color: #334155;
    border-bottom-color: #334155;
  }

  /* Rarity Left Border Accents */
  .rarity-border-normal {
    border-left-color: #94a3b8;
  }
  .rarity-border-magic {
    border-left-color: #6366f1;
  }
  .rarity-border-rare {
    border-left-color: #eab308;
  }
  .rarity-border-unique {
    border-left-color: #ea580c;
  }
  .rarity-border-gem {
    border-left-color: #14b8a6;
  }
  .rarity-border-currency {
    border-left-color: #d6b676;
  }

  /* Small Top-Right JSON Button */
  .btn-top-json {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 15;
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid #263044;
    color: #64748b;
    font-size: 0.6rem;
    font-family: ui-monospace, monospace;
    font-weight: 700;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-top-json:hover {
    background: #1e293b;
    color: #38bdf8;
    border-color: #38bdf8;
  }

  /* Live entry subtle flash */
  .item-row.is-live-entry {
    animation: liveFlash 2s ease-out;
  }
  @keyframes liveFlash {
    0% {
      background: rgba(239, 68, 68, 0.22);
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.35);
    }
    100% {
      background: #10141d;
      box-shadow: none;
    }
  }

  /* FULL MODE LAYOUT */
  .item-row.mode-full {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.75rem;
    padding: 0.65rem;
    align-items: center;
  }

  /* COMPACT MODE LAYOUT (No separate image column) */
  .item-row.mode-compact {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
    padding: 0.45rem 0.55rem;
    align-items: center;
  }

  /* MINIMAL MODE LAYOUT */
  .item-row.mode-minimal {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.5rem;
    padding: 0.3rem 1.8rem 0.3rem 0.45rem;
    align-items: center;
    min-height: 52px;
  }

  @container tile-body (max-width: 470px) {
    .item-row.mode-full {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .item-row.mode-compact {
      grid-template-columns: minmax(0, 1fr);
    }
    .item-row.mode-full .col-listing,
    .item-row.mode-compact .col-listing {
      grid-column: 1 / -1;
      border-top: 1px solid #1e2536;
      padding-top: 0.4rem;
    }
  }

  .col-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: center;
  }

  .col-stats {
    min-width: 0;
    width: 100%;
  }

  .col-listing {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }

  /* Skeletons */
  .skeleton-row {
    pointer-events: none;
  }
  .skel-icon,
  .skel-line {
    background: linear-gradient(90deg, #171d2b 25%, #222b3d 50%, #171d2b 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite linear;
    border-radius: 4px;
  }
  .mode-full .skel-icon {
    width: 92px;
    height: 140px;
  }
  .mode-minimal .skel-icon {
    width: 44px;
    height: 44px;
  }
  .skel-content {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
  }
  .skel-line.title {
    height: 14px;
    width: 65%;
  }
  .skel-line.sub {
    height: 10px;
    width: 40%;
  }
  .skel-line.mod {
    height: 10px;
    width: 85%;
  }
  .skel-line.price {
    height: 22px;
    width: 70px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
