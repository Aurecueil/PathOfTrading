<!-- src/routes/+page.svelte -->
<script lang="ts">
  import Tile from "$lib/SearchTile.svelte";
  import FilterDrawer from "$lib/FilterDrawer.svelte";
  import type { SearchTile, FormSubmitData } from "$lib/types";

  let scale: number = 1;
  let offsetX: number = 0;
  let offsetY: number = 0;
  let isPanning: boolean = false;
  let panStart = { x: 0, y: 0 };
  let isLocked: boolean = false;
  let snapToGrid: boolean = false;

  const GRID_SIZE = 40;

  function snap(val: number, step: number = GRID_SIZE): number {
    return Math.round(val / step) * step;
  }

  let tiles: SearchTile[] = [
    {
      id: 1,
      x: 100,
      y: 100,
      w: 380,
      h: 300,
      title: "",
      displayName: "",
      realm: "poe",
      layoutMode: "list",
      loading: false,
      results: [],
      fetchedItems: [],
      payload: null,
      fullPayload: null,
      sort: "price_asc",
    },
  ];

  let nextId = 2;
  let tileRefs: Record<number, Tile> = {};
  let drawerRef: FilterDrawer | null = null;
  let activeTileId: number | null = null;
  $: activeTile = tiles.find((t) => t.id === activeTileId);

  function screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - offsetX) / scale,
      y: (sy - offsetY) / scale,
    };
  }
  let viewportEl: HTMLDivElement;

  function addTile() {
    const width = viewportEl?.clientWidth ?? window.innerWidth;
    const height = viewportEl?.clientHeight ?? window.innerHeight;
    const center = screenToWorld(width / 2, height / 2);

    const rawX = center.x - 190;
    const rawY = center.y - 150;

    const newTile: SearchTile = {
      id: nextId++,
      x: snapToGrid ? snap(rawX) : Math.round(rawX),
      y: snapToGrid ? snap(rawY) : Math.round(rawY),
      w: snapToGrid ? snap(380) : 380,
      h: snapToGrid ? snap(300) : 300,
      title: "",
      displayName: "",
      realm: "poe",
      layoutMode: "list",
      loading: false,
      results: [],
      fetchedItems: [],
      payload: null,
      fullPayload: null,
      sort: "price_asc",
    };
    tiles = [...tiles, newTile];
  }

  function removeTile(id: number) {
    if (activeTileId === id) {
      activeTileId = null;
    }
    tiles = tiles.filter((t) => t.id !== id);
    delete tileRefs[id];
  }

  // Seamless switch: saves pending edits without triggering a search
  function handleOpenFilters(tileId: number) {
    if (activeTileId !== null && activeTileId !== tileId) {
      drawerRef?.saveWithoutSearch();
    }
    activeTileId = tileId;
  }

  function nonPassiveWheel(node: HTMLElement) {
    function handleWheel(e: WheelEvent) {
      if (isLocked) return;

      // Hard check: prevent viewport zoom if wheel event occurs inside the drawer
      const target = e.target as HTMLElement;
      if (target.closest(".drawer")) return;

      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newScale = Math.min(Math.max(0.2, scale * zoomFactor), 4);
      const world = screenToWorld(e.clientX, e.clientY);

      scale = newScale;
      offsetX = e.clientX - world.x * scale;
      offsetY = e.clientY - world.y * scale;
    }

    node.addEventListener("wheel", handleWheel, { passive: false });
    return {
      destroy() {
        node.removeEventListener("wheel", handleWheel);
      },
    };
  }

  function onPointerDown(e: PointerEvent) {
    if (isLocked || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".drawer") || target.closest(".toolbar")) return;

    if (
      target.classList.contains("viewport") ||
      target.classList.contains("world")
    ) {
      isPanning = true;
      panStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning) return;
    offsetX = e.clientX - panStart.x;
    offsetY = e.clientY - panStart.y;
  }

  function onPointerUp(e: PointerEvent) {
    if (!isPanning) return;
    isPanning = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  // Saves changes without executing trade search (triggered during seamless tile switch)
  function handleSaveOnly(e: CustomEvent<any>) {
    if (activeTileId === null) return;
    const { title, displayName, realm, payload, full_payload, sort } = e.detail;

    tiles = tiles.map((t) =>
      t.id === activeTileId
        ? {
            ...t,
            title: title ?? "",
            displayName: displayName ?? "",
            realm,
            payload,
            fullPayload: full_payload,
            sort: sort ?? t.sort,
          }
        : t,
    );
  }

  // Saves changes and performs trade search
  function handleFormSubmit(e: CustomEvent<any>) {
    if (activeTileId === null) return;
    const { title, displayName, realm, payload, full_payload, sort } = e.detail;
    const targetId = activeTileId;

    tiles = tiles.map((t) =>
      t.id === targetId
        ? {
            ...t,
            title: title ?? "",
            displayName: displayName ?? "",
            realm,
            payload,
            fullPayload: full_payload,
            sort: sort ?? t.sort,
          }
        : t,
    );

    const ref = tileRefs[targetId];
    activeTileId = null;
    ref?.runSearchWithPayload(payload);
  }
</script>

<div
  class="viewport"
  bind:this={viewportEl}
  role="region"
  aria-label="Canvas Workspace"
  tabindex="0"
  use:nonPassiveWheel
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={onPointerUp}
  style:background-size="{GRID_SIZE * scale}px {GRID_SIZE * scale}px"
  style:background-position="{offsetX}px {offsetY}px"
>
  <div class="toolbar" on:pointerdown|stopPropagation>
    <button type="button" class="btn-primary" on:click={addTile}>
      + Add Tile
    </button>
    <button
      type="button"
      class:active={snapToGrid}
      on:click={() => (snapToGrid = !snapToGrid)}
    >
      Snap: {snapToGrid ? "GRID (40px)" : "FREE"}
    </button>
    <button type="button" on:click={() => (isLocked = !isLocked)}>
      Canvas: {isLocked ? "LOCKED" : "UNLOCKED"}
    </button>
    <button
      type="button"
      on:click={() => {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
      }}
    >
      Reset View
    </button>
  </div>

  <div
    class="world"
    style:transform="translate({offsetX}px, {offsetY}px) scale({scale})"
  >
    {#each tiles as tile (tile.id)}
      <Tile
        bind:this={tileRefs[tile.id]}
        bind:tile
        {scale}
        {snapToGrid}
        gridSize={GRID_SIZE}
        on:openfilters={() => handleOpenFilters(tile.id)}
        on:delete={() => removeTile(tile.id)}
      />
    {/each}
  </div>

  {#if activeTile}
    {#key activeTile.id}
      <FilterDrawer
        bind:this={drawerRef}
        initialTitle={activeTile.title}
        initialDisplayName={activeTile.displayName || ""}
        initialRealm={activeTile.realm}
        initialPayload={activeTile.fullPayload || activeTile.payload || null}
        initialSort={activeTile.sort || "price_asc"}
        on:close={() => (activeTileId = null)}
        on:save_only={handleSaveOnly}
        on:save_and_search={handleFormSubmit}
      />
    {/key}
  {/if}
</div>

<style>
  .viewport {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    user-select: none;
    touch-action: none;
    background-color: #12151c;
    background-image: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.16) 1.5px,
      transparent 1.5px
    );
    cursor: grab;
    outline: none;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .viewport::-webkit-scrollbar {
    display: none;
  }
  .viewport:active {
    cursor: grabbing;
  }
  .toolbar {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 100;
    display: flex;
    gap: 0.5rem;
    background: #1e222d;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid #2e3444;
  }
  button {
    background: #2b3040;
    color: #fff;
    border: none;
    padding: 0.45rem 0.85rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.15s ease;
  }
  button:hover {
    background: #3b4257;
  }
  button.active {
    background: #238636;
  }
  button.active:hover {
    background: #2ea043;
  }
  .btn-primary {
    background: #3a57e8;
  }
  .btn-primary:hover {
    background: #2d45c5;
  }
  .world {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    width: 0;
    height: 0;
  }
</style>
