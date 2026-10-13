<!-- src/lib/SearchTile.svelte -->
<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import type { SearchTile, PoETradeItemEntry } from "$lib/types";
  import SearchItemRow from "./SearchItemRow.svelte";

  export let tile: SearchTile;
  export let scale: number = 1;
  export let snapToGrid: boolean = false;
  export let gridSize: number = 40;

  const dispatch = createEventDispatcher<{
    openfilters: void;
    delete: void;
  }>();

  type SearchMode = "regular" | "live" | "mixed";
  type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

  interface DisplayEntry {
    id: string;
    data: PoETradeItemEntry | null;
    sortValue: any;
    isLive?: boolean;
  }

  const MIN_W = 260;
  const MIN_H = 180;
  const BATCH_SIZE = 10;

  let mode: SearchMode = "regular";
  let isLiveActive: boolean = false;
  let isLiveConnecting: boolean = false;
  let isFetchingMore: boolean = false;

  let itemsMap: Map<string, DisplayEntry> = new Map();
  let displayedItems: DisplayEntry[] = [];

  let unlistenItems: UnlistenFn | null = null;
  let unlistenStatus: UnlistenFn | null = null;
  let bodyElement: HTMLDivElement | null = null;

  function snap(val: number): number {
    return snapToGrid ? Math.round(val / gridSize) * gridSize : Math.round(val);
  }

  $: activePayload = tile.payload;

  // Resolve league from tile property, payload, or fallback
  $: currentLeague = (tile as any)?.league ?? activePayload?.league ?? "";

  $: defaultRealmTitle =
    tile.realm?.toLowerCase() === "poe2"
      ? "Poe2 Trade Search"
      : "Poe Trade Search";

  $: displayTitle = tile.displayName?.trim() || defaultRealmTitle;

  function getSortConfig(): { field: string; dir: "asc" | "desc" } {
    const sortObj = activePayload?.sort;
    if (!sortObj || typeof sortObj !== "object") {
      return { field: "price", dir: "asc" };
    }
    const [field, dir] = Object.entries(sortObj)[0] || ["price", "asc"];
    return {
      field,
      dir: String(dir).toLowerCase() === "desc" ? "desc" : "asc",
    };
  }

  function extractSortValue(entry: PoETradeItemEntry, field: string): any {
    if (!entry) return null;
    if (field === "price") {
      return entry.listing?.price?.amount ?? null;
    }
    if (field in entry) return (entry as any)[field];
    if (entry.item && field in entry.item) return (entry.item as any)[field];
    if (entry.listing && field in entry.listing)
      return (entry.listing as any)[field];
    return null;
  }

  function sortDisplayList() {
    const { dir } = getSortConfig();
    displayedItems = [...displayedItems].sort((a, b) => {
      const valA = a.sortValue;
      const valB = b.sortValue;

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === "number" && typeof valB === "number") {
        return dir === "asc" ? valA - valB : valB - valA;
      }
      return dir === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }

  export async function executeSearch(payload?: any) {
    const payloadToRun = payload || activePayload;
    if (!payloadToRun) return;

    if (payload) {
      tile.payload = payload;
    }

    if (isLiveActive || isLiveConnecting) {
      await stopLive();
    }

    tile.loading = true;

    try {
      const rawResponse: string = await invoke("search_items", {
        realm: tile.realm,
        payload: payloadToRun,
        cacheOk: false,
      });

      const data =
        typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse;

      tile.searchId = data.id;
      tile.results = data.result || [];
      tile = tile; // Trigger reactive updates across child components

      // Wipe previous items when response arrives
      itemsMap.clear();
      displayedItems = [];

      if (mode === "regular" || mode === "mixed") {
        const initialBatch = tile.results.slice(0, BATCH_SIZE);
        for (const id of initialBatch) {
          const entry: DisplayEntry = { id, data: null, sortValue: null };
          itemsMap.set(id, entry);
          displayedItems.push(entry);
        }
        displayedItems = [...displayedItems];

        if (initialBatch.length > 0 && tile.searchId) {
          await fetchBatch(initialBatch, tile.searchId);
        }
      }

      if (mode === "live" || mode === "mixed") {
        await startLive();
      }
    } catch (err) {
      console.error(`[SearchTile ${tile.id}] Search error:`, err);
    } finally {
      tile.loading = false;
    }
  }

  async function fetchBatch(
    ids: string[],
    queryId: string,
    isLiveItem: boolean = false,
  ) {
    if (!ids.length) return;

    const minCount = Math.ceil(ids.length / 2);

    try {
      const data: any = await invoke("fetch_items", {
        job: {
          id: queryId,
          ids,
          min: minCount,
          wait_ms: 100,
          cache_ok: false,
          reservation: null,
          realm: tile.realm,
        },
      });

      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const fetchedResults: PoETradeItemEntry[] = parsed.result || [];
      const { field } = getSortConfig();

      for (const itemData of fetchedResults) {
        const id = itemData.id;
        const sortVal = extractSortValue(itemData, field);

        if (itemsMap.has(id)) {
          const existing = itemsMap.get(id)!;
          existing.data = itemData;
          existing.sortValue = sortVal;
        } else {
          const newEntry: DisplayEntry = {
            id,
            data: itemData,
            sortValue: sortVal,
            isLive: isLiveItem,
          };
          itemsMap.set(id, newEntry);

          if (mode === "live") {
            displayedItems.unshift(newEntry);
          } else {
            displayedItems.push(newEntry);
          }
        }
      }

      if (mode === "mixed") {
        sortDisplayList();
      } else {
        displayedItems = [...displayedItems];
      }
    } catch (err) {
      console.error(`[SearchTile ${tile.id}] Fetch batch error:`, err);
    }
  }

  async function handleScroll(e: Event) {
    if (mode === "live" || isFetchingMore || !tile.searchId) return;

    const el = e.currentTarget as HTMLElement;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (distanceToBottom < 100) {
      const currentCount = displayedItems.length;
      if (currentCount >= tile.results.length) return;

      const nextBatchIds = tile.results.slice(
        currentCount,
        currentCount + BATCH_SIZE,
      );
      if (!nextBatchIds.length) return;

      isFetchingMore = true;

      for (const id of nextBatchIds) {
        if (!itemsMap.has(id)) {
          const entry: DisplayEntry = { id, data: null, sortValue: null };
          itemsMap.set(id, entry);
          displayedItems.push(entry);
        }
      }
      displayedItems = [...displayedItems];

      await fetchBatch(nextBatchIds, tile.searchId);
      isFetchingMore = false;
    }
  }

  async function startLive() {
    if (!tile.searchId) return;
    isLiveConnecting = true;

    try {
      unlistenStatus = await listen<boolean>(
        `live-status-${tile.id}`,
        (event) => {
          if (event.payload) {
            isLiveActive = true;
            isLiveConnecting = false;
          }
        },
      );

      unlistenItems = await listen<{ tile_id: string; item_ids: string[] }>(
        `live-items-${tile.id}`,
        async (event) => {
          const ids = event.payload.item_ids;
          if (ids && ids.length > 0 && tile.searchId) {
            if (mode === "live") {
              for (let i = ids.length - 1; i >= 0; i--) {
                const id = ids[i];
                if (!itemsMap.has(id)) {
                  const entry: DisplayEntry = {
                    id,
                    data: null,
                    sortValue: null,
                    isLive: true,
                  };
                  itemsMap.set(id, entry);
                  displayedItems.unshift(entry);
                }
              }
              displayedItems = [...displayedItems];
            }
            await fetchBatch(ids, tile.searchId, true);
          }
        },
      );

      await invoke("start_live_search", {
        tileId: String(tile.id),
        realm: tile.realm,
        queryId: tile.searchId,
      });

      isLiveActive = true;
    } catch (err) {
      console.error(
        `[SearchTile ${tile.id}] Failed to start live search:`,
        err,
      );
      await stopLive();
    } finally {
      isLiveConnecting = false;
    }
  }

  async function stopLive() {
    try {
      await invoke("stop_live_search", { tileId: String(tile.id) });
    } catch (err) {
      console.error(`[SearchTile ${tile.id}] Failed to stop live search:`, err);
    } finally {
      isLiveActive = false;
      isLiveConnecting = false;
      if (unlistenItems) {
        unlistenItems();
        unlistenItems = null;
      }
      if (unlistenStatus) {
        unlistenStatus();
        unlistenStatus = null;
      }
    }
  }

  async function toggleLiveButton() {
    if (isLiveActive) {
      await stopLive();
    } else {
      if (!tile.searchId) {
        await executeSearch();
      } else {
        await startLive();
      }
    }
  }

  onDestroy(() => {
    if (isLiveActive || isLiveConnecting) {
      stopLive();
    }
  });

  function onHeaderPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = tile.x;
    const initY = tile.y;

    function onPointerMove(ev: PointerEvent) {
      tile.x = snap(initX + (ev.clientX - startX) / scale);
      tile.y = snap(initY + (ev.clientY - startY) / scale);
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

      if (dir.includes("e")) nextW = Math.max(MIN_W, snap(initW + dx));
      else if (dir.includes("w")) {
        let targetLeft = snap(initX + dx);
        if (rightEdge - targetLeft < MIN_W) targetLeft = rightEdge - MIN_W;
        nextX = targetLeft;
        nextW = rightEdge - targetLeft;
      }

      if (dir.includes("s")) nextH = Math.max(MIN_H, snap(initH + dy));
      else if (dir.includes("n")) {
        let targetTop = snap(initY + dy);
        if (bottomEdge - targetTop < MIN_H) targetTop = bottomEdge - MIN_H;
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
      <select
        class="mode-select"
        bind:value={mode}
        disabled={tile.loading || isLiveConnecting}
      >
        <option value="regular">Regular</option>
        <option value="live">Live</option>
        <option value="mixed">Mixed</option>
      </select>

      {#if mode !== "regular"}
        <button
          type="button"
          class="live-btn"
          class:active={isLiveActive}
          disabled={tile.loading || isLiveConnecting || !activePayload}
          on:click|stopPropagation={toggleLiveButton}
        >
          <span class="live-dot" class:pulsing={isLiveActive}></span>
          {isLiveActive ? "Live" : "Start"}
        </button>
      {/if}

      <button
        type="button"
        class="search-btn"
        disabled={tile.loading || isLiveConnecting || !activePayload}
        on:click|stopPropagation={() => executeSearch()}
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

  <div
    class="tile-body"
    bind:this={bodyElement}
    on:scroll={handleScroll}
    on:wheel|stopPropagation
  >
    {#if tile.loading}
      <div class="search-overlay">
        <span class="spin">↻</span>
        <span>Searching market...</span>
      </div>
    {/if}

    {#if displayedItems.length === 0 && !tile.loading}
      <div class="status-msg empty">
        {#if isLiveConnecting}
          Connecting to live socket...
        {:else if isLiveActive}
          Waiting for live listings...
        {:else}
          No search executed or no items found.
        {/if}
      </div>
    {:else}
      <div class="item-list">
        {#each displayedItems as itemEntry (itemEntry.id)}
          <SearchItemRow
            id={itemEntry.id}
            data={itemEntry.data}
            sortValue={itemEntry.sortValue}
            realm={tile.realm}
            league={currentLeague}
            searchId={tile.searchId ?? ""}
          />
        {/each}

        {#if isFetchingMore}
          <div class="fetching-more">Loading more results...</div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Resizers -->
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
  .mode-select {
    background: #2b3040;
    color: #cbd5e1;
    border: 1px solid #374151;
    font-size: 0.72rem;
    padding: 0.15rem 0.3rem;
    border-radius: 4px;
    outline: none;
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
  .actions button.live-btn {
    background: #1f2937;
    color: #9ca3af;
    border: 1px solid #374151;
  }
  .actions button.live-btn.active {
    background: #7f1d1d;
    color: #fca5a5;
    border-color: #ef4444;
  }
  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #6b7280;
    display: inline-block;
  }
  .live-dot.pulsing {
    background: #ef4444;
    box-shadow: 0 0 6px #ef4444;
    animation: pulse 1.2s infinite ease-in-out;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.3;
      transform: scale(0.8);
    }
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
  .search-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    z-index: 10;
    color: #94a3b8;
    font-size: 0.8rem;
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
  .fetching-more {
    text-align: center;
    font-size: 0.72rem;
    color: #64748b;
    padding: 0.3rem 0;
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
