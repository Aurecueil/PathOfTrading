<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    itemsPoe,
    itemsPoe2,
    filtersPoe,
    filtersPoe2,
  } from "$lib/types/tradeStore";
  import type { ItemEntry, ItemCategory } from "$lib/types/items";
  import type {
    FilterGroup,
    FilterEntry,
    FilterOptionEntry,
  } from "$lib/types/filters";

  export let initialTitle: string = "";
  export let initialDisplayName: string = "";
  export let initialRealm: "poe" | "poe2" = "poe";
  export let initialPayload: any = null;
  export let initialSort: string = "price_asc";

  let title: string = initialTitle;
  let realm: "poe" | "poe2" = initialRealm;
  let previousRealm: "poe" | "poe2" = realm;
  let sortOption: string = initialSort;

  // Drawer Width & Resize state
  let drawerWidth: number = 720;
  let isResizing: boolean = false;

  // Title inline editing
  let isEditingTitle: boolean = false;

  // Selected item search state
  let selectedItem: ItemEntry | null = null;
  let searchQuery: string = "";
  let isItemDropdownOpen: boolean = false;
  let itemHighlightedIndex: number = -1;

  // Option combobox state (> 4 options)
  let activeOptionKey: string | null = null;
  let optionSearchQueries: Record<string, string> = {};
  let optionHighlightedIndex: number = -1;

  // Status option state
  let statusOption: string = "";

  // Filter state stores: groupId -> filterId -> values
  let filterValues: Record<string, Record<string, any>> = {};
  let groupCollapsed: Record<string, boolean> = {};

  let hasHydrated: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    save_and_search: {
      title: string;
      displayName: string;
      realm: string;
      payload: any;
      full_payload: any;
      sort: string;
    };
    save_only: {
      title: string;
      displayName: string;
      realm: string;
      payload: any;
      full_payload: any;
      sort: string;
    };
  }>();

  // Safely unwrap data from raw responses
  function extractCategories(storeVal: any): ItemCategory[] {
    if (!storeVal) return [];
    if (Array.isArray(storeVal)) return storeVal;
    if (Array.isArray(storeVal.result)) return storeVal.result;
    return [];
  }

  function extractFilterGroups(storeVal: any): FilterGroup[] {
    if (!storeVal) return [];
    if (Array.isArray(storeVal)) return storeVal;
    if (Array.isArray(storeVal.result)) return storeVal.result;
    return [];
  }

  $: currentItemCategories = extractCategories(
    realm === "poe2" ? $itemsPoe2 : $itemsPoe,
  );
  $: currentFilterGroups = extractFilterGroups(
    realm === "poe2" ? $filtersPoe2 : $filtersPoe,
  );

  $: allKnownFilterGroups = [
    ...extractFilterGroups($filtersPoe),
    ...extractFilterGroups($filtersPoe2),
  ];

  // Dynamic Status Filter parsing
  $: statusGroup = currentFilterGroups.find((g) => g.id === "status_filters");
  $: statusFilter =
    statusGroup?.filters?.find((f) => f.id === "status") ||
    statusGroup?.filters?.[0];
  $: statusTitle = statusGroup?.title || statusFilter?.text || "Status";
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

  $: if (realm !== previousRealm) {
    previousRealm = realm;
    selectedItem = null;
    searchQuery = "";
    isItemDropdownOpen = false;
    itemHighlightedIndex = -1;
    activeOptionKey = null;
  }

  $: {
    for (const group of currentFilterGroups) {
      if (group.id === "status_filters") continue;
      if (!filterValues[group.id]) {
        filterValues[group.id] = {};
      }
      if (groupCollapsed[group.id] === undefined) {
        groupCollapsed[group.id] = Boolean(group.hidden);
      }
      if (Array.isArray(group.filters)) {
        for (const f of group.filters) {
          if (!filterValues[group.id][f.id]) {
            filterValues[group.id][f.id] = {};
          }
        }
      }
    }
  }

  function getItemDisplayName(entry: ItemEntry | null | undefined): string {
    if (!entry) return "";
    if (entry.text) return entry.text;
    if (entry.name) {
      return entry.type ? `${entry.name} (${entry.type})` : entry.name;
    }
    return entry.type || "";
  }

  function getActiveRarityText(
    fValues: Record<string, Record<string, any>>,
  ): string {
    for (const [gid, gVals] of Object.entries(fValues)) {
      for (const [fid, fVal] of Object.entries(gVals)) {
        if (fid.toLowerCase().includes("rarity") && fVal?.option) {
          const gDef = allKnownFilterGroups.find((g) => g.id === gid);
          const fDef = gDef?.filters?.find((f) => f.id === fid);
          const opt = fDef?.option?.options?.find((o) => o.id === fVal.option);
          const raw = opt?.text || fVal.option;
          if (raw && raw.toLowerCase() !== "any") {
            return raw;
          }
        }
      }
    }
    return "";
  }

  function computeDisplayName(
    customTitle: string,
    item: ItemEntry | null,
    queryText: string,
    fValues: Record<string, Record<string, any>>,
    currentRealm: string,
    initDisplay: string,
    entriesList: ItemEntry[],
  ): string {
    if (customTitle && customTitle.trim()) {
      return customTitle.trim();
    }

    const rarityText = getActiveRarityText(fValues);

    const activeItem =
      item ||
      (queryText.trim()
        ? entriesList.find(
            (e) =>
              (e.name &&
                e.name.toLowerCase() === queryText.trim().toLowerCase()) ||
              (e.text || e.type).toLowerCase() ===
                queryText.trim().toLowerCase(),
          )
        : null);

    if (activeItem) {
      const isUnique = Boolean(
        activeItem.flags?.unique ||
          (activeItem.name && activeItem.name !== activeItem.type),
      );

      if (isUnique) {
        return activeItem.name || activeItem.text || activeItem.type;
      } else {
        const baseType = activeItem.type || activeItem.text || "";
        if (rarityText) {
          return `${rarityText} ${baseType}`.trim();
        }
        return baseType;
      }
    }

    for (const [gid, gVals] of Object.entries(fValues)) {
      for (const [fid, fVal] of Object.entries(gVals)) {
        const isTierKey =
          fid.toLowerCase().includes("tier") ||
          fid.toLowerCase().includes("waystone") ||
          fid.toLowerCase().includes("map_tier");
        if (isTierKey && fVal?.min !== undefined && fVal?.min !== "") {
          return `Waystone (Tier ${fVal.min})`;
        }
      }
    }

    let categoryText = "";
    for (const [gid, gVals] of Object.entries(fValues)) {
      for (const [fid, fVal] of Object.entries(gVals)) {
        if (
          (fid.toLowerCase().includes("category") ||
            fid.toLowerCase().includes("type")) &&
          !fid.toLowerCase().includes("rarity") &&
          fVal?.option
        ) {
          const gDef = allKnownFilterGroups.find((g) => g.id === gid);
          const fDef = gDef?.filters?.find((f) => f.id === fid);
          const opt = fDef?.option?.options?.find((o) => o.id === fVal.option);
          const raw = opt?.text || fVal.option;
          if (raw && raw.toLowerCase() !== "any") {
            categoryText = raw;
          }
        }
      }
    }

    if (rarityText && categoryText) {
      return `${rarityText} ${categoryText}`.trim();
    }
    if (categoryText) {
      return categoryText.trim();
    }
    if (rarityText) {
      return `${rarityText} Item`.trim();
    }

    return initDisplay?.trim() || `${currentRealm.toUpperCase()} Trade Search`;
  }

  $: computedDisplayName = computeDisplayName(
    title,
    selectedItem,
    searchQuery,
    filterValues,
    realm,
    initialDisplayName,
    allItemEntries,
  );

  $: filteredItems = searchQuery.trim()
    ? allItemEntries
        .filter((entry) => {
          const label = getItemDisplayName(entry);
          return label.toLowerCase().includes(searchQuery.toLowerCase().trim());
        })
        .slice(0, 50)
    : [];

  function hydrateFromPayload() {
    if (!initialPayload?.query) return;

    if (initialPayload.query.status?.option) {
      statusOption = initialPayload.query.status.option;
    }

    if (allItemEntries.length > 0 && !selectedItem) {
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
    }

    if (initialPayload.query.filters) {
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

    hasHydrated = true;
  }

  $: if (allItemEntries.length > 0 && initialPayload && !hasHydrated) {
    hydrateFromPayload();
  }

  function startResize(e: PointerEvent) {
    isResizing = true;
    e.preventDefault();
    window.addEventListener("pointermove", handleResize);
    window.addEventListener("pointerup", stopResize);
  }

  function handleResize(e: PointerEvent) {
    if (!isResizing) return;
    const newWidth = Math.max(460, Math.min(window.innerWidth - 60, e.clientX));
    drawerWidth = newWidth;
  }

  function stopResize() {
    isResizing = false;
    window.removeEventListener("pointermove", handleResize);
    window.removeEventListener("pointerup", stopResize);
  }

  function handleSelectItem(entry: ItemEntry) {
    selectedItem = entry;
    searchQuery = getItemDisplayName(entry);
    isItemDropdownOpen = false;
    itemHighlightedIndex = -1;
  }

  function handleSearchInput() {
    if (selectedItem && getItemDisplayName(selectedItem) !== searchQuery) {
      selectedItem = null;
    }
    isItemDropdownOpen = true;
    itemHighlightedIndex = filteredItems.length > 0 ? 0 : -1;
  }

  function handleItemKeyDown(e: KeyboardEvent) {
    if (!isItemDropdownOpen && filteredItems.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        isItemDropdownOpen = true;
        itemHighlightedIndex = 0;
        e.preventDefault();
        return;
      }
    }

    if (!isItemDropdownOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemHighlightedIndex = (itemHighlightedIndex + 1) % filteredItems.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemHighlightedIndex =
        (itemHighlightedIndex - 1 + filteredItems.length) %
        filteredItems.length;
    } else if (e.key === "Enter") {
      if (
        itemHighlightedIndex >= 0 &&
        itemHighlightedIndex < filteredItems.length
      ) {
        e.preventDefault();
        handleSelectItem(filteredItems[itemHighlightedIndex]);
      }
    } else if (e.key === "Escape") {
      isItemDropdownOpen = false;
      itemHighlightedIndex = -1;
    }
  }

  function toggleGroupCollapse(groupId: string) {
    groupCollapsed[groupId] = !groupCollapsed[groupId];
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

  function isBuyoutPriceFilter(f: FilterEntry): boolean {
    const textLower = (f.text || "").toLowerCase();
    const idLower = (f.id || "").toLowerCase();
    return (
      textLower.includes("buyout price") ||
      idLower === "price" ||
      idLower === "buyout_price"
    );
  }

  function isAlwaysSelectFilter(f: FilterEntry): boolean {
    const textLower = (f.text || "").toLowerCase();
    const idLower = (f.id || "").toLowerCase();
    return (
      isBuyoutPriceFilter(f) ||
      textLower.includes("listed") ||
      idLower.includes("listed") ||
      idLower.includes("indexed")
    );
  }

  function getResolvedOptions(entry: FilterEntry): FilterOptionEntry[] {
    const list: FilterOptionEntry[] = [];
    let hasNullOpt = false;

    if (entry.option?.options) {
      for (const opt of entry.option.options) {
        if (opt.id === null) hasNullOpt = true;
        list.push(opt);
      }
    }

    if (entry.option?.knownItem?.uniques) {
      const seen = new Set(list.map((o) => o.id));
      for (const item of uniqueItems) {
        if (item.name && !seen.has(item.name)) {
          seen.add(item.name);
          list.push({ id: item.name, text: getItemDisplayName(item) });
        }
      }
    }

    if (!hasNullOpt) {
      list.unshift({ id: null, text: "Any" });
    }

    return list;
  }

  function selectFilterOption(
    groupId: string,
    filterId: string,
    opt: FilterOptionEntry,
  ) {
    handleFilterChange(groupId, filterId, "option", opt.id);
    activeOptionKey = null;
    optionHighlightedIndex = -1;
    delete optionSearchQueries[`${groupId}_${filterId}`];
  }

  function handleOptionKeyDown(
    e: KeyboardEvent,
    groupId: string,
    filterId: string,
    currentOptions: FilterOptionEntry[],
  ) {
    if (currentOptions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      optionHighlightedIndex =
        (optionHighlightedIndex + 1) % currentOptions.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      optionHighlightedIndex =
        (optionHighlightedIndex - 1 + currentOptions.length) %
        currentOptions.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        optionHighlightedIndex >= 0 &&
        optionHighlightedIndex < currentOptions.length
      ) {
        selectFilterOption(
          groupId,
          filterId,
          currentOptions[optionHighlightedIndex],
        );
      }
    } else if (e.key === "Escape") {
      activeOptionKey = null;
      optionHighlightedIndex = -1;
    }
  }

  function handleWindowClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".autocomplete-wrapper")) {
      isItemDropdownOpen = false;
    }
    if (!target.closest(".combobox-wrapper")) {
      activeOptionKey = null;
    }
  }

  function buildPayloads(): { payload: any; full_payload: any } {
    const base = initialPayload
      ? JSON.parse(JSON.stringify(initialPayload))
      : {};

    const baseQuery: any = {
      ...(base.query || {}),
      stats: base.query?.stats || [{ type: "and", filters: [] }],
    };

    if (statusOption) {
      baseQuery.status = { option: statusOption };
    }

    if (selectedItem) {
      if (selectedItem.name) {
        baseQuery.name = selectedItem.name;
      } else {
        delete baseQuery.name;
      }

      if (selectedItem.disc) {
        baseQuery.type = {
          option: selectedItem.type,
          discriminator: selectedItem.disc,
        };
      } else {
        baseQuery.type = selectedItem.type;
      }
    } else {
      delete baseQuery.name;
      delete baseQuery.type;
    }

    const currentRealmGroupIds = new Set(renderedFilterGroups.map((g) => g.id));
    const allGroupIds = new Set<string>([
      ...Object.keys(filterValues),
      ...(initialPayload?.query?.filters
        ? Object.keys(initialPayload.query.filters)
        : []),
    ]);

    const fullFilters: Record<string, any> = {};
    const searchFilters: Record<string, any> = {};

    for (const groupId of allGroupIds) {
      if (groupId === "status_filters") continue;

      const isCurrentRealm = currentRealmGroupIds.has(groupId);
      const isExpanded = !groupCollapsed[groupId];
      const isVisibleRightNow = isCurrentRealm && isExpanded;

      const groupState = filterValues[groupId] || {};
      const groupFiltersPayload: Record<string, any> = {};

      if (initialPayload?.query?.filters?.[groupId]?.filters) {
        Object.assign(
          groupFiltersPayload,
          JSON.parse(
            JSON.stringify(initialPayload.query.filters[groupId].filters),
          ),
        );
      }

      const groupDef = allKnownFilterGroups.find((g) => g.id === groupId);
      if (groupDef && Array.isArray(groupDef.filters)) {
        for (const fDef of groupDef.filters) {
          const val = groupState[fDef.id];
          if (!val) continue;

          const entryPayload: Record<string, any> = {};

          if (
            fDef.option &&
            val.option !== undefined &&
            val.option !== null &&
            val.option !== ""
          ) {
            entryPayload.option = val.option;
          }

          if (
            fDef.input &&
            typeof val.input === "string" &&
            val.input.trim() !== ""
          ) {
            entryPayload.input = val.input.trim();
          }

          if (fDef.minMax) {
            if (
              val.min !== undefined &&
              val.min !== "" &&
              !isNaN(Number(val.min))
            ) {
              entryPayload.min = Number(val.min);
            }
            if (
              val.max !== undefined &&
              val.max !== "" &&
              !isNaN(Number(val.max))
            ) {
              entryPayload.max = Number(val.max);
            }
          }

          if (fDef.sockets) {
            for (const s of ["r", "g", "b", "w"] as const) {
              if (
                val[s] !== undefined &&
                val[s] !== "" &&
                !isNaN(Number(val[s]))
              ) {
                entryPayload[s] = Number(val[s]);
              }
            }
          }

          if (Object.keys(entryPayload).length > 0) {
            groupFiltersPayload[fDef.id] = entryPayload;
          }
        }
      }

      const hasFilterValues = Object.keys(groupFiltersPayload).length > 0;

      if (hasFilterValues || isVisibleRightNow) {
        fullFilters[groupId] = {
          disabled: !isVisibleRightNow,
          filters: groupFiltersPayload,
        };
      }

      if (isVisibleRightNow && hasFilterValues) {
        searchFilters[groupId] = {
          disabled: false,
          filters: groupFiltersPayload,
        };
      }
    }

    const full_payload = {
      ...base,
      query: {
        ...baseQuery,
        ...(Object.keys(fullFilters).length > 0
          ? { filters: fullFilters }
          : {}),
      },
      sort: base.sort || { price: "asc" },
    };
    if (Object.keys(fullFilters).length === 0)
      delete full_payload.query.filters;

    const payload = {
      ...base,
      query: {
        ...baseQuery,
        ...(Object.keys(searchFilters).length > 0
          ? { filters: searchFilters }
          : {}),
      },
      sort: base.sort || { price: "asc" },
    };
    if (Object.keys(searchFilters).length === 0) delete payload.query.filters;

    return { payload, full_payload };
  }

  // Callable externally from parent before switching active tile
  export function saveWithoutSearch() {
    const { payload, full_payload } = buildPayloads();
    dispatch("save_only", {
      title,
      displayName: computedDisplayName,
      realm,
      payload,
      full_payload,
      sort: sortOption,
    });
  }

  function handleSubmit() {
    const { payload, full_payload } = buildPayloads();
    dispatch("save_and_search", {
      title,
      displayName: computedDisplayName,
      realm,
      payload,
      full_payload,
      sort: sortOption,
    });
    dispatch("close");
  }
