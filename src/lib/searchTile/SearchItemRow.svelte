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
  import ExtendedStatsRow from "$lib/trade/components/item/stats/ExtendedStatsRow.svelte";
  import { buildExtendedCells } from "$lib/trade/components/item/stats/propertyGroups";
  import { separatorCssVars } from "$lib/trade/components/item/separators";
  import { getCategorySymbols } from "$lib/trade/components/item/categorySymbols";
  import { extractSortValue } from "$lib/trade/components/item/sortValue";
  import { convertCurrency, pricingRevision } from "$lib/trade/pricing";
  import type { Realm } from "$lib/types/leagues";
  import {
    DEFAULT_STYLE,
    styleToCssVars,
    buildItemVisuals,
  } from "$lib/trade/components/item/itemStyles";
  import "$lib/trade/components/item/foilTitle.css";
  import { getBaseTypeLabel } from "$lib/trade/components/item/stats/statsUtils";
  import { doubleTitle, styleType } from "$lib/trade/tradeStore";

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
  export let gone: boolean = false;
  $: isGone = gone || data?.gone === true;
  export let onRefresh: ((realId: string) => Promise<void>) | null = null;
  let isRefreshing = false;

  const dispatch = createEventDispatcher<{
    sortvalue: { id: string; value: any };
    gone: { id: string };
  }>();

  async function handleRefresh() {
    if (isRefreshing || !onRefresh || !data?.id) return;
    isRefreshing = true;
    travelError = null;
    try {
      await onRefresh(data.id);
    } catch (err) {
      console.error("Failed to refresh item:", err);
    } finally {
      isRefreshing = false;
    }
  }

  function parseErrorObject(err: any): any | null {
    if (err && typeof err === "object") return err;
    if (typeof err === "string") {
      const s = err.indexOf("{");
      const e = err.lastIndexOf("}");
      if (s !== -1 && e > s) {
        try {
          return JSON.parse(err.slice(s, e + 1));
        } catch {
          /* not json */
        }
      }
    }
    return null;
  }

  function isItemGoneError(err: any): boolean {
    const o = parseErrorObject(err);
    const code = o?.error?.code ?? o?.code;
    if (code === 1) return true;
    const msg =
      o?.error?.message ?? o?.message ?? (typeof err === "string" ? err : "");
    return /item no longer available/i.test(String(msg));
  }

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

  const MINIMAL_BELOW = 440;
  const COMPACT_BELOW = 880;
  const HYSTERESIS = 12;
  let prevStyle: ResolvedDisplayStyle = "full";

  function pickStyle(w: number): ResolvedDisplayStyle {
    const minLimit =
      MINIMAL_BELOW + (prevStyle === "minimal" ? HYSTERESIS : -HYSTERESIS);
    const cmpLimit =
      COMPACT_BELOW + (prevStyle === "compact" ? HYSTERESIS : -HYSTERESIS);
    prevStyle = w < minLimit ? "minimal" : w < cmpLimit ? "compact" : "full";
    return prevStyle;
  }

  $: boxWidth = rowWidth > 0 ? rowWidth : tileWidth;
  $: resolvedStyle = pickStyle(boxWidth);
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
      : getBaseTypeLabel(item)
    : "";
  $: fullItemTitle = [titleName, titleBase].filter(Boolean).join(" ");

  $: useDoubleTitle =
    $doubleTitle && !!titleName && !!titleBase && resolvedStyle !== "minimal";

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
  /* Frame Style, Left Rarity/Frame Tint & Supporter Foil Colors        */
  /* ------------------------------------------------------------------ */

  $: isStyled = $styleType === 1;
  $: visuals = buildItemVisuals(item, realm, $styleType, useDoubleTitle);
  $: styledHeaderBg = isStyled ? visuals.headerBg : "";
  $: symbols = item ? getCategorySymbols(item, visuals.isPoe2) : [];
  $: extendedCells = buildExtendedCells(item?.extended, visuals.isPoe2);

  $: sepVars = separatorCssVars(item?.rarity);
  $: defaultVars = styleToCssVars(DEFAULT_STYLE, 0);
  $: hasExtended = extendedCells.some(Boolean);

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
    if (!listing || isTraveling || isGone) return;
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
      if (isItemGoneError(err)) {
        gone = true;
        travelError = null;
        dispatch("gone", { id: data?.id ?? id });
      } else {
        travelError = parseTravelError(err);
      }
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
    {#if isGone}
      <div class="gone-badge" role="status">No longer available</div>
    {/if}

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
    style="{visuals.styleVars}; {visuals.foilTitleVars} {sepVars}"
    class:style-1={isStyled}
    class:is-gone={isGone}
    class:is-live-entry={isLive}
    class:is-tp-visited={tpVisited}
    class:is-corrupted={visuals.isCorrupted}
    class:is-foil={!!visuals.foilTitleVars}
    class:is-double-title={useDoubleTitle}
    class:is-unidentified={item.identified === false}
    data-item-id={id}
    bind:clientWidth={rowWidth}
  >
    {#if isGone}<div class="gone-badge" role="status">
        No longer available
      </div>{/if}
    {#if resolvedStyle !== "minimal"}
      <div
        class="title-wrap"
        bind:this={titleWrapEl}
        style:margin-inline={$styleType === 1 ? "-1px" : null}
        style:width={$styleType === 1 ? "calc(100% + 2px)" : "calc(100% + 1px)"}
      >
        <ItemTitleBar
          name={titleName}
          baseType={titleBase}
          double={useDoubleTitle}
          {isStyled}
          hasOverlay={!!visuals.foilGradient}
          {styledHeaderBg}
          {symbols}
        />
      </div>
    {/if}

    <div class="row-content mode-{resolvedStyle}">
      {#if tpVisited}
        <span
          class="visited-mark"
          class:has-refresh={resolvedStyle !== "minimal" && !!onRefresh}
          role="img"
          aria-label="Visited"
          title="Visited"
        ></span>
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

      <!-- In compact mode, ExtendedStatsRow renders ABOVE col-listing.
           In full mode, CSS places col-extended on the bottom full-width row below icon/stats/listing. -->
      {#if resolvedStyle !== "minimal" && hasExtended}
        <div class="col-extended">
          <ExtendedStatsRow
            cells={extendedCells}
            compact={resolvedStyle === "compact"}
          />
        </div>
      {/if}

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
          disabled={isGone}
        />
      </div>

      {#if resolvedStyle !== "minimal"}
        {#if onRefresh && data}
          <div class="top-actions-left">
            <button
              type="button"
              class="btn-refresh"
              class:is-refreshing={isRefreshing}
              disabled={isRefreshing}
              on:click|stopPropagation={handleRefresh}
            >
              <span class="refresh-icon"></span>
            </button>
          </div>
        {/if}
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
      {/if}
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
  @font-face {
    font-family: "FontinRegular";
    src: url("/static/fontin-regular-webfont.woff") format("woff");
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  /* ---------------------------------------------------------------- */
  /* Row shell & Left/Right Gradient Tints                            */
  /* ---------------------------------------------------------------- */
  .item-row {
    --row-base-bg: #06080b;
    --left-stop: 42%;
    --right-stop: 42%;
    --item-border-color: color-mix(in srgb, var(--rc) 50%, transparent);

    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    font-family: "FontinRegular", Georgia, serif;
    font-weight: 400;
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
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.12s ease,
      opacity 0.15s ease;
  }

  .item-row :global(*) {
    font-family: "FontinRegular", Georgia, serif;
  }

  /* No bold text anywhere in row content except minimal title */
  .row-content:not(.mode-minimal) :global(*) {
    font-weight: 400 !important;
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
    border-left: 1px solid var(--item-border-color);
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

  /* Supporter Foil Title Colors:
     - 1 line: 1st color of gradient
     - 2 lines (doubleTitle): 1st color for name (row 1), 2nd color for baseType (row 2) */
  .item-row.is-foil:not(.is-double-title) .title-wrap :global(*) {
    color: var(--foil-c1, var(--rc)) !important;
  }
  .item-row.is-foil.is-double-title .title-wrap :global(.title-name),
  .item-row.is-foil.is-double-title .title-wrap :global(.name),
  .item-row.is-foil.is-double-title .title-wrap :global(.line-1),
  .item-row.is-foil.is-double-title .title-wrap :global(.row-1),
  .item-row.is-foil.is-double-title
    .title-wrap
    :global(:is(div, span, h1, h2, h3, p):first-of-type),
  .item-row.is-foil.is-double-title
    .title-wrap
    :global(:is(div, span, h1, h2, h3, p):first-of-type *) {
    color: var(--foil-c1, var(--rc)) !important;
  }
  .item-row.is-foil.is-double-title .title-wrap :global(.title-base),
  .item-row.is-foil.is-double-title .title-wrap :global(.base),
  .item-row.is-foil.is-double-title .title-wrap :global(.base-type),
  .item-row.is-foil.is-double-title .title-wrap :global(.line-2),
  .item-row.is-foil.is-double-title .title-wrap :global(.row-2),
  .item-row.is-foil.is-double-title
    .title-wrap
    :global(:is(div, span, h1, h2, h3, p):nth-of-type(2)),
  .item-row.is-foil.is-double-title
    .title-wrap
    :global(:is(div, span, h1, h2, h3, p):nth-of-type(2) *) {
    color: var(--foil-c2, var(--rc)) !important;
  }

  /* Minimal mode foil text colors */
  .item-row.mode-minimal.is-foil :global(.minimal-stats > :first-child) {
    color: var(--foil-c1, inherit) !important;
  }
  .item-row.mode-minimal.is-foil :global(.minimal-stats > :nth-child(2)) {
    color: var(--foil-c2, inherit) !important;
  }

  .item-row.is-unidentified {
    box-shadow: inset 0 0 0 1px rgba(210, 0, 0, 0.24);
  }

  /* ---------------------------------------------------------------- */
  /* Title wrapper (Edge-to-Edge)                                     */
  /* ---------------------------------------------------------------- */
  .title-wrap {
    position: relative;
    z-index: 2;
    min-width: 0;
    contain: inline-size;
    background: var(--row-base-bg);
    margin-top: -1px;
    height: calc(100% + 1px);
  }

  /* ---------------------------------------------------------------- */
  /* Row Content Body & Extended Stats Ordering                       */
  /* ---------------------------------------------------------------- */
  .row-content {
    position: relative;
    display: grid;
    box-sizing: border-box;
    width: 100%;
  }

  .row-content.mode-full {
    --icon-w: 168px;
    --listing-w: calc(168px + 0.85rem + 1px);
    grid-template-columns: var(--icon-w) minmax(0, 1fr) var(--listing-w);

    --row-pad-x: 0.7rem;
    column-gap: 0.85rem;
    row-gap: 0.5rem;
    padding: 0.65rem var(--row-pad-x) 0.5rem;
    align-items: center;
  }

  .row-content.mode-full .col-icon {
    grid-column: 1;
    grid-row: 1;
    justify-content: center;
  }
  .row-content.mode-full .col-stats {
    grid-column: 2;
    grid-row: 1;
  }
  .row-content.mode-full .col-listing {
    grid-column: 3;
    grid-row: 1;
    justify-content: center;
  }
  .row-content.mode-full .col-extended {
    grid-column: 1 / -1;
    grid-row: 2;
    padding-top: 0.35rem;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .row-content.mode-compact {
    --row-pad-x: 0.6rem;
    grid-template-columns: minmax(0, 1fr);
    row-gap: 0.4rem;
    padding: 0.5rem var(--row-pad-x);
    align-items: center;
  }

  .row-content.mode-compact .col-extended {
    grid-column: 1 / -1;
    padding-top: 0.3rem;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .row-content.mode-compact .col-listing {
    grid-column: 1 / -1;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding-top: 0.4rem;
    justify-content: space-between;
  }

  .row-content.mode-minimal {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.55rem;
    padding: 0.3rem 0.35rem 0.3rem 0.55rem;
    align-items: center;
    min-height: 54px;
  }

  .top-actions {
    position: absolute;
    top: 4px;
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
    opacity: 0.4;
    background: rgba(6, 8, 11, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #b8b8b8;
    font-size: 10px;
    font-weight: 400;
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
    overflow-wrap: anywhere;
  }

  .col-extended {
    width: 100%;
    min-width: 0;
  }

  .col-listing {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }

  /* ---------------------------------------------------------------- */
  /* Skeleton                                                         */
  /* ---------------------------------------------------------------- */
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

  .item-row.is-gone .title-wrap,
  .item-row.is-gone .row-content {
    opacity: 0.38;
    filter: saturate(0.3);
  }
  .item-row.is-gone .col-listing {
    pointer-events: none;
  }
  .gone-badge {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 20;
    transform: translate(-50%, -50%) rotate(-5deg);
    padding: 0.2rem 0.8rem;
    font-size: 0.95rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    white-space: nowrap;
    color: #ff7b7b;
    background: rgba(20, 4, 4, 0.88);
    border: 1px solid rgba(210, 0, 0, 0.7);
    pointer-events: none;
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
  .top-actions-left {
    position: absolute;
    top: 3px;
    left: 3px;
    z-index: 15;
    display: flex;
  }
  .btn-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 2px 4px;
    border: none;
    background: none;
    color: #b8b8b8;
    opacity: 0.4;
    cursor: pointer;
    transition:
      opacity 0.12s ease,
      color 0.12s ease;
  }
  .item-row:hover .btn-refresh {
    opacity: 0.72;
  }
  .btn-refresh:hover:not(:disabled),
  .btn-refresh:focus-visible {
    opacity: 1;
    color: #fff;
    outline: none;
  }
  .btn-refresh:disabled {
    cursor: default;
  }
  .refresh-icon {
    width: 26px;
    height: 26px;
    background-color: currentColor;
    -webkit-mask: url("/static/refresh.svg") center / contain no-repeat;
    mask: url("/static/refresh.svg") center / contain no-repeat;
  }

  .btn-refresh.is-refreshing .refresh-icon {
    animation: refresh-spin 1s linear infinite;
  }
  .visited-mark {
    position: absolute;
    top: 5px;
    left: 5px;
    z-index: 15;
    width: 14px;
    height: 14px;
    pointer-events: none;
    background-color: #4ae63a;
    opacity: 0.8;
    -webkit-mask: url("/static/check.svg") center / contain no-repeat;
    mask: url("/static/check.svg") center / contain no-repeat;
  }
  .visited-mark.has-refresh {
    left: 32px; /* sits right of the 26px refresh button */
  }
  @keyframes refresh-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn-refresh.is-refreshing .refresh-icon {
      animation-duration: 3s;
    }
  }
</style>
