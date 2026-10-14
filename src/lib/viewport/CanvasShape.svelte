<!-- src/lib/CanvasShape.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
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

  function snap(val: number): number {
    return snapToGrid ? Math.round(val / gridSize) * gridSize : Math.round(val);
  }

  function onStrokePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
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

  function onResizePointerDown(e: PointerEvent, dir: ResizeDirection) {
    if (e.button !== 0) return;
    e.stopPropagation();
    dispatch("change");

    const startX = e.clientX;
    const startY = e.clientY;

    const initLeft = item.x;
    const initTop = item.y;
    const initRight = item.x + item.w;
    const initBottom = item.y + item.h;
    const initFlipX = !!item.flipX;
    const initFlipY = !!item.flipY;

    function onPointerMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;

      let left = initLeft;
      let right = initRight;
      let top = initTop;
      let bottom = initBottom;

      if (dir.includes("e")) right = snap(initRight + dx);
      if (dir.includes("w")) left = snap(initLeft + dx);
      if (dir.includes("s")) bottom = snap(initBottom + dy);
      if (dir.includes("n")) top = snap(initTop + dy);

      item.x = Math.min(left, right);
      item.y = Math.min(top, bottom);
      item.w = Math.abs(right - left);
      item.h = Math.abs(bottom - top);
      item.flipX = right < left ? !initFlipX : initFlipX;
      item.flipY = bottom < top ? !initFlipY : initFlipY;
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  $: x1 = item.flipX ? item.w : 0;
  $: y1 = item.flipY ? item.h : 0;
  $: x2 = item.flipX ? 0 : item.w;
  $: y2 = item.flipY ? 0 : item.h;
  $: hitWidth = Math.max(16, item.thickness + 12);

  // Safeguards for rect/ellipse rendering when dimensions are 0 or smaller than thickness
  $: rectX = item.w >= item.thickness ? item.thickness / 2 : item.w / 2;
  $: rectY = item.h >= item.thickness ? item.thickness / 2 : item.h / 2;
  $: rectW = Math.max(0.01, item.w - item.thickness);
  $: rectH = Math.max(0.01, item.h - item.thickness);
  $: ellipseRx = Math.max(0.01, (item.w - item.thickness) / 2);
  $: ellipseRy = Math.max(0.01, (item.h - item.thickness) / 2);
</script>

<div
  class="shape-root"
  class:selected
  style:transform="translate({item.x}px, {item.y}px)"
  style:width="{Math.max(item.w, 1)}px"
  style:height="{Math.max(item.h, 1)}px"
>
  {#if selected}
    <div class="style-popover" on:pointerdown|stopPropagation>
      <label title="Stroke Color">
        <span>Color</span>
        <input
          type="color"
          bind:value={item.color}
          on:change={() => dispatch("change")}
        />
      </label>
      <label title="Stroke Thickness">
        <span>Thickness ({item.thickness}px)</span>
        <input
          type="range"
          min="1"
          max="24"
          bind:value={item.thickness}
          on:change={() => dispatch("change")}
        />
      </label>
    </div>
  {/if}

  <svg
    class="shape-svg"
    width={Math.max(item.w, 1)}
    height={Math.max(item.h, 1)}
  >
    <defs>
      <marker
        id="arrowhead-{item.id}"
        markerWidth="8"
        markerHeight="8"
        refX="6"
        refY="4"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M 0 0 L 8 4 L 0 8 z" fill={item.color} />
      </marker>
    </defs>

    {#if item.kind === "box"}
      <rect
        x={rectX}
        y={rectY}
        width={rectW}
        height={rectH}
        fill="none"
        stroke={item.color}
        stroke-width={item.thickness}
        rx="4"
        pointer-events="none"
      />
      <!-- Hit target only on the stroke line -->
      <rect
        class="hit-stroke"
        x={rectX}
        y={rectY}
        width={rectW}
        height={rectH}
        fill="none"
        stroke="transparent"
        stroke-width={hitWidth}
        rx="4"
        pointer-events="stroke"
        on:pointerdown={onStrokePointerDown}
      />
    {:else if item.kind === "circle"}
      <ellipse
        cx={item.w / 2}
        cy={item.h / 2}
        rx={ellipseRx}
        ry={ellipseRy}
        fill="none"
        stroke={item.color}
        stroke-width={item.thickness}
        pointer-events="none"
      />
      <!-- Hit target only on the stroke line -->
      <ellipse
        class="hit-stroke"
        cx={item.w / 2}
        cy={item.h / 2}
        rx={ellipseRx}
        ry={ellipseRy}
        fill="none"
        stroke="transparent"
        stroke-width={hitWidth}
        pointer-events="stroke"
        on:pointerdown={onStrokePointerDown}
      />
    {:else if item.kind === "arrow"}
      <line
        {x1}
        {y1}
        {x2}
        {y2}
        stroke={item.color}
        stroke-width={item.thickness}
        stroke-linecap="round"
        marker-end="url(#arrowhead-{item.id})"
        pointer-events="none"
      />
      <!-- Hit target only along the arrow line -->
      <line
        class="hit-stroke"
        {x1}
        {y1}
        {x2}
        {y2}
        stroke="transparent"
        stroke-width={hitWidth}
        stroke-linecap="round"
        pointer-events="stroke"
        on:pointerdown={onStrokePointerDown}
      />
    {/if}
  </svg>

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
  .shape-root {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    user-select: none;
    overflow: visible;
    pointer-events: none;
    min-width: 1px;
    min-height: 1px;
  }
  .shape-root.selected {
    outline: 1.5px dashed #3a57e8;
    outline-offset: 2px;
  }
  .shape-svg {
    display: block;
    overflow: visible;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .hit-stroke {
    cursor: move;
    pointer-events: stroke;
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
    left: 0;
    right: 0;
    height: 10px;
    cursor: ns-resize;
  }
  .edge.s {
    bottom: -5px;
    left: 0;
    right: 0;
    height: 10px;
    cursor: ns-resize;
  }
  .edge.w {
    left: -5px;
    top: 0;
    bottom: 0;
    width: 10px;
    cursor: ew-resize;
  }
  .edge.e {
    right: -5px;
    top: 0;
    bottom: 0;
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
