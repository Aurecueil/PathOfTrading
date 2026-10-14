<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import StatRow from "./StatRow.svelte";
  import type { StatEntry, StatGroup } from "$lib/types/stats";

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
    }>;
  };

  export let statCatalog: StatGroup[] = [];
  export let canDelete: boolean = true;

  const dispatch = createEventDispatcher<{
    changeType: string;
    changeValue: { min?: any; max?: any };
    toggleCollapse: void;
    addStat: StatEntry;
    updateStatValue: { index: number; value: any };
    removeStat: number;
    deleteGroup: void;
  }>();

  let searchQuery: string = "";
  let isDropdownOpen: boolean = false;
  let highlightedIndex: number = -1;
  let visibleStatCount: number = 50;

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

  function getTagColor(label: string): string {
    const l = (label || "").toLowerCase();
    if (l.includes("pseudo")) return "#38bdf8";
    if (l.includes("explicit")) return "#a855f7";
    if (l.includes("implicit")) return "#eab308";
    if (l.includes("fractured")) return "#ca8a04";
    if (l.includes("enchant")) return "#06b6d4";
    if (l.includes("scourge")) return "#f97316";
    if (l.includes("crucible")) return "#ef4444";
    if (l.includes("mercenary")) return "#10b981";
    return "#94a3b8";
  }

  // Flattened entries for fast lookup and search
  $: flatStats = statCatalog.flatMap((g) =>
    (g.entries || []).map((e) => ({
      ...e,
      groupLabel: g.label || g.id,
    })),
  );

  // Group tag restriction logic
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

  // Token-based fuzzy search across text, type, and groupLabel
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

  // Infinite scroll slice
  $: displayedStats = allMatchingStats.slice(0, visibleStatCount);

  function handleDropdownScroll(e: UIEvent) {
    const target = e.currentTarget as HTMLElement;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
      if (visibleStatCount < allMatchingStats.length) {
        visibleStatCount += 50;
      }
    }
  }

  $: activeStatsCount = (group.filters || []).filter((f) => !f.disabled).length;

  function handleSelect(stat: StatEntry) {
    dispatch("addStat", stat);
    searchQuery = "";
    isDropdownOpen = false;
    highlightedIndex = -1;
  }

  function handleKeyDown(e: KeyboardEvent) {
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
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      highlightedIndex = (highlightedIndex + 1) % displayedStats.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      highlightedIndex =
        (highlightedIndex - 1 + displayedStats.length) % displayedStats.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < displayedStats.length) {
        handleSelect(displayedStats[highlightedIndex]);
      } else if (displayedStats.length > 0) {
        handleSelect(displayedStats[0]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      isDropdownOpen = false;
      highlightedIndex = -1;
    }
  }

  function handleWindowClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(`.stat-searchbox-${group.id}`)) {
      isDropdownOpen = false;
    }
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
    on:click={() => dispatch("toggleCollapse")}
    on:keydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dispatch("toggleCollapse");
      }
    }}
  >
    <div class="header-left">
      <select
        class="group-type-select"
        value={group.type}
        on:click|stopPropagation
        on:change={(e) => dispatch("changeType", e.currentTarget.value)}
      >
        {#each GROUP_TYPES as gt}
          <option value={gt.id}>{gt.label}</option>
        {/each}
      </select>

      {#if group.collapsed}
        <span class="collapsed-badge">
          ({activeStatsCount} stats, disabled)
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
          title="Delete group"
        >
          ✕
        </button>
      {/if}
    </div>
  </div>

  {#if !group.collapsed}
    <!-- Stat Rows List -->
    <div class="group-stats">
      {#each group.filters as item, index (item.id + index)}
        {#if !item.disabled}
          {@const matchedStat = item.statEntry ||
            flatStats.find((s) => s.id === item.id) || {
              id: item.id,
              text: item.id,
              type: "stat",
            }}
          <StatRow
            stat={matchedStat}
            groupLabel={item.groupLabel ||
              (matchedStat as any).groupLabel ||
              matchedStat.type}
            value={item.value || {}}
            {isWeighted}
            on:change={(e) =>
              dispatch("updateStatValue", { index, value: e.detail })}
            on:remove={() => dispatch("removeStat", index)}
          />
        {/if}
      {/each}
    </div>

    <!-- Add Stat Searchbox -->
    <div class="add-stat-container stat-searchbox-{group.id}">
      <input
        type="text"
        class="add-stat-input"
        placeholder="+ Add Stat Filter"
        bind:value={searchQuery}
        on:focus={() => {
          isDropdownOpen = true;
          visibleStatCount = 50;
        }}
        on:input={() => {
          isDropdownOpen = true;
          highlightedIndex = 0;
          visibleStatCount = 50;
        }}
        on:keydown={handleKeyDown}
        autocomplete="off"
      />

      {#if isDropdownOpen && displayedStats.length > 0}
        <ul
          class="stat-dropdown"
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
                style="border-color: {tagCol}44; color: {tagCol};"
              >
                {statItem.groupLabel}
              </span>
              <span class="dropdown-text">{statItem.text}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .stat-group-card {
    background: #1d212d;
    border: 1px solid #2a3040;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.5rem;
    box-sizing: border-box;
    width: 100%;
    transition: border-color 0.15s ease;
  }
  .stat-group-card.is-collapsed {
    background: #171a24;
    border-color: #242836;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    user-select: none;
    padding: 0.2rem 0.25rem;
    border-radius: 3px;
    transition: background 0.15s ease;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .collapsed-badge {
    font-size: 0.7rem;
    color: #64748b;
    font-style: italic;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .group-type-select {
    background: #232838;
    border: 1px solid #333c52;
    color: #e2e8f0;
    font-size: 0.775rem;
    font-weight: 600;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    outline: none;
    height: 26px;
    cursor: default;
  }
  .group-type-select:focus {
    border-color: #3b82f6;
  }

  .group-value-inputs {
    display: flex;
    gap: 0.2rem;
  }
  .group-value-inputs input {
    width: 50px;
    background: #232838;
    border: 1px solid #333c52;
    color: #fff;
    padding: 0.15rem 0.3rem;
    border-radius: 4px;
    outline: none;
    font-size: 0.72rem;
    height: 24px;
    text-align: center;
    box-sizing: border-box;
    cursor: text;
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
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .delete-group-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }

  .group-stats {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .add-stat-container {
    position: relative;
    width: 100%;
  }

  .add-stat-input {
    width: 100%;
    background: #161822;
    border: 1px dashed #333c52;
    color: #fff;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    font-size: 0.76rem;
    height: 28px;
    box-sizing: border-box;
    outline: none;
    text-align: left;
  }
  .add-stat-input:placeholder-shown {
    text-align: center;
  }
  .add-stat-input:focus {
    border-style: solid;
    border-color: #3b82f6;
    text-align: left;
  }

  .stat-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 280px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #181b24;
    border: 1px solid #333c52;
    border-radius: 4px;
    list-style: none;
    padding: 0;
    margin: 3px 0 0 0;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .stat-dropdown::-webkit-scrollbar {
    display: none;
  }

  .stat-dropdown li {
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    font-size: 0.75rem;
    color: #cbd5e1;
    border-bottom: 1px solid #232838;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
    overflow: hidden;
  }
  .stat-dropdown li:hover,
  .stat-dropdown li.highlighted {
    background: #232838;
  }

  .stat-tag {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: capitalize;
    padding: 0.1rem 0.35rem;
    border: 1px solid;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.25);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .dropdown-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
