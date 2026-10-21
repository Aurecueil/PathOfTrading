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

  // Accordion: only one preset can be expanded at a time
  let openId = $state<string | null>(null);
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
    openId = p.id;
    freshId = p.id;
  }

  function toggle(id: string) {
    freshId = null;
    openId = openId === id ? null : id;
  }

  function move(id: string, delta: -1 | 1) {
    updatePresets((d) => {
      const i = d.findIndex((x) => x.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.length) return;
      const [item] = d.splice(i, 1);
      d.splice(j, 0, item);
    });
  }
</script>

<div class="tn-list">
  {#if $statGroupPresetsError}
    <div class="st-error">{$statGroupPresetsError}</div>
  {/if}

  {#each $statGroupPresetsStore as preset, i (preset.id)}
    <PresetCard
      {preset}
      open={openId === preset.id}
      fresh={freshId === preset.id}
      canMoveUp={i > 0}
      canMoveDown={i < $statGroupPresetsStore.length - 1}
      ontoggle={() => toggle(preset.id)}
      onmove={(delta) => move(preset.id, delta)}
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
