<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import FilterRow from "./FilterRow.svelte";
  import type { FilterGroup as FilterGroupType } from "$lib/types/filters";
  import type { ItemEntry } from "$lib/types/baseItem";

  export let group: FilterGroupType;
  export let values: Record<string, any> = {};
  export let collapsed: boolean = false;
  export let uniqueItems: ItemEntry[] = [];

  const dispatch = createEventDispatcher<{
    toggle: void;
    change: { filterId: string; field: string; value: any };
  }>();
</script>

<div class="filter-group-card">
  <button
    type="button"
    class="group-toggle"
    on:click={() => dispatch("toggle")}
  >
    <span>{group.title || group.id}</span>
    <span class="chevron">{collapsed ? "▸" : "▾"}</span>
  </button>

  {#if !collapsed}
    <div
      class="group-content"
      class:max-two-cols={(group.filters || []).length <= 2}
    >
      {#each group.filters || [] as fEntry (fEntry.id)}
        <FilterRow
          filter={fEntry}
          value={values[fEntry.id] || {}}
          {uniqueItems}
          on:change={(e) =>
            dispatch("change", {
              filterId: fEntry.id,
              field: e.detail.field,
              value: e.detail.value,
            })}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
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

  /* Split to 2 columns at 580px */
  @container group (min-width: 580px) {
    .group-content {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* Split to 3 columns at 980px only if more than 2 elements */
  @container group (min-width: 980px) {
    .group-content:not(.max-two-cols) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
