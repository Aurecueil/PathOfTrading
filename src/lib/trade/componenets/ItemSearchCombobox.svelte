<script lang="ts">
  import type { ItemEntry } from "$lib/types/items";
  import { getItemDisplayName } from "$lib/trade/utilis/tradeDisplayName";

  export let allItemEntries: ItemEntry[] = [];
  export let selectedItem: ItemEntry | null = null;
  export let searchQuery: string = "";
  export let isOpen: boolean = false;

  let highlightedIndex: number = -1;
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
      highlightedIndex = (highlightedIndex + 1) % displayedItems.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      highlightedIndex =
        (highlightedIndex - 1 + displayedItems.length) % displayedItems.length;
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

  {#if isOpen && displayedItems.length > 0}
    <ul class="dropdown" on:scroll={handleScroll} on:wheel|stopPropagation>
      {#each displayedItems as entry, index}
        <li
          class:unique={entry.flags?.unique}
          class:highlighted={highlightedIndex === index}
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
    background: #232838;
    border: 1px solid #333c52;
    color: #fff;
    padding: 0.3rem 0.45rem;
    border-radius: 4px;
    outline: none;
    font-size: 0.78rem;
    height: 30px;
    width: 100%;
    box-sizing: border-box;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  input:focus {
    border-color: #3b82f6;
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
    scrollbar-width: none;
  }
  .dropdown::-webkit-scrollbar {
    display: none;
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
  .dropdown li.unique {
    color: #af6025;
    font-weight: 600;
  }
</style>
