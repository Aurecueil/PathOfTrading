<!-- src/lib/trade/components/item/MercenarySkills.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    mercenarySkillsByHash,
    mercenarySupportsByHash,
    compactMercenaryDisplay,
  } from "$lib/trade/tradeStore";
  import CdnImage from "$lib/trade/components/item/CdnImage.svelte";
  import type {
    Item,
    ItemProperty,
    MercenarySkill,
    MercenarySkillSupport,
  } from "$lib/types/tradeItem";
  import type {
    dataMercenarySkill,
    dataMercenarySupport,
    MercenarySkillLevel,
  } from "$lib/types/mercenary";

  export let skills: MercenarySkill[] = [];
  export let item: Item | null = null;

  // The tooltip itself is rendered by ItemStats (one shared portal).
  const dispatch = createEventDispatcher<{
    itemhover: { item: Item; rect: DOMRect };
    itemleave: void;
  }>();

  const ROMAN_TIERS: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
  };

  const IGNORED_SKILL_TYPES = new Set([
    "ProjectilesFromUser",
    "CanRapidFire",
    "AreaSpell",
    "InstantNoRepeatWhenHeld",
    "InstantShiftAttackForLeftMouse",
  ]);

  function toRoman(tier?: number): string {
    if (!tier) return "";
    return ROMAN_TIERS[tier] ?? String(tier);
  }

  function getSupportIconUrl(supportData?: dataMercenarySupport): string {
    if (!supportData?.icon) return "";
    const webpPath = supportData.icon.replace(/\.dds$/i, ".webp");
    return `https://repoe-fork.github.io/${webpPath}`;
  }

  function formatMsToSeconds(ms: number): string {
    const sec = ms >= 50 ? ms / 1000 : ms;
    return `${sec.toFixed(2)}s`;
  }

  function filterSkillTypes(types?: string[]): string[] {
    if (!types) return [];
    return types.filter(
      (t) =>
        t && !t.toLowerCase().endsWith("able") && !IGNORED_SKILL_TYPES.has(t),
    );
  }

  /**
   * Extracts "Mercenary Level" from item properties (default to 83 if not found).
   */
  function getMercenaryLevel(targetItem?: Item | null): number {
    if (!targetItem?.properties) return 83;
    for (const prop of targetItem.properties) {
      if (prop.name?.toLowerCase() === "mercenary level") {
        const valStr = prop.values?.[0]?.[0];
        const parsed = parseInt(valStr, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 83;
  }

  /**
   * Finds the highest per_level entry whose required_level <= mercenaryLevel.
   */
  function getBestSkillLevel(
    repoeSkill?: dataMercenarySkill,
    mercenaryLevel = 83,
  ): [MercenarySkillLevel, number] | undefined {
    if (!repoeSkill?.per_level) return undefined;

    let bestLevelKey: string | undefined = undefined;
    let bestLevel: MercenarySkillLevel | undefined = undefined;
    let highestReq = -1;

    for (const [key, lvlObj] of Object.entries(repoeSkill.per_level)) {
      const req = lvlObj.required_level ?? 0;
      if (req <= mercenaryLevel && req > highestReq) {
        highestReq = req;
        bestLevelKey = key;
        bestLevel = lvlObj;
      }
    }

    // Fallback to the first level if none matched
    if (!bestLevel || !bestLevelKey) {
      const entries = Object.entries(repoeSkill.per_level);
      if (entries.length === 0) return undefined;
      [bestLevelKey, bestLevel] = entries[0];
    }

    return [bestLevel, Number(bestLevelKey)];
  }

  function extractStatLines(
    statTextMap?: Record<string, string>,
    tooltipOrder?: string[],
  ): string[] {
    if (!statTextMap) return [];

    const rawValues: string[] = [];
    const seenKeys = new Set<string>();

    if (tooltipOrder && tooltipOrder.length > 0) {
      for (const key of tooltipOrder) {
        if (key in statTextMap && statTextMap[key]) {
          rawValues.push(statTextMap[key]);
          seenKeys.add(key);
        }
      }
    }

    for (const [key, val] of Object.entries(statTextMap)) {
      if (!seenKeys.has(key) && val) {
        rawValues.push(val);
      }
    }

    const lines: string[] = [];
    for (const val of rawValues) {
      for (const line of String(val).split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) lines.push(trimmed);
      }
    }
    return lines;
  }

  function extractSkillStatLines(
    repoeSkill?: dataMercenarySkill,
    bestLvl?: MercenarySkillLevel,
  ): string[] {
    if (!repoeSkill) return [];

    const combinedMap: Record<string, string> = {};

    // 1. Get stats from best matching level
    if (bestLvl?.stat_text) {
      Object.assign(combinedMap, bestLvl.stat_text);
    }

    // 2. Add/override with static stat_text
    if (repoeSkill.static?.stat_text) {
      Object.assign(combinedMap, repoeSkill.static.stat_text);
    }

    return extractStatLines(combinedMap, repoeSkill.tooltip_order);
  }

  function buildSkillGemItem(
    itemSkill: MercenarySkill,
    repoeSkill?: dataMercenarySkill,
  ): Item {
    const name =
      itemSkill.name ||
      repoeSkill?.active_skill?.display_name ||
      repoeSkill?.name ||
      "Unknown Skill";

    const description =
      repoeSkill?.description || repoeSkill?.active_skill?.description || "";

    const properties: ItemProperty[] = [];
    const mercLvl = getMercenaryLevel(item);

    const [bestLvl, level] = getBestSkillLevel(repoeSkill, mercLvl) ?? [];

    const filteredTypes = filterSkillTypes(repoeSkill?.active_skill?.types);
    if (filteredTypes.length > 0) {
      const numGroups = Math.ceil(filteredTypes.length / 5);
      const baseSize = Math.floor(filteredTypes.length / numGroups);
      const remainder = filteredTypes.length % numGroups;

      let currentIndex = 0;
      for (let i = 0; i < numGroups; i++) {
        const groupSize = baseSize + (i < remainder ? 1 : 0);
        const group = filteredTypes.slice(
          currentIndex,
          currentIndex + groupSize,
        );
        currentIndex += groupSize;

        properties.push({
          displayMode: 0,
          name: group.join(", "),
          values: [],
        });
      }
    }

    properties.push({
      displayMode: 0,
      name: "Level",
      values: [[`${level}`, 0]],
    });

    const getProp = <K extends keyof MercenarySkillLevel>(key: K) => {
      return (
        bestLvl?.[key] ??
        (repoeSkill?.static as Record<string, any>)?.[key] ??
        (repoeSkill as Record<string, any>)?.[key]
      );
    };

    // 1. Cooldown Time & Stored Uses
    const cooldown = getProp("cooldown");
    const storedUses = getProp("stored_uses");

    if (typeof cooldown === "number" && cooldown > 0) {
      const cdText =
        storedUses && storedUses > 1
          ? `${formatMsToSeconds(cooldown)} (${storedUses} uses)`
          : formatMsToSeconds(cooldown);

      properties.push({
        displayMode: 0,
        name: "Cooldown Time",
        values: [[cdText, 0]],
      });
    }

    // 2. Cast Time
    const castTime = getProp("cast_time" as keyof MercenarySkillLevel);
    if (typeof castTime === "number" && castTime > 0) {
      properties.push({
        displayMode: 0,
        name: "Cast Time",
        values: [[formatMsToSeconds(castTime), 0]],
      });
    }

    // 3. Costs
    const costs = getProp("costs");
    if (costs && typeof costs === "object") {
      for (const [resource, amount] of Object.entries(costs)) {
        if (typeof amount === "number" && amount > 0) {
          properties.push({
            displayMode: 0,
            name: `${resource} Cost`,
            values: [[String(amount), 0]],
          });
        }
      }
    }

    // 4. Attack Speed Multiplier
    const attackSpeedMult = getProp("attack_speed_multiplier");
    if (typeof attackSpeedMult === "number") {
      properties.push({
        displayMode: 0,
        name: "Attack Speed",
        values: [[`${100 + attackSpeedMult}% of Base`, 0]],
      });
    }

    // 5. Damage Multiplier
    const damageMult = getProp("damage_multiplier");
    if (typeof damageMult === "number") {
      const formattedDamage = (100 + damageMult / 100).toFixed(1);
      properties.push({
        displayMode: 0,
        name: "Attack Damage",
        values: [[`${formattedDamage}% of Base`, 0]],
      });
    }

    // 6. Damage Effectiveness
    const damageEff = getProp("damage_effectiveness");
    if (typeof damageEff === "number") {
      properties.push({
        displayMode: 0,
        name: "Effectiveness of Added Damage",
        values: [[`${100 + damageEff}%`, 0]],
      });
    }

    // 7. Critical Strike Chance
    const critChance = getProp("crit_chance");
    if (typeof critChance === "number") {
      properties.push({
        displayMode: 0,
        name: "Critical Strike Chance",
        values: [[`${critChance / 100}%`, 0]],
      });
    }

    const stats = extractSkillStatLines(repoeSkill, bestLvl);

    return {
      baseType: name,
      descrText: "",
      frameType: 4,
      frameTypeId: "Gem",
      gemSkill: "",
      gemSockets: [],
      gemTabs: [
        {
          name: null,
          pages: [
            {
              skillName: name,
              stats,
            },
          ],
        },
      ],
      explicitMods: [],
      h: 1,
      icon: itemSkill.icon || "",
      identified: true,
      ilvl: 0,
      league: "",
      name: "",
      properties,
      realm: "poe",
      requirements: [],
      secDescrText: description,
      socketedItems: [],
      sockets: [],
      support: false,
      typeLine: name,
      verified: true,
      w: 1,
    } as unknown as Item;
  }

  function buildSupportGemItem(
    itemSup: MercenarySkillSupport,
    repoeSup?: dataMercenarySupport,
  ): Item {
    const name = itemSup.name || repoeSup?.name || "Unknown Support";
    const stats = extractStatLines(repoeSup?.stat_text);

    return {
      baseType: name,
      descrText: "",
      frameType: 4,
      frameTypeId: "Gem",
      gemSkill: "",
      gemSockets: [],
      gemTabs: [
        {
          name: null,
          pages: [
            {
              skillName: name,
              stats,
            },
          ],
        },
      ],
      explicitMods: [],
      h: 1,
      icon: getSupportIconUrl(repoeSup),
      identified: true,
      ilvl: 0,
      league: "",
      name: "",
      properties: [],
      realm: "poe",
      requirements: [],
      secDescrText: "",
      socketedItems: [],
      sockets: [],
      support: true,
      typeLine: name,
      verified: true,
      w: 1,
    } as unknown as Item;
  }

  /* ------------------------------------------------------------------ */
  /* Tooltip events (rendered by the parent ItemStats)                  */
  /* ------------------------------------------------------------------ */
  function rectOf(e: MouseEvent, atCursor = false): DOMRect {
    if (atCursor) {
      return DOMRectReadOnly.fromRect({
        x: e.clientX,
        y: e.clientY,
        width: 0,
        height: 0,
      }) as unknown as DOMRect;
    }
    return (e.currentTarget as HTMLElement).getBoundingClientRect();
  }

  function showSkillTooltip(
    e: MouseEvent,
    itemSkill: MercenarySkill,
    atCursor = false,
  ) {
    const repoeSkill = $mercenarySkillsByHash.get(itemSkill.hash);
    dispatch("itemhover", {
      item: buildSkillGemItem(itemSkill, repoeSkill),
      rect: rectOf(e, atCursor),
    });
  }

  function showSupportTooltip(
    e: MouseEvent,
    itemSup: MercenarySkillSupport,
    atCursor = false,
  ) {
    const repoeSup = $mercenarySupportsByHash.get(itemSup.hash);
    dispatch("itemhover", {
      item: buildSupportGemItem(itemSup, repoeSup),
      rect: rectOf(e, atCursor),
    });
  }

  function hideTooltip() {
    dispatch("itemleave");
  }
</script>

{#if skills && skills.length > 0}
  {#if $compactMercenaryDisplay}
    <!-- COMPACT: skill on the left, support icons in a row on the right -->
    <div class="merc-skills-wrap">
      <div class="merc-skills-table">
        {#each skills as skill (skill.hash)}
          {@const repoeSkill = $mercenarySkillsByHash.get(skill.hash)}
          <div class="merc-row">
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="merc-col-skill"
              on:mouseenter={(e) => showSkillTooltip(e, skill, false)}
              on:mouseleave={hideTooltip}
            >
              <CdnImage
                src={skill.icon}
                alt={skill.name || "Skill"}
                className="merc-icon merc-icon-26"
              />
              <span class="merc-skill-name">
                {skill.name || repoeSkill?.name || "Unknown Skill"}
              </span>
            </div>

            <div class="merc-col-supports">
              {#each skill.supports ?? [] as sup (sup.hash)}
                {@const repoeSup = $mercenarySupportsByHash.get(sup.hash)}
                {@const supUrl = getSupportIconUrl(repoeSup)}
                {@const tierRoman = toRoman(sup.tier ?? repoeSup?.tier)}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  class="merc-support-item merc-support-item-26"
                  on:mouseenter={(e) => showSupportTooltip(e, sup, false)}
                  on:mouseleave={hideTooltip}
                >
                  {#if supUrl}
                    <CdnImage
                      src={supUrl}
                      alt={sup.name || "Support"}
                      className="merc-icon merc-icon-26"
                    />
                  {:else}
                    <span class="merc-icon-fallback fallback-26">
                      {sup.name?.slice(0, 2) ?? "?"}
                    </span>
                  {/if}
                  {#if tierRoman}
                    <span class="merc-tier-badge">{tierRoman}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- STACKED: one centered line per skill / support, whole line is hoverable -->
    <div class="merc-stack">
      {#each skills as skill (skill.hash)}
        {@const repoeSkill = $mercenarySkillsByHash.get(skill.hash)}
        <div class="merc-group">
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="merc-line merc-line-skill"
            on:mouseenter={(e) => showSkillTooltip(e, skill, true)}
            on:mouseleave={hideTooltip}
          >
            <CdnImage
              src={skill.icon}
              alt={skill.name || "Skill"}
              className="merc-icon merc-icon-22"
            />
            <span class="merc-line-text">
              {skill.name || repoeSkill?.name || "Unknown Skill"}
            </span>
          </div>

          {#each skill.supports ?? [] as sup (sup.hash)}
            {@const repoeSup = $mercenarySupportsByHash.get(sup.hash)}
            {@const supUrl = getSupportIconUrl(repoeSup)}
            {@const tierNum = sup.tier ?? repoeSup?.tier}
            {@const tierRoman = toRoman(tierNum)}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="merc-line merc-line-support"
              on:mouseenter={(e) => showSupportTooltip(e, sup, true)}
              on:mouseleave={hideTooltip}
            >
              <div class="merc-support-item merc-support-item-20">
                {#if supUrl}
                  <CdnImage
                    src={supUrl}
                    alt={sup.name || "Support"}
                    className="merc-icon merc-icon-20"
                  />
                {:else}
                  <span class="merc-icon-fallback fallback-20">
                    {sup.name?.slice(0, 2) ?? "?"}
                  </span>
                {/if}
                {#if tierRoman}
                  <span class="merc-tier-badge merc-tier-badge-sm"
                    >{tierRoman}</span
                  >
                {/if}
              </div>
              <span class="merc-line-text">
                {sup.name || repoeSup?.name || "Unknown Support"}{tierNum
                  ? ` (Tier: ${tierNum})`
                  : ""}
              </span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  /* ---------------------------------------------------------------- */
  /* Shared Icon sizing & fallbacks                                   */
  /* ---------------------------------------------------------------- */
  :global(.merc-icon) {
    display: inline-block;
    object-fit: contain;
    flex-shrink: 0;
  }
  :global(.merc-icon-26) {
    width: 26px;
    height: 26px;
  }
  :global(.merc-icon-22) {
    width: 22px;
    height: 22px;
  }
  :global(.merc-icon-20) {
    width: 20px;
    height: 20px;
  }

  .merc-support-item {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    flex-shrink: 0;
  }
  .merc-support-item-26 {
    width: 26px;
    height: 26px;
  }
  .merc-support-item-20 {
    width: 20px;
    height: 20px;
  }

  .merc-icon-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #8b95a5;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    user-select: none;
    flex-shrink: 0;
  }
  .merc-icon-fallback.fallback-26 {
    width: 26px;
    height: 26px;
    font-size: 11px;
  }
  .merc-icon-fallback.fallback-20 {
    width: 20px;
    height: 20px;
    font-size: 10px;
  }

  .merc-tier-badge {
    position: absolute;
    bottom: -2px;
    right: -1px;
    color: #eae0b0;
    font-size: 12px;
    font-weight: 800;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    line-height: 1;
    pointer-events: none;
    -webkit-text-stroke: 1px #000;
    paint-order: stroke fill;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0px -1px 0 #000,
      0px 1px 0 #000,
      -1px 0px 0 #000,
      1px 0px 0 #000;
  }
  .merc-tier-badge-sm {
    font-size: 10px;
    bottom: -2px;
    right: -2px;
  }

  /* ---------------------------------------------------------------- */
  /* Compact display                                                  */
  /* ---------------------------------------------------------------- */
  .merc-skills-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .merc-skills-table {
    display: grid;
    grid-template-columns: 290px 1fr;
    row-gap: 4px;
    column-gap: 14px;
    align-items: center;
  }

  .merc-row {
    display: contents;
  }

  .merc-col-skill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    cursor: default;
  }

  .merc-skill-name {
    color: #c1afa0;
    font-size: 22px;
    line-height: 1;
    white-space: nowrap;
  }

  .merc-col-supports {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 26px;
  }

  /* ---------------------------------------------------------------- */
  /* Stacked (non-compact) display                                    */
  /* ---------------------------------------------------------------- */
  .merc-stack {
    --merc-font-size: 15px;
    --merc-skill-color: #c1afa0;
    --merc-support-color: #8888ff;

    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    text-align: center;
  }
  .merc-group {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .merc-group + .merc-group {
    margin-top: 5px;
  }
  .merc-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: default;
  }
  .merc-line-skill {
    min-height: 24px;
    margin-bottom: 1px;
  }
  .merc-line-support {
    min-height: 20px;
    padding: 0;
    margin: 0;
  }
  .merc-line-text {
    line-height: 1.1;
  }
  .merc-line-skill .merc-line-text {
    font-size: var(--merc-font-size);
    color: var(--merc-skill-color);
  }
  .merc-line-support .merc-line-text {
    font-size: calc(var(--merc-font-size) - 2px);
    color: var(--merc-support-color);
  }
  .merc-line:hover .merc-line-text {
    filter: brightness(1.25);
  }
</style>
