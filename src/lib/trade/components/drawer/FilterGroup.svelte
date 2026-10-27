<!-- src/lib/trade/components/drawer/FilterGroup.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import FilterRow from "./FilterRow.svelte";
  import type { FilterGroup as FilterGroupType } from "$lib/types/filters";
  import type { ItemEntry } from "$lib/types/baseItem";

  export let group: FilterGroupType;
  export let values: Record<string, any> = {};
  export let collapsed: boolean = false;
  export let uniqueItems: ItemEntry[] = [];
  export let staticCatalog: any[] = [];

  const dispatch = createEventDispatcher<{
    toggle: void;
    change: { filterId: string; field: string; value: any };
  }>();
</script>

<div class="filter-group-card" class:collapsed>
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
          {staticCatalog}
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
    background: #000000;
    border: 1px solid #777777;
    border-radius: 0px;
    position: relative;
    width: 100%;
    margin-top: 0;
    box-sizing: border-box;
    min-width: 0;
    container-type: inline-size;
    container-name: group;
  }

  .filter-group-card:focus-within {
    z-index: 30;
  }

  /* Compact Header - Sitting higher with 22px fixed height */
  .group-toggle {
    width: 100%;
    height: 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1px 5px;
    background: #050505;
    border: none;
    border-bottom: 1px solid #777777;
    color: #e0e0e0;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    border-radius: 0px;
    outline: none;
    line-height: 1;
    transition: background 0.1s ease;
  }

  .filter-group-card.collapsed .group-toggle {
    border-bottom: none;
  }

  .group-toggle:hover,
  .group-toggle:focus {
    background: #1a1a1a;
    color: #ffffff;
  }

  .chevron {
    color: #888888;
    font-size: 9px;
  }

  .group-toggle:hover .chevron {
    color: #ffffff;
  }

  .group-content {
    padding: 3px 5px;
    background: #000000;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.2rem 0.4rem;
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
