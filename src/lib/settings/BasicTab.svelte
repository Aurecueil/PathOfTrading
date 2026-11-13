<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import {
    initItemData,
    isLoading,
    displayTiers,
    displayRune,
    showTooltips,
    compactMercenaryDisplay,
    tpHotkey,
    updateTpHotkey,
    canvasBgPath,
    canvasBgOpacity,
    doubleTitle,
    styleType,
    liveSoundEnabled,
    liveSoundGainDb,
    liveSoundCustomData,
    liveSoundCustomName,
  } from "$lib/trade/tradeStore";
  // Adjust this import path to wherever your fetchCdnImage file is located:
  import {
    getCacheStats,
    clearAllCaches,
  } from "$lib/trade/utilis/imageService";
  import {
    previewLiveBlip,
    stopLiveBlips,
    livePreviewPlaying,
  } from "$lib/trade/utilis/liveSound";
  import { telemetryLevel, setTelemetryLevel } from "$lib/project/telemetry";

  const DEFAULT_HOTKEY = "CommandOrControl+Shift+T";
  let customFileName = $derived(
    ($liveSoundCustomData ?? "").split(/[\\/]/).pop() ?? "",
  );
  let {
    onStatus,
    isDraggingOpacity = $bindable(false),
    onOpacityDragChange,
  }: {
    onStatus: (m: string) => void;
    isDraggingOpacity?: boolean;
    onOpacityDragChange?: (dragging: boolean) => void;
  } = $props();

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

  // Hotkey recording state
  let recordingHotkey = $state(false);
  let pendingBackendHotkey = $state("");
  let savingHotkey = $state(false);

  // Cache state
  let cacheCount = $state(0);
  let cacheSize = $state("0 B");
  let loadingCache = $state(true);
  let clearingCache = $state(false);

  let fileInput: HTMLInputElement | undefined = $state();
  function handleTelemetryChange(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    if (value !== "0" && value !== "1") return;
    setTelemetryLevel(value === "1" ? 1 : 0);
    onStatus(`Telemetry set to ${value === "1" ? "Basic" : "None"}`);
  }
  function formatHotkeyDisplay(accel: string): string {
    if (!accel) return "";
    return accel
      .replace(/CommandOrControl/gi, "Ctrl")
      .replace(/Control/gi, "Ctrl")
      .replace(/Command/gi, "Cmd")
      .replace(/ArrowUp/gi, "Up")
      .replace(/ArrowDown/gi, "Down")
      .replace(/ArrowLeft/gi, "Left")
      .replace(/ArrowRight/gi, "Right");
  }

  function setSliderHolding(holding: boolean) {
    if (isDraggingOpacity === holding) return;
    isDraggingOpacity = holding;
    onOpacityDragChange?.(holding);
  }

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

  onMount(() => {
    refreshCacheStats();

    invoke<string>("get_language")
      .then((lang) => {
        if (lang) selected = saved = lang;
      })
      .catch((err) => {
        console.error("Failed to load language setting:", err);
      });

    const handleGlobalUp = () => {
      if (isDraggingOpacity) setSliderHolding(false);
    };
    window.addEventListener("pointerup", handleGlobalUp);
    window.addEventListener("pointercancel", handleGlobalUp);
    window.addEventListener("blur", handleGlobalUp);

    return () => {
      window.removeEventListener("pointerup", handleGlobalUp);
      window.removeEventListener("pointercancel", handleGlobalUp);
      window.removeEventListener("blur", handleGlobalUp);
    };
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

  function startRecordingHotkey() {
    if (savingHotkey) return;
    recordingHotkey = true;
    pendingBackendHotkey = "";
  }

  function cancelRecordingHotkey() {
    recordingHotkey = false;
    pendingBackendHotkey = "";
  }

  function handleHotkeyKeydown(e: KeyboardEvent) {
    if (!recordingHotkey) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      cancelRecordingHotkey();
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    const isModifierOnly = ["Control", "Shift", "Alt", "Meta"].includes(e.key);
    if (!isModifierOnly) {
      let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (key === " ") key = "Space";
      parts.push(key);
    }

    pendingBackendHotkey = parts.join("+");
  }

  async function handleHotkeyKeyup(e: KeyboardEvent) {
    if (!recordingHotkey) return;
    e.preventDefault();
    e.stopPropagation();

    if (!pendingBackendHotkey) return;

    const segments = pendingBackendHotkey.split("+");
    const lastSegment = segments[segments.length - 1];
    const hasMainKey = !["CommandOrControl", "Alt", "Shift"].includes(
      lastSegment,
    );

    // Wait until a non-modifier key has been included in the chord
    if (!hasMainKey) return;

    const targetHotkey = pendingBackendHotkey;
    recordingHotkey = false;
    pendingBackendHotkey = "";

    if (targetHotkey === $tpHotkey) return;

    savingHotkey = true;
    try {
      await updateTpHotkey(targetHotkey);
      onStatus(`Hotkey updated to ${formatHotkeyDisplay(targetHotkey)}`);
    } catch {
      onStatus("Failed to register hotkey");
    } finally {
      savingHotkey = false;
    }
  }

  async function resetHotkey() {
    if (savingHotkey || $tpHotkey === DEFAULT_HOTKEY) return;
    recordingHotkey = false;
    pendingBackendHotkey = "";
    savingHotkey = true;
    try {
      await updateTpHotkey(DEFAULT_HOTKEY);
      onStatus(`Hotkey reset to ${formatHotkeyDisplay(DEFAULT_HOTKEY)}`);
    } catch {
      onStatus("Failed to reset hotkey");
    } finally {
      savingHotkey = false;
    }
  }

  function handleBgFileSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        canvasBgPath.set(reader.result);
        onStatus("Background image updated");
      }
    };
    reader.onerror = () => {
      onStatus("Failed to read image file");
    };
    reader.readAsDataURL(file);
    input.value = "";
  }

  function clearBgImage() {
    canvasBgPath.set("");
    onStatus("Background image cleared");
  }

  let soundFileInput: HTMLInputElement | undefined = $state();

  function handleSoundFileSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      onStatus("Selected file is not an audio file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        liveSoundCustomData.set(reader.result);
      }
      if (typeof reader.result === "string") {
        liveSoundCustomData.set(reader.result);
        liveSoundCustomName.set(file.name);
        onStatus(`Live blip set to ${file.name}`);
        previewLiveBlip();
      }
    };
    reader.onerror = () => onStatus("Failed to read sound file");
    reader.readAsDataURL(file);
  }

  function resetLiveSound() {
    liveSoundCustomData.set("");
    liveSoundCustomName.set("");
    onStatus("Live blip reset to default");
  }
  function clampGain(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    let v = parseFloat(el.value.replace(",", "."));
    if (!Number.isFinite(v)) v = $liveSoundGainDb; // invalid input: keep previous value
    v = Math.min(96, Math.max(-96, v));
    liveSoundGainDb.set(v);
    el.value = String(v);
  }

  function gainKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
  }
