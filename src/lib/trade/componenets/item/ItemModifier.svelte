<!-- src/lib/components/item/ItemModifier.svelte -->
<script lang="ts">
  import type { ItemMod, ItemModInfo, ItemModFlags } from "$lib/types/item";

  export let mod: string | ItemMod;
  export let category:
    | "enchant"
    | "implicit"
    | "rune"
    | "prefix"
    | "suffix"
    | "bonded"
    | "generic" = "generic";
  export let realm: string = "poe";
  export let compact: boolean = false;

  let isHovered = false;

  // Replace [sth] or [sth|sth] with the last item (e.g. [ShamanOnlyMods|Bonded] -> Bonded)
  function cleanBracketText(text: string): string {
    if (!text) return "";
    return text.replace(/\[([^\]]+)\]/g, (_, inner: string) => {
      const parts = inner.split("|");
      return parts[parts.length - 1];
    });
  }

  // Inject magnitude ranges directly after numbers when hovered
  function buildHoveredDescription(
    cleanText: string,
    subMods: ItemModInfo[],
  ): string {
    if (!subMods || subMods.length === 0) return cleanText;

    const numberRegex = /[+-]?\d+(?:\.\d+)?%?/g;
    const matches = [...cleanText.matchAll(numberRegex)];
    const numCount = matches.length;
    if (numCount === 0) return cleanText;

    // Check if each subMod provides one magnitude per number in the description
    const allSubModsMatchCount =
      subMods.every((sm) => (sm.magnitudes?.length || 0) === numCount) &&
      subMods.some((sm) => (sm.magnitudes?.length || 0) > 0);

    const flatMagnitudes = subMods.flatMap((sm) => sm.magnitudes || []);
    if (flatMagnitudes.length === 0) return cleanText;

    const isMultiSubModCombined = subMods.length > 1 && allSubModsMatchCount;

    let matchIdx = 0;
    return cleanText.replace(numberRegex, (matchedNum) => {
      let rangeBracket = "";

      if (allSubModsMatchCount) {
        const parts = subMods
          .map((sm) => {
            const m = sm.magnitudes?.[matchIdx];
            if (!m) return null;
            return isMultiSubModCombined
              ? `${m.min}-${m.max}`
              : `${m.min} - ${m.max}`;
          })
          .filter(Boolean);

        if (parts.length > 0) {
          rangeBracket = `[${parts.join(" + ")}]`;
        }
      } else if (numCount === 1 && flatMagnitudes.length > 1) {
        const parts = flatMagnitudes.map((m) => `${m.min}-${m.max}`);
        rangeBracket = `[${parts.join(" + ")}]`;
      } else {
        const m = flatMagnitudes[matchIdx];
        if (m) {
          rangeBracket = `[${m.min} - ${m.max}]`;
        }
      }

      matchIdx++;
      return `${matchedNum}${rangeBracket}`;
    });
  }

  $: isPoe2 = realm?.toLowerCase() === "poe2";

  $: parsed = (() => {
    if (typeof mod === "string") {
      const clean = cleanBracketText(mod);
      return {
        description: clean,
        hoveredDescription: clean,
        tierLabel: "",
        flags: {} as ItemModFlags,
      };
    }

    const subMods: ItemModInfo[] = mod.mods || [];
    const tiers = subMods.map((m) => m.tier).filter(Boolean);
    const tierLabel = tiers.length > 0 ? tiers.join(" + ") : "";

    const clean = cleanBracketText(mod.description);
    const hoveredDescription = buildHoveredDescription(clean, subMods);

    return {
      description: clean,
      hoveredDescription,
      tierLabel,
      flags: mod.flags || {},
    };
  })();
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="mod-row {category}"
  class:compact
  class:is-desecrated={parsed.flags.desecrated}
  class:is-crafted={parsed.flags.crafted}
  class:is-mutated={parsed.flags.mutated}
  class:is-fractured={parsed.flags.fractured}
  class:poe2={isPoe2}
  on:mouseenter={() => (isHovered = true)}
  on:mouseleave={() => (isHovered = false)}
