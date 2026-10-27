<!-- src/lib/trade/components/drawer/FilterRow.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { FilterEntry, FilterOptionEntry } from "$lib/types/filters";
  import type { ItemEntry } from "$lib/types/baseItem";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";

  export let filter: FilterEntry;
  export let value: Record<string, any> = {};
  export let uniqueItems: ItemEntry[] = [];
  export let staticCatalog: Array<{
    id: string;
    label?: string | null;
    entries?: Array<{
      id: string;
      text: string;
      image?: string | null;
      pseudo?: boolean | null;
      subtext?: string | null;
      description?: string | null;
    }>;
  }> = [];

  const dispatch = createEventDispatcher<{
    change: { field: string; value: any };
  }>();

  // Local dropdown / combobox state
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

    const known = f.option?.knownItem;
    if (known) {
      const seen = new Set(list.map((o) => o.id));

      if (typeof known === "object" && known !== null) {
        const knownObj = known as unknown as Record<
          string,
          boolean | undefined
        >;
        for (const [key, val] of Object.entries(knownObj)) {
          if (!val) continue;
          const lowerKey = key.trim().toLowerCase();

          if (lowerKey === "uniques" || lowerKey === "unique") {
            for (const item of uniqueItems) {
              if (item.name && !seen.has(item.name)) {
                seen.add(item.name);
                list.push({ id: item.name, text: item.text || item.name });
              }
            }
          } else {
            const matchedCat = (staticCatalog || []).find(
              (c) =>
                String(c?.id ?? "")
                  .trim()
                  .toLowerCase() === lowerKey,
            );
            if (matchedCat && Array.isArray(matchedCat.entries)) {
              for (const entry of matchedCat.entries) {
                const identifier = entry.text || entry.id;
                if (identifier && !seen.has(identifier)) {
                  seen.add(identifier);
                  list.push({ id: identifier, text: identifier });
                }
              }
            }
          }
        }
      } else {
        const knownKey = String(known).trim().toLowerCase();
        if (knownKey === "uniques" || knownKey === "unique") {
          for (const item of uniqueItems) {
            if (item.name && !seen.has(item.name)) {
              seen.add(item.name);
              list.push({ id: item.name, text: item.text || item.name });
            }
          }
        } else if (knownKey) {
          const matchedCat = (staticCatalog || []).find(
            (c) =>
              String(c?.id ?? "")
                .trim()
                .toLowerCase() === knownKey,
          );
          if (matchedCat && Array.isArray(matchedCat.entries)) {
            for (const entry of matchedCat.entries) {
              const identifier = entry.text || entry.id;
              if (identifier && !seen.has(identifier)) {
                seen.add(identifier);
                list.push({ id: identifier, text: identifier });
              }
            }
          }
        }
      }
    }

    if (!hasNullOpt) {
      list.unshift({ id: null, text: "Any" });
    }

    return list;
  }

  $: allOptions = filter.option ? getResolvedOptions(filter) : [];
  $: alwaysSelect = isAlwaysSelectFilter(filter) || allOptions.length <= 8;
  $: selectedOpt = allOptions.find((o) =>
    value?.option ? o.id === value.option : o.id === null,
  );
  $: nullOpt = allOptions.find((o) => o.id === null);

  $: filteredOptions =
    !alwaysSelect && comboboxQuery.trim()
      ? allOptions
          .filter((o) =>
            o.text.toLowerCase().includes(comboboxQuery.toLowerCase().trim()),
          )
          .slice(0, 50)
      : allOptions.slice(0, 50);

  function has(v: any): boolean {
    return v !== undefined && v !== null && v !== "" && v !== "any";
  }

  $: optionModified = has(value?.option);
  $: inputModified = has(value?.input);
  $: minModified = has(value?.min);
  $: maxModified = has(value?.max);
  $: rModified = has(value?.r);
  $: gModified = has(value?.g);
  $: bModified = has(value?.b);
  $: wModified = has(value?.w);
  $: nameModified =
    optionModified ||
    inputModified ||
    minModified ||
    maxModified ||
    rModified ||
    gModified ||
    bModified ||
    wModified;

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
      if (e.key === "Enter" && alwaysSelect) {
        isComboboxOpen = true;
        highlightedIndex = 0;
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "Enter") {
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
  <div
    class="filter-label"
    class:is-modified={nameModified}
    title={filter.text || filter.id}
  >
    <span>{filter.text || filter.id}</span>
    {#if filter.tip}
      <span class="tooltip-icon" title={filter.tip}>?</span>
    {/if}
  </div>

  <div class="filter-controls">
    <!-- Custom Option Dropdown / Searchable Combobox -->
    {#if filter.option}
      <div class={`combobox-wrapper combobox-${filter.id} top-custom-dropdown`}>
        {#if alwaysSelect}
          <button
            type="button"
            id={`filter-${filter.id}-opt`}
            class="custom-dropdown-trigger"
            class:is-modified={optionModified}
            aria-label={filter.text || filter.id}
            aria-expanded={isComboboxOpen}
            on:click={() => {
              isComboboxOpen = !isComboboxOpen;
              if (isComboboxOpen) {
                highlightedIndex = 0;
              }
            }}
            on:keydown={handleComboboxKeyDown}
          >
            <span class="trigger-label">
              {selectedOpt?.id !== null
                ? (selectedOpt?.text ?? "Any")
                : nullOpt?.text || "Any"}
            </span>
          </button>
        {:else}
          <input
            id={`filter-${filter.id}-opt-search`}
            name={`filter_${filter.id}_opt_search`}
            type="text"
            autocomplete="off"
            class="custom-combobox-input"
            class:is-modified={optionModified}
            placeholder={selectedOpt?.id !== null
              ? (selectedOpt?.text ?? "")
              : nullOpt?.text || "Any"}
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
        {/if}

        {#if optionModified}
          <button
            type="button"
            class="clear-opt-btn"
            on:click|stopPropagation={() =>
              selectOption(nullOpt || { id: null, text: "Any" })}
            title="Clear"
          >
            ✕
          </button>
        {:else}
          <span class="trigger-arrow">▾</span>
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
                <StatColorText text={opt.text} />
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <!-- Text Input -->
    {#if filter.input}
      <input
        id={`filter-${filter.id}-input`}
        name={`filter_${filter.id}_input`}
        type="text"
        class:is-modified={inputModified}
        placeholder={filter.input.placeholder || "Value..."}
        value={value?.input ?? ""}
        on:input={(e) => updateField("input", e.currentTarget.value)}
      />
    {/if}

    <!-- Sockets Controls -->
    {#if filter.sockets}
      <div class="sockets-grid">
        <div class="socket-input sock-r" class:is-modified={rModified}>
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
        <div class="socket-input sock-g" class:is-modified={gModified}>
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
        <div class="socket-input sock-b" class:is-modified={bModified}>
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
        <div class="socket-input sock-w" class:is-modified={wModified}>
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

    <!-- Min/Max Controls (Independent, so both Sockets and MinMax can render if present) -->
    {#if filter.minMax}
      <div class="min-max-controls">
        <input
          id={`filter-${filter.id}-min`}
          name={`filter_${filter.id}_min`}
          type="number"
          class:is-modified={minModified}
          placeholder="Min"
          value={value?.min ?? ""}
          on:input={(e) => updateField("min", e.currentTarget.value)}
        />
        <input
          id={`filter-${filter.id}-max`}
          name={`filter_${filter.id}_max`}
          type="number"
          class:is-modified={maxModified}
          placeholder="Max"
          value={value?.max ?? ""}
          on:input={(e) => updateField("max", e.currentTarget.value)}
        />
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
    color: #9a9a9a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-label.is-modified {
    color: #ffffff;
  }

  .filter-controls {
    flex: 0 0 42%;
    max-width: 45%;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .filter-controls > input,
  .filter-controls > .combobox-wrapper,
  .filter-controls > .min-max-controls,
  .filter-controls > .sockets-grid {
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

  input,
  .custom-dropdown-trigger {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1.15;
    height: 24px;
    background: #000000;
    border: 1px solid #777777;
    border-radius: 0px;
    color: #9a9a9a;
    padding: 1px 4px;
    outline: none;
    min-width: 0;
    box-sizing: border-box;
  }

  input:hover,
  input:focus,
  .custom-dropdown-trigger:hover,
  .custom-dropdown-trigger:focus {
    border-color: #ffffff;
  }

  input.is-modified,
  .custom-dropdown-trigger.is-modified {
    color: #ffffff;
    border-color: #ffffff;
  }

  .custom-combobox-input.is-modified::placeholder {
    color: #ffffff;
    opacity: 1;
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

  .combobox-wrapper input,
  .combobox-wrapper .custom-dropdown-trigger {
    width: 100%;
    padding-right: 1.25rem;
    min-width: 0;
  }

  .custom-dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
    text-align: left;
  }

  .trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }

  .trigger-arrow,
  .clear-opt-btn {
    position: absolute;
    right: 2px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    padding: 1px 3px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .trigger-arrow {
    color: #777777;
    pointer-events: none;
  }

  .clear-opt-btn {
    background: transparent;
    border: none;
    color: #ffffff;
    cursor: pointer;
  }

  .clear-opt-btn:hover {
    color: #ffffff;
    opacity: 0.85;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #000000 !important;
    border: 1px solid #ffffff !important;
    border-radius: 0px !important;
    list-style: none;
    padding: 1px 0 !important;
    margin: 2px 0 0 0 !important;
    z-index: 1000 !important;
    box-sizing: border-box !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85) !important;
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
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 12px !important;
    line-height: 1.15 !important;
    padding: 1px 3px !important;
    cursor: pointer !important;
    color: #9a9a9a !important;
    background: #000000 !important;
    border-radius: 0px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .dropdown li:hover,
  .dropdown li.highlighted {
    background: #545454 !important;
    color: #ffffff !important;
  }

  .dropdown li.selected {
    color: #ffffff !important;
    background: #000000 !important;
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

  .socket-input.is-modified {
    border-color: #ffffff;
  }

  .socket-input.is-modified input {
    color: #ffffff;
    border-left-color: #ffffff;
  }

  .socket-input input:hover,
  .socket-input input:focus {
    border-color: inherit;
  }
</style>
