<script lang="ts">
  import { tick } from "svelte";
  import CdnImage from "$lib/trade/components/item/CdnImage.svelte";

  type Option = { id: string; name: string; image?: string | null };

  let {
    id,
    options,
    value,
    disabled = false,
    minWidth = 140,
    onSelect,
  }: {
    id?: string;
    options: Option[];
    value: string;
    disabled?: boolean;
    minWidth?: number;
    onSelect: (id: string) => void;
  } = $props();

  let open = $state(false);
  let highlighted = $state(-1);
  let root: HTMLDivElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  let listEl: HTMLUListElement | undefined = $state();

  const selected = $derived(options.find((o) => o.id === value));

  async function scrollHighlightedIntoView() {
    await tick();
    listEl
      ?.querySelector<HTMLElement>("li.highlighted")
      ?.scrollIntoView({ block: "nearest" });
  }

  function openList() {
    if (disabled || options.length === 0) return;
    open = true;
    highlighted = Math.max(
      0,
      options.findIndex((o) => o.id === value),
    );
    scrollHighlightedIntoView();
  }

  function closeList() {
    open = false;
    highlighted = -1;
  }

  function pick(optId: string) {
    closeList();
    if (optId !== value) onSelect(optId);
  }

  function move(dir: 1 | -1) {
    const n = options.length;
    if (n === 0) return;
    highlighted = (highlighted + dir + n) % n;
    scrollHighlightedIntoView();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        openList();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (highlighted >= 0 && highlighted < options.length) {
        pick(options[highlighted].id);
      } else {
        closeList();
      }
    } else if (e.key === "Escape") {
      // Closes only the list, not the settings overlay
      e.preventDefault();
      e.stopPropagation();
      closeList();
    } else if (e.key === "Tab") {
      closeList();
    }
  }

  function handleWindowPointerDown(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) closeList();
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="cb-wrapper" bind:this={root} style="min-width: {minWidth}px;">
  <button
    {id}
    bind:this={trigger}
    type="button"
    class="cb-trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    {disabled}
    onclick={() => (open ? closeList() : openList())}
    onkeydown={handleKeydown}
  >
    {#if selected?.image}
      <CdnImage
        src={selected.image}
        alt={selected.name}
        className="cb-icon"
        loading="lazy"
      />
    {/if}
    <span class="cb-name">{selected?.name ?? value}</span>
    <span class="cb-caret" aria-hidden="true">▾</span>
  </button>

  {#if open && options.length > 0}
    <ul
      class="cb-dropdown"
      role="listbox"
      bind:this={listEl}
      onwheel={(e) => e.stopPropagation()}
    >
      {#each options as o, i (o.id)}
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <li
          role="option"
          aria-selected={o.id === value}
          class:highlighted={highlighted === i}
          class:selected={o.id === value}
          onmousedown={(e) => {
            e.preventDefault();
            pick(o.id);
          }}
          onmouseenter={() => (highlighted = i)}
        >
          {#if o.image}
            <CdnImage
              src={o.image}
              alt={o.name}
              className="cb-icon"
              loading="lazy"
            />
          {/if}
          <span class="cb-name">{o.name}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .cb-wrapper {
    position: relative;
    display: inline-block;
    z-index: 40;
  }

  .cb-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 26px;
    box-sizing: border-box;
    padding: 0 6px;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    text-align: left;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0;
    color: #ffffff;
    outline: none;
    cursor: pointer;
  }
  .cb-trigger:hover:not(:disabled),
  .cb-trigger:focus-visible,
  .cb-trigger[aria-expanded="true"] {
    border-color: #ffffff;
  }
  .cb-trigger:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .cb-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cb-caret {
    color: #888888;
    font-size: 10px;
    line-height: 1;
  }

  .cb-wrapper :global(.cb-icon) {
    width: 18px;
    height: 18px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .cb-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 100%;
    width: max-content;
    max-width: 320px;
    max-height: 260px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #000000;
    border: 1px solid #ffffff;
    border-radius: 0;
    list-style: none;
    padding: 2px 0;
    margin: 2px 0 0 0;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }
  .cb-dropdown::-webkit-scrollbar {
    width: 6px;
  }
  .cb-dropdown::-webkit-scrollbar-track {
    background: #000000;
  }
  .cb-dropdown::-webkit-scrollbar-thumb {
    background: #555555;
  }

  .cb-dropdown li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    padding: 1px 4px;
    cursor: pointer;
    color: #9a9a9a;
    background: #000000;
    white-space: nowrap;
  }
  .cb-dropdown li.selected {
    color: white;
  }
  .cb-dropdown li:hover,
  .cb-dropdown li.highlighted {
    background: #545454;
    color: #ffffff;
  }
</style>
