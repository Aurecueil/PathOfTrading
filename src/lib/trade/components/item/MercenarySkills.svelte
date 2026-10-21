<!-- src/lib/trade/components/item/MercenarySkills.svelte -->
<script lang="ts">
  import {
    mercenarySkillsByHash,
    mercenarySupportsByHash,
  } from "$lib/trade/tradeStore";
  import { fetchCdnImage } from "$lib/trade/utilis/imageService";
  import ItemStats from "$lib/trade/components/item/ItemStats.svelte";
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
  export let realm: string = "poe";

  const TIP_W = 450;

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

    const [bestLvl, level] = getBestSkillLevel(repoeSkill, mercLvl) ?? []; // MercenarySkillLevel

    const filteredTypes = filterSkillTypes(repoeSkill?.active_skill?.types);
    if (filteredTypes.length > 0) {
      const numGroups = Math.ceil(filteredTypes.length / 5);
      const baseSize = Math.floor(filteredTypes.length / numGroups);
      const remainder = filteredTypes.length % numGroups;

      let currentIndex = 0;
      for (let i = 0; i < numGroups; i++) {
        // Distribute the remainder items across the first few groups
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
    const castTime = getProp("cast_time" as keyof MercenarySkillLevel); // if cast_time exists on types
    if (typeof castTime === "number" && castTime > 0) {
      properties.push({
        displayMode: 0,
        name: "Cast Time",
        values: [[formatMsToSeconds(castTime), 0]],
      });
    }

    // 3. Costs (e.g. {"Mana": 28} -> "Mana Cost")
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

    // 4. Attack Speed Multiplier (e.g. 15 -> "115% of Base")
    const attackSpeedMult = getProp("attack_speed_multiplier");
    if (typeof attackSpeedMult === "number") {
      properties.push({
        displayMode: 0,
        name: "Attack Speed",
        values: [[`${100 + attackSpeedMult}% of Base`, 0]],
      });
    }

    // 5. Damage Multiplier (e.g. 5620 -> "156.2% of Base")
    const damageMult = getProp("damage_multiplier");
    if (typeof damageMult === "number") {
      const formattedDamage = (100 + damageMult / 100).toFixed(1);
      properties.push({
        displayMode: 0,
        name: "Attack Damage",
        values: [[`${formattedDamage}% of Base`, 0]],
      });
    }

    // 6. Damage Effectiveness (e.g. 56 -> "156%")
    const damageEff = getProp("damage_effectiveness");
    if (typeof damageEff === "number") {
      properties.push({
        displayMode: 0,
        name: "Effectiveness of Added Damage",
        values: [[`${100 + damageEff}%`, 0]],
      });
    }

    // 7. Critical Strike Chance (e.g. 600 -> "6%")
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

  function portal(node: HTMLElement) {
    if (typeof document !== "undefined" && document.body) {
      document.body.appendChild(node);
    }
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      },
    };
  }

  let hoveredItem: { item: Item; left: number; top: number } | null = null;

  function openItemTooltip(targetItem: Item, e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let left = rect.right + 8;
    if (left + TIP_W > window.innerWidth - 8) {
      left = Math.max(8, rect.left - TIP_W - 8);
    }
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 340));
    hoveredItem = { item: targetItem, left, top };
  }

  function showSkillTooltip(e: MouseEvent, itemSkill: MercenarySkill) {
    const repoeSkill = $mercenarySkillsByHash.get(itemSkill.hash);
    const targetItem = buildSkillGemItem(itemSkill, repoeSkill);
    openItemTooltip(targetItem, e);
  }

  function showSupportTooltip(e: MouseEvent, itemSup: MercenarySkillSupport) {
    const repoeSup = $mercenarySupportsByHash.get(itemSup.hash);
    const targetItem = buildSupportGemItem(itemSup, repoeSup);
    openItemTooltip(targetItem, e);
  }

  function hideTooltip() {
    hoveredItem = null;
  }
</script>

{#if skills && skills.length > 0}
  <div class="merc-skills-wrap">
    <div class="merc-skills-table">
      {#each skills as skill (skill.hash)}
        {@const repoeSkill = $mercenarySkillsByHash.get(skill.hash)}
        <div class="merc-row">
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="merc-col-skill"
            on:mouseenter={(e) => showSkillTooltip(e, skill)}
            on:mouseleave={hideTooltip}
          >
            {#if skill.icon}
              {#await fetchCdnImage(skill.icon)}
                <div class="merc-skill-icon placeholder"></div>
              {:then src}
                <img
                  class="merc-skill-icon"
                  {src}
                  alt={skill.name}
                  loading="lazy"
                />
              {:catch}
                <img
                  class="merc-skill-icon"
                  src={skill.icon}
                  alt={skill.name}
                  loading="lazy"
                />
              {/await}
            {:else}
              <div class="merc-skill-icon placeholder"></div>
            {/if}
            <span class="merc-skill-name">
              {skill.name || repoeSkill?.name || "Unknown Skill"}
            </span>
          </div>

          <div class="merc-col-supports">
            {#if skill.supports && skill.supports.length > 0}
              {#each skill.supports as sup (sup.hash)}
                {@const repoeSup = $mercenarySupportsByHash.get(sup.hash)}
                {@const supIconUrl = getSupportIconUrl(repoeSup)}
                {@const tierRoman = toRoman(sup.tier ?? repoeSup?.tier)}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  class="merc-support-item"
                  on:mouseenter={(e) => showSupportTooltip(e, sup)}
                  on:mouseleave={hideTooltip}
                >
                  {#if supIconUrl}
                    {#await fetchCdnImage(supIconUrl)}
                      <div class="merc-support-icon placeholder"></div>
                    {:then src}
                      <img
                        class="merc-support-icon"
                        {src}
                        alt={sup.name}
                        loading="lazy"
                      />
                    {:catch}
                      <img
                        class="merc-support-icon"
                        src={supIconUrl}
                        alt={sup.name}
                        loading="lazy"
                      />
                    {/await}
                  {:else}
                    <div class="merc-support-icon fallback">
                      {sup.name?.slice(0, 2) ?? "?"}
                    </div>
                  {/if}

                  {#if tierRoman}
                    <span class="merc-tier-badge">{tierRoman}</span>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

{#if hoveredItem}
  <div
    class="stats-skill-tooltip r-gem"
    use:portal
    style:left="{hoveredItem.left}px"
    style:top="{hoveredItem.top}px"
    style:width="{TIP_W}px"
  >
    <ItemStats
      item={hoveredItem.item}
      {realm}
      styleMode="compact"
      isTooltip={true}
      tileWidth={TIP_W}
    />
  </div>
{/if}

<style>
  .merc-skills-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 2px;
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

  .merc-skill-icon {
    width: 26px;
    height: 26px;
    object-fit: contain;
    flex-shrink: 0;
    display: block;
  }

  .merc-skill-icon.placeholder {
    background: rgba(255, 255, 255, 0.05);
  }

  .merc-skill-name {
    color: #e2e2d8;
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

  .merc-support-item {
    position: relative;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: default;
  }

  .merc-support-icon {
    width: 26px;
    height: 26px;
    object-fit: contain;
    display: block;
  }

  .merc-support-icon.placeholder,
  .merc-support-icon.fallback {
    font-size: 10px;
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
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

  .stats-skill-tooltip.r-gem {
    --rc: #1ba29b;
    --rc-rgb: 27, 162, 155;
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
</style>
