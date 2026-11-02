<!-- src/routes/projects/[id]/+page.svelte -->
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { page } from "$app/stores";
  import { onMount, onDestroy, tick, setContext } from "svelte";
  import Tile from "$lib/SearchTile.svelte";
  import FilterDrawer from "$lib/FilterForm.svelte";
  import CanvasToolbar from "$lib/viewport/CanvasToolbar.svelte";
  import TileContextMenu from "$lib/viewport/TileContextMenu.svelte";
  import CanvasShape from "$lib/viewport/CanvasShape.svelte";
  import CanvasTitle from "$lib/viewport/CanvasTitle.svelte";
  import CanvasRichText from "$lib/viewport/CanvasRichText.svelte";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import {
    openTabs,
    workspaceState,
    loadProjectFromBackend,
    saveProjectToBackend,
    setProjectDirty,
    isProjectDirty,
    getSessionCamera,
    setSessionCamera,
    requestProjectName,
    registerCanvasHandlers,
    unregisterCanvasHandlers,
    isAnnotationItem,
    serializeTileForSave,
    serializeAnnotationForSave,
  } from "$lib/project/projects.svelte";
  import type {
    SearchTile,
    ToolType,
    CanvasAnnotation,
    ProjectItem,
    SavedProject,
    ShareCodePayload,
  } from "$lib/types/types";
  import { migrateItemRef } from "$lib/trade/utilis/tradePayload";
  import {
    normalizeTileExtras,
    normalizeDisplayOptions,
    normalizeCurrency,
    normalizeSearchOnLoad,
  } from "$lib/trade/components/drawer/tileDisplay";
  import {
    authState,
    currentLanguage,
    isLoading,
    itemsPoe,
    itemsPoe2,
    canvasBgPath,
    canvasBgOpacity,
  } from "$lib/trade/tradeStore";
  import type { Realm } from "$lib/types/leagues";

  function resolveBgUrl(rawPath: string): string {
    const trimmed = rawPath.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("asset:") ||
      trimmed.startsWith("blob:")
    ) {
      return trimmed;
    }
    return convertFileSrc(trimmed);
  }

  $: resolvedBgUrl = resolveBgUrl($canvasBgPath);

  interface CanvasSnapshot {
    tiles: SearchTile[];
    annotations: CanvasAnnotation[];
  }

  const GRID_SIZE = 40;
  const MAX_HISTORY = 50;
  const AUTOSAVE_INTERVAL_MS = 25000;

  let tpTileId: string | number | null = null;
  let tpMessage = "";
  let tpMessageTimer: ReturnType<typeof setTimeout> | undefined;
  let unlistenTp: UnlistenFn | undefined;
  function toggleTpTile(id: string | number) {
    tpTileId = tpTileId === id ? null : id;
  }

  // logged out or tile deleted -> no teleport tile
  $: if (
    !$authState ||
    (tpTileId !== null && !tiles.some((t) => t.id === tpTileId))
  ) {
    tpTileId = null;
  }
  // Rust unregisters the hotkey when nothing is active
  $: if (tpTileId === null) {
    invoke("tp_set_active", { active: null }).catch(() => {});
  }

  function showTpMessage(msg: string) {
    tpMessage = msg;
    clearTimeout(tpMessageTimer);
    tpMessageTimer = setTimeout(() => (tpMessage = ""), 3000);
  }

  let currentProjectId: string = "";
  let currentProjectName: string = "";
  let currentProjectRealm: Realm = "pc";
  let currentProjectLeague: string = "Standard";
  let isHydratingProject: boolean = false;

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
    if (obj === undefined || obj === null) return obj;
    return JSON.parse(JSON.stringify(obj));
  }

  let tiles: SearchTile[] = [];
  let annotations: CanvasAnnotation[] = [];
  let nextId = 1;
  let tileRefs: Record<string | number, Tile> = {};
  let drawerRef: FilterDrawer | null = null;
  let activeTileId: string | number | null = null;
  $: activeTile = tiles.find((t) => t.id === activeTileId);

  let selectedIds: Set<string | number> = new Set();

  let undoStack: CanvasSnapshot[] = [];
  let redoStack: CanvasSnapshot[] = [];
  let clipboard: CanvasSnapshot | null = null;
  let autoSaveTimer: ReturnType<typeof setInterval> | undefined;

  let zOrder: Map<string | number, number> = new Map();
  let zCounter = 0;

  function bringToFront(ids: (string | number)[]) {
    if (ids.length === 0) return;
    const next = new Map(zOrder);
    // keep the relative order of a multi-selection
    const sorted = [...ids].sort(
      (a, b) => (next.get(a) ?? 0) - (next.get(b) ?? 0),
    );
    for (const id of sorted) next.set(id, ++zCounter);
    zOrder = next; // reassign so Svelte reacts
  }

  function makeTileId(): string {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    return `tile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function syncNextId(currentAnnotations: CanvasAnnotation[]) {
    for (const a of currentAnnotations) {
      if (typeof a.id === "number" && a.id >= nextId) {
        nextId = a.id + 1;
      }
    }
  }

  function blurActiveInput() {
    const activeEl = document.activeElement as HTMLElement | null;
    if (
      activeEl &&
      activeEl !== viewportEl &&
      !activeEl.closest(".drawer") &&
      !activeEl.closest(".context-menu")
    ) {
      activeEl.blur();
    }
  }

  function migrateTileItems() {
    let changedAny = false;
    for (const t of tiles) {
      if (!t.full_payload) continue;
      const { payload, changed } = migrateItemRef(
        t.full_payload,
        t.realm || "poe",
        $currentLanguage,
      );
      if (!changed) continue;
      t.full_payload = payload;
      t.payload = ""; // force the regular payload to rebuild
      changedAny = true;
    }
    if (changedAny) {
      tiles = tiles;
      markDirty();
    }
  }

  // runs after hydration, after catalogs finish (re)loading, and on any tile/realm change
  $: if (
    !isHydratingProject &&
    !$isLoading &&
    $currentLanguage &&
    $itemsPoe &&
    $itemsPoe2 &&
    tiles
  ) {
    migrateTileItems();
  }
  // Sync camera movements into session memory without marking project dirty
  $: if (!isHydratingProject && currentProjectId) {
    setSessionCamera(currentProjectId, { scale, offsetX, offsetY });
  }

  $: routeProjectId = $page.params.id;
  $: if (routeProjectId && routeProjectId !== currentProjectId) {
    loadWorkspaceForProject(routeProjectId);
  }

  async function loadWorkspaceForProject(id: string) {
    isHydratingProject = true;
    currentProjectId = id;
    workspaceState.activeProjectId = id;
    activeTileId = null;
    contextMenu = null;
    selectedIds = new Set();
    undoStack = [];
    redoStack = [];
    tiles = [];
    annotations = [];
    tileRefs = {};

    let loaded: SavedProject;
    try {
      loaded = await loadProjectFromBackend(id);
    } catch {
      const existingTab = openTabs.find((t) => t.id === id);
      loaded = {
        id,
        name: existingTab?.name ?? "",
        realm: existingTab?.realm || "pc",
        league: "Standard",
        camera: { scale: 1, offsetX: 0, offsetY: 0 },
        updated_at: Date.now(),
        items: [],
      };
    }

    currentProjectName = loaded.name ?? "";
    currentProjectRealm = loaded.realm || "poe";
    currentProjectLeague = loaded.league || "Standard";
    workspaceState.activeProjectRealm = currentProjectRealm;
    workspaceState.activeProjectLeague = currentProjectLeague;

    // Restore camera from session memory if visited in session, else from saved file
    const sessionCam = getSessionCamera(id);
    const initialCam = sessionCam ??
      loaded.camera ?? { scale: 1, offsetX: 0, offsetY: 0 };
    scale = initialCam.scale || 1;
    offsetX = initialCam.offsetX ?? 0;
    offsetY = initialCam.offsetY ?? 0;
    setSessionCamera(id, { scale, offsetX, offsetY });

    const existingTab = openTabs.find((t) => t.id === id);
    if (!existingTab) {
      openTabs.push({
        id: loaded.id,
        name: currentProjectName,
        realm: currentProjectRealm,
        dirty: false,
      });
    } else {
      existingTab.name = currentProjectName;
      existingTab.realm = currentProjectRealm;
    }

    let idCounter = 1;
    zOrder = new Map();
    zCounter = 0;
    const hydratedZ = new Map<string | number, number>();
    const hydratedTiles: SearchTile[] = [];
    const hydratedAnnotations: CanvasAnnotation[] = [];

    for (const item of loaded.items || []) {
      if (isAnnotationItem(item)) {
        const assignedId = item.id ? Number(item.id) : idCounter++;
        idCounter = Math.max(idCounter, assignedId + 1);
        hydratedAnnotations.push({
          ...deepClone(item),
          id: assignedId,
          autoEdit: false,
        });
        hydratedZ.set(assignedId, ++zCounter);
      } else {
        const tileUniqueId = makeTileId();
        const tileRealm = item.realm || currentProjectRealm;
        const tileLeague = item.league || currentProjectLeague;
        const clonedFullPayload = deepClone(
          item.full_payload ?? {
            league: tileLeague,
            query: {
              status: { option: "securable" },
              stats: [{ type: "and", filters: [] }],
            },
            sort: { price: "asc" },
          },
        );
        if (
          tileLeague &&
          clonedFullPayload &&
          typeof clonedFullPayload === "object"
        ) {
          clonedFullPayload.league = tileLeague;
        }
        hydratedTiles.push({
          id: tileUniqueId,
          x: item.x ?? 120,
          y: item.y ?? 120,
          w: item.w ?? 440,
          h: item.h ?? 680,
          realm: tileRealm,
          league: tileLeague,
          title: item.title || "",
          displayName: item.title || "",
          disabled: Boolean(item.disabled),
          mode: item.mode ?? "live",
          loading: false,
          results: [],
          payload: "",
          full_payload: clonedFullPayload,
          // displayOptions / currency / searchOnLoad (defaults for old saves)
          ...normalizeTileExtras(item),
        });
        hydratedZ.set(tileUniqueId, ++zCounter);
      }
    }
    zOrder = hydratedZ;
    nextId = idCounter;
    tiles = hydratedTiles;
    annotations = hydratedAnnotations;

    await tick();
    isHydratingProject = false;

    // Run cached search & fetch (cache_ok = true) for non-disabled tiles that opted in.
    // executeSearch also starts live mode, so searchOnLoad=false tiles won't auto-connect.
    for (const t of tiles) {
      if (!t.disabled && t.searchOnLoad) {
        tileRefs[t.id]?.executeSearch(undefined, true);
      }
    }
  }

  function buildProjectItems(onlySelected = false): ProjectItem[] {
    const targetTiles = onlySelected
      ? tiles.filter((t) => selectedIds.has(t.id))
      : tiles;
    const targetAnnotations = onlySelected
      ? annotations.filter((a) => selectedIds.has(a.id))
      : annotations;

    return [
      ...targetAnnotations.map((a) => ({
        z: zOrder.get(a.id) ?? 0,
        item: serializeAnnotationForSave(a),
      })),
      ...targetTiles.map((t) => ({
        z: zOrder.get(t.id) ?? 0,
        item: serializeTileForSave(t),
      })),
    ]
      .sort((a, b) => a.z - b.z)
      .map((e) => e.item);
  }

  function buildShareCodePayload(
    onlySelected: boolean = false,
  ): ShareCodePayload {
    return {
      camera: { scale, offsetX, offsetY },
      realm: currentProjectRealm,
      league: currentProjectLeague,
      items: buildProjectItems(onlySelected),
    };
  }

  async function saveCurrentProject(): Promise<boolean> {
    if (!currentProjectId) return false;

    if (!currentProjectName.trim()) {
      const enteredName = await requestProjectName();
      if (!enteredName) return false;
      currentProjectName = enteredName;
    }

    const payload: SavedProject = {
      id: currentProjectId,
      name: currentProjectName,
      realm: currentProjectRealm,
      league: currentProjectLeague,
      camera: { scale, offsetX, offsetY },
      updated_at: Date.now(),
      items: buildProjectItems(false),
    };
    await saveProjectToBackend(payload);
    setProjectDirty(currentProjectId, false);
    return true;
  }

  function handleSetProjectDefaults(realm: Realm, league: string) {
    currentProjectRealm = realm;
    currentProjectLeague = league;
    markDirty();
  }

  async function importElementsIntoCanvas(items: ProjectItem[]) {
    if (!items.length) return;
    saveSnapshot();

    const newSelection = new Set<string | number>();
    const addedTiles: SearchTile[] = [];
    const addedAnnotations: CanvasAnnotation[] = [];

    for (const item of items) {
      if (isAnnotationItem(item)) {
        const assignedId = nextId++;
        newSelection.add(assignedId);
        addedAnnotations.push({
          ...deepClone(item),
          id: assignedId,
          x: snap((item.x ?? 120) + GRID_SIZE),
          y: snap((item.y ?? 120) + GRID_SIZE),
          autoEdit: false,
        });
      } else {
        const assignedId = makeTileId();
        newSelection.add(assignedId);
        const tileRealm = item.realm || currentProjectRealm;
        const tileLeague = item.league || currentProjectLeague;
        const clonedFullPayload = deepClone(
          item.full_payload ?? {
            league: tileLeague,
            query: {
              status: { option: "securable" },
              stats: [{ type: "and", filters: [] }],
            },
            sort: { price: "asc" },
          },
        );
        if (
          tileLeague &&
          clonedFullPayload &&
          typeof clonedFullPayload === "object"
        ) {
          clonedFullPayload.league = tileLeague;
        }
        addedTiles.push({
          id: assignedId,
          x: snap((item.x ?? 120) + GRID_SIZE),
          y: snap((item.y ?? 120) + GRID_SIZE),
          w: snap(item.w ?? 440),
          h: snap(item.h ?? 680),
          realm: tileRealm,
          league: tileLeague,
          title: item.title || "",
          displayName: item.title || "",
          disabled: Boolean(item.disabled),
          mode: item.mode ?? "regular",
          loading: false,
          results: [],
          payload: "",
          full_payload: clonedFullPayload,
          // displayOptions / currency / searchOnLoad (defaults for old share codes)
          ...normalizeTileExtras(item),
        });
      }
    }

    tiles = [...tiles, ...addedTiles];
    annotations = [...annotations, ...addedAnnotations];
    selectedIds = newSelection;
    bringToFront([...newSelection]);
    await tick();
    for (const t of addedTiles) {
      if (!t.disabled && t.searchOnLoad) {
        tileRefs[t.id]?.executeSearch(undefined, true);
      }
    }
  }

  onMount(() => {
    listen<{ tile_id: string; status: string; message: string }>(
      "tp-status",
      (e) => showTpMessage(e.payload.message),
    ).then((u) => (unlistenTp = u));
    registerCanvasHandlers({
      save: saveCurrentProject,
      importElements: importElementsIntoCanvas,
      exportPayload: buildShareCodePayload,
      setProjectDefaults: handleSetProjectDefaults,
    });

    // Periodic Auto-Save for named projects with unsaved changes
    autoSaveTimer = setInterval(async () => {
      if (
        currentProjectId &&
        currentProjectName.trim().length > 0 &&
        isProjectDirty(currentProjectId) &&
        !isCreatingObject &&
        !isPanning &&
        dragInitialPositions.size === 0
      ) {
        await saveCurrentProject();
      }
    }, AUTOSAVE_INTERVAL_MS);
  });

  onDestroy(() => {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    unregisterCanvasHandlers();
  });

  function markDirty() {
    if (!isHydratingProject && currentProjectId) {
      setProjectDirty(currentProjectId, true);
    }
  }

  function createCurrentSnapshot(): CanvasSnapshot {
    return {
      tiles: deepClone(tiles.map((t) => ({ ...t, loading: false }))),
      annotations: deepClone(
        annotations.map((a) => ({ ...a, autoEdit: false })),
      ),
    };
  }

  function saveSnapshot() {
    markDirty();
    undoStack = [
      ...undoStack.slice(-(MAX_HISTORY - 1)),
      createCurrentSnapshot(),
    ];
    redoStack = [];
  }

  async function undo() {
    if (undoStack.length === 0) return;
    markDirty();
    const prev = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);

    redoStack = [...redoStack, createCurrentSnapshot()];

    const existingMap = new Map(tiles.map((t) => [t.id, t]));
    tiles = prev.tiles.map((snapTile) => {
      const live = existingMap.get(snapTile.id);
      const restored = deepClone(snapTile);
      // Preserve live search results if the tile was already on the canvas
      if (live && live.results?.length) {
        restored.results = live.results;
      }
      return restored;
    });
    annotations = deepClone(prev.annotations);
    syncNextId(annotations);
    if (activeTileId !== null && !tiles.some((t) => t.id === activeTileId)) {
      activeTileId = null;
    }
    selectedIds = new Set();
    contextMenu = null;

    await tick();
    for (const t of tiles) {
      if (
        !t.disabled &&
        t.searchOnLoad &&
        (!t.results || t.results.length === 0)
      ) {
        tileRefs[t.id]?.executeSearch(undefined, true);
      }
    }
  }

  async function redo() {
    if (redoStack.length === 0) return;
    markDirty();
    const next = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);

    undoStack = [...undoStack, createCurrentSnapshot()];

    const existingMap = new Map(tiles.map((t) => [t.id, t]));
    tiles = next.tiles.map((snapTile) => {
      const live = existingMap.get(snapTile.id);
      const restored = deepClone(snapTile);
      if (live && live.results?.length) {
        restored.results = live.results;
      }
      return restored;
    });
    annotations = deepClone(next.annotations);
    syncNextId(annotations);
    if (activeTileId !== null && !tiles.some((t) => t.id === activeTileId)) {
      activeTileId = null;
    }
    selectedIds = new Set();
    contextMenu = null;

    await tick();
    for (const t of tiles) {
      if (
        !t.disabled &&
        t.searchOnLoad &&
        (!t.results || t.results.length === 0)
      ) {
        tileRefs[t.id]?.executeSearch(undefined, true);
      }
    }
  }

  function copySelected() {
    if (selectedIds.size === 0) return;
    const copiedTiles = deepClone(
      tiles
        .filter((t) => selectedIds.has(t.id))
        .map((t) => ({
          ...t,
          loading: false,
        })),
    );
    const copiedAnnotations = deepClone(
      annotations
        .filter((a) => selectedIds.has(a.id))
        .map((a) => ({
          ...a,
          autoEdit: false,
        })),
    );
    if (copiedTiles.length === 0 && copiedAnnotations.length === 0) return;
    clipboard = { tiles: copiedTiles, annotations: copiedAnnotations };
  }

  function cutSelected() {
    if (selectedIds.size === 0) return;
    copySelected();
    deleteSelected();
  }

  async function pasteClipboard() {
    if (!clipboard) return;
    if (clipboard.tiles.length === 0 && clipboard.annotations.length === 0) {
      return;
    }

    saveSnapshot();

    const newSelected = new Set<string | number>();
    const offset = GRID_SIZE;

    const pastedTiles: SearchTile[] = clipboard.tiles.map((t) => {
      const newId = makeTileId();
      newSelected.add(newId);
      const cloned = deepClone(t);
      return {
        ...cloned,
        id: newId,
        x: snap(t.x + offset),
        y: snap(t.y + offset),
        loading: false,
        results: cloned.results ? deepClone(cloned.results) : [],
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
    bringToFront([...newSelected]);
    await tick();
    for (const t of pastedTiles) {
      if (
        !t.disabled &&
        t.searchOnLoad &&
        (!t.results || t.results.length === 0)
      ) {
        tileRefs[t.id]?.executeSearch(undefined, true);
      }
    }
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return;
    saveSnapshot();
    const toDelete = new Set(selectedIds);
    if (activeTileId !== null && toDelete.has(activeTileId)) {
      activeTileId = null;
    }
    tiles = tiles.filter((t) => !toDelete.has(t.id));
    annotations = annotations.filter((a) => !toDelete.has(a.id));
    selectedIds = new Set();
    contextMenu = null;
  }

  let isSelecting: boolean = false;
  let marqueeStart = { x: 0, y: 0 };
  let marqueeEnd = { x: 0, y: 0 };
  let marqueeAdditiveBase: Set<string | number> = new Set();

  let isCreatingObject: boolean = false;
  let createStart = { x: 0, y: 0 };
  let creatingItemId: number | null = null;

  let dragInitialPositions: Map<string | number, { x: number; y: number }> =
    new Map();
  let dragMoved: boolean = false;
  let preDragSnapshot: CanvasSnapshot | null = null;

  let contextMenu: {
    x: number;
    y: number;
    targetTileIds: (string | number)[];
    realm: Realm;
    league: string;
  } | null = null;

  let worldEl: HTMLDivElement;

  // Visible area of the viewport, in world coordinates
  function getVisibleWorldBounds() {
    const w = viewportEl?.clientWidth ?? window.innerWidth;
    const h = viewportEl?.clientHeight ?? window.innerHeight;
    return {
      minX: -offsetX / scale,
      minY: -offsetY / scale,
      maxX: (w - offsetX) / scale,
      maxY: (h - offsetY) / scale,
    };
  }

  setContext("canvasWorld", {
    getWorld: () => worldEl ?? null,
    screenToWorld,
    getVisibleWorldBounds,
  });

  let viewportEl: HTMLDivElement;

  function getViewportCoords(clientX: number, clientY: number) {
    if (!viewportEl) return { x: clientX, y: clientY };
    const rect = viewportEl.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function screenToWorld(clientX: number, clientY: number) {
    const vp = getViewportCoords(clientX, clientY);
    return {
      x: (vp.x - offsetX) / scale,
      y: (vp.y - offsetY) / scale,
    };
  }

  function addTile() {
    saveSnapshot();
    const rect = viewportEl?.getBoundingClientRect();
    const centerClientX = rect
      ? rect.left + rect.width / 2
      : window.innerWidth / 2;
    const centerClientY = rect
      ? rect.top + rect.height / 2
      : window.innerHeight / 2;
    const center = screenToWorld(centerClientX, centerClientY);

    const rawX = center.x - 340;
    const rawY = center.y - 460;

    const tileRealm = currentProjectRealm;
    const tileLeague = currentProjectLeague;

    const defaultFullPayload = {
      league: tileLeague,
      query: {
        status: { option: "securable" },
        stats: [{ type: "and", filters: [] }],
      },
      sort: { price: "asc" },
    };

    const newTile: SearchTile = {
      id: makeTileId(),
      x: snap(rawX),
      y: snap(rawY),
      w: snap(880),
      h: snap(760),
      title: "",
      displayName: "",
      realm: tileRealm,
      league: tileLeague,
      disabled: false,
      mode: "regular",
      loading: false,
      results: [],
      payload: "",
      full_payload: deepClone(defaultFullPayload),
      // defaults: all mods shown, chaos, search on load
      ...normalizeTileExtras(null),
    };
    tiles = [...tiles, newTile];
    bringToFront([newTile.id]);
    blurActiveInput();
  }

  function removeTile(id: string | number) {
    saveSnapshot();
    if (activeTileId === id) {
      activeTileId = null;
    }
    // Clean up refs and runtime cache so they don't bleed into other tiles
    delete tileRefs[id];
    // If you can import cloneTileRuntimeCache or clear cache, do it here:
    // tileRuntimeCache.delete(id);

    tiles = tiles.filter((t) => t.id !== id);
    selectedIds.delete(id);
  }

  function selectItem(id: string | number, shiftKey = false) {
    contextMenu = null;
    blurActiveInput();
    if (shiftKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        bringToFront([id]);
      }
      selectedIds = next;
    } else {
      if (!selectedIds.has(id)) selectedIds = new Set([id]);
      bringToFront([id]);
    }
  }

  function startGroupDrag(draggedId?: string | number) {
    blurActiveInput();
    if (draggedId !== undefined && !selectedIds.has(draggedId)) {
      selectedIds = new Set([draggedId]);
    }
    bringToFront([...selectedIds]);

    dragMoved = false;
    preDragSnapshot = createCurrentSnapshot();
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
    if (dragInitialPositions.size === 0) return;

    if (!dragMoved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      dragMoved = true;
      markDirty();
      if (preDragSnapshot) {
        undoStack = [...undoStack.slice(-(MAX_HISTORY - 1)), preDragSnapshot];
        redoStack = [];
        preDragSnapshot = null;
      }
    }

    // Mutate x/y in place on the existing objects so child component instances & state are never recreated
    for (const t of tiles) {
      const init = dragInitialPositions.get(t.id);
      if (init) {
        t.x = snap(init.x + dx);
        t.y = snap(init.y + dy);
      }
    }
    tiles = tiles;

    for (const a of annotations) {
      const init = dragInitialPositions.get(a.id);
      if (init) {
        a.x = snap(init.x + dx);
        a.y = snap(init.y + dy);
      }
    }
    annotations = annotations;
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
    bringToFront([tileId]);
  }

  function nonPassiveWheel(node: HTMLElement) {
    function handleWheel(e: WheelEvent) {
      const isCtrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;

      if (!isCtrl) {
        // Without Ctrl: only zoom if we are directly on the empty canvas background
        const isCanvasBg =
          target === viewportEl ||
          target.classList.contains("viewport") ||
          target.classList.contains("world");

        if (!isCanvasBg) return; // Let tiles/drawers scroll normally
      }

      // Block browser zoom and stop child elements from receiving the wheel event
      e.preventDefault();
      e.stopPropagation();

      if (isLocked) return;

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newScale = Math.min(Math.max(0.2, scale * zoomFactor), 4);
      const vp = getViewportCoords(e.clientX, e.clientY);
      const worldX = (vp.x - offsetX) / scale;
      const worldY = (vp.y - offsetY) / scale;

      scale = newScale;
      offsetX = vp.x - worldX * scale;
      offsetY = vp.y - worldY * scale;
    }

    const options: AddEventListenerOptions = { passive: false, capture: true };
    node.addEventListener("wheel", handleWheel, options);
    return {
      destroy() {
        node.removeEventListener("wheel", handleWheel, options);
      },
    };
  }
  function onPointerDown(e: PointerEvent) {
    contextMenu = null;
    const target = e.target as HTMLElement;

    if (e.button === 1) {
      if (isLocked) return;
      e.preventDefault();
      isPanning = true;
      const vp = getViewportCoords(e.clientX, e.clientY);
      panStart = { x: vp.x - offsetX, y: vp.y - offsetY };
      (viewportEl as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (
      target.closest(".drawer") ||
      target.closest(".toolbar") ||
      target.closest(".context-menu")
    ) {
      return;
    }

    blurActiveInput();

    if (e.button !== 0) return;

    const isCanvasBg =
      target === viewportEl ||
      target.classList.contains("viewport") ||
      target.classList.contains("world");

    if (!isCanvasBg) return;

    const worldPt = screenToWorld(e.clientX, e.clientY);

    if (activeTool === "move") {
      isSelecting = true;
      marqueeStart = { x: worldPt.x, y: worldPt.y };
      marqueeEnd = { x: worldPt.x, y: worldPt.y };
      if (e.shiftKey) {
        marqueeAdditiveBase = new Set(selectedIds);
      } else {
        marqueeAdditiveBase = new Set();
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
        color: "#3a57e8",
        thickness: activeTool === "title" ? 4 : 12,
        text: activeTool === "title" ? "New Title" : "",
        flipX: false,
        flipY: false,
        autoEdit: activeTool === "title" || activeTool === "richtext",
      };

      annotations = [...annotations, newAnnotation];
      selectedIds = new Set([id]);
      bringToFront([id]);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (isPanning) {
      const vp = getViewportCoords(e.clientX, e.clientY);
      offsetX = vp.x - panStart.x;
      offsetY = vp.y - panStart.y;
      return;
    }

    if (isSelecting) {
      marqueeEnd = screenToWorld(e.clientX, e.clientY);
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

      const nextSelected = new Set<string | number>(marqueeAdditiveBase);

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
      marqueeAdditiveBase = new Set();
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
    const activeEl = document.activeElement as HTMLElement | null;
    const isTextInputFocused =
      activeEl &&
      (activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        activeEl.isContentEditable ||
        Boolean(activeEl.closest?.('[contenteditable="true"]')));

    if (isTextInputFocused || workspaceState.namePrompt !== null) {
      return;
    }

    // If FilterDrawer is open, FilterForm handles Escape itself
    if (e.key === "Escape") {
      if (activeTileId !== null) return;
      if (contextMenu !== null) {
        contextMenu = null;
        return;
      }
      if (selectedIds.size > 0) {
        selectedIds = new Set();
        return;
      }
    }

    const isInsideDrawer = Boolean(activeEl?.closest?.(".drawer"));
    const isMod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const code = e.code;

    if (isMod && (key === "z" || code === "KeyZ")) {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if (isMod && (key === "y" || code === "KeyY")) {
      e.preventDefault();
      redo();
      return;
    }

    if (isMod && (key === "c" || code === "KeyC")) {
      e.preventDefault();
      copySelected();
      return;
    }

    if (isMod && (key === "x" || code === "KeyX")) {
      e.preventDefault();
      cutSelected();
      return;
    }

    if (isMod && (key === "v" || code === "KeyV")) {
      e.preventDefault();
      pasteClipboard();
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedIds.size === 0 || isInsideDrawer) return;
      e.preventDefault();
      deleteSelected();
    } else if (e.key === "Enter") {
      // If drawer is open and focused, let FilterForm handle Enter/Shift+Enter
      if (isInsideDrawer || selectedIds.size === 0) return;
      e.preventDefault();
      for (const t of tiles) {
        if (selectedIds.has(t.id) && !t.disabled) {
          tileRefs[t.id]?.executeSearch(undefined, false);
        }
      }
    }
  }

  function handleTileContextMenu(
    tileId: string | number,
    detail: { clientX: number; clientY: number },
  ) {
    blurActiveInput();
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
      realm: primaryTile?.realm || currentProjectRealm,
      league: primaryTile?.league || currentProjectLeague,
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
    for (const t of tiles) {
      if (targets.has(t.id)) {
        t.disabled = nextDisabled;
      }
    }
    tiles = tiles;
    contextMenu = null;
  }

  function applyRealmAndLeagueToSelected(
    e: CustomEvent<{ realm: Realm; league: string }>,
  ) {
    if (!contextMenu) return;
    saveSnapshot();
    const targets = new Set(contextMenu.targetTileIds);
    const { realm, league } = e.detail;

    for (const t of tiles) {
      if (targets.has(t.id)) {
        const realmChanged = t.realm !== realm;
        t.realm = realm;
        t.league = league;

        if (realmChanged) {
          // regular payload was built for the old realm: drop it so the next
          // search rebuilds it from full_payload for the new realm
          t.payload = "";
          t.results = [];
          t.searchId = undefined;
        } else if (t.payload && typeof t.payload === "object") {
          // league-only change keeps the payload, just retargets the league
          t.payload = { ...t.payload, league };
        }

        if (t.full_payload && typeof t.full_payload === "object") {
          t.full_payload = { ...t.full_payload, league };
        }
      }
    }
    tiles = tiles;
    contextMenu = null;
  }

  function handleSaveOnly(e: CustomEvent<any>) {
    if (activeTileId === null) return;
    markDirty();
    const {
      title,
      displayName,
      realm,
      league,
      payload,
      full_payload,
      displayOptions,
      currency,
      searchOnLoad,
    } = e.detail;

    const resolvedTitle = displayName?.trim() || title?.trim() || "";
    const effectiveLeague = league || currentProjectLeague;
    const effectivePayload =
      payload && typeof payload === "object"
        ? { ...payload, league: effectiveLeague }
        : payload;
    const effectiveFullPayload =
      full_payload && typeof full_payload === "object"
        ? { ...full_payload, league: effectiveLeague }
        : effectivePayload;

    const target = tiles.find((t) => t.id === activeTileId);
    if (target) {
      target.title = resolvedTitle;
      target.displayName = resolvedTitle;
      target.realm = realm || target.realm;
      target.league = effectiveLeague;
      target.payload = effectivePayload;
      target.full_payload = effectiveFullPayload;
      target.displayOptions = normalizeDisplayOptions(displayOptions);
      target.currency = normalizeCurrency(currency);
      target.searchOnLoad = normalizeSearchOnLoad(searchOnLoad);
      tiles = tiles;
    }
  }

  async function handleFormSubmit(e: CustomEvent<any>) {
    if (activeTileId === null) return;
    saveSnapshot();
    const {
      title,
      displayName,
      realm,
      league,
      payload,
      full_payload,
      displayOptions,
      currency,
      searchOnLoad,
      close,
    } = e.detail;
    const targetId = activeTileId;

    const resolvedTitle = displayName?.trim() || title?.trim() || "";
    const effectiveLeague = league || currentProjectLeague;
    const effectivePayload =
      payload && typeof payload === "object"
        ? { ...payload, league: effectiveLeague }
        : payload;
    const effectiveFullPayload =
      full_payload && typeof full_payload === "object"
        ? { ...full_payload, league: effectiveLeague }
        : effectivePayload;

    const target = tiles.find((t) => t.id === targetId);
    if (target) {
      target.title = resolvedTitle;
      target.displayName = resolvedTitle;
      target.realm = realm || target.realm;
      target.league = effectiveLeague;
      target.payload = effectivePayload;
      target.full_payload = effectiveFullPayload;
      target.displayOptions = normalizeDisplayOptions(displayOptions);
      target.currency = normalizeCurrency(currency);
      target.searchOnLoad = normalizeSearchOnLoad(searchOnLoad);
      tiles = tiles;
    }

    if (close !== false) {
      activeTileId = null;
    }

    await tick();
    const ref = tileRefs[targetId];
    // Explicit user search: always runs, regardless of searchOnLoad
    ref?.executeSearch(effectivePayload, false);
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
  on:pointercancel={onPointerUp}
  on:dragstart|preventDefault
  on:contextmenu|preventDefault
>
  {#if resolvedBgUrl}
    <div
      class="viewport-bg-image"
      style:background-image="url('{resolvedBgUrl}')"
      style:opacity={$canvasBgOpacity}
    ></div>
  {/if}

  <div
    class="viewport-grid"
    style:background-size="{GRID_SIZE * scale}px {GRID_SIZE * scale}px"
    style:background-position="{offsetX}px {offsetY}px"
  ></div>
  <CanvasToolbar
    bind:activeTool
    bind:snapToGrid
    bind:isLocked
    gridSize={GRID_SIZE}
    on:addtile={addTile}
  />

  <div
    class="world"
    bind:this={worldEl}
    style:transform="translate({offsetX}px, {offsetY}px) scale({scale})"
  >
    {#each annotations as item (item.id)}
      {#if item.kind === "arrow" || item.kind === "box" || item.kind === "circle"}
        <CanvasShape
          {item}
          {scale}
          {snapToGrid}
          z={zOrder.get(item.id) ?? 0}
          gridSize={GRID_SIZE}
          selected={selectedIds.has(item.id)}
          on:select={(e) => selectItem(item.id, e.detail?.shiftKey)}
          on:dragstart={() => startGroupDrag(item.id)}
          on:dragmove={(e) => moveGroupDrag(e.detail.dx, e.detail.dy)}
          on:dragend={endGroupDrag}
          on:change={saveSnapshot}
        />
      {:else if item.kind === "title"}
        <CanvasTitle
          {item}
          {scale}
          {snapToGrid}
          z={zOrder.get(item.id) ?? 0}
          gridSize={GRID_SIZE}
          selected={selectedIds.has(item.id)}
          on:select={(e) => selectItem(item.id, e.detail?.shiftKey)}
          on:dragstart={() => startGroupDrag(item.id)}
          on:dragmove={(e) => moveGroupDrag(e.detail.dx, e.detail.dy)}
          on:dragend={endGroupDrag}
          on:change={saveSnapshot}
        />
      {:else if item.kind === "richtext"}
        <CanvasRichText
          {item}
          {scale}
          {snapToGrid}
          z={zOrder.get(item.id) ?? 0}
          gridSize={GRID_SIZE}
          selected={selectedIds.has(item.id)}
          on:select={(e) => selectItem(item.id, e.detail?.shiftKey)}
          on:dragstart={() => startGroupDrag(item.id)}
          on:dragmove={(e) => moveGroupDrag(e.detail.dx, e.detail.dy)}
          on:dragend={endGroupDrag}
          on:change={saveSnapshot}
        />
      {/if}
    {/each}

    {#each tiles as tile (tile.id)}
      <Tile
        bind:this={tileRefs[tile.id]}
        {tile}
        {scale}
        {snapToGrid}
        filtersOpen={activeTileId === tile.id}
        z={zOrder.get(tile.id) ?? 0}
        gridSize={GRID_SIZE}
        selected={selectedIds.has(tile.id)}
        disabled={tile.disabled ?? false}
        tpActive={tpTileId === tile.id}
        on:select={(e) => selectItem(tile.id, e.detail?.shiftKey)}
        on:dragstart={() => startGroupDrag(tile.id)}
        on:dragmove={(e) => moveGroupDrag(e.detail.dx, e.detail.dy)}
        on:dragend={endGroupDrag}
        on:resize={saveSnapshot}
        on:change={saveSnapshot}
        on:openfilters={(e) => handleOpenFilters(tile.id, e)}
        on:delete={() => removeTile(tile.id)}
        on:contextmenu={(e) => handleTileContextMenu(tile.id, e.detail)}
        on:tptoggle={() => toggleTpTile(tile.id)}
      />
    {/each}

    {#if isSelecting && (marqueeRect.w > 1 || marqueeRect.h > 1)}
      <div
        class="marquee-box"
        style:transform="translate3d({marqueeRect.x}px, {marqueeRect.y}px, 0)"
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
        initialTitle={activeTile.title || ""}
        initialDisplayName={activeTile.displayName || activeTile.title || ""}
        initialRealm={activeTile.realm}
        initialLeague={activeTile.league || currentProjectLeague}
        initialPayload={activeTile.full_payload ?? null}
        initialDisplayOptions={activeTile.displayOptions ?? null}
        initialCurrency={activeTile.currency}
        initialSearchOnLoad={activeTile.searchOnLoad}
        on:close={() => (activeTileId = null)}
        on:save_only={handleSaveOnly}
        on:save_and_search={handleFormSubmit}
      />
    {/key}
  {/if}
</div>

<style>
  :global(*) {
    font-family: "Fontin", sans-serif !important;
    box-sizing: border-box;
    /* Firefox custom scrollbar */
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  /* Custom WebKit Scrollbar styling matching PoB standard */
  :global(*::-webkit-scrollbar) {
    width: 12px;
    height: 12px;
  }

  :global(*::-webkit-scrollbar-track) {
    background: #000000;
  }

  :global(*::-webkit-scrollbar-thumb) {
    background: #555555;
    border-radius: 0px !important;
  }

  :global(*::-webkit-scrollbar-thumb:hover) {
    background: #777777;
  }

  :global(*::-webkit-scrollbar-corner) {
    background: #000000;
  }

  .viewport {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    background-color: #080b10;
    font-family: "Fontin", sans-serif;
    color: #d3d3d3;
    font-size: 11px;
    line-height: 1.2;
    cursor: default;
    outline: none;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .viewport-bg-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background-position: center;
    background-repeat: no-repeat;
    /* Use "cover" to fill the viewport while keeping aspect ratio, or "100% 100%" to stretch */
    background-size: cover;
    pointer-events: none;
    z-index: 0;
  }

  .viewport-grid {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background-image: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.12) 1.5px,
      transparent 1.5px
    );
    pointer-events: none;
    z-index: 0;
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
    width: 1px;
    height: 1px;
  }

  .marquee-box {
    z-index: 1000000;
    position: absolute;
    top: 0;
    left: 0;
    background: rgba(224, 224, 224, 0.12);
    border: 1px solid #777777;
    border-radius: 0px;
    pointer-events: none;
    z-index: 90;
  }
</style>
