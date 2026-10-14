<script lang="ts">
  import type { SortOptionItem } from "$lib/types/types";
  export let sortKey: string = "filter:price";
  export let sortDirection: "asc" | "desc" = "asc";
  export let allSortOptions: SortOptionItem[] = [];
  export let isOpen: boolean = false;

  let sortSearchQuery: string = "";
  let highlightedIndex: number = -1;
  let visibleSortCount: number = 50;

  $: matchingSortOptions = sortSearchQuery.trim()
    ? allSortOptions.filter((opt) => {
        const q = sortSearchQuery.toLowerCase().trim();
        return (
          opt.label.toLowerCase().includes(q) ||
          (opt.category === "stat" &&
            opt.tag &&
            opt.tag.toLowerCase().includes(q))
        );
      })
    : allSortOptions;

  $: displayedSortOptions = matchingSortOptions.slice(0, visibleSortCount);

  function getActiveSortLabel(key: string): string {
    const matched = allSortOptions.find((o) => o.id === key);
    if (matched) return matched.label;
    if (key === "filter:price") return "Buyout Price";
    if (key.startsWith("filter:")) return key.replace("filter:", "");
    if (key.startsWith("stat:")) return key.replace("stat:", "");
    return "Buyout Price";
  }

  function handleSelectSort(opt: SortOptionItem) {
    sortKey = opt.id;
    sortSearchQuery = "";
    isOpen = false;
    highlightedIndex = -1;
  }

  function toggleDirection() {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  }

  export function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen && displayedSortOptions.length > 0) {
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
      highlightedIndex = (highlightedIndex + 1) % displayedSortOptions.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      highlightedIndex =
        (highlightedIndex - 1 + displayedSortOptions.length) %
        displayedSortOptions.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (
        highlightedIndex >= 0 &&
        highlightedIndex < displayedSortOptions.length
      ) {
        handleSelectSort(displayedSortOptions[highlightedIndex]);
      } else if (displayedSortOptions.length > 0) {
        handleSelectSort(displayedSortOptions[0]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      isOpen = false;
      highlightedIndex = -1;
    }
  }

  function handleScroll(e: UIEvent) {
    const target = e.currentTarget as HTMLElement;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
      if (visibleSortCount < matchingSortOptions.length) {
        visibleSortCount += 50;
      }
    }
  }
</script>

<div class="sort-combobox-wrapper">
  <input
    id="sort-query-input"
    name="sort_query_input"
    type="text"
    aria-label="Sort by"
    autocomplete="off"
    placeholder="Sort target..."
    value={isOpen ? sortSearchQuery : getActiveSortLabel(sortKey)}
    on:focus={() => {
      isOpen = true;
      highlightedIndex = 0;
      sortSearchQuery = "";
      visibleSortCount = 50;
    }}
    on:input={(e) => {
      isOpen = true;
      sortSearchQuery = e.currentTarget.value;
      highlightedIndex = 0;
      visibleSortCount = 50;
    }}
    on:keydown={handleKeyDown}
  />

  <button
    type="button"
    class="sort-arrow-btn"
    on:click={toggleDirection}
    title={sortDirection === "asc"
      ? "Ascending (click for Descending)"
      : "Descending (click for Ascending)"}
  >
    <span class="sort-dir-text">{sortDirection === "asc" ? "ASC" : "DESC"}</span
    >
    <span class="sort-dir-arrow">{sortDirection === "asc" ? "▲" : "▼"}</span>
  </button>

  {#if isOpen && displayedSortOptions.length > 0}
    <ul
      class="dropdown sort-dropdown"
      on:scroll={handleScroll}
      on:wheel|stopPropagation
    >
      {#each displayedSortOptions as opt, idx}
        <li
          class:highlighted={highlightedIndex === idx}
          class:selected={opt.id === sortKey}
          on:mousedown|preventDefault={() => handleSelectSort(opt)}
        >
          {#if opt.category === "stat" && opt.tag}
            <span class="sort-tag-badge sort-tag-stat">[{opt.tag}]</span>
          {/if}
          <span class="dropdown-text">{opt.label}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .sort-combobox-wrapper {
    position: relative;
    width: 100%;
    min-width: 0;
  }
  input {
    background: #232838;
    border: 1px solid #333c52;
    color: #fff;
    padding: 0.3rem 4.2rem 0.3rem 0.45rem;
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
  .sort-arrow-btn {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #38bdf8;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    line-height: 1;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.68rem;
    font-weight: 700;
  }
  .sort-dir-text {
    font-size: 0.65rem;
  }
  .sort-dir-arrow {
    font-size: 0.7rem;
  }
  .sort-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    width: 270px;
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
  .sort-dropdown::-webkit-scrollbar {
    display: none;
  }
  .sort-dropdown li {
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    font-size: 0.775rem;
    color: #cbd5e1;
    border-bottom: 1px solid #282e40;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .sort-dropdown li:hover,
  .sort-dropdown li.highlighted {
    background: #293044;
  }
  .sort-dropdown li.selected {
    color: #38bdf8;
  }
  .sort-tag-badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .sort-tag-stat {
    color: #eab308;
    background: rgba(234, 179, 8, 0.12);
  }
</style>