</script>

<!-- Checkboxes -->
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

<label class="pb-check">
  <input type="checkbox" bind:checked={$showTooltips} />
  <span class="pb-box"></span>
  <span class="pb-check-text">Show tooltips</span>
</label>

<label class="pb-check">
  <input type="checkbox" bind:checked={$compactMercenaryDisplay} />
  <span class="pb-box"></span>
  <span class="pb-check-text">Compact mercenary display</span>
</label>
<label class="pb-check">
  <input type="checkbox" bind:checked={$liveSoundEnabled} />
  <span class="pb-box"></span>
  <span class="pb-check-text">Livesearch blip</span>
</label>
<label class="pb-check">
  <input
    type="checkbox"
    bind:checked={() => !$doubleTitle, (v) => ($doubleTitle = !v)}
  />
  <span class="pb-box"></span>
  <span class="pb-check-text">Compact Item Names</span>
</label>

<div class="st-form-grid">
  <div class="st-grid-row">
    <label class="pb-check-text" for="telemetry-select">Frame Style</label>
    <div class="st-col-control">
      <select id="telemetry-select" class="st-select" bind:value={$styleType}>
        <option value={null} disabled hidden></option>
        <option value={0}>Simple</option>
        <option value={1}>Styled</option>
      </select>
    </div>
  </div>

  <!-- Language -->
  <div class="st-grid-row">
    <label class="pb-check-text" for="language-select">Language</label>
    <div class="st-col-control">
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
  </div>

  <!-- Telemetry -->
  <div class="st-grid-row">
    <label class="pb-check-text" for="telemetry-select">Telemetry</label>
    <div class="st-col-control">
      <select
        id="telemetry-select"
        class="st-select"
        value={$telemetryLevel === null ? "" : String($telemetryLevel)}
        onchange={handleTelemetryChange}
      >
        <option value="" disabled hidden></option>
        <option value="0">None</option>
        <option value="1">Basic</option>
      </select>
    </div>
  </div>
  <!-- Teleport Hotkey -->
  <div class="st-grid-row">
    <label class="pb-check-text" for="tp-hotkey-box">Teleport Hotkey</label>
    <div class="st-col-control">
      <button
        id="tp-hotkey-box"
        type="button"
        class="st-select st-hotkey-box"
        class:recording={recordingHotkey}
        onclick={startRecordingHotkey}
        onblur={cancelRecordingHotkey}
        onkeydown={handleHotkeyKeydown}
        onkeyup={handleHotkeyKeyup}
        disabled={savingHotkey}
        title="Click and press keys to bind shortcut"
      >
        {#if recordingHotkey}
          {pendingBackendHotkey
            ? formatHotkeyDisplay(pendingBackendHotkey)
            : "Press keys…"}
        {:else}
          {formatHotkeyDisplay($tpHotkey)}
        {/if}
      </button>
      <button
        type="button"
        class="st-btn"
        onclick={resetHotkey}
        disabled={savingHotkey || $tpHotkey === DEFAULT_HOTKEY}
      >
        Reset
      </button>
    </div>
  </div>
  <!-- Live search blip -->
  <div class="st-grid-row">
    <span class="pb-check-text">Livesearch Blip</span>
    <div class="st-col-control">
      <input
        bind:this={soundFileInput}
        type="file"
        accept="audio/*"
        style="display: none;"
        onchange={handleSoundFileSelect}
      />
      <span class="pb-check-text st-file-name" title={$liveSoundCustomName}>
        {$liveSoundCustomData
          ? $liveSoundCustomName || "Custom file"
          : "Default Bip"}
      </span>
      <button
        type="button"
        class="st-btn"
        onclick={() => soundFileInput?.click()}
      >
        Select…
      </button>
      {#if $liveSoundCustomData}
        <button type="button" class="st-btn" onclick={resetLiveSound}
          >Reset</button
        >
      {/if}
      <button type="button" class="st-btn" onclick={previewLiveBlip}>
        ▶ Preview
      </button>
      <button
        type="button"
        class="st-btn"
        onclick={stopLiveBlips}
        disabled={!$livePreviewPlaying}
      >
        ■ Stop
      </button>
    </div>
  </div>
  <div class="st-grid-row">
    <label class="pb-check-text" for="blip-gain-input">Blip Gain</label>
    <div class="st-col-control">
      <input
        id="blip-gain-input"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        class="st-select st-db-input"
        value={$liveSoundGainDb}
        onchange={clampGain}
        onkeydown={gainKeydown}
      />
      <span class="pb-check-text">dB</span>
    </div>
  </div>
  <!-- Background Image -->
  <div class="st-grid-row st-align-top">
    <span class="pb-check-text st-label-pad">Background Image</span>
    <div class="st-col-stack">
      <div class="st-col-control">
        <input
          bind:this={fileInput}
          type="file"
          accept="image/*"
          style="display: none;"
          onchange={handleBgFileSelect}
        />
        <button type="button" class="st-btn" onclick={() => fileInput?.click()}>
          {$canvasBgPath ? "Change Image" : "Select Image"}
        </button>
        {#if $canvasBgPath}
          <button type="button" class="st-btn" onclick={clearBgImage}>
            Clear
          </button>
        {/if}
      </div>

      {#if $canvasBgPath}
        <div class="st-bg-preview-wrap">
          <img
            src={$canvasBgPath}
            alt="Background preview"
            class="st-bg-preview"
          />
        </div>
      {/if}
    </div>
  </div>

  <!-- Background Opacity -->
  <div class="st-grid-row">
    <label class="pb-check-text" for="bg-opacity-slider">
      Background Opacity
    </label>
    <div class="st-col-control">
      <input
        id="bg-opacity-slider"
        type="range"
        class="st-slider"
        min="0"
        max="1"
        step="0.01"
        bind:value={$canvasBgOpacity}
        onpointerdown={() => setSliderHolding(true)}
        onpointerup={() => setSliderHolding(false)}
        onpointercancel={() => setSliderHolding(false)}
        onkeydown={() => setSliderHolding(true)}
        onkeyup={() => setSliderHolding(false)}
        onblur={() => setSliderHolding(false)}
      />
      <span class="pb-check-text st-slider-val">
        {Math.round($canvasBgOpacity * 100)}%
      </span>
    </div>
  </div>
</div>

<!-- Image Cache -->
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

<style>
  /* 2-column compact layout where column 1 hugs the longest label */
  .st-form-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 18px;
    row-gap: 10px;
    align-items: center;
    margin-bottom: 12px;
  }

  .st-grid-row {
    display: contents;
  }

  .st-align-top > .st-label-pad {
    align-self: start;
    padding-top: 6px;
  }

  .st-col-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .st-col-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  /* Hotkey capture box */
  .st-hotkey-box {
    min-width: 140px;
    text-align: center;
    cursor: pointer;
    user-select: none;
    font-family: inherit;
  }

  .st-hotkey-box.recording {
    outline: 1px solid rgba(255, 255, 255, 0.45);
    opacity: 0.9;
  }

  /* Small background image thumbnail */
  .st-bg-preview-wrap {
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 4px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.35);
    display: inline-flex;
  }

  .st-bg-preview {
    max-width: 140px;
    max-height: 78px;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 2px;
    display: block;
  }

  /* Range slider matching dark UI aesthetic */
  .st-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 150px;
    height: 6px;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }
  .st-db-input {
    width: 70px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .st-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    background: #d8d8d8;
    border: 1px solid rgba(0, 0, 0, 0.6);
    cursor: grab;
    transition:
      background 0.12s ease,
      transform 0.1s ease;
  }

  .st-slider::-webkit-slider-thumb:hover {
    background: #ffffff;
  }

  .st-slider:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: scale(1.06);
  }

  .st-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    background: #d8d8d8;
    border: 1px solid rgba(0, 0, 0, 0.6);
    cursor: grab;
    transition:
      background 0.12s ease,
      transform 0.1s ease;
  }

  .st-slider-val {
    min-width: 38px;
    font-variant-numeric: tabular-nums;
  }
</style>
