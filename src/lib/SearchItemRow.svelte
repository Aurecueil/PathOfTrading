<!-- src/lib/SearchItemRow.svelte -->
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core"; // Use "@tauri-apps/api/tauri" if on Tauri v1
  import type { TradeFetchResult } from "$lib/types/item";
  import ItemIcon from "$lib/trade/componenets/item/ItemIcon.svelte";
  import ItemStats from "$lib/trade/componenets/item/ItemStats.svelte";
  import ItemListing from "$lib/trade/componenets/item/ItemListing.svelte";
  import ItemJsonModal from "$lib/trade/componenets/item/ItemJsonModal.svelte";

  export let id: string;
  export let data: TradeFetchResult | null = null;
  export let sortValue: any = null;
  export let realm: string = "poe";
  export let displayMode: "default" | "tile" = "default";

  // --- Search Context ---
  export let league: string = "";
  export let searchId: string = "";

  // --- Modal State ---
  let isJsonModalOpen = false;

  // --- Travel / Whisper State ---
  export let isTraveling = false;
  export let isQueued = false;
  export let travelError: string | null = null;

  // Resolve token from either whisper_token or hideout_token
  $: token =
    data?.listing?.whisper_token ?? data?.listing?.hideout_token ?? null;

  async function executeWhisper(activeToken: string) {
    isTraveling = true;
    isQueued = false;
    travelError = null;

    try {
      const targetRealm = data?.item?.realm ?? realm ?? "poe";
      const targetLeague = league || data?.item?.league || "";

      const result = await invoke<any>("whisper", {
        token: activeToken,
        realm: targetRealm,
        league: targetLeague,
        searchId,
      });
      console.log(`[RUST WHISPER SUCCESS - Item ${id}]`, result);
      return result;
    } catch (err: unknown) {
      const errMsg =
        typeof err === "string"
          ? err
          : ((err as Error)?.message ?? "Travel failed");
      travelError = errMsg;
      console.error(`[RUST WHISPER ERROR - Item ${id}]`, errMsg);
    } finally {
      isTraveling = false;
    }
  }

  export async function travelToHideout() {
    const activeToken =
      data?.listing?.whisper_token ?? data?.listing?.hideout_token;
    if (activeToken) {
      return await executeWhisper(activeToken);
    }
    console.log(
      `[QUEUE] "Travel to Hideout" queued for item ${id}. Awaiting listing data...`,
    );
    isQueued = true;
  }

  // Reactive trigger when queued and listing data arrives
  $: if (isQueued && token) {
    executeWhisper(token);
  }
</script>

<div
  class="item-container mode-{displayMode}"
  class:is-loading={!data}
  data-item-id={id}
  data-league={league || data?.item?.league || ""}
  data-search-id={searchId}
>
  {#if !data}
    <div class="loading-placeholder">
      <div class="loading-left">
        <span class="spin">↻</span>
        <span>Loading item {id}...</span>
      </div>

      <button
        type="button"
        class="btn-hideout"
        class:is-queued={isQueued}
        disabled={isQueued}
        on:click={travelToHideout}
      >
        {#if isQueued}
          <span class="spin">↻</span> Queued for Travel...
        {:else}
          Travel to Hideout
        {/if}
      </button>
    </div>
  {:else}
    <div class="col-icon">
      <ItemIcon item={data.item} />
    </div>

    <div class="col-stats">
      <ItemStats item={data.item} {realm} />
    </div>

    <div class="col-listing">
      <ItemListing
        listing={data.listing}
        {sortValue}
        {isTraveling}
        {isQueued}
        {travelError}
        {league}
        {searchId}
        onTravel={travelToHideout}
        onOpenJson={() => (isJsonModalOpen = true)}
      />
    </div>
  {/if}
</div>

<!-- Modal displays entire 1:1 received data -->
<ItemJsonModal
  isOpen={isJsonModalOpen}
  rawData={data}
  title={`Item ${id} JSON`}
  onClose={() => (isJsonModalOpen = false)}
/>

<style>
  .item-container {
    background: #10131a;
    border: 1px solid #202634;
    border-radius: 5px;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }
  .item-container:hover {
    border-color: #353f54;
  }
  .item-container.is-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 140px;
    padding: 0.8rem;
  }
  .loading-placeholder {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 450px;
    gap: 1rem;
    color: #94a3b8;
    font-size: 0.8rem;
  }
  .loading-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Default Row Mode */
  .mode-default {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    padding: 0.65rem;
    gap: 0.85rem;
    min-height: 148px;
  }
  .mode-default .col-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mode-default .col-stats {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .mode-default .col-listing {
    border-left: 1px solid #1c222e;
    padding-left: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Tile Grid Mode */
  .mode-tile {
    display: flex;
    flex-direction: column;
    padding: 0.85rem;
    gap: 0.75rem;
    width: 280px;
    align-items: center;
  }
  .mode-tile .col-icon {
    display: flex;
    justify-content: center;
  }
  .mode-tile .col-stats {
    width: 100%;
  }
  .mode-tile .col-listing {
    border-top: 1px solid #1c222e;
    padding-top: 0.6rem;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .btn-hideout {
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
    gap: 0.3rem;
  }
  .btn-hideout:hover:not(:disabled) {
    background: #334155;
    color: #38bdf8;
    border-color: #475569;
  }
  .btn-hideout:disabled {
    cursor: not-allowed;
    opacity: 0.8;
  }
  .btn-hideout.is-queued {
    background: #2a2012;
    border-color: #d97706;
    color: #fcd34d;
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
