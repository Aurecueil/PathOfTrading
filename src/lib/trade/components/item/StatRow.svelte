<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { StatEntry } from "$lib/types/stats";

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
    if (l.includes("pseudo")) return "#38bdf8"; // Light Blue
    if (l.includes("explicit")) return "#a855f7"; // Purple
    if (l.includes("implicit")) return "#eab308"; // Gold
    if (l.includes("fractured")) return "#ca8a04"; // Amber
    if (l.includes("enchant")) return "#06b6d4"; // Cyan
    if (l.includes("scourge")) return "#f97316"; // Orange
    if (l.includes("crucible")) return "#ef4444"; // Red
    if (l.includes("mercenary")) return "#10b981"; // Emerald
    return "#94a3b8"; // Slate gray default
  }

  $: tagColor = getTagColor(groupLabel || stat.type);
</script>

<div class="stat-row">
  <div class="stat-info">
    <span
      class="stat-tag"
      style="border-color: {tagColor}44; color: {tagColor};"
    >
      {groupLabel || stat.type}
    </span>
    <span class="stat-text" title={stat.text}>{stat.text}</span>
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
    gap: 0.4rem;
    padding: 0.35rem 0.5rem;
    background: #141722;
    border: 1px solid #252b3b;
    border-radius: 4px;
    min-height: 28px;
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
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: capitalize;
    padding: 0.1rem 0.35rem;
    border: 1px solid;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.25);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .stat-text {
    font-size: 0.74rem;
    color: #cbd5e1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stat-controls {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 0 0 auto;
  }

  .weight-input {
    width: 58px;
    background: #232838;
    border: 1px solid #333c52;
    color: #fff;
    padding: 0.15rem 0.3rem;
    border-radius: 4px;
    outline: none;
    font-size: 0.72rem;
    height: 24px;
    text-align: center;
    box-sizing: border-box;
  }
  .weight-input:focus {
    border-color: #3b82f6;
  }

  select {
    background: #232838;
    border: 1px solid #333c52;
    color: #fff;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    outline: none;
    font-size: 0.72rem;
    height: 24px;
    max-width: 140px;
  }

  .min-max-controls {
    display: flex;
    gap: 0.2rem;
  }
  .min-max-controls input {
    width: 50px;
    background: #232838;
    border: 1px solid #333c52;
    color: #fff;
    padding: 0.15rem 0.3rem;
    border-radius: 4px;
    outline: none;
    font-size: 0.72rem;
    height: 24px;
    text-align: center;
    box-sizing: border-box;
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
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 0.7rem;
    padding: 2px 4px;
    border-radius: 3px;
  }
  .remove-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.15);
  }
</style>
