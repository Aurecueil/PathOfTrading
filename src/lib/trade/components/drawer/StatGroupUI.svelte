<!-- src/lib/trade/components/drawer/StatGroupUI.svelte -->
<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import StatRow from "./StatRow.svelte";
  import type { StatEntry, StatGroup } from "$lib/types/stats";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import RealmIcon from "$lib/trade/components/drawer/RealmIcon.svelte";

  export let group: {
    id: string;
    type: string;
    collapsed?: boolean;
    disabled?: boolean;
    value?: { min?: any; max?: any };
    filters: Array<{
      id: string;
      statEntry?: StatEntry;
      groupLabel?: string;
      value?: any;
      disabled?: boolean;
      outOfRealm?: boolean;
    }>;
  };

  export let statCatalog: StatGroup[] = [];
  export let canDelete: boolean = true;
  export let showToggle: boolean = true;

  const dispatch = createEventDispatcher<{
    changeType: string;
    changeValue: { min?: any; max?: any };
    toggleCollapse: void;
    addStat: StatEntry;
    updateStatValue: { index: number; value: any };
    toggleStatDisabled: number;
    updateStatEntry: { index: number; stat: StatEntry };
    removeStat: number;
    deleteGroup: void;
  }>();

  let searchQuery: string = "";
  let isDropdownOpen: boolean = false;
  let isTypeMenuOpen: boolean = false;
  let highlightedIndex: number = -1;
  let visibleStatCount: number = 50;
  let dropdownEl: HTMLUListElement | undefined;
  let searchboxEl: HTMLDivElement | undefined;
  let addStatInputEl: HTMLInputElement | undefined;
  let typeWrapperEl: HTMLDivElement | undefined;

  const GROUP_TYPES = [
    { id: "and", label: "And" },
    { id: "not", label: "Not" },
    { id: "if", label: "If" },
    { id: "count", label: "Count" },
    { id: "weight", label: "Weighted Sum" },
    { id: "weight2", label: "Weighted Sum 2" },
    { id: "crucible", label: "Crucible Passive Tree" },
    { id: "mercenary", label: "Mercenary" },
  ];

  function requiresGroupValue(t: string): boolean {
    return ["count", "weight", "weight2", "crucible", "mercenary"].includes(t);
  }

  $: isWeighted = group.type === "weight" || group.type === "weight2";
  $: hasValueInputs = requiresGroupValue(group.type);
  $: activeGroupTypeLabel =
    GROUP_TYPES.find((gt) => gt.id === group.type)?.label || group.type;

  function getTagColor(label: string): string {
    const l = (label || "").toLowerCase();
    if (l.includes("pseudo")) return "#005DBD";
    if (l.includes("crafted")) return "#D1D1D1";
    if (l.includes("explicit")) return "#57AFF1";
    if (l.includes("implicit")) return "#625F15";
    if (l.includes("fractured")) return "#A08F5F";
    if (l.includes("enchant")) return "#89549A";
    if (l.includes("scourge")) return "#FF6E25";
    if (l.includes("crucible")) return "#FF7339";
    if (l.includes("mercenary")) return "#8C6F3C";
    return "#888888";
  }

  $: flatStats = statCatalog.flatMap((g) =>
    (g.entries || []).map((e) => ({
      ...e,
      groupLabel: g.label || g.id,
    })),
  );

  $: allowedStats = flatStats.filter((item) => {
    const typeLower = (item.type || "").toLowerCase();
    const labelLower = (item.groupLabel || "").toLowerCase();

    if (group.type === "mercenary") {
      return typeLower === "mercenary" || labelLower.includes("mercenary");
    }
    if (group.type === "crucible") {
      return typeLower === "crucible" || labelLower.includes("crucible");
    }
    return true;
  });

  $: allMatchingStats = searchQuery.trim()
    ? allowedStats.filter((item) => {
        const tokens = searchQuery.toLowerCase().trim().split(/\s+/);
        const targetText = (item.text || "").toLowerCase();
        const targetLabel = (item.groupLabel || "").toLowerCase();
        const targetType = (item.type || "").toLowerCase();

        return tokens.every(
          (token) =>
            targetText.includes(token) ||
            targetLabel.includes(token) ||
            targetType.includes(token),
        );
      })
    : allowedStats;

  $: displayedStats = allMatchingStats.slice(0, visibleStatCount);

  function handleDropdownScroll(e: UIEvent) {
    const target = e.currentTarget as HTMLElement;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
      if (visibleStatCount < allMatchingStats.length) {
        visibleStatCount += 50;
      }
    }
  }

  $: activeStatsCount = (group.filters || []).filter(
    (f) => !f.disabled && !f.outOfRealm,
  ).length;

  async function scrollHighlightedIntoView() {
    await tick();
    dropdownEl
      ?.querySelector<HTMLElement>("li.highlighted")
      ?.scrollIntoView({ block: "nearest" });
  }

  function moveHighlight(dir: 1 | -1) {
    const shown = displayedStats.length;
    if (shown === 0) return;
    if (dir === 1) {
      if (highlightedIndex + 1 >= shown && shown < allMatchingStats.length) {
        visibleStatCount += 50;
        highlightedIndex = highlightedIndex + 1;
      } else {
        highlightedIndex = (highlightedIndex + 1) % shown;
      }
    } else {
      highlightedIndex = (highlightedIndex - 1 + shown) % shown;
    }
    scrollHighlightedIntoView();
  }

  function handleSelect(stat: StatEntry) {
    dispatch("addStat", stat);
    searchQuery = "";
    isDropdownOpen = false;
    highlightedIndex = -1;
  }

  function handleKeyDown(e: KeyboardEvent) {
    // 1. Shift + Enter: always allow Search & Close (defocus and bubble to FilterForm)
    if (e.key === "Enter" && e.shiftKey) {
      isDropdownOpen = false;
      highlightedIndex = -1;
      addStatInputEl?.blur();
      return;
    }

    // 2. Escape: close dropdown and defocus from the search box
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      isDropdownOpen = false;
      highlightedIndex = -1;
      addStatInputEl?.blur();
      return;
    }

    // 3. Enter when current field is empty (and no arrow-highlighted item): act as "Search" command & defocus
    if (
      e.key === "Enter" &&
      searchQuery.trim() === "" &&
      highlightedIndex < 0
    ) {
      isDropdownOpen = false;
      highlightedIndex = -1;
      addStatInputEl?.blur();
      return;
    }

    if (!isDropdownOpen && displayedStats.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        isDropdownOpen = true;
        highlightedIndex = 0;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    if (!isDropdownOpen) {
      if (e.key === "Enter") {
        // Empty field when closed -> blur and let FilterForm run search
        if (searchQuery.trim() === "") {
          addStatInputEl?.blur();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < displayedStats.length) {
        handleSelect(displayedStats[highlightedIndex]);
      } else if (displayedStats.length > 0) {
        handleSelect(displayedStats[0]);
      }
    }
  }

  function handleWindowClick(e: MouseEvent) {
    const path = e.composedPath();
    if (!searchboxEl || !path.includes(searchboxEl)) isDropdownOpen = false;
    if (!typeWrapperEl || !path.includes(typeWrapperEl)) isTypeMenuOpen = false;
  }

  function handleHeaderClick(e: MouseEvent) {
    if (typeWrapperEl && e.composedPath().includes(typeWrapperEl)) return;
    dispatch("toggleCollapse");
  }

  function updateGroupVal(field: "min" | "max", val: any) {
    const next = { ...(group.value || {}) };
    if (val === "" || val === null || val === undefined) {
      delete next[field];
    } else {
      next[field] = val;
    }
    dispatch("changeValue", next);
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="stat-group-card" class:is-collapsed={group.collapsed}>
  <!-- Header: Entire bar collapses group -->
  <div
    class="group-header"
    role="button"
    tabindex="0"
    on:click={handleHeaderClick}
    on:keydown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dispatch("toggleCollapse");
      }
    }}
  >
    <div class="header-left">
      <div class="group-type-wrapper" bind:this={typeWrapperEl}>
        <button
          type="button"
          class="group-type-select"
          aria-expanded={isTypeMenuOpen}
          on:click={() => (isTypeMenuOpen = !isTypeMenuOpen)}
        >
          <span>{activeGroupTypeLabel}</span>
          <span class="type-chevron">▾</span>
        </button>
        {#if isTypeMenuOpen}
          <ul class="dropdown group-type-dropdown" on:wheel|stopPropagation>
            {#each GROUP_TYPES as gt}
              <li
                class:selected={gt.id === group.type}
                on:mousedown|preventDefault={() => {
                  dispatch("changeType", gt.id);
                  isTypeMenuOpen = false;
                }}
              >
                {gt.label}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      {#if group.collapsed}
        <span class="collapsed-badge">
          ({activeStatsCount} stats)
        </span>
      {/if}
    </div>

    <div class="header-right">
      {#if hasValueInputs}
        <div class="group-value-inputs" on:click|stopPropagation>
          <input
            type="number"
            placeholder="Min"
            value={group.value?.min ?? ""}
            on:input={(e) => updateGroupVal("min", e.currentTarget.value)}
          />
          <input
            type="number"
            placeholder="Max"
            value={group.value?.max ?? ""}
            on:input={(e) => updateGroupVal("max", e.currentTarget.value)}
          />
        </div>
      {/if}

      {#if canDelete}
        <button
          type="button"
          class="delete-group-btn"
          on:click|stopPropagation={() => dispatch("deleteGroup")}
        >
          ✕
        </button>
      {/if}
    </div>
  </div>

  {#if !group.collapsed}
    <!-- Stat Rows List -->
    <div class="group-stats">
      {#each group.filters as item, index (index)}
        {#if !item.outOfRealm}
          {@const matchedStat = item.statEntry ||
            flatStats.find((s) => s.id === item.id) || {
              id: item.id,
              text: item.id,
              type: "stat",
            }}
          <StatRow
            stat={matchedStat}
            {allowedStats}
            {showToggle}
            groupLabel={item.groupLabel ||
              (matchedStat as any).groupLabel ||
              matchedStat.type}
            value={item.value || {}}
            disabled={Boolean(item.disabled)}
            {isWeighted}
            on:toggleDisabled={() => dispatch("toggleStatDisabled", index)}
            on:change={(e) =>
              dispatch("updateStatValue", { index, value: e.detail })}
            on:changeStat={(e) =>
              dispatch("updateStatEntry", { index, stat: e.detail })}
            on:remove={() => dispatch("removeStat", index)}
          />
        {/if}
      {/each}
    </div>

    <!-- Add Stat Searchbox -->
    <div
      class="add-stat-container stat-searchbox-{group.id}"
      bind:this={searchboxEl}
    >
      <input
        bind:this={addStatInputEl}
        type="text"
        class="add-stat-input"
        placeholder="+ Add Stat Filter"
        bind:value={searchQuery}
        on:focus={() => {
          isDropdownOpen = true;
          highlightedIndex = -1;
          visibleStatCount = 50;
        }}
        on:input={() => {
          isDropdownOpen = true;
          highlightedIndex = searchQuery.trim() ? 0 : -1;
          visibleStatCount = 50;
        }}
        on:keydown={handleKeyDown}
        autocomplete="off"
      />

      {#if isDropdownOpen && displayedStats.length > 0}
        <ul
          class="stat-dropdown"
          bind:this={dropdownEl}
          on:scroll={handleDropdownScroll}
          on:wheel|stopPropagation
        >
          {#each displayedStats as statItem, idx}
            {@const tagCol = getTagColor(statItem.groupLabel)}
            <li
              class:highlighted={highlightedIndex === idx}
              on:mousedown|preventDefault={() => handleSelect(statItem)}
            >
              <span
                class="stat-tag"
                style="border-color: {tagCol}; color: {tagCol};"
              >
                {statItem.groupLabel}
              </span>
              <RealmIcon realms={(statItem as any).realms} />
              <StatColorText className="dropdown-text" text={statItem.text} />
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .stat-group-card {
    background: #000000;
    border: 1px solid #777777;
    border-radius: 0px;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 4px 6px;
    box-sizing: border-box;
    width: 100%;
    margin-top: 0;
  }

  .stat-group-card.is-collapsed {
    background: #000000;
    border-color: #555555;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    user-select: none;
    padding: 2px 4px;
    height: 26px;
    background: #050505;
    border-bottom: none;
    border-radius: 0px;
    box-sizing: border-box;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .group-type-wrapper {
    position: relative;
  }

  .collapsed-badge {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    color: #888888;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .group-type-select {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1.15;
    height: 22px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 6px;
    outline: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .group-type-select:hover,
  .group-type-select:focus,
  .group-type-select[aria-expanded="true"] {
    border-color: #ffffff;
  }

  .type-chevron {
    color: #888888;
    font-size: 9px;
  }

  .group-type-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 150px;
    margin: 2px 0 0 0;
    list-style: none;
  }

  .group-value-inputs {
    display: flex;
    gap: 0.2rem;
  }

  .group-value-inputs input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    width: 48px;
    height: 22px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 4px;
    outline: none;
    text-align: center;
    box-sizing: border-box;
  }

  .group-value-inputs input:hover,
  .group-value-inputs input:focus {
    border-color: #ffffff;
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

  .delete-group-btn {
    font-family: "Fontin", monospace, sans-serif;
    background: transparent;
    border: none;
    border-radius: 0px;
    color: #888888;
    cursor: pointer;
    font-size: 11px;
    height: 22px;
    padding: 0 4px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-group-btn:hover {
    color: #ff5555;
    background: transparent;
  }

  .group-stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .add-stat-container {
    position: relative;
    width: 100%;
  }

  .add-stat-input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    height: 26px;
    width: 100%;
    background: #000000;
    border: 1px dashed #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 6px;
    box-sizing: border-box;
    outline: none;
    text-align: left;
  }

  .add-stat-input:placeholder-shown {
    text-align: center;
  }

  .add-stat-input:hover,
  .add-stat-input:focus {
    border-style: solid;
    border-color: #ffffff;
    text-align: left;
  }

  .stat-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 260px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #000000;
    border: 1px solid #ffffff;
    border-radius: 0px;
    list-style: none;
    padding: 2px 0;
    margin: 2px 0 0 0;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  .stat-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .stat-dropdown::-webkit-scrollbar-track {
    background: #000000;
  }

  .stat-dropdown::-webkit-scrollbar-thumb {
    background: #555555;
  }

  .stat-dropdown li {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    padding: 1px 4px;
    cursor: pointer;
    color: #9a9a9a;
    background: #000000;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
    overflow: hidden;
  }

  .stat-dropdown li:hover,
  .stat-dropdown li.highlighted {
    background: #262626;
    color: #ffffff;
  }

  .stat-tag {
    font-size: 10px;
    font-weight: normal;
    text-transform: capitalize;
    padding: 0px 3px;
    border: 1px solid;
    border-radius: 0px;
    background: #000000;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .dropdown-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