</script>

<svelte:window on:click={handleWindowClick} />

<aside class="drawer" style="width: {drawerWidth}px;" on:wheel|stopPropagation>
  <div
    class="resize-handle"
    on:pointerdown={startResize}
    title="Drag to resize"
  ></div>

  <!-- Header with Double-Click Title Editing (Pen emoji removed) -->
  <div class="header">
    <div class="title-area">
      {#if isEditingTitle}
        <input
          type="text"
          class="title-input"
          bind:value={title}
          placeholder="Custom title..."
          on:blur={() => (isEditingTitle = false)}
          on:keydown={(e) => e.key === "Enter" && (isEditingTitle = false)}
          autoFocus
        />
      {:else}
        <h3
          on:dblclick={() => (isEditingTitle = true)}
          title="Double click to rename"
        >
          {computedDisplayName}
        </h3>
      {/if}
    </div>
    <button type="button" class="close-btn" on:click={() => dispatch("close")}
      >✕</button
    >
  </div>

  <form on:submit|preventDefault={handleSubmit}>
    <div class="scroll-area" on:wheel|stopPropagation>
      <!-- Top Bar: Item Name | Realm | Status | Sorting -->
      <div class="top-bar">
        <div class="top-field autocomplete-wrapper flex-item-name">
          <label for="item-search">Item Name</label>
          <input
            id="item-search"
            name="item_search"
            type="text"
            bind:value={searchQuery}
            on:input={handleSearchInput}
            on:keydown={handleItemKeyDown}
            on:focus={() => {
              isItemDropdownOpen = true;
              itemHighlightedIndex = filteredItems.length > 0 ? 0 : -1;
            }}
            placeholder="Type exact item..."
            autocomplete="off"
          />

          {#if isItemDropdownOpen && filteredItems.length > 0}
            <ul class="dropdown" on:wheel|stopPropagation>
              {#each filteredItems as entry, index}
                <li
                  class:unique={entry.flags?.unique}
                  class:highlighted={itemHighlightedIndex === index}
                  on:mousedown|preventDefault={() => handleSelectItem(entry)}
                >
                  {getItemDisplayName(entry)}
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="top-field flex-realm">
          <label for="tile-realm">Realm</label>
          <select id="tile-realm" name="tile_realm" bind:value={realm}>
            <option value="poe">PoE 1</option>
            <option value="poe2">PoE 2</option>
          </select>
        </div>

        {#if statusOptions.length > 0}
          <div class="top-field flex-status">
            <label for="tile-status">{statusTitle}</label>
            <select
              id="tile-status"
              name="tile_status"
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
          <label for="tile-sort">Sort</label>
          <select id="tile-sort" name="tile_sort" bind:value={sortOption}>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="time_desc">Listed: Newest</option>
          </select>
        </div>
      </div>

      <!-- Outer 2-Column Responsive Layout -->
      <div class="main-columns">
        <div class="groups-section">
          <div class="filter-groups">
            {#each renderedFilterGroups as group (group.id)}
              <div class="filter-group-card">
                <button
                  type="button"
                  class="group-toggle"
                  on:click={() => toggleGroupCollapse(group.id)}
                >
                  <span>{group.title || group.id}</span>
                  <span class="chevron"
                    >{groupCollapsed[group.id] ? "▸" : "▾"}</span
                  >
                </button>

                {#if !groupCollapsed[group.id]}
                  <div
                    class="group-content"
                    class:max-two-cols={(group.filters || []).length <= 2}
                  >
                    {#each group.filters || [] as fEntry (fEntry.id)}
                      <div
                        class="filter-row"
                        class:full-row={Boolean(
                          fEntry.sockets ||
                            fEntry.input ||
                            isBuyoutPriceFilter(fEntry),
                        )}
                        class:socket-row={Boolean(fEntry.sockets)}
                      >
                        <div
                          class="filter-label"
                          title={fEntry.text || fEntry.id}
                        >
                          <span>{fEntry.text || fEntry.id}</span>
                          {#if fEntry.tip}
                            <span class="tooltip-icon" title={fEntry.tip}
                              >?</span
                            >
                          {/if}
                        </div>

                        <div class="filter-controls">
                          {#if fEntry.option}
                            {@const allOpts = getResolvedOptions(fEntry)}
                            {@const isAlwaysSelect =
                              isAlwaysSelectFilter(fEntry) ||
                              allOpts.length <= 4}

                            {#if isAlwaysSelect}
                              <select
                                id={`filter-${group.id}-${fEntry.id}-opt`}
                                name={`filter_${group.id}_${fEntry.id}_opt`}
                                value={filterValues[group.id]?.[fEntry.id]
                                  ?.option ?? ""}
                                on:change={(e) =>
                                  handleFilterChange(
                                    group.id,
                                    fEntry.id,
                                    "option",
                                    e.currentTarget.value || null,
                                  )}
                              >
                                {#each allOpts as opt}
                                  <option value={opt.id ?? ""}
                                    >{opt.text}</option
                                  >
                                {/each}
                              </select>
                            {:else}
                              {@const optKey = `${group.id}_${fEntry.id}`}
                              {@const currentOptVal =
                                filterValues[group.id]?.[fEntry.id]?.option}
                              {@const selectedOpt = allOpts.find((o) =>
                                currentOptVal
                                  ? o.id === currentOptVal
                                  : o.id === null,
                              )}
                              {@const nullOpt = allOpts.find(
                                (o) => o.id === null,
                              )}
                              {@const searchQ =
                                optionSearchQueries[optKey] ?? ""}
                              {@const filteredOpts = searchQ.trim()
                                ? allOpts
                                    .filter((o) =>
                                      o.text
                                        .toLowerCase()
                                        .includes(searchQ.toLowerCase().trim()),
                                    )
                                    .slice(0, 50)
                                : allOpts.slice(0, 50)}

                              <div class="combobox-wrapper">
                                <input
                                  id={`filter-${group.id}-${fEntry.id}-opt-search`}
                                  name={`filter_${group.id}_${fEntry.id}_opt_search`}
                                  type="text"
                                  autocomplete="off"
                                  placeholder={nullOpt?.text || "Any"}
                                  value={activeOptionKey === optKey
                                    ? (optionSearchQueries[optKey] ??
                                      (selectedOpt?.id !== null
                                        ? (selectedOpt?.text ?? "")
                                        : ""))
                                    : selectedOpt?.id !== null
                                      ? (selectedOpt?.text ?? "")
                                      : ""}
                                  on:focus={() => {
                                    activeOptionKey = optKey;
                                    optionHighlightedIndex = 0;
                                    optionSearchQueries[optKey] = "";
                                  }}
                                  on:input={(e) => {
                                    activeOptionKey = optKey;
                                    optionSearchQueries[optKey] =
                                      e.currentTarget.value;
                                    optionHighlightedIndex = 0;
                                  }}
                                  on:keydown={(e) =>
                                    handleOptionKeyDown(
                                      e,
                                      group.id,
                                      fEntry.id,
                                      filteredOpts,
                                    )}
                                />

                                {#if currentOptVal !== undefined && currentOptVal !== null && currentOptVal !== ""}
                                  <button
                                    type="button"
                                    class="clear-opt-btn"
                                    on:click={() =>
                                      selectFilterOption(
                                        group.id,
                                        fEntry.id,
                                        nullOpt || { id: null, text: "Any" },
                                      )}
                                    title="Clear"
                                  >
                                    ✕
                                  </button>
                                {/if}

                                {#if activeOptionKey === optKey && filteredOpts.length > 0}
                                  <ul class="dropdown" on:wheel|stopPropagation>
                                    {#each filteredOpts as opt, idx}
                                      <li
                                        class:highlighted={optionHighlightedIndex ===
                                          idx}
                                        class:selected={opt.id ===
                                          currentOptVal ||
                                          (opt.id === null && !currentOptVal)}
                                        on:mousedown|preventDefault={() =>
                                          selectFilterOption(
                                            group.id,
                                            fEntry.id,
                                            opt,
                                          )}
                                      >
                                        {opt.text}
                                      </li>
                                    {/each}
                                  </ul>
                                {/if}
                              </div>
                            {/if}
                          {/if}

                          {#if fEntry.input}
                            <input
                              id={`filter-${group.id}-${fEntry.id}-input`}
                              name={`filter_${group.id}_${fEntry.id}_input`}
                              type="text"
                              placeholder={fEntry.input.placeholder ||
                                "Value..."}
                              value={filterValues[group.id]?.[fEntry.id]
                                ?.input ?? ""}
                              on:input={(e) =>
                                handleFilterChange(
                                  group.id,
                                  fEntry.id,
                                  "input",
                                  e.currentTarget.value,
                                )}
                            />
                          {/if}

                          {#if fEntry.minMax}
                            <div class="min-max-controls">
                              <input
                                id={`filter-${group.id}-${fEntry.id}-min`}
                                name={`filter_${group.id}_${fEntry.id}_min`}
                                type="number"
                                placeholder="Min"
                                value={filterValues[group.id]?.[fEntry.id]
                                  ?.min ?? ""}
                                on:input={(e) =>
                                  handleFilterChange(
                                    group.id,
                                    fEntry.id,
                                    "min",
                                    e.currentTarget.value,
                                  )}
                              />
                              <input
                                id={`filter-${group.id}-${fEntry.id}-max`}
                                name={`filter_${group.id}_${fEntry.id}_max`}
                                type="number"
                                placeholder="Max"
                                value={filterValues[group.id]?.[fEntry.id]
                                  ?.max ?? ""}
                                on:input={(e) =>
                                  handleFilterChange(
                                    group.id,
                                    fEntry.id,
                                    "max",
                                    e.currentTarget.value,
                                  )}
                              />
                            </div>
                          {/if}

                          {#if fEntry.sockets}
                            <div class="sockets-grid">
                              <div class="socket-input sock-r">
                                <span>R</span>
                                <input
                                  id={`filter-${group.id}-${fEntry.id}-sock-r`}
                                  name={`filter_${group.id}_${fEntry.id}_sock_r`}
                                  type="number"
                                  min="0"
                                  max="6"
                                  value={filterValues[group.id]?.[fEntry.id]
                                    ?.r ?? ""}
                                  on:input={(e) =>
                                    handleFilterChange(
                                      group.id,
                                      fEntry.id,
                                      "r",
                                      e.currentTarget.value,
                                    )}
                                />
                              </div>
                              <div class="socket-input sock-g">
                                <span>G</span>
                                <input
                                  id={`filter-${group.id}-${fEntry.id}-sock-g`}
                                  name={`filter_${group.id}_${fEntry.id}_sock_g`}
                                  type="number"
                                  min="0"
                                  max="6"
                                  value={filterValues[group.id]?.[fEntry.id]
                                    ?.g ?? ""}
                                  on:input={(e) =>
                                    handleFilterChange(
                                      group.id,
                                      fEntry.id,
                                      "g",
                                      e.currentTarget.value,
                                    )}
                                />
                              </div>
                              <div class="socket-input sock-b">
                                <span>B</span>
                                <input
                                  id={`filter-${group.id}-${fEntry.id}-sock-b`}
                                  name={`filter_${group.id}_${fEntry.id}_sock_b`}
                                  type="number"
                                  min="0"
                                  max="6"
                                  value={filterValues[group.id]?.[fEntry.id]
                                    ?.b ?? ""}
                                  on:input={(e) =>
                                    handleFilterChange(
                                      group.id,
                                      fEntry.id,
                                      "b",
                                      e.currentTarget.value,
                                    )}
                                />
                              </div>
                              <div class="socket-input sock-w">
                                <span>W</span>
                                <input
                                  id={`filter-${group.id}-${fEntry.id}-sock-w`}
                                  name={`filter_${group.id}_${fEntry.id}_sock_w`}
                                  type="number"
                                  min="0"
                                  max="6"
                                  value={filterValues[group.id]?.[fEntry.id]
                                    ?.w ?? ""}
                                  on:input={(e) =>
                                    handleFilterChange(
                                      group.id,
                                      fEntry.id,
                                      "w",
                                      e.currentTarget.value,
                                    )}
                                />
                              </div>
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <div class="stats-section">
          <div class="stats-card">
            <div class="stats-header">
              <span>Stat Filters</span>
              <button type="button" class="add-stat-btn" disabled
                >+ Add Stat</button
              >
            </div>
            <div class="stats-body">
              <p class="placeholder-text">
                Stat filters will be configured here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="actions">
      <button type="button" on:click={() => dispatch("close")}>Cancel</button>
      <button type="submit" class="primary"> Search </button>
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
    z-index: 200;
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

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid #232838;
    background: #14161f;
    flex-shrink: 0;
  }

  .title-area {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    margin-right: 0.75rem;
  }

  .title-area h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #e2e8f0;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title-input {
    background: #232838;
    border: 1px solid #3b82f6;
    color: #fff;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
    outline: none;
    width: 260px;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 1.15rem;
    padding: 0.2rem 0.4rem;
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
    gap: 0.55rem;
    align-items: flex-end;
    background: #1b1e2a;
    padding: 0.65rem 0.75rem;
    border-radius: 4px;
    border: 1px solid #252a3a;
    width: 100%;
    box-sizing: border-box;
  }

  .top-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .top-field label {
    font-size: 0.72rem;
    color: #94a3b8;
    font-weight: 500;
  }

  .flex-item-name {
    flex: 2;
    min-width: 140px;
  }
  .flex-realm {
    flex: 0 0 85px;
  }
  .flex-status {
    flex: 1.2;
    min-width: 110px;
  }
  .flex-sort {
    flex: 1.2;
    min-width: 110px;
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

  .groups-section,
  .stats-section {
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

  .filter-group-card {
    background: #1d212d;
    border: 1px solid #2a3040;
    border-radius: 4px;
    position: relative;
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
    container-type: inline-size;
    container-name: group;
  }
  .filter-group-card:focus-within {
    z-index: 30;
  }

  .group-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0.65rem;
    background: #232838;
    border: none;
    color: #e2e8f0;
    font-size: 0.775rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    border-radius: 4px 4px 0 0;
  }
  .group-toggle:hover {
    background: #293044;
  }

  .chevron {
    color: #94a3b8;
    font-size: 0.65rem;
  }

  .group-content {
    padding: 0.45rem 0.55rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem 0.55rem;
    width: 100%;
    box-sizing: border-box;
  }

  @container group (min-width: 580px) {
    .group-content {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container group (min-width: 980px) {
    .group-content:not(.max-two-cols) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .filter-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.25rem;
    position: relative;
    min-height: 26px;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }
  .filter-row:focus-within {
    z-index: 45;
  }

  .filter-row.full-row {
    grid-column: 1 / -1;
  }

  .filter-label {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.73rem;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-controls {
    flex: 0 0 42%;
    max-width: 45%;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .filter-controls > select,
  .filter-controls > input,
  .filter-controls > .combobox-wrapper {
    flex: 1 1 0;
    width: 100%;
    min-width: 0;
  }
  .filter-controls > .min-max-controls {
    flex: 1 1 0;
    width: 100%;
    min-width: 0;
  }

  .filter-row.full-row:not(.socket-row) .filter-label {
    flex: 0 0 25%;
    max-width: 28%;
  }
  .filter-row.full-row:not(.socket-row) .filter-controls {
    flex: 1 1 auto;
    max-width: 75%;
    display: flex;
    gap: 0.35rem;
  }

  .filter-row.socket-row .filter-label {
    flex: 0 0 22%;
    max-width: 25%;
  }
  .filter-row.socket-row .filter-controls {
    flex: 1 1 auto;
    max-width: 78%;
  }

  .min-max-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.2rem;
    width: 100%;
    min-width: 0;
  }
  .min-max-controls input {
    width: 100%;
    min-width: 0;
  }

  input,
  select {
    background: #232838;
    border: 1px solid #333c52;
    color: #fff;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    outline: none;
    font-size: 0.775rem;
    height: 26px;
    min-width: 0;
    box-sizing: border-box;
  }
  input:focus,
  select:focus {
    border-color: #3b82f6;
  }

  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .autocomplete-wrapper {
    position: relative;
    z-index: 40;
    min-width: 0;
  }
  .combobox-wrapper {
    position: relative;
    width: 100%;
    min-width: 0;
  }
  .combobox-wrapper:focus-within {
    z-index: 50;
  }
  .combobox-wrapper input {
    width: 100%;
    padding-right: 1.5rem;
    min-width: 0;
  }

  .clear-opt-btn {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 0.7rem;
    padding: 1px 3px;
  }
  .clear-opt-btn:hover {
    color: #cbd5e1;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 260px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #1e2230;
    border: 1px solid #333c52;
    border-radius: 4px;
    list-style: none;
    padding: 0;
    margin: 2px 0 0 0;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }
  .dropdown li {
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    font-size: 0.775rem;
    color: #cbd5e1;
    border-bottom: 1px solid #282e40;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dropdown li:hover,
  .dropdown li.highlighted {
    background: #293044;
  }
  .dropdown li.selected {
    color: #38bdf8;
  }
  .dropdown li.unique {
    color: #af6025;
    font-weight: 600;
  }

  .tooltip-icon {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #333c52;
    color: #94a3b8;
    font-size: 0.62rem;
    cursor: help;
    flex-shrink: 0;
  }

  .sockets-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.2rem;
    width: 100%;
    min-width: 0;
  }
  .socket-input {
    display: flex;
    align-items: center;
    border: 1px solid #333c52;
    border-radius: 4px;
    background: #232838;
    height: 26px;
    min-width: 0;
  }
  .socket-input span {
    padding: 0 0.2rem;
    font-weight: bold;
    font-size: 0.65rem;
    flex-shrink: 0;
  }
  .sock-r span {
    color: #ef4444;
  }
  .sock-g span {
    color: #22c55e;
  }
  .sock-b span {
    color: #3b82f6;
  }
  .sock-w span {
    color: #f8fafc;
  }
  .socket-input input {
    width: 100%;
    min-width: 0;
    border: none;
    border-left: 1px solid #333c52;
    background: transparent;
    padding: 0.15rem;
    text-align: center;
    height: 100%;
    border-radius: 0;
  }

  .stats-card {
    background: #1b1e2a;
    border: 1px solid #262c3e;
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
  }
  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.45rem 0.65rem;
    background: #212636;
    border-bottom: 1px solid #262c3e;
    font-size: 0.775rem;
    font-weight: 600;
  }
  .add-stat-btn {
    background: #2d354a;
    border: 1px solid #3a4460;
    color: #94a3b8;
    font-size: 0.7rem;
    padding: 0.2rem 0.45rem;
    border-radius: 3px;
    cursor: not-allowed;
  }
  .stats-body {
    padding: 1.5rem 1rem;
    text-align: center;
  }
  .placeholder-text {
    margin: 0;
    font-size: 0.75rem;
    color: #64748b;
    font-style: italic;
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
  }
  .actions button.primary {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #fff;
    font-weight: 500;
  }
</style>
