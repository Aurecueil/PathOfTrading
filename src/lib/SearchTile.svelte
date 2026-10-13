<!-- src/lib/SearchTile.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import type { SearchTile, PoETradeItemEntry } from "$lib/types";

  export let tile: SearchTile;
  export let scale: number = 1;
  export let snapToGrid: boolean = false;
  export let gridSize: number = 40;

  const dispatch = createEventDispatcher<{
    openfilters: void;
    delete: void;
  }>();

  type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

  const MIN_W = 260;
  const MIN_H = 180;

  function snap(val: number): number {
    return snapToGrid ? Math.round(val / gridSize) * gridSize : Math.round(val);
  }

  $: activePayload = tile.payload;

  $: defaultRealmTitle =
    tile.realm?.toLowerCase() === "poe2"
      ? "Poe2 Trade Search"
      : "Poe Trade Search";

  $: displayTitle = tile.displayName?.trim() || defaultRealmTitle;

  export async function runSearchWithPayload(payload?: any) {
    const payloadToRun = payload || activePayload;
    if (!payloadToRun) return;

    if (payload) {
      tile.payload = payload;
    }

    tile.loading = true;
    tile.results = [];
    tile.fetchedItems = [];

    try {
      // 1. Dispatch search matching the refactored Tauri command:
      // pub async fn search_items(realm: String, payload: Value, cache_ok: Option<bool>)
      const rawResponse: string = await invoke("search_items", {
        realm: tile.realm,
        payload: payloadToRun,
        cacheOk: false,
      });

      const data =
        typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse;

      tile.searchId = data.id;
      tile.results = data.result || [];

      // 2. Queue IDs into the batching fetch pipeline
      if (tile.results.length > 0 && tile.searchId) {
        // Hand off initial IDs (up to 10 or more) as an array for batching
        const targetIds = tile.results.slice(0, 10);
        await fetchFoundItems(targetIds, tile.searchId);
      }
    } catch (err) {
      console.error(`[SearchTile ${tile.id}] Search error:`, err);
    } finally {
      tile.loading = false;
    }
  }

  export async function fetchFoundItems(ids: string[], queryId: string) {
    try {
      // Dispatch FetchJob model:
      // pub struct FetchJob { id, ids, min, wait_ms, cache_ok, reservation, realm }
      const data: any = await invoke("fetch_items", {
        job: {
          id: queryId,
          ids,
          min: 5,
          wait_ms: 100,
          cache_ok: false,
          reservation: null,
          realm: tile.realm,
        },
      });

      console.log(`[SearchTile ${tile.id}] fetch_items raw response:`, data);

      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      console.log(`[SearchTile ${tile.id}] fetch_items parsed data:`, parsed);

      const items: PoETradeItemEntry[] = parsed.result || [];

      tile.fetchedItems = [...tile.fetchedItems, ...items];
    } catch (err) {
      console.error(`[SearchTile ${tile.id}] Fetch error:`, err);
    }
  }

  function onHeaderPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = tile.x;
    const initY = tile.y;

    function onPointerMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;

      tile.x = snap(initX + dx);
      tile.y = snap(initY + dy);
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onResizePointerDown(e: PointerEvent, dir: ResizeDirection) {
    if (e.button !== 0) return;
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = tile.x;
    const initY = tile.y;
    const initW = tile.w;
    const initH = tile.h;

    const rightEdge = initX + initW;
    const bottomEdge = initY + initH;

    function onPointerMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;

      let nextX = initX;
      let nextY = initY;
      let nextW = initW;
      let nextH = initH;

      if (dir.includes("e")) {
        const rawW = initW + dx;
        const targetW = snap(rawW);
        nextW = Math.max(MIN_W, targetW);
      } else if (dir.includes("w")) {
        const rawLeft = initX + dx;
        let targetLeft = snap(rawLeft);

        if (rightEdge - targetLeft < MIN_W) {
          targetLeft = rightEdge - MIN_W;
        }

        nextX = targetLeft;
        nextW = rightEdge - targetLeft;
      }

      if (dir.includes("s")) {
        const rawH = initH + dy;
        const targetH = snap(rawH);
        nextH = Math.max(MIN_H, targetH);
      } else if (dir.includes("n")) {
        const rawTop = initY + dy;
        let targetTop = snap(rawTop);

        if (bottomEdge - targetTop < MIN_H) {
          targetTop = bottomEdge - MIN_H;
        }

        nextY = targetTop;
        nextH = bottomEdge - targetTop;
      }

      tile.x = nextX;
      tile.y = nextY;
      tile.w = nextW;
      tile.h = nextH;
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
</script>

<div
  class="tile-root"
  style:transform="translate({tile.x}px, {tile.y}px)"
  style:width="{tile.w}px"
  style:height="{tile.h}px"
>
  <div class="tile-bar" on:pointerdown={onHeaderPointerDown}>
    <div class="bar-left">
      <span class="realm-badge">{tile.realm}</span>
      <span class="title" title={displayTitle}>{displayTitle}</span>
    </div>

    <div class="actions" on:pointerdown|stopPropagation>
      <button
        type="button"
        class="search-btn"
        disabled={tile.loading || !activePayload}
        title={!activePayload
          ? "No search payload configured"
          : "Search Market"}
        on:click|stopPropagation={() => runSearchWithPayload()}
      >
        {#if tile.loading}
          <span class="spin">↻</span>
        {:else}
          🔍 Search
        {/if}
      </button>

      <button
        type="button"
        on:click|stopPropagation={() => dispatch("openfilters")}
      >
        Filters
      </button>

      <button
        type="button"
        class="del"
        on:click|stopPropagation={() => dispatch("delete")}
      >
        ×
      </button>
    </div>
  </div>

  <div class="tile-body" on:wheel|stopPropagation>
    {#if tile.loading}
      <div class="status-msg">Searching market...</div>
    {:else if tile.fetchedItems.length === 0}
      <div class="status-msg empty">
        {tile.results.length === 0
          ? "No search executed yet or no results"
          : "Fetching items..."}
      </div>
    {:else}
      <div class="item-list">
        {#each tile.fetchedItems as itemEntry (itemEntry.id)}
          {@const item = itemEntry.item || {}}
          {@const listing = itemEntry.listing || {}}
          {@const price = listing.price || {}}
          {@const account = listing.account || {}}

          <div class="item-row">
            <div class="item-name">
              {#if item.name}<strong>{item.name}</strong>{/if}
              <span>{item.typeLine || ""}</span>
            </div>

            <div class="item-meta">
              <span class="price">
                Price: {price.amount ?? "?"}
                {price.currency ?? "?"}
              </span>
              <span class="separator">|</span>
              <span class="seller">
                Seller: {account.name ?? "Anonymous"}
                <span class="online-indicator" class:online={account.online}>
                  ({account.online ? "Online" : "Offline"})
                </span>
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="edge n" on:pointerdown={(e) => onResizePointerDown(e, "n")}></div>
  <div class="edge s" on:pointerdown={(e) => onResizePointerDown(e, "s")}></div>
  <div class="edge e" on:pointerdown={(e) => onResizePointerDown(e, "e")}></div>
  <div class="edge w" on:pointerdown={(e) => onResizePointerDown(e, "w")}></div>
  <div
    class="corner nw"
    on:pointerdown={(e) => onResizePointerDown(e, "nw")}
  ></div>
  <div
    class="corner ne"
    on:pointerdown={(e) => onResizePointerDown(e, "ne")}
  ></div>
  <div
    class="corner sw"
    on:pointerdown={(e) => onResizePointerDown(e, "sw")}
  ></div>
  <div
    class="corner se"
    on:pointerdown={(e) => onResizePointerDown(e, "se")}
  ></div>
</div>

<style>
  .tile-root {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background: #181b24;
    border-radius: 8px;
    border: 1px solid #2c3345;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    overflow: visible;
  }
  .tile-bar {
    height: 36px;
    background: #212634;
    border-top-left-radius: 7px;
    border-top-right-radius: 7px;
    border-bottom: 1px solid #2c3345;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.5rem;
    cursor: grab;
    user-select: none;
    flex-shrink: 0;
  }
  .tile-bar:active {
    cursor: grabbing;
  }
  .bar-left {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    overflow: hidden;
  }
  .realm-badge {
    text-transform: uppercase;
    font-size: 0.65rem;
    font-weight: 700;
    background: #334155;
    color: #94a3b8;
    padding: 2px 4px;
    border-radius: 3px;
  }
  .title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .actions button {
    background: #2b3040;
    border: none;
    color: #cbd5e1;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }
  .actions button:hover:not(:disabled) {
    background: #3b4257;
  }
  .actions button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .actions button.search-btn {
    background: #1e3a8a;
    color: #bfdbfe;
  }
  .actions button.search-btn:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .actions button.del {
    font-size: 1rem;
    line-height: 1;
    padding: 0.1rem 0.4rem;
  }
  .actions button.del:hover {
    color: #ef4444;
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
  .tile-body {
    flex: 1;
    overflow-y: auto;
    position: relative;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
  }
  .status-msg {
    margin: auto;
    font-size: 0.8rem;
    color: #94a3b8;
    text-align: center;
  }
  .item-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .item-row {
    background: #1e222d;
    border: 1px solid #2b3245;
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
    font-size: 0.78rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .item-name {
    color: #e2e8f0;
  }
  .item-name strong {
    color: #fbbf24;
  }
  .item-meta {
    display: flex;
    gap: 0.4rem;
    color: #94a3b8;
    font-size: 0.72rem;
    flex-wrap: wrap;
  }
  .price {
    color: #38bdf8;
    font-weight: 500;
  }
  .separator {
    color: #475569;
  }
  .online-indicator {
    color: #ef4444;
  }
  .online-indicator.online {
    color: #4ade80;
  }
  .edge,
  .corner {
    position: absolute;
    background: transparent;
    z-index: 20;
  }
  .edge.n {
    top: -6px;
    left: 8px;
    right: 8px;
    height: 12px;
    cursor: ns-resize;
  }
  .edge.s {
    bottom: -6px;
    left: 8px;
    right: 8px;
    height: 12px;
    cursor: ns-resize;
  }
  .edge.w {
    left: -6px;
    top: 8px;
    bottom: 8px;
    width: 12px;
    cursor: ew-resize;
  }
  .edge.e {
    right: -6px;
    top: 8px;
    bottom: 8px;
    width: 12px;
    cursor: ew-resize;
  }
  .corner.nw {
    top: -6px;
    left: -6px;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
  }
  .corner.ne {
    top: -6px;
    right: -6px;
    width: 14px;
    height: 14px;
    cursor: nesw-resize;
  }
  .corner.sw {
    bottom: -6px;
    left: -6px;
    width: 14px;
    height: 14px;
    cursor: nesw-resize;
  }
  .corner.se {
    bottom: -6px;
    right: -6px;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
  }
</style>
