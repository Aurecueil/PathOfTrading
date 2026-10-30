<!-- src/lib/trade/components/item/ItemStats.svelte -->
<script lang="ts">
  import type { Item, ItemMod } from "$lib/types/tradeItem";
  import type {
    ResolvedDisplayStyle,
    TileDisplayOptions,
  } from "$lib/types/types";
  import ItemModifier from "../item/ItemModifier.svelte";
  import ItemProperties from "./stats/ItemProperties.svelte";
  import GrantedSkills from "./stats/GrantedSkills.svelte";
  import VeiledMods from "./stats/VeiledMods.svelte";
  import StatGroupSummary from "./stats/StatGroupSummary.svelte";
  import KeywordText from "./stats/KeywordText.svelte";
  import MercenarySkills from "../item/MercenarySkills.svelte";
  import {
    CDN_BASE,
    cleanBracketText,
    getRarityClass,
    normalizeModHash,
  } from "./stats/statsUtils";
  import { extractSkills } from "./stats/extractSkills";
  import { displayRune } from "$lib/trade/tradeStore";
  import { normalizeDisplayOptions } from "$lib/trade/components/drawer/tileDisplay";

  export let displayOptions: Partial<TileDisplayOptions> | null = null;
  export let item: Item;
  export let realm: string = "poe";
  export let styleMode: ResolvedDisplayStyle = "full";
  export let tileWidth: number = 600;
  export let isTooltip: boolean = false;

  let showBondedMods = false;

  $: effectiveMode = isTooltip ? "compact" : styleMode;
  $: isCompact = effectiveMode === "compact";
  $: isPoe2 = (item.realm || realm || "").toLowerCase() === "poe2";

  $: show = normalizeDisplayOptions(isTooltip ? null : displayOptions);
  /* ------------------------------------------------------------------ */
  /* Mod row height + PoE2 veiled scale                                 */
  /* ------------------------------------------------------------------ */
  const REM_PX =
    typeof document !== "undefined"
      ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      : 16;
  // The PoE2 veiled image is 58px tall. We show the middle 38px (10px cropped
  // top and bottom) and scale that to the mod row height.
  $: modHPx = isCompact ? 23 : 26;
  $: veilScale = modHPx / 38;

  const FORESIGHT_ICON = `${CDN_BASE}/protected/image/item/popup/foresight.png?v=1709582916256&key=Lef8eETW43fyBwYaZ_f3SA`;

  /* ------------------------------------------------------------------ */
  /* Minimal                                                            */
  /* ------------------------------------------------------------------ */
  $: minimalName = cleanBracketText(item.name || "").trim();

  $: isMercenaryWarrant =
    item?.baseType === "Mercenary Warrant" ||
    item?.typeLine === "Mercenary Warrant";

  $: mercenaryName = isMercenaryWarrant
    ? (item?.properties?.[0]?.values?.[0]?.[0] ?? "")
    : "";

  $: minimalBase = (() => {
    const b = cleanBracketText(
      mercenaryName || item.typeLine || item.baseType || "",
    ).trim();
    return b && b !== minimalName ? b : "";
  })();

  /* ------------------------------------------------------------------ */
  /* Descriptions                                                       */
  /* ------------------------------------------------------------------ */
  // Always show secDescrText when present (above explicit stats, #1BA274)
  $: secDescrTextRaw = (item.secDescrText || "").trim();

  // Gem / socketable stats & fallback descrText (shown in tooltips)
  $: tooltipTexts = ((): { desc: string; stats: string[] } => {
    const tab = (item.gemTabs as any[] | undefined)?.[0];
    const stats: string[] = (tab?.pages?.[0]?.stats ?? []).map((t: string) =>
      t.trim(),
    );
    const desc =
      !secDescrTextRaw && !stats.length ? (item.descrText || "").trim() : "";
    return { desc, stats };
  })();

  // Granted / socketed skills follow the implicit-mods option
  $: extractedSkills = show.displayImplicitMods ? extractSkills(item) : [];

  /* ------------------------------------------------------------------ */
  /* Modifiers & Bonded Handling                                        */
  /* ------------------------------------------------------------------ */
  // Runes need BOTH the tile option and the global toggle (tooltips always show them)
  $: showRunes = isTooltip || ($displayRune && show.displayRuneMods);
  $: shownRuneRegular = showRunes ? separatedMods.runeRegular : [];
  $: shownRuneBonded = showRunes ? separatedMods.runeBonded : [];

  // A mod is "bonded" only if it IS a bonded line (starts with the Bonded
  // marker). Text that merely mentions [..|Bonded] mid-sentence is not.
  function isBondedMod(mod: string | ItemMod): boolean {
    const raw = typeof mod === "string" ? mod : mod.description || "";
    if (typeof mod !== "string" && mod.domain === "bonded") return true;
    return /^\s*\[[^\]]*Bonded\]\s*:/i.test(raw) || /^\s*Bonded\s*:/i.test(raw);
  }

  function normalizeBondedEffect(mod: string | ItemMod): string {
    const raw = typeof mod === "string" ? mod : mod.description || "";
    const cleaned = cleanBracketText(raw).trim();
    const colonIdx = cleaned.indexOf(":");
    return (colonIdx !== -1 ? cleaned.slice(colonIdx + 1) : cleaned)
      .trim()
      .toLowerCase();
  }

  // With a Fox Idol socketed, ONLY bonded rune mods sourced from items
  // ending with " idol" are shown inline; other bonded rune mods stay collapsed.
  $: hasFoxIdol = (item.runeMods || []).some(
    (m) =>
      typeof m !== "string" &&
      normalizeModHash(m.hash) === "rune.stat_726496846",
  );
  $: idolBondedEffects = (() => {
    const set = new Set<string>();
    if (!hasFoxIdol) return set;

    for (const si of item.socketedItems || []) {
      const itemName = (si.baseType || si.typeLine || si.name || "")
        .trim()
        .toLowerCase();
      if (!itemName.endsWith(" idol")) continue;

      for (const bm of si.bondedMods || []) {
        const effect = normalizeBondedEffect(bm);
        if (effect) set.add(effect);
      }
    }
    return set;
  })();
  $: separatedMods = (() => {
    const runeRegular: Array<string | ItemMod> = [];
    const runeBonded: Array<string | ItemMod> = [];

    (item.runeMods || []).forEach((m) => {
      if (isBondedMod(m)) {
        const effect = normalizeBondedEffect(m);
        if (hasFoxIdol && idolBondedEffects.has(effect)) {
          // Bonded mod from an Idol while Fox Idol is socketed -> keep inline
          runeRegular.push(m);
        } else {
          // Non-idol bonded mod (or no Fox Idol socketed) -> collapse
          runeBonded.push(m);
        }
      } else {
        runeRegular.push(m);
      }
    });

    const implicitRegular: Array<string | ItemMod> = show.displayImplicitMods
      ? [...(item.implicitMods || [])]
      : [];

    return { runeRegular, implicitRegular, runeBonded };
  })();
  $: enchantMods = show.displayEnchantMods ? (item.enchantMods ?? []) : [];
  $: crucibleMods = show.displayCrucibleMods ? (item.crucibleMods ?? []) : [];
  $: scourgeMods = show.displayScourgeMods
    ? ((item.scourgeMods ?? []) as Array<string | ItemMod>)
    : [];
  $: scourgeTier =
    show.displayScourgeMods && typeof item.scourged?.tier === "number"
      ? item.scourged.tier
      : null;

  $: classifiedExplicits = (() => {
    const prefixes: Array<{ mod: string | ItemMod; cat: "prefix" | "bonded" }> =
      [];
    const suffixes: Array<{ mod: string | ItemMod; cat: "suffix" | "bonded" }> =
      [];
    const others: Array<{ mod: string | ItemMod; cat: "generic" | "bonded" }> =
      [];

    const allExplicitMods: Array<{ mod: string | ItemMod; forced: boolean }> = [
      ...(show.displayExplicitMods
        ? (item.explicitMods || []).map((mod) => ({ mod, forced: false }))
        : []),
      ...(show.displayBondedMods
        ? (item.bondedMods || []).map((mod) => ({ mod, forced: true }))
        : []),
    ];

    allExplicitMods.forEach(({ mod, forced }) => {
      const bonded = forced || isBondedMod(mod);
      if (typeof mod === "string") {
        others.push({ mod, cat: bonded ? "bonded" : "generic" });
        return;
      }
      const firstTier = mod.mods?.[0]?.tier?.toUpperCase() || "";
      if (firstTier.startsWith("P")) {
        prefixes.push({ mod, cat: bonded ? "bonded" : "prefix" });
      } else if (firstTier.startsWith("S")) {
        suffixes.push({ mod, cat: bonded ? "bonded" : "suffix" });
      } else {
        others.push({ mod, cat: bonded ? "bonded" : "generic" });
      }
    });

    return [...prefixes, ...suffixes, ...others];
  })();

  $: veiledMods = show.displayVeiledMods
    ? ((item.veiledMods ?? []) as Array<string | ItemMod>)
    : [];
  /* ------------------------------------------------------------------ */
  /* Pseudo mods: `statgroup.N` ones are Count / Sum lines at the bottom */
  /* ------------------------------------------------------------------ */
  function isStatGroupMod(m: string | ItemMod): m is ItemMod {
    return (
      typeof m !== "string" && normalizeModHash(m.hash).startsWith("statgroup.")
    );
  }

  $: allPseudoMods = (item.pseudoMods ?? []) as Array<string | ItemMod>;
  $: statGroupMods = allPseudoMods.filter(isStatGroupMod);
  $: pseudoMods = show.displayPseudoMods
    ? allPseudoMods.filter((m) => !isStatGroupMod(m))
    : [];
  $: shownStatGroupMods = isTooltip ? [] : statGroupMods;

  /* ------------------------------------------------------------------ */
  /* Section visibility flags (a divider is only drawn for real content) */
  /* ------------------------------------------------------------------ */
  $: hasEnchantRuneBlock =
    enchantMods.length > 0 ||
    shownRuneRegular.length > 0 ||
    shownRuneBonded.length > 0;
  $: hasExplicitBlock =
    classifiedExplicits.length > 0 ||
    veiledMods.length > 0 ||
    pseudoMods.length > 0;
  $: hasTooltipText =
    isTooltip && (tooltipTexts.desc || tooltipTexts.stats.length > 0);
  $: showMercSkills = !isTooltip && (item.mercenarySkills?.length ?? 0) > 0;

  /* ------------------------------------------------------------------ */
  /* Bottom State Tags (Split, Mirrored, Unidentified, Corrupted, etc.) */
  /* ------------------------------------------------------------------ */
  type BottomState =
    | { kind: "foreseeing" }
    | { kind: "text"; label: string; cls: string };

  $: bottomStates = ((): BottomState[] => {
    const states: BottomState[] = [];

    if (item.split) {
      states.push({ kind: "text", label: "Split", cls: "state-split" });
    }
    if (item.duplicated) {
      states.push({ kind: "text", label: "Mirrored", cls: "state-mirrored" });
    }
    if (item.foreseeing) {
      states.push({ kind: "foreseeing" });
    }
    if (item.identified === false) {
      states.push({
        kind: "text",
        label: "Unidentified",
        cls: "state-corrupted",
      });
    }
    if (item.doubleCorrupted) {
      states.push({
        kind: "text",
        label: "Twice Corrupted",
        cls: "state-corrupted",
      });
    } else if (item.corrupted) {
      states.push({
        kind: "text",
        label: "Corrupted",
        cls: "state-corrupted",
      });
    }
    if (item.sanctified) {
      states.push({
        kind: "text",
        label: "Sanctified",
        cls: "state-sanctified",
      });
    }
    if (scourgeTier !== null) {
      states.push({
        kind: "text",
        label: `Scourge (Tier ${scourgeTier})`,
        cls: "state-scourge",
      });
    }

    return states;
  })();

  /* ------------------------------------------------------------------ */
  /* Portaled Tooltip for Granted Skills, Merc Skills & Socketed Items  */
  /* ------------------------------------------------------------------ */
  const TIP_W = 450;
  let hoveredItem: { item: Item; left: number; top: number } | null = null;

  function openItemTooltip(targetItem: Item, rect: DOMRect) {
    let left = rect.right + 8;
    if (left + TIP_W > window.innerWidth - 8) {
      left = Math.max(8, rect.left - TIP_W - 8);
    }
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 340));
    hoveredItem = { item: targetItem, left, top };
  }

  function closeItemTooltip() {
    hoveredItem = null;
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

{#if effectiveMode === "minimal"}
  <!-- MINIMAL VIEW: no tags, no iLvl, no sockets.
       name + base type (2 lines) | only name | only base type -->
  <div class="minimal-stats {getRarityClass(item)}">
    {#if minimalName}
      <div class="min-name">{minimalName}</div>
    {/if}
    {#if minimalBase}
      <div class={minimalName ? "min-base" : "min-name"}>{minimalBase}</div>
    {/if}
  </div>
{:else}
  <!-- COMPACT & FULL VIEW -->
  <div
    class="stats-container mode-{effectiveMode}"
    class:is-tooltip={isTooltip}
    style="--mod-h: {modHPx}px; --veil-scale: {veilScale}"
  >
    <!-- Tooltip-only Item Name Header -->
    {#if isTooltip}
      <div class="tooltip-header {getRarityClass(item)}">
        {#if item.name}
          <div class="tooltip-item-name">{cleanBracketText(item.name)}</div>
        {/if}
        {#if item.typeLine || item.baseType}
          <div class="tooltip-item-base">
            {cleanBracketText(item.typeLine || item.baseType)}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Properties (hidden by CSS when it renders nothing) -->
    <div class="props-block">
      <ItemProperties
        {item}
        {effectiveMode}
        on:itemhover={(e) => openItemTooltip(e.detail.item, e.detail.rect)}
        on:itemleave={closeItemTooltip}
      />
    </div>

    <!-- Enchant + Rune + Bonded -->
    {#if hasEnchantRuneBlock}
      <div class="section">
        <div class="stat-group">
          {#each enchantMods as mod}
            <ItemModifier
              {mod}
              {realm}
              category="enchant"
              compact={isCompact}
            />
          {/each}
          {#if enchantMods.length > 0 && (shownRuneRegular.length > 0 || shownRuneBonded.length > 0)}
            <div class="separator-line"></div>
          {/if}
          {#each shownRuneRegular as mod}
            <ItemModifier {mod} {realm} category="rune" compact={isCompact} />
          {/each}
          {#if shownRuneBonded.length > 0}
            {#if !isTooltip}
              <button
                type="button"
                class="btn-bonded-inline"
                on:click|stopPropagation={() =>
                  (showBondedMods = !showBondedMods)}
              >
                {showBondedMods
                  ? "▾ Hide Bonded"
                  : `▸ +${shownRuneBonded.length} Bonded`}
              </button>
            {/if}
            {#if isTooltip || showBondedMods}
              {#each shownRuneBonded as bMod}
                <ItemModifier
                  mod={bMod}
                  {realm}
                  category="bonded"
                  compact={isCompact}
                />
              {/each}
            {/if}
          {/if}
        </div>
      </div>
    {/if}

    <!-- Granted / socketed skills (follow displayImplicitMods) -->
    {#if extractedSkills.length > 0}
      <div class="section">
        <GrantedSkills
          skills={extractedSkills}
          on:itemhover={(e) => openItemTooltip(e.detail.item, e.detail.rect)}
          on:itemleave={closeItemTooltip}
        />
      </div>
    {/if}

    <!-- Scourge Mods (above implicit mods) -->
    {#if scourgeMods.length > 0}
      <div class="section">
        <div class="stat-group">
          {#each scourgeMods as mod}
            <ItemModifier
              {mod}
              {realm}
              category="scourge"
              compact={isCompact}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Implicit Mods -->
    {#if separatedMods.implicitRegular.length > 0}
      <div class="section">
        <div class="stat-group">
          {#each separatedMods.implicitRegular as mod}
            <ItemModifier
              {mod}
              {realm}
              category="implicit"
              compact={isCompact}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Secondary Description Text (above explicit stats, #1BA274) -->
    {#if secDescrTextRaw}
      <div class="section">
        <div class="stat-group sec-descr-group">
          <div class="sec-descr-text">
            <KeywordText text={secDescrTextRaw} />
          </div>
        </div>
      </div>
    {/if}

    {#if hasTooltipText}
      <div class="section">
        <div class="stat-group tooltip-text-group">
          {#each tooltipTexts.stats as line}
            <div class="tooltip-text-line stat">
              <KeywordText text={line} />
            </div>
          {/each}
          {#if tooltipTexts.desc}
            <div class="tooltip-text-line desc">
              <KeywordText text={tooltipTexts.desc} />
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Explicit Mods + Veiled / Unrevealed Mods + Pseudo Mods -->
    {#if hasExplicitBlock}
      <div class="section">
        <div class="stat-group">
          {#each classifiedExplicits as entry}
            <ItemModifier
              mod={entry.mod}
              {realm}
              category={entry.cat}
              compact={isCompact}
            />
          {/each}

          <VeiledMods mods={veiledMods} {isPoe2} compact={isCompact} />

          {#each pseudoMods as pMod}
            <ItemModifier
              mod={pMod}
              {realm}
              category="pseudo"
              compact={isCompact}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Crucible Mods (Under Explicit Mods) -->
    {#if crucibleMods.length > 0}
      <div class="section">
        <div class="stat-group">
          {#each crucibleMods as mod}
            <ItemModifier
              {mod}
              {realm}
              category="crucible"
              compact={isCompact}
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Notable Properties -->
    {#if item.notableProperties && item.notableProperties.length > 0}
      <div class="section">
        <div class="stat-group notable-group">
          {#each item.notableProperties as notable}
            <div class="notable-block">
              <div class="notable-title">
                <KeywordText text={notable.name} />
              </div>
              {#each notable.values || [] as [line]}
                <div class="notable-line">
                  <KeywordText text={line} />
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Mercenary skills -->
    {#if showMercSkills}
      <div class="section">
        <MercenarySkills
          skills={item.mercenarySkills ?? []}
          {item}
          on:itemhover={(e) => openItemTooltip(e.detail.item, e.detail.rect)}
          on:itemleave={closeItemTooltip}
        />
      </div>
    {/if}

    <!-- Bottom State Tags (Split, Mirrored, Corrupted, Unidentified, Scourge, etc.) -->
    {#if bottomStates.length > 0}
      <div class="section">
        <div class="stat-group bottom-state-group">
          {#each bottomStates as state}
            {#if state.kind === "foreseeing"}
              <div
                class="item-popup__desc-text--foreseeing"
                style="--foresight-url: url('{FORESIGHT_ICON}')"
                title="Foreseeing"
              ></div>
            {:else}
              <div class="state-stat-line {state.cls}">{state.label}</div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Stat group lines (statgroup.N pseudo mods: Count, Sum, Sum2, ...) -->
    {#if shownStatGroupMods.length > 0}
      <div class="section">
        <StatGroupSummary mods={shownStatGroupMods} compact={isCompact} />
      </div>
    {/if}
  </div>
{/if}

{#if hoveredItem}
  <div
    class="stats-skill-tooltip"
    class:r-gem={hoveredItem.item.frameTypeId === "Gem"}
    use:portal
    style:left="{hoveredItem.left}px"
    style:top="{hoveredItem.top}px"
    style:width="{TIP_W}px"
  >
    <svelte:self
      item={hoveredItem.item}
      {realm}
      styleMode="compact"
      isTooltip={true}
      tileWidth={TIP_W}
    />
  </div>
{/if}

<style>
  /* Minimal Mode */
  .minimal-stats {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    min-width: 0;
  }
  .min-name {
    font-size: 0.96rem;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .min-base {
    font-size: 0.9rem;
    line-height: 1.2;
    opacity: 0.88;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Full & Compact Modes */
  .stats-container {
    display: flex;
    flex-direction: column;
    gap: 0.24rem;
    width: 100%;
    text-align: center;
  }
  .stats-container.mode-compact {
    gap: 0.16rem;
  }

  /* Tooltip Header */
  .tooltip-header {
    text-align: center;
    padding: 0.25rem 0.5rem;
    margin-bottom: 0.1rem;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.06) 50%,
      transparent
    );
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  }
  .tooltip-item-name {
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .tooltip-item-base {
    font-size: 0.95rem;
    opacity: 0.9;
    line-height: 1.2;
  }

  /* Rarities */
  .rarity-normal {
    color: #c8c8c8;
  }
  .rarity-magic {
    color: #8888ff;
  }
  .rarity-rare {
    color: #ffff77;
  }
  .rarity-unique {
    color: #af6025;
  }
  .rarity-gem {
    color: #1ba29b;
  }
  .rarity-currency {
    color: #aa9e82;
  }

  /* Groups */
  .stat-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
  }

  /* Dividers: a section draws its own divider ABOVE itself. Sections only
     exist when they have content, so dividers can never double up or dangle. */
  .section {
    display: flex;
    flex-direction: column;
    gap: inherit;
    width: 100%;
  }
  .section::before {
    content: "";
    flex-shrink: 0;
    height: 1px;
    margin: 0.05rem 0;
    background: linear-gradient(
      90deg,
      transparent,
      #283042 20%,
      #283042 80%,
      transparent
    );
  }

  .props-block {
    display: flex;
    flex-direction: column;
    gap: inherit;
    width: 100%;
  }
  /* No properties -> collapse it, and the first section needs no divider */
  .props-block:not(:has(*)) {
    display: none;
  }
  .props-block:not(:has(*)) + .section::before {
    display: none;
  }

  /* Only used between enchant and rune lines inside one group */
  .separator-line {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      #283042 20%,
      #283042 80%,
      transparent
    );
    margin: 0.05rem 0;
  }

  /* Secondary Description Text (Skills / Gems) */
  .sec-descr-group {
    align-items: center;
    padding: 0 0.5rem;
    box-sizing: border-box;
  }
  .sec-descr-text {
    color: #1ba274;
    font-size: 0.98rem;
    line-height: 1.25;
    text-align: center;
  }
  .mode-compact .sec-descr-text {
    font-size: 0.92rem;
  }

  /* Compact text-only Bonded Toggle inside Rune group */
  .btn-bonded-inline {
    align-self: center;
    background: none;
    border: none;
    padding: 0 4px;
    margin: 0;
    color: #8b95a5;
    font-family: inherit;
    font-size: 0.86rem;
    line-height: 1.15;
    cursor: pointer;
  }
  .btn-bonded-inline:hover {
    color: #cbd5e1;
  }

  .tooltip-text-group {
    align-items: center;
    gap: 2px;
  }
  .tooltip-text-line {
    text-align: center;
    font-size: 0.95rem;
    line-height: 1.25;
  }
  .tooltip-text-line.stat {
    color: #6588ff;
  }
  .tooltip-text-line.desc {
    color: #8b95a5;
    font-style: italic;
  }

  /* Notable Properties */
  .notable-group {
    gap: 0.22rem;
    text-align: center;
  }
  .notable-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1px;
  }
  .notable-title {
    font-size: 0.98rem;
    font-weight: 700;
    color: #b8b09c;
  }
  .notable-line {
    font-size: 0.92rem;
    color: #8b95a5;
    line-height: 1.22;
  }

  /* Mercenary Skills */
  .mercenary-skill-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }
  :global(.skill-icon) {
    width: 20px;
    height: 20px;
    border-radius: 0;
  }
  .skill-name {
    color: #cbd5e1;
    font-size: 0.94rem;
  }

  /* Bottom Exclusive State & Split */
  .bottom-state-group {
    align-items: center;
    text-align: center;
  }
  .state-stat-line {
    font-size: 1.02rem;
    font-weight: 600;
    line-height: 1.22;
  }
  .state-corrupted {
    color: #d20000;
  }
  .state-mirrored {
    color: #6588ff;
  }
  .state-sanctified {
    color: #d6ba70;
  }
  .state-split {
    color: #6588ff;
  }
  .state-scourge {
    color: #ff6e25;
  }

  .item-popup__desc-text--foreseeing::before {
    display: block;
    content: " ";
    margin: 0 auto;
    text-align: center;
    height: 35px;
    width: 56px;
    background: var(--foresight-url) no-repeat center / contain;
  }

  /* Portaled Skill/Socket Tooltip */
  .stats-skill-tooltip {
    position: fixed;
    z-index: 100000;
    max-height: 80vh;
    overflow-y: auto;
    box-sizing: border-box;
    padding: 0.55rem 0.65rem;
    background: rgba(4, 5, 7, 0.97);
    border: 1px solid #3a3326;
    border-top: 2px solid #8a6a2e;
    border-radius: 0;
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.85),
      0 0 0 1px #000;
    pointer-events: none;
    scrollbar-width: thin;
  }
  /* Portaled to <body>, so it loses the row's --rc tokens */
  .stats-skill-tooltip.r-gem {
    --rc: #1ba29b;
    --rc-rgb: 27, 162, 155;
  }
</style>
