<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { StatEntry } from "$lib/types/stats";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";

  export let stat: StatEntry;
  export let groupLabel: string = "";
  export let value: { min?: any; max?: any; option?: any; weight?: any } = {};
  export let isWeighted: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { min?: any; max?: any; option?: any; weight?: any };
    remove: void;
  }>();

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
    if (l.includes("pseudo")) return "#66b2ff";
    if (l.includes("explicit")) return "#e066ff";
    if (l.includes("implicit")) return "#e6c200";
    if (l.includes("fractured")) return "#e6c200";
    if (l.includes("enchant")) return "#66b2ff";
    if (l.includes("scourge")) return "#ff5555";
    if (l.includes("crucible")) return "#ff5555";
    if (l.includes("mercenary")) return "#55ff55";
    return "#888888";
  }

  $: tagColor = getTagColor(groupLabel || stat.type);
</script>

<div class="stat-row">
  <div class="stat-info">
    <span class="stat-tag" style="border-color: {tagColor}; color: {tagColor};">
      {groupLabel || stat.type}
    </span>
    <span class="stat-text" title={stat.text}>
      <StatColorText text={stat.text} />
    </span>
  </div>

  <div class="stat-controls">
    <!-- Weight field matching Min/Max box style -->
    {#if isWeighted}
      <input
        type="number"
        class="weight-input"
        placeholder="Weight"
        value={value?.weight ?? ""}
        on:input={(e) => updateField("weight", e.currentTarget.value)}
      />
    {/if}

    <!-- Stat Option or Min/Max -->
    {#if stat.option?.options && stat.option.options.length > 0}
      <select
        value={value?.option ?? ""}
        on:change={(e) =>
          updateField(
            "option",
            e.currentTarget.value ? Number(e.currentTarget.value) : null,
          )}
      >
        <option value="">Any</option>
        {#each stat.option.options as opt}
          <option value={opt.id}>{opt.text}</option>
        {/each}
      </select>
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
      title="Remove stat"
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
  }

  .stat-info {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
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

  select {
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
  }

  select:hover,
  select:focus {
    border-color: #ffffff;
  }

  select option {
    background-color: #000000;
    color: #ffffff;
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

  /* Borderless ✕ remove button */
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
