<script lang="ts">
  import type { CategorySymbol } from "./categorySymbols";

  export let name: string = "";
  export let baseType: string = "";
  export let double: boolean = false;
  export let symbols: CategorySymbol[] = [];
  export let insetLeft: number = 10;
  export let insetRight: number = 10;
  export let boxWidth: number = 0;
  export let overlay: string = "";
  export let thick: boolean = false;

  $: rightSymbols = [...symbols].reverse();
  $: fullTitle = [name, baseType].filter(Boolean).join(" ");
</script>

<div class="row-title-bar" class:thick>
  {#if overlay}
    <div class="overlay" style="background: {overlay};"></div>
  {/if}
  <div
    class="title-group"
    title={fullTitle}
    style="transform: translateX({(insetLeft - insetRight) / 2}px);"
  >
    {#if symbols.length}
      <span class="symbols left-symbols">
        {#each symbols as s (s.key)}
          <img class="symbol-img" src={s.url} alt={s.label} loading="lazy" />
        {/each}
      </span>
    {/if}

    <span class="title-text" class:double>
      {#if name}<span class="t-name">{name}</span>{/if}
      {#if baseType}{#if name && !double}{" "}{/if}<span
          class="t-base"
          class:solo={!name}>{baseType}</span
        >{/if}
    </span>

    {#if rightSymbols.length}
      <span class="symbols right-symbols">
        {#each rightSymbols as s (s.key)}
          <img class="symbol-img" src={s.url} alt={s.label} loading="lazy" />
        {/each}
      </span>
    {/if}
  </div>
</div>

<style>
  .row-title-bar.thick {
    border-width: 3px;
    border-color: var(--title-border-color);
  }
  .row-title-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    padding: 5px 10px;
    position: relative;
    background: var(--title-bar-color);
    border: 1px solid var(--title-line-color);
    color: var(--title-font-color);
  }
  .overlay {
    position: absolute;
    inset: 0;
    opacity: 0.3;
    pointer-events: none;
  }
  .title-group {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    min-width: 0;
    font-size: 22px;
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
    transition: transform 0.05s linear;
    position: relative;
    z-index: 1;
  }
  .title-text {
    min-width: 0;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title-text.double {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .title-text.double .t-name,
  .title-text.double .t-base {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .t-name {
    font-weight: 700;
  }
  .t-base {
    font-weight: 400;
    font-size: 21px;
  }
  .t-base.solo {
    font-weight: 700;
    font-size: inherit;
  } /* nameless items */

  .symbols {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }
  .left-symbols {
    margin-right: 6px;
  }
  .right-symbols {
    margin-left: 6px;
  }
  .symbol-img {
    height: 26px;
    width: 26px;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
  }
</style>
