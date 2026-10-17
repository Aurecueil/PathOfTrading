<!-- src/lib/trade/components/item/ItemModifier.svelte -->
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
    | "crucible"
    | "scourge"
    | "pseudo"
    | "generic" = "generic";
  export let realm: string = "poe";
  export let compact: boolean = false;

  let isHovered = false;

  function cleanBracketText(text: string): string {
    if (!text) return "";
    return text.replace(/\[([^\]]+)\]/g, (_, inner: string) => {
      const parts = inner.split("|");
      return parts[parts.length - 1];
    });
  }

  function buildHoveredDescription(
    cleanText: string,
    subMods: ItemModInfo[],
  ): string {
    if (!subMods || subMods.length === 0) return cleanText;

    const numberRegex = /[+-]?\d+(?:\.\d+)?%?/g;
    const matches = [...cleanText.matchAll(numberRegex)];
    const numCount = matches.length;
    if (numCount === 0) return cleanText;

    const allSubModsMatchCount =
      subMods.every((sm) => (sm.magnitudes?.length || 0) === numCount) &&
      subMods.some((sm) => (sm.magnitudes?.length || 0) > 0);

    const flatMagnitudes = subMods.flatMap((sm) => sm.magnitudes || []);
    if (flatMagnitudes.length === 0) return cleanText;

    let matchIdx = 0;
    return cleanText.replace(numberRegex, (matchedNum) => {
      let rangeBracket = "";
      if (allSubModsMatchCount) {
        const parts = subMods
          .map((sm) => {
            const m = sm.magnitudes?.[matchIdx];
            if (!m) return null;
            return `${m.min}-${m.max}`;
          })
          .filter(Boolean);
        if (parts.length > 0) {
          rangeBracket = `[${parts.join("+")}]`;
        }
      } else if (numCount === 1 && flatMagnitudes.length > 1) {
        const parts = flatMagnitudes.map((m) => `${m.min}-${m.max}`);
        rangeBracket = `[${parts.join("+")}]`;
      } else {
        const m = flatMagnitudes[matchIdx];
        if (m) {
          rangeBracket = `[${m.min}-${m.max}]`;
        }
      }
      matchIdx++;
      return `${matchedNum}${rangeBracket}`;
    });
  }

  interface TierPart {
    text: string;
    color: string;
  }

  function getTierColor(token: string, cat: string): string {
    if (cat === "scourge") return "#FF6E25";
    const upper = token.toUpperCase();
    if (upper.startsWith("P") || cat === "prefix") return "#DD3E14";
    if (upper.startsWith("S") || cat === "suffix") return "#58AFF1";
    if (upper.startsWith("R") || cat === "rune" || cat === "enchant")
      return "#FFFFFF";
    return "#9a9a9a";
  }

  $: isPoe2 = realm?.toLowerCase() === "poe2";

  $: parsed = (() => {
    if (typeof mod === "string") {
      const clean = cleanBracketText(mod);
      return {
        description: clean,
        hoveredDescription: clean,
        tierParts: [] as TierPart[],
        tierTitle: "",
        level: null as number | null,
        flags: {} as ItemModFlags,
      };
    }

    const subMods: ItemModInfo[] = mod.mods || [];
    const flags: ItemModFlags = {
      ...(mod.flags || {}),
      desecrated: Boolean(mod.flags?.desecrated) || mod.domain === "desecrated",
    };

    // Split every tier string into tokens (no spaces, no "+" glue), then drop
    // every "M" (mutated) token so it can never be rendered.
    const rawTiers = subMods
      .flatMap((m) => (m.tier || "").split(/[^A-Za-z0-9]+/))
      .filter((t) => Boolean(t) && !/^M(?:\d+|utated)?$/i.test(t));

    const tierParts: TierPart[] = rawTiers.map((t) => ({
      text: t,
      color: getTierColor(t, category),
    }));

    if (tierParts.length === 0 && !flags.mutated && category === "rune") {
      tierParts.push({ text: "R", color: "#FFFFFF" });
    }

    const levels = subMods
      .map((m) => m.level)
      .filter((l): l is number => typeof l === "number" && l > 0);
    const level = levels.length > 0 ? Math.max(...levels) : null;
    const clean = cleanBracketText(mod.description);
    const hoveredDescription = buildHoveredDescription(clean, subMods);

    return {
      description: clean,
      hoveredDescription,
      tierParts,
      tierTitle: tierParts.map((p) => p.text).join("+"),
      level,
      flags,
    };
  })();

  $: hasBadge =
    parsed.tierParts.length > 0 ||
    fallbackBadge !== null ||
    parsed.level !== null;

  $: fallbackBadge =
    parsed.flags.mutated || parsed.tierParts.length > 0
      ? null
      : parsed.flags.crafted
        ? { letter: "C", title: "Crafted", color: "#FFFFFF" }
        : parsed.flags.desecrated
          ? { letter: "D", title: "Desecrated", color: "#78B20A" }
          : parsed.flags.fractured
            ? { letter: "F", title: "Fractured", color: "#A89664" }
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
  {#if parsed.tierParts.length > 0 || fallbackBadge}
    <div class="side-anchor left">
      {#if parsed.tierParts.length > 0}
        <span class="side-badge" title={parsed.tierTitle}
          >{#each parsed.tierParts as part, pi}{#if pi > 0}<span
                class="tier-plus">+</span
              >{/if}<span style="color:{part.color}">{part.text}</span
            >{/each}</span
        >
      {:else if fallbackBadge}
        <span
          class="side-badge"
          style="color:{fallbackBadge.color}"
          title={fallbackBadge.title}>{fallbackBadge.letter}</span
        >
      {/if}
    </div>
  {/if}

  <div class="mod-text-center" class:has-badge={hasBadge}>
    {isHovered ? parsed.hoveredDescription : parsed.description}
  </div>

  {#if parsed.level !== null}
    <div class="side-anchor right">
      <span class="side-badge" title="Required Level ≥{parsed.level}"
        >≥{parsed.level}</span
      >
    </div>
  {/if}
</div>

<style>
  .mod-row {
    --edge: 5px; /* ~5px distance of tier (left) / level (right) from the row edge */
    --mod: #6588ff;
    --mod-rgb: 101, 136, 255;
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    /* --mod-h is provided by ItemStats so veiled graphics match exactly */
    min-height: var(--mod-h, 1.7rem);
    font-family: "FontinRegular", "Fontin", "Palatino Linotype", Georgia, serif;
    font-size: 1.24rem;
    line-height: 1.22;
    padding: 0;
    border-left: 2px solid transparent;
    border-right: 2px solid transparent;
    box-sizing: border-box;
    transition:
      background-color 0.12s ease,
      border-color 0.12s ease;
  }

  .mod-row.compact {
    min-height: var(--mod-h, 1.5rem);
    font-size: 1.14rem;
    line-height: 1.18;
  }

  .mod-row:hover {
    background-color: rgba(var(--mod-rgb), 0.1);
  }

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
  .side-anchor.right {
    right: var(--edge);
  }

  .mod-text-center {
    width: 100%;
    text-align: center;
    padding: 0 0.5rem;
    color: var(--mod);
    word-break: break-word;
    font-variant-numeric: tabular-nums;
  }

  /* Tighter side clearance so modifier text has more horizontal room */
  .mod-text-center.has-badge {
    padding: 0 calc(var(--edge) + 2.6rem);
  }

  /* ---- Category colours ---- */
  .rune,
  .enchant {
    --mod: #ffffff;
    --mod-rgb: 255, 255, 255;
  }
  .implicit,
  .prefix,
  .suffix,
  .generic {
    --mod: #6588ff;
    --mod-rgb: 101, 136, 255;
  }
  .bonded {
    --mod: #94a3b8;
    --mod-rgb: 148, 163, 184;
  }
  .crucible {
    --mod: #ff7339;
    --mod-rgb: 255, 115, 57;
  }
  .scourge {
    --mod: #ff6e25;
    --mod-rgb: 255, 110, 37;
  }
  .pseudo {
    --mod: #7f7f7f;
    --mod-rgb: 127, 127, 127;
  }

  /* ---- Special states ---- */
  /* Desecrated: green vertical edge lines + abyss decorator graphic */
  .mod-row.is-desecrated {
    --mod: #78b20a;
    --mod-rgb: 120, 178, 10;
    border-left-color: rgba(120, 178, 10, 0.85);
    border-right-color: rgba(120, 178, 10, 0.85);
    background-image: url("https://web.poecdn.com/protected/image/item/popup2/mod-decorator-abyss.webp?v=1755058882408&key=P7lo6UMIBNlQ9qClPdHjFw");
    background-size: 100% 100%;
    background-position: center;
    background-repeat: no-repeat;
  }

  .mod-row.is-desecrated .mod-text-center {
    color: #78b20a;
  }

  .mod-row.is-crafted {
    --mod: #ffffff;
    --mod-rgb: 255, 255, 255;
    border-left-color: rgba(255, 255, 255, 0.85);
    border-right-color: rgba(255, 255, 255, 0.85);
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.14) 0%,
      transparent 35%,
      transparent 65%,
      rgba(255, 255, 255, 0.14) 100%
    );
  }
  .mod-row.is-crafted:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .mod-row.is-mutated {
    --mod: #cd2285;
    --mod-rgb: 205, 34, 133;
    border-left-color: rgba(var(--mod-rgb), 0.85);
    border-right-color: rgba(var(--mod-rgb), 0.85);
    background: linear-gradient(
      90deg,
      rgba(var(--mod-rgb), 0.18) 0%,
      transparent 35%,
      transparent 65%,
      rgba(var(--mod-rgb), 0.18) 100%
    );
  }
  .mod-row.is-mutated.poe2 {
    --mod: #ad2116;
    --mod-rgb: 173, 33, 22;
  }
  .mod-row.is-mutated:hover {
    background: rgba(var(--mod-rgb), 0.18);
  }

  /* Fractured uses #B58E3A font color only (no border) and overrides all other font colors */
  .mod-row.is-fractured {
    --mod: #b58e3a;
    --mod-rgb: 181, 142, 58;
  }
  .mod-row.is-fractured .mod-text-center {
    color: #b58e3a !important;
  }

  /* ---- Badges (plain text, same font size as modifier) ---- */
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
    color: #9a9a9a;
    background: none;
    border: none;
  }

  .tier-plus {
    color: #9a9a9a;
  }
</style>
