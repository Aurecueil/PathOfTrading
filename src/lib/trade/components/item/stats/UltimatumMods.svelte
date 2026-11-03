<!-- src/lib/trade/components/item/stats/UltimatumMods.svelte -->
<script lang="ts">
  import type { UltimatumMod } from "$lib/types/tradeItem";
  import CdnImage from "../CdnImage.svelte";
  import {
    ULTIMATUM_CELL,
    ULTIMATUM_SPRITE,
    ULTIMATUM_TIER_POS,
    ULTIMATUM_TYPE_POS,
  } from "./ultimatumSprites";

  export let mods: UltimatumMod[] = [];
  /** More mods than this -> zig-zag "double" layout */
  export let doubleAbove: number = 4;

  $: double = mods.length > doubleAbove;

  const prettify = (t: string) => t.replace(/([a-z])([A-Z])/g, "$1 $2");
</script>

<div class="ult-row" class:double style="--cell: {ULTIMATUM_CELL}px">
  {#each mods as mod}
    {@const pos = ULTIMATUM_TYPE_POS[mod.type]}
    {@const tierPos = ULTIMATUM_TIER_POS[mod.tier]}
    <span class="ult-mod" title="{prettify(mod.type)} (Tier {mod.tier})">
      {#if pos}
        <span class="layer" style="--x: -{pos[0]}px; --y: -{pos[1]}px">
          <CdnImage
            src={ULTIMATUM_SPRITE}
            alt={prettify(mod.type)}
            className="ult-sprite"
          />
        </span>
      {/if}
      {#if tierPos}
        <span class="layer" style="--x: -{tierPos[0]}px; --y: -{tierPos[1]}px">
          <CdnImage src={ULTIMATUM_SPRITE} alt="" className="ult-sprite" />
        </span>
      {/if}
    </span>
  {/each}
</div>

<style>
  .ult-row {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    flex-wrap: wrap;
    width: 100%;
  }
  .ult-mod {
    position: relative;
    display: inline-block;
    width: var(--cell);
    height: var(--cell);
    flex-shrink: 0;
  }
  .layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .layer :global(.ult-sprite) {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
  }

  /* Zig-zag honeycomb: odd cells overlap neighbours, even cells sit half a cell higher */
  .ult-row.double {
    flex-wrap: nowrap;
    height: 58.5px;
  }
  .ult-row.double .ult-mod:nth-child(odd) {
    margin-left: -19.5px;
    margin-right: -19.5px;
  }
  .ult-row.double .ult-mod:nth-child(even) {
    margin-bottom: 19.5px;
  }
  .ult-row.double .ult-mod:first-child {
    margin-left: 0;
  }
  .ult-row.double .ult-mod:last-child {
    margin-right: 0;
  }
</style>
