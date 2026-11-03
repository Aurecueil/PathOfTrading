<!-- src/lib/trade/components/item/stats/LogbookMods.svelte -->
<script lang="ts">
  import type { LogbookMod } from "$lib/types/tradeItem";
  import CdnImage from "../CdnImage.svelte";
  import ItemModifier from "../ItemModifier.svelte";

  export let logbookMods: LogbookMod[] = [];
  export let realm: string = "poe";
  export let compact: boolean = false;

  // expedition.png sprite, 18x18 cells (2x2)
  const SPRITE =
    "/protected/image/gen/expedition.png?v=1793220332412&key=Wnk-NHi-ltu_ECiyCMMIsg";
  const FACTION_POS: Record<string, [number, number]> = {
    Faction1: [0, 0],
    Faction2: [18, 0],
    Faction3: [0, 18],
    Faction4: [18, 18],
  };
</script>

<div class="logbook">
  {#each logbookMods as lb}
    {@const pos = FACTION_POS[lb.faction?.id]}
    <div class="logbook-block">
      <div class="lb-name">{lb.name}</div>
      <div class="lb-faction">
        {#if pos}
          <span
            class="faction-icon"
            style="--sx: -{pos[0]}px; --sy: -{pos[1]}px"
          >
            <CdnImage src={SPRITE} alt="" className="faction-sprite" />
          </span>
        {/if}
        <span>{lb.faction?.name}</span>
      </div>
      <div class="lb-mods">
        {#each lb.mods as mod}
          <ItemModifier {mod} {realm} category="generic" {compact} />
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .logbook {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .logbook-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    width: 100%;
  }
  .logbook-block:not(:first-child)::before {
    content: "";
    align-self: stretch;
    height: 1px;
    margin: 0.2rem 0;
    background: linear-gradient(
      90deg,
      transparent,
      #283042 20%,
      #283042 80%,
      transparent
    );
  }
  .lb-name {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.2;
    color: #fff;
  }
  .lb-faction {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.92rem;
    line-height: 1.2;
    color: #8b95a5;
    margin-bottom: 2px;
  }
  .lb-mods {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
  }
  .faction-icon {
    position: relative;
    display: inline-block;
    width: 18px;
    height: 18px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .faction-icon :global(.faction-sprite) {
    position: absolute;
    left: var(--sx);
    top: var(--sy);
    width: auto;
    height: auto;
    max-width: none;
  }
</style>
