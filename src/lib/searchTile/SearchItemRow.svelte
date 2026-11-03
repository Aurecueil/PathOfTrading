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
  import { convertCurrency, pricingRevision } from "$lib/trade/pricing";
  import type { Realm } from "$lib/types/leagues";
  import {
    DEFAULT_STYLE,
    getFoilGradient,
    getStyledHeaderBg,
    isRunicFrame,
    resolveItemStyle,
    styleToCssVars,
  } from "$lib/trade/components/item/itemStyles";

  export let displayCurrency: string = "chaos";
  export let displayOptions: Partial<TileDisplayOptions> | null = null;
  export let id: string;
  export let payload: any = null;
  export let league: string = "";
  export let data: TradeFetchResult | null = null;
  export let sortValue: any = null;
  export let isLive: boolean = false;
  export let realm: Realm = "pc";
  export let searchId: string = "";
  export let effectiveStyle: ResolvedDisplayStyle = "full";
  export let tileWidth: number = 600;
  export let tileHeight: number = 400;
  export let tpTraveling: boolean = false;
  export let tpQueued: boolean = false;
  export let tpVisited: boolean = false;
  export let tpError: string | null = null;
  export let styleType: number = 0; // 0 | 1
  export let gone: boolean = false;
  export let doubleTitle: boolean = false;

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
  let lastDispatchedKey: string | null = null;

  $: effectiveTraveling = isTraveling || tpTraveling;
  $: effectiveQueued = isQueued || tpQueued;
  $: effectiveTravelError = travelError ?? tpError;

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
    const ro = new ResizeObserver(measureTitleInsets);
    ro.observe(node);
    return {
      destroy: () => ro.disconnect(),
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

  $: titleName = item
    ? isMercenaryWarrant && mercenaryName
      ? mercenaryName
      : (item.name ?? "")
    : "";
  $: titleBase = item
    ? isMercenaryWarrant && mercenaryName
      ? ""
      : item.typeLine || item.baseType || ""
    : "";
  $: fullItemTitle = [titleName, titleBase].filter(Boolean).join(" ");

  $: useDoubleTitle =
    doubleTitle && !!titleName && !!titleBase && resolvedStyle !== "minimal";

  $: displayItem =
    item && isMercenaryWarrant && mercenaryName && item.properties?.length
      ? {
          ...item,
          name: mercenaryName,
          properties: item.properties.slice(1),
        }
      : item;

  /* ------------------------------------------------------------------ */
  /* Pricing & Sort Value                                               */
  /* ------------------------------------------------------------------ */
  const CONVERT_FAILED = -9;
  $: targetCurrency = displayCurrency || "chaos";
  $: gameRealm = item?.realm || realm || "pc";

  $: priceInTarget = ((_rev: number): number | null => {
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
  })($pricingRevision);

  $: displayConvertedPrice =
    listing?.price?.currency !== targetCurrency ? priceInTarget : null;

  $: sortField = (() => {
    const s = payload?.sort;
    if (!s || typeof s !== "object") return "price";
    return Object.keys(s)[0] ?? "price";
  })();
  $: isPriceSort = sortField === "price";

  $: effectiveSortValue = ((): number | string | null => {
    if (!data) return null;
    if (isPriceSort) return priceInTarget ?? listing?.price?.amount ?? null;
    return extractSortValue(data, payload) ?? null;
  })();

  function serializeSortKey(idStr: string, v: any): string {
    try {
      return `${idStr}|${JSON.stringify(v) ?? "undefined"}`;
    } catch {
      return `${idStr}|${String(v)}`;
    }
  }

  $: if (data) {
    const key = serializeSortKey(id, effectiveSortValue);
    if (key !== lastDispatchedKey) {
      lastDispatchedKey = key;
      dispatch("sortvalue", { id, value: effectiveSortValue });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rarity & Style Tokens                                              */
  /* ------------------------------------------------------------------ */
  $: frameTypeId = (item as any)?.frameTypeId ?? "";
  $: foilVariation = Number((item as any)?.foilVariation ?? 0);
  $: isPoe2 = (item?.realm || realm || "").toLowerCase() === "poe2";
  $: isStyled = styleType === 1;

  $: itemStyle = resolveItemStyle(frameTypeId);
  $: isCorruptedItem = !!(item?.corrupted || item?.doubleCorrupted);
  $: isRunic = isRunicFrame(frameTypeId);
  $: foilGradient = getFoilGradient(frameTypeId, foilVariation);
  $: styledHeaderBg = isStyled
    ? getStyledHeaderBg(frameTypeId, isPoe2, foilVariation)
    : null;

  $: styleVars = styleToCssVars(itemStyle, styleType, {
    corrupted: isCorruptedItem,
    runic: isRunic,
    foilGradient,
    styledHeaderBg,
  });
  $: defaultVars = styleToCssVars(DEFAULT_STYLE, 0);
  $: symbols = item ? getCategorySymbols(item, isPoe2) : [];

  /* ------------------------------------------------------------------ */
  /* Travel / Whisper & Error Extraction                                */
  /* ------------------------------------------------------------------ */
  function parseTravelError(err: any): string {
    if (!err) return "Failed";

    if (typeof err === "object") {
      if (err.code === 2 || err.error?.code === 2) return "You must be in-game";
      if (typeof err.error?.message === "string") return err.error.message;
      if (typeof err.message === "string") return parseTravelError(err.message);
    }

    if (typeof err === "string") {
      const trimmed = err.trim();
      const jsonStart = trimmed.indexOf("{");
      const jsonEnd = trimmed.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        try {
          const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
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
    class="item-row skeleton-row mode-{resolvedStyle}"
    style={defaultVars}
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
    class="item-row mode-{resolvedStyle}"
    style={styleVars}
    class:style-1={isStyled}
    class:is-gone={gone}
    class:is-live-entry={isLive}
    class:is-tp-visited={tpVisited}
    class:is-corrupted={isCorruptedItem}
    class:is-foil={!!foilGradient}
    class:is-unidentified={item.identified === false}
    data-item-id={id}
    bind:clientWidth={rowWidth}
  >
    {#if resolvedStyle !== "minimal"}
      <div class="title-wrap" bind:this={titleWrapEl}>
        <ItemTitleBar
          name={titleName}
          baseType={titleBase}
          double={useDoubleTitle}
          {isStyled}
          hasOverlay={!!foilGradient}
          {symbols}
          insetLeft={titleInsetLeft}
          insetRight={titleInsetRight}
        >
          <div class="top-actions" slot="actions">
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
        </ItemTitleBar>
      </div>
    {/if}

    {#if resolvedStyle !== "compact"}
      <div class="col-icon">
        <ItemIcon item={displayItem ?? item} styleMode={resolvedStyle} />
      </div>
    {/if}

    <div
      class="col-stats"
      class:hide-inner-title={resolvedStyle !== "minimal"}
      bind:this={statsEl}
      use:watchSize
    >
      <ItemStats
        item={displayItem ?? item}
        {realm}
        {displayOptions}
        styleMode={resolvedStyle}
        tileWidth={boxWidth}
      />
    </div>

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
  /* Row shell & Left/Right Gradient Tints                            */
  /* ---------------------------------------------------------------- */
  .item-row {
    --row-base-bg: #06080b;
    --left-stop: 42%;
    --right-stop: 42%;
    --item-border-color: color-mix(in srgb, var(--rc) 50%, transparent);

    position: relative;
    display: grid;
    box-sizing: border-box;
    background: linear-gradient(
        90deg,
        var(--left-tint),
        transparent var(--left-stop)
      ),
      linear-gradient(270deg, var(--right-tint), transparent var(--right-stop)),
      var(--row-base-bg);
    border: 1px solid var(--item-border-color);
    border-left: 3px solid var(--side-bar-color);
    color: #c8c8c8;
    font-family: "FontinRegular", "Fontin", "Palatino Linotype", Georgia, serif;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.12s ease,
      opacity 0.15s ease;
    overflow: hidden;
  }

  .item-row:hover {
    --row-base-bg: #0a0d12;
    --left-stop: 50%;
    --right-stop: 50%;
    border-color: var(--rc);
    border-left-color: var(--side-bar-color);
  }

  .item-row.style-1 {
    --left-stop: 65%;
    --right-stop: 55%;
    border-left-color: var(--item-border-color);
  }

  .item-row.style-1:hover {
    border-color: var(--rc);
  }

  .item-row.is-tp-visited {
    opacity: 0.72;
  }
  .item-row.is-tp-visited:hover {
    opacity: 0.95;
  }

  .item-row.is-gone {
    opacity: 0.42;
    filter: saturate(0.3);
  }

  /* Supporter Foil in minimal mode: thin foil ribbon along the top edge */
  .item-row.mode-minimal.is-foil {
    background:
      var(--foil-overlay) top / 100% 2px no-repeat,
      linear-gradient(90deg, var(--left-tint), transparent var(--left-stop)),
      linear-gradient(270deg, var(--right-tint), transparent var(--right-stop)),
      var(--row-base-bg);
  }

  .item-row.is-unidentified {
    box-shadow: inset 0 0 0 1px rgba(210, 0, 0, 0.24);
  }

  /* ---------------------------------------------------------------- */
  /* Title wrapper & Docked Header Actions                            */
  /* ---------------------------------------------------------------- */
  .title-wrap {
    grid-column: 1 / -1;
    position: relative;
    min-width: 0;
    contain: inline-size;
    background: var(--row-base-bg);
  }

  .top-actions {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-top-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.4;
    background: rgba(6, 8, 11, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #b8b8b8;
    font-size: 10px;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 700;
    line-height: 1;
    padding: 3px 5px;
    min-height: 18px;
    box-sizing: border-box;
    cursor: pointer;
    transition:
      opacity 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease,
      background-color 0.12s ease;
  }

  .item-row:hover .btn-top-action {
    opacity: 0.72;
  }

  .btn-top-action svg {
    width: 11px;
    height: 11px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .btn-top-action:hover,
  .btn-top-action:focus-visible {
    opacity: 1 !important;
    border-color: var(--rc);
    color: #fff;
    background: rgba(var(--rc-rgb), 0.25);
    outline: none;
  }

  .btn-top-action.is-copied {
    opacity: 1 !important;
    border-color: #4ae63a;
    color: #4ae63a;
    background: rgba(74, 230, 58, 0.16);
  }

  /* ---------------------------------------------------------------- */
  /* Columns                                                          */
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
  /* Layout modes                                                     */
  /* ---------------------------------------------------------------- */
  .item-row.mode-full {
    --row-pad-x: 0.7rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 0.85rem;
    row-gap: 0.5rem;
    padding: 0 var(--row-pad-x) 0.6rem;
    align-items: center;
  }

  .item-row.mode-full .title-wrap,
  .item-row.mode-full .skel-title-bar {
    margin-inline: calc(var(--row-pad-x) * -1);
  }

  .item-row.mode-full .col-listing {
    padding-left: 0.85rem;
    border-left: 1px solid rgba(255, 255, 255, 0.07);
    align-self: stretch;
  }

  .item-row.mode-compact {
    --row-pad-x: 0.6rem;
    grid-template-columns: minmax(0, 1fr);
    row-gap: 0.4rem;
    padding: 0 var(--row-pad-x) 0.5rem;
    align-items: center;
  }

  .item-row.mode-compact .title-wrap,
  .item-row.mode-compact .skel-title-bar {
    margin-inline: calc(var(--row-pad-x) * -1);
  }

  .item-row.mode-compact .col-listing {
    grid-column: 1 / -1;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding-top: 0.4rem;
    justify-content: space-between;
  }

  .item-row.mode-minimal {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.55rem;
    padding: 0.3rem 0.35rem 0.3rem 0.55rem;
    align-items: center;
    min-height: 54px;
  }

  /* ---------------------------------------------------------------- */
  /* Live entry flash & Skeleton                                      */
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

  .skeleton-row {
    pointer-events: none;
  }

  .skel-title-bar {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    background: var(--title-bar-bg);
    border-bottom: 1px solid var(--title-line-color);
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
