<!-- src/lib/components/item/ItemModifier.svelte -->
<script lang="ts">
  import type {
    ItemMod,
    ItemModInfo,
    ItemModFlags,
  } from "$lib/types/tradeItem";

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
        tiers: [] as string[],
        flags: {} as ItemModFlags,
      };
    }

    const subMods: ItemModInfo[] = mod.mods || [];
    const tiers = subMods.map((m) => m.tier).filter(Boolean) as string[];
    const tierLabel = tiers.length > 0 ? tiers.join(" + ") : "";

    const clean = cleanBracketText(mod.description);
    const hoveredDescription = buildHoveredDescription(clean, subMods);

    return {
      description: clean,
      hoveredDescription,
      tierLabel,
      tiers,
      flags: mod.flags || {},
    };
  })();

  // The badge colour follows the affix type. Prefer the explicit category,
  // otherwise infer it from the tier string ("P1" -> prefix, "S3" -> suffix).
  $: badgeKind = (() => {
    if (category === "prefix" || category === "suffix") return category;
    const first = parsed.tiers[0]?.trim().charAt(0).toUpperCase();
    if (first === "P") return "prefix";
    if (first === "S") return "suffix";
    return category;
  })();

  // Gold highlight when every tier on the line is tier 1.
  $: isTopTier =
    parsed.tiers.length > 0 &&
    parsed.tiers.every((t) => /^[PSps]?0*1$/.test(t.trim()));

  $: flagBadge = parsed.flags.crafted
    ? { key: "crafted", letter: "C", title: "Crafted" }
    : parsed.flags.desecrated
      ? { key: "desecrated", letter: "D", title: "Desecrated" }
      : parsed.flags.fractured
        ? { key: "fractured", letter: "F", title: "Fractured" }
        : parsed.flags.mutated
          ? { key: "mutated", letter: "M", title: "Mutated" }
          : null;
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
  {#if parsed.tierLabel || flagBadge}
    <div class="tier-anchor">
      {#if parsed.tierLabel}
        <span
          class="tier-badge {badgeKind}"
          class:top-tier={isTopTier}
          title={flagBadge
            ? `${flagBadge.title} · ${parsed.tierLabel}`
            : parsed.tierLabel}
        >
          {parsed.tierLabel}
        </span>
      {:else if flagBadge}
        <span class="tier-badge {flagBadge.key}" title={flagBadge.title}>
          {flagBadge.letter}
        </span>
      {/if}
    </div>
  {/if}

  <div class="mod-text-center">
    {isHovered ? parsed.hoveredDescription : parsed.description}
  </div>
</div>

<style>
  .mod-row {
    --mod: #8888ff;
    --mod-rgb: 136, 136, 255;
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 1.4rem;
    font-family: "FontinRegular", "Fontin", "Palatino Linotype", Georgia, serif;
    font-size: 0.86rem;
    line-height: 1.28;
    padding: 1px 0;
    border-left: 2px solid transparent;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease;
  }
  .mod-row.compact {
    min-height: 1.15rem;
    font-size: 0.8rem;
    line-height: 1.2;
  }

  .mod-row:hover {
    background: rgba(var(--mod-rgb), 0.1);
  }

  .tier-anchor {
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
  }
  .mod-text-center {
    width: 100%;
    text-align: center;
    padding: 0 2.6rem;
    color: var(--mod);
    word-break: break-word;
    font-variant-numeric: tabular-nums;
  }

  /* ---- Category colours (in-game palette) ---- */
  .enchant,
  .rune {
    --mod: #b4b4ff;
    --mod-rgb: 180, 180, 255;
  }
  .implicit,
  .prefix,
  .suffix,
  .generic {
    --mod: #8888ff;
    --mod-rgb: 136, 136, 255;
  }
  .bonded {
    --mod: #6fe0cf;
    --mod-rgb: 111, 224, 207;
  }

  /* ---- Special states: tinted bar + wash instead of a full box ---- */
  .mod-row.is-desecrated {
    --mod: #8ecb74;
    --mod-rgb: 142, 203, 116;
    border-left-color: rgba(var(--mod-rgb), 0.85);
    background: linear-gradient(
      90deg,
      rgba(var(--mod-rgb), 0.12),
      transparent 70%
    );
  }
  .mod-row.is-crafted {
    --mod: #f8fafc;
    --mod-rgb: 248, 250, 252;
    border-left-color: rgba(var(--mod-rgb), 0.8);
    background: linear-gradient(
      90deg,
      rgba(var(--mod-rgb), 0.1),
      transparent 70%
    );
  }
  .mod-row.is-mutated {
    --mod: #cd2285;
    --mod-rgb: 205, 34, 133;
    border-left-color: rgba(var(--mod-rgb), 0.85);
    background: linear-gradient(
      90deg,
      rgba(var(--mod-rgb), 0.14),
      transparent 70%
    );
  }
  .mod-row.is-mutated.poe2 {
    --mod: #f87171;
    --mod-rgb: 248, 113, 113;
  }
  /* Fractured only recolours the text, so crafted/desecrated borders survive */
  .mod-row.is-fractured {
    --mod: #d2b45e;
    --mod-rgb: 210, 180, 94;
  }
  .mod-row.is-fractured:not(.is-crafted):not(.is-desecrated):not(.is-mutated) {
    border-left-color: rgba(var(--mod-rgb), 0.85);
    background: linear-gradient(
      90deg,
      rgba(var(--mod-rgb), 0.1),
      transparent 70%
    );
  }

  /* ---- Badges ---- */
  .tier-badge {
    display: inline-block;
    min-width: 1.35rem;
    padding: 0 4px;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 0.64rem;
    font-weight: 700;
    line-height: 1.5;
    text-align: center;
    white-space: nowrap;
    color: #9a9a9a;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid #3a3a3a;
  }
  .tier-badge.prefix {
    color: #9ea6ff;
    border-color: #3d4390;
    background: #0c0e24;
  }
  .tier-badge.suffix {
    color: #62d9a8;
    border-color: #1f6a52;
    background: #07211a;
  }
  .tier-badge.top-tier {
    color: #ffe08a;
    border-color: #b8892f;
    background: #2a1e07;
    box-shadow: 0 0 6px rgba(214, 170, 60, 0.35);
  }
  .tier-badge.crafted {
    color: #f8fafc;
    border-color: #cbd5e1;
    background: #1b2230;
  }
  .tier-badge.desecrated {
    color: #8ecb74;
    border-color: #4c8a38;
    background: #0a1f08;
  }
  .tier-badge.fractured {
    color: #d2b45e;
    border-color: #8a7330;
    background: #251d06;
  }
  .tier-badge.mutated {
    color: #f5b3dc;
    border-color: #a8236f;
    background: #2a0719;
  }
</style>
