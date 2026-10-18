// src/lib/trade/components/item/stats/propertyGroups.ts
import type { Item, ItemProperty } from "$lib/types/tradeItem";
import { cleanBracketText } from "./statsUtils";

export type SpecialKind = "memory" | "intangibility";

export interface FormattedPropValue {
  text: string;
  color: string;
}

export interface FormattedProp {
  label: string;
  values: FormattedPropValue[];
  icon?: string;
  special?: SpecialKind;
}

export interface GroupedProps {
  defenceLine: FormattedProp[];
  weaponRateLine: FormattedProp[];
  singleLines: FormattedProp[];
  specialLines: FormattedProp[];
  qualityProp: FormattedProp | null;
}

export interface KpiStat {
  label: string;
  value: string;
  augmented?: boolean;
}

export interface RequirementEntry {
  name: string;
  value: string;
}

/* Special properties (Memory Strands = type 99, Intangibility = type 110) */
function getSpecialKind(p: ItemProperty): SpecialKind | null {
  if (p.type === 99) return "memory";
  if (p.type === 110) return "intangibility";
  return null;
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

// Zwraca zawsze pełną nazwę (usunięto skróty typu EV, ES, AR dla trybu compact)
function mapPropLabel(cleanName: string, compact: boolean): string {
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

/** DPS, pDPS, eDPS (shown in one line) */
export function buildKpiStats(item: Item): KpiStat[] {
  const list: KpiStat[] = [];
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
}

export function groupProperties(item: Item, compact: boolean): GroupedProps {
  const rawProps = item.properties || [];
  const defenceLine: FormattedProp[] = [];
  const weaponRateEntries: { order: number; prop: FormattedProp }[] = [];
  const singleLines: FormattedProp[] = [];
  const specialLines: FormattedProp[] = [];
  let mergedDamage: FormattedProp | null = null;
  let qualityProp: FormattedProp | null = null;

  for (const p of rawProps) {
    const cleanName = cleanBracketText(p.name).trim();
    if (!cleanName) continue;

    // Special styled properties (Memory Strands, Intangibility)
    const specialKind = getSpecialKind(p);
    if (specialKind) {
      specialLines.push({
        ...formatProperty(p, compact),
        special: specialKind,
      });
      continue;
    }

    // USUNIĘTO warunek ukrywający właściwość, jeśli jej nazwa zawierała się w baseType

    if (isQualityProp(p, cleanName)) {
      qualityProp = formatProperty(p, compact);
      continue;
    }

    if (isDefenceProp(cleanName)) {
      defenceLine.push(formatProperty(p, compact));
      continue;
    }

    const rateOrder = getWeaponRateOrder(cleanName);
    if (rateOrder > 0) {
      weaponRateEntries.push({
        order: rateOrder,
        prop: formatProperty(p, compact),
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
        mergedDamage = { label: "Damage", values: [...dmgVals] };
        singleLines.push(mergedDamage);
      } else {
        mergedDamage.values.push(...dmgVals);
      }
      continue;
    }

    singleLines.push(formatProperty(p, compact));
  }

  weaponRateEntries.sort((a, b) => a.order - b.order);

  return {
    defenceLine,
    weaponRateLine: weaponRateEntries.map((e) => e.prop),
    singleLines,
    specialLines,
    qualityProp,
  };
}

export function buildRequirementEntries(item: Item): RequirementEntry[] {
  const all = [
    ...(item.requirements || []),
    ...(item.weaponRequirements || []),
    ...(item.supportGemRequirements || []),
  ];
  return all
    .map((req) => ({
      name: cleanBracketText(req.name || "").trim(),
      value: cleanBracketText(req.values?.[0]?.[0] || "").trim(),
    }))
    .filter((r) => r.name || r.value);
}
