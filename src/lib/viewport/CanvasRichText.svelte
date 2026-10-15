<!-- src/lib/CanvasRichText.svelte -->
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
  const MIN_W = 100;
  const MIN_H = 40;
  const MIN_FONT = 8;
  const MAX_FONT = 72;

  let editing = false;

  // Ensure default fontSize is initialized
  $: if (!item.thickness) {
    item.thickness = 12;
  }

  onMount(() => {
    if (item.autoEdit) {
      editing = true;
      item.autoEdit = false;
    }
  });

  function autofocus(node: HTMLTextAreaElement) {
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }

  function snap(val: number): number {
    return snapToGrid ? Math.round(val / gridSize) * gridSize : Math.round(val);
  }

  function adjustFontSize(delta: number) {
    const current = item.thickness || 12;
    item.thickness = Math.min(MAX_FONT, Math.max(MIN_FONT, current + delta));
    dispatch("change");
  }

  function onFontSizeInput(e: Event) {
    const val = parseInt((e.currentTarget as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      item.thickness = Math.min(MAX_FONT, Math.max(MIN_FONT, val));
      dispatch("change");
    }
  }

  function renderMarkdown(raw: string): string {
    if (!raw?.trim()) {
      return "<span class='empty-hint'>Double-click to edit...</span>";
    }

    let html = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gm, "<h1>$1</h1>");
    html = html.replace(/^&gt; (.*$)/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/^---$/gm, "<hr />");
    html = html.replace(/^\s*[-*] (.*$)/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    html = html.replace(/\n/g, "<br />");

    return html;
  }

  $: renderedHtml = renderMarkdown(item.text || "");

  function onPointerDown(e: PointerEvent) {
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

  function finishEditing(e: FocusEvent) {
    // Keep editing open if focus moved to an element inside this component (like the font size input)
    const nextFocused = e.relatedTarget as HTMLElement | null;
    if (nextFocused && e.currentTarget instanceof HTMLElement) {
      const root = e.currentTarget.closest(".richtext-root");
      if (root?.contains(nextFocused)) return;
    }
    editing = false;
  }

  function onTextareaKeyDown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      editing = false;
    } else if (e.key === "Escape") {
      e.preventDefault();
      editing = false;
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
  class="richtext-root"
  class:selected={selected || editing}
  style:transform="translate({item.x}px, {item.y}px)"
  style:width="{item.w}px"
  style:height="{item.h}px"
  style:--item-font-size="{item.thickness || 12}px"
  on:pointerdown={onPointerDown}
  on:dblclick={onDoubleClick}
  on:wheel|stopPropagation
>
  {#if editing}
    <!-- Floating Font Size Control Box -->
    <div
      class="rt-toolbar"
      on:pointerdown|stopPropagation
      on:dblclick|stopPropagation
    >
      <span class="rt-toolbar-label">Size</span>
      <button
        type="button"
        class="rt-btn"
        on:pointerdown|preventDefault={() => adjustFontSize(-1)}
        title="Decrease font size"
      >
        -
      </button>
      <input
        type="number"
        class="rt-size-input"
        min={MIN_FONT}
        max={MAX_FONT}
        value={item.thickness || 12}
        on:input={onFontSizeInput}
        on:keydown|stopPropagation={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            editing = false;
          }
        }}
        on:blur={finishEditing}
      />
      <button
        type="button"
        class="rt-btn"
        on:pointerdown|preventDefault={() => adjustFontSize(1)}
        title="Increase font size"
      >
        +
      </button>
    </div>

    <textarea
      use:autofocus
      class="rt-textarea"
      bind:value={item.text}
      placeholder="Write markdown... (Enter to submit, Shift+Enter for new line)"
      on:pointerdown|stopPropagation
      on:keydown={onTextareaKeyDown}
      on:blur={finishEditing}
    ></textarea>
  {:else}
    <div class="rt-rendered">
      {@html renderedHtml}
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
  .richtext-root {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    background: #050505;
    border: 1px solid #777777;
    border-radius: 0px;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    cursor: move;
    user-select: none;
    overflow: visible;
  }

  .richtext-root.selected {
    border-color: #ffffff;
    box-shadow: none;
  }

  /* Toolbar anchored directly above the top-left corner */
  .rt-toolbar {
    position: absolute;
    top: -28px;
    left: -1px;
    height: 24px;
    background: #050505;
    border: 1px solid #ffffff;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    z-index: 30;
    box-sizing: border-box;
    font-family: "Fontin", monospace, sans-serif;
  }

  .rt-toolbar-label {
    font-size: 11px;
    color: #aaaaaa;
    margin-right: 2px;
  }

  .rt-btn {
    background: #111111;
    color: #ffffff;
    border: 1px solid #555555;
    width: 18px;
    height: 18px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
  }

  .rt-btn:hover {
    border-color: #ffffff;
    background: #222222;
  }

  .rt-size-input {
    width: 36px;
    height: 18px;
    background: #000000;
    color: #ffffff;
    border: 1px solid #555555;
    font-family: inherit;
    font-size: 11px;
    text-align: center;
    padding: 0 2px;
    outline: none;
    box-sizing: border-box;
  }

  .rt-size-input:focus {
    border-color: #ffffff;
  }

  .rt-textarea {
    width: 100%;
    height: 100%;
    flex: 1;
    resize: none;
    background: #000000;
    color: #ffffff;
    border: none;
    padding: 4px 6px;
    margin: 0;
    font-family: "Fontin", monospace, sans-serif;
    font-size: var(--item-font-size, 12px);
    line-height: 1.25;
    outline: none;
    box-sizing: border-box;
    border-radius: 0px;
  }

  .rt-rendered {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    overflow-y: auto;
    font-family: "Fontin", monospace, sans-serif;
    font-size: var(--item-font-size, 12px);
    color: #d3d3d3;
    line-height: 1.25;
    word-break: break-word;
  }

  .rt-rendered :global(h1) {
    font-size: 1.5em;
  }
  .rt-rendered :global(h2) {
    font-size: 1.25em;
  }
  .rt-rendered :global(h3) {
    font-size: 1.1em;
  }

  .rt-rendered :global(h1),
  .rt-rendered :global(h2),
  .rt-rendered :global(h3) {
    margin: 0 0 0.35rem;
    color: #e0e0e0;
    font-weight: bold;
  }

  .rt-rendered :global(code) {
    background: #111111;
    border: 1px solid #555555;
    padding: 0 3px;
    border-radius: 0px;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 0.9em;
    color: #ffffff;
  }

  .rt-rendered :global(pre) {
    background: #111111;
    border: 1px solid #555555;
    padding: 4px;
    border-radius: 0px;
    overflow-x: auto;
    margin: 0.25rem 0;
  }

  .rt-rendered :global(blockquote) {
    margin: 0.25rem 0;
    padding-left: 0.5rem;
    border-left: 3px solid #777777;
    color: #888888;
  }

  .rt-rendered :global(hr) {
    border: none;
    border-top: 1px solid #777777;
    margin: 0.5rem 0;
  }

  .rt-rendered :global(ul) {
    margin: 0.25rem 0;
    padding-left: 1.1rem;
  }

  .rt-rendered :global(a) {
    color: #66b2ff;
    text-decoration: none;
  }

  .rt-rendered :global(a:hover) {
    text-decoration: underline;
  }

  .rt-rendered :global(.empty-hint) {
    color: #888888;
    font-style: italic;
  }

  .edge,
  .corner {
    position: absolute;
    z-index: 25;
  }

  .edge.n {
    top: -5px;
    left: 4px;
    right: 4px;
    height: 10px;
    cursor: ns-resize;
  }

  .edge.s {
    top: auto;
    bottom: -5px;
    left: 4px;
    right: 4px;
    height: 10px;
    cursor: ns-resize;
  }

  .edge.w {
    left: -5px;
    top: 4px;
    bottom: 4px;
    width: 10px;
    cursor: ew-resize;
  }

  .edge.e {
    right: -5px;
    top: 4px;
    bottom: 4px;
    width: 10px;
    cursor: ew-resize;
  }

  .corner {
    width: 8px;
    height: 8px;
    background: #000000;
    border: 1px solid #ffffff;
    border-radius: 0px;
  }

  .corner.nw {
    top: -4px;
    left: -4px;
    cursor: nwse-resize;
  }

  .corner.ne {
    top: -4px;
    right: -4px;
    cursor: nesw-resize;
  }

  .corner.sw {
    bottom: -4px;
    left: -4px;
    cursor: nesw-resize;
  }

  .corner.se {
    bottom: -4px;
    right: -4px;
    cursor: nwse-resize;
  }
</style>
