<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import {
    initItemData,
    isLoading,
    statColorCodingEnabled,
  } from "$lib/trade/tradeStore";

  const languages = [
    { code: "EN", label: "English (EN)" },
    { code: "BR", label: "Português (BR)" },
    { code: "RU", label: "Русский (RU)" },
    { code: "TH", label: "ไทย (TH)" },
    { code: "DE", label: "Deutsch (DE)" },
    { code: "FR", label: "Français (FR)" },
    { code: "ES", label: "Español (ES)" },
    { code: "JP", label: "日本語 (JP)" },
  ] as const;

  let selectedLanguage: string = "EN";
  let savedLanguage: string = "EN";
  let isSaving: boolean = false;
  let statusMessage: string = "";

  onMount(async () => {
    try {
      const currentLang = await invoke<string>("get_language");
      if (currentLang) {
        selectedLanguage = currentLang;
        savedLanguage = currentLang;
      }
    } catch (err) {
      console.error("Failed to load language setting:", err);
    }

    try {
      const userSettings = await invoke<{ colorCoding: boolean }>(
        "get_user_settings",
      );
      if (typeof userSettings?.colorCoding === "boolean") {
        statColorCodingEnabled.set(userSettings.colorCoding);
      }
    } catch (err) {
      console.error("Failed to load user settings:", err);
    }
  });

  async function handleConfirmLanguage() {
    if (isSaving || $isLoading) return;
    isSaving = true;
    statusMessage = "";

    try {
      await invoke("set_language", {
        language: selectedLanguage,
        languageCode: selectedLanguage,
      });
      savedLanguage = selectedLanguage;

      setTimeout(async () => {
        await initItemData();
        isSaving = false;
        statusMessage = `Language updated to ${selectedLanguage}`;
      }, 100);
    } catch (err) {
      console.error("Failed to save language:", err);
      statusMessage = "Failed to save language";
      isSaving = false;
    }
  }

  async function handleColorCodingChange(e: Event) {
    const enabled = (e.currentTarget as HTMLInputElement).checked;
    statColorCodingEnabled.set(enabled);
    statusMessage = "";

    try {
      await invoke("set_color_coding", { enabled });
      statusMessage = `Stat color coding ${enabled ? "enabled" : "disabled"}`;
    } catch (err) {
      console.error("Failed to save colorCoding setting:", err);
      statusMessage = "Failed to save stat color coding";
    }
  }
</script>

