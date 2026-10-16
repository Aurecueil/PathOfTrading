<!-- src/lib/components/item/ItemListing.svelte -->
<script lang="ts">
  import type { ItemListing } from "$lib/types/tradeItem";
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import type { StaticEntry } from "$lib/types/statics";
  import { staticsPoe, staticsPoe2 } from "$lib/trade/tradeStore";
  import CdnImage from "./CdnImage.svelte";

  export let listing: ItemListing | undefined;
  export let sortValue: any = null;
  export let isTraveling: boolean = false;
  export let isQueued: boolean = false;
  export let travelError: string | null = null;
  export let realm: string = "poe";
  export let league: string = "";
  export let searchId: string = "";
  export let styleMode: ResolvedDisplayStyle = "full";

  export let onTravel: () => void;

  let whisperCopied = false;

  $: price = listing?.price;
  $: account = listing?.account;
  $: statics = realm === "poe2" ? $staticsPoe2 : $staticsPoe;
  $: currencyEntry = findStatic(statics, price?.currency);

  function findStatic(
    categories: { entries: StaticEntry[] }[],
    id: string | undefined,
  ): StaticEntry | undefined {
    if (!id) return undefined;
    for (const cat of categories) {
      const hit = cat.entries.find((e) => e.id === id);
      if (hit) return hit;
    }
    return undefined;
  }

  function extractArray<T>(storeVal: any): T[] {
    if (!storeVal) return [];
    if (Array.isArray(storeVal)) return storeVal;
    if (Array.isArray(storeVal.result)) return storeVal.result;
    return [];
  }

  $: ageSec = listing?.indexed
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(listing.indexed).getTime()) / 1000),
      )
    : null;
  $: isFresh = ageSec !== null && ageSec < 300;

  $: relativeAge = (() => {
    if (ageSec === null) return "";
    const diffSec = ageSec;
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  })();

  async function copyWhisper() {
    if (!listing?.whisper) return;
    try {
      await navigator.clipboard.writeText(listing.whisper);
      whisperCopied = true;
      setTimeout(() => (whisperCopied = false), 1500);
    } catch (err) {
      console.error("Failed to copy whisper:", err);
    }
  }
</script>

