<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    statColorCodingEnabled,
    setStatColorCodingEnabled,
    customNodesStore,
    defaultNodesStore,
    colorSaveError,
    undoCustom,
    flushCustomSave,
    loadStatColorConfigsFromDisk,
  } from "$lib/trade/tradeStore";
  import { treeUi } from "./color/treeState.svelte";
  import Check from "./color/Check.svelte";
  import CustomRules from "./color/CustomRules.svelte";
  import DefaultRules from "./color/DefaultRules.svelte";

  let { onStatus }: { onStatus: (m: string) => void } = $props();

  onMount(() => {
    loadStatColorConfigsFromDisk();
  });
  onDestroy(() => {
    void flushCustomSave();
  });

  async function onToggle() {
    const enabled = !$statColorCodingEnabled;
    try {
      await setStatColorCodingEnabled(enabled);
      onStatus(`Color coding ${enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      console.error(err);
      onStatus("Failed to save color coding setting");
    }
  }

  // Ctrl+Z undoes custom edits (including deletes)
  function onKey(e: KeyboardEvent) {
    if (treeUi.view !== "custom") return;
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.shiftKey &&
      e.key.toLowerCase() === "z"
    ) {
      if ((e.target as HTMLElement)?.closest?.("input, textarea")) return;
      e.preventDefault();
      if (undoCustom()) onStatus("Undone");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="cc-tab">
  <div class="cc-head">
    <Check
      checked={$statColorCodingEnabled}
      label="Color-code stats in the trade overlay"
      onchange={onToggle}
    />
    <div class="st-seg">
      <button
        type="button"
        class:active={treeUi.view === "custom"}
        onclick={() => (treeUi.view = "custom")}
      >
        Custom
      </button>
      <button
        type="button"
        class:active={treeUi.view === "default"}
        onclick={() => (treeUi.view = "default")}
      >
        Default
      </button>
    </div>
  </div>

  {#if $colorSaveError}
    <div class="st-error" style="margin-top:8px">{$colorSaveError}</div>
  {/if}

  <div class="cc-scroll" class:dim={!$statColorCodingEnabled}>
    {#if treeUi.view === "custom"}
      <CustomRules nodes={$customNodesStore} />
    {:else}
      <DefaultRules nodes={$defaultNodesStore} />
    {/if}
  </div>
</div>
