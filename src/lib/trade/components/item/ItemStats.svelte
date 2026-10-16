<!-- src/lib/trade/components/item/ItemStats.svelte -->
<script lang="ts">
  import type {
    Item,
    ItemProperty,
    ItemMod,
    ItemSocket,
  } from "$lib/types/tradeItem";
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import ItemModifier from "../item/ItemModifier.svelte";
  import CdnImage from "../item/CdnImage.svelte";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import { SHEET_1, SOCKET_SIZE, LINK_H, getBase } from "./socketSprites";

  export let item: Item;
  export let realm: string = "poe";
  export let styleMode: ResolvedDisplayStyle = "full";
  export let tileWidth: number = 600;
  export let isTooltip: boolean = false;

  let showBondedMods = false;

  $: effectiveMode = isTooltip ? "compact" : styleMode;
  $: isCompact = effectiveMode === "compact";
  $: isPoe2 = (item.realm || realm || "").toLowerCase() === "poe2";

  const CDN_BASE = "https://web.poecdn.com";
  const FORESIGHT_ICON = `${CDN_BASE}/protected/image/item/popup/foresight.png?v=1709582916256&key=Lef8eETW43fyBwYaZ_f3SA`;

  const VEILED_POE1: Record<string, string> = {
    prefix01: `${CDN_BASE}/protected/image/item/veiled/prefix_01a.png?v=1709582916256&key=NuxfQF016Bg_bUvrRy1gAQ`,
    prefix02: `${CDN_BASE}/protected/image/item/veiled/prefix_02a.png?v=1709582916256&key=DXwfEPfOw-uVqS_20dZaPw`,
    prefix03: `${CDN_BASE}/protected/image/item/veiled/prefix_03a.png?v=1709582916256&key=xq8vaDgc0IJ368sLnACh6Q`,
    prefix04: `${CDN_BASE}/protected/image/item/veiled/prefix_04a.png?v=1709582916256&key=8r3qrW3BSPXjxudEprtbEQ`,
    prefix05: `${CDN_BASE}/protected/image/item/veiled/prefix_05a.png?v=1709582916256&key=vymKEHBpt8oE0xqXBqoj0w`,
    prefix06: `${CDN_BASE}/protected/image/item/veiled/prefix_06a.png?v=1709582916256&key=XxoLqaurxGoOnJ-J2bXZ5g`,
    suffix01: `${CDN_BASE}/protected/image/item/veiled/suffix_01a.png?v=1709582916256&key=CHqbQbkiD3SnM_6QM0KuoA`,
    suffix02: `${CDN_BASE}/protected/image/item/veiled/suffix_02a.png?v=1709582916256&key=PQfTmFBpKG_z0zE9FZRNfQ`,
    suffix03: `${CDN_BASE}/protected/image/item/veiled/suffix_03a.png?v=1709582916256&key=zWi1evFD4O_ziycUc8ACKA`,
    suffix04: `${CDN_BASE}/protected/image/item/veiled/suffix_04a.png?v=1709582916256&key=ZRtrwR4blbf4zCd-luqCPw`,
    suffix05: `${CDN_BASE}/protected/image/item/veiled/suffix_05a.png?v=1709582916256&key=3YUumoQsdNRi1QWPXa39hg`,
    suffix06: `${CDN_BASE}/protected/image/item/veiled/suffix_06a.png?v=1709582916256&key=iBrccuSmIQD5OW6K707y_Q`,
  };

  const VEILED_POE2: Record<string, { url: string; wide: boolean }> = {
    prefix01: {
      url: `${CDN_BASE}/protected/image/gen/prefix2_01.png?v=1791178105506&key=OFQIecbLOE777cFxO7JATA`,
      wide: false,
    },
    prefix02: {
      url: `${CDN_BASE}/protected/image/gen/prefix2_02.png?v=1791178105522&key=N4oJr5UEGhzPs_z2hF3CmQ`,
      wide: false,
    },
    prefix03: {
      url: `${CDN_BASE}/protected/image/gen/prefix2_03.png?v=1791178105594&key=o-iRYQj7bciYd-05ypZLGQ`,
      wide: false,
    },
    prefix04: {
      url: `${CDN_BASE}/protected/image/gen/prefix2_04.png?v=1791178105690&key=tRUUeR7kyVZzmuK0rAu1eA`,
      wide: true,
    },
    prefix05: {
      url: `${CDN_BASE}/protected/image/gen/prefix2_05.png?v=1791178105730&key=-a5IpDVmd9o9jt1srwdjZQ`,
      wide: true,
    },
    prefix06: {
      url: `${CDN_BASE}/protected/image/gen/prefix2_06.png?v=1791178105702&key=UQxOXPrK4rPt93BO-_3wiw`,
      wide: true,
    },
    suffix01: {
      url: `${CDN_BASE}/protected/image/gen/suffix2_01.png?v=1791178105534&key=cVk-LIInVLMNK6_cXrnbGA`,
      wide: false,
    },
    suffix02: {
      url: `${CDN_BASE}/protected/image/gen/suffix2_02.png?v=1791178105570&key=4dPssAs0BySPELyZ5VpZzQ`,
      wide: false,
    },
    suffix03: {
      url: `${CDN_BASE}/protected/image/gen/suffix2_03.png?v=1791178105546&key=tGxwrS1KpEO8jNI4xY6RFQ`,
      wide: false,
    },
    suffix04: {
      url: `${CDN_BASE}/protected/image/gen/suffix2_04.png?v=1791178105678&key=n5PJiICUfGjsmEo3O0VahQ`,
      wide: true,
    },
    suffix05: {
      url: `${CDN_BASE}/protected/image/gen/suffix2_05.png?v=1791178105754&key=LvcxEVUMggLbGCmH2WCNsw`,
      wide: true,
    },
    suffix06: {
      url: `${CDN_BASE}/protected/image/gen/suffix2_06.png?v=1791178105718&key=JGOa0jrtH3fTZ5HYM9tY2Q`,
      wide: true,
    },
  };

  function cleanBracketText(text: string): string {
    if (!text) return "";
    return text.replace(/\[([^\]]+)\]/g, (_, inner: string) => {
      const parts = inner.split("|");
      return parts[parts.length - 1];
    });
  }

  function getRarityClass(it: Item): string {
    const rarity = (it.rarity || it.frameTypeId || "").toLowerCase();
    if (rarity === "normal") return "rarity-normal";
    if (rarity === "magic") return "rarity-magic";
    if (rarity === "rare") return "rarity-rare";
    if (rarity === "unique") return "rarity-unique";
    if (rarity === "gem") return "rarity-gem";
    if (rarity === "currency") return "rarity-currency";
    switch (it.frameType) {
      case 0:
        return "rarity-normal";
      case 1:
        return "rarity-magic";
      case 2:
        return "rarity-rare";
      case 3:
      case 9:
      case 10:
        return "rarity-unique";
      case 4:
        return "rarity-gem";
      case 5:
      case 12:
        return "rarity-currency";
      default:
        return "rarity-rare";
    }
  }

  const DAMAGE_PROP_REGEX =
    /^(?:physical|fire|cold|lightning|chaos|elemental)\s+damage$/i;

  function isMergeableDamageProp(cleanName: string): boolean {
    return DAMAGE_PROP_REGEX.test(cleanName);
  }

  function isDefenceProp(cleanName: string): boolean {
    return (
      /^evasion(?: rating)?$/i.test(cleanName) ||
      /^(?:maximum )?energy shield$/i.test(cleanName) ||
      /^armour$/i.test(cleanName)
    );
  }

  function getWeaponRateOrder(cleanName: string): number {
    if (/^attacks per second$/i.test(cleanName)) return 1;
    if (/^critical (?:hit|strike) chance$/i.test(cleanName)) return 2;
    if (/^reload time$/i.test(cleanName)) return 3;
    return 0;
  }

  function isQualityProp(prop: ItemProperty, cleanName: string): boolean {
    return prop.type === 6 || /^quality$/i.test(cleanName);
  }

  function mapPropLabel(cleanName: string, compact: boolean): string {
    if (!compact) return cleanName;
    if (/^critical (?:hit|strike) chance$/i.test(cleanName)) return "CR";
    if (/^attacks per second$/i.test(cleanName)) return "AS";
    if (/^reload time$/i.test(cleanName)) return "Reload";
    if (/^evasion(?: rating)?$/i.test(cleanName)) return "EV";
    if (/^(?:maximum )?energy shield$/i.test(cleanName)) return "ES";
    if (/^armour$/i.test(cleanName)) return "AR";
    return cleanName;
  }

  function getDamageValueColor(cleanPropName: string, valType: number): string {
    const lower = cleanPropName.toLowerCase();
    if (valType === 4 || lower.includes("fire")) return "#ff6b35";
    if (valType === 5 || lower.includes("cold")) return "#38bdf8";
    if (valType === 6 || lower.includes("lightning")) return "#facc15";
    if (valType === 7 || lower.includes("chaos")) return "#d946ef";
    if (valType === 1) return "#6588ff";
    return "#f1f5f9";
  }

  interface FormattedPropValue {
    text: string;
    color: string;
  }

  interface FormattedProp {
    label: string;
    values: FormattedPropValue[];
    icon?: string;
  }

  function formatProperty(prop: ItemProperty, compact: boolean): FormattedProp {
    const cleanedName = cleanBracketText(prop.name).trim();
    const parsedValues: FormattedPropValue[] = (prop.values || []).map(
      ([text, type]) => ({
        text: cleanBracketText(text),
        color: getDamageValueColor(cleanedName, type),
      }),
    );

    if (prop.displayMode === 3) {
      let templated = cleanedName;
      parsedValues.forEach((val, idx) => {
        templated = templated.replace(`{${idx}}`, val.text);
      });
      return { label: templated, values: [], icon: prop.icon };
    }
    return {
      label: mapPropLabel(cleanedName, compact),
      values: parsedValues,
      icon: prop.icon,
    };
  }

  function isBondedMod(mod: string | ItemMod): boolean {
    const raw = typeof mod === "string" ? mod : mod.description || "";
    if (typeof mod !== "string" && mod.domain === "bonded") return true;
    return /\[[^\]]*Bonded\]/i.test(raw) || /\bBonded:/i.test(raw);
  }

  $: minimalName = cleanBracketText(item.name || "").trim();
  $: minimalBase = (() => {
    const b = cleanBracketText(item.typeLine || item.baseType || "").trim();
    return b && b !== minimalName ? b : "";
  })();

  /* ------------------------------------------------------------------ */
  /* Properties, Line Groupings, KPIs, Requirements & Sockets           */
  /* ------------------------------------------------------------------ */
  $: ilvl = item.ilvl || item.itemLevel || 0;
  $: baseTypeClean = [item.baseType, item.typeLine]
    .map((t) =>
      cleanBracketText(t || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(" | ");

  // DPS, pDPS, eDPS in one line
  $: kpiStats = (() => {
    const list: { label: string; value: string; augmented?: boolean }[] = [];
    const ext = item.extended;
    if (ext?.dps) {
      list.push({
        label: "DPS",
        value: Math.round(ext.dps).toLocaleString(),
        augmented: ext.dps_aug,
      });
    }
    if (ext?.pdps) {
      list.push({
        label: "pDPS",
        value: Math.round(ext.pdps).toLocaleString(),
        augmented: ext.pdps_aug,
      });
    }
    if (ext?.edps) {
      list.push({
        label: "eDPS",
        value: Math.round(ext.edps).toLocaleString(),
        augmented: true,
      });
    }
    return list;
  })();

  // Group properties into:
  // - defenceLine: Evasion Rating, Energy Shield, Armour (one line, any order)
  // - weaponRateLine: Attacks per Second, Critical Hit/Strike Chance, Reload Time (one line, in this order)
  // - singleLines: every other property on its own line (with physical/ele/chaos damage merged into one Damage line)
  // - qualityProp: extracted for the Item Level / Requirements / Quality line
  $: groupedProps = (() => {
    const rawProps = item.properties || [];
    const defenceLine: FormattedProp[] = [];
    const weaponRateEntries: { order: number; prop: FormattedProp }[] = [];
    const singleLines: FormattedProp[] = [];
    let mergedDamage: FormattedProp | null = null;
    let qualityProp: FormattedProp | null = null;

    for (const p of rawProps) {
      const cleanName = cleanBracketText(p.name).trim();
      if (!cleanName) continue;

      // Hide property if its name is already in baseType / typeLine
      if (
        (!p.values || p.values.length === 0) &&
        p.displayMode !== 3 &&
        baseTypeClean.includes(cleanName.toLowerCase())
      ) {
        continue;
      }

      if (isQualityProp(p, cleanName)) {
        qualityProp = formatProperty(p, isCompact);
        continue;
      }

      if (isDefenceProp(cleanName)) {
        defenceLine.push(formatProperty(p, isCompact));
        continue;
      }

      const rateOrder = getWeaponRateOrder(cleanName);
      if (rateOrder > 0) {
        weaponRateEntries.push({
          order: rateOrder,
          prop: formatProperty(p, isCompact),
        });
        continue;
      }

      if (isMergeableDamageProp(cleanName)) {
        const dmgVals: FormattedPropValue[] = (p.values || []).map(
          ([text, type]) => ({
            text: cleanBracketText(text),
            color: getDamageValueColor(cleanName, type),
          }),
        );
        if (!mergedDamage) {
          mergedDamage = {
            label: "Damage",
            values: [...dmgVals],
          };
          singleLines.push(mergedDamage);
        } else {
          mergedDamage.values.push(...dmgVals);
        }
        continue;
      }

      singleLines.push(formatProperty(p, isCompact));
    }

    weaponRateEntries.sort((a, b) => a.order - b.order);
    const weaponRateLine = weaponRateEntries.map((e) => e.prop);

    return {
      defenceLine,
      weaponRateLine,
      singleLines,
      qualityProp,
    };
  })();

  $: allRequirements = [
    ...(item.requirements || []),
    ...(item.weaponRequirements || []),
    ...(item.supportGemRequirements || []),
  ];

  // Gem / socketable description + stats (shown in tooltips only)
  $: tooltipTexts = ((): { desc: string; stats: string[] } => {
    const tab = (item.gemTabs as any[] | undefined)?.[0];
    const stats: string[] = (tab?.pages?.[0]?.stats ?? []).map((t: string) =>
      cleanBracketText(t),
    );
    const desc = cleanBracketText(
      item.secDescrText || (stats.length ? "" : item.descrText || ""),
    );
    return { desc, stats };
  })();

  $: requirementEntries = allRequirements
    .map((req) => ({
      name: cleanBracketText(req.name || "").trim(),
      value: cleanBracketText(req.values?.[0]?.[0] || "").trim(),
    }))
    .filter((r) => r.name || r.value);

  $: hasMetaReqQualityLine =
    ilvl > 0 ||
    requirementEntries.length > 0 ||
    groupedProps.qualityProp !== null;

  $: inlineSockets = ((): {
    socket: ItemSocket;
    idx: number;
    socketed: Item | null;
  }[] => {
    const rawSockets = item.sockets || [];
    const socketedList = item.socketedItems || [];

    if (effectiveMode === "compact") {
      if (rawSockets.length > 0) {
        return rawSockets.map((socket, idx) => ({
          socket,
          idx,
          socketed: socketedList.find((it) => it.socket === idx) ?? null,
        }));
      }
      if (item.gemSockets && item.gemSockets.length > 0) {
        return item.gemSockets.map((col, idx) => ({
          socket: { group: idx, sColour: (col as any) || "W", type: "gem" },
          idx,
          socketed: null,
        }));
      }
      return [];
    }

    const gemTyped = rawSockets
      .map((socket, idx) => ({ socket, idx }))
      .filter(({ socket }) => (socket.type || "").toLowerCase() === "gem");

    if (gemTyped.length > 0) {
      return gemTyped.map(({ socket, idx }) => ({
        socket,
        idx,
        socketed: socketedList.find((it) => it.socket === idx) ?? null,
      }));
    }

    if (item.gemSockets && item.gemSockets.length > 0) {
      return item.gemSockets.map((col, idx) => ({
        socket: { group: idx, sColour: (col as any) || "W", type: "gem" },
        idx,
        socketed: null,
      }));
    }

    return [];
  })();

  /* ------------------------------------------------------------------ */
  /* Granted Skills & Socketed Skill Gems (Always Extracted)            */
  /* ------------------------------------------------------------------ */
  interface ExtractedSkill {
    icon?: string;
    label: string;
    tooltipItem: Item | null;
  }

  $: extractedSkills = ((): ExtractedSkill[] => {
    const results: ExtractedSkill[] = [];
    const granted = item.grantedSkills || [];
    const skillItems = (item.socketedItems || []).filter(
      (si) =>
        (si.socket === undefined || si.socket === null) &&
        (si.gemSkill ||
          si.frameType === 4 ||
          (si.frameTypeId || "").toLowerCase() === "gem"),
    );
    const usedSkillItems = new Set<Item>();

    for (let i = 0; i < granted.length; i++) {
      const gs = granted[i];
      const valText = (gs.values || [])
        .map((v) => cleanBracketText(v[0]))
        .filter(Boolean)
        .join(", ");
      const baseName = cleanBracketText(gs.name);
      const label = valText
        ? baseName
          ? `${baseName}: ${valText}`
          : valText
        : baseName;

      // grantedSkills only says "this item grants skill X" (name is in values).
      // The matching socketedItems entry is the real item definition used for
      // the tooltip, and its gemSkill is the image.
      const norm = (t?: string) =>
        cleanBracketText(t || "")
          .trim()
          .toLowerCase();
      const wanted = (gs.values || []).map((v) => norm(v[0])).filter(Boolean);
      const itemName = (si: Item) =>
        norm(si.typeLine || si.baseType || si.name);
      const free = skillItems.filter((si) => !usedSkillItems.has(si));

      const matched: Item | null =
        free.find((si) => wanted.includes(itemName(si))) ??
        free.find((si) => gs.icon && si.gemSkill && si.gemSkill === gs.icon) ??
        free.find(
          (si) =>
            itemName(si) &&
            wanted.some(
              (w) => w.includes(itemName(si)) || itemName(si).includes(w),
            ),
        ) ??
        (granted.length === skillItems.length ? (free[0] ?? null) : null);

      if (matched) usedSkillItems.add(matched);

      results.push({
        icon: matched?.gemSkill || gs.icon || matched?.icon,
        label,
        tooltipItem: matched,
      });
    }

    for (const si of skillItems) {
      if (usedSkillItems.has(si)) continue;
      const skillName = cleanBracketText(si.typeLine || si.baseType || si.name);
      results.push({
        icon: si.gemSkill || si.icon,
        label: skillName ? `Grants Skill: ${skillName}` : "Grants Skill",
        tooltipItem: si,
      });
    }

    return results;
  })();

  /* ------------------------------------------------------------------ */
  /* Modifiers & Bonded Handling                                        */
  /* ------------------------------------------------------------------ */
  $: separatedMods = (() => {
    const runeRegular: Array<string | ItemMod> = [];
    const implicitRegular: Array<string | ItemMod> = [];
    const runeBonded: Array<string | ItemMod> = [...(item.bondedMods || [])];

    (item.runeMods || []).forEach((m) => {
      if (isBondedMod(m)) runeBonded.push(m);
      else runeRegular.push(m);
    });

    (item.implicitMods || []).forEach((m) => {
      if (isBondedMod(m)) runeBonded.push(m);
      else implicitRegular.push(m);
    });

    return {
      runeRegular,
      implicitRegular,
      runeBonded,
    };
  })();

  $: enchantMods = item.enchantMods ?? [];

  $: classifiedExplicits = (() => {
    const prefixes: Array<{
      mod: string | ItemMod;
      cat: "prefix" | "bonded";
    }> = [];
    const suffixes: Array<{
      mod: string | ItemMod;
      cat: "suffix" | "bonded";
    }> = [];
    const others: Array<{
      mod: string | ItemMod;
      cat: "generic" | "bonded";
    }> = [];

    (item.explicitMods || []).forEach((mod) => {
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

    // Bonded mods that live in explicitMods stay explicit modifiers: grey text,
    // always listed after the other explicit modifiers.
    const regular = [...prefixes, ...suffixes, ...others];
    return [
      ...regular.filter((e) => e.cat !== "bonded"),
      ...regular.filter((e) => e.cat === "bonded"),
    ];
  })();

  $: veiledEntries = (item.veiledMods || []).map((vm) => {
    const raw = (typeof vm === "string" ? vm : vm.description || "")
      .toLowerCase()
      .trim();
    const key = VEILED_POE1[raw] ? raw : "prefix01";
    return {
      key,
      poe1Url: VEILED_POE1[key],
      poe2Data: VEILED_POE2[key] || VEILED_POE2.prefix01,
    };
  });

  /* ------------------------------------------------------------------ */
  /* Exclusive Bottom State Tag + Split                                 */
  /* ------------------------------------------------------------------ */
  type ExclusiveState =
    | { kind: "foreseeing" }
    | { kind: "text"; label: string; cls: string }
    | null;

  $: exclusiveState = ((): ExclusiveState => {
    if (item.foreseeing) return { kind: "foreseeing" };
    if (item.identified === false)
      return {
        kind: "text",
        label: "Unidentified",
        cls: "state-corrupted",
      };
    if (item.doubleCorrupted)
      return {
        kind: "text",
        label: "Twice Corrupted",
        cls: "state-corrupted",
      };
    if (item.corrupted)
      return {
        kind: "text",
        label: "Corrupted",
        cls: "state-corrupted",
      };
    if (item.duplicated)
      return {
        kind: "text",
        label: "Mirrored",
        cls: "state-mirrored",
      };
    if (item.sanctified)
      return {
        kind: "text",
        label: "Sanctified",
        cls: "state-sanctified",
      };
    return null;
  })();

  /* ------------------------------------------------------------------ */
  /* Portaled Tooltip for Granted Skills & Compact Socketed Items       */
  /* ------------------------------------------------------------------ */
  const TIP_W = 360;
  let hoveredItem: { item: Item; left: number; top: number } | null = null;

  function openItemTooltip(e: Event, targetItem: Item | null) {
    if (!targetItem) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
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
    style="--mod-h: {isCompact ? '1.5rem' : '1.7rem'}"
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

    <!-- Top Properties Block -->
    {#if kpiStats.length > 0 || groupedProps.defenceLine.length > 0 || groupedProps.weaponRateLine.length > 0 || groupedProps.singleLines.length > 0 || hasMetaReqQualityLine || inlineSockets.length > 0}
      <div class="top-stats-block">
        <!-- Exception 1: DPS, pDPS, eDPS in one line -->
        {#if kpiStats.length > 0}
          <div class="prop-line">
            {#each kpiStats as kpi}
              <span class="prop-item">
                <span class="label">{kpi.label}:</span>
                <strong class:augmented={kpi.augmented}>{kpi.value}</strong>
              </span>
            {/each}
          </div>
        {/if}

        <!-- Exception 2: Evasion Rating, Energy Shield, Armour in one line -->
        {#if groupedProps.defenceLine.length > 0}
          <div class="prop-line">
            {#each groupedProps.defenceLine as formatted}
              <span class="prop-item">
                {#if effectiveMode === "full" && formatted.icon}
                  <CdnImage src={formatted.icon} alt="" className="prop-icon" />
                {/if}
                <span class="label"
                  ><StatColorText text={formatted.label} />:</span
                >
                {#each formatted.values as val, vi}
                  <strong style="color: {val.color}"
                    ><StatColorText text={val.text} />{vi <
                    formatted.values.length - 1
                      ? ","
                      : ""}</strong
                  >
                {/each}
              </span>
            {/each}
          </div>
        {/if}

        <!-- Regular properties: exactly ONE per line -->
        {#each groupedProps.singleLines as formatted}
          <div class="prop-line">
            <span class="prop-item">
              {#if effectiveMode === "full" && formatted.icon}
                <CdnImage src={formatted.icon} alt="" className="prop-icon" />
              {/if}
              {#if formatted.values.length > 0}
                <span class="label"
                  ><StatColorText text={formatted.label} />:</span
                >
                {#each formatted.values as val, vi}
                  <strong style="color: {val.color}"
                    ><StatColorText text={val.text} />{vi <
                    formatted.values.length - 1
                      ? ","
                      : ""}</strong
                  >
                {/each}
              {:else}
                <span class="prop-tag-only">
                  <StatColorText text={formatted.label} />
                </span>
              {/if}
            </span>
          </div>
        {/each}

        <!-- Exception 3: Attacks per Second, Critical Hit/Strike Chance, Reload Time in one line in this order -->
        {#if groupedProps.weaponRateLine.length > 0}
          <div class="prop-line">
            {#each groupedProps.weaponRateLine as formatted}
              <span class="prop-item">
                {#if effectiveMode === "full" && formatted.icon}
                  <CdnImage src={formatted.icon} alt="" className="prop-icon" />
                {/if}
                <span class="label"
                  ><StatColorText text={formatted.label} />:</span
                >
                {#each formatted.values as val, vi}
                  <strong style="color: {val.color}"
                    ><StatColorText text={val.text} />{vi <
                    formatted.values.length - 1
                      ? ","
                      : ""}</strong
                  >
                {/each}
              </span>
            {/each}
          </div>
        {/if}

        <!-- Exception 4: Item Level, Requirements, Quality: ONE line (never wraps), in this order -->
        {#if hasMetaReqQualityLine}
          <div class="prop-line meta-req-line">
            {#if ilvl > 0}
              <span class="prop-item">
                <span class="label">Item Level:</span>
                <strong>{ilvl}</strong>
              </span>
            {/if}

            {#if requirementEntries.length > 0}
              <span class="prop-item">
                <span class="label">Requires:</span>
                {#each requirementEntries as req, ri}
                  <span class="req-entry">
                    {#if req.name}<span class="label"
                        ><StatColorText text={req.name} /></span
                      >{/if}
                    {#if req.value}<strong
                        ><StatColorText text={req.value} />{ri <
                        requirementEntries.length - 1
                          ? ","
                          : ""}</strong
                      >{/if}
                  </span>
                {/each}
              </span>
            {/if}

            {#if groupedProps.qualityProp}
              <span class="prop-item">
                <span class="label"
                  ><StatColorText
                    text={groupedProps.qualityProp.label}
                  />:</span
                >
                {#each groupedProps.qualityProp.values as val, vi}
                  <strong style="color: {val.color}"
                    ><StatColorText text={val.text} />{vi <
                    groupedProps.qualityProp.values.length - 1
                      ? ","
                      : ""}</strong
                  >
                {/each}
              </span>
            {/if}
          </div>
        {/if}

        <!-- Sockets on their own line: sprite images, no box, fixed size -->
        {#if inlineSockets.length > 0}
          <div class="sockets-own-line" aria-label="Item sockets">
            <div class="inline-sockets">
              {#each inlineSockets as entry, si (entry.idx)}
                {@const base = getBase(entry.socket)}
                {@const iconSrc = entry.socket.type
                  ? (entry.socketed?.socketedIcon ??
                    entry.socketed?.icon ??
                    null)
                  : null}
                <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                <span
                  class="inline-socket"
                  class:has-socketed={entry.socketed !== null}
                  role={entry.socketed ? "button" : undefined}
                  tabindex={entry.socketed ? 0 : undefined}
                  on:mouseenter={(e) => openItemTooltip(e, entry.socketed)}
                  on:mouseleave={closeItemTooltip}
                  on:focus={(e) => openItemTooltip(e, entry.socketed)}
                  on:blur={closeItemTooltip}
                >
                  <span
                    class="inline-box"
                    style:width="{base?.size ?? SOCKET_SIZE}px"
                    style:height="{base?.size ?? SOCKET_SIZE}px"
                    style:transform={base?.fixedScale
                      ? `scale(${base.fixedScale})`
                      : undefined}
                  >
                    {#if base}
                      <span
                        class="isprite"
                        style:width="{base.size}px"
                        style:height="{base.size}px"
                        style:--x="{base.pos[0]}px"
                        style:--y="{base.pos[1]}px"
                      >
                        <CdnImage
                          src={base.sheet}
                          alt=""
                          className="sheet-img"
                          loading="eager"
                        />
                      </span>
                    {:else}
                      <span class="inline-ring"></span>
                    {/if}
                    {#if iconSrc}
                      <span class="inline-icon-layer">
                        <CdnImage
                          src={iconSrc}
                          alt={entry.socketed?.typeLine ||
                            entry.socketed?.name ||
                            ""}
                          className="inline-socketed-icon"
                          loading="eager"
                        />
                      </span>
                    {/if}
                  </span>
                </span>
                {#if si < inlineSockets.length - 1}
                  {@const linked =
                    inlineSockets[si + 1].socket.group === entry.socket.group}
                  <span class="inline-gap" class:linked>
                    {#if linked}
                      <span
                        class="isprite inline-link"
                        style:width="{LINK_H.w}px"
                        style:height="{LINK_H.h}px"
                        style:--x="{LINK_H.x}px"
                        style:--y="{LINK_H.y}px"
                      >
                        <CdnImage
                          src={SHEET_1}
                          alt=""
                          className="sheet-img"
                          loading="eager"
                        />
                      </span>
                    {/if}
                  </span>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if isTooltip && (tooltipTexts.desc || tooltipTexts.stats.length > 0)}
      <div class="separator-line" />
      <div class="stat-group tooltip-text-group">
        {#each tooltipTexts.stats as line}
          <div class="tooltip-text-line stat">{line}</div>
        {/each}
        {#if tooltipTexts.desc}
          <div class="tooltip-text-line desc">{tooltipTexts.desc}</div>
        {/if}
      </div>
    {/if}

    <!-- Rune, Enchant & Bonded Rune Mods (Together) -->
    {#if separatedMods.runeRegular.length > 0 || enchantMods.length > 0 || separatedMods.runeBonded.length > 0}
      <div class="separator-line" />
      <div class="stat-group">
        {#each separatedMods.runeRegular as mod}
          <ItemModifier {mod} {realm} category="rune" compact={isCompact} />
        {/each}
        {#each enchantMods as mod}
          <ItemModifier {mod} {realm} category="enchant" compact={isCompact} />
        {/each}

        {#if separatedMods.runeBonded.length > 0}
          {#if !isTooltip}
            <button
              type="button"
              class="btn-bonded-inline"
              on:click|stopPropagation={() =>
                (showBondedMods = !showBondedMods)}
            >
              {showBondedMods
                ? "▾ Hide Bonded"
                : `▸ +${separatedMods.runeBonded.length} Bonded`}
            </button>
          {/if}

          {#if isTooltip || showBondedMods}
            {#each separatedMods.runeBonded as bMod}
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
    {/if}

    <!-- Granted / Socketed Skills (Right Above Implicit Modifiers) -->
    {#if extractedSkills.length > 0}
      <div class="separator-line" />
      <div class="stat-group granted-skills-group">
        {#each extractedSkills as sk}
          <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
          <div
            class="granted-skill-row"
            class:has-tooltip={sk.tooltipItem !== null}
            role={sk.tooltipItem ? "button" : undefined}
            tabindex={sk.tooltipItem ? 0 : undefined}
            on:mouseenter={(e) => openItemTooltip(e, sk.tooltipItem)}
            on:mouseleave={closeItemTooltip}
            on:focus={(e) => openItemTooltip(e, sk.tooltipItem)}
            on:blur={closeItemTooltip}
          >
            {#if sk.icon}
              <CdnImage
                src={sk.icon}
                alt={sk.label}
                className="granted-skill-icon"
              />
            {/if}
            <span class="granted-skill-text">
              <StatColorText text={sk.label} />
            </span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Implicit Mods -->
    {#if separatedMods.implicitRegular.length > 0}
      <div class="separator-line" />
      <div class="stat-group">
        {#each separatedMods.implicitRegular as mod}
          <ItemModifier {mod} {realm} category="implicit" compact={isCompact} />
        {/each}
      </div>
    {/if}

    <!-- Explicit Mods + Veiled / Unrevealed Mods -->
    {#if classifiedExplicits.length > 0 || veiledEntries.length > 0}
      <div class="separator-line" />
      <div class="stat-group">
        {#each classifiedExplicits as entry}
          <ItemModifier
            mod={entry.mod}
            {realm}
            category={entry.cat}
            compact={isCompact}
          />
        {/each}

        {#if veiledEntries.length > 0}
          <div class="veiled-mods-list">
            {#each veiledEntries as vm}
              <div
                class="item-mod--veiled"
                class:poe2={isPoe2}
                class:compact={isCompact}
              >
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
      </div>
    {/if}

    <!-- Notable Properties -->
    {#if item.notableProperties && item.notableProperties.length > 0}
      <div class="separator-line" />
      <div class="stat-group notable-group">
        {#each item.notableProperties as notable}
          <div class="notable-block">
            <div class="notable-title">
              {cleanBracketText(notable.name)}
            </div>
            {#each notable.values || [] as [line]}
              <div class="notable-line">
                {cleanBracketText(line)}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Mercenary Skills (PoE2) -->
    {#if item.mercenarySkills && item.mercenarySkills.length > 0}
      <div class="separator-line" />
      <div class="stat-group mercenary-group">
        {#each item.mercenarySkills as skill}
          <div class="mercenary-skill-line">
            <CdnImage
              src={skill.icon}
              alt={skill.name}
              className="skill-icon"
            />
            <span class="skill-name">{cleanBracketText(skill.name)}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Split + Exclusive Bottom State -->
    {#if item.split || exclusiveState}
      <div class="separator-line" />
      <div class="stat-group bottom-state-group">
        {#if item.split}
          <div class="state-stat-line state-split">Split</div>
        {/if}
        {#if exclusiveState?.kind === "foreseeing"}
          <div
            class="item-popup__desc-text--foreseeing"
            style="--foresight-url: url('{FORESIGHT_ICON}')"
            title="Foreseeing"
          ></div>
        {:else if exclusiveState?.kind === "text"}
          <div class="state-stat-line {exclusiveState.cls}">
            {exclusiveState.label}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

{#if hoveredItem}
  <div
    class="stats-skill-tooltip"
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

  /* Top Properties Block */
  .top-stats-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.12rem;
    width: 100%;
  }
  .prop-line {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    column-gap: 0.9rem;
    row-gap: 0.08rem;
    width: 100%;
    text-align: center;
  }
  /* Item level + requirements + quality never wrap onto another line */
  .prop-line.meta-req-line {
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow: hidden;
  }
  .prop-item {
    display: inline-flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    gap: 0.32rem; /* explicit space between label and every value */
    font-size: 0.95rem;
    line-height: 1.22;
    color: #cbd5e1;
  }
  .req-entry {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .mode-compact .prop-item {
    font-size: 0.9rem;
  }
  .prop-item .label {
    color: #8b9bb4;
  }
  .prop-item strong {
    font-weight: 600;
    color: #f1f5f9;
  }
  .prop-item strong.augmented {
    color: #6588ff;
  }
  .prop-tag-only {
    color: #94a3b8;
  }

  :global(.prop-icon) {
    width: 15px;
    height: 15px;
    object-fit: contain;
  }

  /* Sockets on their own centered line.
     Line height = 44px (previous overall line was 36px + 2*2px padding = 40px, x1.1).
     No box/background: sockets are sprite images at a fixed size. */
  .sockets-own-line {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 44px;
    box-sizing: border-box;
  }
  .inline-sockets {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    padding: 0;
  }
  .inline-socket {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 35px;
    height: 35px;
    outline: none;
  }
  .inline-socket.has-socketed {
    cursor: help;
  }
  .inline-socket.has-socketed:hover .inline-box,
  .inline-socket.has-socketed:focus-visible .inline-box {
    filter: brightness(1.3) drop-shadow(0 0 5px rgba(233, 207, 159, 0.75));
  }
  .inline-box {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center;
  }
  .isprite {
    position: relative;
    display: block;
    flex: none;
    overflow: hidden;
  }
  .isprite :global(img.sheet-img) {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: auto !important;
    height: auto !important;
    max-width: none !important;
    max-height: none !important;
    filter: none !important;
    pointer-events: none;
  }
  .inline-ring {
    width: 31px;
    height: 31px;
    border-radius: 50%;
    border: 2px solid #5b5b5b;
    background: radial-gradient(circle at 35% 30%, #1d1f26, #07080b 70%);
    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.9);
    box-sizing: border-box;
  }
  .inline-icon-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .inline-icon-layer :global(img.inline-socketed-icon) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
  }
  /* Gap between sockets: 12px when linked (chain sprite centred on it, same
     47px pitch as in-game), slightly wider between link groups. */
  .inline-gap {
    position: relative;
    flex: none;
    width: 20px;
    height: 35px;
  }
  .inline-gap.linked {
    width: 12px;
  }
  .inline-link {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
  }

  /* Groups & Modifiers */
  .stat-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
  }

  /* Granted Skills Row */
  .granted-skills-group {
    align-items: center;
  }
  .granted-skill-row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 1px 6px;
    color: #f1f5f9;
    font-size: 1.02rem;
    line-height: 1.22;
  }
  .granted-skill-row.has-tooltip {
    cursor: help;
  }
  .granted-skill-row.has-tooltip:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  :global(.granted-skill-icon) {
    width: 22px;
    height: 22px;
    object-fit: contain;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 0;
    background: #05070a;
    flex-shrink: 0;
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

  /* Veiled Mods (Matched to updated modifier height) */
  .veiled-mods-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    width: 100%;
  }
  .item-mod--veiled {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: var(--mod-h, 1.7rem); /* identical to ItemModifier min-height */
    overflow: hidden;
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
  .item-mod--veiled.poe2 .lc {
    height: 29px;
    width: 160px;
    flex-shrink: 0;
    background-repeat: no-repeat;
    background-position: -12480px 0;
    /* 29px sprite scaled to the modifier row height (1.7rem ≈ 27px) */
    transform: translateY(-3px) scale(0.94);
    transform-origin: center center;
    animation: animate-veiled-mod 2.6s steps(39) reverse infinite;
  }
  .item-mod--veiled.poe2.compact .lc {
    transform: translateY(-3px) scale(0.83); /* 1.5rem ≈ 24px */
  }
  .item-mod--veiled.poe2 .lc.wide {
    width: 240px;
    background-position: -18720px 0;
  }

  @keyframes animate-veiled-mod {
    0% {
      background-position: 0 0;
    }
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

  /* Separator */
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
</style>
