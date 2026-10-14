<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import StatGroupUI from "$lib/trade/components/item/StatGroupUI.svelte";
  import type { StatGroup as StatGroupType, StatEntry } from "$lib/types/stats";

  export let statGroups: any[] = [];
  export let currentStatCatalog: StatGroupType[] = [];
  export let realm: "poe" | "poe2" = "poe";
  export let isAddGroupMenuOpen: boolean = false;

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

  $: availableStatGroupOptions = STAT_GROUP_OPTIONS.filter((opt) => {
    if (realm === "poe2" && (opt.id === "crucible" || opt.id === "mercenary")) {
      return false;
    }
    return true;
  });

  const dispatch = createEventDispatcher<{
    deleteGroup: string;
    addGroup: string;
  }>();

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
      {#if !(realm === "poe2" && (group.type === "crucible" || group.type === "mercenary"))}
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
        + Add Stat Group ▾
      </button>

      {#if isAddGroupMenuOpen}
        <ul class="add-group-dropdown" on:wheel|stopPropagation>
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
        </ul>
      {/if}
    </div>
  </div>
</div>

<style>
  .stats-section {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .add-group-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.2rem;
  }
  .add-group-menu-wrapper {
    position: relative;
  }
  .add-stat-group-btn {
    background: #232838;
    border: 1px solid #333c52;
    color: #94a3b8;
    font-size: 0.74rem;
    font-weight: 500;
    padding: 0.3rem 0.65rem;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .add-stat-group-btn:hover {
    background: #2d354a;
    border-color: #3b82f6;
    color: #fff;
  }
  .add-group-dropdown {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
    width: 170px;
    background: #181b24;
    border: 1px solid #333c52;
    border-radius: 4px;
    list-style: none;
    padding: 0;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
    overflow: hidden;
  }
  .add-group-dropdown li {
    padding: 0.4rem 0.65rem;
    cursor: pointer;
    font-size: 0.75rem;
    color: #cbd5e1;
    border-bottom: 1px solid #232838;
  }
  .add-group-dropdown li:hover {
    background: #232838;
    color: #38bdf8;
  }
</style>