{#if styleMode === "minimal"}
  <div class="listing-minimal">
    <div class="min-price">
      <span class="amount">{price?.amount ?? "—"}x</span>
      {#if currencyEntry?.image}
        <CdnImage
          src={currencyEntry.image}
          alt={currencyEntry.text}
          className="currency-img"
          loading="lazy"
        />
      {/if}
      <span class="currency"
        >{currencyEntry?.text ?? price?.currency ?? ""}</span
      >
    </div>

    <button
      type="button"
      class="btn-icon-travel"
      disabled={isTraveling || isQueued}
      title="Travel to hideout ({account?.name ?? 'Seller'})"
      aria-label="Travel to hideout"
      on:click|stopPropagation={onTravel}
    >
      {#if isTraveling || isQueued}
        <svg class="spin" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
          />
        </svg>
      {/if}
    </button>
  </div>
{:else}
  <div
    class="listing-panel mode-{styleMode}"
    data-league={league}
    data-search-id={searchId}
  >
    <!-- Price & gold fee -->
    <div class="price-box">
      <div class="price-headline">
        <span class="amount"
          >{price?.amount ?? "—"}<span class="times">×</span></span
        >
        {#if currencyEntry?.image}
          <CdnImage
            src={currencyEntry.image}
            alt={currencyEntry.text}
            className="currency-img"
            loading="lazy"
          />
        {/if}
        <span class="currency">
          {currencyEntry?.text ?? price?.currency ?? "Unpriced"}
        </span>
      </div>
      {#if listing?.fee}
        <div class="fee-text" title="Gold fee for travelling to this hideout">
          <span class="coin" aria-hidden="true"></span>
          {listing.fee.toLocaleString()} gold
        </div>
      {/if}
    </div>

    <!-- Seller & listing age -->
    <div class="seller-box">
      <div class="seller-row">
        <span
          class="status-dot"
          class:online={account?.online === true}
          class:offline={account?.online === false}
          title={account?.online === true
            ? "Online"
            : account?.online === false
              ? "Offline"
              : "Status unknown"}
        ></span>
        <span class="seller-name" title={account?.name}>
          {account?.name ?? "Anonymous"}
        </span>
      </div>
      {#if relativeAge}
        <div
          class="age-badge"
          class:fresh={isFresh}
          title={listing?.indexed
            ? new Date(listing.indexed).toLocaleString()
            : ""}
        >
          Listed {relativeAge}
        </div>
      {/if}
    </div>

    {#if styleMode === "full" && sortValue !== null && sortValue !== undefined}
      <div class="sort-tag" title="Sort value">
        Sort: {typeof sortValue === "object"
          ? JSON.stringify(sortValue)
          : sortValue}
      </div>
    {/if}

    <!-- Trade actions -->
    <div class="action-box">
      <div class="primary-actions">
        <button
          type="button"
          class="btn-travel"
          class:is-active={isTraveling}
          class:is-queued={isQueued}
          disabled={isTraveling || isQueued}
          on:click|stopPropagation={onTravel}
        >
          {#if isTraveling}
            <svg class="spin" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
            </svg>
            Traveling…
          {:else if isQueued}
            <svg class="spin" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
            </svg>
            Queued…
          {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
              />
            </svg>
            Travel to hideout
          {/if}
        </button>

        {#if listing?.whisper}
          <button
            type="button"
            class="btn-whisper"
            class:is-copied={whisperCopied}
            title={whisperCopied ? "Whisper copied" : "Copy trade whisper"}
            aria-label="Copy trade whisper"
            on:click|stopPropagation={copyWhisper}
          >
            {#if whisperCopied}
              <svg viewBox="0 0 24 24" aria-hidden="true"
                ><path d="M20 6 9 17l-5-5" /></svg
              >
            {:else}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                />
              </svg>
            {/if}
          </button>
        {/if}
      </div>

      {#if travelError}
        <span class="travel-error" role="alert" title={travelError}
          >{travelError}</span
        >
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Shared tokens (match the trade site's price colours) */
  .listing-minimal,
  .listing-panel {
    --price: #e9cf9f;
    --currency: #aa9e82;
    --gold: #facc15;
    --btn-bg: #3a2608;
    --btn-bg-hover: #5a3806;
    --btn-border: #6b4a14;
    --btn-border-hover: #b8892f;
    font-family: "FontinRegular", "Fontin", "Palatino Linotype", Georgia, serif;
  }

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ---------------- Minimal ---------------- */
  .listing-minimal {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .min-price {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    white-space: nowrap;
  }
  .min-price .amount {
    font-size: 1rem;
    font-weight: 700;
    color: var(--price);
  }
  .min-price .currency {
    font-size: 0.78rem;
    color: var(--currency);
  }
  .btn-icon-travel {
    background: var(--btn-bg);
    border: 1px solid var(--btn-border);
    color: #f1e3c4;
    width: 28px;
    height: 28px;
    border-radius: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease;
  }
  .btn-icon-travel:hover:not(:disabled),
  .btn-icon-travel:focus-visible {
    background: var(--btn-bg-hover);
    border-color: var(--btn-border-hover);
    outline: none;
  }
  .btn-icon-travel:disabled {
    opacity: 0.6;
    cursor: default;
  }

  /* ---------------- Full & compact panel ---------------- */
  .listing-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    width: 164px;
    min-width: 148px;
  }
  .listing-panel.mode-compact {
    width: 140px;
    min-width: 128px;
    gap: 0.35rem;
  }

  @container tile-body (max-width: 470px) {
    .listing-panel,
    .listing-panel.mode-compact {
      width: 100%;
      flex-direction: row;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .action-box {
      width: auto !important;
    }
  }

  :global(.currency-img) {
    width: 22px;
    height: 22px;
    object-fit: contain;
    align-self: center;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7));
  }
  .mode-compact :global(.currency-img),
  .min-price :global(.currency-img) {
    width: 18px;
    height: 18px;
  }

  .price-headline {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .amount {
    font-size: 1.3rem;
    font-weight: 700;
    line-height: 1;
    color: var(--price);
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }
  .amount .times {
    margin-left: 1px;
    font-size: 0.8em;
    opacity: 0.6;
    font-weight: 400;
  }
  .mode-compact .amount {
    font-size: 1.08rem;
  }
  .currency {
    font-size: 0.85rem;
    color: var(--currency);
  }

  .fee-text {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.2rem;
    font-size: 0.78rem;
    color: var(--gold);
    font-variant-numeric: tabular-nums;
  }
  .coin {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff1a8, #d9a60b 70%);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
  }

  .seller-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    max-width: 100%;
    padding-top: 0.45rem;
    border-top: 1px dotted rgba(255, 255, 255, 0.12);
    width: 100%;
  }
  .seller-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    max-width: 100%;
  }
  .seller-name {
    font-size: 0.84rem;
    font-weight: 600;
    color: #d8d3c4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #6b6b6b;
    flex-shrink: 0;
  }
  .status-dot.online {
    background: #3fcf6a;
    box-shadow: 0 0 5px rgba(63, 207, 106, 0.7);
  }
  .status-dot.offline {
    background: #d9534f;
  }

  .age-badge {
    font-size: 0.76rem;
    color: #8f8a7b;
  }
  .age-badge.fresh {
    color: #7fd18f;
  }

  .sort-tag {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.68rem;
    color: #8f8a7b;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 1px 6px;
  }

  .action-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    width: 100%;
  }
  .primary-actions {
    display: flex;
    gap: 0.25rem;
    width: 100%;
    justify-content: center;
  }

  .btn-travel {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.4rem 0.55rem;
    background: linear-gradient(180deg, #4a3210 0%, #2e1f08 100%);
    border: 1px solid var(--btn-border);
    border-radius: 0;
    color: #f4e6c6;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }
  .btn-travel:hover:not(:disabled),
  .btn-travel:focus-visible {
    background: linear-gradient(180deg, #6a4814 0%, #43290a 100%);
    border-color: var(--btn-border-hover);
    color: #fff;
    outline: none;
  }
  .btn-travel:active:not(:disabled) {
    background: #2e1f08;
  }
  .btn-travel:disabled {
    cursor: default;
    opacity: 0.75;
  }
  .btn-travel.is-active,
  .btn-travel.is-queued {
    border-color: var(--btn-border-hover);
  }
  .mode-compact .btn-travel {
    font-size: 0.74rem;
    padding: 0.32rem 0.45rem;
  }

  .btn-whisper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    background: #12151b;
    border: 1px solid #2c3340;
    border-radius: 0;
    color: #a9b0be;
    padding: 0;
    cursor: pointer;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }
  .btn-whisper:hover,
  .btn-whisper:focus-visible {
    background: #1b212b;
    border-color: #4a5568;
    color: #e9cf9f;
    outline: none;
  }
  .btn-whisper.is-copied {
    border-color: #3a7a4a;
    color: #7fd18f;
  }

  .travel-error {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.72rem;
    color: #ff7b7b;
  }

  .spin {
    animation: rotate 1s linear infinite;
  }
  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation-duration: 3s;
    }
  }
</style>
