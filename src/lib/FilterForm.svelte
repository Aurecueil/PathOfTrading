<!-- src/lib/FilterForm.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";
  import FilterGroup from "$lib/trade/components/drawer/FilterGroup.svelte";
  import DrawerHeader from "$lib/trade/components/drawer/DrawerHeader.svelte";
  import ItemSearchCombobox from "$lib/trade/components/drawer/ItemSearchCombobox.svelte";
  import SortCombobox from "$lib/trade/components/drawer/SortCombobox.svelte";
  import StatGroupsSection from "$lib/trade/components/drawer/StatGroupsSection.svelte";
  import {
    computeDisplayName,
    getItemDisplayName,
  } from "$lib/trade/utilis/tradeDisplayName";
  import {
    buildPayloads,
    type StatGroupPayloadState,
  } from "$lib/trade/utilis/tradePayload";

  import {
    itemsPoe,
    itemsPoe2,
    filtersPoe,
    filtersPoe2,
    statsPoe,
    statsPoe2,
    leaguesPoe,
    leaguesPoe2,
    isLoading,
    initItemData,
  } from "$lib/trade/tradeStore";
  import type { ItemEntry, ItemCategory } from "$lib/types/baseItem";
  import type { SortOptionItem } from "$lib/types/types";
  import type { FilterGroup as FilterGroupType } from "$lib/types/filters";
  import type { StatGroup as StatGroupType } from "$lib/types/stats";
  import type { League } from "$lib/types/leagues";

  export let initialTitle: string = "";
  export let initialDisplayName: string = "";
  export let initialRealm: "poe" | "poe2" = "poe";
  export let initialLeague: string = "";
  export let initialPayload: any = null;

  let title: string = initialTitle;
  let realm: "poe" | "poe2" = initialRealm;
  let previousRealm: "poe" | "poe2" = realm;
  let league: string = initialLeague || initialPayload?.league || "";

  // Sorting state
  let sortKey: string = "filter:price";
  let sortDirection: "asc" | "desc" = "asc";
  let isSortDropdownOpen: boolean = false;

  // Drawer Width & Resize state
  let drawerWidth: number = 720;
  let isResizing: boolean = false;

  // Title inline editing
  let isEditingTitle: boolean = false;

  // Item Search State
  let selectedItem: ItemEntry | null = null;
  let searchQuery: string = "";
  let isItemDropdownOpen: boolean = false;

  // Menus
  let isAddGroupMenuOpen: boolean = false;
  let statusOption: string = "";

  // Dynamic filter state
  let filterValues: Record<string, Record<string, any>> = {};
  let groupCollapsed: Record<string, boolean> = {};

  // Stat Groups State
  let statGroups: StatGroupPayloadState[] = [
    { id: "stat_group_default", type: "and", collapsed: false, filters: [] },
  ];

  let hasHydrated: boolean = false;
  let itemHydrated: boolean = false;
  let isReadyForAutoSave: boolean = false;

  let itemComboboxRef: ItemSearchCombobox;

  const dispatch = createEventDispatcher<{
    close: void;
    save_and_search: {
      title: string;
      displayName: string;
      realm: string;
      league: string;
      payload: any;
      full_payload: any;
      close: boolean;
    };
    save_only: {
      title: string;
      displayName: string;
      realm: string;
      league: string;
      payload: any;
      full_payload: any;
    };
  }>();

  function extractArray<T>(storeVal: any): T[] {
    if (!storeVal) return [];
    if (Array.isArray(storeVal)) return storeVal;
    if (Array.isArray(storeVal.result)) return storeVal.result;
    return [];
  }
  onMount(() => {
    const isPoeEmpty =
      !$leaguesPoe?.length ||
      !$itemsPoe?.length ||
      !$filtersPoe?.length ||
      !$statsPoe?.length;
    const isPoe2Empty =
      !$leaguesPoe2?.length ||
      !$itemsPoe2?.length ||
      !$filtersPoe2?.length ||
      !$statsPoe2?.length;

    if (!$isLoading && (isPoeEmpty || isPoe2Empty)) {
      initItemData();
    }
  });
  $: currentItemCategories = extractArray<ItemCategory>(
    realm === "poe2" ? $itemsPoe2 : $itemsPoe,
  );
  $: currentFilterGroups = extractArray<FilterGroupType>(
    realm === "poe2" ? $filtersPoe2 : $filtersPoe,
  );
  $: currentStatCatalog = extractArray<StatGroupType>(
    realm === "poe2" ? $statsPoe2 : $statsPoe,
  );
  $: rawLeagues = extractArray<League>(
    realm === "poe2" ? $leaguesPoe2 : $leaguesPoe,
  );

  $: availableLeagues = rawLeagues.filter((l) => {
    if (realm === "poe") {
      const r = (l.realms || (l as any).realm || "").toString().toLowerCase();
      return r === "pc";
    }
    return true;
  });

  $: if (availableLeagues.length > 0) {
    const exists = availableLeagues.some((l) => l.id.toString() === league);
    if (!exists) league = availableLeagues[0].id.toString();
  }

  $: allKnownFilterGroups = [
    ...extractArray<FilterGroupType>($filtersPoe),
    ...extractArray<FilterGroupType>($filtersPoe2),
  ];

  $: statusGroup = currentFilterGroups.find((g) => g.id === "status_filters");
  $: statusFilter =
    statusGroup?.filters?.find((f) => f.id === "status") ||
    statusGroup?.filters?.[0];
  $: statusOptions = statusFilter?.option?.options || [];

  $: if (statusOptions.length > 0) {
    const validCurrent = statusOptions.some((o) => o.id === statusOption);
    if (!validCurrent) {
      const defaultOpt =
        statusOptions.find((o) => o.id === "securable") || statusOptions[0];
      statusOption = defaultOpt?.id ?? "";
    }
  }

  $: renderedFilterGroups = currentFilterGroups.filter(
    (g) => g.id !== "status_filters",
  );
  $: allItemEntries = currentItemCategories.flatMap((cat) => cat.entries || []);
  $: uniqueItems = allItemEntries.filter(
    (entry) => entry.flags?.unique && entry.name,
  );

  $: flatStats = currentStatCatalog.flatMap((g) =>
    (g.entries || []).map((e) => ({
      ...e,
      groupLabel: g.label || g.id,
    })),
  );

  $: if (realm !== previousRealm) {
    const prev = selectedItem;
    previousRealm = realm;
    const match =
      prev?.name && prev.flags?.unique
        ? (allItemEntries.find(
            (e) => e.flags?.unique && e.name === prev.name,
          ) ?? null)
        : null;
    selectedItem = match;
    searchQuery = match ? getItemDisplayName(match) : "";
    isItemDropdownOpen = false;
  }

  $: if (currentStatCatalog.length > 0) {
    const validStatIds = new Set(
      currentStatCatalog.flatMap((g) => (g.entries || []).map((e) => e.id)),
    );
    let changed = false;
    const updated = statGroups.map((group) => {
      const updatedFilters = group.filters.map((f) => {
        const shouldBeDisabled = !validStatIds.has(f.id);
        if (f.disabled !== shouldBeDisabled) {
          changed = true;
          return { ...f, disabled: shouldBeDisabled };
        }
        return f;
      });
      return { ...group, filters: updatedFilters };
    });
    if (changed) statGroups = updated;
  }

  $: {
    let fvChanged = false;
    let gcChanged = false;
    for (const group of currentFilterGroups) {
      if (group.id === "status_filters") continue;
      if (!filterValues[group.id]) {
        filterValues[group.id] = {};
        fvChanged = true;
      }
      if (groupCollapsed[group.id] === undefined) {
        groupCollapsed[group.id] = Boolean(group.hidden);
        gcChanged = true;
      }
      if (Array.isArray(group.filters)) {
        for (const f of group.filters) {
          if (!filterValues[group.id][f.id]) {
            filterValues[group.id][f.id] = {};
            fvChanged = true;
          }
        }
      }
    }
    if (fvChanged) filterValues = { ...filterValues };
    if (gcChanged) groupCollapsed = { ...groupCollapsed };
  }

  // Sorting Options Catalog
  $: sortableStatGroups = statGroups
    .filter((g) => ["count", "weight", "weight2"].includes(g.type))
    .map((g, idx) => {
      const typeLabel =
        g.type === "weight"
          ? "Weighted Sum"
          : g.type === "weight2"
            ? "Weighted Sum 2"
            : "Count";
      return {
        id: `group:${g.id}`,
        category: "group" as const,
        label: `Stat Group #${idx + 1} (${typeLabel})`,
      };
    });

  $: sortableFilterFields = (() => {
    const list: SortOptionItem[] = [
      { id: "filter:price", category: "filter", label: "Buyout Price" },
    ];
    for (const g of currentFilterGroups) {
      for (const f of g.filters) {
        if (f.minMax && f.id !== "price") {
          list.push({
            id: `filter:${f.id}`,
            category: "filter",
            label: f.text || f.id,
          });
        }
      }
    }
    return list;
  })();

  $: sortableStats = flatStats.map((s) => ({
    id: `stat:${s.id}`,
    category: "stat" as const,
    label: s.text,
    tag: s.groupLabel || s.type,
  }));

  $: allSortOptions = [
    ...sortableStatGroups,
    ...sortableFilterFields,
    ...sortableStats,
  ];

  $: computedDisplayName = computeDisplayName(
    title,
    selectedItem,
    searchQuery,
    filterValues,
    realm,
    initialDisplayName,
    allItemEntries,
    allKnownFilterGroups,
  );

  function tryHydrateItem() {
    if (itemHydrated) return;
    if (!initialPayload?.query) {
      itemHydrated = true;
      return;
    }
    const { name, type } = initialPayload.query;
    if (!name && !type) {
      itemHydrated = true;
      return;
    }
    if (!allItemEntries || allItemEntries.length === 0) return;

    const targetType = typeof type === "object" ? type?.option : type;
    const targetDisc =
      typeof type === "object" ? type?.discriminator : undefined;
    const matched = allItemEntries.find((entry) => {
      const matchName = name ? entry.name === name : !entry.name;
      const matchType = entry.type === targetType;
      const matchDisc = targetDisc ? entry.disc === targetDisc : !entry.disc;
      return matchName && matchType && matchDisc;
    });
    if (matched) {
      selectedItem = matched;
      searchQuery = getItemDisplayName(matched);
    }
    itemHydrated = true;
  }

  async function hydrateFromPayload() {
    if (!initialPayload) {
      hasHydrated = true;
      itemHydrated = true;
      await tick();
      isReadyForAutoSave = true;
      return;
    }

    if (initialPayload.league && !league) {
      league = initialPayload.league;
    }

    if (initialPayload.query?.status?.option) {
      statusOption = initialPayload.query.status.option;
    }

    if (initialPayload.query?.filters) {
      for (const [groupId, gData] of Object.entries(
        initialPayload.query.filters as Record<string, any>,
      )) {
        groupCollapsed[groupId] = gData.disabled ?? true;
        if (!filterValues[groupId]) filterValues[groupId] = {};
        if (gData.filters) {
          for (const [filterId, fVal] of Object.entries(
            gData.filters as Record<string, any>,
          )) {
            filterValues[groupId][filterId] = { ...(fVal || {}) };
          }
        }
      }
      filterValues = { ...filterValues };
      groupCollapsed = { ...groupCollapsed };
    }

    if (initialPayload.query?.stats !== undefined) {
      if (
        Array.isArray(initialPayload.query.stats) &&
        initialPayload.query.stats.length > 0
      ) {
        statGroups = initialPayload.query.stats.map((sg: any, idx: number) => ({
          id: `stat_group_${idx}_${Date.now()}`,
          type: sg.type || "and",
          collapsed: sg.collapsed ?? sg.disabled ?? false,
          disabled: sg.disabled ?? false,
          value: sg.value ? { ...sg.value } : undefined,
          filters: (sg.filters || []).map((f: any) => ({
            id: f.id,
            value: f.value ? { ...f.value } : {},
            disabled: f.disabled ?? false,
          })),
        }));
      } else {
        statGroups = [];
      }
    }

    const rawSort = initialPayload.sort;
    if (rawSort && typeof rawSort === "object") {
      const [sField, sDir] = Object.entries(rawSort)[0] || [];
      if (sField) {
        sortDirection = sDir === "desc" ? "desc" : "asc";
        if (sField.startsWith("statgroup.")) {
          const idx = parseInt(sField.replace("statgroup.", ""), 10);
          if (!isNaN(idx) && statGroups[idx]) {
            sortKey = `group:${statGroups[idx].id}`;
          }
        } else if (sField.startsWith("stat.")) {
          sortKey = `stat:${sField.replace("stat.", "")}`;
        } else {
          sortKey = `filter:${sField}`;
        }
      }
    }

    tryHydrateItem();
    hasHydrated = true;
    await tick();
    isReadyForAutoSave = true;
  }

  $: if (!hasHydrated) {
    hydrateFromPayload();
  }

  $: if (!itemHydrated && allItemEntries.length > 0) {
    tryHydrateItem();
  }

  function startResize(e: PointerEvent) {
    isResizing = true;
    e.preventDefault();
    window.addEventListener("pointermove", handleResize);
    window.addEventListener("pointerup", stopResize);
  }

  function handleResize(e: PointerEvent) {
    if (!isResizing) return;
    drawerWidth = Math.max(460, Math.min(window.innerWidth - 60, e.clientX));
  }

  function stopResize() {
    isResizing = false;
    window.removeEventListener("pointermove", handleResize);
    window.removeEventListener("pointerup", stopResize);
  }

  function handleFilterChange(
    groupId: string,
    filterId: string,
    field: string,
    val: any,
  ) {
    if (!filterValues[groupId]) filterValues[groupId] = {};
    if (!filterValues[groupId][filterId]) filterValues[groupId][filterId] = {};
    if (val === "" || val === null || val === undefined) {
      delete filterValues[groupId][filterId][field];
    } else {
      filterValues[groupId][filterId][field] = val;
    }
    filterValues = { ...filterValues };
  }

  function getPayloads() {
    const payloads = buildPayloads({
      initialPayload,
      statGroups,
      realm,
      statusOption,
      selectedItem,
      filterValues,
      groupCollapsed,
      renderedFilterGroups,
      allKnownFilterGroups,
      sortKey,
      sortDirection,
    });

    if (payloads.payload && league) {
      payloads.payload.league = league;
    }
    if (payloads.full_payload && league) {
      payloads.full_payload.league = league;
    }

    return payloads;
  }

  let autoSaveTimeout: ReturnType<typeof setTimeout>;
  function autoSave() {
    if (!hasHydrated || !isReadyForAutoSave) return;
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => saveWithoutSearch(), 60);
  }

  $: if (
    isReadyForAutoSave &&
    (title !== undefined ||
      realm !== undefined ||
      league !== undefined ||
      statusOption !== undefined ||
      sortKey !== undefined ||
      sortDirection !== undefined ||
      selectedItem !== undefined ||
      filterValues !== undefined ||
      groupCollapsed !== undefined ||
      statGroups !== undefined)
  ) {
    autoSave();
  }

  function handleSearchAndClose() {
    clearTimeout(autoSaveTimeout);
    const { payload, full_payload } = getPayloads();
    dispatch("save_and_search", {
      title,
      displayName: computedDisplayName,
      realm,
      league,
      payload,
      full_payload,
      close: true,
    });
    dispatch("close");
  }

  function handleSearchOnly() {
    clearTimeout(autoSaveTimeout);
    const { payload, full_payload } = getPayloads();
    dispatch("save_and_search", {
      title,
      displayName: computedDisplayName,
      realm,
      league,
      payload,
      full_payload,
      close: false,
    });
  }

  export function saveWithoutSearch() {
    clearTimeout(autoSaveTimeout);
    const { payload, full_payload } = getPayloads();
    dispatch("save_only", {
      title,
      displayName: computedDisplayName,
      realm,
      league,
      payload,
      full_payload,
    });
  }

  function handleCloseWithoutSearch() {
    saveWithoutSearch();
    dispatch("close");
  }

  onDestroy(() => {
    clearTimeout(autoSaveTimeout);
  });

  function handleWindowClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".autocomplete-wrapper")) isItemDropdownOpen = false;
    if (!target.closest(".add-group-menu-wrapper")) isAddGroupMenuOpen = false;
    if (!target.closest(".sort-combobox-wrapper")) isSortDropdownOpen = false;
  }

  function handleWindowKeyDown(e: KeyboardEvent) {
    const target =
      (e.target as HTMLElement) || (document.activeElement as HTMLElement);
    const isInsideDrawer = Boolean(target?.closest?.(".drawer"));

    if (e.key === "Escape") {
      if (isEditingTitle) {
        isEditingTitle = false;
        e.preventDefault();
        return;
      }
      if (isItemDropdownOpen) {
        isItemDropdownOpen = false;
        e.preventDefault();
        return;
      }
      if (isSortDropdownOpen) {
        isSortDropdownOpen = false;
        e.preventDefault();
        return;
      }
      if (isAddGroupMenuOpen) {
        isAddGroupMenuOpen = false;
        e.preventDefault();
        return;
      }
      e.preventDefault();
      handleCloseWithoutSearch();
      return;
    }

    if (e.key === "Enter" && isInsideDrawer) {
      if (isEditingTitle) {
        isEditingTitle = false;
        e.preventDefault();
        return;
      }
      if (isItemDropdownOpen || isSortDropdownOpen) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) handleSearchAndClose();
      else handleSearchOnly();
    }
  }
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleWindowKeyDown} />

