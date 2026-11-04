<!-- src/lib/trade/components/item/ItemStats.svelte -->
<script lang="ts">
  import type { Item, ItemMod, ItemProperty } from "$lib/types/tradeItem";
  import type {
    ResolvedDisplayStyle,
    TileDisplayOptions,
  } from "$lib/types/types";
  import ItemModifier from "../item/ItemModifier.svelte";
  import ItemTooltip from "./ItemTooltip.svelte";
  import { separatorCssVars } from "./separators";
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
  import ProgressBar from "./stats/ProgressBar.svelte";
  import LogbookMods from "./stats/LogbookMods.svelte";
  import UltimatumMods from "./stats/UltimatumMods.svelte";
  import GemTabs from "./stats/GemTabs.svelte";
  import PropertyLine from "./stats/PropertyLine.svelte";
  import { isRenderableProp } from "./stats/propertyGroups";
  import CdnImage from "./CdnImage.svelte";

  $: additionalProps = (item.additionalProperties ?? []).filter(
    isRenderableProp,
  );
  export let displayOptions: Partial<TileDisplayOptions> | null = null;
  export let item: Item;
  export let realm: string = "poe";
  export let styleMode: ResolvedDisplayStyle = "full";
  export let tileWidth: number = 600;
  export let isTooltip: boolean = false;

  const HYBRID_TITLE_BG =
    "/protected/image/item/popup/hybrid-title.png?v=1709582916256&key=nu0qDrILwqRuP7H7QIIrpQ";
  const VAAL_TITLE_BG =
    "/protected/image/item/popup/vaal-title.png?v=1709582916256&key=vFmTmECcv9so6pXyNZv-RQ";
  let showBondedMods = false;

  $: effectiveMode = isTooltip ? "compact" : styleMode;
  $: isCompact = effectiveMode === "compact";
  $: isPoe2 = (item.realm || realm || "").toLowerCase() === "poe2";

  $: show = normalizeDisplayOptions(isTooltip ? null : displayOptions);

  /* ------------------------------------------------------------------ */
  /* Mod row height + PoE2 veiled scale                                 */
  /* ------------------------------------------------------------------ */
  $: sepVars = separatorCssVars(item.rarity);

  $: monsterLevelProp = item.monsterLevel
    ? ({
        name: "Monster Level",
        values: [[String(item.monsterLevel), 0]],
      } as ItemProperty)
    : null;

  /* Progress bars */
  $: incubated = item.incubatedItem ?? null;
  $: enshrouded = item.enshrouded ?? null;
  $: hasProgressBlock = !!incubated || !!enshrouded;
  const ratio = (p: number, t: number) => (t > 0 ? p / t : 0);

  /* Gem tabs (interactive, so not in portaled tooltips - those keep tooltipTexts) */
  $: gemTabs =
    !isTooltip && show.displayExplicitMods ? (item.gemTabs ?? []) : [];

  /* Logbook / Ultimatum */
  $: logbookMods = item.logbookMods ?? [];
  $: ultimatumMods = item.ultimatumMods ?? [];

  /* Hybrid gem: rendered as its own title + nested ItemStats */
  $: hybridItem = ((): Item | null => {
    const hy = item.hybrid;
    if (!hy?.baseTypeName) return null;
    return {
      name: "",
      typeLine: hy.baseTypeName,
      baseType: hy.baseTypeName,
      ilvl: 0,
      identified: true,
      verified: true,
      w: 1,
      h: 1,
      icon: "",
      frameTypeId: item.frameTypeId,
      realm: item.realm,
      properties: hy.properties ?? [],
      explicitMods: hy.explicitMods ?? [],
      secDescrText: hy.secDescrText,
    } as Item;
  })();

  $: modHPx = isCompact ? 23 : 26;
  $: veilScale = modHPx / 38;
  $: modFontSize = isCompact ? "0.96rem" : "1.04rem";

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
  $: descrTextRaw = "".trim();
  $: secDescrTextRaw = (item.secDescrText || "").trim();
  $: prophecyTextRaw = (item.prophecyText || "").trim();
  $: hasDescriptions = !!(descrTextRaw || secDescrTextRaw || prophecyTextRaw);

  $: flavourLines = isTooltip
    ? (item.flavourText ?? [])
        .map((l) => l.replace(/\r\n?/g, "\n").trim())
        .filter(Boolean)
    : [];

  // Gem / socketable stats (tooltip only)
  $: tooltipStats = ((): string[] => {
    const tab = (item.gemTabs as any[] | undefined)?.[0];
    return (tab?.pages?.[0]?.stats ?? []).map((t: string) => t.trim());
  })();
  $: hasTooltipText = isTooltip && tooltipStats.length > 0;
  // Granted / socketed skills follow the implicit-mods option
  $: extractedSkills = show.displayImplicitMods ? extractSkills(item) : [];

  /* ------------------------------------------------------------------ */
  /* Modifiers & Bonded Handling                                        */
  /* ------------------------------------------------------------------ */
  $: showRunes = isTooltip || ($displayRune && show.displayRuneMods);
  $: shownRuneRegular = showRunes ? separatedMods.runeRegular : [];
  $: shownRuneBonded = showRunes ? separatedMods.runeBonded : [];

  // Only mods starting with [ShamanOnlyMods|<label>] are bonded rune mods
  const BONDED_PREFIX_RE = /^\s*\[ShamanOnlyMods\|([^\]]*)\]\s*:?\s*/i;
  const IDOL_PROP_RE = /^\[?idol(?:\|[^\]]*)?\]?$/i;

  const modText = (mod: string | ItemMod) =>
    typeof mod === "string" ? mod : mod.description || "";

  function isBondedMod(mod: string | ItemMod): boolean {
    return BONDED_PREFIX_RE.test(modText(mod));
  }

  function normalizeBondedEffect(mod: string | ItemMod): string {
    return cleanBracketText(modText(mod).replace(BONDED_PREFIX_RE, ""))
      .replace(/^\s*Bonded\s*:/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /**
   * Socketed idols list bondedMods with an item-category prefix such as:
   *   "Body Armours: 15% chance for [Charm|Charms] you use to not consume Charges"
   * whereas item.runeMods has only:
   *   "[ShamanOnlyMods|Bonded]: 15% chance for [Charm|Charms] you use to not consume Charges"
   * We index both the full normalized string and the string after `<Category>:`.
   */
  function extractIdolEffectVariants(mod: string | ItemMod): string[] {
    const base = normalizeBondedEffect(mod);
    if (!base) return [];
    const variants = [base];
    const colonIdx = base.indexOf(":");
    if (colonIdx !== -1) {
      const stripped = base.slice(colonIdx + 1).trim();
      if (stripped) variants.push(stripped);
    }
    return variants;
  }

  function isIdolItem(it: Item): boolean {
    return (it.properties || []).some((p) => {
      const raw = (p.name ?? "").trim();
      const cleaned = cleanBracketText(raw).trim();
      return IDOL_PROP_RE.test(raw) || /^idol$/i.test(cleaned);
    });
  }

  // Header text comes from the mod itself (e.g. Bonded / 絆)
  $: bondedLabel = (() => {
    for (const m of [...(item.runeMods || []), ...(item.bondedMods || [])]) {
      const l = modText(m).match(BONDED_PREFIX_RE)?.[1]?.trim();
      if (l) return l;
    }
    return "Bonded";
  })();

  $: hasFoxIdol = (item.runeMods || []).some(
    (m) =>
      typeof m !== "string" &&
      normalizeModHash(m.hash).endsWith("rune.stat_726496846"),
  );

  $: idolBondedEffects = (() => {
    const set = new Set<string>();
    if (!hasFoxIdol) return set;

    for (const si of item.socketedItems || []) {
      if (!isIdolItem(si)) continue;

      for (const bm of si.bondedMods || []) {
        for (const v of extractIdolEffectVariants(bm)) {
          set.add(v);
        }
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
        if (hasFoxIdol && effect && idolBondedEffects.has(effect)) {
          // Bonded rune mod coming specifically from a socketed Idol when Fox Idol is present
          runeRegular.push(m);
        } else {
          // Non-idol bonded rune mod (e.g. Greater Iron Rune) or no Fox Idol -> collapsed
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

  // builtInSupport is treated as an enchant modifier
  $: builtInSupportMods = ((): Array<string | ItemMod> => {
    const bis = (item as any).builtInSupport;
    if (!bis) return [];
    return Array.isArray(bis) ? bis : [bis];
  })();

  $: enchantMods = show.displayEnchantMods
    ? [...builtInSupportMods, ...(item.enchantMods ?? [])]
    : [];
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

    const explicitList = show.displayExplicitMods
      ? item.explicitMods || []
      : [];

    explicitList.forEach((mod) => {
      const bonded = isBondedMod(mod);
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

  // item.bondedMods displayed directly BELOW explicit mods with no divider
  $: directBondedMods = show.displayBondedMods
    ? ((item.bondedMods ?? []) as Array<string | ItemMod>)
    : [];

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
    directBondedMods.length > 0 ||
    veiledMods.length > 0 ||
    pseudoMods.length > 0;
  $: showMercSkills = !isTooltip && (item.mercenarySkills?.length ?? 0) > 0;

  /* ------------------------------------------------------------------ */
  /* Bottom State Tags (Split, Mirrored, Unidentified, Corrupted, etc.) */
  /* ------------------------------------------------------------------ */
  type BottomState =
    | { kind: "foreseeing" }
    | { kind: "text"; label: string; cls: string };

  $: bottomStates = ((): BottomState[] => {
    const states: BottomState[] = [];

    if (item.unmodifiableExceptChaos) {
      states.push({
        kind: "text",
        label:
          "Modifiable only with Chaos Orbs, Vaal Orbs, Delirium Orbs and Chisels",
        cls: "state-info",
      });
    } else if (item.unmodifiable) {
      states.push({ kind: "text", label: "Unmodifiable", cls: "state-info" });
    }
    if (item.split) {
      states.push({ kind: "text", label: "Split", cls: "state-split" });
    }
    if (item.duplicated) {
      states.push({ kind: "text", label: "Mirrored", cls: "state-mirrored" });
    }
    if (item.foreseeing) {
      states.push({ kind: "foreseeing" });
    }
    if (!item.identified) {
      const t = item.unidentifiedTier;
      states.push({
        kind: "text",
        label: t != null ? `Unidentified (Tier ${t})` : "Unidentified",
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
    if (item.cisRaceReward)
      states.push({
        kind: "text",
        label: "CIS Race Reward",
        cls: "state-race",
      });
    if (item.seaRaceReward)
      states.push({
        kind: "text",
        label: "SEA Race Reward",
        cls: "state-race",
      });
    if (item.thRaceReward)
      states.push({ kind: "text", label: "TH Race Reward", cls: "state-race" });
    return states;
  })();

  /* ------------------------------------------------------------------ */
  /* Portaled Tooltip for Granted Skills, Merc Skills & Socketed Items  */
  /* ------------------------------------------------------------------ */
  const TIP_W = 450;
  let hoveredItem: { item: Item; rect: DOMRect } | null = null;
  function openItemTooltip(targetItem: Item, rect: DOMRect) {
    hoveredItem = { item: targetItem, rect };
  }
  function closeItemTooltip() {
    hoveredItem = null;
  }
</script>

{#if effectiveMode === "minimal"}
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
    style="--mod-h: {modHPx}px; --mod-font-size: {modFontSize}; --veil-scale: {veilScale}; {sepVars}"
  >
    <!-- Properties (hidden by CSS when it renders nothing) -->
    <div class="props-block">
      {#if monsterLevelProp}
        <PropertyLine prop={monsterLevelProp} {isPoe2} />
      {/if}
      <ItemProperties
        {item}
        {realm}
        {effectiveMode}
        on:itemhover={(e) => openItemTooltip(e.detail.item, e.detail.rect)}
        on:itemleave={closeItemTooltip}
      />
    </div>

    <!-- Additional Properties (above implicit, enchant, and rune mods) -->
    {#if additionalProps.length > 0}
      <div class="section">
        <div class="additional-line">
          {#each additionalProps as p}
            <div class="prop-line">
              <PropertyLine prop={p} {isPoe2} />
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Enchant (incl. builtInSupport) + Rune + Bonded Rune -->
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
                  ? `▾ - ${bondedLabel}`
                  : `▸ +${shownRuneBonded.length} ${bondedLabel}`}
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
    {#if hasDescriptions}
      <div class="section">
        <div class="stat-group descr-group">
          {#if descrTextRaw}
            <div class="descr-text"><KeywordText text={descrTextRaw} /></div>
          {/if}
          {#if secDescrTextRaw}
            <div class="sec-descr-text">
              <KeywordText text={secDescrTextRaw} />
            </div>
          {/if}
          {#if prophecyTextRaw}
            <div class="prophecy-text">
              <KeywordText text={prophecyTextRaw} />
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if hasTooltipText}
      <div class="section">
        <div class="stat-group tooltip-text-group">
          {#each tooltipStats as line}
            <div class="tooltip-text-line stat">
              <KeywordText text={line} />
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if ultimatumMods.length > 0}
      <div class="section">
        <UltimatumMods mods={ultimatumMods} />
      </div>
    {/if}

    <!-- Explicit Mods + Bonded Mods (below explicit, no divider) + Veiled + Pseudo -->
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

          {#each directBondedMods as bMod}
            <ItemModifier
              mod={bMod}
              {realm}
              category="bonded"
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

    {#if gemTabs.length > 0}
      <div class="section">
        <GemTabs tabs={gemTabs} {realm} compact={isCompact} />
      </div>
    {/if}

    {#if logbookMods.length > 0}
      <div class="section">
        <LogbookMods {logbookMods} {realm} compact={isCompact} />
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

    {#if hybridItem}
      <div class="section hybrid-section">
        <div class="hybrid-title {getRarityClass(item)}">
          <CdnImage
            src={item.hybrid?.isVaalGem ? VAAL_TITLE_BG : HYBRID_TITLE_BG}
            alt=""
            className="hybrid-bg"
          />
          <span class="hybrid-name">{hybridItem.typeLine}</span>
        </div>
        <svelte:self
          item={hybridItem}
          {realm}
          styleMode={effectiveMode}
          displayOptions={isTooltip ? null : displayOptions}
          {tileWidth}
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

    {#if hasProgressBlock}
      <div class="section">
        <div class="stat-group progress-group">
          {#if incubated}
            <ProgressBar
              label="Incubating {incubated.name}"
              text="{incubated.progress}/{incubated.total} Level {incubated.level}+ Monster Kills"
              ratio={ratio(incubated.progress, incubated.total)}
            />
          {/if}
          {#if enshrouded}
            <ProgressBar
              text="{enshrouded.progress}/{enshrouded.total}"
              ratio={ratio(enshrouded.progress, enshrouded.total)}
            />
          {/if}
        </div>
      </div>
    {/if}

    {#if flavourLines.length > 0}
      <div class="section">
        <div class="stat-group flavour-group">
          {#each flavourLines as line}
            <div class="flavour-text"><KeywordText text={line} /></div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if hoveredItem}
  <ItemTooltip item={hoveredItem.item} {realm} rect={hoveredItem.rect}>
    <svelte:self
      item={hoveredItem.item}
      {realm}
      styleMode="compact"
      isTooltip={true}
      tileWidth={TIP_W}
    />
  </ItemTooltip>
{/if}

<style>
  /* Minimal Mode (acts as the row title in minimal view -> bold) */
  .minimal-stats {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    min-width: 0;
  }
  .min-name,
  .min-base {
    font-size: 0.96rem;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .min-base {
    font-size: 0.9rem;
    opacity: 0.88;
  }

  /* Full & Compact Modes: no bold anywhere inside stats */
  .stats-container {
    display: flex;
    flex-direction: column;
    gap: 0.24rem;
    width: 100%;
    min-width: 0;
    text-align: center;
    font-weight: 400;
  }
  .stats-container :global(*) {
    font-weight: 400 !important;
  }
  .stats-container.mode-compact {
    gap: 0.16rem;
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

  .section {
    display: flex;
    flex-direction: column;
    gap: inherit;
    width: 100%;
    min-width: 0;
  }
  .section::before {
    content: "";
    flex-shrink: 0;
    height: var(--sep-h, 8px);
    margin: 1px 0;
    background: var(--sep-img, none) center no-repeat;
  }

  .props-block {
    display: flex;
    flex-direction: column;
    gap: inherit;
    width: 100%;
    min-width: 0;
  }
  .props-block:not(:has(*)) {
    display: none;
  }
  .props-block:not(:has(*)) + .section::before {
    display: none;
  }

  .separator-line {
    height: var(--sep-h, 8px);
    margin: 1px 0;
    background: var(--sep-img, none) center no-repeat;
  }

  /* Secondary Description Text (Skills / Gems) */
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
    font-weight: 400;
    color: #b8b09c;
  }
  .notable-line {
    font-size: 0.92rem;
    color: #8b95a5;
    line-height: 1.22;
  }

  /* Bottom State Tags (Corrupted, Mirrored, Split, etc.):
     exact same font size as ItemModifier and regular weight (not bold) */
  .bottom-state-group {
    align-items: center;
    text-align: center;
  }
  .state-stat-line {
    margin-top: -2px;
    font-size: 20px;
    font-weight: 400;
    line-height: 24px;
  }
  .mode-compact .state-stat-line {
    font-size: var(--mod-font-size, 0.96rem);
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
  .state-info {
    color: #6588ff;
  }
  .state-race {
    color: #d6ba70;
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

  .descr-group {
    align-items: center;
    padding: 0 0.5rem;
    box-sizing: border-box;
    gap: 0.2rem;
  }
  .descr-text {
    color: #8b95a5;
    font-style: italic;
    text-align: center;
    line-height: 1.25;
    white-space: pre-line;
  }
  .prophecy-text {
    color: #d6ba70;
    text-align: center;
    line-height: 1.25;
    white-space: pre-line;
  }
  .flavour-group {
    align-items: center;
    padding: 0 0.5rem;
    box-sizing: border-box;
  }
  .flavour-text {
    color: #af6025;
    font-style: italic;
    text-align: center;
    line-height: 1.25;
    white-space: pre-line;
  }

  .progress-group {
    align-items: center;
    gap: 0.3rem;
  }

  .hybrid-section::before {
    display: none;
  }
  .hybrid-title {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 0.5rem;
    font-size: 1rem;
    font-weight: 700 !important;
    line-height: 1.2;
  }
  .hybrid-title :global(.hybrid-bg) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
  }
  .hybrid-name {
    position: relative;
    z-index: 1;
    font-weight: 700 !important;
  }
  .additional-line {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.12rem;
    width: 100%;
    min-width: 0;
    text-align: center;
  }
</style>
