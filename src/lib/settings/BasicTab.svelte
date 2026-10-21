<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import {
    initItemData,
    isLoading,
    displayTiers,
    displayRune,
  } from "$lib/trade/tradeStore";

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

  onMount(async () => {
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
