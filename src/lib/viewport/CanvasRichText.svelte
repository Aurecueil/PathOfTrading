<!-- src/lib/CanvasRichText.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import type { CanvasAnnotation } from "$lib/types/types";

  export let item: CanvasAnnotation;
  export let scale: number = 1;
  export let snapToGrid: boolean = true;
  export let gridSize: number = 40;
  export let selected: boolean = false;
  export let z: number = 0;
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

  type InlineToken =
    | { type: "text"; text: string }
    | { type: "code"; text: string }
    | { type: "link"; url: string }
    | { type: "bold"; text: string }
    | { type: "italic"; text: string }
    | { type: "strike"; text: string }
    | { type: "color"; color: string; text: string };

  type Block =
    | { type: "codeblock"; text: string }
    | {
        type: "h1" | "h2" | "h3" | "subtext" | "quote" | "line";
        tokens: InlineToken[];
      }
    | { type: "list"; indent: number; marker: string; tokens: InlineToken[] };

  // Single-pass tokenizer: no HTML escaping or null-byte placeholders needed
  const INLINE_REGEX =
    /`([^`\n]+)`|(https?:\/\/[^\s<>()"]+)|<#([0-9a-fA-F]{3,8})>([^\n]*?)<(?:\/?#\3\/?|\/)>|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|~~\+?([^~\n]+)~~/g;

  function tokenizeInline(text: string): InlineToken[] {
    const tokens: InlineToken[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(INLINE_REGEX)) {
      const idx = match.index ?? 0;
      if (idx > lastIndex) {
        tokens.push({ type: "text", text: text.slice(lastIndex, idx) });
      }

      if (match[1] !== undefined) {
        tokens.push({ type: "code", text: match[1] });
      } else if (match[2] !== undefined) {
        // Strip trailing punctuation like .,;:!?) so (https://example.com) leaves ')' as text
        const cleanUrl = match[2].replace(/[.,;:!?]+$/, "");
        tokens.push({ type: "link", url: cleanUrl });
        const trailing = match[2].slice(cleanUrl.length);
        if (trailing) tokens.push({ type: "text", text: trailing });
      } else if (match[3] !== undefined) {
        tokens.push({ type: "color", color: `#${match[3]}`, text: match[4] });
      } else if (match[5] !== undefined) {
        tokens.push({ type: "bold", text: match[5] });
      } else if (match[6] !== undefined) {
        tokens.push({ type: "italic", text: match[6] });
      } else if (match[7] !== undefined) {
        tokens.push({ type: "strike", text: match[7] });
      }

      lastIndex = idx + match[0].length;
    }

    if (lastIndex < text.length) {
      tokens.push({ type: "text", text: text.slice(lastIndex) });
    }
    return tokens;
  }

  function parseBlocks(raw: string): Block[] {
    if (!raw?.trim()) return [];

    const lines = raw.replace(/\r\n?/g, "\n").split("\n");
    const blocks: Block[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          blocks.push({ type: "codeblock", text: codeBuffer.join("\n") });
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      const heading = line.match(/^(#{1,3}|-#) (.*)$/);
      if (heading) {
        const [, prefix, content] = heading;
        const type =
          prefix === "-#"
            ? "subtext"
            : (`h${prefix.length}` as "h1" | "h2" | "h3");
        blocks.push({ type, tokens: tokenizeInline(content) });
        continue;
      }

      const quote = line.match(/^> ?(.*)$/);
      if (quote) {
        blocks.push({ type: "quote", tokens: tokenizeInline(quote[1]) });
        continue;
      }

      const list = line.match(/^( *)(?:([-*])|(\d+\.)) (.*)$/);
      if (list) {
        blocks.push({
          type: "list",
          indent: Math.min(10, Math.floor(list[1].length / 2)),
          marker: list[2] ? "•" : list[3],
          tokens: tokenizeInline(list[4]),
        });
        continue;
      }

      blocks.push({ type: "line", tokens: tokenizeInline(line) });
    }

    // If a ``` block was left unclosed, still render its contents safely
    if (inCodeBlock && codeBuffer.length) {
      blocks.push({ type: "codeblock", text: codeBuffer.join("\n") });
    }

    return blocks;
  }

  $: blocks = parseBlocks(item.text || "");

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
  style:z-index={z}
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
      on:blur={finishEditing}></textarea>
  {:else}
    <div class="rt-rendered">
      {#if blocks.length === 0}
        <span class="empty-hint">Double-click to edit...</span>
      {:else}
        {#each blocks as block}
          {#if block.type === "codeblock"}
            <pre><code>{block.text}</code></pre>
          {:else if block.type === "list"}
            <div
              class="rt-list-item"
              style:padding-left="{block.indent * 1.25}em"
            >
              <span class="rt-list-marker">{block.marker}</span>
              <span class="rt-list-content">
                {#each block.tokens as t}
                  {#if t.type === "link"}<a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      on:pointerdown|stopPropagation>{t.url}</a
                    >
                  {:else if t.type === "code"}<code>{t.text}</code>
                  {:else if t.type === "bold"}<strong>{t.text}</strong>
                  {:else if t.type === "italic"}<em>{t.text}</em>
                  {:else if t.type === "strike"}<del>{t.text}</del>
                  {:else if t.type === "color"}<span style:color={t.color}
                      >{t.text}</span
                    >
                  {:else}{t.text}{/if}
                {/each}
              </span>
            </div>
          {:else}
            <svelte:element
              this={block.type === "h1"
                ? "h1"
                : block.type === "h2"
                  ? "h2"
                  : block.type === "h3"
                    ? "h3"
                    : block.type === "quote"
                      ? "blockquote"
                      : "div"}
              class:rt-subtext={block.type === "subtext"}
            >
              {#each block.tokens as t}
                {#if t.type === "link"}<a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    on:pointerdown|stopPropagation>{t.url}</a
                  >
                {:else if t.type === "code"}<code>{t.text}</code>
                {:else if t.type === "bold"}<strong>{t.text}</strong>
                {:else if t.type === "italic"}<em>{t.text}</em>
                {:else if t.type === "strike"}<del>{t.text}</del>
                {:else if t.type === "color"}<span style:color={t.color}
                    >{t.text}</span
                  >
                {:else}{t.text}{/if}
              {/each}
            </svelte:element>
          {/if}
        {/each}
      {/if}
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

  .rt-rendered :global(.rt-subtext) {
    font-size: 0.8em;
    color: #888888;
    margin: 0 0 0.25rem;
    line-height: 1.2;
  }

  .rt-rendered :global(code) {
    background: #111111;
    border: 1px solid #555555;
    padding: 0 3px;
    border-radius: 0px;
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

  .rt-rendered :global(pre code) {
    border: none;
    padding: 0;
    background: transparent;
  }

  .rt-rendered :global(blockquote) {
    margin: 0.25rem 0;
    padding-left: 0.5rem;
    border-left: 3px solid #777777;
    color: #888888;
  }

  .rt-rendered :global(.rt-list-item) {
    display: flex;
    align-items: baseline;
    gap: 0.4em;
    margin: 0.1rem 0;
  }

  .rt-rendered :global(.rt-list-marker) {
    color: #aaaaaa;
    flex-shrink: 0;
    user-select: none;
  }

  .rt-rendered :global(.rt-list-content) {
    flex: 1;
    min-width: 0;
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
