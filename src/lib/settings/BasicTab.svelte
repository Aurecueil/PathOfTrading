<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import {
    initItemData,
    isLoading,
    displayTiers,
    displayRune,
  } from "$lib/trade/tradeStore";
  // Adjust this import path to wherever your fetchCdnImage file is located:
  import {
    getCacheStats,
    clearAllCaches,
  } from "$lib/trade/utilis/imageService";

  let { onStatus }: { onStatus: (m: string) => void } = $props();

  const languages = [
    { code: "EN", label: "English (EN)" },
    { code: "BR", label: "Português (BR)" },
    { code: "RU", label: "Русский (RU)" },
    { code: "TH", label: "ไทย (TH)" },
    { code: "DE", label: "Deutsch (DE)" },
    { code: "FR", label: "Français (FR)" },
    { code: "ES", label: "Español (ES)" },
    { code: "JP", label: "日本語 (JP)" },
  ];

  let selected = $state("EN");
  let saved = $state("EN");
  let saving = $state(false);

  // Cache state
  let cacheCount = $state(0);
  let cacheSize = $state("0 B");
  let loadingCache = $state(true);
  let clearingCache = $state(false);

  async function refreshCacheStats() {
    loadingCache = true;
    try {
      const stats = await getCacheStats();
      cacheCount = stats.count;
      cacheSize = stats.formattedSize;
    } catch (err) {
      console.error("Failed to load cache stats:", err);
    } finally {
      loadingCache = false;
    }
  }

  async function handleClearCache() {
    if (clearingCache || loadingCache) return;
    clearingCache = true;
    try {
      await clearAllCaches();
      await refreshCacheStats();
      onStatus("Image cache cleared");
    } catch (err) {
      console.error("Failed to clear image cache:", err);
      onStatus("Failed to clear image cache");
    } finally {
      clearingCache = false;
    }
  }

  onMount(async () => {
    refreshCacheStats();

    try {
      const lang = await invoke<string>("get_language");
      if (lang) selected = saved = lang;
    } catch (err) {
      console.error("Failed to load language setting:", err);
    }
  });

  async function confirm() {
    if (saving || $isLoading) return;
    saving = true;
    try {
      await invoke("set_language", {
        language: selected,
        languageCode: selected,
      });
      saved = selected;
      await initItemData();
      onStatus(`Language updated to ${selected}`);
    } catch (err) {
      console.error("Failed to save language:", err);
      onStatus("Failed to save language");
    } finally {
      saving = false;
    }
  }
</script>

<div class="st-row">
  <label class="pb-check-text" for="language-select">Language</label>
  <select
    id="language-select"
    class="st-select"
    bind:value={selected}
    disabled={saving || $isLoading}
  >
    {#each languages as lang}
      <option value={lang.code}>{lang.label}</option>
    {/each}
  </select>
  <button
    type="button"
    class="st-btn primary"
    onclick={confirm}
    disabled={saving || $isLoading || selected === saved}
  >
    {saving || $isLoading ? "Updating…" : "Confirm"}
  </button>
</div>

<label class="pb-check">
  <input type="checkbox" bind:checked={$displayTiers} />
  <span class="pb-box"></span>
  <span class="pb-check-text">Always display modifier tiers</span>
</label>

<!-- Inverted: checked = hide socketable modifiers = displayRune false -->
<label class="pb-check">
  <input
    type="checkbox"
    checked={!$displayRune}
    onchange={(e) => displayRune.set(!e.currentTarget.checked)}
  />
  <span class="pb-box"></span>
  <span class="pb-check-text">Hide socketable modifiers</span>
</label>

<div class="st-row">
  <span class="pb-check-text">
    Image Cache:
    {#if loadingCache}
      Calculating…
    {:else}
      {cacheCount} {cacheCount === 1 ? "item" : "items"} ({cacheSize})
    {/if}
  </span>
  <button
    type="button"
    class="st-btn"
    onclick={handleClearCache}
    disabled={clearingCache || loadingCache || cacheCount === 0}
  >
    {clearingCache ? "Clearing…" : "Clear Cache"}
  </button>
</div>
