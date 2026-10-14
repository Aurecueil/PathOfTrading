<!-- src/lib/CanvasTitle.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import type { CanvasAnnotation } from "$lib/types/types";

  export let item: CanvasAnnotation;
  export let scale: number = 1;
  export let snapToGrid: boolean = true;
  export let gridSize: number = 40;
  export let selected: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { shiftKey: boolean };
    dragstart: void;
    dragmove: { dx: number; dy: number };
    dragend: void;
    change: void;
  }>();

  type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  const MIN_W = 60;
  const MIN_H = 24;

  let editing = false;

  onMount(() => {
    if (item.autoEdit) {
      editing = true;
      item.autoEdit = false;
    }
  });

  function autofocus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function snap(val: number): number {
    return snapToGrid ? Math.round(val / gridSize) * gridSize : Math.round(val);
  }

  $: fontSize = Math.max(14, Math.round(item.h * 0.65));
  $: fontWeight = Math.min(900, 300 + item.thickness * 75);
  $: strokeWidth = item.thickness > 5 ? (item.thickness - 5) * 0.45 : 0;

  function onTextPointerDown(e: PointerEvent) {
    if (editing || e.button !== 0) return;
    e.stopPropagation();
    (document.activeElement as HTMLElement)?.blur();

    dispatch("select", { shiftKey: e.shiftKey });
    dispatch("dragstart");

    const startX = e.clientX;
    const startY = e.clientY;

    function onPointerMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      dispatch("dragmove", { dx, dy });
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dispatch("dragend");
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onDoubleClick(e: MouseEvent) {
    e.stopPropagation();
    dispatch("change");
    editing = true;
  }

  function finishEditing() {
    editing = false;
    if (!item.text?.trim()) {
      item.text = "Title";
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Enter" || e.key === "Escape") {
      finishEditing();
    }
  }

  function onResizePointerDown(e: PointerEvent, dir: ResizeDirection) {
    if (e.button !== 0) return;
    e.stopPropagation();
    dispatch("change");

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = item.x;
    const initY = item.y;
    const initW = item.w;
    const initH = item.h;

    const rightEdge = initX + initW;
    const bottomEdge = initY + initH;

    function onPointerMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;

      let nextX = initX;
      let nextY = initY;
      let nextW = initW;
      let nextH = initH;

      if (dir.includes("e")) nextW = Math.max(MIN_W, snap(initW + dx));
      else if (dir.includes("w")) {
        let targetLeft = snap(initX + dx);
        if (rightEdge - targetLeft < MIN_W) targetLeft = rightEdge - MIN_W;
        nextX = targetLeft;
        nextW = rightEdge - targetLeft;
      }

      if (dir.includes("s")) nextH = Math.max(MIN_H, snap(initH + dy));
      else if (dir.includes("n")) {
        let targetTop = snap(initY + dy);
        if (bottomEdge - targetTop < MIN_H) targetTop = bottomEdge - MIN_H;
        nextY = targetTop;
        nextH = bottomEdge - targetTop;
      }

      item.x = nextX;
      item.y = nextY;
      item.w = nextW;
      item.h = nextH;
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="title-root"
  class:selected={selected || editing}
  style:transform="translate({item.x}px, {item.y}px)"
  style:width="{item.w}px"
  style:height="{item.h}px"
>
  {#if editing || selected}
    <div
      class="style-popover"
      on:pointerdown|stopPropagation
      on:mousedown|preventDefault
    >
      <label title="Text Color">
        <span>Color</span>
        <input
          type="color"
          bind:value={item.color}
          on:change={() => dispatch("change")}
        />
      </label>
      <label title="Text Thickness">
        <span>Thickness ({item.thickness})</span>
        <input
          type="range"
          min="1"
          max="10"
          bind:value={item.thickness}
          on:change={() => dispatch("change")}
        />
      </label>
    </div>
  {/if}

  {#if editing}
    <input
      use:autofocus
      class="title-input"
      type="text"
      bind:value={item.text}
      style:font-size="{fontSize}px"
      style:font-weight={fontWeight}
      style:color={item.color}
      style:-webkit-text-stroke="{strokeWidth}px {item.color}"
      on:blur={finishEditing}
      on:keydown={onKeyDown}
      on:pointerdown|stopPropagation
    />
  {:else}
    <div
      class="title-display"
      style:font-size="{fontSize}px"
      style:font-weight={fontWeight}
      style:color={item.color}
      style:-webkit-text-stroke="{strokeWidth}px {item.color}"
    >
      <!-- Only the text span itself (plus a small 6px hit-margin around the letters) captures pointer events -->
      <span
        class="title-hit-target"
        on:pointerdown={onTextPointerDown}
        on:dblclick={onDoubleClick}
      >
        {item.text || "Title"}
      </span>
    </div>
  {/if}

  {#if selected}
    <div
      class="edge n"
      on:pointerdown={(e) => onResizePointerDown(e, "n")}
    ></div>
    <div
      class="edge s"
      on:pointerdown={(e) => onResizePointerDown(e, "s")}
    ></div>
    <div
      class="edge e"
      on:pointerdown={(e) => onResizePointerDown(e, "e")}
    ></div>
    <div
      class="edge w"
      on:pointerdown={(e) => onResizePointerDown(e, "w")}
    ></div>
    <div
      class="corner nw"
      on:pointerdown={(e) => onResizePointerDown(e, "nw")}
    ></div>
    <div
      class="corner ne"
      on:pointerdown={(e) => onResizePointerDown(e, "ne")}
    ></div>
    <div
      class="corner sw"
      on:pointerdown={(e) => onResizePointerDown(e, "sw")}
    ></div>
    <div
      class="corner se"
      on:pointerdown={(e) => onResizePointerDown(e, "se")}
    ></div>
  {/if}
</div>

<style>
  .title-root {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    pointer-events: none;
  }
  .title-root.selected {
    outline: 1.5px dashed #3a57e8;
    outline-offset: 4px;
  }
  .title-display {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    pointer-events: none;
  }
  .title-hit-target {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: move;
    pointer-events: auto;
  }
  .title-input {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    margin: 0;
    font-family: inherit;
    text-align: center;
    line-height: 1.1;
    pointer-events: auto;
  }
  .style-popover {
    position: absolute;
    top: -46px;
    left: 0;
    background: #1e222d;
    border: 1px solid #2e3444;
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 60;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
    white-space: nowrap;
    pointer-events: auto;
  }
  .style-popover label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    color: #cbd5e1;
  }
  .style-popover input[type="color"] {
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
  }
  .style-popover input[type="range"] {
    width: 75px;
    cursor: pointer;
  }
  .edge,
  .corner {
    position: absolute;
    z-index: 25;
    pointer-events: auto;
  }
  .edge.n {
    top: -5px;
    left: 6px;
    right: 6px;
    height: 10px;
    cursor: ns-resize;
  }
  .edge.s {
    bottom: -5px;
    left: 6px;
    right: 6px;
    height: 10px;
    cursor: ns-resize;
  }
  .edge.w {
    left: -5px;
    top: 6px;
    bottom: 6px;
    width: 10px;
    cursor: ew-resize;
  }
  .edge.e {
    right: -5px;
    top: 6px;
    bottom: 6px;
    width: 10px;
    cursor: ew-resize;
  }
  .corner {
    width: 10px;
    height: 10px;
    background: #3a57e8;
    border: 1px solid #fff;
    border-radius: 2px;
  }
  .corner.nw {
    top: -6px;
    left: -6px;
    cursor: nwse-resize;
  }
  .corner.ne {
    top: -6px;
    right: -6px;
    cursor: nesw-resize;
  }
  .corner.sw {
    bottom: -6px;
    left: -6px;
    cursor: nesw-resize;
  }
  .corner.se {
    bottom: -6px;
    right: -6px;
    cursor: nwse-resize;
  }
</style>
