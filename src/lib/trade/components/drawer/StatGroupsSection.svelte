<!-- src/lib/trade/components/drawer/StatGroupsSection.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import StatGroupUI from "$lib/trade/components/drawer/StatGroupUI.svelte";
  import type { StatGroup as StatGroupType, StatEntry } from "$lib/types/stats";
  import {
    statGroupPresetsStore,
    ensureStatGroupPresets,
    type StatGroupPreset,
  } from "$lib/trade/statGroupPresets";
  import { trimTrailingEmptyGroup } from "$lib/trade/utilis/tradePayload";

  export let statGroups: any[] = [];
  export let currentStatCatalog: StatGroupType[] = [];
  export let realm: "poe" | "poe2" = "poe";
  export let isAddGroupMenuOpen: boolean = false;
  // "auto": prefer opening downwards, flip upwards if it would leave the window.
  // true / false force the direction.
  export let dropUp: boolean | "auto" = "auto";
  export let showPresets: boolean = true;

  const STAT_GROUP_OPTIONS = [
    { id: "and", label: "And" },
    { id: "not", label: "Not" },
    { id: "if", label: "If" },
    { id: "count", label: "Count" },
    { id: "weight", label: "Weighted Sum" },
    { id: "weight2", label: "Weighted Sum 2" },
    { id: "crucible", label: "Crucible Passive Tree" },
    { id: "mercenary", label: "Mercenary" },
  ];

  const isPoe1Only = (t: string) => t === "crucible" || t === "mercenary";

  $: availableStatGroupOptions = STAT_GROUP_OPTIONS.filter(
    (opt) => !(realm === "poe2" && isPoe1Only(opt.id)),
  );

  onMount(() => {
    if (showPresets) void ensureStatGroupPresets();
  });

  $: visiblePresets = showPresets
    ? $statGroupPresetsStore.filter((p) => p.game === "any" || p.game === realm)
    : [];

  // Menu layout: one column per 8 entries (rounded down, min 1).
  // Official types fill column 1, custom (preset) entries follow under them
  // and then continue into the next columns.
  const ROWS_PER_COLUMN = 8;
  const COLUMN_WIDTH_PX = 190;

  type MenuColumn = {
    official: { id: string; label: string }[];
    presets: StatGroupPreset[];
  };

  $: totalMenuEntries =
    availableStatGroupOptions.length + visiblePresets.length;
  $: targetColumns = Math.max(
    1,
    Math.floor(totalMenuEntries / ROWS_PER_COLUMN),
  );
  $: menuColumnsData = buildMenuColumns(
    availableStatGroupOptions,
    visiblePresets,
    targetColumns,
  );

  function buildMenuColumns(
    official: { id: string; label: string }[],
    presets: StatGroupPreset[],
    cols: number,
  ): MenuColumn[] {
    const total = official.length + presets.length;
    const rows = Math.max(Math.ceil(total / cols), official.length, 1);
    const firstTake = Math.max(0, rows - official.length);
    const result: MenuColumn[] = [
      { official, presets: presets.slice(0, firstTake) },
    ];
    for (let i = firstTake; i < presets.length; i += rows) {
      result.push({ official: [], presets: presets.slice(i, i + rows) });
    }
    return result;
  }

  // Direction handling (prefer down, flip up when it would not fit)
  let wrapperEl: HTMLElement;
  let menuEl: HTMLElement;
  let placeUp = false;
  let placed = false;
  let menuMaxHeight = 280;

  $: if (isAddGroupMenuOpen) {
    void placeMenu();
  } else {
    placed = false;
  }

  async function placeMenu() {
    placed = false;
    await tick();
    if (!wrapperEl || !menuEl) return;

    if (dropUp !== "auto") {
      placeUp = dropUp;
      menuMaxHeight = 280;
      placed = true;
      return;
    }

    const btn = wrapperEl.getBoundingClientRect();
    // Visible area = window, further clipped by the scrolling container (if any)
    const scroller = wrapperEl.closest(".scroll-area");
    const sr = scroller?.getBoundingClientRect();
    const bottomEdge = Math.min(window.innerHeight, sr ? sr.bottom : Infinity);
    const topEdge = Math.max(0, sr ? sr.top : 0);

    const spaceBelow = bottomEdge - btn.bottom - 6;
    const spaceAbove = btn.top - topEdge - 6;
    const needed = Math.min(menuEl.scrollHeight + 4, 280);

    placeUp = needed > spaceBelow && spaceAbove > spaceBelow;
    menuMaxHeight = Math.max(
      80,
      Math.min(280, placeUp ? spaceAbove : spaceBelow),
    );
    placed = true;
  }

  const dispatch = createEventDispatcher<{
    deleteGroup: string;
    addGroup: string;
  }>();

  function injectPreset(preset: StatGroupPreset) {
    // Resolve saved ids against the stats of the current realm
    const byId = new Map<string, any>();
    for (const g of currentStatCatalog) {
      for (const e of g.entries || []) {
        byId.set(e.id, { ...e, groupLabel: g.label || g.id });
      }
    }

    const stamp = Date.now();
    const added = preset.groups
      .filter((g) => !(realm === "poe2" && isPoe1Only(g.type)))
      .map((g, i) => ({
        id: `stat_group_${stamp}_${i}`,
        type: g.type,
        collapsed: false,
        value: g.value ? { ...g.value } : undefined,
        // Stats missing in this realm get auto-disabled by the form
        filters: g.filters.map((f) => {
          const entry = byId.get(f.id);
          return {
            id: f.id,
            statEntry: entry,
            groupLabel: entry?.groupLabel,
            value: { ...(f.value || {}) },
            disabled: false,
          };
        }),
      }));

    if (added.length === 0) return;
    // Drop an empty trailing group before appending the preset's groups
    statGroups = [...trimTrailingEmptyGroup(statGroups), ...added];
  }

  function addStatToGroup(groupIndex: number, stat: StatEntry) {
    statGroups[groupIndex].filters = [
      ...statGroups[groupIndex].filters,
      {
        id: stat.id,
        statEntry: stat,
        groupLabel: (stat as any).groupLabel || stat.type,
        value: {},
        disabled: false,
      },
    ];
    statGroups = [...statGroups];
  }

  function updateStatValueInGroup(
    groupIndex: number,
    statIndex: number,
    val: any,
  ) {
    statGroups[groupIndex].filters[statIndex].value = val;
    statGroups = [...statGroups];
  }

  function updateStatEntryInGroup(
    groupIndex: number,
    statIndex: number,
    newStat: StatEntry,
  ) {
    const prev = statGroups[groupIndex].filters[statIndex];
    const prevHasOptions = Boolean(prev?.statEntry?.option?.options?.length);
    const nextHasOptions = Boolean(newStat?.option?.options?.length);

    statGroups[groupIndex].filters[statIndex] = {
      ...prev,
      id: newStat.id,
      statEntry: newStat,
      groupLabel: (newStat as any).groupLabel || newStat.type,
      value:
        prevHasOptions !== nextHasOptions ? {} : { ...(prev?.value || {}) },
      disabled: false,
    };
    statGroups = [...statGroups];
  }

  function removeStatFromGroup(groupIndex: number, statIndex: number) {
    statGroups[groupIndex].filters = statGroups[groupIndex].filters.filter(
      (_: any, i: number) => i !== statIndex,
    );
    statGroups = [...statGroups];
  }
