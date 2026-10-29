<script lang="ts">
  import type { TileDisplayOptions } from "$lib/types/types";
  import {
    MOD_DISPLAY_FIELDS,
    DEFAULT_CURRENCY,
    DEFAULT_SEARCH_ON_LOAD,
    getCurrencyIdsForRealm,
    isCurrencyValidForRealm,
    prettifyCurrencyId,
  } from "./tileDisplay";

  export let displayOptions: TileDisplayOptions;
  export let currency: string = DEFAULT_CURRENCY;
  export let searchOnLoad: boolean = DEFAULT_SEARCH_ON_LOAD;
  export let realm: "poe" | "poe2" = "poe";
  export let staticCatalog: any[] = [];

  let collapsed = false;
  let isCurrencyOpen = false;
  let highlightedIndex = -1;

  $: visibleMods = MOD_DISPLAY_FIELDS.filter(
    (f) => f.realm === "both" || f.realm === realm,
  );

  // Realm switch (or an invalid saved value): keep the currency if the new
  // realm supports it (vaal, divine, ...), otherwise fall back to chaos.
  $: if (!isCurrencyValidForRealm(currency, realm)) {
    currency = DEFAULT_CURRENCY;
  }

  // Labels come from the static catalog when it has the id, else a prettified id.
  $: catalogLabels = (() => {
    const map = new Map<string, string>();
    for (const g of staticCatalog) {
      for (const e of g?.entries ?? []) {
        if (e?.id && e.text && !map.has(e.id)) map.set(e.id, e.text);
      }
    }
    return map;
  })();

  $: currencyOptions = getCurrencyIdsForRealm(realm).map((id) => ({
    id,
    text: catalogLabels.get(id) ?? prettifyCurrencyId(id),
  }));

  $: currencyLabel =
    currencyOptions.find((o) => o.id === currency)?.text ||
    prettifyCurrencyId(currency);

  function setMod(flag: keyof TileDisplayOptions, v: boolean) {
    displayOptions = { ...displayOptions, [flag]: v };
  }

  function openCurrency() {
    isCurrencyOpen = true;
    highlightedIndex = Math.max(
      0,
      currencyOptions.findIndex((o) => o.id === currency),
    );
  }

  function selectCurrency(id: string) {
    currency = id;
    isCurrencyOpen = false;
    highlightedIndex = -1;
  }

  function onCurrencyKeyDown(e: KeyboardEvent) {
    if (!isCurrencyOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        openCurrency();
      }
      return;
    }
    const n = currencyOptions.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      highlightedIndex = (highlightedIndex + 1) % n;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      highlightedIndex = (highlightedIndex - 1 + n) % n;
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const opt = currencyOptions[highlightedIndex];
      if (opt) selectCurrency(opt.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      isCurrencyOpen = false;
    }
  }

  function handleWindowClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest(".currency-wrapper")) {
      isCurrencyOpen = false;
    }
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="filter-group-card" class:collapsed>
  <button
    type="button"
    class="group-toggle"
    on:click={() => (collapsed = !collapsed)}
  >
    <span>Tile Display</span>
    <span class="chevron">{collapsed ? "▸" : "▾"}</span>
  </button>

  {#if !collapsed}
    <div class="group-content">
      <!-- Row 1: 2-column layout (Search on load | Currency picker) -->
      <div class="top-row">
        <label
          class="check-cell"
          class:checked={searchOnLoad}
          title="Run this search automatically when the project loads. When off, the tile stays empty (and live tiles don't connect) until you press Search."
        >
          <input type="checkbox" bind:checked={searchOnLoad} />
          <span>Search on load</span>
        </label>

        <div class="currency-row">
          <span class="currency-label">Display currency</span>
          <div class="currency-wrapper">
            <button
              type="button"
              class="custom-dropdown-trigger"
              aria-label="Display currency"
              aria-expanded={isCurrencyOpen}
              on:click={() =>
                isCurrencyOpen ? (isCurrencyOpen = false) : openCurrency()}
              on:keydown={onCurrencyKeyDown}
            >
              <span class="trigger-label">{currencyLabel}</span>
            </button>
            <span class="trigger-arrow">▾</span>

            {#if isCurrencyOpen && currencyOptions.length > 0}
              <ul class="dropdown" on:wheel|stopPropagation>
                {#each currencyOptions as opt, idx (opt.id)}
                  <li
                    class:highlighted={highlightedIndex === idx}
                    class:selected={opt.id === currency}
                    on:mousedown|preventDefault={() => selectCurrency(opt.id)}
                  >
                    {opt.text}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </div>

      <!-- Row 2+: Mod checkboxes -->
      <div class="mods-grid">
        {#each visibleMods as f (f.flag)}
          <label class="check-cell" class:checked={displayOptions[f.flag]}>
            <input
              type="checkbox"
              checked={displayOptions[f.flag]}
              on:change={(e) => setMod(f.flag, e.currentTarget.checked)}
            />
            <span>Display {f.label.toLowerCase()}</span>
          </label>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Base card structure */
  .filter-group-card {
    background: #000000;
    border: 1px solid #777777;
    position: relative;
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
  }
  .filter-group-card:focus-within {
    z-index: 30;
  }
  .group-toggle {
    width: 100%;
    height: 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1px 6px;
    background: #050505;
    border: none;
    border-bottom: 1px solid #777777;
    color: #e0e0e0;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    cursor: pointer;
    text-align: left;
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
    padding: 6px;
    background: #000000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-sizing: border-box;
  }

  /* Row 1: Strict 2 equal/balanced columns */
  .top-row {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-width: 0;
  }
  .top-row .check-cell {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  /* Single row: 2 elements side-by-side with no artificial gap in the middle */
  .top-row {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 1rem;
    width: 100%;
    min-width: 0;
  }

  /* Column 1: Search on load stays its natural width */
  .top-row .check-cell {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  /* Column 2: Display currency fills the rest of the entire row */
  .currency-row {
    flex: 1 1 0%;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .currency-label {
    flex: 0 0 auto;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    color: #ffffff;
    white-space: nowrap;
  }

  /* Dropdown expands all the way to the right edge with no width cap */
  .currency-wrapper {
    position: relative;
    flex: 1 1 0%;
    min-width: 80px;
  }

  /* Checkbox styling */
  .check-cell {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 22px;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    color: #9a9a9a !important;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .check-cell.checked {
    color: #ffffff !important;
  }

  input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    position: relative;
    width: 13px;
    height: 13px;
    margin: 0;
    flex-shrink: 0;
    background: #000000;
    border: 1px solid #777777;
    cursor: pointer;
    outline: none;
  }
  input[type="checkbox"]:hover,
  input[type="checkbox"]:focus-visible {
    border-color: #ffffff;
  }
  input[type="checkbox"]:checked {
    border-color: #ffffff;
  }
  input[type="checkbox"]:checked::after {
    content: "";
    position: absolute;
    inset: 2px;
    background: #ffffff;
  }

  /* Dropdown trigger and arrow */
  .custom-dropdown-trigger {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1.15;
    height: 22px;
    width: 100%;
    background: #000000;
    border: 1px solid #777777;
    color: #ffffff;
    padding: 1px 1.25rem 1px 6px;
    outline: none;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    cursor: pointer;
    text-align: left;
  }
  .custom-dropdown-trigger:hover,
  .custom-dropdown-trigger:focus,
  .custom-dropdown-trigger[aria-expanded="true"] {
    border-color: #ffffff;
  }
  .trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }
  .trigger-arrow {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    color: #777777;
    pointer-events: none;
  }

  /* Dropdown menu */
  .dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 100%;
    width: max-content;
    max-height: 240px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #000000 !important;
    border: 1px solid #ffffff !important;
    list-style: none;
    padding: 2px 0 !important;
    margin: 2px 0 0 0 !important;
    z-index: 1000 !important;
    box-sizing: border-box !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85) !important;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }
  .dropdown li {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 11px !important;
    line-height: 1.2 !important;
    padding: 3px 6px !important;
    cursor: pointer !important;
    color: #9a9a9a !important;
    background: #000000 !important;
    white-space: nowrap !important;
  }
  .dropdown li:hover,
  .dropdown li.highlighted {
    background: #333333 !important;
    color: #ffffff !important;
  }
  .dropdown li.selected {
    color: #ffffff !important;
  }

  /* Mod options grid */
  .mods-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.25rem 0.5rem;
    padding-top: 2px;
    border-top: 1px solid #222222;
  }
</style>
