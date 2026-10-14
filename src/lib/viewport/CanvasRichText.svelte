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

  let editing = false;

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

  function finishEditing() {
    editing = false;
  }

  function onTextareaKeyDown(e: KeyboardEvent) {
    e.stopPropagation();
    // Enter submits, Shift+Enter makes a new line
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      finishEditing();
    } else if (e.key === "Escape") {
      e.preventDefault();
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
  class="richtext-root"
  class:selected={selected || editing}
  style:transform="translate({item.x}px, {item.y}px)"
  style:width="{item.w}px"
  style:height="{item.h}px"
  on:pointerdown={onPointerDown}
  on:dblclick={onDoubleClick}
  on:wheel|stopPropagation
>
  {#if editing}
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
    background: #161923;
    border: 1px solid #2c3345;
    border-radius: 6px;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    cursor: move;
    user-select: none;
    overflow: visible;
  }
  .richtext-root.selected {
    border-color: #3a57e8;
    box-shadow: 0 0 0 2px rgba(58, 87, 232, 0.4);
  }
  .rt-textarea {
    width: 100%;
    height: 100%;
    flex: 1;
    resize: none;
    background: transparent;
    color: #e2e8f0;
    border: none;
    padding: 0.45rem;
    margin: 0;
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
    outline: none;
    box-sizing: border-box;
  }
  .rt-rendered {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0.45rem;
    overflow-y: auto;
    font-size: 0.85rem;
    color: #e2e8f0;
    line-height: 1.45;
    word-break: break-word;
  }
  .rt-rendered :global(h1),
  .rt-rendered :global(h2),
  .rt-rendered :global(h3) {
    margin: 0 0 0.35rem;
    color: #f8fafc;
  }
  .rt-rendered :global(code) {
    background: #0f131c;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
  }
  .rt-rendered :global(pre) {
    background: #0f131c;
    padding: 0.4rem;
    border-radius: 4px;
    overflow-x: auto;
    margin: 0.25rem 0;
  }
  .rt-rendered :global(blockquote) {
    margin: 0.25rem 0;
    padding-left: 0.6rem;
    border-left: 3px solid #3a57e8;
    color: #94a3b8;
  }
  .rt-rendered :global(ul) {
    margin: 0.25rem 0;
    padding-left: 1.2rem;
  }
  .rt-rendered :global(a) {
    color: #60a5fa;
  }
  .rt-rendered :global(.empty-hint) {
    color: #64748b;
    font-style: italic;
  }
  .edge,
  .corner {
    position: absolute;
    z-index: 25;
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
