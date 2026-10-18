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
    migrateItemRef,
    findEntryIndexByQuery,
    findItemIndex,
    formatItemRef,
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
    currentLanguage,
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
  // Language the currently selected item's TEXT is in. Only advances once the
  // item has actually been migrated to the new language's catalog.
  let previousLanguage: string = $currentLanguage || "EN";
  let previousLeague: string = initialLeague || initialPayload?.league || "";
  let league: string = initialLeague || initialPayload?.league || "";

  // Snapshot of the item catalog at the moment a language change was first seen.
  // When `allItemEntries` becomes a different array, the catalog was re-fetched.
  let pendingLangCatalog: ItemEntry[] | null = null;

  // Sorting state
  let sortKey: string = "filter:price";
  let sortDirection: "asc" | "desc" = "asc";
  let isSortDropdownOpen: boolean = false;

  // Top bar custom dropdown state ("realm" | "league" | "status" | null)
  let openTopDropdown: "realm" | "league" | "status" | null = null;

  // Drawer Width & Resize state
  let drawerWidth: number = 720;
  let isResizing: boolean = false;

  // Title inline editing
  let isEditingTitle: boolean = false;

  // Item Search State
  let selectedItem: ItemEntry | null = null;
  let currentItemRef: string | null = initialPayload?.item_ref ?? null;
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

  const REALM_OPTIONS: Array<{ id: "poe" | "poe2"; text: string }> = [
    { id: "poe", text: "PoE 1" },
    { id: "poe2", text: "PoE 2" },
  ];

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
  $: statusOptions = (statusFilter?.option?.options || []).filter(
    (o) => o.id !== null,
  );

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

  function handleUserItemSelect(item: ItemEntry | null) {
    if (!item) {
      selectedItem = null;
      currentItemRef = null;
      return;
    }
    selectedItem = item;
    const idx = findItemIndex(allItemEntries, item);
    // The picked item comes from the catalog currently loaded, whose language is
    // `previousLanguage` (it may lag behind `$currentLanguage` during a re-fetch).
    currentItemRef =
      idx >= 0
        ? formatItemRef({
            realm,
            language: previousLanguage,
            index: idx,
          })
        : null;
  }

  // Re-resolve item via migrateItemRef when realm, language, or league/catalog changes
  $: {
    const lang = $currentLanguage || "EN";
    const realmChanged = realm !== previousRealm;
    const langChanged = lang !== previousLanguage;
    const leagueChanged = league !== previousLeague;

    if (
      itemHydrated &&
      allItemEntries.length > 0 &&
      (realmChanged || langChanged || leagueChanged)
    ) {
      if (selectedItem || currentItemRef) {
        // Remember which catalog array we saw when the language flipped; once the
        // store hands us a different array, the catalog has been re-fetched.
        if (langChanged && pendingLangCatalog === null) {
          pendingLangCatalog = allItemEntries;
        }
        const catalogReady =
          langChanged &&
          pendingLangCatalog !== null &&
          pendingLangCatalog !== allItemEntries;

        const tempPayload: any = {
          query: {},
          ...(currentItemRef ? { item_ref: currentItemRef } : {}),
        };
        if (selectedItem) {
          if (selectedItem.name) tempPayload.query.name = selectedItem.name;
          if (selectedItem.disc) {
            tempPayload.query.type = {
              option: selectedItem.type,
              discriminator: selectedItem.disc,
            };
          } else {
            tempPayload.query.type = selectedItem.type;
          }
        }

        const { payload: migrated, changed } = migrateItemRef(
          tempPayload,
          realm,
          lang,
          { catalogReady },
        );

        // If language changed and catalog hasn't finished re-fetching yet, wait
        if (langChanged && !changed && currentItemRef && !catalogReady) {
          // Keep previousLanguage untouched so this reactive block re-runs once store updates
        } else {
          previousRealm = realm;
          previousLanguage = lang;
          previousLeague = league;
          pendingLangCatalog = null;

          const idx = findEntryIndexByQuery(allItemEntries, migrated?.query);
          if (idx >= 0) {
            selectedItem = allItemEntries[idx];
            currentItemRef =
              migrated.item_ref ??
              formatItemRef({ realm, language: lang, index: idx });
            searchQuery = getItemDisplayName(selectedItem);
          } else {
            selectedItem = null;
            currentItemRef = null;
            searchQuery = "";
          }
          isItemDropdownOpen = false;
        }
      } else {
        previousRealm = realm;
        previousLanguage = lang;
        previousLeague = league;
        pendingLangCatalog = null;
        searchQuery = "";
        isItemDropdownOpen = false;
      }
    }
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
    if (!initialPayload?.query && !initialPayload?.item_ref) {
      itemHydrated = true;
      return;
    }
    const hasQueryItem = Boolean(
      initialPayload.query?.name || initialPayload.query?.type,
    );
    if (!hasQueryItem && !initialPayload.item_ref) {
      itemHydrated = true;
      return;
    }
    if (!allItemEntries || allItemEntries.length === 0) return;

    const { payload: migrated } = migrateItemRef(
      initialPayload,
      realm,
      $currentLanguage || "EN",
    );
    initialPayload = migrated;

    const matchedIdx = findEntryIndexByQuery(allItemEntries, migrated?.query);
    if (matchedIdx >= 0) {
      selectedItem = allItemEntries[matchedIdx];
      currentItemRef =
        migrated.item_ref ??
        formatItemRef({
          realm,
          language: $currentLanguage || "EN",
          index: matchedIdx,
        });
      searchQuery = getItemDisplayName(selectedItem);
    } else {
      selectedItem = null;
      currentItemRef = null;
      searchQuery = "";
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
      previousLeague = league;
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

  function handleResetForm() {
    title = "";
    isEditingTitle = false;
    initialDisplayName = "";
    initialPayload = null;

    selectedItem = null;
    currentItemRef = null;
    searchQuery = "";
    isItemDropdownOpen = false;
    openTopDropdown = null;

    const defaultOpt =
      statusOptions.find((o) => o.id === "securable") || statusOptions[0];
    statusOption = defaultOpt?.id ?? "";

    sortKey = "filter:price";
    sortDirection = "asc";
    isSortDropdownOpen = false;
    isAddGroupMenuOpen = false;

    const resetFV: Record<string, Record<string, any>> = {};
    const resetGC: Record<string, boolean> = {};
    for (const group of currentFilterGroups) {
      if (group.id === "status_filters") continue;
      resetFV[group.id] = {};
      resetGC[group.id] = Boolean(group.hidden);
      if (Array.isArray(group.filters)) {
        for (const f of group.filters) {
          resetFV[group.id][f.id] = {};
        }
      }
    }
    filterValues = resetFV;
    groupCollapsed = resetGC;

    statGroups = [
      { id: "stat_group_default", type: "and", collapsed: false, filters: [] },
    ];

    autoSave();
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
      // language of the item's text (lags `$currentLanguage` during catalog re-fetch)
      itemLanguage: previousLanguage,
      itemRef: currentItemRef,
    });

    if (payloads.payload && league) {
      payloads.payload.league = league;
    }
    if (payloads.full_payload && league) {
      payloads.full_payload.league = league;
    }

    // Never drop the ref while an item is selected (autosave must not clobber it).
    currentItemRef =
      payloads.full_payload?.item_ref ?? (selectedItem ? currentItemRef : null);

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
      $currentLanguage !== undefined ||
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
    if (!target.closest(".top-custom-dropdown")) openTopDropdown = null;
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
      if (openTopDropdown) {
        openTopDropdown = null;
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
      if (isItemDropdownOpen || isSortDropdownOpen || openTopDropdown) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) handleSearchAndClose();
      else handleSearchOnly();
    }
  }

  $: activeRealmLabel =
    REALM_OPTIONS.find((r) => r.id === realm)?.text || "PoE 1";
  $: activeLeagueLabel =
    availableLeagues.find((l) => l.id.toString() === league)?.text ||
    league ||
    "League";
  $: activeStatusLabel =
    statusOptions.find((o) => o.id === statusOption)?.text ||
    statusOption ||
    "Status";
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
    on:reset={handleResetForm}
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
            on:select={(e) => handleUserItemSelect(e.detail)}
            on:clear={() => handleUserItemSelect(null)}
          />
        </div>

        <div class="top-row-2">
          <!-- Realm Custom Dropdown -->
          <div class="top-field flex-realm top-custom-dropdown">
            <button
              type="button"
              id="tile-realm"
              class="custom-dropdown-trigger"
              aria-label="Realm"
              aria-expanded={openTopDropdown === "realm"}
              on:click={() =>
                (openTopDropdown =
                  openTopDropdown === "realm" ? null : "realm")}
            >
              <span class="trigger-label">{activeRealmLabel}</span>
              <span class="trigger-arrow">▾</span>
            </button>
            {#if openTopDropdown === "realm"}
              <ul class="dropdown" on:wheel|stopPropagation>
                {#each REALM_OPTIONS as rOpt}
                  <li
                    class:selected={rOpt.id === realm}
                    on:mousedown|preventDefault={() => {
                      realm = rOpt.id;
                      openTopDropdown = null;
                    }}
                  >
                    {rOpt.text}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>

          <!-- League Custom Dropdown -->
          <div class="top-field flex-league top-custom-dropdown">
            <button
              type="button"
              id="tile-league"
              class="custom-dropdown-trigger"
              aria-label="League"
              aria-expanded={openTopDropdown === "league"}
              on:click={() =>
                (openTopDropdown =
                  openTopDropdown === "league" ? null : "league")}
            >
              <span class="trigger-label">{activeLeagueLabel}</span>
              <span class="trigger-arrow">▾</span>
            </button>
            {#if openTopDropdown === "league" && availableLeagues.length > 0}
              <ul class="dropdown" on:wheel|stopPropagation>
                {#each availableLeagues as l}
                  <li
                    class:selected={l.id.toString() === league}
                    on:mousedown|preventDefault={() => {
                      league = l.id.toString();
                      openTopDropdown = null;
                    }}
                  >
                    {l.text}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>

          <!-- Status Custom Dropdown -->
          {#if statusOptions.length > 0}
            <div class="top-field flex-status top-custom-dropdown">
              <button
                type="button"
                id="tile-status"
                class="custom-dropdown-trigger"
                aria-label="Status"
                aria-expanded={openTopDropdown === "status"}
                on:click={() =>
                  (openTopDropdown =
                    openTopDropdown === "status" ? null : "status")}
              >
                <span class="trigger-label">{activeStatusLabel}</span>
                <span class="trigger-arrow">▾</span>
              </button>
              {#if openTopDropdown === "status"}
                <ul class="dropdown" on:wheel|stopPropagation>
                  {#each statusOptions as opt}
                    <li
                      class:selected={opt.id === statusOption}
                      on:mousedown|preventDefault={() => {
                        statusOption = opt.id ?? "";
                        openTopDropdown = null;
                      }}
                    >
                      {opt.text}
                    </li>
                  {/each}
                </ul>
              {/if}
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
    font-family: "Fontin", monospace, sans-serif;
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
     Top Controls Container
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
    position: relative;
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

  /* Unified Top Dropdown Trigger matching SortCombobox & Text Dropdowns */
  .custom-dropdown-trigger {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 12px !important;
    height: 26px !important;
    line-height: 1.15 !important;
    background-color: #000000 !important;
    border: 1px solid #7f7f7f !important;
    border-radius: 0px !important;
    color: #ffffff !important;
    padding: 0 6px !important;
    outline: none;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    cursor: pointer;
    text-align: left;
  }

  .custom-dropdown-trigger:hover,
  .custom-dropdown-trigger:focus,
  .custom-dropdown-trigger[aria-expanded="true"] {
    border-color: #ffffff !important;
  }

  .trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 auto;
    min-width: 0;
  }

  .trigger-arrow {
    color: #888888;
    font-size: 10px;
    flex-shrink: 0;
  }

  .custom-dropdown-trigger:hover .trigger-arrow {
    color: #ffffff;
  }

  .top-custom-dropdown .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    min-width: 100%;
    max-height: 260px;
    overflow-y: auto;
    overscroll-behavior: contain;
    margin: 2px 0 0 0;
    list-style: none;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  /* Main Grid Columns */
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

  /* Non-default filter category fields: white text and white border */
  .filter-groups :global(.is-modified),
  .filter-groups :global([data-modified="true"]) {
    color: #ffffff !important;
    border-color: #ffffff !important;
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
    font-family: "Fontin", monospace, sans-serif;
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
