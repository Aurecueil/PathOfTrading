<!-- src/lib/components/item/ItemModifier.svelte -->
<script lang="ts">
  import type { ItemMod, ItemModInfo } from "$lib/types/item";

  export let mod: string | ItemMod;
  export let category:
    | "enchant"
    | "implicit"
    | "prefix"
    | "suffix"
    | "generic" = "generic";

  interface ParsedMagnitude {
    sourceName?: string;
    min: string;
    max: string;
  }

  $: parsed = (() => {
    if (typeof mod === "string") {
      return { description: mod, tierLabel: "", magnitudes: [] };
    }

    const subMods: ItemModInfo[] = mod.mods || [];
    // Concatenate tiers: e.g. ["P1", "P1"] -> "P1 + P1"
    const tiers = subMods.map((m) => m.tier).filter(Boolean);
    const tierLabel = tiers.length > 0 ? tiers.join(" + ") : "";

    const magnitudes: ParsedMagnitude[] = [];
    subMods.forEach((sub) => {
      if (sub.magnitudes) {
        sub.magnitudes.forEach((mag) => {
          magnitudes.push({ sourceName: sub.name, min: mag.min, max: mag.max });
        });
      }
    });

    return {
      description: mod.description,
      tierLabel,
      magnitudes,
    };
  })();
</script>

<div class="mod-row {category}">
  <div class="tier-anchor">
    {#if parsed.tierLabel}
      <div class="tier-badge-container">
        <span class="tier-badge {category}">{parsed.tierLabel}</span>
        {#if parsed.magnitudes.length > 0}
          <div class="magnitude-popover">
            {#each parsed.magnitudes as mag}
              <div class="mag-entry">
                {#if mag.sourceName}<span class="mag-name"
                    >{mag.sourceName}:</span
                  >{/if}
                <span class="mag-range">({mag.min}–{mag.max})</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="mod-text-center">
    {parsed.description}
  </div>
</div>

<style>
  .mod-row {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 1.3rem;
    font-size: 0.74rem;
    line-height: 1.25;
  }
  .tier-anchor {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
  }
  .mod-text-center {
    width: 100%;
    text-align: center;
    padding: 0 2rem;
    word-break: break-word;
  }

  /* Color themes */
  .enchant .mod-text-center {
    color: #b8d0e8;
  }
  .implicit .mod-text-center {
    color: #9696ff;
  }
  .prefix .mod-text-center,
  .suffix .mod-text-center,
  .generic .mod-text-center {
    color: #8888ff;
  }

  /* Tier Badges */
  .tier-badge-container {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: help;
  }
  .tier-badge {
    font-size: 0.62rem;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    white-space: nowrap;
    border: 1px solid #334155;
    background: #0f172a;
    color: #94a3b8;
  }
  .tier-badge.prefix {
    background: #1e1b4b;
    color: #818cf8;
    border-color: #3730a3;
  }
  .tier-badge.suffix {
    background: #022c22;
    color: #34d399;
    border-color: #065f46;
  }

  /* Hover Magnitudes */
  .magnitude-popover {
    display: none;
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 4px;
    background: #090d16;
    border: 1px solid #3b4254;
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 0.65rem;
    color: #f1f5f9;
    white-space: nowrap;
    z-index: 20;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.7);
    flex-direction: column;
    gap: 2px;
  }
  .tier-badge-container:hover .magnitude-popover {
    display: flex;
  }
  .mag-name {
    color: #94a3b8;
    margin-right: 4px;
  }
  .mag-range {
    color: #38bdf8;
    font-weight: 600;
  }
</style>