<aside class="drawer" style="width: {drawerWidth}px;" on:wheel|stopPropagation>
  <div
    class="resize-handle"
    on:pointerdown={startResize}
    title="Drag to resize"
  ></div>

  <DrawerHeader
    bind:title
    bind:isEditingTitle
    {computedDisplayName}
    on:close={handleCloseWithoutSearch}
  />
  {#if $isLoading}
    <div class="loading-banner" role="status" aria-live="polite">
      <span class="loading-spinner"></span>
      <span>Fetching trade data...</span>
    </div>
  {/if}
  <form on:submit|preventDefault={handleSearchOnly}>
    <div class="scroll-area" on:wheel|stopPropagation>
      <div class="top-bar">
        <div class="top-row-1">
          <ItemSearchCombobox
            bind:this={itemComboboxRef}
            {allItemEntries}
            bind:selectedItem
            bind:searchQuery
            bind:isOpen={isItemDropdownOpen}
          />
        </div>

        <div class="top-row-2">
          <div class="top-field flex-realm">
            <select
              id="tile-realm"
              name="tile_realm"
              aria-label="Realm"
              bind:value={realm}
            >
              <option value="poe">PoE 1</option>
              <option value="poe2">PoE 2</option>
            </select>
          </div>

          <div class="top-field flex-league">
            <select
              id="tile-league"
              name="tile_league"
              aria-label="League"
              bind:value={league}
            >
              {#each availableLeagues as l}
                <option value={l.id}>{l.text}</option>
              {/each}
            </select>
          </div>

          {#if statusOptions.length > 0}
            <div class="top-field flex-status">
              <select
                id="tile-status"
                name="tile_status"
                aria-label="Status"
                bind:value={statusOption}
              >
                {#each statusOptions as opt}
                  {#if opt.id !== null}
                    <option value={opt.id}>{opt.text}</option>
                  {/if}
                {/each}
              </select>
            </div>
          {/if}

          <div class="top-field flex-sort">
            <SortCombobox
              bind:sortKey
              bind:sortDirection
              bind:isOpen={isSortDropdownOpen}
              {allSortOptions}
            />
          </div>
        </div>
      </div>

      <div class="main-columns">
        <div class="groups-section">
          <div class="filter-groups">
            {#each renderedFilterGroups as group (group.id)}
              <FilterGroup
                {group}
                values={filterValues[group.id] || {}}
                collapsed={groupCollapsed[group.id] ?? Boolean(group.hidden)}
                {uniqueItems}
                on:toggle={() => {
                  groupCollapsed[group.id] = !groupCollapsed[group.id];
                  groupCollapsed = { ...groupCollapsed };
                }}
                on:change={(e) =>
                  handleFilterChange(
                    group.id,
                    e.detail.filterId,
                    e.detail.field,
                    e.detail.value,
                  )}
              />
            {/each}
          </div>
        </div>

        <StatGroupsSection
          bind:statGroups
          bind:isAddGroupMenuOpen
          {currentStatCatalog}
          {realm}
          on:deleteGroup={(e) => {
            statGroups = statGroups.filter((g) => g.id !== e.detail);
            if (sortKey === `group:${e.detail}`) sortKey = "filter:price";
          }}
          on:addGroup={(e) => {
            statGroups = [
              ...statGroups,
              {
                id: `stat_group_${Date.now()}`,
                type: e.detail,
                collapsed: false,
                filters: [],
              },
            ];
          }}
        />
      </div>
    </div>

    <div class="actions">
      <button
        type="button"
        class="btn-search-close"
        on:click={handleSearchAndClose}
        title="Shortcut: Shift + Enter"
      >
        Search & Close
      </button>
      <button
        type="button"
        class="primary"
        on:click={handleSearchOnly}
        title="Shortcut: Enter"
      >
        Search
      </button>
    </div>
  </form>
</aside>

<style>
  /* Base Drawer Container */
  .drawer {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    min-width: 460px;
    max-width: 95vw;
    background-color: #000000;
    border-right: 1px solid #777777;
    border-radius: 0px;
    z-index: 500;
    box-shadow: 6px 0 24px rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    color: #d3d3d3;
    font-family: monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    box-sizing: border-box;
    overscroll-behavior: contain;
    container-type: inline-size;
    container-name: drawer;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    right: -4px;
    width: 7px;
    height: 100%;
    cursor: col-resize;
    z-index: 1001;
    background: transparent;
    transition: background 0.15s ease;
  }

  .resize-handle:hover,
  .resize-handle:active {
    background: #777777;
  }

  form {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    width: 100%;
  }

  .scroll-area {
    padding: 0.5rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    width: 100%;
    box-sizing: border-box;
  }

  .scroll-area::-webkit-scrollbar {
    width: 6px;
  }
  .scroll-area::-webkit-scrollbar-track {
    background: #000000;
  }
  .scroll-area::-webkit-scrollbar-thumb {
    background: #555555;
  }

  /* --------------------------------------------------------------------------
     Top Controls Container (Layout Only — No backgrounds, frames, or borders)
     -------------------------------------------------------------------------- */
  .top-bar {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    background: transparent !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0px;
    width: 100%;
    box-sizing: border-box;
  }
  .top-bar select {
    color: #ffffff !important;
  }
  .top-row-1 {
    width: 100%;
  }

  .top-row-2 {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    width: 100%;
    min-width: 0;
  }

  .top-field {
    display: flex;
    min-width: 0;
  }

  .flex-realm {
    flex: 0 0 75px;
    min-width: 65px;
  }

  .flex-league {
    flex: 1.2 1 115px;
    min-width: 85px;
  }

  .flex-status {
    flex: 1.3 1 125px;
    min-width: 95px;
  }

  .flex-sort {
    flex: 1.4 1 135px;
    min-width: 110px;
  }

  select {
    font-family: monospace, sans-serif !important;
    font-size: 12px !important;
    height: 26px !important;
    line-height: 1.15 !important;
    background-color: #000000 !important;
    border: 1px solid #7f7f7f !important;
    border-radius: 0px !important;
    color: #ffffff !important;
    padding: 0 4px !important;
    outline: none;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  select:hover,
  select:focus {
    border-color: #ffffff !important;
  }

  select option {
    background-color: #000000 !important;
    color: #9a9a9a !important;
    font-family: monospace, sans-serif !important;
    font-size: 12px !important;
    padding: 1px 3px !important;
  }

  select option:checked,
  select option[selected] {
    background-color: #000000 !important;
    color: #ffffff !important;
  }

  select option:hover {
    background-color: #545454 !important;
    color: #ffffff !important;
  }

  /* Main Grid Columns (Layout Only) */
  .main-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    width: 100%;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    box-sizing: border-box;
  }

  @container drawer (min-width: 820px) {
    .main-columns {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }

  .groups-section,
  .filter-groups {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
    min-width: 0;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    box-sizing: border-box;
  }
  .filter-groups :global(select) {
    color: #9a9a9a !important;
  }
  .filter-groups :global(select.is-modified),
  .filter-groups :global(select[data-modified="true"]),
  .filter-groups
    :global(select:has(option:checked:not([value=""]):not([value="null"]))) {
    color: #ffffff !important;
  }
  /* --------------------------------------------------------------------------
     Expanded Child Popover / Dropdown Menu Styles (1px White Border)
     -------------------------------------------------------------------------- */
  .drawer :global(.combobox-dropdown),
  .drawer :global(.autocomplete-dropdown),
  .drawer :global(.dropdown-menu),
  .drawer :global(.sort-dropdown),
  .drawer :global(.popover-menu),
  .drawer :global(.dropdown) {
    background: #000000 !important;
    border: 1px solid #ffffff !important;
    border-radius: 0px !important;
    padding: 1px 0 !important;
    z-index: 1000 !important;
    box-sizing: border-box !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85) !important;
  }

  .drawer :global(.combobox-option),
  .drawer :global(.autocomplete-option),
  .drawer :global(.dropdown-item),
  .drawer :global(.option-row),
  .drawer :global(.dropdown li) {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 12px !important;
    color: #9a9a9a !important;
    background: #000000 !important;
    padding: 1px 3px !important;
    line-height: 1.15 !important;
    cursor: pointer !important;
    border-radius: 0px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  /* Currently Selected Item: White Text */
  .drawer :global(.combobox-option.selected),
  .drawer :global(.combobox-option[aria-selected="true"]),
  .drawer :global(.autocomplete-option.selected),
  .drawer :global(.dropdown-item.selected),
  .drawer :global(.dropdown li.selected) {
    background: #000000 !important;
    color: #ffffff !important;
  }

  /* Hovered or Highlighted Item: #545454 Background & White Text */
  .drawer :global(.combobox-option:hover),
  .drawer :global(.combobox-option:focus),
  .drawer :global(.autocomplete-option:hover),
  .drawer :global(.autocomplete-option:focus),
  .drawer :global(.dropdown-item:hover),
  .drawer :global(.dropdown-item:focus),
  .drawer :global(.option-row:hover),
  .drawer :global(.dropdown li:hover),
  .drawer :global(.dropdown li.highlighted) {
    background: #545454 !important;
    color: #ffffff !important;
  }

  .drawer :global(.dropdown li.unique) {
    color: #9a5521 !important;
  }

  .drawer :global(.dropdown li.unique:hover),
  .drawer :global(.dropdown li.unique.highlighted) {
    background: #545454 !important;
    color: #db792f !important;
  }

  /* --------------------------------------------------------------------------
     Footer Action Buttons
     -------------------------------------------------------------------------- */
  .actions {
    padding: 0.5rem;
    background: #000000;
    border-top: 1px solid #777777;
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .actions button {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 12px;
    height: 26px;
    line-height: 1;
    flex: 1;
    padding: 2px 8px;
    border-radius: 0px !important;
    cursor: pointer;
    border: 1px solid #7f7f7f;
    background: #000000;
    color: #ffffff;
    text-align: center;
    transition:
      background 0.1s ease,
      border-color 0.1s ease;
  }

  .actions button:hover,
  .actions button:focus {
    border-color: #ffffff;
    outline: none;
  }

  .actions button.btn-search-close {
    background: #000000;
    color: #ffffff;
    border-color: #7f7f7f;
  }

  /* Pitch White Primary Search Button */
  .actions button.primary {
    background-color: #000000 !important;
    border: 1px solid #ffffff !important;
    color: #ffffff !important;
  }

  .actions button.primary:hover,
  .actions button.primary:focus {
    background-color: #000000 !important;
    border-color: #ffffff !important;
    color: #ffffff !important;
  }
  .loading-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    background-color: #111111;
    border-bottom: 1px solid #777777;
    color: #ffffff;
    font-family: monospace, sans-serif;
    font-size: 12px;
    flex-shrink: 0;
  }

  .loading-spinner {
    width: 10px;
    height: 10px;
    border: 2px solid #555555;
    border-top-color: #ffffff;
    border-radius: 50%;
    display: inline-block;
    animation: drawer-spin 0.7s linear infinite;
  }

  @keyframes drawer-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