<div class="settings-page">
  <section class="settings-panel">
    <header class="panel-header">
      <h2 class="panel-title">Settings</h2>
      {#if isSaving || $isLoading}
        <div class="header-status" role="status" aria-live="polite">
          <span class="loading-spinner"></span>
          <span>Fetching trade data...</span>
        </div>
      {/if}
    </header>

    <div class="panel-body">
      <!-- Language Setting Group -->
      <div class="setting-group">
        <div class="group-header">Language &amp; Region</div>
        <div class="group-content">
          <label for="language-select" class="field-label">
            Trade API Language
          </label>
          <div class="controls-row">
            <select
              id="language-select"
              bind:value={selectedLanguage}
              disabled={isSaving || $isLoading}
            >
              {#each languages as lang}
                <option value={lang.code}>{lang.label}</option>
              {/each}
            </select>

            <button
              type="button"
              class="primary"
              on:click={handleConfirmLanguage}
              disabled={isSaving || $isLoading}
            >
              {#if isSaving || $isLoading}
                Updating...
              {:else}
                Confirm
              {/if}
            </button>
          </div>
        </div>
      </div>

      <!-- Display / UI Setting Group -->
      <div class="setting-group">
        <div class="group-header">Interface</div>
        <div class="group-content">
          <label class="checkbox-row" for="color-coding-toggle">
            <input
              id="color-coding-toggle"
              type="checkbox"
              checked={$statColorCodingEnabled}
              on:change={handleColorCodingChange}
            />
            <span class="checkbox-box"></span>
            <span class="checkbox-text">Enable Stat Color Coding</span>
          </label>
        </div>
      </div>

      {#if statusMessage}
        <div class="status-banner">
          {statusMessage}
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  .settings-page {
    position: absolute;
    inset: 0;
    background-color: #12151c;
    color: #d3d3d3;
    font-family: monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    padding: 1.25rem;
    box-sizing: border-box;
    overflow-y: auto;
  }

  /* Matches .drawer container aesthetic */
  .settings-panel {
    max-width: 460px;
    background-color: #000000;
    border: 1px solid #777777;
    border-radius: 0px;
    box-shadow: 6px 6px 24px rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid #777777;
    background-color: #000000;
  }

  .panel-title {
    margin: 0;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 13px;
    font-weight: normal;
    color: #ffffff;
    letter-spacing: 0.3px;
  }

  .header-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #ffffff;
    font-size: 11px;
  }

  .loading-spinner {
    width: 10px;
    height: 10px;
    border: 2px solid #555555;
    border-top-color: #ffffff;
    border-radius: 50%;
    display: inline-block;
    animation: settings-spin 0.7s linear infinite;
  }

  @keyframes settings-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .panel-body {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .setting-group {
    border: 1px solid #555555;
    background-color: #000000;
    display: flex;
    flex-direction: column;
  }

  .group-header {
    padding: 0.35rem 0.5rem;
    background-color: #0a0a0a;
    border-bottom: 1px solid #555555;
    color: #ffffff;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
  }

  .group-content {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .field-label {
    color: #9a9a9a;
    font-size: 11px;
  }

  .controls-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    width: 100%;
  }

  /* Matches Drawer select styling */
  select {
    flex: 1;
    font-family: monospace, sans-serif !important;
    font-size: 12px !important;
    height: 26px !important;
    line-height: 1.15 !important;
    background-color: #000000 !important;
    border: 1px solid #7f7f7f !important;
    border-radius: 0px !important;
    color: #ffffff !important;
    padding: 0 4px !important;
    outline: none;
    min-width: 0;
    box-sizing: border-box;
    cursor: pointer;
  }

  select:hover:not(:disabled),
  select:focus:not(:disabled) {
    border-color: #ffffff !important;
  }

  select option {
    background-color: #000000 !important;
    color: #9a9a9a !important;
    font-family: monospace, sans-serif !important;
    font-size: 12px !important;
    padding: 1px 3px !important;
  }

  select option:checked,
  select option[selected] {
    background-color: #000000 !important;
    color: #ffffff !important;
  }

  select option:hover {
    background-color: #545454 !important;
    color: #ffffff !important;
  }

  /* Matches Drawer .actions button.primary styling */
  button.primary {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 12px;
    height: 26px;
    line-height: 1;
    padding: 2px 12px;
    border-radius: 0px !important;
    cursor: pointer;
    background-color: #000000 !important;
    border: 1px solid #ffffff !important;
    color: #ffffff !important;
    text-align: center;
    transition:
      background 0.1s ease,
      border-color 0.1s ease;
    flex-shrink: 0;
  }

  button.primary:hover:not(:disabled),
  button.primary:focus:not(:disabled) {
    background-color: #545454 !important;
    border-color: #ffffff !important;
    color: #ffffff !important;
    outline: none;
  }

  button:disabled,
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Custom Square Monospace Checkbox matching Drawer Borders */
  .checkbox-row {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
    color: #d3d3d3;
    padding: 2px 0;
  }

  .checkbox-row input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .checkbox-box {
    width: 14px;
    height: 14px;
    background-color: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .checkbox-row:hover .checkbox-box,
  .checkbox-row input[type="checkbox"]:focus-visible + .checkbox-box {
    border-color: #ffffff;
  }

  .checkbox-row input[type="checkbox"]:checked + .checkbox-box {
    border-color: #ffffff;
  }

  .checkbox-row input[type="checkbox"]:checked + .checkbox-box::after {
    content: "";
    width: 8px;
    height: 8px;
    background-color: #ffffff;
    display: block;
  }

  .checkbox-row input[type="checkbox"]:checked ~ .checkbox-text {
    color: #ffffff;
  }

  .status-banner {
    padding: 0.35rem 0.5rem;
    background-color: #0a0a0a;
    border: 1px solid #777777;
    color: #ffffff;
    font-size: 11px;
  }
</style>