>
  <div class="tier-anchor">
    {#if parsed.tierLabel || parsed.flags.fractured || parsed.flags.crafted || parsed.flags.desecrated || parsed.flags.mutated}
      <div class="tier-badge-container">
        {#if parsed.tierLabel}
          <span class="tier-badge {category}">{parsed.tierLabel}</span>
        {:else if parsed.flags.crafted}
          <span class="tier-badge crafted">C</span>
        {:else if parsed.flags.desecrated}
          <span class="tier-badge desecrated">D</span>
        {:else if parsed.flags.fractured}
          <span class="tier-badge fractured">F</span>
        {:else if parsed.flags.mutated}
          <span class="tier-badge mutated">M</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="mod-text-center">
    {isHovered ? parsed.hoveredDescription : parsed.description}
  </div>
</div>

<style>
  .mod-row {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 1.28rem;
    font-size: 0.74rem;
    line-height: 1.25;
    border: 1px solid transparent;
    border-radius: 3px;
    padding: 1px 0;
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }
  .mod-row.compact {
    min-height: 1.1rem;
    font-size: 0.7rem;
    line-height: 1.18;
  }

  /* Highlight row on hover */
  .mod-row:hover {
    background: rgba(56, 189, 248, 0.12);
  }

  .tier-anchor {
    position: absolute;
    left: 3px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
  }
  .mod-text-center {
    width: 100%;
    text-align: center;
    padding: 0 2.2rem;
    word-break: break-word;
  }

  /* Regular & Category Modifier Colors (Light Blue) */
  .enchant .mod-text-center,
  .rune .mod-text-center {
    color: #bae6fd;
  }
  .implicit .mod-text-center {
    color: #93c5fd;
  }
  .bonded .mod-text-center {
    color: #5eead4;
  }
  .prefix .mod-text-center,
  .suffix .mod-text-center,
  .generic .mod-text-center {
    color: #7dd3fc;
  }

  /* 1. Desecrated: green text and green border */
  .mod-row.is-desecrated {
    border-color: rgba(74, 222, 128, 0.65);
    background: rgba(34, 197, 94, 0.06);
  }
  .mod-row.is-desecrated .mod-text-center {
    color: #4ade80;
  }

  /* 2. Crafted: white text and white border */
  .mod-row.is-crafted {
    border-color: rgba(248, 250, 252, 0.65);
    background: rgba(248, 250, 252, 0.05);
  }
  .mod-row.is-crafted .mod-text-center {
    color: #f8fafc;
  }

  /* 3. Mutated: purple text & border in PoE1, red text & border in PoE2 */
  .mod-row.is-mutated {
    border-color: rgba(192, 132, 252, 0.65);
    background: rgba(192, 132, 252, 0.06);
  }
  .mod-row.is-mutated .mod-text-center {
    color: #c084fc;
  }
  .mod-row.is-mutated.poe2 {
    border-color: rgba(248, 113, 113, 0.65);
    background: rgba(248, 113, 113, 0.06);
  }
  .mod-row.is-mutated.poe2 .mod-text-center {
    color: #f87171;
  }

  /* 4. Fractured: golden text (keeps crafted/desecrated border if combined) */
  .mod-row.is-fractured .mod-text-center {
    color: #facc15;
  }

  /* Tier Badges */
  .tier-badge-container {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .tier-badge {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 0px 4px;
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
  .tier-badge.crafted {
    background: #1e293b;
    color: #f8fafc;
    border-color: #cbd5e1;
  }
  .tier-badge.desecrated {
    background: #052e16;
    color: #4ade80;
    border-color: #22c55e;
  }
  .tier-badge.fractured {
    background: #422006;
    color: #facc15;
    border-color: #eab308;
  }
  .tier-badge.mutated {
    background: #3b0764;
    color: #e9d5ff;
    border-color: #a855f7;
  }
</style>
