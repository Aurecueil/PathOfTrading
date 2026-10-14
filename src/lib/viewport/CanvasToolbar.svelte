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
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    {:else}
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </svg>
    {/if}
  </button>
</div>

<style>
  .toolbar {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #1e222d;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid #2e3444;
  }
  .tool-select {
    background: #2b3040;
    color: #fff;
    border: 1px solid #3b4257;
    padding: 0.42rem 0.65rem;
    border-radius: 4px;
    font-size: 0.82rem;
    cursor: pointer;
    outline: none;
  }
  .tool-select:hover {
    background: #3b4257;
  }
  button {
    background: #2b3040;
    color: #fff;
    border: none;
    padding: 0.45rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.82rem;
    transition: background 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  button:hover {
    background: #3b4257;
  }
  button.active {
    background: #238636;
  }
  button.active:hover {
    background: #2ea043;
  }
  .btn-primary {
    background: #3a57e8;
  }
  .btn-primary:hover {
    background: #2d45c5;
  }
  .icon-square-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 4px;
  }
  .icon-square-btn.locked {
    background: #b91c1c;
    color: #fecaca;
  }
</style>
