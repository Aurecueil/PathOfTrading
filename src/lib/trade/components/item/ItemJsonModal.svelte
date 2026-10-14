<!-- src/lib/components/item/ItemJsonModal.svelte -->
<script lang="ts">
  import { onMount } from "svelte";

  export let isOpen: boolean = false;
  export let rawData: any = null;
  export let title: string = "Raw Item JSON";
  export let onClose: () => void;

  let copied = false;

  $: formattedJson = rawData ? JSON.stringify(rawData, null, 2) : "{}";

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
  <!-- Backdrop -->
  <div class="modal-backdrop" on:click|self={onClose} role="presentation">
    <div class="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <!-- Header -->
      <div class="modal-header">
        <div class="modal-title">
          <span class="json-icon">&#123;&nbsp;&#125;</span>
          <span>{title}</span>
        </div>

        <div class="header-actions">
          <button type="button" class="btn-copy" on:click={handleCopy}>
            {#if copied}
              ✓ Copied
            {:else}
              Copy JSON
            {/if}
          </button>
          <button
            type="button"
            class="btn-close"
            on:click={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- JSON Viewer -->
      <div class="modal-body">
        <pre><code>{formattedJson}</code></pre>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 7, 13, 0.75);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1.5rem;
  }

  .modal-card {
    background: #0f131a;
    border: 1px solid #293244;
    border-radius: 6px;
    width: 100%;
    max-width: 780px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.8),
      0 8px 10px -6px rgba(0, 0, 0, 0.8);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: #141924;
    border-bottom: 1px solid #232a3b;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
  }

  .json-icon {
    color: #38bdf8;
    font-family: monospace;
    font-weight: 700;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-copy {
    background: #1e293b;
    border: 1px solid #334155;
    color: #e2e8f0;
    font-size: 0.72rem;
    padding: 0.25rem 0.6rem;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-copy:hover {
    background: #334155;
    color: #38bdf8;
    border-color: #475569;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.25rem 0.4rem;
    border-radius: 3px;
    transition: color 0.15s ease;
  }

  .btn-close:hover {
    color: #ef4444;
  }

  .modal-body {
    padding: 1rem;
    overflow: auto;
    background: #090c12;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }

  pre {
    margin: 0;
    font-size: 0.76rem;
    line-height: 1.45;
    color: #94a3b8;
    white-space: pre-wrap;
    word-break: break-all;
  }

  code {
    color: #38bdf8;
  }
</style>
