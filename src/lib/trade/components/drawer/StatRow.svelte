<!-- src/lib/trade/components/drawer/StatRow.svelte -->
<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import type { StatEntry } from "$lib/types/stats";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import RealmIcon from "$lib/trade/components/drawer/RealmIcon.svelte";
  import Check from "$lib/settings/color/Check.svelte";

  export let stat: StatEntry;
  export let allowedStats: Array<StatEntry & { groupLabel?: string }> = [];
  export let groupLabel: string = "";
  export let value: { min?: any; max?: any; option?: any; weight?: any } = {};
  export let disabled: boolean = false;
  export let isWeighted: boolean = false;
  export let showToggle: boolean = true;

  const dispatch = createEventDispatcher<{
    change: { min?: any; max?: any; option?: any; weight?: any };
    changeStat: StatEntry;
    toggleDisabled: void;
    remove: void;
  }>();

  // Inline stat editing state
  let isEditingStat: boolean = false;
  let editQuery: string = "";
  let highlightedIndex: number = -1;
  let dropdownEl: HTMLUListElement | undefined;
  let visibleStatCount: number = 50;
  let editInputEl: HTMLInputElement;
  let rowWrapperEl: HTMLDivElement;

  // Custom option dropdown state
  let isOptionMenuOpen: boolean = false;

  async function scrollHighlightedIntoView() {
    await tick();
    dropdownEl
      ?.querySelector<HTMLElement>("li.highlighted")
      ?.scrollIntoView({ block: "nearest" });
  }

  function moveHighlight(dir: 1 | -1) {
    const shown = displayedEditStats.length;
    if (shown === 0) return;
    if (dir === 1) {
      if (highlightedIndex + 1 >= shown && shown < matchingEditStats.length) {
        visibleStatCount += 50;
        highlightedIndex = highlightedIndex + 1;
      } else {
        highlightedIndex = (highlightedIndex + 1) % shown;
      }
    } else {
      highlightedIndex = (highlightedIndex - 1 + shown) % shown;
    }
    scrollHighlightedIntoView();
  }

  function updateField(field: "min" | "max" | "option" | "weight", val: any) {
    const updated = { ...value };
    if (val === "" || val === null || val === undefined) {
      delete updated[field];
    } else {
      updated[field] = val;
    }
    dispatch("change", updated);
  }

  function getTagColor(label: string): string {
    const l = (label || "").toLowerCase();
    if (l.includes("pseudo")) return "#005DBD";
    if (l.includes("crafted")) return "#D1D1D1";
    if (l.includes("explicit")) return "#57AFF1";
    if (l.includes("implicit")) return "#625F15";
    if (l.includes("fractured")) return "#A08F5F";
    if (l.includes("enchant")) return "#89549A";
    if (l.includes("scourge")) return "#FF6E25";
    if (l.includes("crucible")) return "#FF7339";
    if (l.includes("mercenary")) return "#8C6F3C";
    return "#888888";
  }

  $: tagColor = getTagColor(groupLabel || stat.type);

  $: matchingEditStats = editQuery.trim()
    ? allowedStats.filter((item) => {
        const tokens = editQuery.toLowerCase().trim().split(/\s+/);
        const targetText = (item.text || "").toLowerCase();
        const targetLabel = (item.groupLabel || "").toLowerCase();
        const targetType = (item.type || "").toLowerCase();
        return tokens.every(
          (token) =>
            targetText.includes(token) ||
            targetLabel.includes(token) ||
            targetType.includes(token),
        );
      })
    : allowedStats;

  $: displayedEditStats = matchingEditStats.slice(0, visibleStatCount);

  async function startEditingStat() {
    isEditingStat = true;
    editQuery = stat.text || "";
    highlightedIndex = 0;
    visibleStatCount = 50;
    await tick();
    editInputEl?.focus();
  }

  function selectEditedStat(nextStat: StatEntry) {
    isEditingStat = false;
    highlightedIndex = -1;
    dispatch("changeStat", nextStat);
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    // Shift + Enter: close inline editor, defocus, and bubble to FilterForm for Search & Close
    if (e.key === "Enter" && e.shiftKey) {
      isEditingStat = false;
      highlightedIndex = -1;
      editInputEl?.blur();
      return;
    }

    // Escape: close inline editor & defocus
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      isEditingStat = false;
      highlightedIndex = -1;
      editInputEl?.blur();
      return;
    }

    // Enter when empty: close inline editor, defocus, and bubble to FilterForm for Search
    if (e.key === "Enter" && editQuery.trim() === "") {
      isEditingStat = false;
      highlightedIndex = -1;
      editInputEl?.blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (displayedEditStats.length > 0) {
        moveHighlight(1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (displayedEditStats.length > 0) {
        moveHighlight(-1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (
        highlightedIndex >= 0 &&
        highlightedIndex < displayedEditStats.length
      ) {
        selectEditedStat(displayedEditStats[highlightedIndex]);
      } else if (displayedEditStats.length > 0) {
        selectEditedStat(displayedEditStats[0]);
      } else {
        isEditingStat = false;
      }
    }
  }

  function handleDropdownScroll(e: UIEvent) {
    const target = e.currentTarget as HTMLElement;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
      if (visibleStatCount < matchingEditStats.length) {
        visibleStatCount += 50;
      }
    }
  }

  function handleWindowClick(e: MouseEvent) {
    if (!rowWrapperEl) return;
    if (!e.composedPath().includes(rowWrapperEl)) {
      isEditingStat = false;
      isOptionMenuOpen = false;
    }
  }

  $: selectedOptionLabel = (() => {
    const opts = stat.option?.options || [];
    if (
      value?.option === undefined ||
      value?.option === null ||
      value?.option === ""
    ) {
      return "Any";
    }
    const found = opts.find((o) => String(o.id) === String(value.option));
    return found ? found.text : "Any";
  })();
</script>

<svelte:window on:click={handleWindowClick} />

<div
  class="stat-row"
  class:is-editing={isEditingStat}
  class:is-disabled={disabled}
  bind:this={rowWrapperEl}
>
  <!-- Most-left checkbox to enable / disable this stat -->
  {#if showToggle}
    <Check checked={!disabled} onchange={() => dispatch("toggleDisabled")} />
  {/if}
  {#if isEditingStat}
    <div class="stat-edit-container">
      <input
        bind:this={editInputEl}
        type="text"
        class="stat-edit-input"
        bind:value={editQuery}
        on:input={() => {
          highlightedIndex = editQuery.trim() ? 0 : -1;
          visibleStatCount = 50;
        }}
        on:keydown={handleEditKeyDown}
        placeholder="Search stat..."
        autocomplete="off"
      />

      {#if displayedEditStats.length > 0}
        <ul
          class="stat-dropdown"
          bind:this={dropdownEl}
          on:scroll={handleDropdownScroll}
          on:wheel|stopPropagation
        >
          {#each displayedEditStats as statItem, idx}
            {@const itemTagCol = getTagColor(
              statItem.groupLabel || statItem.type,
            )}
            <li
              class:highlighted={highlightedIndex === idx}
              class:selected={statItem.id === stat.id}
              on:mousedown|preventDefault={() => selectEditedStat(statItem)}
            >
              <span
                class="stat-tag"
                style="border-color: {itemTagCol}; color: {itemTagCol};"
              >
                {statItem.groupLabel || statItem.type}
              </span>
              <RealmIcon realms={(statItem as any).realms} />
              <StatColorText className="dropdown-text" text={statItem.text} />
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="stat-info editable" on:click={startEditingStat}>
      <span
        class="stat-tag"
        style="border-color: {tagColor}; color: {tagColor};"
      >
        {groupLabel || stat.type}
      </span>
      <span class="stat-text">
        <StatColorText text={stat.text} />
      </span>
    </div>
  {/if}

  <div class="stat-controls">
    {#if isWeighted}
      <input
        type="number"
        class="weight-input"
        placeholder="Weight"
        value={value?.weight ?? ""}
        on:input={(e) => updateField("weight", e.currentTarget.value)}
      />
    {/if}

    {#if stat.option?.options && stat.option.options.length > 0}
      <div class="stat-opt-dropdown-wrapper">
        <button
          type="button"
          class="stat-opt-trigger"
          on:click={() => (isOptionMenuOpen = !isOptionMenuOpen)}
        >
          <span class="opt-label">{selectedOptionLabel}</span>
          <span class="opt-chevron">▾</span>
        </button>
        {#if isOptionMenuOpen}
          <ul class="dropdown stat-opt-dropdown" on:wheel|stopPropagation>
            <li
              class:selected={value?.option === undefined ||
                value?.option === null ||
                value?.option === ""}
              on:mousedown|preventDefault={() => {
                updateField("option", null);
                isOptionMenuOpen = false;
              }}
            >
              Any
            </li>
            {#each stat.option.options as opt}
              <li
                class:selected={String(value?.option) === String(opt.id)}
                on:mousedown|preventDefault={() => {
                  const parsed =
                    typeof opt.id === "number" || !Number.isNaN(Number(opt.id))
                      ? Number(opt.id)
                      : opt.id;
                  updateField("option", parsed);
                  isOptionMenuOpen = false;
                }}
              >
                {opt.text}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {:else}
      <div class="min-max-controls">
        <input
          type="number"
          placeholder="Min"
          value={value?.min ?? ""}
          on:input={(e) => updateField("min", e.currentTarget.value)}
        />
        <input
          type="number"
          placeholder="Max"
          value={value?.max ?? ""}
          on:input={(e) => updateField("max", e.currentTarget.value)}
        />
      </div>
    {/if}

    <button
      type="button"
      class="remove-btn"
      on:click={() => dispatch("remove")}
    >
      ✕
    </button>
  </div>
</div>

<style>
  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    padding: 2px 4px;
    background: #000000;
    border: 1px solid #555555;
    border-radius: 0px;
    min-height: 24px;
    box-sizing: border-box;
    position: relative;
  }

  .stat-row.is-disabled .stat-info,
  .stat-row.is-disabled .stat-controls input,
  .stat-row.is-disabled .stat-opt-trigger {
    opacity: 0.45;
  }

  .stat-row.is-editing {
    z-index: 60;
    border-color: #ffffff;
  }

  .stat-info {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
  }

  .stat-info.editable {
    cursor: pointer;
  }

  .stat-info.editable:hover .stat-text {
    color: #ffffff;
  }

  .stat-edit-container {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
  }

  .stat-edit-input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1.15;
    width: 100%;
    flex: 1 1 auto;
    min-width: 0;
    background: transparent;
    border: none;
    color: #ffffff;
    padding: 0;
    margin: 0;
    outline: none;
    box-sizing: border-box;
  }

  .stat-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: -5px;
    right: 0;
    min-width: 260px;
    max-height: 240px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #000000;
    border: 1px solid #ffffff;
    border-radius: 0px;
    list-style: none;
    padding: 2px 0;
    margin: 0;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  .stat-dropdown li {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1.15;
    padding: 1px 4px;
    cursor: pointer;
    color: #9a9a9a;
    background: #000000;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
    overflow: hidden;
  }

  .stat-dropdown li:hover,
  .stat-dropdown li.highlighted {
    background: #545454;
    color: #ffffff;
  }

  .stat-dropdown li.selected {
    color: #ffffff;
  }

  .dropdown-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stat-tag {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 10px;
    font-weight: normal;
    text-transform: capitalize;
    padding: 0px 3px;
    border: 1px solid;
    border-radius: 0px;
    background: #000000;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .stat-text {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    color: #d3d3d3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stat-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 0 0 auto;
  }

  .weight-input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    width: 52px;
    height: 22px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 4px;
    outline: none;
    text-align: center;
    box-sizing: border-box;
  }

  .weight-input:hover,
  .weight-input:focus {
    border-color: #ffffff;
  }

  .stat-opt-dropdown-wrapper {
    position: relative;
  }

  .stat-opt-trigger {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1.15;
    height: 22px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 4px;
    outline: none;
    max-width: 140px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-opt-trigger:hover,
  .stat-opt-trigger:focus {
    border-color: #ffffff;
  }

  .opt-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .opt-chevron {
    color: #888888;
    font-size: 9px;
  }

  .stat-opt-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 140px;
    max-height: 220px;
    overflow-y: auto;
    margin: 2px 0 0 0;
    list-style: none;
  }

  .min-max-controls {
    display: flex;
    gap: 0.2rem;
  }

  .min-max-controls input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    width: 48px;
    height: 22px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 4px;
    outline: none;
    text-align: center;
    box-sizing: border-box;
  }

  .min-max-controls input:hover,
  .min-max-controls input:focus {
    border-color: #ffffff;
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

  .remove-btn {
    font-family: "Fontin", monospace, sans-serif;
    background: transparent;
    border: none;
    border-radius: 0px;
    color: #888888;
    cursor: pointer;
    font-size: 11px;
    height: 22px;
    padding: 0 4px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    color: #ff5555;
    background: transparent;
  }
</style>
