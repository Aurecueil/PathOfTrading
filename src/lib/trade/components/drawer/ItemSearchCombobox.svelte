<!-- src/lib/trade/components/drawer/ItemSearchCombobox.svelte -->
<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import type { ItemEntry } from "$lib/types/baseItem";
  import { getItemDisplayName } from "$lib/trade/utilis/tradeDisplayName";

  export let allItemEntries: ItemEntry[] = [];
  export let selectedItem: ItemEntry | null = null;
  export let searchQuery: string = "";
  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    select: ItemEntry;
    clear: void;
  }>();

  let highlightedIndex: number = -1;
  let dropdownEl: HTMLUListElement | undefined;

  async function scrollHighlightedIntoView() {
    await tick();
    dropdownEl
      ?.querySelector<HTMLElement>("li.highlighted")
      ?.scrollIntoView({ block: "nearest" });
  }

  // Move highlight by one; grow the lazily rendered slice when reaching its end.
  function moveHighlight(dir: 1 | -1) {
    const shown = displayedItems.length;
    if (shown === 0) return;
    if (dir === 1) {
      if (highlightedIndex + 1 >= shown && shown < matchingItems.length) {
        visibleCount += 50;
        highlightedIndex = highlightedIndex + 1;
      } else {
        highlightedIndex = (highlightedIndex + 1) % shown;
      }
    } else {
      highlightedIndex = (highlightedIndex - 1 + shown) % shown;
    }
    scrollHighlightedIntoView();
  }
  let visibleCount: number = 50;

  $: matchingItems = searchQuery.trim()
    ? allItemEntries.filter((entry) =>
        getItemDisplayName(entry)
          .toLowerCase()
          .includes(searchQuery.toLowerCase().trim()),
      )
    : allItemEntries;

  $: displayedItems = matchingItems.slice(0, visibleCount);

  export function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen && displayedItems.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        isOpen = true;
        highlightedIndex = 0;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    if (!isOpen) return;

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
      if (highlightedIndex >= 0 && highlightedIndex < displayedItems.length) {
        selectItem(displayedItems[highlightedIndex]);
      } else if (displayedItems.length > 0) {
        selectItem(displayedItems[0]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      isOpen = false;
      highlightedIndex = -1;
    }
  }

  function handleInput() {
    if (selectedItem && getItemDisplayName(selectedItem) !== searchQuery) {
      selectedItem = null;
      dispatch("clear");
    }
    isOpen = true;
    highlightedIndex = 0;
    visibleCount = 50;
  }

  function selectItem(entry: ItemEntry) {
    selectedItem = entry;
    searchQuery = getItemDisplayName(entry);
    isOpen = false;
    highlightedIndex = -1;
    dispatch("select", entry);
  }

  function clearSearch() {
    searchQuery = "";
    selectedItem = null;
    isOpen = false;
    highlightedIndex = -1;
    dispatch("clear");
  }

  function handleScroll(e: UIEvent) {
    const target = e.currentTarget as HTMLElement;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
      if (visibleCount < matchingItems.length) {
        visibleCount += 50;
      }
    }
  }
</script>

<div class="autocomplete-wrapper full-width">
  <input
    id="item-search"
    name="item_search"
    type="text"
    aria-label="Item Name"
    bind:value={searchQuery}
    on:input={handleInput}
    on:keydown={handleKeyDown}
    on:focus={() => {
      isOpen = true;
      highlightedIndex = 0;
      visibleCount = 50;
    }}
    placeholder="Search item name..."
    autocomplete="off"
  />
  {#if searchQuery.length > 0 || selectedItem !== null}
    <button
      type="button"
      class="clear-btn"
      on:mousedown|preventDefault={clearSearch}
      title="Clear"
      aria-label="Clear item name"
    >
      ✕
    </button>
  {/if}
  {#if isOpen && displayedItems.length > 0}
    <ul
      class="dropdown"
      bind:this={dropdownEl}
      on:scroll={handleScroll}
      on:wheel|stopPropagation
    >
      {#each displayedItems as entry, index}
        <li
          class:unique={entry.flags?.unique}
          class:highlighted={highlightedIndex === index}
          class:selected={selectedItem === entry}
          on:mousedown|preventDefault={() => selectItem(entry)}
        >
          {getItemDisplayName(entry)}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .autocomplete-wrapper {
    position: relative;
    z-index: 40;
    min-width: 0;
    width: 100%;
  }

  input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    height: 26px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 1.5rem 0 6px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  input:hover,
  input:focus {
    border-color: #ffffff;
  }

  .clear-btn {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #888888;
    cursor: pointer;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1;
    padding: 2px 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-btn:hover {
    color: #ffffff;
  }

  /* Popover Panel with 1px Solid White Border */
  .dropdown {
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

  .dropdown::-webkit-scrollbar {
    width: 6px;
  }
  .dropdown::-webkit-scrollbar-track {
    background: #000000;
  }
  .dropdown::-webkit-scrollbar-thumb {
    background: #555555;
  }

  /* Option Item Rows */
  .dropdown li {
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

  .dropdown li:hover,
  .dropdown li.highlighted {
    background: #545454;
    color: #ffffff;
  }

  .dropdown li.unique {
    color: #9a5521;
  }

  .dropdown li.unique:hover,
  .dropdown li.unique.highlighted {
    background: #545454;
    color: #db792f;
  }
</style>
