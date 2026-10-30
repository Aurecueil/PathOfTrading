<!-- src/lib/searchTile/SearchItemRow.svelte -->
<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import type {
    ResolvedDisplayStyle,
    TileDisplayOptions,
  } from "$lib/types/types";
  import type { Item, TradeFetchResult } from "$lib/types/tradeItem";
  import ItemIcon from "$lib/trade/components/item/ItemIcon.svelte";
  import ItemStats from "$lib/trade/components/item/ItemStats.svelte";
  import ItemListing from "$lib/trade/components/item/ItemListing.svelte";
  import ItemJsonModal from "$lib/trade/components/item/ItemJsonModal.svelte";
  import ItemTitleBar from "$lib/trade/components/item/ItemTitleBar.svelte";
  import { getCategorySymbols } from "$lib/trade/components/item/categorySymbols";
  import { extractSortValue } from "$lib/trade/components/item/sortValue";
  import { convertCurrency } from "$lib/trade/pricing";

  export let displayCurrency: string = "chaos";
  export let displayOptions: Partial<TileDisplayOptions> | null = null;
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
  export let tpTraveling: boolean = false;
  export let tpQueued: boolean = false;
  export let tpVisited: boolean = false;
  export let tpError: string | null = null;

  $: effectiveTraveling = isTraveling || tpTraveling;
  $: effectiveQueued = isQueued || tpQueued;
  $: effectiveTravelError = travelError ?? tpError;

  const dispatch = createEventDispatcher<{
    sortvalue: { id: string; value: any };
  }>();

  let isTraveling = false;
  let isQueued = false;
  let travelError: string | null = null;
  let isJsonModalOpen = false;
  let isCopied = false;
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;
  let rowWidth: number = 0;
  let titleWrapEl: HTMLDivElement | null = null;
  let statsEl: HTMLDivElement | null = null;
  let titleInsetLeft = 10;
  let titleInsetRight = 10;
  let lastDispatchedSortKey: string | null = null;

  onDestroy(() => {
    if (copyTimeout) clearTimeout(copyTimeout);
  });

  function decodeExtendedText(encoded: string): string {
    try {
      const binString = atob(encoded.trim());
      const bytes = Uint8Array.from(binString, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return encoded;
    }
  }

  async function handleCopyText() {
    const rawText = item?.extended?.text;
    if (!rawText) return;

    try {
      const decoded = decodeExtendedText(rawText);
      await navigator.clipboard.writeText(decoded);
      isCopied = true;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        isCopied = false;
      }, 1500);
    } catch (err) {
      console.error("Failed to copy item text:", err);
    }
  }

  /**
   * Pads the title bar so the title is centered on the stats column
   * (not on the whole row). Uses offset* so canvas zoom doesn't skew it.
   */
  function measureTitleInsets() {
    if (!titleWrapEl || !statsEl) return;
    const wrapLeft = titleWrapEl.offsetLeft;
    const wrapRight = wrapLeft + titleWrapEl.offsetWidth;
    const statsLeft = statsEl.offsetLeft;
    const statsRight = statsLeft + statsEl.offsetWidth;
    titleInsetLeft = Math.max(10, statsLeft - wrapLeft);
    titleInsetRight = Math.max(10, wrapRight - statsRight);
  }

  function watchSize(node: HTMLElement) {
    const ro = new ResizeObserver(() => measureTitleInsets());
    ro.observe(node);
    return {
      destroy() {
        ro.disconnect();
      },
    };
  }

  $: boxWidth = rowWidth > 0 ? rowWidth : tileWidth;
  $: resolvedStyle = ((): ResolvedDisplayStyle => {
    if (boxWidth < 520) return "minimal";
    if (boxWidth < 720) return "compact";
    return "full";
  })();

  $: item = data?.item as Item | undefined;
  $: listing = data?.listing;
  $: isMercenaryWarrant =
    item?.baseType === "Mercenary Warrant" ||
    item?.typeLine === "Mercenary Warrant";

  $: mercenaryName = isMercenaryWarrant
    ? (item?.properties?.[0]?.values?.[0]?.[0] ?? "")
    : "";

  $: fullItemTitle = item
    ? isMercenaryWarrant && mercenaryName
      ? mercenaryName
      : [item.name, item.typeLine || item.baseType].filter(Boolean).join(" ")
    : "";

  // Also strip the first property from the item passed to <ItemStats> if you don't want
  // "Draxia, the Misanthrope" duplicated inside the properties list:
  $: displayItem =
    item && isMercenaryWarrant && mercenaryName && item.properties?.length
      ? {
          ...item,
          name: mercenaryName,
          properties: item.properties.slice(1),
        }
      : item;
  /* ------------------------------------------------------------------ */
  /* Sort value: the whole field the payload sorts by, passed to the parent */
  /* ------------------------------------------------------------------ */
  const CONVERT_FAILED = -9;
  $: targetCurrency = displayCurrency || "chaos";

  $: gameRealm =
    (item?.realm || realm || "").toLowerCase() === "poe2"
      ? ("poe2" as const)
      : ("poe" as const);

  // Price expressed in the tile's display currency, or null when it can't be converted
  $: priceInTarget = ((): number | null => {
    const p = listing?.price;
    if (!p || typeof p.amount !== "number" || !p.currency) return null;
    if (p.currency === targetCurrency) return p.amount;
    try {
      const v = convertCurrency(
        p.amount,
        p.currency,
        targetCurrency,
        league,
        gameRealm,
      );
      return Number.isFinite(v) && v !== CONVERT_FAILED ? v : null;
    } catch {
      return null;
    }
  })();

  // Only show the "(X currency)" line when the listing isn't already in that currency
  $: displayConvertedPrice =
    listing?.price?.currency !== targetCurrency ? priceInTarget : null;

  /* Sort value */
  $: sortField = (() => {
    const s = payload?.sort;
    if (!s || typeof s !== "object") return "price";
    return Object.keys(s)[0] ?? "price";
  })();
  $: isPriceSort = sortField === "price";

  // Whole field value, untouched (price -> { amount, currency, type })
  $: computedSortValue = data ? extractSortValue(data, payload) : null;

  $: effectiveSortValue = (() => {
    if (isPriceSort) {
      // converted chaos value if possible, else the raw amount
      const raw = computedSortValue?.amount ?? listing?.price?.amount ?? null;
      return priceInTarget ?? raw;
    }
    return computedSortValue !== null && computedSortValue !== undefined
      ? computedSortValue
      : sortValue;
  })();
  // Dispatch only when the VALUE really changed (compared by content, never
  // by identity), so a parent echoing the value back can't cause a loop.
  function sortKey(v: any): string {
    try {
      return JSON.stringify(v) ?? "undefined";
    } catch {
      return String(v);
    }
  }

  $: if (data) {
    const key = sortKey(effectiveSortValue);
    if (key !== lastDispatchedSortKey) {
      lastDispatchedSortKey = key;
      dispatch("sortvalue", { id, value: effectiveSortValue });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rarity                                                             */
  /* ------------------------------------------------------------------ */
  const KNOWN_KEYS = new Set([
    "normal",
    "magic",
    "rare",
    "unique",
    "gem",
    "currency",
    "divination",
    "quest",
    "prophecy",
    "relic",
    "necropolis",
    "breach",
  ]);

  const FRAME_KEYS: Record<number, string> = {
    0: "normal",
    1: "magic",
    2: "rare",
    3: "unique",
    4: "gem",
    5: "currency",
    6: "divination",
    7: "quest",
    8: "prophecy",
    9: "unique",
    10: "unique",
    11: "necropolis",
    12: "currency",
    13: "breach",
  };

  function getRarityKey(it?: Item): string {
    if (!it) return "default";
    if (it.isRelic) return "relic";
    const frameId = (it.frameTypeId || "").toLowerCase();
    if (KNOWN_KEYS.has(frameId)) return frameId;
    if (it.frameType !== undefined && FRAME_KEYS[it.frameType]) {
      return FRAME_KEYS[it.frameType];
    }
    const rarity = (it.rarity || "").toLowerCase();
    if (KNOWN_KEYS.has(rarity)) return rarity;
    return "rare";
  }

  $: rarityKey = getRarityKey(item);

  /* ------------------------------------------------------------------ */
  /* Category symbols (shown on both sides of the title)                */
  /* ------------------------------------------------------------------ */
  $: isPoe2 = (item?.realm || realm || "").toLowerCase() === "poe2";
  $: symbols = item ? getCategorySymbols(item, isPoe2) : [];

  /* ------------------------------------------------------------------ */
  /* Travel / Whisper & Error Extraction                                */
  /* ------------------------------------------------------------------ */
  function parseTravelError(err: any): string {
    if (!err) return "Failed";
    console.log(err);

    if (typeof err === "object") {
      // Check for error code 2 in objects
      if (err.code === 2 || err.error?.code === 2) {
        return "You must be in-game";
      }
      if (typeof err.error?.message === "string") return err.error.message;
      if (typeof err.message === "string") {
        return parseTravelError(err.message);
      }
    }

    if (typeof err === "string") {
      const trimmed = err.trim();
      const jsonStart = trimmed.indexOf("{");
      const jsonEnd = trimmed.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        try {
          const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
          // Check for error code 2 in parsed JSON
          if (parsed?.code === 2 || parsed?.error?.code === 2) {
            return "You must be in-game";
          }
          if (typeof parsed?.error?.message === "string") {
            return parsed.error.message;
          }
          if (typeof parsed?.message === "string") {
            return parsed.message;
          }
        } catch {
          // fall through to raw string
        }
      }
      return trimmed;
    }

    return "Failed";
  }

  async function handleTravel() {
    if (!listing || isTraveling) return;
    const token = listing.hideout_token ?? listing.whisper_token;
    if (!token) {
      travelError = "No token";
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
      travelError = parseTravelError(err);
    } finally {
      isTraveling = false;
    }
  }
</script>

{#if !data || !item}
  <div
    class="item-row skeleton-row mode-{resolvedStyle} r-default"
    data-item-id={id}
    bind:clientWidth={rowWidth}
  >
    {#if resolvedStyle !== "minimal"}
      <div class="skel-title-bar">
        <div class="skel-line title"></div>
      </div>
    {/if}

    {#if resolvedStyle !== "compact"}
      <div class="skel-icon"></div>
    {/if}

    <div class="skel-content">
      {#if resolvedStyle === "minimal"}
        <div class="skel-line title"></div>
      {:else}
        <div class="skel-line sub"></div>
        <div class="skel-line mod"></div>
        <div class="skel-line mod short"></div>
      {/if}
    </div>

    <div class="skel-listing">
      <div class="skel-line price"></div>
      <div class="skel-line btn"></div>
    </div>
  </div>
{:else}
  <div
    class="item-row mode-{resolvedStyle} r-{rarityKey}"
    class:is-live-entry={isLive}
    class:is-tp-visited={tpVisited}
    class:is-corrupted={item.corrupted || item.doubleCorrupted}
    class:is-unidentified={item.identified === false}
    data-item-id={id}
    bind:clientWidth={rowWidth}
  >
    {#if resolvedStyle !== "minimal"}
      <!-- Header: category symbols + "name base type" (action buttons sit under it) -->
      <div class="title-wrap" bind:this={titleWrapEl}>
        <ItemTitleBar
          title={fullItemTitle}
          {symbols}
          insetLeft={titleInsetLeft}
          insetRight={titleInsetRight}
          {boxWidth}
        />
        <div class="top-actions">
          {#if item.extended?.text}
            <button
              type="button"
              class="btn-top-action"
              class:is-copied={isCopied}
              aria-label="Copy item text"
              title="Copy item text"
              on:click|stopPropagation={handleCopyText}
            >
              {#if isCopied}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                  />
                </svg>
              {/if}
            </button>
          {/if}
          <button
            type="button"
            class="btn-top-action"
            aria-label="View raw JSON"
            title="View raw JSON"
            on:click|stopPropagation={() => (isJsonModalOpen = true)}
          >
            &#123;&nbsp;&#125;
          </button>
        </div>
      </div>
    {/if}

    <!-- Left: vertically centered icon (full & minimal only) -->
    {#if resolvedStyle !== "compact"}
      <div class="col-icon">
        <ItemIcon {item} styleMode={resolvedStyle} />
      </div>
    {/if}

    <!-- Center: stats & modifiers -->
    <div
      class="col-stats"
      class:hide-inner-title={resolvedStyle !== "minimal"}
      bind:this={statsEl}
      use:watchSize
    >
      <ItemStats
        {item}
        {realm}
        {displayOptions}
        styleMode={resolvedStyle}
        tileWidth={boxWidth}
      />
    </div>

    <!-- Right / bottom: listing & trade actions -->
    <div class="col-listing">
      <ItemListing
        {listing}
        convertedPrice={displayConvertedPrice}
        convertedCurrency={targetCurrency}
        isTraveling={effectiveTraveling}
        isQueued={effectiveQueued}
        isVisited={tpVisited}
        travelError={effectiveTravelError}
        {realm}
        {league}
        {searchId}
        styleMode={resolvedStyle}
        onTravel={handleTravel}
      />
    </div>
  </div>

  <ItemJsonModal
    isOpen={isJsonModalOpen}
    rawData={data}
    title="{fullItemTitle} ({id.slice(0, 8)})"
    onClose={() => (isJsonModalOpen = false)}
  />
{/if}

<style>
  /* ---------------------------------------------------------------- */
  /* Rarity tokens: every child component can read --rc / --rc-rgb    */
  /* ---------------------------------------------------------------- */
  .r-default {
    --rc: #7f7f7f;
    --rc-rgb: 127, 127, 127;
  }
  .r-normal {
    --rc: #c8c8c8;
    --rc-rgb: 200, 200, 200;
  }
  .r-magic {
    --rc: #8888ff;
    --rc-rgb: 136, 136, 255;
  }
  .r-rare {
    --rc: #ffff77;
    --rc-rgb: 255, 255, 119;
  }
  .r-unique {
    --rc: #af6025;
    --rc-rgb: 175, 96, 37;
  }
  .r-gem {
    --rc: #1ba29b;
    --rc-rgb: 27, 162, 155;
  }
  .r-currency {
    --rc: #aa9e82;
    --rc-rgb: 170, 158, 130;
  }
  .r-divination {
    --rc: #0ebaff;
    --rc-rgb: 14, 186, 255;
  }
  .r-quest {
    --rc: #4ae63a;
    --rc-rgb: 74, 230, 58;
  }
  .r-prophecy {
    --rc: #b54bff;
    --rc-rgb: 181, 75, 255;
  }
  .r-relic {
    --rc: #82ad6a;
    --rc-rgb: 130, 173, 106;
  }
  .r-necropolis {
    --rc: #dbcfad;
    --rc-rgb: 219, 207, 173;
  }
  .r-breach {
    --rc: #a3849a;
    --rc-rgb: 163, 132, 154;
  }

  /* ---------------------------------------------------------------- */
  /* Row shell                                                        */
  /* ---------------------------------------------------------------- */
  .item-row {
    position: relative;
    display: grid;
    box-sizing: border-box;
    background: linear-gradient(
        90deg,
        rgba(var(--rc-rgb), 0.07),
        transparent 38%
      ),
      #06080b;
    border: 1px solid #262626;
    border-left: 3px solid var(--rc);
    border-radius: 0;
    color: #c8c8c8;
    font-family: "FontinRegular", "Fontin", "Palatino Linotype", Georgia, serif;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.12s ease;
    overflow: hidden;
  }

  .item-row:hover {
    background: linear-gradient(
        90deg,
        rgba(var(--rc-rgb), 0.12),
        transparent 45%
      ),
      #0a0d12;
    border-top-color: rgba(var(--rc-rgb), 0.55);
    border-right-color: rgba(var(--rc-rgb), 0.55);
    border-bottom-color: rgba(var(--rc-rgb), 0.55);
  }

  .item-row.is-corrupted {
    box-shadow: inset 0 0 0 1px rgba(210, 0, 0, 0.28);
  }
  .item-row.is-unidentified {
    box-shadow: inset 0 0 0 1px rgba(210, 0, 0, 0.18);
  }

  /* ---------------------------------------------------------------- */
  /* Title wrapper (the bar itself lives in ItemTitleBar)             */
  /* ---------------------------------------------------------------- */
  .title-wrap {
    grid-column: 1 / -1;
    position: relative;
    min-width: 0;
    contain: inline-size; /* long titles must not widen the tile */
  }

  /* ---------------------------------------------------------------- */
  /* Top action buttons (Copy text & Raw JSON)                        */
  /* ---------------------------------------------------------------- */
  .top-actions {
    position: absolute;
    top: calc(100% + 4px);
    right: 4px;
    z-index: 15;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-top-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.45;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #3a3a3a;
    border-radius: 0;
    color: #8a8a8a;
    font-size: 11px;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 700;
    line-height: 1;
    padding: 3px 6px;
    min-height: 19px;
    box-sizing: border-box;
    cursor: pointer;
    transition:
      opacity 0.1s ease,
      border-color 0.1s ease,
      color 0.1s ease,
      background-color 0.1s ease;
  }

  .btn-top-action svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .btn-top-action:hover,
  .btn-top-action:focus-visible {
    opacity: 1;
    border-color: var(--rc);
    color: #fff;
    background: rgba(var(--rc-rgb), 0.18);
    outline: none;
  }

  .btn-top-action.is-copied {
    opacity: 1;
    border-color: #4ae63a;
    color: #4ae63a;
    background: rgba(74, 230, 58, 0.14);
  }

  /* ---------------------------------------------------------------- */
  /* Column pieces                                                    */
  /* ---------------------------------------------------------------- */
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

  .col-listing {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }

  /* ---------------------------------------------------------------- */
  /* Live entry flash                                                 */
  /* ---------------------------------------------------------------- */
  .item-row.is-live-entry {
    animation: liveFlash 2s ease-out;
  }
  @keyframes liveFlash {
    0% {
      background-color: rgba(239, 68, 68, 0.25);
      box-shadow: inset 0 0 14px rgba(239, 68, 68, 0.4);
    }
    100% {
      box-shadow: none;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Layout modes                                                     */
  /* ---------------------------------------------------------------- */
  .item-row.mode-full {
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 0.85rem;
    row-gap: 0.45rem;
    padding: 0 0.7rem 0.65rem;
    align-items: center;
  }
  .item-row.mode-full .title-wrap {
    margin: 0 -0.7rem;
  }
  .item-row.mode-full .col-listing {
    padding-left: 0.85rem;
    border-left: 1px solid rgba(255, 255, 255, 0.07);
    align-self: stretch;
  }

  .item-row.mode-compact {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 0.35rem;
    padding: 0 0.6rem 0.5rem;
    align-items: center;
  }
  .item-row.mode-compact .title-wrap {
    margin: 0 -0.6rem;
  }
  .item-row.mode-compact .col-listing {
    grid-column: 1 / -1;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 0.4rem;
    justify-content: space-between;
  }

  /* Minimal: no title bar / JSON button, so the travel button can sit
     close to the right edge. */
  .item-row.mode-minimal {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.55rem;
    padding: 0.3rem 0.35rem 0.3rem 0.5rem;
    align-items: center;
    min-height: 54px;
  }

  /* ---------------------------------------------------------------- */
  /* Skeleton                                                         */
  /* ---------------------------------------------------------------- */
  .skeleton-row {
    pointer-events: none;
  }
  .skel-title-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    background: linear-gradient(
      90deg,
      rgba(var(--rc-rgb), 0.24) 0%,
      rgba(var(--rc-rgb), 0.07) 55%,
      rgba(0, 0, 0, 0.55) 100%
    );
    border-bottom: 1px solid rgba(var(--rc-rgb), 0.38);
  }
  .skel-icon,
  .skel-line {
    background: linear-gradient(90deg, #0b0e13 25%, #1b2029 50%, #0b0e13 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite linear;
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
    gap: 0.45rem;
    width: 100%;
  }
  .skel-listing {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: center;
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
  .skel-line.mod.short {
    width: 65%;
  }
  .skel-line.price {
    height: 22px;
    width: 90px;
  }
  .skel-line.btn {
    height: 26px;
    width: 120px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .item-row.is-live-entry,
    .skel-icon,
    .skel-line {
      animation: none;
    }
  }
</style>
