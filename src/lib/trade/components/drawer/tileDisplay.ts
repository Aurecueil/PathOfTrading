import type { TileDisplayOptions } from "$lib/types/types";

export const DEFAULT_CURRENCY = "chaos";
export const DEFAULT_SEARCH_ON_LOAD = true;

export const DEFAULT_DISPLAY_OPTIONS: TileDisplayOptions = {
  displayImplicitMods: true,
  displayExplicitMods: true,
  displayEnchantMods: true,
  displayRuneMods: true,
  displayScourgeMods: true,
  displayBondedMods: true,
  displayCrucibleMods: true,
  displayVeiledMods: true,
  displayPseudoMods: true,
};

export function normalizeDisplayOptions(
  src?: Partial<TileDisplayOptions> | null,
): TileDisplayOptions {
  const out: TileDisplayOptions = { ...DEFAULT_DISPLAY_OPTIONS };
  if (!src || typeof src !== "object") return out;
  for (const k of Object.keys(out) as (keyof TileDisplayOptions)[]) {
    const v = src[k];
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

export function normalizeCurrency(v?: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : DEFAULT_CURRENCY;
}

export function normalizeSearchOnLoad(v?: unknown): boolean {
  return typeof v === "boolean" ? v : DEFAULT_SEARCH_ON_LOAD;
}

/** One call that yields all three tile fields, valid even for old saves / share codes. */
export function normalizeTileExtras(
  src?: {
    displayOptions?: Partial<TileDisplayOptions> | null;
    currency?: string;
    searchOnLoad?: boolean;
  } | null,
) {
  return {
    displayOptions: normalizeDisplayOptions(src?.displayOptions),
    currency: normalizeCurrency(src?.currency),
    searchOnLoad: normalizeSearchOnLoad(src?.searchOnLoad),
  };
}

/** `key` matches the field name on the trade item JSON. */
export const MOD_DISPLAY_FIELDS: Array<{
  flag: keyof TileDisplayOptions;
  key: string;
  label: string;
  realm: "both" | "poe" | "poe2";
}> = [
  {
    flag: "displayImplicitMods",
    key: "implicitMods",
    label: "Implicit",
    realm: "both",
  },
  {
    flag: "displayExplicitMods",
    key: "explicitMods",
    label: "Explicit",
    realm: "both",
  },
  {
    flag: "displayEnchantMods",
    key: "enchantMods",
    label: "Enchant",
    realm: "both",
  },
  { flag: "displayRuneMods", key: "runeMods", label: "Rune", realm: "both" },
  {
    flag: "displayScourgeMods",
    key: "scourgeMods",
    label: "Scourge",
    realm: "poe",
  },
  {
    flag: "displayCrucibleMods",
    key: "crucibleMods",
    label: "Crucible",
    realm: "poe",
  },
  {
    flag: "displayBondedMods",
    key: "bondedMods",
    label: "Bonded",
    realm: "poe2",
  },
  {
    flag: "displayVeiledMods",
    key: "veiledMods",
    label: "Veiled",
    realm: "both",
  },
  {
    flag: "displayPseudoMods",
    key: "pseudoMods",
    label: "Pseudo",
    realm: "both",
  },
];

/** { implicitMods: true, explicitMods: false, ... } for SearchItemRow */
export function getModVisibility(
  opts?: Partial<TileDisplayOptions> | null,
): Record<string, boolean> {
  const n = normalizeDisplayOptions(opts);
  const out: Record<string, boolean> = {};
  for (const f of MOD_DISPLAY_FIELDS) out[f.key] = n[f.flag];
  return out;
}
export const POE1_CURRENCIES = [
  "chaos",
  "divine",
  "alch",
  "exalted",
  "alt",
  "mirror",
  "chrome",
  "blessed",
  "fusing",
  "jewellers",
  "regal",
  "vaal",
  "chance",
  "annul",
  "aug",
  "regret",
  "scour",
  "transmute",
  "wisdom",
  "portal",
  "scrap",
  "whetstone",
  "gcp",
  "bauble",
  "offer",
];

export const POE2_CURRENCIES = [
  "exalted",
  "greater-exalted-orb",
  "perfect-exalted-orb",
  "divine",
  "chaos",
  "greater-chaos-orb",
  "perfect-chaos-orb",
  "alch",
  "annul",
  "regal",
  "greater-regal-orb",
  "perfect-regal-orb",
  "transmute",
  "greater-orb-of-transmutation",
  "perfect-orb-of-transmutation",
  "aug",
  "greater-orb-of-augmentation",
  "perfect-orb-of-augmentation",
  "chance",
  "vaal",
  "artificers",
  "fracturing-orb",
  "mirror",
  "wisdom",
];

export function getCurrencyIdsForRealm(realm: string): string[] {
  return realm === "poe2" ? POE2_CURRENCIES : POE1_CURRENCIES;
}

export function isCurrencyValidForRealm(
  currency: string,
  realm: string,
): boolean {
  return getCurrencyIdsForRealm(realm).includes(currency);
}

/** "greater-exalted-orb" -> "Greater Exalted Orb" (fallback when the catalog has no label) */
export function prettifyCurrencyId(id: string): string {
  return id
    .split("-")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}
