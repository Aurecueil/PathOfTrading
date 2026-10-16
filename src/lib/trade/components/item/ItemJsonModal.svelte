<!-- src/lib/components/item/ItemJsonModal.svelte -->
<script lang="ts">
  import { onMount } from "svelte";

  export let isOpen: boolean = false;
  export let rawData: any = null;
  export let title: string = "Raw Item JSON";
  export let onClose: () => void;

  let copied = false;
  let closeBtn: HTMLButtonElement | undefined;

  $: formattedJson = rawData ? JSON.stringify(rawData, null, 2) : "{}";
  // Only pay for highlighting while the modal is actually visible.
  $: highlighted = isOpen ? highlight(formattedJson) : "";
  $: lineCount = isOpen ? formattedJson.split("\n").length : 0;
  $: sizeKb = isOpen ? (formattedJson.length / 1024).toFixed(1) : "0";

  // Move focus into the dialog as soon as it renders.
  $: if (isOpen && closeBtn) queueMicrotask(() => closeBtn?.focus());

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /** Tiny JSON tokenizer: keys, strings, numbers, booleans/null. */
  function highlight(json: string): string {
    return escapeHtml(json).replace(
      /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (m, str?: string, kw?: string, num?: string) => {
        if (str) {
          return str.endsWith(":")
            ? `<span class="j-key">${str.slice(0, -1)}</span>:`
            : `<span class="j-str">${str}</span>`;
        }
        if (kw) return `<span class="j-kw">${kw}</span>`;
        if (num) return `<span class="j-num">${num}</span>`;
        return m;
      },
    );
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
    <div class="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div class="modal-header">
        <div class="modal-title">
          <span class="json-icon">&#123;&nbsp;&#125;</span>
          <span class="title-text" {title}>{title}</span>
        </div>

        <div class="header-actions">
          <span class="meta">{lineCount} lines · {sizeKb} KB</span>
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

      <div class="modal-body">
        <pre><code>{@html highlighted}</code></pre>
      </div>
    </div>
  </div>
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
    padding: 1.5rem;
  }

  .modal-card {
    background: #07090c;
    border: 1px solid #3a3326;
    border-top: 2px solid #8a6a2e;
    border-radius: 0;
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
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
    padding: 0.6rem 0.75rem 0.6rem 1rem;
    background: linear-gradient(180deg, #17130c 0%, #0a0907 100%);
    border-bottom: 1px solid #2e281c;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    font-family: "FontinRegular", "Fontin", Georgia, serif;
    font-size: 1rem;
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
    gap: 0.6rem;
    flex-shrink: 0;
  }

  .meta {
    font-size: 0.72rem;
    color: #6f6755;
    font-variant-numeric: tabular-nums;
  }

  .btn-copy {
    background: #2a1f0c;
    border: 1px solid #5c4519;
    color: #e9cf9f;
    font-family: inherit;
    font-size: 0.78rem;
    padding: 0.28rem 0.75rem;
    border-radius: 0;
    cursor: pointer;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }
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
    width: 28px;
    height: 28px;
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
    width: 14px;
    height: 14px;
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
    padding: 0.9rem 1rem;
    overflow: auto;
    background: #040507;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    scrollbar-width: thin;
    scrollbar-color: #3a3326 transparent;
  }

  pre {
    margin: 0;
    font-size: 0.76rem;
    line-height: 1.5;
    color: #7d8590;
    white-space: pre-wrap;
    word-break: break-all;
    tab-size: 2;
  }
  code {
    color: inherit;
    font-family: inherit;
  }

  /* Syntax tokens (injected via {@html}, so they must be :global) */
  code :global(.j-key) {
    color: #e9cf9f;
  }
  code :global(.j-str) {
    color: #9fc27a;
  }
  code :global(.j-num) {
    color: #7fb4ff;
  }
  code :global(.j-kw) {
    color: #cf8ee8;
  }
</style>
