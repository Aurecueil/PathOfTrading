<!-- src/lib/trade/components/item/ItemTitleBar.svelte -->
<script lang="ts">
  import type { CategorySymbol } from "./categorySymbols";

  export let name: string = "";
  export let baseType: string = "";
  export let double: boolean = false;
  export let symbols: CategorySymbol[] = [];
  export let insetLeft: number = 10;
  export let insetRight: number = 10;
  export let isStyled: boolean = false;
  export let hasOverlay: boolean = false;
  export let thick: boolean = false;

  $: rightSymbols = [...symbols].reverse();
  $: fullTitle = [name, baseType].filter(Boolean).join(" ");
  // Offset needed to visually align the center of the title with the stats column
  $: centerShift = Math.round(insetLeft - insetRight);
</script>

<div
  class="title-bar"
  class:is-styled={isStyled}
  class:is-double={double}
  class:thick
  style:--shift-left="{Math.max(0, centerShift)}px"
  style:--shift-right="{Math.max(0, -centerShift)}px"
>
  {#if hasOverlay}
    <div class="overlay"></div>
  {/if}

  <div class="title-group" title={fullTitle}>
    {#if symbols.length}
      <span class="symbols">
        {#each symbols as s (s.key)}
          <img class="symbol-img" src={s.url} alt={s.label} loading="lazy" />
        {/each}
      </span>
    {/if}

    <span class="title-text" class:double>
      {#if name}
        <span class="t-name">{name}</span>
      {/if}
      {#if baseType}
        {#if name && !double}{" "}{/if}
        <span class="t-base" class:solo={!name}>{baseType}</span>
      {/if}
    </span>

    {#if rightSymbols.length}
      <span class="symbols">
        {#each rightSymbols as s (s.key)}
          <img class="symbol-img" src={s.url} alt={s.label} loading="lazy" />
        {/each}
      </span>
    {/if}
  </div>

  <!-- Action buttons slot cleanly into the right side of the title bar -->
  <slot name="actions" />
</div>

<style>
  .title-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    padding: 4px 62px 4px 12px;
    background: var(--title-bar-bg);
    border-bottom: 1px solid var(--title-line-color);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.45);
    color: var(--title-font-color);
  }

  .title-bar.is-double {
    padding-block: 5px;
  }

  .title-bar.thick {
    border-bottom-width: 2px;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: var(--foil-overlay);
    opacity: 0.32;
    pointer-events: none;
  }

  .title-bar.is-styled .overlay {
    opacity: 1;
  }

  .title-group {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    max-width: 100%;
    min-width: 0;
    margin-left: var(--shift-left, 0px);
    margin-right: var(--shift-right, 0px);
    font-size: 20px;
    line-height: 1.18;
    text-shadow:
      0 1px 2px rgba(0, 0, 0, 0.95),
      0 0 6px rgba(0, 0, 0, 0.5);
    transition: margin 0.08s ease-out;
  }

  .title-text {
    min-width: 0;
    letter-spacing: 0.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title-text.double {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1px;
  }

  .title-text.double .t-name,
  .title-text.double .t-base {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .t-name,
  .t-base.solo {
    font-weight: 700;
  }

  .t-base:not(.solo) {
    font-weight: 400;
    font-size: 0.9em;
    opacity: 0.92;
  }

  .title-text.double .t-base:not(.solo) {
    font-size: 0.84em;
    opacity: 0.88;
  }

  .symbols {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 3px;
  }

  .symbol-img {
    height: 24px;
    width: 24px;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.85));
  }
</style>
