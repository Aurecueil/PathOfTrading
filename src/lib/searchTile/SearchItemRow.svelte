<!-- src/lib/searchTile/SearchItemRow.svelte -->
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import type { Item, TradeFetchResult } from "$lib/types/tradeItem";
  import ItemIcon from "$lib/trade/components/item/ItemIcon.svelte";
  import ItemStats from "$lib/trade/components/drawer/ItemStats.svelte";
  import ItemListing from "$lib/trade/components/item/ItemListing.svelte";
  import ItemJsonModal from "$lib/trade/components/item/ItemJsonModal.svelte";
  import CdnImage from "$lib/trade/components/item/CdnImage.svelte";

  export let id: string;
  export let payload: any = null;
  export let league: string = "";
  export let data: TradeFetchResult | null = null;
  export let sortValue: any = null;
  export let isLive: boolean = false;
  export let realm: string = "poe";
  export let searchId: string = "";
  export let effectiveStyle: ResolvedDisplayStyle = "full";
  export let tileWidth: number = 600;
  export let tileHeight: number = 400;

  let isTraveling = false;
  let isQueued = false;
  let travelError: string | null = null;
  let isJsonModalOpen = false;
  let gemSkills: { url: string; item: Item }[] = [];

  $: item = data?.item as Item | undefined;
  $: listing = data?.listing;
  $: fullItemTitle = item
    ? [item.name, item.typeLine || item.baseType].filter(Boolean).join(" ")
    : "";

  function getRarityKey(it?: Item): string {
    if (!it) return "default";
    const rarity = (it.rarity || "").toLowerCase();
    if (rarity) return rarity;
    switch (it.frameType) {
      case 0:
        return "normal";
      case 1:
        return "magic";
      case 2:
        return "rare";
      case 3:
        return "unique";
      case 4:
        return "gem";
      case 5:
        return "currency";
      default:
        return "rare";
    }
  }

  function getRarityBorderClass(it?: Item): string {
    return `rarity-border-${getRarityKey(it)}`;
  }

  function getRarityTextClass(it?: Item): string {
    return `rarity-text-${getRarityKey(it)}`;
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
  <div class="item-row skeleton-row mode-{effectiveStyle}" data-item-id={id}>
    {#if effectiveStyle !== "minimal"}
      <div class="row-title-bar skel-title-bar">
        <div class="skel-line title"></div>
      </div>
    {/if}

    {#if effectiveStyle !== "compact"}
      <div class="skel-icon"></div>
    {/if}

    <div class="skel-content">
      {#if effectiveStyle === "minimal"}
        <div class="skel-line title"></div>
      {:else}
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
    {#if effectiveStyle !== "minimal"}
      <!-- Full-Width Header / Title Bar (Full & Compact modes only) -->
      <div class="row-title-bar {getRarityTextClass(item)}">
        <div class="title-text" title={fullItemTitle}>
          {#if item.name}
            <span class="item-name">{item.name}</span>
          {/if}
          {#if item.typeLine || item.baseType}
            <span class="item-type">{item.typeLine || item.baseType}</span>
          {/if}
        </div>

        <button
          type="button"
          class="btn-top-json"
          title="View full raw JSON received for this item"
          on:click|stopPropagation={() => (isJsonModalOpen = true)}
        >
          &#123;&nbsp;&#125;
        </button>
      </div>
    {:else}
      <!-- Floating Top-Right JSON Button for Minimal Mode -->
      <button
        type="button"
        class="btn-top-json minimal-json"
        title="View full raw JSON received for this item"
        on:click|stopPropagation={() => (isJsonModalOpen = true)}
      >
        &#123;&nbsp;&#125;
      </button>
    {/if}

    <!-- Left: Vertically Centered Icon (Full & Minimal modes only; hidden in Compact) -->
    {#if effectiveStyle !== "compact"}
      <div class="col-icon">
        <ItemIcon
          {item}
          styleMode={effectiveStyle}
          on:gems={(e) => (gemSkills = e.detail)}
        />
      </div>
    {/if}

    <!-- Center: Stats & Modifiers -->
    <div
      class="col-stats"
      class:hide-inner-title={effectiveStyle !== "minimal"}
    >
      <ItemStats {item} {realm} styleMode={effectiveStyle} {tileWidth} />

      {#if gemSkills.length}
        <div class="gem-skills">
          {#each gemSkills as g}
            <CdnImage
              src={g.url}
              alt={g.item.typeLine}
              className="gem-skill"
              loading="lazy"
            />
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right / Bottom: Listing & Trade Actions -->
    <div class="col-listing">
      <ItemListing
        {listing}
        {sortValue}
        {isTraveling}
        {isQueued}
        {travelError}
        {realm}
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
    box-sizing: border-box;
    background-color: #040608;
    border-top: 1px solid #7f7f7f;
    border-right: 1px solid #7f7f7f;
    border-bottom: 1px solid #7f7f7f;
    border-left: 3px solid #7f7f7f;
    border-radius: 0px;
    color: #d3d3d3;
    font-family: "Fontin", monospace, sans-serif;
    transition:
      background-color 0.1s ease,
      border-top-color 0.1s ease,
      border-right-color 0.1s ease,
      border-bottom-color 0.1s ease;
    overflow: hidden;
  }

  /* Hover preserves border-left-color (rarity bar) */
  .item-row:hover {
    background-color: #0a0d12;
    border-top-color: #ffffff;
    border-right-color: #ffffff;
    border-bottom-color: #ffffff;
  }

  /* Rarity Left Border Accents */
  .rarity-border-default {
    border-left-color: #7f7f7f;
  }
  .rarity-border-normal {
    border-left-color: #c8c8c8;
  }
  .rarity-border-magic {
    border-left-color: #8888ff;
  }
  .rarity-border-rare {
    border-left-color: #ffff77;
  }
  .rarity-border-unique {
    border-left-color: #af6025;
  }
  .rarity-border-gem {
    border-left-color: #1ba29b;
  }
  .rarity-border-currency {
    border-left-color: #aa9e82;
  }

  /* Full-Width Header Title Bar (Full & Compact) */
  .row-title-bar {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background-color: #000000;
    border-bottom: 1px solid #2a2a2a;
    padding: 4px 6px 4px 8px;
    min-width: 0;
  }

  .title-text {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 16px;
    line-height: 1.15;
  }

  .item-name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-type {
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Rarity Title Colors */
  .rarity-text-default {
    color: #d3d3d3;
  }
  .rarity-text-normal {
    color: #c8c8c8;
  }
  .rarity-text-magic {
    color: #8888ff;
  }
  .rarity-text-rare {
    color: #ffff77;
  }
  .rarity-text-unique {
    color: #af6025;
  }
  .rarity-text-gem {
    color: #1ba29b;
  }
  .rarity-text-currency {
    color: #aa9e82;
  }

  /* Suppress duplicate internal title inside ItemStats when top bar is active */
  .col-stats.hide-inner-title :global(.item-header),
  .col-stats.hide-inner-title :global(.item-title),
  .col-stats.hide-inner-title :global(.title-row),
  .col-stats.hide-inner-title :global(.header-row),
  .col-stats.hide-inner-title :global(.name-line) {
    display: none !important;
  }

  /* Raw JSON Button */
  .btn-top-json {
    flex-shrink: 0;
    background-color: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #9a9a9a;
    font-size: 11px;
    font-family: "Fontin", monospace, sans-serif;
    font-weight: 700;
    line-height: 1;
    padding: 2px 5px;
    cursor: pointer;
    transition:
      border-color 0.1s ease,
      color 0.1s ease;
  }

  .btn-top-json.minimal-json {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 15;
  }

  .btn-top-json:hover,
  .btn-top-json:focus {
    border-color: #ffffff;
    color: #ffffff;
    outline: none;
  }

  /* Live entry subtle flash */
  .item-row.is-live-entry {
    animation: liveFlash 2s ease-out;
  }
  @keyframes liveFlash {
    0% {
      background-color: rgba(239, 68, 68, 0.25);
      box-shadow: inset 0 0 12px rgba(239, 68, 68, 0.35);
    }
    100% {
      background-color: #040608;
      box-shadow: none;
    }
  }

  /* FULL MODE LAYOUT */
  .item-row.mode-full {
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 0.75rem;
    row-gap: 0.5rem;
    padding: 0 0.65rem 0.65rem 0.65rem;
    align-items: center;
  }
  .item-row.mode-full .row-title-bar {
    margin: 0 -0.65rem;
  }

  /* COMPACT MODE LAYOUT (No separate image column) */
  .item-row.mode-compact {
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 0.5rem;
    row-gap: 0.4rem;
    padding: 0 0.55rem 0.45rem 0.55rem;
    align-items: center;
  }
  .item-row.mode-compact .row-title-bar {
    margin: 0 -0.55rem;
  }

  /* MINIMAL MODE LAYOUT (Inline title, no top bar) */
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
      border-top: 1px solid #2a2a2a;
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
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .gem-skills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
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
  .skel-title-bar {
    padding: 6px 8px;
  }
  .skel-icon,
  .skel-line {
    background: linear-gradient(90deg, #0a0d12 25%, #1a202c 50%, #0a0d12 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite linear;
    border-radius: 0px;
  }
  .mode-full .skel-icon {
    width: 92px;
    height: 120px;
  }
  .mode-minimal .skel-icon {
    width: 40px;
    height: 40px;
  }
  .skel-content {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
  }
  .skel-line.title {
    height: 14px;
    width: 55%;
  }
  .skel-line.sub {
    height: 10px;
    width: 45%;
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
