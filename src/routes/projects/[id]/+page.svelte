<!-- src/routes/+page.svelte -->
<script lang="ts">
  import Tile from "$lib/SearchTile.svelte";
  import FilterDrawer from "$lib/FilterForm.svelte";
  import CanvasToolbar from "$lib/viewport/CanvasToolbar.svelte";
  import TileContextMenu from "$lib/viewport/TileContextMenu.svelte";
  import CanvasShape from "$lib/viewport/CanvasShape.svelte";
  import CanvasTitle from "$lib/viewport/TileContextMenu.svelte";
  import CanvasRichText from "$lib/viewport/CanvasRichText.svelte";
  import type {
    SearchTile,
    ToolType,
    CanvasAnnotation,
  } from "$lib/types/types";

  type TileState = SearchTile;

  interface CanvasSnapshot {
    tiles: TileState[];
    annotations: CanvasAnnotation[];
  }

  const GRID_SIZE = 40;
  const MAX_HISTORY = 50;

  let scale: number = 1;
  let offsetX: number = 0;
  let offsetY: number = 0;
  let isPanning: boolean = false;
  let panStart = { x: 0, y: 0 };
  let isLocked: boolean = false;
  let snapToGrid: boolean = true;
  let activeTool: ToolType = "move";

  function snap(val: number, step: number = GRID_SIZE): number {
    return snapToGrid ? Math.round(val / step) * step : Math.round(val);
  }

  function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  let tiles: TileState[] = [
    {
      id: 1,
      x: 120,
      y: 120,
      w: 440,
      h: 680,
      title: "",
      displayName: "",
      realm: "poe",
      league: "Standard",
      disabled: false,
      loading: false,
      results: [],
      payload: {
        query: {
          status: { option: "securable" },
          stats: [{ type: "and", filters: [] }],
        },
        sort: { price: "asc" },
      },
      full_payload: {
        query: {
          status: { option: "securable" },
          stats: [{ type: "and", filters: [] }],
        },
        sort: { price: "asc" },
      },
    },
  ];

  let annotations: CanvasAnnotation[] = [];
  let nextId = 2;
  let tileRefs: Record<string | number, Tile> = {};
  let drawerRef: FilterDrawer | null = null;
  let activeTileId: string | number | null = null;
  $: activeTile = tiles.find((t) => t.id === activeTileId);

  // Unified selection set
  let selectedIds: Set<string | number> = new Set();

  // Undo / Redo stacks & Clipboard
  let undoStack: CanvasSnapshot[] = [];
  let redoStack: CanvasSnapshot[] = [];
  let clipboard: CanvasSnapshot | null = null;

  function saveSnapshot() {
    undoStack = [
      ...undoStack.slice(-(MAX_HISTORY - 1)),
      {
        tiles: deepClone(tiles.map((t) => ({ ...t, loading: false }))),
        annotations: deepClone(annotations),
      },
    ];
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);

    redoStack = [
      ...redoStack,
      {
        tiles: deepClone(tiles.map((t) => ({ ...t, loading: false }))),
        annotations: deepClone(annotations),
      },
    ];

    tiles = prev.tiles;
    annotations = prev.annotations;
    selectedIds = new Set();
    contextMenu = null;
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);

    undoStack = [
      ...undoStack,
      {
        tiles: deepClone(tiles.map((t) => ({ ...t, loading: false }))),
        annotations: deepClone(annotations),
      },
    ];

    tiles = next.tiles;
    annotations = next.annotations;
    selectedIds = new Set();
    contextMenu = null;
  }

  function copySelected() {
    if (selectedIds.size === 0) return;
    const copiedTiles = deepClone(
      tiles
        .filter((t) => selectedIds.has(t.id))
        .map((t) => ({
          ...t,
          loading: false,
          searchId: undefined,
          results: [],
        })),
    );
    const copiedAnnotations = deepClone(
      annotations.filter((a) => selectedIds.has(a.id)),
    );
    if (copiedTiles.length === 0 && copiedAnnotations.length === 0) return;
    clipboard = { tiles: copiedTiles, annotations: copiedAnnotations };
  }

  function cutSelected() {
    if (selectedIds.size === 0) return;
    copySelected();
    deleteSelected();
  }

  function pasteClipboard() {
    if (!clipboard) return;
    if (clipboard.tiles.length === 0 && clipboard.annotations.length === 0) {
      return;
    }

    saveSnapshot();

    const newSelected = new Set<string | number>();
    const offset = GRID_SIZE;

    const pastedTiles: TileState[] = clipboard.tiles.map((t) => {
      const newId = nextId++;
      newSelected.add(newId);
      return {
        ...deepClone(t),
        id: newId,
        x: snap(t.x + offset),
        y: snap(t.y + offset),
        loading: false,
      };
    });

    const pastedAnnotations: CanvasAnnotation[] = clipboard.annotations.map(
      (a) => {
        const newId = nextId++;
        newSelected.add(newId);
        return {
          ...deepClone(a),
          id: newId,
          x: snap(a.x + offset),
          y: snap(a.y + offset),
          autoEdit: false,
        };
      },
    );

    // Shift clipboard slightly so repeated Ctrl+V cascades neatly
    clipboard = {
      tiles: clipboard.tiles.map((t) => ({
        ...t,
        x: t.x + offset,
        y: t.y + offset,
      })),
      annotations: clipboard.annotations.map((a) => ({
        ...a,
        x: a.x + offset,
        y: a.y + offset,
      })),
    };

    tiles = [...tiles, ...pastedTiles];
    annotations = [...annotations, ...pastedAnnotations];
    selectedIds = newSelected;
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return;
    saveSnapshot();
    for (const id of selectedIds) {
      if (activeTileId === id) {
        activeTileId = null;
      }
      delete tileRefs[id];
    }
    tiles = tiles.filter((t) => !selectedIds.has(t.id));
    annotations = annotations.filter((a) => !selectedIds.has(a.id));
    selectedIds = new Set();
    contextMenu = null;
  }

  // Marquee selection state
  let isSelecting: boolean = false;
  let marqueeStart = { x: 0, y: 0 };
  let marqueeEnd = { x: 0, y: 0 };

  // Corner-to-corner creation state
  let isCreatingObject: boolean = false;
  let createStart = { x: 0, y: 0 };
  let creatingItemId: number | null = null;

  // Group drag state
  let dragInitialPositions: Map<string | number, { x: number; y: number }> =
    new Map();
  let dragMoved: boolean = false;
  let preDragSnapshot: CanvasSnapshot | null = null;

  // Right-click context menu state
  let contextMenu: {
    x: number;
    y: number;
    targetTileIds: (string | number)[];
    realm: string;
    league: string;
  } | null = null;

  function screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - offsetX) / scale,
      y: (sy - offsetY) / scale,
    };
  }
  let viewportEl: HTMLDivElement;

  function addTile() {
    saveSnapshot();
    const width = viewportEl?.clientWidth ?? window.innerWidth;
    const height = viewportEl?.clientHeight ?? window.innerHeight;
    const center = screenToWorld(width / 2, height / 2);

    const rawX = center.x - 210;
    const rawY = center.y - 160;

    const newTile: TileState = {
      id: nextId++,
      x: snap(rawX),
      y: snap(rawY),
      w: snap(440),
      h: snap(680),
      title: "",
      displayName: "",
      realm: "poe",
      league: "Standard",
      disabled: false,
      loading: false,
      results: [],
      payload: {
        query: {
          status: { option: "securable" },
          stats: [{ type: "and", filters: [] }],
        },
        sort: { price: "asc" },
      },
      full_payload: {
        query: {
          status: { option: "securable" },
          stats: [{ type: "and", filters: [] }],
        },
        sort: { price: "asc" },
      },
    };
    tiles = [...tiles, newTile];
    selectedIds = new Set([newTile.id]);
  }

  function removeTile(id: string | number) {
    saveSnapshot();
    if (activeTileId === id) {
      activeTileId = null;
    }
    tiles = tiles.filter((t) => t.id !== id);
    delete tileRefs[id];
    selectedIds.delete(id);
    selectedIds = new Set(selectedIds);
  }

  function selectItem(id: string | number, shiftKey: boolean = false) {
    if (shiftKey) {
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
      } else {
        selectedIds.add(id);
      }
      selectedIds = new Set(selectedIds);
    } else if (!selectedIds.has(id)) {
      selectedIds = new Set([id]);
    }
  }

  function startGroupDrag() {
    dragMoved = false;
    preDragSnapshot = {
      tiles: deepClone(tiles.map((t) => ({ ...t, loading: false }))),
      annotations: deepClone(annotations),
    };
    dragInitialPositions.clear();
    for (const t of tiles) {
      if (selectedIds.has(t.id)) {
        dragInitialPositions.set(t.id, { x: t.x, y: t.y });
      }
    }
    for (const a of annotations) {
      if (selectedIds.has(a.id)) {
        dragInitialPositions.set(a.id, { x: a.x, y: a.y });
      }
    }
  }

  function moveGroupDrag(dx: number, dy: number) {
    if (!dragMoved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      dragMoved = true;
      if (preDragSnapshot) {
        undoStack = [...undoStack.slice(-(MAX_HISTORY - 1)), preDragSnapshot];
        redoStack = [];
      }
    }

    tiles = tiles.map((t) => {
      const init = dragInitialPositions.get(t.id);
      if (!init) return t;
      return {
        ...t,
        x: snap(init.x + dx),
        y: snap(init.y + dy),
      };
    });

    annotations = annotations.map((a) => {
      const init = dragInitialPositions.get(a.id);
      if (!init) return a;
      return {
        ...a,
        x: snap(init.x + dx),
        y: snap(init.y + dy),
      };
    });
  }

  function endGroupDrag() {
    dragInitialPositions.clear();
    preDragSnapshot = null;
    dragMoved = false;
  }

  function handleOpenFilters(tileId: string | number, e?: Event) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (activeTileId !== null && activeTileId !== tileId) {
      drawerRef?.saveWithoutSearch();
    }
    activeTileId = tileId;
  }

  function nonPassiveWheel(node: HTMLElement) {
    function handleWheel(e: WheelEvent) {
      if (isLocked) return;

      const target = e.target as HTMLElement;
      if (target.closest(".drawer") || target.closest(".context-menu")) return;

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
    contextMenu = null;
    const target = e.target as HTMLElement;
    if (
      target.closest(".drawer") ||
      target.closest(".toolbar") ||
      target.closest(".context-menu")
    ) {
      return;
    }

    (document.activeElement as HTMLElement)?.blur();

    // Middle mouse button (scroll click) pans the viewport
    if (e.button === 1) {
      if (isLocked) return;
      e.preventDefault();
      isPanning = true;
      panStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    const isCanvasBg =
      target.classList.contains("viewport") ||
      target.classList.contains("world");

    if (!isCanvasBg) return;

    const worldPt = screenToWorld(e.clientX, e.clientY);

    if (activeTool === "move") {
      isSelecting = true;
      marqueeStart = { x: worldPt.x, y: worldPt.y };
      marqueeEnd = { x: worldPt.x, y: worldPt.y };
      if (!e.shiftKey) {
        selectedIds = new Set();
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      saveSnapshot();
      isCreatingObject = true;
      const startX = snap(worldPt.x);
      const startY = snap(worldPt.y);
      createStart = { x: startX, y: startY };

      const id = nextId++;
      creatingItemId = id;

      const newAnnotation: CanvasAnnotation = {
        id,
        kind: activeTool,
        x: startX,
        y: startY,
        w: GRID_SIZE,
        h: GRID_SIZE,
        color: "#3a57e8", // Default blue for both titles and shapes
        thickness: activeTool === "title" ? 4 : 3,
        text:
          activeTool === "title"
            ? "New Title"
            : activeTool === "richtext"
              ? ""
              : "",
        flipX: false,
        flipY: false,
        autoEdit: activeTool === "title" || activeTool === "richtext",
      };

      annotations = [...annotations, newAnnotation];
      selectedIds = new Set([id]);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (isPanning) {
      offsetX = e.clientX - panStart.x;
      offsetY = e.clientY - panStart.y;
      return;
    }

    if (isSelecting) {
      marqueeEnd = screenToWorld(e.clientX, e.clientY);
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

      const nextSelected = new Set<string | number>();

      for (const t of tiles) {
        if (
          t.x + t.w >= minX &&
          t.x <= maxX &&
          t.y + t.h >= minY &&
          t.y <= maxY
        ) {
          nextSelected.add(t.id);
        }
      }
      for (const a of annotations) {
        if (
          a.x + a.w >= minX &&
          a.x <= maxX &&
          a.y + a.h >= minY &&
          a.y <= maxY
        ) {
          nextSelected.add(a.id);
        }
      }
      selectedIds = nextSelected;
      return;
    }

    if (isCreatingObject && creatingItemId !== null) {
      const worldPt = screenToWorld(e.clientX, e.clientY);
      const curX = snap(worldPt.x);
      const curY = snap(worldPt.y);

      const minX = Math.min(createStart.x, curX);
      const minY = Math.min(createStart.y, curY);
      const rawW = Math.abs(curX - createStart.x);
      const rawH = Math.abs(curY - createStart.y);

      annotations = annotations.map((a) => {
        if (a.id !== creatingItemId) return a;
        return {
          ...a,
          x: minX,
          y: minY,
          w: rawW,
          h: rawH,
          flipX: curX < createStart.x,
          flipY: curY < createStart.y,
        };
      });
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (isPanning) {
      isPanning = false;
    }
    if (isSelecting) {
      isSelecting = false;
    }
    if (isCreatingObject) {
      isCreatingObject = false;
      annotations = annotations.map((a) => {
        if (a.id !== creatingItemId) return a;
        if (a.kind === "title" && a.w < 120) {
          return { ...a, w: 240, h: Math.max(a.h, 48) };
        }
        if (a.kind === "richtext" && (a.w < 160 || a.h < 80)) {
          return { ...a, w: Math.max(a.w, 260), h: Math.max(a.h, 140) };
        }
        if (
          (a.kind === "box" || a.kind === "circle" || a.kind === "arrow") &&
          a.w < 10 &&
          a.h < 10
        ) {
          return { ...a, w: 80, h: 80 };
        }
        return a;
      });
      creatingItemId = null;
      activeTool = "move";
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  function onWindowKeyDown(e: KeyboardEvent) {
    // Allow Escape to close the FilterDrawer (saving without search) even if an input inside it is focused
    if (e.key === "Escape" && activeTileId !== null) {
      e.preventDefault();
      drawerRef?.saveWithoutSearch();
      activeTileId = null;
      return;
    }

    const activeEl = document.activeElement;
    const isTextInputFocused =
      activeEl &&
      (activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable);

    if (isTextInputFocused || activeTileId !== null) return;

    const isMod = e.ctrlKey || e.metaKey;

    if (isMod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if (isMod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }

    if (isMod && e.key.toLowerCase() === "c") {
      e.preventDefault();
      copySelected();
      return;
    }

    if (isMod && e.key.toLowerCase() === "x") {
      e.preventDefault();
      cutSelected();
      return;
    }

    if (isMod && e.key.toLowerCase() === "v") {
      e.preventDefault();
      pasteClipboard();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedIds.size === 0) return;
      e.preventDefault();
      deleteSelected();
    } else if (e.key === "Enter") {
      if (selectedIds.size === 0) return;
      e.preventDefault();
      for (const t of tiles) {
        if (selectedIds.has(t.id) && !t.disabled) {
          tileRefs[t.id]?.executeSearch();
        }
      }
    }
  }

  function handleTileContextMenu(
    tileId: string | number,
    detail: { clientX: number; clientY: number },
  ) {
    if (!selectedIds.has(tileId)) {
      selectedIds = new Set([tileId]);
    }
    const targetTileIds = tiles
      .filter((t) => selectedIds.has(t.id))
      .map((t) => t.id);

    const primaryTile = tiles.find((t) => t.id === tileId);
    contextMenu = {
      x: detail.clientX,
      y: detail.clientY,
      targetTileIds,
      realm: primaryTile?.realm || "poe",
      league: primaryTile?.league || "Standard",
    };
  }

  function toggleDisableSelectedTiles() {
    if (!contextMenu) return;
    saveSnapshot();
    const targets = new Set(contextMenu.targetTileIds);
    const allDisabled = tiles
      .filter((t) => targets.has(t.id))
      .every((t) => t.disabled);

    const nextDisabled = !allDisabled;
    tiles = tiles.map((t) =>
      targets.has(t.id) ? { ...t, disabled: nextDisabled } : t,
    );
    contextMenu = null;
  }

  function applyRealmAndLeagueToSelected(
    e: CustomEvent<{ realm: string; league: string }>,
  ) {
    if (!contextMenu) return;
    saveSnapshot();
    const targets = new Set(contextMenu.targetTileIds);
    const { realm, league } = e.detail;

    tiles = tiles.map((t) => {
      if (!targets.has(t.id)) return t;
      return {
        ...t,
        realm,
        league,
        payload: t.payload ? { ...t.payload, league } : t.payload,
        full_payload: t.full_payload
          ? { ...t.full_payload, league }
          : t.full_payload,
      };
    });
    contextMenu = null;
  }

  function handleSaveOnly(e: CustomEvent<any>) {
    if (activeTileId === null) return;
    saveSnapshot();
    const { title, displayName, realm, league, payload, full_payload } =
      e.detail;

    const effectivePayload = payload ? { ...payload, league } : payload;
    const effectiveFullPayload = full_payload
      ? { ...full_payload, league }
      : full_payload;

    tiles = tiles.map((t) =>
      t.id === activeTileId
        ? {
            ...t,
            title: title ?? "",
            displayName: displayName ?? "",
            realm,
            league: league ?? t.league,
            payload: effectivePayload,
            full_payload: effectiveFullPayload,
          }
        : t,
    );
  }

  function handleFormSubmit(e: CustomEvent<any>) {
    if (activeTileId === null) return;
    saveSnapshot();
    const { title, displayName, realm, league, payload, full_payload, close } =
      e.detail;
    const targetId = activeTileId;

    const effectivePayload = payload ? { ...payload, league } : payload;
    const effectiveFullPayload = full_payload
      ? { ...full_payload, league }
      : full_payload;

    tiles = tiles.map((t) =>
      t.id === targetId
        ? {
            ...t,
            title: title ?? "",
            displayName: displayName ?? "",
            realm,
            league: league ?? t.league,
            payload: effectivePayload,
            full_payload: effectiveFullPayload,
          }
        : t,
    );

    if (close !== false) {
      activeTileId = null;
    }

    const ref = tileRefs[targetId];
    ref?.executeSearch(effectivePayload);
  }

  $: marqueeRect = {
    x: Math.min(marqueeStart.x, marqueeEnd.x),
    y: Math.min(marqueeStart.y, marqueeEnd.y),
    w: Math.abs(marqueeEnd.x - marqueeStart.x),
    h: Math.abs(marqueeEnd.y - marqueeStart.y),
  };

  $: contextMenuAllDisabled = contextMenu
    ? tiles
        .filter((t) => contextMenu?.targetTileIds.includes(t.id))
        .every((t) => t.disabled)
    : false;
</script>

<svelte:window on:keydown={onWindowKeyDown} />

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="viewport"
  class:panning={isPanning}
  class:crosshair={activeTool !== "move"}
  bind:this={viewportEl}
  role="region"
  aria-label="Canvas Workspace"
  tabindex="0"
  use:nonPassiveWheel
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={onPointerUp}
  on:contextmenu|preventDefault
  style:background-size="{GRID_SIZE * scale}px {GRID_SIZE * scale}px"
  style:background-position="{offsetX}px {offsetY}px"
>
  <CanvasToolbar
    bind:activeTool
    bind:snapToGrid
    bind:isLocked
    gridSize={GRID_SIZE}
    on:addtile={addTile}
  />

  <div
    class="world"
    style:transform="translate({offsetX}px, {offsetY}px) scale({scale})"
  >
    {#each annotations as item (item.id)}
      {#if item.kind === "arrow" || item.kind === "box" || item.kind === "circle"}
        <CanvasShape
          bind:item
          {scale}
          {snapToGrid}
          gridSize={GRID_SIZE}
          selected={selectedIds.has(item.id)}
          on:select={(e) => selectItem(item.id, e.detail.shiftKey)}
          on:dragstart={startGroupDrag}
          on:dragmove={(e) => moveGroupDrag(e.detail.dx, e.detail.dy)}
          on:dragend={endGroupDrag}
          on:change={saveSnapshot}
        />
      {:else if item.kind === "title"}
        <CanvasTitle
          bind:item
          {scale}
          {snapToGrid}
          gridSize={GRID_SIZE}
          selected={selectedIds.has(item.id)}
          on:select={(e) => selectItem(item.id, e.detail.shiftKey)}
          on:dragstart={startGroupDrag}
          on:dragmove={(e) => moveGroupDrag(e.detail.dx, e.detail.dy)}
          on:dragend={endGroupDrag}
          on:change={saveSnapshot}
        />
      {:else if item.kind === "richtext"}
        <CanvasRichText
          bind:item
          {scale}
          {snapToGrid}
          gridSize={GRID_SIZE}
          selected={selectedIds.has(item.id)}
          on:select={(e) => selectItem(item.id, e.detail.shiftKey)}
          on:dragstart={startGroupDrag}
          on:dragmove={(e) => moveGroupDrag(e.detail.dx, e.detail.dy)}
          on:dragend={endGroupDrag}
          on:change={saveSnapshot}
        />
      {/if}
    {/each}

    {#each tiles as tile (tile.id)}
      <Tile
        bind:this={tileRefs[tile.id]}
        bind:tile
        {scale}
        {snapToGrid}
        gridSize={GRID_SIZE}
        selected={selectedIds.has(tile.id)}
        disabled={tile.disabled ?? false}
        on:select={(e) => selectItem(tile.id, e.detail.shiftKey)}
        on:dragstart={startGroupDrag}
        on:dragmove={(e) => moveGroupDrag(e.detail.dx, e.detail.dy)}
        on:dragend={endGroupDrag}
        on:resize={saveSnapshot}
        on:openfilters={(e) => handleOpenFilters(tile.id, e)}
        on:delete={() => removeTile(tile.id)}
        on:contextmenu={(e) => handleTileContextMenu(tile.id, e.detail)}
      />
    {/each}

    {#if isSelecting}
      <div
        class="marquee-box"
        style:transform="translate({marqueeRect.x}px, {marqueeRect.y}px)"
        style:width="{marqueeRect.w}px"
        style:height="{marqueeRect.h}px"
      ></div>
    {/if}
  </div>

  {#if contextMenu}
    <TileContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      targetCount={contextMenu.targetTileIds.length}
      allDisabled={contextMenuAllDisabled}
      bind:realm={contextMenu.realm}
      bind:league={contextMenu.league}
      on:toggledisable={toggleDisableSelectedTiles}
      on:applyrealmleague={applyRealmAndLeagueToSelected}
    />
  {/if}

  {#if activeTile}
    {#key activeTile.id}
      <FilterDrawer
        bind:this={drawerRef}
        initialTitle={activeTile.title}
        initialDisplayName={activeTile.displayName || ""}
        initialRealm={activeTile.realm === "poe2" ? "poe2" : "poe"}
        initialLeague={activeTile.league || ""}
        initialPayload={activeTile.full_payload || activeTile.payload || null}
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
    cursor: default;
    outline: none;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .viewport.panning {
    cursor: grabbing;
  }
  .viewport.crosshair {
    cursor: crosshair;
  }
  .viewport::-webkit-scrollbar {
    display: none;
  }
  .world {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    width: 0;
    height: 0;
  }
  .marquee-box {
    position: absolute;
    top: 0;
    left: 0;
    background: rgba(58, 87, 232, 0.18);
    border: 1.5px solid #3a57e8;
    border-radius: 2px;
    pointer-events: none;
    z-index: 90;
  }
</style>
