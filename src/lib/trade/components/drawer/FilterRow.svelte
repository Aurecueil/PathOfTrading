<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { FilterEntry, FilterOptionEntry } from "$lib/types/filters";
  import type { ItemEntry } from "$lib/types/baseItem";

  export let filter: FilterEntry;
  export let value: Record<string, any> = {};
  export let uniqueItems: ItemEntry[] = [];

  const dispatch = createEventDispatcher<{
    change: { field: string; value: any };
  }>();

  // Local combobox state
  let isComboboxOpen: boolean = false;
  let comboboxQuery: string = "";
  let highlightedIndex: number = -1;

  function updateField(field: string, val: any) {
    dispatch("change", {
      field,
      value: val === "" || val === null || val === undefined ? null : val,
    });
  }

  function isBuyoutPriceFilter(f: FilterEntry): boolean {
    const textLower = (f.text || "").toLowerCase();
    const idLower = (f.id || "").toLowerCase();
    return (
      textLower.includes("buyout price") ||
      idLower === "price" ||
      idLower === "buyout_price"
    );
  }

  function isAlwaysSelectFilter(f: FilterEntry): boolean {
    const textLower = (f.text || "").toLowerCase();
    const idLower = (f.id || "").toLowerCase();
    return (
      isBuyoutPriceFilter(f) ||
      textLower.includes("listed") ||
      idLower.includes("listed") ||
      idLower.includes("indexed")
    );
  }

  function getResolvedOptions(f: FilterEntry): FilterOptionEntry[] {
    const list: FilterOptionEntry[] = [];
    let hasNullOpt = false;

    if (f.option?.options) {
      for (const opt of f.option.options) {
        if (opt.id === null) hasNullOpt = true;
        list.push(opt);
      }
    }

    if (f.option?.knownItem?.uniques) {
      const seen = new Set(list.map((o) => o.id));
      for (const item of uniqueItems) {
        if (item.name && !seen.has(item.name)) {
          seen.add(item.name);
          list.push({ id: item.name, text: item.text || item.name });
        }
      }
    }

    if (!hasNullOpt) {
      list.unshift({ id: null, text: "Any" });
    }

    return list;
  }

  $: allOptions = filter.option ? getResolvedOptions(filter) : [];
  $: alwaysSelect = isAlwaysSelectFilter(filter) || allOptions.length <= 4;
  $: selectedOpt = allOptions.find((o) =>
    value?.option ? o.id === value.option : o.id === null,
  );
  $: nullOpt = allOptions.find((o) => o.id === null);

  $: filteredOptions = comboboxQuery.trim()
    ? allOptions
        .filter((o) =>
          o.text.toLowerCase().includes(comboboxQuery.toLowerCase().trim()),
        )
        .slice(0, 50)
    : allOptions.slice(0, 50);

  function selectOption(opt: FilterOptionEntry) {
    updateField("option", opt.id);
    isComboboxOpen = false;
    comboboxQuery = "";
    highlightedIndex = -1;
  }

  function handleComboboxKeyDown(e: KeyboardEvent) {
    if (!isComboboxOpen && filteredOptions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        isComboboxOpen = true;
        highlightedIndex = 0;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    if (!isComboboxOpen) {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      highlightedIndex = (highlightedIndex + 1) % filteredOptions.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      highlightedIndex =
        (highlightedIndex - 1 + filteredOptions.length) %
        filteredOptions.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        selectOption(filteredOptions[highlightedIndex]);
      } else if (filteredOptions.length > 0) {
        selectOption(filteredOptions[0]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      isComboboxOpen = false;
      highlightedIndex = -1;
    }
  }

  function handleWindowClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(`.combobox-${filter.id}`)) {
      isComboboxOpen = false;
    }
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div
  class="filter-row"
  class:full-row={Boolean(
    filter.sockets || filter.input || isBuyoutPriceFilter(filter),
  )}
  class:socket-row={Boolean(filter.sockets)}
>
  <div class="filter-label" title={filter.text || filter.id}>
    <span>{filter.text || filter.id}</span>
    {#if filter.tip}
      <span class="tooltip-icon" title={filter.tip}>?</span>
    {/if}
  </div>

  <div class="filter-controls">
    <!-- Option Dropdown / Combobox -->
    {#if filter.option}
      {#if alwaysSelect}
        <select
          id={`filter-${filter.id}-opt`}
          name={`filter_${filter.id}_opt`}
          value={value?.option ?? ""}
          on:change={(e) =>
            updateField("option", e.currentTarget.value || null)}
        >
          {#each allOptions as opt}
            <option value={opt.id ?? ""}>{opt.text}</option>
          {/each}
        </select>
      {:else}
        <div class={`combobox-wrapper combobox-${filter.id}`}>
          <input
            id={`filter-${filter.id}-opt-search`}
            name={`filter_${filter.id}_opt_search`}
            type="text"
            autocomplete="off"
            placeholder={nullOpt?.text || "Any"}
            value={isComboboxOpen
              ? comboboxQuery
              : selectedOpt?.id !== null
                ? (selectedOpt?.text ?? "")
                : ""}
            on:focus={() => {
              isComboboxOpen = true;
              highlightedIndex = 0;
              comboboxQuery = "";
            }}
            on:input={(e) => {
              isComboboxOpen = true;
              comboboxQuery = e.currentTarget.value;
              highlightedIndex = 0;
            }}
            on:keydown={handleComboboxKeyDown}
          />

          {#if value?.option !== undefined && value?.option !== null && value?.option !== ""}
            <button
              type="button"
              class="clear-opt-btn"
              on:click={() =>
                selectOption(nullOpt || { id: null, text: "Any" })}
              title="Clear"
            >
              ✕
            </button>
          {/if}

          {#if isComboboxOpen && filteredOptions.length > 0}
            <ul class="dropdown" on:wheel|stopPropagation>
              {#each filteredOptions as opt, idx}
                <li
                  class:highlighted={highlightedIndex === idx}
                  class:selected={opt.id === value?.option ||
                    (opt.id === null && !value?.option)}
                  on:mousedown|preventDefault={() => selectOption(opt)}
                >
                  {opt.text}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Text Input -->
    {#if filter.input}
      <input
        id={`filter-${filter.id}-input`}
        name={`filter_${filter.id}_input`}
        type="text"
        placeholder={filter.input.placeholder || "Value..."}
        value={value?.input ?? ""}
        on:input={(e) => updateField("input", e.currentTarget.value)}
      />
    {/if}

    <!-- Min/Max Controls -->
    {#if filter.minMax}
      <div class="min-max-controls">
        <input
          id={`filter-${filter.id}-min`}
          name={`filter_${filter.id}_min`}
          type="number"
          placeholder="Min"
          value={value?.min ?? ""}
          on:input={(e) => updateField("min", e.currentTarget.value)}
        />
        <input
          id={`filter-${filter.id}-max`}
          name={`filter_${filter.id}_max`}
          type="number"
          placeholder="Max"
          value={value?.max ?? ""}
          on:input={(e) => updateField("max", e.currentTarget.value)}
        />
      </div>
    {/if}

    <!-- Sockets Controls -->
    {#if filter.sockets}
      <div class="sockets-grid">
        <div class="socket-input sock-r">
          <span>R</span>
          <input
            id={`filter-${filter.id}-sock-r`}
            name={`filter_${filter.id}_sock_r`}
            type="number"
            min="0"
            max="6"
            value={value?.r ?? ""}
            on:input={(e) => updateField("r", e.currentTarget.value)}
          />
        </div>
        <div class="socket-input sock-g">
          <span>G</span>
          <input
            id={`filter-${filter.id}-sock-g`}
            name={`filter_${filter.id}_sock_g`}
            type="number"
            min="0"
            max="6"
            value={value?.g ?? ""}
            on:input={(e) => updateField("g", e.currentTarget.value)}
          />
        </div>
        <div class="socket-input sock-b">
          <span>B</span>
          <input
            id={`filter-${filter.id}-sock-b`}
            name={`filter_${filter.id}_sock_b`}
            type="number"
            min="0"
            max="6"
            value={value?.b ?? ""}
            on:input={(e) => updateField("b", e.currentTarget.value)}
          />
        </div>
        <div class="socket-input sock-w">
          <span>W</span>
          <input
            id={`filter-${filter.id}-sock-w`}
            name={`filter_${filter.id}_sock_w`}
            type="number"
            min="0"
            max="6"
            value={value?.w ?? ""}
            on:input={(e) => updateField("w", e.currentTarget.value)}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .filter-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.25rem;
    position: relative;
    min-height: 24px;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .filter-row:focus-within {
    z-index: 45;
  }

  .filter-row.full-row {
    grid-column: 1 / -1;
  }

  .filter-label {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    color: #d3d3d3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-controls {
    flex: 0 0 42%;
    max-width: 45%;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .filter-controls > select,
  .filter-controls > input,
  .filter-controls > .combobox-wrapper,
  .filter-controls > .min-max-controls {
    flex: 1 1 0;
    width: 100%;
    min-width: 0;
  }

  .filter-row.full-row:not(.socket-row) .filter-label {
    flex: 0 0 25%;
    max-width: 28%;
  }

  .filter-row.full-row:not(.socket-row) .filter-controls {
    flex: 1 1 auto;
    max-width: 75%;
    display: flex;
    gap: 0.25rem;
  }

  .filter-row.socket-row .filter-label {
    flex: 0 0 22%;
    max-width: 25%;
  }

  .filter-row.socket-row .filter-controls {
    flex: 1 1 auto;
    max-width: 78%;
  }

  .min-max-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.2rem;
    width: 100%;
    min-width: 0;
  }

  .min-max-controls input {
    width: 100%;
    min-width: 0;
  }

  /* Retro Controls Input & Select Styling */
  input,
  select {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1.15;
    height: 24px;
    background: #000000;
    border: 1px solid #777777;
    border-radius: 0px;
    color: #ffffff;
    padding: 1px 4px;
    outline: none;
    min-width: 0;
    box-sizing: border-box;
  }

  input:hover,
  input:focus,
  select:hover,
  select:focus {
    border-color: #ffffff;
  }

  select option {
    background-color: #000000;
    color: #ffffff;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
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

  .combobox-wrapper {
    position: relative;
    width: 100%;
    min-width: 0;
  }

  .combobox-wrapper:focus-within {
    z-index: 50;
  }

  .combobox-wrapper input {
    width: 100%;
    padding-right: 1.25rem;
    min-width: 0;
  }

  .clear-opt-btn {
    position: absolute;
    right: 2px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #777777;
    cursor: pointer;
    font-size: 10px;
    padding: 1px 3px;
  }

  .clear-opt-btn:hover {
    color: #ffffff;
  }

  /* Dropdown Popover Container with 3px White Border & Compact Items */
  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 240px;
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

  .dropdown li {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
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

  .dropdown li.selected {
    color: #ffffff;
    background: #000000;
  }

  .tooltip-icon {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 12px;
    height: 12px;
    border-radius: 0px;
    background: #111111;
    border: 1px solid #777777;
    color: #888888;
    font-size: 9px;
    cursor: help;
    flex-shrink: 0;
  }

  /* Sockets Control Panel */
  .sockets-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.2rem;
    width: 100%;
    min-width: 0;
  }

  .socket-input {
    display: flex;
    align-items: center;
    border: 1px solid #777777;
    border-radius: 0px;
    background: #000000;
    height: 24px;
    min-width: 0;
  }

  .socket-input span {
    padding: 0 0.25rem;
    font-weight: bold;
    font-size: 10px;
    flex-shrink: 0;
  }

  .sock-r span {
    color: #ff5555;
  }

  .sock-g span {
    color: #55ff55;
  }

  .sock-b span {
    color: #66b2ff;
  }

  .sock-w span {
    color: #ffffff;
  }

  .socket-input input {
    width: 100%;
    min-width: 0;
    border: none;
    border-left: 1px solid #777777;
    background: transparent;
    padding: 0.1rem;
    text-align: center;
    height: 100%;
    border-radius: 0px;
  }
</style>
