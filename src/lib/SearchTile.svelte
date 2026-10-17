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
    ItemMod,
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
  export let filtersOpen: boolean = false;

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

  function snap(val: number): number {
    return snapToGrid ? Math.round(val / gridSize) * gridSize : Math.round(val);
  }

  $: activePayload =
    tile.payload && typeof tile.payload === "object"
      ? tile.payload
      : tile.full_payload;
  $: currentLeague = tile.league || activePayload?.league || "";

  $: isPoe2 = tile.realm?.toLowerCase() === "poe2";
  $: realmIconSrc = isPoe2 ? "/poe2.png" : "/poe.png";
  $: defaultRealmTitle = isPoe2 ? "PoE2 Trade" : "PoE Trade";

  $: displayTitle =
    tile.displayName?.trim() || tile.title?.trim() || defaultRealmTitle;

  $: hasNoSearchYet =
    !tile.searchId &&
    !tile.loading &&
    !isLiveActive &&
    !isLiveConnecting &&
    displayedItems.length === 0 &&
    orderedEntries.length === 0;

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
    const viewH = bodyElement?.clientHeight || Math.max(120, tile.h - 42);
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

  function normalizeModHash(hash?: string): string {
    if (!hash) return "";
    return hash.startsWith("stat.") ? hash.slice(5) : hash;
  }

  function extractPseudoStatsFromPayload(pl: any): string[] {
    if (!pl || typeof pl !== "object") return [];
    const pseudos = new Set<string>();
    const rawStats = pl?.query?.stats ?? pl?.stats;

    if (Array.isArray(rawStats)) {
      for (const group of rawStats) {
        if (!group || group.disabled) continue;
        const filters = Array.isArray(group.filters) ? group.filters : [];
        for (const f of filters) {
          if (!f || f.disabled || typeof f.id !== "string") continue;
          const normId = normalizeModHash(f.id.trim());
          if (normId.startsWith("pseudo.")) {
            pseudos.add(normId);
          }
        }
      }
    }

    const sortObj = pl?.sort;
    if (sortObj && typeof sortObj === "object") {
      for (const key of Object.keys(sortObj)) {
        const normKey = normalizeModHash(key.trim());
        if (normKey.startsWith("pseudo.")) {
          pseudos.add(normKey);
        }
      }
    }

    return Array.from(pseudos);
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

  function cleanBracketText(text: string): string {
    if (!text) return "";
    return text.replace(/\[([^\]]+)\]/g, (_, inner: string) => {
      const parts = inner.split("|");
      return parts[parts.length - 1];
    });
  }

  function extractModNumericValue(mod: string | ItemMod): number {
    const desc = cleanBracketText(
      typeof mod === "string" ? mod : mod.description || "",
    );
    const matches = desc.match(/[+-]?\d+(?:\.\d+)?/g);
    if (!matches || matches.length === 0) return 0;
    const nums = matches.map(Number).filter((n) => !Number.isNaN(n));
    if (nums.length === 0) return 0;
    return nums.reduce((acc, n) => acc + n, 0) / nums.length;
  }

  function extractSortValue(entry: TradeFetchResult, field: string): any {
    if (!entry) return null;
    if (field === "price") {
      return entry.listing?.price?.amount ?? null;
    }

    const it = entry.item;
    const normField = normalizeModHash(field);
    const lowerField = normField.toLowerCase();

    if (it) {
      const modMap = new Map<string, number>();
      const lists: Array<Array<string | ItemMod> | undefined> = [
        it.implicitMods,
        it.explicitMods,
        it.enchantMods,
        it.runeMods,
        it.scourgeMods,
        it.bondedMods,
        it.crucibleMods,
        it.veiledMods,
        it.pseudoMods,
      ];
      for (const list of lists) {
        if (!list) continue;
        for (const mod of list) {
          if (typeof mod === "string" || !mod.hash) continue;
          const h = normalizeModHash(mod.hash);
          if (!h) continue;
          modMap.set(h, (modMap.get(h) ?? 0) + extractModNumericValue(mod));
        }
      }

      if (
        lowerField === "weight" ||
        lowerField === "weight2" ||
        lowerField === "count"
      ) {
        const rawStats = activePayload?.query?.stats ?? activePayload?.stats;
        if (Array.isArray(rawStats)) {
          const group = rawStats.find(
            (g: any) =>
              g &&
              !g.disabled &&
              String(g.type || "").toLowerCase() === lowerField &&
              Array.isArray(g.filters),
          );
          if (group) {
            if (lowerField === "count") {
              let c = 0;
              for (const f of group.filters) {
                if (!f || f.disabled) continue;
                if (modMap.has(normalizeModHash(f.id))) c += 1;
              }
              return c;
            } else {
              let sum = 0;
              for (const f of group.filters) {
                if (!f || f.disabled) continue;
                const h = normalizeModHash(f.id);
                if (modMap.has(h)) {
                  const w =
                    f.value?.weight !== undefined && f.value?.weight !== null
                      ? Number(f.value.weight)
                      : 1;
                  sum += (modMap.get(h) ?? 0) * (Number.isNaN(w) ? 1 : w);
                }
              }
              return sum;
            }
          }
        }
      }

      if (modMap.has(normField)) {
        return modMap.get(normField)!;
      }

      if (it.extended && normField in it.extended) {
        return (it.extended as any)[normField];
      }
    }

    if (field in entry) return (entry as any)[field];
    if (it && field in it) return (it as any)[field];
    if (entry.listing && field in entry.listing)
      return (entry.listing as any)[field];
    return null;
  }

  function handleRowSortValue(e: CustomEvent<{ id: string; value: any }>) {
    const { id, value } = e.detail;
    const existing = itemsMap.get(id);
    if (!existing || existing.sortValue === value) return;
    existing.sortValue = value;
    if (mode === "mixed") {
      sortOrderedList();
    }
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
    const clientHeight = bodyElement.clientHeight || Math.max(120, tile.h - 32);
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
    const pseudos = extractPseudoStatsFromPayload(activePayload);

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
          pseudos,
        },
        pseudos,
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
    const pseudos = extractPseudoStatsFromPayload(activePayload);

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
          pseudos,
        },
        pseudos,
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
    if (isLiveActive || isLiveConnecting) {
      await stopLive();
    } else {
      await executeSearch(undefined, false);
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

  function handleBodyClick() {
    if (hasNoSearchYet) {
      dispatch("openfilters");
    }
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
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  class="tile-root style-{effectiveStyle}"
  class:selected
  class:filters-open={filtersOpen}
  class:is-disabled={disabled}
  style:z-index={z}
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
      {#if mode === "live" || mode === "mixed"}
        <span
          class="live-dot"
          class:active={isLiveActive}
          title={isLiveActive ? "Live search active" : "Live search inactive"}
        ></span>
      {/if}

      <img
        class="realm-icon"
        src={realmIconSrc}
        alt={tile.realm}
        on:error={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (!img.src.includes("/static/")) {
            img.src = isPoe2 ? "/static/poe2.png" : "/static/poe.png";
          }
        }}
      />

      {#if currentLeague}
        <span class="league-name" title="League: {currentLeague}">
          {currentLeague}
        </span>
      {/if}

      <span class="v-sep"></span>

      <span class="title" title={displayTitle}>{displayTitle}</span>

      {#if disabled}
        <span class="disabled-text">(OFF)</span>
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

      {#if mode === "regular"}
        <button
          type="button"
          class="action-btn"
          disabled={disabled ||
            tile.loading ||
            isLiveConnecting ||
            !activePayload}
          on:click|stopPropagation={() => executeSearch(undefined, false)}
          title={disabled
            ? "Search is disabled on this tile"
            : "Execute search"}
        >
          {tile.loading ? "Searching..." : "Search"}
        </button>
      {:else}
        <button
          type="button"
          class="action-btn live-btn"
          class:active={isLiveActive}
          disabled={disabled ||
            tile.loading ||
            isLiveConnecting ||
            !activePayload}
          on:click|stopPropagation={toggleLiveButton}
          title={isLiveActive
            ? "Deactivate live search"
            : "Activate live search"}
        >
          {#if isLiveConnecting || tile.loading}
            Connecting...
          {:else if isLiveActive}
            Deactivate
          {:else}
            Activate
          {/if}
        </button>
      {/if}

      <button
        type="button"
        class="del"
        on:click|stopPropagation={() => dispatch("delete")}
        title="Remove tile"
      >
        X
      </button>
    </div>
  </div>

  <div
    class="tile-body"
    class:clickable-empty={hasNoSearchYet}
    bind:this={bodyElement}
    on:scroll={handleScroll}
    on:wheel|stopPropagation
    on:click={handleBodyClick}
    title={hasNoSearchYet ? "Click to configure filters" : undefined}
  >
    {#if tile.loading}
      <div class="search-overlay">
        <span>Searching market...</span>
      </div>
    {/if}

    {#if displayedItems.length === 0 && !tile.loading}
      <div class="status-msg empty">
        {#if disabled}
          Search disabled (Right-click to enable).
        {:else if isLiveConnecting}
          Connecting to live socket...
        {:else if isLiveActive}
          Waiting for live listings...
        {:else if tile.searchId}
          No items found.
        {:else}
          No search executed — click to configure filters.
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
            on:sortvalue={handleRowSortValue}
          />
        {/each}

        {#if visibleCount < orderedEntries.length}
          <div class="scroll-sentinel">
            {#if isFetchingMore}
              Loading more results...
            {/if}
          </div>
        {:else if isFetchingMore}
          <div class="fetching-more">Loading more results...</div>
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
    background-color: #040608;
    border-radius: 0px;
    border: 1px solid #7f7f7f;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    color: #d3d3d3;
    font-family: "Fontin", monospace, sans-serif;
    overflow: visible;
  }

  .tile-root.selected {
    border-color: #ffffff;
  }

  .tile-root.is-disabled {
    opacity: 0.65;
  }

  .tile-bar {
    height: 42px;
    background-color: #040608;
    border-bottom: 1px solid #7f7f7f;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
    gap: 12px;
  }

  .tile-bar:active {
    cursor: grabbing;
  }

  .bar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    min-width: 0;
    flex: 1;
  }

  .live-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: #7f7f7f;
    display: inline-block;
    flex-shrink: 0;
  }

  .live-dot.active {
    background-color: #ef4444;
  }

  .realm-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
    flex-shrink: 0;
    display: block;
  }

  .league-name {
    font-size: 22px;
    font-weight: 400;
    color: #ffffff;
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 1;
  }

  .v-sep {
    width: 2px;
    height: 26px;
    background-color: #7f7f7f;
    flex-shrink: 0;
  }

  .title {
    font-size: 22px;
    font-weight: 400;
    color: #d3d3d3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.1;
  }

  .disabled-text {
    font-size: 18px;
    color: #9a9a9a;
    flex-shrink: 0;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .mode-select {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 18px !important;
    height: 28px !important;
    line-height: 1 !important;
    background-color: #000000 !important;
    border: 2px solid #7f7f7f !important;
    border-radius: 0px !important;
    color: #ffffff !important;
    padding: 0 8px !important;
    outline: none;
    cursor: pointer;
  }

  .mode-select:hover:not(:disabled),
  .mode-select:focus:not(:disabled) {
    border-color: #ffffff !important;
  }

  .mode-select:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .mode-select option {
    background-color: #000000 !important;
    color: #9a9a9a !important;
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 18px !important;
  }

  .mode-select option:checked {
    color: #ffffff !important;
  }

  .actions button {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 18px;
    height: 28px;
    line-height: 1;
    padding: 0 8px;
    border-radius: 0px !important;
    cursor: pointer;
    border: 2px solid #7f7f7f;
    background-color: #000000;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    flex-shrink: 0;
    transition: border-color 0.1s ease;
  }

  .actions button:hover:not(:disabled),
  .actions button:focus:not(:disabled) {
    border-color: #ffffff;
    outline: none;
  }

  .actions button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .actions button.live-btn.active {
    border-color: #ef4444;
    color: #ffffff;
  }

  .actions button.live-btn.active:hover:not(:disabled) {
    border-color: #ffffff;
  }

  .actions button.del {
    width: 28px;
    padding: 0;
    font-size: 18px;
  }

  .tile-body {
    flex: 1;
    background-color: #000000;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    container-type: inline-size;
    container-name: tile-body;
  }

  .tile-body.clickable-empty {
    cursor: pointer;
  }

  .style-minimal .tile-body {
    padding: 0.35rem;
  }

  .search-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    z-index: 10;
    color: #d3d3d3;
    font-size: 21px;
  }

  .status-msg {
    margin: auto;
    font-size: 21px;
    color: #9a9a9a;
    text-align: center;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    user-select: none;
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
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    text-align: center;
    font-size: 18px;
    color: #9a9a9a;
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
  .tile-root.filters-open {
    border-color: #7dc8ff;
    box-shadow:
      0 0 0 1px #7dc8ff,
      0 8px 24px rgba(0, 0, 0, 0.85);
  }
</style>
