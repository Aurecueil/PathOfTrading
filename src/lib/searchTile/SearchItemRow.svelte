<!-- src/lib/searchTile/SearchItemRow.svelte -->
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import type { Item, TradeFetchResult } from "$lib/types/tradeItem";
  import ItemIcon from "$lib/trade/components/item/ItemIcon.svelte";
  import ItemStats from "$lib/trade/components/item/ItemStats.svelte";
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

  /* ------------------------------------------------------------------ */
  /* Rarity                                                              */
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

  // FrameType enum -> rarity key (foils render as uniques in-game)
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
  /* Influences (shown as small diamonds in front of the item name)      */
  /* ------------------------------------------------------------------ */
  const INFLUENCES: { key: string; label: string; color: string }[] = [
    { key: "shaper", label: "Shaper", color: "#4aa3ff" },
    { key: "elder", label: "Elder", color: "#a17bd6" },
    { key: "crusader", label: "Crusader", color: "#e6e0c8" },
    { key: "hunter", label: "Hunter", color: "#6fbf4a" },
    { key: "redeemer", label: "Redeemer", color: "#4fd0d6" },
    { key: "warlord", label: "Warlord", color: "#d1a23a" },
    { key: "searing", label: "Searing Exarch", color: "#ff7a3d" },
    { key: "tangled", label: "Eater of Worlds", color: "#7f6fe0" },
  ];

  function activeInfluences(it?: Item) {
    if (!it) return [];
    return INFLUENCES.filter(
      (i) =>
        Boolean(it.influences?.[i.key]) ||
        Boolean((it as unknown as Record<string, unknown>)[i.key]),
    );
  }

  $: influences = activeInfluences(item);

  /* ------------------------------------------------------------------ */
  /* Tags: everything worth knowing about the item at a glance           */
  /* ------------------------------------------------------------------ */
  type Tone = "info" | "bad" | "gold" | "purple" | "green" | "blue" | "note";
  interface Tag {
    label: string;
    tone: Tone;
    title?: string;
  }

  function buildTags(it: Item): Tag[] {
    const t: Tag[] = [];
    const ilvl = it.ilvl || it.itemLevel;
    if (ilvl)
      t.push({ label: `iLvl ${ilvl}`, tone: "info", title: "Item level" });
    if (it.monsterLevel)
      t.push({ label: `Monster ${it.monsterLevel}`, tone: "info" });

    if (it.identified === false) t.push({ label: "Unidentified", tone: "bad" });
    if (it.doubleCorrupted) t.push({ label: "Double corrupted", tone: "bad" });
    else if (it.corrupted) t.push({ label: "Corrupted", tone: "bad" });
    if (it.mutated)
      t.push({
        label: realm === "poe2" ? "Mutated" : "Foulborn",
        tone: realm === "poe2" ? "bad" : "purple",
      });
    if (it.fractured) t.push({ label: "Fractured", tone: "gold" });
    if (it.sanctified) t.push({ label: "Sanctified", tone: "gold" });
    if (it.synthesised) t.push({ label: "Synthesised", tone: "blue" });
    if (it.desecrated) t.push({ label: "Desecrated", tone: "green" });
    if (it.vestigial) t.push({ label: "Vestigial", tone: "green" });
    if (it.veiled) t.push({ label: "Veiled", tone: "purple" });
    if (it.duplicated) t.push({ label: "Mirrored", tone: "blue" });
    if (it.split) t.push({ label: "Split", tone: "info" });
    if (it.replica) t.push({ label: "Replica", tone: "info" });
    if (it.isRelic) t.push({ label: "Relic", tone: "green" });
    if (it.foreseeing) t.push({ label: "Foreseeing", tone: "info" });
    if (it.memoryItem) t.push({ label: "Memory", tone: "info" });
    if (it.foilVariation !== undefined)
      t.push({ label: "Foil", tone: "purple" });
    if (it.ruthless) t.push({ label: "Ruthless", tone: "info" });
    if (it.unmodifiable) t.push({ label: "Unmodifiable", tone: "info" });
    else if (it.unmodifiableExceptChaos)
      t.push({ label: "Chaos-only modifiable", tone: "info" });
    if (it.lockedToCharacter)
      t.push({ label: "Character-bound", tone: "info" });
    if (it.lockedToAccount) t.push({ label: "Account-bound", tone: "info" });
    if (it.cisRaceReward || it.seaRaceReward || it.thRaceReward)
      t.push({ label: "Race reward", tone: "gold" });
    if (it.note || it.forum_note) {
      const n = (it.note || it.forum_note) as string;
      t.push({ label: n, tone: "note", title: `Seller note: ${n}` });
    }
    return t;
  }

  $: tags = item ? buildTags(item) : [];

  /* ------------------------------------------------------------------ */
  /* Travel                                                              */
  /* ------------------------------------------------------------------ */
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
  <div
    class="item-row skeleton-row mode-{effectiveStyle} r-default"
    data-item-id={id}
  >
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
    class="item-row mode-{effectiveStyle} r-{rarityKey}"
    class:is-live-entry={isLive}
    class:is-corrupted={item.corrupted}
    class:is-unidentified={item.identified === false}
    data-item-id={id}
  >
    {#if effectiveStyle !== "minimal"}
      <!-- Header: influences, name, base type, raw JSON -->
      <div class="row-title-bar">
        <div class="title-text" title={fullItemTitle}>
          {#if influences.length}
            <span class="influences">
              {#each influences as inf (inf.key)}
                <span
                  class="influence"
                  style="--ic: {inf.color}"
                  title="{inf.label} influence"
                ></span>
              {/each}
            </span>
          {/if}
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
          aria-label="View raw JSON"
          on:click|stopPropagation={() => (isJsonModalOpen = true)}
        >
          &#123;&nbsp;&#125;
        </button>
      </div>

      {#if tags.length}
        <div class="tag-strip" aria-label="Item properties">
          {#each tags as tag}
            <span class="tag tone-{tag.tone}" title={tag.title ?? tag.label}>
              {tag.label}
            </span>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Floating top-right JSON button for minimal mode -->
      <button
        type="button"
        class="btn-top-json minimal-json"
        title="View full raw JSON received for this item"
        aria-label="View raw JSON"
        on:click|stopPropagation={() => (isJsonModalOpen = true)}
      >
        &#123;&nbsp;&#125;
      </button>
    {/if}

    <!-- Left: vertically centered icon (full & minimal only) -->
    {#if effectiveStyle !== "compact"}
      <div class="col-icon">
        <ItemIcon
          {item}
          styleMode={effectiveStyle}
          on:gems={(e) => (gemSkills = e.detail)}
        />
      </div>
    {/if}

    <!-- Center: stats & modifiers -->
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
  /* Row shell                                                         */
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

  /* State hints on the whole row */
  .item-row.is-corrupted {
    box-shadow: inset 0 0 0 1px rgba(210, 0, 0, 0.28);
  }
  .item-row.is-unidentified {
    box-shadow: inset 0 0 0 1px rgba(210, 0, 0, 0.18);
  }

  /* ---------------------------------------------------------------- */
  /* Title bar                                                         */
  /* ---------------------------------------------------------------- */
  .row-title-bar {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    padding: 5px 6px 5px 10px;
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
    overflow: hidden;
    white-space: nowrap;
    font-size: 17px;
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
  /* a name + base type pair reads as one title; base type yields first */
  .item-name + .item-type {
    flex-shrink: 2;
  }

  .influences {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    align-self: center;
    flex-shrink: 0;
  }
  .influence {
    width: 9px;
    height: 9px;
    background: var(--ic);
    transform: rotate(45deg);
    box-shadow:
      0 0 6px var(--ic),
      inset 0 0 0 1px rgba(0, 0, 0, 0.45);
  }

  /* Hide the duplicate title ItemStats draws when the bar is present */
  .col-stats.hide-inner-title :global(.item-header),
  .col-stats.hide-inner-title :global(.item-title),
  .col-stats.hide-inner-title :global(.title-row),
  .col-stats.hide-inner-title :global(.header-row),
  .col-stats.hide-inner-title :global(.name-line) {
    display: none !important;
  }

  /* ---------------------------------------------------------------- */
  /* Raw JSON button                                                   */
  /* ---------------------------------------------------------------- */
  .btn-top-json {
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.55);
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
      border-color 0.1s ease,
      color 0.1s ease,
      background-color 0.1s ease;
  }
  .btn-top-json.minimal-json {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 15;
  }
  .btn-top-json:hover,
  .btn-top-json:focus-visible {
    border-color: var(--rc);
    color: #fff;
    background: rgba(var(--rc-rgb), 0.18);
    outline: none;
  }

  /* ---------------------------------------------------------------- */
  /* Tag strip                                                         */
  /* ---------------------------------------------------------------- */
  .tag-strip {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 0 0;
    min-width: 0;
  }

  .tag {
    --tg: 160, 160, 160;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 1px 6px;
    font-family: inherit;
    font-size: 11.5px;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgb(var(--tg));
    background: rgba(var(--tg), 0.1);
    border: 1px solid rgba(var(--tg), 0.32);
  }
  .tone-info {
    --tg: 168, 168, 168;
  }
  .tone-bad {
    --tg: 255, 82, 82;
  }
  .tone-gold {
    --tg: 214, 186, 112;
  }
  .tone-purple {
    --tg: 205, 116, 232;
  }
  .tone-green {
    --tg: 142, 170, 82;
  }
  .tone-blue {
    --tg: 110, 170, 255;
  }
  .tone-note {
    --tg: 233, 207, 159;
    max-width: 18rem;
    font-style: italic;
  }

  /* ---------------------------------------------------------------- */
  /* Column pieces                                                     */
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
    gap: 0.4rem;
  }

  .gem-skills {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    padding-top: 0.35rem;
    border-top: 1px dotted rgba(var(--rc-rgb), 0.3);
  }
  .gem-skills :global(img.gem-skill) {
    width: 30px;
    height: 30px;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(var(--rc-rgb), 0.45);
    padding: 1px;
  }

  .col-listing {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }

  /* ---------------------------------------------------------------- */
  /* Live entry flash                                                  */
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
  /* Layout modes                                                      */
  /* ---------------------------------------------------------------- */
  .item-row.mode-full {
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 0.85rem;
    row-gap: 0.5rem;
    padding: 0 0.7rem 0.7rem;
    align-items: center;
  }
  .item-row.mode-full .row-title-bar {
    margin: 0 -0.7rem;
  }
  .item-row.mode-full .col-listing {
    padding-left: 0.85rem;
    border-left: 1px solid rgba(255, 255, 255, 0.07);
    align-self: stretch;
  }

  .item-row.mode-compact {
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 0.65rem;
    row-gap: 0.4rem;
    padding: 0 0.6rem 0.5rem;
    align-items: center;
  }
  .item-row.mode-compact .row-title-bar {
    margin: 0 -0.6rem;
  }
  .item-row.mode-compact .col-listing {
    padding-left: 0.65rem;
    border-left: 1px solid rgba(255, 255, 255, 0.07);
    align-self: stretch;
  }

  .item-row.mode-minimal {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.55rem;
    padding: 0.3rem 1.9rem 0.3rem 0.5rem;
    align-items: center;
    min-height: 54px;
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
      border-left: none;
      padding-left: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 0.45rem;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Skeleton                                                          */
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
