<!-- src/lib/trade/components/item/ItemTitleBar.svelte -->
<script lang="ts">
  import type { CategorySymbol } from "./categorySymbols";

  export let name: string = "";
  export let baseType: string = "";
  export let double: boolean = false;
  export let symbols: CategorySymbol[] = [];
  export let isStyled: boolean = false;
  export let hasOverlay: boolean = false;
  export let thick: boolean = false;
  export let styledHeaderBg: string = "";

  $: rightSymbols = [...symbols].reverse();
  $: fullTitle = [name, baseType].filter(Boolean).join(" ");
</script>

<div
  class="title-bar"
  class:is-styled={isStyled}
  class:thick
  style:background={isStyled && styledHeaderBg
    ? styledHeaderBg
    : "var(--title-bar-bg)"}
  style:background-size="auto 100%, auto 100%, auto 100%"
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

    <span class="title-text" class:double class:foil-text={hasOverlay}>
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
    padding: 5px 12px;
    background-color: var(--title-bar-bg);
    border-bottom: 1px solid var(--title-line-color);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.45);
    color: var(--title-font-color);
  }

  .title-bar.thick {
    border-bottom-width: 2px;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: var(--foil-overlay);
    opacity: 0.32;
    mix-blend-mode: overlay;
    pointer-events: none;
    z-index: 1;
  }

  .title-bar.is-styled .overlay {
    opacity: 1;
    mix-blend-mode: overlay;
  }

  .title-group {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    max-width: 100%;
    min-width: 0;
    margin: 0 auto;
    font-size: 22px;
    line-height: 1.2;
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
    gap: 2px;
  }

  .title-text.double .t-name,
  .title-text.double .t-base {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 22px;
  }

  /* replace the .t-name/.t-base.solo and .t-base:not(.solo) rules with: */
  .t-name,
  .t-base {
    font-weight: 700;
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
  /* Supporter foil: white text, tinted by the foil gradient */
  .title-text.foil-text {
    background: var(--foil-overlay), #fff;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
    /* text-shadow would show through the transparent fill, so use a filter */
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.95));
  }
  .title-text.foil-text .t-name,
  .title-text.foil-text .t-base {
    color: transparent;
  }
</style>
