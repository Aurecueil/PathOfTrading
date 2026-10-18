<!-- src/lib/components/item/ItemJsonModal.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";

  export let isOpen: boolean = false;
  export let rawData: any = null;
  export let title: string = "";
  export let onClose: () => void;

  let copied = false;
  let closeBtn: HTMLButtonElement | undefined;
  let tooltipEl: HTMLDivElement | undefined;
  let collapsedPaths = new Set<string>();

  // Hover image preview state for https:// links
  let hoveredUrl: string | null = null;
  let mouseX = 0;
  let mouseY = 0;
  let previewX = 0;
  let previewY = 0;
  let previewError = false;

  interface JsonLine {
    lineNo: number;
    indent: number;
    key?: string;
    valueType:
      | "object-start"
      | "object-end"
      | "array-start"
      | "array-end"
      | "object-empty"
      | "array-empty"
      | "string"
      | "number"
      | "boolean"
      | "null";
    rawValue?: string;
    stringValue?: string;
    rawUnescapedString?: string;
    comma: boolean;
    blockId?: string;
    blockEndLine?: number;
    itemCount?: number;
  }

  /** Mounts the element directly on document.body so parent transforms/scrolls can't offset it */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      },
    };
  }

  // Derive clean item name from rawData (e.g., PoE item name/typeLine) or strip prefix from title
  $: displayTitle =
    rawData?.item?.name && rawData?.item?.typeLine
      ? `${rawData.item.name} ${rawData.item.typeLine}`.trim()
      : rawData?.name && rawData?.typeLine
        ? `${rawData.name} ${rawData.typeLine}`.trim()
        : rawData?.item?.typeLine ||
          rawData?.typeLine ||
          rawData?.item?.name ||
          rawData?.name ||
          title.replace(/^Raw Item JSON\s*[-—:]?\s*/i, "").trim() ||
          "Item";

  $: formattedJson = rawData ? JSON.stringify(rawData, null, 2) : "{}";

  // Only build the AST line model while the modal is open
  $: lines = isOpen && rawData ? buildJsonLines(rawData) : [];

  // Default-collapse elements with depth >= 2 whenever lines are rebuilt
  $: if (lines.length > 0) {
    const initialCollapsed = new Set<string>();
    for (const l of lines) {
      if (l.blockId && l.indent >= 2) {
        initialCollapsed.add(l.blockId);
      }
    }
    collapsedPaths = initialCollapsed;
  } else {
    collapsedPaths = new Set<string>();
  }

  $: if (!isOpen) {
    hoveredUrl = null;
  }

  $: visibleLines = computeVisibleLines(lines, collapsedPaths);

  // Move focus into the dialog as soon as it renders
  $: if (isOpen && closeBtn) queueMicrotask(() => closeBtn?.focus());

  function escapeStringContent(str: string): string {
    return JSON.stringify(str).slice(1, -1);
  }

  function isPlainField(key?: string): boolean {
    if (!key) return false;
    const lower = key.toLowerCase();
    return lower === "name" || lower === "typeline";
  }

  function isHttpsUrl(val?: string): boolean {
    return typeof val === "string" && val.startsWith("https://");
  }

  async function handleLinkClick(url?: string) {
    if (!url) return;
    try {
      await invoke("open_external_url", { url });
    } catch (err) {
      console.error("Failed to open external URL:", err);
    }
  }

  function handleLinkEnter(e: MouseEvent, url?: string) {
    if (!url) return;
    hoveredUrl = url;
    previewError = false;
    updatePreviewPos(e.clientX, e.clientY);
  }

  function handleLinkMove(e: MouseEvent) {
    if (!hoveredUrl) return;
    updatePreviewPos(e.clientX, e.clientY);
  }

  function handleLinkLeave() {
    hoveredUrl = null;
  }

  function updatePreviewPos(cx: number, cy: number) {
    mouseX = cx;
    mouseY = cy;

    const offset = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tipW = tooltipEl?.offsetWidth || 100;
    const tipH = tooltipEl?.offsetHeight || 100;

    let x = cx + offset;
    let y = cy + offset;

    if (x + tipW > vw - 8) {
      x = cx - tipW - offset;
    }
    if (y + tipH > vh - 8) {
      y = cy - tipH - offset;
    }

    previewX = Math.max(8, x);
    previewY = Math.max(8, y);
  }

  function buildJsonLines(data: any): JsonLine[] {
    const result: JsonLine[] = [];
    let lineCounter = 1;

    function walk(
      val: any,
      indent: number,
      path: string,
      key?: string,
      isLast: boolean = true,
    ) {
      const comma = !isLast;

      if (val === null) {
        result.push({
          lineNo: lineCounter++,
          indent,
          key,
          valueType: "null",
          rawValue: "null",
          comma,
        });
      } else if (typeof val === "boolean") {
        result.push({
          lineNo: lineCounter++,
          indent,
          key,
          valueType: "boolean",
          rawValue: String(val),
          comma,
        });
      } else if (typeof val === "number") {
        result.push({
          lineNo: lineCounter++,
          indent,
          key,
          valueType: "number",
          rawValue: String(val),
          comma,
        });
      } else if (typeof val === "string") {
        result.push({
          lineNo: lineCounter++,
          indent,
          key,
          valueType: "string",
          stringValue: escapeStringContent(val),
          rawUnescapedString: val,
          comma,
        });
      } else if (Array.isArray(val)) {
        if (val.length === 0) {
          result.push({
            lineNo: lineCounter++,
            indent,
            key,
            valueType: "array-empty",
            rawValue: "[]",
            comma,
          });
        } else {
          const startIdx = result.length;
          result.push({
            lineNo: lineCounter++,
            indent,
            key,
            valueType: "array-start",
            blockId: path,
            itemCount: val.length,
            comma: false,
          });
          for (let i = 0; i < val.length; i++) {
            walk(
              val[i],
              indent + 1,
              `${path}[${i}]`,
              undefined,
              i === val.length - 1,
            );
          }
          const endLineNo = lineCounter++;
          result[startIdx].blockEndLine = endLineNo;
          result.push({
            lineNo: endLineNo,
            indent,
            valueType: "array-end",
            comma,
          });
        }
      } else if (typeof val === "object") {
        const keys = Object.keys(val);
        if (keys.length === 0) {
          result.push({
            lineNo: lineCounter++,
            indent,
            key,
            valueType: "object-empty",
            rawValue: "{}",
            comma,
          });
        } else {
          const startIdx = result.length;
          result.push({
            lineNo: lineCounter++,
            indent,
            key,
            valueType: "object-start",
            blockId: path,
            itemCount: keys.length,
            comma: false,
          });
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            walk(
              val[k],
              indent + 1,
              `${path}.${k}`,
              escapeStringContent(k),
              i === keys.length - 1,
            );
          }
          const endLineNo = lineCounter++;
          result[startIdx].blockEndLine = endLineNo;
          result.push({
            lineNo: endLineNo,
            indent,
            valueType: "object-end",
            comma,
          });
        }
      }
    }

    walk(data, 0, "$", undefined, true);
    return result;
  }

  function computeVisibleLines(
    allLines: JsonLine[],
    collapsed: Set<string>,
  ): { line: JsonLine; isCollapsed: boolean; endComma: boolean }[] {
    const out: { line: JsonLine; isCollapsed: boolean; endComma: boolean }[] =
      [];
    let i = 0;
    while (i < allLines.length) {
      const line = allLines[i];
      if (line.blockId && collapsed.has(line.blockId) && line.blockEndLine) {
        const endIdx = line.blockEndLine - 1;
        const endComma = allLines[endIdx]?.comma ?? false;
        out.push({ line, isCollapsed: true, endComma });
        i = endIdx + 1;
      } else {
        out.push({ line, isCollapsed: false, endComma: line.comma });
        i++;
      }
    }
    return out;
  }

  function toggleFold(blockId?: string) {
    if (!blockId) return;
    const next = new Set(collapsedPaths);
    if (next.has(blockId)) {
      next.delete(blockId);
    } else {
      next.add(blockId);
    }
    collapsedPaths = next;
  }

  function expandAll() {
    collapsedPaths = new Set();
  }

  function collapseAll() {
    const next = new Set<string>();
    for (const l of lines) {
      if (l.blockId && l.blockId !== "$") {
        next.add(l.blockId);
      }
    }
    collapsedPaths = next;
  }

  async function handleCopy() {
    if (!rawData) return;
    try {
      await navigator.clipboard.writeText(formattedJson);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy JSON:", err);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      onClose();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-backdrop" on:click|self={onClose} role="presentation">
    <div
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-label={displayTitle}
    >
      <div class="modal-header">
        <div class="modal-title">
          <span class="json-icon">&#123;&nbsp;&#125;</span>
          <span class="title-text" title={displayTitle}>{displayTitle}</span>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="btn-action"
            on:click={expandAll}
            title="Expand All"
          >
            Expand All
          </button>
          <button
            type="button"
            class="btn-action"
            on:click={collapseAll}
            title="Collapse All"
          >
            Collapse All
          </button>
          <button
            type="button"
            class="btn-copy"
            class:is-copied={copied}
            on:click={handleCopy}
          >
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <button
            bind:this={closeBtn}
            type="button"
            class="btn-close"
            on:click={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="modal-body" on:scroll={handleLinkLeave}>
        <div class="json-editor" role="region" aria-label="JSON Content">
          {#each visibleLines as { line, isCollapsed, endComma } (line.lineNo)}
            <div class="json-line">
              <span class="gutter" aria-hidden="true">
                <span class="line-num">{line.lineNo}</span>
                {#if line.blockId}
                  <button
                    type="button"
                    class="fold-toggle"
                    class:is-collapsed={isCollapsed}
                    on:click={() => toggleFold(line.blockId)}
                    aria-label={isCollapsed ? "Expand block" : "Collapse block"}
                  >
                    {isCollapsed ? "▸" : "▾"}
                  </button>
                {:else}
                  <span class="fold-spacer"></span>
                {/if}
              </span>

              <span
                class="code-line"
                style="padding-left: {line.indent * 1.25}rem;"
              >
                {#if line.key !== undefined}
                  <span class="j-key">"{line.key}"</span><span class="j-punct"
                    >:
                  </span>
                {/if}

                {#if line.valueType === "string"}
                  {#if isHttpsUrl(line.rawUnescapedString)}
                    <span class="j-str"
                      >"<a
                        href={line.rawUnescapedString}
                        class="j-link"
                        on:click|preventDefault={() =>
                          handleLinkClick(line.rawUnescapedString)}
                        on:mouseenter={(e) =>
                          handleLinkEnter(e, line.rawUnescapedString)}
                        on:mousemove={handleLinkMove}
                        on:mouseleave={handleLinkLeave}>{line.stringValue}</a
                      >"</span
                    >{#if line.comma}<span class="j-punct">,</span>{/if}
                  {:else if isPlainField(line.key)}
                    <span class="j-str">"{line.stringValue}"</span
                    >{#if line.comma}<span class="j-punct">,</span>{/if}
                  {:else}
                    <span class="j-str"
                      >"<StatColorText text={line.stringValue ?? ""} />"</span
                    >{#if line.comma}<span class="j-punct">,</span>{/if}
                  {/if}
                {:else if line.valueType === "number"}
                  <span class="j-num">{line.rawValue}</span
                  >{#if line.comma}<span class="j-punct">,</span>{/if}
                {:else if line.valueType === "boolean" || line.valueType === "null"}
                  <span class="j-kw">{line.rawValue}</span>{#if line.comma}<span
                      class="j-punct">,</span
                    >{/if}
                {:else if line.valueType === "object-empty" || line.valueType === "array-empty"}
                  <span class="j-punct"
                    >{line.rawValue}{#if line.comma},{/if}</span
                  >
                {:else if line.valueType === "object-start"}
                  <span class="j-punct">&#123;</span>{#if isCollapsed}<button
                      type="button"
                      class="fold-pill"
                      on:click={() => toggleFold(line.blockId)}
                      title="Click to expand ({line.itemCount} keys)"
                      >...</button
                    ><span class="j-punct"
                      >&#125;{#if endComma},{/if}</span
                    >{/if}
                {:else if line.valueType === "array-start"}
                  <span class="j-punct">[</span>{#if isCollapsed}<button
                      type="button"
                      class="fold-pill"
                      on:click={() => toggleFold(line.blockId)}
                      title="Click to expand ({line.itemCount} items)"
                      >...</button
                    ><span class="j-punct"
                      >]{#if endComma},{/if}</span
                    >{/if}
                {:else if line.valueType === "object-end"}
                  <span class="j-punct"
                    >&#125;{#if line.comma},{/if}</span
                  >
                {:else if line.valueType === "array-end"}
                  <span class="j-punct"
                    >]{#if line.comma},{/if}</span
                  >
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  {#if hoveredUrl && !previewError}
    <div
      use:portal
      bind:this={tooltipEl}
      class="img-tooltip"
      style="left: {previewX}px; top: {previewY}px;"
      aria-hidden="true"
    >
      <img
        src={hoveredUrl}
        alt="Preview"
        on:load={() => updatePreviewPos(mouseX, mouseY)}
        on:error={() => {
          previewError = true;
        }}
      />
    </div>
  {/if}
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 3, 6, 0.78);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1.25rem;
  }

  .modal-card {
    background: #07090c;
    border: 1px solid #3a3326;
    border-top: 2px solid #8a6a2e;
    border-radius: 0;
    width: 94vw;
    min-width: 600px;
    max-width: 1360px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 18px 48px rgba(0, 0, 0, 0.85),
      0 0 0 1px #000;
    overflow: hidden;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0.85rem 0.65rem 1.1rem;
    background: linear-gradient(180deg, #17130c 0%, #0a0907 100%);
    border-bottom: 1px solid #2e281c;
    user-select: none;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    font-family: "FontinRegular", "Fontin", Georgia, serif;
    font-size: 1.1rem;
    color: #e9cf9f;
  }

  .title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .json-icon {
    color: #8a6a2e;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 700;
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-action,
  .btn-copy {
    background: #1b150a;
    border: 1px solid #453516;
    color: #c9b48b;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.3rem 0.65rem;
    border-radius: 0;
    cursor: pointer;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }

  .btn-copy {
    background: #2a1f0c;
    border-color: #5c4519;
    color: #e9cf9f;
    padding: 0.3rem 0.8rem;
  }

  .btn-action:hover,
  .btn-copy:hover {
    background: #3b2c10;
    border-color: #8a6a2e;
    color: #fff3d6;
  }

  .btn-copy.is-copied {
    border-color: #4a7a3a;
    background: #12220e;
    color: #8fd17a;
  }

  .btn-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: transparent;
    border: 1px solid transparent;
    color: #8a8372;
    cursor: pointer;
    padding: 0;
    transition:
      color 0.12s ease,
      border-color 0.12s ease;
  }

  .btn-close svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .btn-close:hover,
  .btn-close:focus-visible {
    color: #ff6b6b;
    border-color: #4a2020;
    outline: none;
  }

  .modal-body {
    padding: 0.75rem 0;
    overflow: auto;
    background: #040507;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    scrollbar-width: thin;
    scrollbar-color: #3a3326 transparent;
    user-select: text;
    -webkit-user-select: text;
  }

  .json-editor {
    --line-h: 1.36rem;
    font-size: 0.88rem;
    line-height: var(--line-h);
    color: #8b949e;
    min-width: min-content;
  }

  .json-line {
    display: flex;
    align-items: flex-start;
    padding: 0 1rem 0 0.5rem;
  }

  .json-line:hover {
    background: rgba(233, 207, 159, 0.04);
  }

  /* Gutter (Line numbers + Fold chevron) - Excluded from text selection */
  .gutter {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    width: 3.6rem;
    height: var(--line-h);
    padding-right: 0.4rem;
    flex-shrink: 0;
    user-select: none;
    -webkit-user-select: none;
    color: #4b463b;
  }

  .line-num {
    font-size: 0.76rem;
    line-height: var(--line-h);
    font-variant-numeric: tabular-nums;
    text-align: right;
    min-width: 1.9rem;
  }

  .fold-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--line-h);
    height: var(--line-h);
    margin-left: 0.15rem;
    padding: 0;
    background: transparent;
    border: none;
    color: #7c715a;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.75;
    flex-shrink: 0;
    transition:
      opacity 0.1s ease,
      color 0.1s ease;
  }

  .fold-toggle:hover,
  .fold-toggle.is-collapsed {
    opacity: 1;
    color: #e9cf9f;
  }

  .fold-spacer {
    display: inline-block;
    width: var(--line-h);
    height: var(--line-h);
    margin-left: 0.15rem;
    flex-shrink: 0;
  }

  .code-line {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
    -webkit-user-select: text;
  }

  .fold-pill {
    display: inline-flex;
    align-items: center;
    background: #1f1910;
    border: 1px solid #5c4519;
    color: #e9cf9f;
    font-family: inherit;
    font-size: 0.75rem;
    line-height: 1;
    padding: 0.05rem 0.4rem;
    margin: 0 0.25rem;
    cursor: pointer;
    user-select: none;
    vertical-align: middle;
  }

  .fold-pill:hover {
    background: #3b2c10;
    border-color: #8a6a2e;
  }

  /* Syntax colors */
  .j-key {
    color: #e9cf9f;
  }
  .j-str {
    color: #9fc27a;
  }
  .j-num {
    color: #7fb4ff;
  }
  .j-kw {
    color: #cf8ee8;
  }
  .j-punct {
    color: #7d8590;
  }

  .j-link {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: rgba(159, 194, 122, 0.45);
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .j-link:hover {
    color: #c5e89e;
    text-decoration-color: #c5e89e;
  }

  /* Portaled directly to document.body so clientX / clientY are 1:1 with the cursor */
  .img-tooltip {
    position: fixed;
    z-index: 99999;
    background: #07090c;
    border: 1px solid #8a6a2e;
    padding: 0.35rem;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.9);
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 240px;
    max-height: 240px;
  }

  .img-tooltip img {
    display: block;
    max-width: 224px;
    max-height: 224px;
    width: auto;
    height: auto;
    object-fit: contain;
  }
</style>
