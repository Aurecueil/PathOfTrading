<!-- src/lib/CanvasToolbar.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ToolType } from "$lib/types/types";

  export let activeTool: ToolType = "move";
  export let snapToGrid: boolean = true;
  export let isLocked: boolean = false;
  export let gridSize: number = 40;

  const dispatch = createEventDispatcher<{
    addtile: void;
  }>();

  function blurTarget(e: Event) {
    (e.currentTarget as HTMLElement)?.blur();
  }
</script>

<div class="toolbar" on:pointerdown|stopPropagation>
  <button
    type="button"
    class="btn-primary"
    on:click={(e) => {
      blurTarget(e);
      dispatch("addtile");
    }}
  >
    + Add Tile
  </button>

  <select
    class="tool-select"
    bind:value={activeTool}
    on:change={blurTarget}
    aria-label="Canvas Tool Selector"
    title="Select Canvas Tool"
  >
    <option value="move">✥ Move / Select</option>
    <option value="title">T Title</option>
    <option value="richtext">¶ Rich Textbox</option>
    <option value="arrow">↗ Arrow</option>
    <option value="box">▭ Box</option>
    <option value="circle">◯ Circle</option>
  </select>

  <button
    type="button"
    class:active={snapToGrid}
    on:click={(e) => {
      snapToGrid = !snapToGrid;
      blurTarget(e);
    }}
  >
    Snap: {snapToGrid ? `GRID (${gridSize}px)` : "FREE"}
  </button>

  <button
    type="button"
    class="icon-square-btn"
    class:locked={isLocked}
    on:click={(e) => {
      isLocked = !isLocked;
      blurTarget(e);
    }}
    title={isLocked
      ? "Canvas Locked (Click to unlock)"
      : "Canvas Unlocked (Click to lock)"}
    aria-label="Toggle Canvas Lock"
  >
    {#if isLocked}
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="11" width="18" height="11" rx="0" ry="0" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    {:else}
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="11" width="18" height="11" rx="0" ry="0" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </svg>
    {/if}
  </button>
</div>

<style>
  .toolbar {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: #050505;
    padding: 4px;
    border-radius: 0px;
    border: 1px solid #777777;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.85);
  }

  .tool-select {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    height: 26px;
    background: #000000;
    color: #ffffff;
    border: 1px solid #7f7f7f;
    padding: 0 6px;
    border-radius: 0px;
    cursor: pointer;
    outline: none;
    box-sizing: border-box;
  }

  .tool-select:hover,
  .tool-select:focus {
    border-color: #ffffff;
  }

  .tool-select option {
    background-color: #000000;
    color: #ffffff;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
  }

  button {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    height: 26px;
    background: #000000;
    color: #ffffff;
    border: 1px solid #7f7f7f;
    padding: 0 8px;
    border-radius: 0px;
    cursor: pointer;
    outline: none;
    transition:
      background 0.1s ease,
      border-color 0.1s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  button:hover,
  button:focus {
    border-color: #ffffff;
    background: #111111;
  }

  button.active {
    background: #111111;
    color: #55ff55;
    border-color: #ffffff;
  }

  button.active:hover {
    background: #1a1a1a;
  }

  .btn-primary {
    background: #000000;
    border-color: #7f7f7f;
    color: #ffffff;
  }

  .btn-primary:hover {
    background: #111111;
    border-color: #ffffff;
  }

  .icon-square-btn {
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 0px;
  }

  .icon-square-btn.locked {
    background: #000000;
    color: #ff5555;
    border-color: #ff5555;
  }

  .icon-square-btn.locked:hover {
    background: #220000;
    border-color: #ff5555;
  }
</style>
