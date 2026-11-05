// src/lib/trade/components/item/stats/propertyGroups.ts
import type { Item, ItemProperty } from "$lib/types/tradeItem";
import { cleanBracketText } from "./statsUtils";
import { resolvePropertyColor } from "./propertyColors";

export type SpecialKind = "memory" | "intangibility";

export interface FormattedPropValue {
  text: string;
  color: string;
}

export interface PropertyGroup {
  key: string;
  label?: string;
  props: ItemProperty[];
  bare: boolean;
}

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
  { key: "weaponRequirements", label: "Requires:", bare: true },
  { key: "supportGemRequirements", bare: true },
];
export function buildInlineGroups(item: Item): PropertyGroup[] {
  const out: PropertyGroup[] = [];
  const ilvl = item.ilvl || item.itemLevel;

  if (ilvl && ilvl > 0) {
    out.push({
      key: "itemLevel",
      props: [{ name: "Item Level", values: [[String(ilvl), 0]] }],
      bare: false,
    });
  }

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

export interface ExtendedCell {
  pre?: string;
  value: string;
  post?: string;
  color: string;
}

export function buildExtendedCells(
  ext: Item["extended"] | undefined,
  isPoe2: boolean,
): (ExtendedCell | null)[] {
  if (!ext) return [null, null, null, null, null];
  const pos = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v > 0;
  const fmt = (v: number) => Math.round(v).toLocaleString();
  const col = (aug?: boolean) => resolvePropertyColor(aug ? 1 : 0, isPoe2);
  const mk = (
    v: number,
    aug: boolean | undefined,
    pre?: string,
    post?: string,
  ): ExtendedCell => ({ pre, value: fmt(v), post, color: col(aug) });

  const pick = (
    a: ExtendedCell | null,
    b: ExtendedCell | null,
  ): ExtendedCell | null => a ?? b;

  return [
    pick(
      typeof ext.base_defence_percentile === "number"
        ? mk(ext.base_defence_percentile, false, undefined, "% Base")
        : null,
      pos(ext.dps) ? mk(ext.dps, ext.dps_aug, "DPS: ") : null,
    ),
    pick(
      pos(ext.ar) ? mk(ext.ar, ext.ar_aug, "Armour: ") : null,
      pos(ext.pdps) ? mk(ext.pdps, ext.pdps_aug, "Physical DPS: ") : null,
    ),
    pick(
      pos(ext.ev) ? mk(ext.ev, ext.ev_aug, "Evasion: ") : null,
      pos(ext.edps)
        ? mk(ext.edps, (ext as any).edps_aug, "Elemental DPS: ")
        : null,
    ),
    pos(ext.es) ? mk(ext.es, ext.es_aug, "Energy Shield: ") : null,
    pos(ext.ward) ? mk(ext.ward, ext.ward_aug, "Ward: ") : null,
  ];
}
