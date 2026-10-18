<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    statGroupPresetsStore,
    statGroupPresetsError,
    loadStatGroupPresets,
    flushStatGroupPresets,
    updatePresets,
    createPreset,
  } from "$lib/trade/statGroupPresets";
  import PresetCard from "./statgroups/PresetCard.svelte";

  let open = $state<Record<string, boolean>>({});
  let freshId = $state<string | null>(null);

  onMount(() => {
    void loadStatGroupPresets();
  });
  onDestroy(() => {
    void flushStatGroupPresets();
  });

  function add() {
    const p = createPreset();
    updatePresets((d) => d.push(p));
    open[p.id] = true;
    freshId = p.id;
  }
</script>

<div class="tn-list">
  {#if $statGroupPresetsError}
    <div class="st-error">{$statGroupPresetsError}</div>
  {/if}

  {#each $statGroupPresetsStore as preset (preset.id)}
    <PresetCard
      {preset}
      open={Boolean(open[preset.id])}
      fresh={freshId === preset.id}
      ontoggle={() => {
        freshId = null;
        open[preset.id] = !open[preset.id];
      }}
    />
  {/each}

  {#if $statGroupPresetsStore.length === 0}
    <div class="st-empty">
      No presets yet. A preset is a named set of stat groups you can insert from
      the “+ Add Stat Group” menu in the filter form.
    </div>
  {/if}

  <div class="add-row">
    <button type="button" class="add-btn" onclick={add}>+ Add Preset</button>
  </div>
</div>
