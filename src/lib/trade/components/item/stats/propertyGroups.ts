// src/lib/trade/components/item/stats/propertyGroups.ts
import type { Item, ItemProperty } from "$lib/types/tradeItem";
import { cleanBracketText } from "./statsUtils";
import { resolvePropertyColor } from "./propertyColors";

export type SpecialKind = "memory" | "intangibility";

export interface FormattedPropValue {
  text: string;
  color: string;
}

export interface KpiStat {
  label: string;
  value: string;
  augmented?: boolean;
}

/** One wrapping line made of several properties (requirements etc.) */
export interface PropertyGroup {
  key: string;
  label?: string;
  props: ItemProperty[];
  /** requirement-style: "Level 60" instead of "Level: 60", comma separated */
  bare: boolean;
}

/* Special properties (Memory Strands = type 99, Intangibility = type 110) */
export function getSpecialKind(p: ItemProperty): SpecialKind | null {
  if (p.type === 99) return "memory";
  if (p.type === 110) return "intangibility";
  return null;
}

export function toFormattedValues(
  p: ItemProperty,
  isPoe2: boolean,
): FormattedPropValue[] {
  return (p.values ?? []).map(([text, idx]) => ({
    text: cleanBracketText(text ?? ""),
    color: resolvePropertyColor(idx, isPoe2),
  }));
}

/** Separators (mode 4) are always renderable; otherwise need a name or a value. */
export function isRenderableProp(p: ItemProperty): boolean {
  if (p.displayMode === 4) return true;
  return Boolean((p.name ?? "").trim()) || (p.values?.length ?? 0) > 0;
}

const INLINE_GROUPS: {
  key: keyof Item;
  label?: string;
  bare: boolean;
}[] = [
  { key: "requirements", label: "Requires:", bare: true },
  { key: "weaponRequirements", bare: true },
  { key: "supportGemRequirements", bare: true },
  { key: "nextLevelRequirements", label: "Next Level:", bare: true },
];

export function buildInlineGroups(item: Item): PropertyGroup[] {
  const out: PropertyGroup[] = [];
  for (const g of INLINE_GROUPS) {
    const props = ((item[g.key] as ItemProperty[] | undefined) ?? []).filter(
      isRenderableProp,
    );
    if (props.length > 0) {
      out.push({ key: String(g.key), label: g.label, props, bare: g.bare });
    }
  }
  return out;
}

/** DPS, pDPS, eDPS (from `extended`, shown in one line) */
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
