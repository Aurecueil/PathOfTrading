<!-- src/lib/components/item/ItemListing.svelte -->
<script lang="ts">
  import type { ItemListing } from "$lib/types/tradeItem";
  import type { ResolvedDisplayStyle } from "$lib/types/types";

  export let listing: ItemListing | undefined;
  export let sortValue: any = null;
  export let isTraveling: boolean = false;
  export let isQueued: boolean = false;
  export let travelError: string | null = null;
  export let league: string = "";
  export let searchId: string = "";
  export let styleMode: ResolvedDisplayStyle = "full";

  export let onTravel: () => void;

  let whisperCopied = false;

  $: price = listing?.price;
  $: account = listing?.account;

  $: relativeAge = (() => {
    if (!listing?.indexed) return "";
    const diffSec = Math.max(
      0,
      Math.floor((Date.now() - new Date(listing.indexed).getTime()) / 1000),
    );
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
      <span class="amount">{price?.amount ?? "—"}</span>
      <span class="currency">{price?.currency ?? ""}</span>
    </div>

    <button
      type="button"
      class="btn-icon-travel"
      disabled={isTraveling || isQueued}
      title="Travel to Hideout ({account?.name ?? 'Seller'})"
      on:click|stopPropagation={onTravel}
    >
      {#if isTraveling || isQueued}
        <span class="spin">↻</span>
      {:else}
        ⚡
      {/if}
    </button>
  </div>
{:else}
  <div
    class="listing-panel mode-{styleMode}"
    data-league={league}
    data-search-id={searchId}
  >
    <!-- Price & Larger Gold Fee -->
    <div class="price-box">
      <div class="price-headline">
        <span class="amount">{price?.amount ?? "—"}</span>
        <span class="currency">{price?.currency ?? "Unpriced"}</span>
      </div>
      {#if listing?.fee}
        <div class="fee-text">+ {listing.fee} gold fee</div>
      {/if}
    </div>

    <!-- Seller & Larger Indexed Time (Stash position removed) -->
    <div class="seller-box">
      <div class="seller-row">
        <span class="status-dot" class:online={account?.online} />
        <span class="seller-name" title={account?.name}>
          {account?.name ?? "Anonymous"}
        </span>
      </div>
      {#if relativeAge}
        <div class="age-badge">{relativeAge}</div>
      {/if}
    </div>

    {#if styleMode === "full" && sortValue !== null && sortValue !== undefined}
      <div class="sort-tag" title="Sort value">
        Sort: {typeof sortValue === "object"
          ? JSON.stringify(sortValue)
          : sortValue}
      </div>
    {/if}

    <!-- Trade Action Buttons -->
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
            <span class="spin">↻</span> Traveling...
          {:else if isQueued}
            <span class="spin">↻</span> Queued...
          {:else}
            Travel to Hideout
          {/if}
        </button>

        {#if listing?.whisper}
          <button
            type="button"
            class="btn-whisper"
            title="Copy trade whisper"
            on:click|stopPropagation={copyWhisper}
          >
            {whisperCopied ? "✓" : "💬"}
          </button>
        {/if}
      </div>

      {#if travelError}
        <span class="travel-error" title={travelError}>{travelError}</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Minimal Mode */
  .listing-minimal {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .min-price {
    display: flex;
    align-items: baseline;
    gap: 0.2rem;
    white-space: nowrap;
  }
  .min-price .amount {
    font-size: 0.88rem;
    font-weight: 700;
    color: #38bdf8;
  }
  .min-price .currency {
    font-size: 0.7rem;
    color: #94a3b8;
  }
  .btn-icon-travel {
    background: #1e293b;
    border: 1px solid #334155;
    color: #f8fafc;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
  }
  .btn-icon-travel:hover:not(:disabled) {
    background: #2563eb;
    border-color: #3b82f6;
  }

  /* Compact & Full Panel */
  .listing-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 0.45rem;
    width: 160px;
    min-width: 145px;
    padding-top: 0.4rem;
  }
  .listing-panel.mode-compact {
    width: 135px;
    min-width: 125px;
    gap: 0.3rem;
  }

  @container tile-body (max-width: 470px) {
    .listing-panel,
    .listing-panel.mode-compact {
      width: 100%;
      flex-direction: row;
      justify-content: space-between;
      flex-wrap: wrap;
      padding-top: 0;
    }
    .action-box {
      width: auto !important;
    }
  }

  .price-headline {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.25rem;
  }
  .amount {
    font-size: 1.15rem;
    font-weight: 700;
    color: #38bdf8;
  }
  .mode-compact .amount {
    font-size: 0.98rem;
  }
  .currency {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  /* Bigger Gold Fee */
  .fee-text {
    font-size: 0.78rem;
    font-weight: 600;
    color: #facc15;
    margin-top: 1px;
  }

  .seller-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.18rem;
    font-size: 0.74rem;
  }
  .seller-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .seller-name {
    font-weight: 600;
    color: #e2e8f0;
    max-width: 125px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    flex-shrink: 0;
  }
  .status-dot.online {
    background: #22c55e;
    box-shadow: 0 0 4px rgba(34, 197, 94, 0.6);
  }

  /* Bigger Time Display */
  .age-badge {
    font-size: 0.78rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .sort-tag {
    font-size: 0.64rem;
    color: #38bdf8;
    background: #090e17;
    border: 1px solid #1e293b;
    padding: 1px 5px;
    border-radius: 3px;
  }
  .action-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
  }
  .primary-actions {
    display: flex;
    gap: 0.25rem;
    width: 100%;
    justify-content: center;
  }
  .btn-travel {
    background: #1e293b;
    border: 1px solid #334155;
    color: #f1f5f9;
    padding: 0.32rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }
  .btn-travel:hover:not(:disabled) {
    background: #2563eb;
    border-color: #3b82f6;
    color: #ffffff;
  }
  .btn-whisper {
    background: #172030;
    border: 1px solid #2e3b54;
    color: #cbd5e1;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    font-size: 0.7rem;
    cursor: pointer;
  }
  .btn-whisper:hover {
    background: #28354d;
    color: #38bdf8;
  }
  .travel-error {
    font-size: 0.62rem;
    color: #f87171;
  }
  .spin {
    display: inline-block;
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
</style>
