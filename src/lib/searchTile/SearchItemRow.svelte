<!-- src/lib/searchTile/SearchItemRow.svelte -->
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import type { Item, TradeFetchResult } from "$lib/types/tradeItem";
  import ItemIcon from "$lib/trade/components/item/ItemIcon.svelte";
  import ItemStats from "$lib/trade/components/item/ItemStats.svelte";
  import ItemListing from "$lib/trade/components/item/ItemListing.svelte";
  import ItemJsonModal from "$lib/trade/components/item/ItemJsonModal.svelte";

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
  let rowWidth: number = 0;
  let titleWrapEl: HTMLDivElement | null = null;
  let statsEl: HTMLDivElement | null = null;
  let titleInsetLeft = 10;
  let titleInsetRight = 10;

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
  $: fullItemTitle = item
    ? [item.name, item.typeLine || item.baseType].filter(Boolean).join(" ")
    : "";

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
  /* Category symbols (shown on both sides of the title bar)            */
  /* ------------------------------------------------------------------ */
  const SYM = (file: string) =>
    `https://web.poecdn.com/protected/image/item/${file}`;

  type Sym = {
    key: string;
    label: string;
    url: string;
    test: (it: Item) => boolean;
  };

  const flag = (it: Item, k: string) =>
    Boolean(it.influences?.[k]) ||
    Boolean((it as unknown as Record<string, unknown>)[k]);

  const POE1_SYMBOLS: Sym[] = [
    {
      key: "shaper",
      label: "Shaper",
      url: SYM(
        "popup/shaper-symbol.png?v=1709582916256&key=PQH0ATL4n268OngTnsQ0MQ",
      ),
      test: (i) => flag(i, "shaper"),
    },
    {
      key: "elder",
      label: "Elder",
      url: SYM(
        "popup/elder-symbol.png?v=1709582916256&key=YS6Fsnxyuc8gpqfPz_mykw",
      ),
      test: (i) => flag(i, "elder"),
    },
    {
      key: "crusader",
      label: "Crusader",
      url: SYM(
        "popup/crusader-symbol.png?v=1709582916256&key=dcLGV7cDJf-dulB8P_Q-yQ",
      ),
      test: (i) => flag(i, "crusader"),
    },
    {
      key: "redeemer",
      label: "Redeemer",
      url: SYM(
        "popup/redeemer-symbol.png?v=1709582916256&key=nEc-TPctqwszY696cmlaZQ",
      ),
      test: (i) => flag(i, "redeemer"),
    },
    {
      key: "hunter",
      label: "Hunter",
      url: SYM(
        "popup/hunter-symbol.png?v=1709582916256&key=x7-F-t4jlxzMd1eJOUSafA",
      ),
      test: (i) => flag(i, "hunter"),
    },
    {
      key: "warlord",
      label: "Warlord",
      url: SYM(
        "popup/warlord-symbol.png?v=1709582916256&key=76scs3jk3FrVGOLHdM5AuA",
      ),
      test: (i) => flag(i, "warlord"),
    },
    {
      key: "searing",
      label: "Searing Exarch",
      url: SYM(
        "popup/searing-symbol.png?v=1709582916256&key=iiOWJvWHj8-0bH0e28X7Xw",
      ),
      test: (i) => flag(i, "searing"),
    },
    {
      key: "tangled",
      label: "Eater of Worlds",
      url: SYM(
        "popup/tangled-symbol.png?v=1709582916256&key=b-SVlhPy2jy-UJSTBaV2Cw",
      ),
      test: (i) => flag(i, "tangled"),
    },
    {
      key: "veiled",
      label: "Veiled",
      url: SYM(
        "popup/veiled-symbol.png?v=1709582916256&key=FQrrJgHpP4bo1Im-sOGTcA",
      ),
      test: (i) => Boolean(i.veiled),
    },
    {
      key: "fractured",
      label: "Fractured",
      url: SYM(
        "popup/fractured-symbol.png?v=1709582916256&key=fM_bl3SW2hozdEIw5vh4GA",
      ),
      test: (i) => Boolean(i.fractured),
    },
    {
      key: "synthetic",
      label: "Synthesised",
      url: SYM(
        "popup/synthetic-symbol.png?v=1709582916256&key=CUVu3Zqxrzd1CwWcIH-6xg",
      ),
      test: (i) => Boolean(i.synthesised),
    },
    {
      key: "replica",
      label: "Replica",
      url: SYM(
        "popup/experimented-symbol.png?v=1709582916256&key=dWh87tRCnnyVEMYjjf6RbQ",
      ),
      test: (i) => Boolean(i.replica),
    },
    {
      key: "memory",
      label: "Memory",
      url: SYM(
        "popup/memory-symbol.png?v=1747803259967&key=4CDrYIxVWDUKPLGXGOhO3g",
      ),
      test: (i) => Boolean(i.memoryItem),
    },
    {
      key: "breach",
      label: "Mutated",
      url: SYM(
        "popup/breach-symbol.png?v=1759709093664&key=R8ypjmI1TuM6RE_WWWHxiw",
      ),
      test: (i) => Boolean(i.mutated),
    },
    {
      key: "vestigial",
      label: "Vestigial",
      url: SYM(
        "popup/vestigial-symbol.png?v=1783395650713&key=-YB_ZzmxB0qautKiuSQ1CQ",
      ),
      test: (i) => Boolean(i.vestigial),
    },
  ];

  const POE2_SYMBOLS: Sym[] = [
    {
      key: "desecrated",
      label: "Desecrated",
      url: SYM(
        "popup2/desecrated-symbol.png?v=1754628199421&key=hgK5C6v-SqzlKR0q0MrYDg",
      ),
      test: (i) => Boolean(i.desecrated),
    },
    {
      key: "vaal",
      label: "Mutated",
      url: SYM(
        "popup2/vaal-symbol.png?v=1764542264625&key=6qnhCPxsLIuTvtF8K_8R8A",
      ),
      test: (i) => Boolean(i.mutated),
    },
  ];

  $: isPoe2 = (item?.realm || realm || "").toLowerCase() === "poe2";
  $: symbols = item
    ? (isPoe2 ? POE2_SYMBOLS : POE1_SYMBOLS).filter((s) => s.test(item!))
    : [];

  /* ------------------------------------------------------------------ */
  /* Travel / Whisper & Error Extraction                                */
  /* ------------------------------------------------------------------ */
  function parseTravelError(err: any): string {
    if (!err) return "Failed";
    if (typeof err === "object") {
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
      <div class="row-title-bar skel-title-bar">
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
    class:is-corrupted={item.corrupted || item.doubleCorrupted}
    class:is-unidentified={item.identified === false}
    data-item-id={id}
    bind:clientWidth={rowWidth}
  >
    {#if resolvedStyle !== "minimal"}
      <!-- Header: category symbols, name, base type (raw JSON button sits under it) -->
      <div class="title-wrap" bind:this={titleWrapEl}>
        <div
          class="row-title-bar"
          style:padding-left="{titleInsetLeft}px"
          style:padding-right="{titleInsetRight}px"
        >
          {#if symbols.length}
            <span class="symbols left">
              {#each symbols as s (s.key)}
                <img
                  class="symbol-img"
                  src={s.url}
                  alt={s.label}
                  title={s.label}
                  loading="lazy"
                />
              {/each}
            </span>
          {/if}

          <div class="title-text" title={fullItemTitle}>
            {#if item.name}
              <span class="item-name">{item.name}</span>
            {/if}
            {#if item.typeLine || item.baseType}
              <span class="item-type">{item.typeLine || item.baseType}</span>
            {/if}
          </div>

          {#if symbols.length}
            <span class="symbols right">
              {#each symbols as s (s.key)}
                <img
                  class="symbol-img"
                  src={s.url}
                  alt={s.label}
                  title={s.label}
                  loading="lazy"
                />
              {/each}
            </span>
          {/if}
        </div>
        <button
          type="button"
          class="btn-top-json"
          title="View full raw JSON received for this item"
          aria-label="View raw JSON"
          on:click|stopPropagation={() => (isJsonModalOpen = true)}
        >
          &#123;&nbsp;&#125;
        </button>
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
        styleMode={resolvedStyle}
        tileWidth={boxWidth}
      />
    </div>

    <!-- Right / bottom: listing & trade actions -->
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
        styleMode={resolvedStyle}
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
  /* Title bar                                                        */
  /* ---------------------------------------------------------------- */
  .title-wrap {
    grid-column: 1 / -1;
    position: relative;
    min-width: 0;
  }
  .row-title-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    padding: 5px 10px;
    background: linear-gradient(
      90deg,
      rgba(var(--rc-rgb), 0.24) 0%,
      rgba(var(--rc-rgb), 0.07) 55%,
      rgba(0, 0, 0, 0.55) 100%
    );
    border-bottom: 1px solid rgba(var(--rc-rgb), 0.38);
    color: var(--rc);
  }

  .title-text {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    flex: 1;
    justify-content: center;
    overflow: hidden;
    white-space: nowrap;
    font-size: 22px;
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  }

  .item-name {
    font-weight: 700;
    letter-spacing: 0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
  }

  .item-type {
    font-weight: 400;
    opacity: 0.78;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .item-name + .item-type {
    flex-shrink: 2;
  }

  /* Category symbols (influence, fractured, veiled, ...) */
  .symbols {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    align-self: center;
    flex-shrink: 0;
  }
  .symbol-img {
    height: 24px;
    width: 24px;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
  }

  /* ---------------------------------------------------------------- */
  /* Raw JSON button                                                  */
  /* ---------------------------------------------------------------- */
  .btn-top-json {
    position: absolute;
    top: calc(100% + 4px);
    right: 4px;
    z-index: 15;
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
    cursor: pointer;
    transition:
      opacity 0.1s ease,
      border-color 0.1s ease,
      color 0.1s ease,
      background-color 0.1s ease;
  }
  .btn-top-json:hover,
  .btn-top-json:focus-visible {
    opacity: 1;
    border-color: var(--rc);
    color: #fff;
    background: rgba(var(--rc-rgb), 0.18);
    outline: none;
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

  .item-row.mode-minimal {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.55rem;
    padding: 0.3rem 1.9rem 0.3rem 0.5rem;
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
    padding: 8px 10px;
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
