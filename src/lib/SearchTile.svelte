<!-- src/lib/SearchTile.svelte -->
<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { buildRegularPayload } from "$lib/trade/utilis/tradePayload";
  import type {
    SearchTile,
    SearchMode,
    ResolvedDisplayStyle,
  } from "$lib/types/types";
  import type {
    TradeFetchResult,
    TradeFetchResponse,
  } from "$lib/types/tradeItem";
  import SearchItemRow from "$lib/searchTile/SearchItemRow.svelte";

  export let tile: SearchTile;
  export let scale: number = 1;
  export let snapToGrid: boolean = true;
  export let gridSize: number = 40;
  export let selected: boolean = false;
  export let disabled: boolean = false;
  export let z: number = 0;

  const dispatch = createEventDispatcher<{
    openfilters: void;
    delete: void;
    select: { shiftKey: boolean };
    dragstart: void;
    dragmove: { dx: number; dy: number };
    dragend: void;
    resize: void;
    change: void;
    contextmenu: { clientX: number; clientY: number };
  }>();

  type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

  interface DisplayEntry {
    uid: string;
    id: string;
    payload: any;
    league: string;
    data: TradeFetchResult | null;
    sortValue: any;
    isLive?: boolean;
  }

  interface LiveTokenMessage {
    result: string;
    count: number;
  }

  const MIN_W = 260;
  const MIN_H = 180;
  const BATCH_SIZE = 10;
  const MAX_RETRIES_PER_VIEW = 3;

  if (!tile.mode) {
    tile.mode = "regular";
  }

  const initialUiId = String(tile.id);
  let isDestroyed: boolean = false;

  let mode: SearchMode = tile.mode;
  let isLiveActive: boolean = false;
  let isLiveConnecting: boolean = false;
  let isFetchingMore: boolean = false;
  let lastCacheOk: boolean = false;
  let uidCounter: number = 1;

  let itemsMap: Map<string, DisplayEntry> = new Map();
  let orderedEntries: DisplayEntry[] = [];
  let displayedItems: DisplayEntry[] = [];
  let visibleCount: number = 0;

  let inFlightIds: Set<string> = new Set();
  let inViewRetryCounts: Map<string, number> = new Map();

  let unlistenItems: UnlistenFn | null = null;
  let unlistenStatus: UnlistenFn | null = null;
  let bodyElement: HTMLDivElement | null = null;

  $: {
    tile.displayStyle = "auto";
    tile.disabled = disabled;
  }

  $: if (disabled) {
    if (isLiveActive || isLiveConnecting) {
      stopLive();
    }
    if (inFlightIds.size > 0) {
      cancelUiJobs(String(tile.id));
    }
  }

  $: effectiveStyle = ((): ResolvedDisplayStyle => {
    if (tile.w < 380 || tile.h < 240) return "minimal";
    if (tile.w < 560 || tile.h < 340) return "compact";
    return "full";
  })();

  $: isNarrowHeader = tile.w < 360;

  function snap(val: number): number {
    return snapToGrid ? Math.round(val / gridSize) * gridSize : Math.round(val);
  }

  $: activePayload =
    tile.payload && typeof tile.payload === "object"
      ? tile.payload
      : tile.full_payload;
  $: currentLeague = tile.league || activePayload?.league || "";

  $: defaultRealmTitle =
    tile.realm?.toLowerCase() === "poe2" ? "PoE2 Trade" : "PoE Trade";

  $: displayTitle =
    tile.displayName?.trim() || tile.title?.trim() || defaultRealmTitle;

  async function cancelUiJobs(
    targetUiId: string = String(tile.id || initialUiId),
  ) {
    if (!targetUiId) return;
    try {
      await invoke("cancel_ui_jobs", {
        uiId: targetUiId,
        ui_id: targetUiId,
      });
    } catch (err) {
      console.error(
        `[SearchTile ${targetUiId}] Failed to cancel UI jobs:`,
        err,
      );
    }
  }

  function getEstimatedRowHeight(style: ResolvedDisplayStyle): number {
    if (style === "minimal") return 56;
    if (style === "compact") return 82;
    return 160;
  }

  function getViewportCapacity(): number {
    const viewH = bodyElement?.clientHeight || Math.max(120, tile.h - 36);
    const rowH = getEstimatedRowHeight(effectiveStyle);
    return Math.max(1, Math.ceil(viewH / rowH));
  }

  function syncDisplayedSlice() {
    const minVisible = Math.min(orderedEntries.length, getViewportCapacity());
    if (visibleCount < minVisible) {
      visibleCount = minVisible;
    } else if (visibleCount > orderedEntries.length) {
      visibleCount = orderedEntries.length;
    }
    displayedItems = orderedEntries.slice(0, visibleCount);
  }

  // Re-evaluate visible capacity when tile dimensions or effectiveStyle change
  $: if (
    !isDestroyed &&
    tile.w &&
    tile.h &&
    effectiveStyle &&
    orderedEntries.length > 0
  ) {
    const cap = getViewportCapacity();
    if (visibleCount < cap && visibleCount < orderedEntries.length) {
      visibleCount = Math.min(orderedEntries.length, cap);
      displayedItems = orderedEntries.slice(0, visibleCount);
      tick().then(() => {
        ensureInViewItemsFetched();
      });
    }
  }

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

  function extractSortValue(entry: TradeFetchResult, field: string): any {
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

  function sortOrderedList() {
    const { dir } = getSortConfig();
    orderedEntries = [...orderedEntries].sort((a, b) => {
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
    syncDisplayedSlice();
  }

  function getInViewState(): {
    inViewEntries: DisplayEntry[];
    firstInViewIndex: number;
  } {
    if (displayedItems.length === 0) {
      return { inViewEntries: [], firstInViewIndex: 0 };
    }

    if (!bodyElement) {
      return {
        inViewEntries: displayedItems.slice(0, getViewportCapacity()),
        firstInViewIndex: 0,
      };
    }

    const scrollTop = bodyElement.scrollTop;
    const clientHeight = bodyElement.clientHeight || Math.max(120, tile.h - 36);
    const viewBottom = scrollTop + clientHeight;

    const rowNodes = bodyElement.querySelectorAll<HTMLElement>(
      ".item-list > .item-row",
    );

    if (rowNodes.length === 0) {
      const rowH = getEstimatedRowHeight(effectiveStyle);
      const startIdx = Math.max(0, Math.floor(scrollTop / rowH));
      const endIdx = Math.min(
        displayedItems.length,
        Math.ceil(viewBottom / rowH),
      );
      return {
        inViewEntries: displayedItems.slice(
          startIdx,
          Math.max(startIdx + 1, endIdx),
        ),
        firstInViewIndex: startIdx,
      };
    }

    const inViewEntries: DisplayEntry[] = [];
    let firstInViewIndex = -1;

    for (let i = 0; i < rowNodes.length && i < displayedItems.length; i++) {
      const node = rowNodes[i];
      const top = node.offsetTop;
      const bottom = top + node.offsetHeight;

      if (bottom > scrollTop && top < viewBottom) {
        if (firstInViewIndex === -1) firstInViewIndex = i;
        inViewEntries.push(displayedItems[i]);
      }
    }

    if (inViewEntries.length === 0) {
      return {
        inViewEntries: displayedItems.slice(0, getViewportCapacity()),
        firstInViewIndex: 0,
      };
    }

    return {
      inViewEntries,
      firstInViewIndex: Math.max(0, firstInViewIndex),
    };
  }

  async function ensureInViewItemsFetched() {
    if (isDestroyed || !tile.searchId || disabled || tile.disabled) return;
    if (orderedEntries.length === 0) return;

    const { inViewEntries, firstInViewIndex } = getInViewState();

    const missingInView = inViewEntries.filter(
      (entry) =>
        !entry.isLive &&
        entry.data === null &&
        !inFlightIds.has(entry.id) &&
        (inViewRetryCounts.get(entry.id) ?? 0) < MAX_RETRIES_PER_VIEW,
    );

    if (missingInView.length === 0) return;

    const batchIds: string[] = [];
    const batchSet = new Set<string>();

    // 1. Prioritize items currently in view (top-to-bottom)
    for (const entry of missingInView) {
      if (batchIds.length >= BATCH_SIZE) break;
      batchIds.push(entry.id);
      batchSet.add(entry.id);
      inViewRetryCounts.set(
        entry.id,
        (inViewRetryCounts.get(entry.id) ?? 0) + 1,
      );
    }

    // 2. Fill remaining batch capacity (up to 10) top-to-bottom from firstInViewIndex onwards
    for (
      let i = firstInViewIndex;
      i < orderedEntries.length && batchIds.length < BATCH_SIZE;
      i++
    ) {
      const candidate = orderedEntries[i];
      if (
        !candidate.isLive &&
        candidate.data === null &&
        !inFlightIds.has(candidate.id) &&
        !batchSet.has(candidate.id)
      ) {
        batchIds.push(candidate.id);
        batchSet.add(candidate.id);
      }
    }

    if (batchIds.length === 0) return;

    await fetchRegularBatch(batchIds, tile.searchId, lastCacheOk);
  }

  export async function executeSearch(payload?: any, cacheOk: boolean = false) {
    if (isDestroyed || disabled || tile.disabled) return;

    if (payload && typeof payload === "object") {
      tile.payload = payload;
    } else if (!tile.payload || tile.payload === "") {
      if (!tile.full_payload) return;
      const generatedPayload = buildRegularPayload(
        tile.full_payload,
        tile.realm || "poe",
      );
      if (
        currentLeague &&
        generatedPayload &&
        typeof generatedPayload === "object"
      ) {
        generatedPayload.league = currentLeague;
      }
      tile.payload = generatedPayload;
    }

    const payloadToRun = tile.payload;
    if (!payloadToRun || typeof payloadToRun !== "object") return;

    const effectiveLeague =
      tile.league || payloadToRun.league || tile.full_payload?.league || "";
    if (effectiveLeague && payloadToRun.league !== effectiveLeague) {
      payloadToRun.league = effectiveLeague;
    }

    lastCacheOk = cacheOk;
    const uiId = String(tile.id);

    // Cancel any existing queued/in-flight jobs for this tile before starting a fresh search
    await cancelUiJobs(uiId);

    if (isLiveActive || isLiveConnecting) {
      await stopLive();
    }

    if (isDestroyed) return;
    tile.loading = true;

    try {
      const rawResponse: string = await invoke("search_items", {
        realm: tile.realm,
        payload: payloadToRun,
        league: effectiveLeague,
        cacheOk,
        cache_ok: cacheOk,
        uiId,
        ui_id: uiId,
      });

      if (isDestroyed) return;

      const data =
        typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse;

      tile.searchId = data.id;
      tile.results = data.result || [];

      itemsMap.clear();
      orderedEntries = [];
      displayedItems = [];
      inFlightIds.clear();
      inViewRetryCounts.clear();
      visibleCount = 0;

      if (bodyElement) {
        bodyElement.scrollTop = 0;
      }

      if (mode === "regular" || mode === "mixed") {
        for (const id of tile.results) {
          const entry: DisplayEntry = {
            uid: `reg_${id}_${uidCounter++}`,
            id,
            payload: payloadToRun,
            league: effectiveLeague,
            data: null,
            sortValue: null,
            isLive: false,
          };
          itemsMap.set(id, entry);
          orderedEntries.push(entry);
        }

        visibleCount = Math.min(orderedEntries.length, getViewportCapacity());
        displayedItems = orderedEntries.slice(0, visibleCount);

        await tick();
        await ensureInViewItemsFetched();
      }

      if (!isDestroyed && (mode === "live" || mode === "mixed")) {
        await startLive();
      }
    } catch (err) {
      if (!isDestroyed) {
        console.error(`[SearchTile ${tile.id}] Search error:`, err);
      }
    } finally {
      if (!isDestroyed) {
        tile.loading = false;
      }
    }
  }

  /**
   * Regular search batch fetch (`is_token: false`, `wait_ms: 200`, `min: ceil(ids.length / 2)`).
   */
  async function fetchRegularBatch(
    ids: string[],
    queryId: string,
    cacheOk: boolean = false,
  ) {
    if (isDestroyed) return;
    const batchIds = ids.slice(0, BATCH_SIZE);
    if (!batchIds.length) return;

    for (const id of batchIds) {
      inFlightIds.add(id);
    }
    isFetchingMore = inFlightIds.size > 0;

    const minCount = Math.ceil(batchIds.length / 2);
    const uiId = String(tile.id);

    try {
      const rawData: string | TradeFetchResponse = await invoke("fetch_items", {
        job: {
          id: queryId,
          ids: batchIds,
          min: minCount,
          wait_ms: 200,
          cache_ok: cacheOk,
          reservation: null,
          realm: tile.realm,
          is_token: false,
          ui_id: uiId,
        },
      });

      if (isDestroyed) return;

      const parsed: TradeFetchResponse =
        typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      const fetchedResults: TradeFetchResult[] = parsed?.result || [];
      const { field } = getSortConfig();

      for (const itemData of fetchedResults) {
        if (!itemData || !itemData.id) continue;
        const id = itemData.id;
        const sortVal = extractSortValue(itemData, field);

        if (itemsMap.has(id)) {
          const existing = itemsMap.get(id)!;
          existing.data = itemData;
          existing.sortValue = sortVal;
        } else {
          const newEntry: DisplayEntry = {
            uid: `reg_${id}_${uidCounter++}`,
            id,
            payload: activePayload,
            league: currentLeague,
            data: itemData,
            sortValue: sortVal,
            isLive: false,
          };
          itemsMap.set(id, newEntry);
          orderedEntries.push(newEntry);
        }
      }

      if (mode === "mixed") {
        sortOrderedList();
      } else {
        displayedItems = orderedEntries.slice(0, visibleCount);
      }
    } catch (err) {
      if (!isDestroyed) {
        console.error(
          `[SearchTile ${tile.id}] Fetch regular batch error:`,
          err,
        );
      }
    } finally {
      for (const id of batchIds) {
        inFlightIds.delete(id);
      }
      isFetchingMore = inFlightIds.size > 0;
    }

    if (isDestroyed) return;
    await tick();
    if (!isDestroyed) {
      await ensureInViewItemsFetched();
    }
  }

  /**
   * Live token fetch (`is_token: true`, `ids: [token]`, `wait_ms: 0`, `min: 1`).
   */
  async function fetchLiveToken(
    token: string,
    placeholders: DisplayEntry[],
    queryId: string,
  ) {
    if (isDestroyed || !token) return;

    inFlightIds.add(token);
    isFetchingMore = inFlightIds.size > 0;

    let fetchedResults: TradeFetchResult[] = [];
    const uiId = String(tile.id);

    try {
      const rawData: string | TradeFetchResponse = await invoke("fetch_items", {
        job: {
          id: queryId,
          ids: [token],
          min: 1,
          wait_ms: 0,
          cache_ok: false,
          reservation: null,
          realm: tile.realm,
          is_token: true,
          ui_id: uiId,
        },
      });

      if (isDestroyed) return;

      const parsed: TradeFetchResponse =
        typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      fetchedResults = parsed?.result || [];
    } catch (err) {
      if (!isDestroyed) {
        console.error(`[SearchTile ${tile.id}] Live token fetch error:`, err);
      }
    } finally {
      inFlightIds.delete(token);
      isFetchingMore = inFlightIds.size > 0;
    }

    if (isDestroyed) return;

    const { field } = getSortConfig();
    const usedPlaceholderUids = new Set<string>();
    let placeholderIdx = 0;

    for (const itemData of fetchedResults) {
      if (!itemData || !itemData.id) continue;
      const realId = itemData.id;
      const sortVal = extractSortValue(itemData, field);

      if (itemsMap.has(realId)) {
        const existing = itemsMap.get(realId)!;
        existing.data = itemData;
        existing.sortValue = sortVal;
        existing.isLive = true;
      } else if (placeholderIdx < placeholders.length) {
        const targetPlaceholder = placeholders[placeholderIdx++];
        targetPlaceholder.id = realId;
        targetPlaceholder.data = itemData;
        targetPlaceholder.sortValue = sortVal;
        usedPlaceholderUids.add(targetPlaceholder.uid);
        itemsMap.set(realId, targetPlaceholder);
      } else {
        const extraEntry: DisplayEntry = {
          uid: `live_${realId}_${uidCounter++}`,
          id: realId,
          payload: activePayload,
          league: currentLeague,
          data: itemData,
          sortValue: sortVal,
          isLive: true,
        };
        itemsMap.set(realId, extraEntry);
        orderedEntries.unshift(extraEntry);
      }
    }

    const unusedPlaceholderUids = new Set(
      placeholders
        .filter((p) => !usedPlaceholderUids.has(p.uid))
        .map((p) => p.uid),
    );

    if (unusedPlaceholderUids.size > 0) {
      orderedEntries = orderedEntries.filter(
        (entry) => !unusedPlaceholderUids.has(entry.uid),
      );
    }

    if (mode === "mixed") {
      sortOrderedList();
    } else {
      syncDisplayedSlice();
    }
  }

  function parseLiveEventMessages(raw: any): LiveTokenMessage[] {
    let parsed: any = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!parsed) return [];

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          result: String(item?.result ?? item?.token ?? ""),
          count: Math.max(1, Number(item?.count ?? 1) || 1),
        }))
        .filter((m) => m.result.length > 0);
    }

    if (typeof parsed.result === "string" && parsed.result.length > 0) {
      return [
        {
          result: parsed.result,
          count: Math.max(1, Number(parsed.count ?? 1) || 1),
        },
      ];
    }

    if (
      parsed.data &&
      typeof parsed.data.result === "string" &&
      parsed.data.result.length > 0
    ) {
      return [
        {
          result: parsed.data.result,
          count: Math.max(1, Number(parsed.data.count ?? 1) || 1),
        },
      ];
    }

    if (Array.isArray(parsed.item_ids)) {
      const fallbackCount = Math.max(1, Number(parsed.count ?? 1) || 1);
      return parsed.item_ids
        .filter((t: any) => typeof t === "string" && t.length > 0)
        .map((t: string) => ({ result: t, count: fallbackCount }));
    }

    return [];
  }

  async function handleScroll(e: Event) {
    if (isDestroyed || !tile.searchId) return;

    const el = e.currentTarget as HTMLElement;
    const scrollTop = el.scrollTop;
    const clientHeight = el.clientHeight;
    const scrollHeight = el.scrollHeight;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const rowH = getEstimatedRowHeight(effectiveStyle);

    inViewRetryCounts.clear();

    if (visibleCount < orderedEntries.length && distanceToBottom < rowH * 2) {
      const targetVisible = Math.min(
        orderedEntries.length,
        visibleCount + Math.max(2, Math.ceil(clientHeight / rowH)),
      );
      if (targetVisible !== visibleCount) {
        visibleCount = targetVisible;
        displayedItems = orderedEntries.slice(0, visibleCount);
        await tick();
      }
    }

    await ensureInViewItemsFetched();
  }

  function cleanupListeners() {
    if (unlistenItems) {
      unlistenItems();
      unlistenItems = null;
    }
    if (unlistenStatus) {
      unlistenStatus();
      unlistenStatus = null;
    }
  }

  async function startLive() {
    if (isDestroyed || !tile.searchId || disabled) return;
    cleanupListeners();
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

      unlistenItems = await listen<any>(
        `live-items-${tile.id}`,
        async (event) => {
          if (isDestroyed || !tile.searchId) return;
          const messages = parseLiveEventMessages(event.payload);
          if (messages.length === 0) return;

          const currentSearchId = tile.searchId;

          for (const msg of messages) {
            if (isDestroyed) break;
            const { result: token, count } = msg;
            const placeholders: DisplayEntry[] = [];

            for (let i = 0; i < count; i++) {
              placeholders.push({
                uid: `live_${token}_${uidCounter++}`,
                id: token,
                payload: activePayload,
                league: currentLeague,
                data: null,
                sortValue: null,
                isLive: true,
              });
            }

            orderedEntries = [...placeholders, ...orderedEntries];
            syncDisplayedSlice();
            await tick();

            await fetchLiveToken(token, placeholders, currentSearchId);
          }
        },
      );

      await invoke("start_live_search", {
        tileId: String(tile.id),
        realm: tile.realm,
        queryId: tile.searchId,
      });

      if (!isDestroyed) {
        isLiveActive = true;
      }
    } catch (err) {
      if (!isDestroyed) {
        console.error(
          `[SearchTile ${tile.id}] Failed to start live search:`,
          err,
        );
      }
      await stopLive();
    } finally {
      if (!isDestroyed) {
        isLiveConnecting = false;
      }
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
      cleanupListeners();
    }
  }

  async function toggleLiveButton() {
    if (disabled) return;
    if (isLiveActive) {
      await stopLive();
    } else {
      if (!tile.searchId) {
        await executeSearch(undefined, false);
      } else {
        await startLive();
      }
    }
  }

  onDestroy(() => {
    isDestroyed = true;
    const targetUiId = String(tile?.id || initialUiId);
    cancelUiJobs(targetUiId);

    if (isLiveActive || isLiveConnecting) {
      stopLive();
    } else {
      cleanupListeners();
    }
  });

  function onHeaderPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    (document.activeElement as HTMLElement)?.blur();

    dispatch("select", { shiftKey: e.shiftKey });
    dispatch("dragstart");

    const startX = e.clientX;
    const startY = e.clientY;
    let hasDragged = false;

    function onPointerMove(ev: PointerEvent) {
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (dist > 4) {
        hasDragged = true;
      }
      if (hasDragged) {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        dispatch("dragmove", { dx, dy });
      }
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dispatch("dragend");

      if (!hasDragged) {
        dispatch("openfilters");
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onResizePointerDown(e: PointerEvent, dir: ResizeDirection) {
    if (e.button !== 0) return;
    e.stopPropagation();
    dispatch("resize");

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

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dispatch("contextmenu", { clientX: e.clientX, clientY: e.clientY });
  }

  function handleModeChange(e: Event) {
    const selectEl = e.currentTarget as HTMLSelectElement;
    const nextMode = selectEl.value as SearchMode;
    tile.mode = nextMode;
    mode = nextMode;
    selectEl.blur();

    if (nextMode === "regular" && (isLiveActive || isLiveConnecting)) {
      stopLive();
    } else if (nextMode === "mixed" && orderedEntries.length > 0) {
      sortOrderedList();
    }

    dispatch("change");
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="tile-root style-{effectiveStyle}"
  class:live-active={isLiveActive}
  class:selected
  style:z-index={z}
  class:is-disabled={disabled}
  style:transform="translate({tile.x}px, {tile.y}px)"
  style:width="{tile.w}px"
  style:height="{tile.h}px"
  on:pointerdown|stopPropagation={(e) => {
    (document.activeElement as HTMLElement)?.blur();
    dispatch("select", { shiftKey: e.shiftKey });
  }}
  on:contextmenu={handleContextMenu}
>
  <div
    class="tile-bar"
    on:pointerdown={onHeaderPointerDown}
    title="Click to configure filters, drag to move"
  >
    <div class="bar-left">
      <span
        class="realm-badge"
        class:poe2={tile.realm?.toLowerCase() === "poe2"}
      >
        {tile.realm}
      </span>
      {#if currentLeague}
        <span class="league-badge" title="League: {currentLeague}">
          {currentLeague}
        </span>
      {/if}
      {#if disabled}
        <span class="disabled-badge">OFF</span>
      {/if}
      <span class="title" title={displayTitle}>{displayTitle}</span>
      {#if displayedItems.length > 0 || orderedEntries.length > 0}
        <span class="count-pill" title="Displayed / Total matched items">
          {displayedItems.length}{#if orderedEntries.length > 0 && mode !== "live"}/{orderedEntries.length}{/if}
        </span>
      {/if}
    </div>

    <div class="actions" on:pointerdown|stopPropagation>
      <select
        class="mode-select"
        bind:value={tile.mode}
        on:change={handleModeChange}
        disabled={disabled || tile.loading || isLiveConnecting}
        title="Search mode"
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
          disabled={disabled ||
            tile.loading ||
            isLiveConnecting ||
            !activePayload}
          on:click|stopPropagation={toggleLiveButton}
          title={isLiveActive ? "Stop live listener" : "Start live listener"}
        >
          <span class="live-dot" class:pulsing={isLiveActive}></span>
          {#if !isNarrowHeader}
            <span>{isLiveActive ? "Live" : "Start"}</span>
          {/if}
        </button>
      {/if}

      <button
        type="button"
        class="search-btn"
        disabled={disabled ||
          tile.loading ||
          isLiveConnecting ||
          !activePayload}
        on:click|stopPropagation={() => executeSearch(undefined, false)}
        title={disabled ? "Search is disabled on this tile" : "Execute search"}
      >
        {#if tile.loading}
          <span class="spin">↻</span>
        {:else}
          <span>🔍</span>{#if !isNarrowHeader}<span>Search</span>{/if}
        {/if}
      </button>

      <button
        type="button"
        class="del"
        on:click|stopPropagation={() => dispatch("delete")}
        title="Remove tile"
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
        {#if disabled}
          Search disabled (Right-click to enable).
        {:else if isLiveConnecting}
          <span class="spin">↻</span> Connecting to live socket...
        {:else if isLiveActive}
          <span class="live-dot pulsing"></span> Waiting for live listings...
        {:else}
          No search executed or no items found.
        {/if}
      </div>
    {:else}
      <div class="item-list list-{effectiveStyle}">
        {#each displayedItems as itemEntry (itemEntry.uid)}
          <SearchItemRow
            id={itemEntry.id}
            payload={itemEntry.payload}
            league={itemEntry.league}
            data={itemEntry.data}
            sortValue={itemEntry.sortValue}
            isLive={itemEntry.isLive ?? false}
            realm={tile.realm}
            searchId={tile.searchId ?? ""}
            {effectiveStyle}
            tileWidth={tile.w}
            tileHeight={tile.h}
          />
        {/each}

        {#if visibleCount < orderedEntries.length}
          <div class="scroll-sentinel">
            {#if isFetchingMore}
              <span class="spin">↻</span> Loading more results...
            {/if}
          </div>
        {:else if isFetchingMore}
          <div class="fetching-more">
            <span class="spin">↻</span> Loading more results...
          </div>
        {/if}
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
    background: #13161f;
    border-radius: 8px;
    border: 1px solid #283044;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
    overflow: visible;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      opacity 0.15s ease;
  }
  .tile-root.selected {
    border-color: #3a57e8;
    box-shadow:
      0 0 0 2px rgba(58, 87, 232, 0.45),
      0 10px 28px rgba(0, 0, 0, 0.55);
  }
  .tile-root.is-disabled {
    opacity: 0.68;
  }
  .tile-root.live-active {
    border-color: #7f1d1d;
    box-shadow:
      0 10px 28px rgba(0, 0, 0, 0.55),
      0 0 12px rgba(239, 68, 68, 0.12);
  }
  .tile-bar {
    height: 36px;
    background: linear-gradient(180deg, #212636 0%, #1a1e2b 100%);
    border-top-left-radius: 7px;
    border-top-right-radius: 7px;
    border-bottom: 1px solid #2c3345;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.45rem;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
    gap: 0.4rem;
  }
  .tile-bar:active {
    cursor: grabbing;
  }
  .bar-left {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    overflow: hidden;
    min-width: 0;
    flex: 1;
  }
  .realm-badge {
    text-transform: uppercase;
    font-size: 0.62rem;
    font-weight: 700;
    background: #334155;
    color: #cbd5e1;
    padding: 2px 5px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .realm-badge.poe2 {
    background: #3b1d5e;
    color: #e9d5ff;
    border: 1px solid #581c87;
  }
  .league-badge {
    font-size: 0.62rem;
    background: #1e293b;
    color: #93c5fd;
    border: 1px solid #334155;
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .disabled-badge {
    font-size: 0.6rem;
    font-weight: 700;
    background: #7f1d1d;
    color: #fecaca;
    padding: 1px 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .title {
    font-size: 0.82rem;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .count-pill {
    font-size: 0.65rem;
    font-family: ui-monospace, monospace;
    color: #94a3b8;
    background: #0f131c;
    border: 1px solid #262e40;
    padding: 1px 5px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
  }
  .mode-select {
    height: 24px;
    background: #252a3a;
    color: #cbd5e1;
    border: 1px solid #374151;
    font-size: 0.72rem;
    padding: 0 0.35rem;
    border-radius: 4px;
    outline: none;
    cursor: pointer;
    line-height: 1;
  }
  .mode-select:hover:not(:disabled) {
    border-color: #4b5563;
  }
  .mode-select:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .actions button {
    height: 24px;
    background: #2b3040;
    border: 1px solid #374151;
    color: #cbd5e1;
    font-size: 0.72rem;
    line-height: 1;
    padding: 0 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    white-space: nowrap;
    flex-shrink: 0;
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
    border-color: #2563eb;
  }
  .actions button.search-btn:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .actions button.live-btn {
    background: #1f2937;
    color: #9ca3af;
    border-color: #374151;
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
    flex-shrink: 0;
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
      opacity: 0.35;
      transform: scale(0.8);
    }
  }
  .actions button.del {
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 0.95rem;
    border-color: transparent;
  }
  .actions button.del:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
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
    overflow-x: hidden;
    position: relative;
    padding: 0.45rem;
    display: flex;
    flex-direction: column;
    container-type: inline-size;
    container-name: tile-body;
  }
  .style-minimal .tile-body {
    padding: 0.3rem;
  }
  .search-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.78);
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
    font-size: 0.78rem;
    color: #94a3b8;
    text-align: center;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .item-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .item-list.list-compact {
    gap: 0.35rem;
  }
  .item-list.list-minimal {
    gap: 0.22rem;
  }
  .scroll-sentinel,
  .fetching-more {
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    text-align: center;
    font-size: 0.72rem;
    color: #64748b;
    padding: 0.35rem 0;
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
