<!-- src/lib/FilterDrawer.svelte -->
<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import FilterGroup from "$lib/FilterGroup.svelte";
  import DrawerHeader from "$lib/trade/componenets/DrawerHeader.svelte";
  import ItemSearchCombobox from "$lib/trade/componenets/ItemSearchCombobox.svelte";
  import SortCombobox from "$lib/trade/componenets/SortCombobox.svelte";
  import StatGroupsSection from "$lib/trade/componenets/StatGroupsSection.svelte";
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
  } from "$lib/types/tradeStore";
  import type { ItemEntry, ItemCategory } from "$lib/types/items";
  import type { SortOptionItem } from "$lib/types";
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
  let league: string = initialLeague;

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
    previousRealm = realm;
    selectedItem = null;
    searchQuery = "";
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
    for (const group of currentFilterGroups) {
      if (group.id === "status_filters") continue;
      if (!filterValues[group.id]) filterValues[group.id] = {};
      if (groupCollapsed[group.id] === undefined)
        groupCollapsed[group.id] = Boolean(group.hidden);
      if (Array.isArray(group.filters)) {
        for (const f of group.filters) {
          if (!filterValues[group.id][f.id]) filterValues[group.id][f.id] = {};
        }
      }
    }
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

  function hydrateFromPayload() {
    if (!initialPayload) {
      hasHydrated = true;
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
    }

    if (initialPayload.query?.stats !== undefined) {
      if (
        Array.isArray(initialPayload.query.stats) &&
        initialPayload.query.stats.length > 0
      ) {
        statGroups = initialPayload.query.stats.map((sg: any, idx: number) => ({
          id: `stat_group_${idx}_${Date.now()}`,
          type: sg.type || "and",
          collapsed: sg.disabled ?? false,
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

    // Sort is hydrated exclusively from initialPayload.sort
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

    hasHydrated = true;
  }

  $: if (!hasHydrated) {
    if (initialPayload) hydrateFromPayload();
    else hasHydrated = true;
  }

  $: if (
    allItemEntries.length > 0 &&
    initialPayload?.query &&
    !itemHydrated &&
    !selectedItem
  ) {
    const { name, type } = initialPayload.query;
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
    if (!hasHydrated) return;
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => saveWithoutSearch(), 40);
  }

  $: if (
    hasHydrated &&
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
    const target = e.target as HTMLElement;
    if (!target.closest(".drawer")) return;

    if (e.key === "Escape") {
      if (isEditingTitle) {
        isEditingTitle = false;
        return;
      }
      if (isItemDropdownOpen) {
        isItemDropdownOpen = false;
        return;
      }
      if (isSortDropdownOpen) {
        isSortDropdownOpen = false;
        return;
      }
      if (isAddGroupMenuOpen) {
        isAddGroupMenuOpen = false;
        return;
      }
      e.preventDefault();
      handleCloseWithoutSearch();
      return;
    }

    if (e.key === "Enter") {
      if (isEditingTitle) {
        isEditingTitle = false;
        e.preventDefault();
        return;
      }
      if (isItemDropdownOpen || isSortDropdownOpen) {
        e.preventDefault();
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
                on:toggle={() =>
                  (groupCollapsed[group.id] = !groupCollapsed[group.id])}
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
  .drawer {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    min-width: 460px;
    max-width: 95vw;
    background: #181b24;
    border-right: 1px solid #2e3444;
    z-index: 500;
    box-shadow: 6px 0 24px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    color: #fff;
    box-sizing: border-box;
    overscroll-behavior: contain;
    container-type: inline-size;
    container-name: drawer;
  }
  .resize-handle {
    position: absolute;
    top: 0;
    right: -3px;
    width: 7px;
    height: 100%;
    cursor: col-resize;
    z-index: 1001;
    background: transparent;
    transition: background 0.15s ease;
  }
  .resize-handle:hover,
  .resize-handle:active {
    background: #3b82f6;
  }
  form {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    width: 100%;
  }
  .scroll-area {
    padding: 0.75rem 1rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    width: 100%;
    box-sizing: border-box;
  }
  .top-bar {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    background: #1b1e2a;
    padding: 0.65rem 0.75rem;
    border-radius: 4px;
    border: 1px solid #252a3a;
    width: 100%;
    box-sizing: border-box;
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
    background: #232838;
    border: 1px solid #333c52;
    color: #fff;
    padding: 0.3rem 0.45rem;
    border-radius: 4px;
    outline: none;
    font-size: 0.78rem;
    height: 30px;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  select:focus {
    border-color: #3b82f6;
  }
  .main-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.65rem;
    width: 100%;
    box-sizing: border-box;
  }
  @container drawer (min-width: 820px) {
    .main-columns {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .groups-section {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .filter-groups {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    width: 100%;
    min-width: 0;
  }
  .actions {
    padding: 0.6rem 1rem;
    background: #181b24;
    border-top: 1px solid #232838;
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .actions button {
    flex: 1;
    padding: 0.45rem;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid #333c52;
    background: #232838;
    color: #cbd5e1;
    font-size: 0.775rem;
    font-weight: 500;
    transition: all 0.15s ease;
  }
  .actions button:hover {
    background: #2d354a;
    color: #fff;
  }
  .actions button.btn-search-close {
    border-color: #333c52;
  }
  .actions button.primary {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
  }
  .actions button.primary:hover {
    background: #2563eb;
    border-color: #2563eb;
  }
</style>
