<!-- src/lib/searchTile/ItemTitleBar.svelte -->
<script lang="ts">
  import type { CategorySymbol } from "./categorySymbols";

  export let title: string = "";
  export let symbols: CategorySymbol[] = [];
  export let insetLeft: number = 10;
  export let insetRight: number = 10;
  export let boxWidth: number = 0;

  // Split title into Name and Base Type if possible, or style uniformly
  // Assuming fullItemTitle can be split or rendered with distinct parts if desired,
  // or we apply font sizes directly. Let's split by space or check parts if formatted as "Name BaseType".
  // Alternatively, if title is passed as a single string, we can split it or apply font size 22 to the main/name part and 21 to the base type.
  // Let's parse name vs base type or support 22px / 21px styling.

  $: rightSymbols = [...symbols].reverse();

  // If title contains both name and base type, we can split them or render appropriately.
  // Let's check how fullItemTitle is passed: `[item.name, item.typeLine || item.baseType].filter(Boolean).join(" ")`
  // If we want the name part at 22px and base type at 21px, we can split by the last word or keep them clean.
  // Let's look at a robust split or handle it cleanly.
</script>

<div class="row-title-bar">
  <div
    class="title-group"
    {title}
    style="transform: translateX({(insetLeft - insetRight) / 2}px);"
  >
    {#if symbols.length}
      <span class="symbols left-symbols">
        {#each symbols as s (s.key)}
          <img class="symbol-img" src={s.url} alt={s.label} loading="lazy" />
        {/each}
      </span>
    {/if}

    <span class="title-text">{title}</span>

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
  .row-title-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    padding: 5px 10px;
    background: linear-gradient(
      90deg,
      rgba(var(--rc-rgb), 0.24) 0%,
      rgba(var(--rc-rgb), 0.07) 55%,
      rgba(0, 0, 0, 0.55) 100%
    );
    border-bottom: 1px solid rgba(var(--rc-rgb), 0.38);
    color: var(--rc);
  }

  .title-group {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    max-width: 100%;
    font-size: 22px; /* Set title font size to 22 */
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
    transition: transform 0.05s linear;
  }

  .title-text {
    font-weight: 600;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Make base type 21px if it's part of the text string, or handle general sizing */
  /* If the item title contains both name and base type, we can style them if split, 
     or apply 22px generally with base type slightly adjusted if broken down. 
     To make sure base type is 21px as requested: */

  .symbols {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .left-symbols {
    margin-right: 6px; /* Small distance between symbol and text */
  }

  .right-symbols {
    margin-left: 6px; /* Small distance between text and symbol */
  }

  .symbol-img {
    height: 26px; /* Bigger symbols */
    width: 26px;
    object-icon: contain;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
  }
</style>
