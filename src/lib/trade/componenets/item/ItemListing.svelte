<!-- src/lib/components/item/ItemListing.svelte -->
<script lang="ts">
  import type { ItemListing } from "$lib/types/item";

  export let listing: ItemListing | undefined;
  export let sortValue: any = null;
  export let isTraveling: boolean = false;
  export let isQueued: boolean = false;
  export let travelError: string | null = null;
  export let league: string = "";
  export let searchId: string = "";
  export let onTravel: () => void;
  export let onOpenJson: () => void; // Event to trigger the JSON popup

  $: price = listing?.price;
  $: account = listing?.account;
  $: token = listing?.whisper_token ?? listing?.hideout_token ?? null;
</script>

<div class="listing-panel" data-league={league} data-search-id={searchId}>
  <!-- Price Information -->
  <div class="price-box">
    <div class="price-headline">
      <span class="amount">{price?.amount ?? "—"}</span>
      <span class="currency">{price?.currency ?? "Unpriced"}</span>
    </div>
    {#if listing?.fee}
      <div class="fee-text">+ {listing.fee} fee</div>
    {/if}
  </div>

  <!-- Seller & Stash Location -->
  <div class="seller-box">
    <div class="seller-name">{account?.name ?? "Anonymous"}</div>
    <div class="status-indicator">
      <span class="status-dot" class:online={account?.online} />
      <span class="status-label" class:online={account?.online}>
        {account?.online ? "Online" : "Offline"}
      </span>
    </div>
    {#if listing?.stash}
      <div class="stash-tab" title={listing.stash.name}>
        "{listing.stash.name}" ({listing.stash.x}, {listing.stash.y})
      </div>
    {/if}
  </div>

  <!-- Sort Metric Tag -->
  {#if sortValue !== null && sortValue !== undefined}
    <div class="sort-tag" title="Sort value">
      Sort: {typeof sortValue === "object"
        ? JSON.stringify(sortValue)
        : sortValue}
    </div>
  {/if}

  <!-- Action Buttons -->
  <div class="action-box">
    <button
      type="button"
      class="btn-travel"
      class:is-active={isTraveling}
      class:is-queued={isQueued}
      disabled={isTraveling || isQueued}
      on:click={onTravel}
    >
      {#if isTraveling}
        <span class="spin">↻</span> Traveling...
      {:else if isQueued}
        <span class="spin">↻</span> Queued...
      {:else}
        Travel to Hideout
      {/if}
    </button>

    <button
      type="button"
      class="btn-raw-json"
      title="View full raw JSON received for this item"
      on:click={onOpenJson}
    >
      &#123;&nbsp;&#125; Raw JSON
    </button>

    {#if travelError}
      <span class="travel-error" title={travelError}>
        {travelError}
      </span>
    {/if}
  </div>
</div>

<style>
  .listing-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    height: 100%;
    width: 170px;
    min-width: 150px;
  }
  .price-headline {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.3rem;
  }
  .amount {
    font-size: 1.15rem;
    font-weight: 700;
    color: #38bdf8;
  }
  .currency {
    font-size: 0.8rem;
    color: #94a3b8;
  }
  .fee-text {
    font-size: 0.68rem;
    color: #eab308;
  }
  .seller-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    font-size: 0.72rem;
  }
  .seller-name {
    font-weight: 600;
    color: #e2e8f0;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.68rem;
  }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
  }
  .status-dot.online {
    background: #22c55e;
    box-shadow: 0 0 4px rgba(34, 197, 94, 0.6);
  }
  .status-label {
    color: #ef4444;
  }
  .status-label.online {
    color: #22c55e;
  }
  .stash-tab {
    font-size: 0.66rem;
    color: #64748b;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sort-tag {
    font-size: 0.65rem;
    color: #38bdf8;
    background: #090e17;
    border: 1px solid #1e293b;
    padding: 1px 5px;
    border-radius: 3px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .action-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    width: 100%;
  }
  .btn-travel {
    background: #1e293b;
    border: 1px solid #334155;
    color: #f1f5f9;
    padding: 0.35rem 0.65rem;
    border-radius: 3px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    width: 100%;
    max-width: 135px;
  }
  .btn-travel:hover:not(:disabled) {
    background: #334155;
    color: #38bdf8;
    border-color: #475569;
  }
  .btn-travel:disabled {
    cursor: not-allowed;
    opacity: 0.8;
  }
  .btn-travel.is-queued {
    background: #2a2012;
    border-color: #d97706;
    color: #fcd34d;
  }
  .btn-raw-json {
    background: #0b0f17;
    border: 1px solid #1e2638;
    color: #94a3b8;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.68rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
    max-width: 135px;
  }
  .btn-raw-json:hover {
    background: #161e2e;
    color: #38bdf8;
    border-color: #2e3b54;
  }
  .travel-error {
    font-size: 0.62rem;
    color: #f87171;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
