<!-- src/lib/trade/components/drawer/StatGroupsSection.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import StatGroupUI from "$lib/trade/components/drawer/StatGroupUI.svelte";
  import type { StatGroup as StatGroupType, StatEntry } from "$lib/types/stats";
  import {
    statGroupPresetsStore,
    ensureStatGroupPresets,
    type StatGroupPreset,
  } from "$lib/trade/statGroupPresets";

  export let statGroups: any[] = [];
  export let currentStatCatalog: StatGroupType[] = [];
  export let realm: "poe" | "poe2" = "poe";
  export let isAddGroupMenuOpen: boolean = false;
  export let dropUp: boolean = true;
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

    statGroups = [...statGroups, ...added];
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
    <div class="add-group-menu-wrapper">
      <button
        type="button"
        class="add-stat-group-btn"
        on:click={() => (isAddGroupMenuOpen = !isAddGroupMenuOpen)}
      >
        + Add Stat Group
      </button>
      {#if isAddGroupMenuOpen}
        <ul
          class="dropdown add-group-dropdown"
          class:drop-down={!dropUp}
          on:wheel|stopPropagation
        >
          {#each availableStatGroupOptions as opt}
            <li
              on:click={() => {
                dispatch("addGroup", opt.id);
                isAddGroupMenuOpen = false;
              }}
            >
              {opt.label}
            </li>
          {/each}

          {#if visiblePresets.length > 0}
            <li class="divider" aria-hidden="true"></li>
            {#each visiblePresets as preset (preset.id)}
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
          {/if}
        </ul>
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
    width: 190px;
    max-height: 280px;
    background: #000000;
    border: 1px solid #ffffff;
    border-radius: 0px;
    list-style: none;
    padding: 2px 0;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  .add-group-dropdown.drop-down {
    bottom: auto;
    top: 100%;
    margin: 2px 0 0 0;
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

  /* Thick divider between built-in types and saved presets */
  .add-group-dropdown li.divider {
    height: 3px;
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
