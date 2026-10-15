<!-- src/lib/layout/TitleBar.svelte -->
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { requestExitApp } from "$lib/project/projects.svelte";

  function onTitlebarMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    invoke("window_start_dragging").catch(() => {});
  }

  function onTitlebarDblClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    invoke("window_toggle_maximize").catch(() => {});
  }

  async function handleMinimizeWindow() {
    try {
      await invoke("window_minimize");
    } catch {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    }
  }

  async function handleMaximizeWindow() {
    try {
      await invoke("window_toggle_maximize");
    } catch {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="titlebar-row"
  data-tauri-drag-region
  onmousedown={onTitlebarMouseDown}
  ondblclick={onTitlebarDblClick}
>
  <div class="brand-group" data-tauri-drag-region>
    <img src="/favicon.png" alt="" class="app-icon" />
    <span class="app-brand" data-tauri-drag-region>Path of Trading</span>
  </div>

  <div class="window-controls">
    <button
      type="button"
      class="win-btn"
      title="Minimize"
      onclick={handleMinimizeWindow}
    >
      ─
    </button>
    <button
      type="button"
      class="win-btn"
      title="Maximize / Restore"
      onclick={handleMaximizeWindow}
    >
      ☐
    </button>
    <button
      type="button"
      class="win-btn win-close"
      title="Exit Path of Trading"
      onclick={requestExitApp}
    >
      ×
    </button>
  </div>
</div>

<style>
  :global(*) {
    font-family: "Fontin", sans-serif !important;
    box-sizing: border-box;
  }

  .titlebar-row {
    height: 29px;
    min-height: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 8px;
    background: #000000;
    border-bottom: none;
    box-sizing: border-box;
    user-select: none;
  }

  .brand-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .app-icon {
    width: 17px;
    height: 17px;
    object-fit: contain;
    pointer-events: none;
  }

  .app-brand {
    font-family: "Fontin", sans-serif;
    font-size: 13px;
    color: #e0e0e0;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }

  .window-controls {
    display: flex;
    align-items: stretch;
    height: 100%;
    margin-left: auto;
    flex-shrink: 0;
  }

  .win-btn {
    font-family: "Fontin", sans-serif;
    width: 36px;
    height: 100%;
    background: transparent;
    border: none;
    border-radius: 0px;
    outline: none;
    box-shadow: none;
    color: #d3d3d3;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }

  .win-btn:hover {
    background-color: #2a2a2a;
    color: #ffffff;
  }

  .win-btn.win-close {
    font-size: 15px;
  }

  .win-btn.win-close:hover {
    background-color: #330000;
    color: #ff3333;
  }
</style>