</script>

<div class="stats-section">
  <div class="stats-list">
    {#each statGroups as group, gIndex (group.id)}
      {#if !(realm === "poe2" && isPoe1Only(group.type))}
        <StatGroupUI
          {group}
          statCatalog={currentStatCatalog}
          canDelete={true}
          on:toggleCollapse={() => {
            statGroups[gIndex].collapsed = !statGroups[gIndex].collapsed;
            statGroups = [...statGroups];
          }}
          on:changeType={(e) => {
            statGroups[gIndex].type = e.detail;
            statGroups = [...statGroups];
          }}
          on:changeValue={(e) => {
            statGroups[gIndex].value = e.detail;
            statGroups = [...statGroups];
          }}
          on:addStat={(e) => addStatToGroup(gIndex, e.detail)}
          on:updateStatValue={(e) =>
            updateStatValueInGroup(gIndex, e.detail.index, e.detail.value)}
          on:updateStatEntry={(e) =>
            updateStatEntryInGroup(gIndex, e.detail.index, e.detail.stat)}
          on:removeStat={(e) => removeStatFromGroup(gIndex, e.detail)}
          on:deleteGroup={() => dispatch("deleteGroup", group.id)}
        />
      {/if}
    {/each}
  </div>

  <div class="add-group-row">
    <div class="add-group-menu-wrapper" bind:this={wrapperEl}>
      <button
        type="button"
        class="add-stat-group-btn"
        on:click={() => (isAddGroupMenuOpen = !isAddGroupMenuOpen)}
      >
        + Add Stat Group
      </button>
      {#if isAddGroupMenuOpen}
        <div
          bind:this={menuEl}
          class="dropdown add-group-dropdown"
          class:drop-down={!placeUp}
          class:placing={!placed}
          style="--col-w: {COLUMN_WIDTH_PX}px; width: {menuColumnsData.length *
            COLUMN_WIDTH_PX}px; max-height: {menuMaxHeight}px;"
          on:wheel|stopPropagation
        >
          {#each menuColumnsData as col, cIndex}
            <ul class="menu-column">
              {#each col.official as opt}
                <li
                  on:click={() => {
                    dispatch("addGroup", opt.id);
                    isAddGroupMenuOpen = false;
                  }}
                >
                  {opt.label}
                </li>
              {/each}

              {#if cIndex === 0 && col.official.length > 0 && col.presets.length > 0}
                <li class="divider" aria-hidden="true"></li>
              {/if}

              {#each col.presets as preset (preset.id)}
                <li
                  class="preset-item"
                  title="Insert {preset.groups.length} stat group(s)"
                  on:click={() => {
                    injectPreset(preset);
                    isAddGroupMenuOpen = false;
                  }}
                >
                  {preset.name || "Untitled"}
                </li>
              {/each}
            </ul>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .stats-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .add-group-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.1rem;
  }

  .add-group-menu-wrapper {
    position: relative;
  }

  .add-stat-group-btn {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    height: 26px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 8px;
    cursor: pointer;
    outline: none;
    transition:
      background 0.1s ease,
      border-color 0.1s ease;
  }

  .add-stat-group-btn:hover,
  .add-stat-group-btn:focus {
    border-color: #ffffff;
    background: #111111;
  }

  .add-group-dropdown {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 2px;
    max-width: calc(100cqw - 1rem);
    max-height: 280px;
    background: #000000;
    border: 1px solid #ffffff;
    border-radius: 0px;
    padding: 2px 0;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
  }

  .add-group-dropdown.drop-down {
    bottom: auto;
    top: 100%;
    margin: 2px 0 0 0;
  }

  /* Measured before showing so the direction can be decided without flicker */
  .add-group-dropdown.placing {
    visibility: hidden;
  }

  .menu-column {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1 1 0;
    min-width: 0;
  }

  .add-group-dropdown li {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    padding: 1px 4px;
    cursor: pointer;
    color: #9a9a9a;
    background: #000000;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .add-group-dropdown li:hover {
    background: #545454;
    color: #ffffff;
  }

  /* 2px divider between official types and custom presets */
  .add-group-dropdown li.divider {
    height: 2px;
    margin: 3px 0;
    padding: 0 !important;
    background: #777777 !important;
    cursor: default;
    pointer-events: none;
  }

  .add-group-dropdown li.preset-item {
    color: #d3d3d3;
  }
</style>
