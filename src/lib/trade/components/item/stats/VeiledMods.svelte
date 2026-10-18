<!-- src/lib/trade/components/item/stats/VeiledMods.svelte -->
<script lang="ts">
  import type { ItemMod } from "$lib/types/tradeItem";
  import { VEILED_POE1, VEILED_POE2 } from "./veiledData";
  import { displayTiers } from "$lib/trade/tradeStore";

  export let mods: Array<string | ItemMod> = [];
  export let isPoe2: boolean = false;
  export let compact: boolean = false;

  $: entries = mods.map((vm) => {
    const raw = (typeof vm === "string" ? vm : vm.description || "")
      .toLowerCase()
      .trim();
    const key = VEILED_POE1[raw] ? raw : "prefix01";
    const isPrefix = key.startsWith("prefix");
    return {
      key,
      tier: isPrefix ? "P" : "S",
      tierColor: isPrefix ? "#DD3E14" : "#58AFF1",
      poe1Url: VEILED_POE1[key],
      poe2Data: VEILED_POE2[key] || VEILED_POE2.prefix01,
    };
  });
</script>

{#if entries.length > 0}
  <div class="veiled-mods-list">
    {#each entries as vm}
      <div
        class="item-mod--veiled"
        class:poe2={isPoe2}
        class:compact
        class:hide-tier={!$displayTiers}
      >
        <div class="side-anchor left">
          <span class="side-badge" style="color: {vm.tierColor}">{vm.tier}</span
          >
        </div>
        {#if isPoe2}
          <div
            class="lc {vm.key}"
            class:wide={vm.poe2Data.wide}
            style="background-image: url('{vm.poe2Data.url}')"
          ></div>
        {:else}
          <div
            class="lc {vm.key}"
            style="background-image: url('{vm.poe1Url}')"
          ></div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .veiled-mods-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    width: 100%;
  }

  /* Same box model as ItemModifier's .mod-row so the tier badge lands on
     exactly the same pixel (1:1). */
  .item-mod--veiled {
    --edge: 5px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: var(--mod-h, 26px);
    padding: 1px 0;
    box-sizing: border-box;
    border-left: 2px solid transparent;
    border-right: 2px solid transparent;
    overflow: hidden; /* anything scaled past the row edge is cut off */
    background: none;
    font-family: "FontinRegular", "Fontin", "Palatino Linotype", Georgia, serif;
    font-size: 22px;
    line-height: 24px;
    transition: background-color 0.12s ease;
  }

  .item-mod--veiled.compact {
    height: var(--mod-h, 23px);
    font-size: 20px;
    line-height: 22px;
  }

  /* PoE1: light gray hover highlight */
  .item-mod--veiled:not(.poe2):hover {
    background-color: rgba(200, 200, 200, 0.16);
  }
  /* PoE2: green hover highlight */
  .item-mod--veiled.poe2:hover {
    background-color: rgba(120, 178, 10, 0.18);
  }

  /* Tier badge: identical to ItemModifier .side-anchor.left + .side-badge */
  .side-anchor {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    white-space: nowrap;
    flex-wrap: nowrap;
    flex-shrink: 0;
    width: max-content;
    z-index: 5;
  }
  .side-anchor.left {
    left: var(--edge);
  }
  .side-badge {
    display: inline-flex;
    flex-wrap: nowrap;
    width: max-content;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-sizing: border-box;
    font-size: inherit;
    font-weight: 600;
    line-height: inherit;
    text-align: center;
    white-space: nowrap;
    letter-spacing: 0;
    word-spacing: 0;
    background: none;
    border: none;
  }

  .item-mod--veiled:not(.poe2) .lc {
    width: 220px;
    height: 100%;
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
  }

  /* PoE2: native frame = 320x58 (wide 480x58). The 38px between the 10px
     top/bottom crops is scaled to exactly the mod row height (--veil-scale
     = rowHeight / 38). The cropped 10px overflow and are clipped by the row. */
  .item-mod--veiled.poe2 .lc {
    flex: none;
    width: 320px;
    height: 58px;
    background-repeat: no-repeat;
    background-position: -12480px 0;
    transform: scale(var(--veil-scale, 0.684));
    transform-origin: center center;
    animation: animate-veiled-mod 2.6s steps(39) reverse infinite;
  }
  .item-mod--veiled.poe2 .lc.wide {
    width: 480px;
    background-position: -18720px 0;
  }
  @keyframes animate-veiled-mod {
    0% {
      background-position: 0 0;
    }
  }
  .item-mod--veiled.hide-tier:not(:hover) .side-anchor {
    display: none;
  }
</style>
