<!-- src/lib/trade/components/drawer/SelectDropdown.svelte -->
<!-- Custom (non-native) select: same look & behaviour as the filter drawer's
     option dropdowns (FilterRow / top bar triggers). -->
<script lang="ts">
  import { tick } from "svelte";

  type Option = { id: string; text: string };

  let {
    options,
    value = $bindable(""),
    onchange,
    disabled = false,
    id,
    ariaLabel,
    title,
    width = "100%",
    height = "26px",
  }: {
    options: Option[];
    value?: string;
    onchange?: (value: string) => void;
    disabled?: boolean;
    id?: string;
    ariaLabel?: string;
    title?: string;
    width?: string;
    height?: string;
  } = $props();

  let isOpen = $state(false);
  let highlighted = $state(-1);
  let openUp = $state(false);
  let placed = $state(false);
  let rootEl = $state<HTMLDivElement>();
  let menuEl = $state<HTMLUListElement>();

  const selected = $derived(options.find((o) => o.id === value));

  $effect(() => {
    if (disabled) isOpen = false;
  });

  async function openMenu() {
    if (disabled) return;
    isOpen = true;
    placed = false;
    highlighted = Math.max(
      0,
      options.findIndex((o) => o.id === value),
    );
    await tick();
    place();
    scrollHighlightedIntoView();
  }

  function closeMenu() {
    isOpen = false;
    highlighted = -1;
  }

  // Prefer opening downwards; flip up only when it would leave the window
  function place() {
    if (!rootEl || !menuEl) return;
    const r = rootEl.getBoundingClientRect();
    const h = menuEl.offsetHeight + 4;
    const below = window.innerHeight - r.bottom - 6;
    const above = r.top - 6;
    openUp = h > below && above > below;
    placed = true;
  }

  function scrollHighlightedIntoView() {
    (menuEl?.children[highlighted] as HTMLElement | undefined)?.scrollIntoView({
      block: "nearest",
    });
  }

  function select(opt: Option) {
    if (opt.id !== value) {
      value = opt.id;
      onchange?.(opt.id);
    }
    closeMenu();
  }

  function toggle() {
    if (isOpen) closeMenu();
    else void openMenu();
  }

  function onKey(e: KeyboardEvent) {
    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        void openMenu();
      }
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const n = options.length;
      if (n === 0) return;
      highlighted =
        e.key === "ArrowDown"
          ? (highlighted + 1) % n
          : (highlighted - 1 + n) % n;
      scrollHighlightedIntoView();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (options[highlighted]) select(options[highlighted]);
      else closeMenu();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  }

  function onWindowClick(e: MouseEvent) {
    if (isOpen && rootEl && !rootEl.contains(e.target as Node)) closeMenu();
  }
</script>

<svelte:window onclick={onWindowClick} />

<!-- data-no-toggle lets parents (e.g. clickable card headers) ignore clicks in here -->
<div
  class="sd-root"
  bind:this={rootEl}
  data-no-toggle
  style="width: {width}; --sd-h: {height};"
>
  <button
    type="button"
    {id}
    class="sd-trigger"
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    aria-label={ariaLabel}
    {title}
    {disabled}
    onclick={toggle}
    onkeydown={onKey}
  >
    <span class="sd-label">{selected?.text ?? ""}</span>
    <span class="sd-arrow">▾</span>
  </button>

  {#if isOpen && options.length > 0}
    <ul
      bind:this={menuEl}
      class="dropdown sd-menu"
      class:up={openUp}
      class:placing={!placed}
      role="listbox"
      onwheel={(e) => e.stopPropagation()}
    >
      {#each options as opt, i (opt.id)}
        <li
          role="option"
          aria-selected={opt.id === value}
          class:highlighted={highlighted === i}
          class:selected={opt.id === value}
          onmouseenter={() => (highlighted = i)}
          onmousedown={(e) => {
            e.preventDefault();
            select(opt);
          }}
        >
          {opt.text}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .sd-root {
    position: relative;
    min-width: 0;
    flex: 0 0 auto;
  }

  .sd-trigger {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    height: var(--sd-h, 26px);
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    padding: 0 6px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0;
    color: #ffffff;
    text-align: left;
    cursor: pointer;
    outline: none;
  }

  .sd-trigger:hover:not(:disabled),
  .sd-trigger:focus-visible,
  .sd-trigger[aria-expanded="true"] {
    border-color: #ffffff;
  }

  .sd-trigger:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sd-label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sd-arrow {
    flex-shrink: 0;
    color: #888888;
    font-size: 10px;
  }

  .sd-trigger:hover:not(:disabled) .sd-arrow {
    color: #ffffff;
  }

  .sd-menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 100%;
    width: max-content;
    max-width: 320px;
    max-height: 240px;
    overflow-y: auto;
    overscroll-behavior: contain;
    margin: 2px 0 0 0 !important;
    padding: 1px 0 !important;
    list-style: none;
    background: #000000 !important;
    border: 1px solid #ffffff !important;
    border-radius: 0 !important;
    z-index: 1000 !important;
    box-sizing: border-box !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85) !important;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  .sd-menu.up {
    top: auto;
    bottom: 100%;
    margin: 0 0 2px 0 !important;
  }

  /* Measured before showing so the direction is decided without flicker */
  .sd-menu.placing {
    visibility: hidden;
  }

  .sd-menu li {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 12px !important;
    line-height: 1.15 !important;
    padding: 1px 4px !important;
    cursor: pointer !important;
    color: #9a9a9a !important;
    background: #000000 !important;
    border-radius: 0 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .sd-menu li.selected {
    color: #ffffff !important;
  }

  .sd-menu li:hover,
  .sd-menu li.highlighted {
    background: #545454 !important;
    color: #ffffff !important;
  }
</style>
