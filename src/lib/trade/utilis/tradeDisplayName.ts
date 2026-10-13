import type { ItemEntry } from "$lib/types/items";
import type { FilterGroup } from "$lib/types/filters";

export function getItemDisplayName(
  entry: ItemEntry | null | undefined,
): string {
  if (!entry) return "";
  if (entry.text) return entry.text;
  if (entry.name) {
    return entry.type ? `${entry.name} (${entry.type})` : entry.name;
  }
  return entry.type || "";
}

export function getActiveRarityText(
  fValues: Record<string, Record<string, any>>,
  allKnownFilterGroups: FilterGroup[],
): string {
  for (const [gid, gVals] of Object.entries(fValues)) {
    for (const [fid, fVal] of Object.entries(gVals)) {
      if (fid.toLowerCase().includes("rarity") && fVal?.option) {
        const gDef = allKnownFilterGroups.find((g) => g.id === gid);
        const fDef = gDef?.filters?.find((f) => f.id === fid);
        const opt = fDef?.option?.options?.find((o) => o.id === fVal.option);
        const raw = opt?.text || fVal.option;
        if (raw && raw.toLowerCase() !== "any") return raw;
      }
    }
  }
  return "";
}

export function computeDisplayName(
  customTitle: string,
  item: ItemEntry | null,
  queryText: string,
  fValues: Record<string, Record<string, any>>,
  currentRealm: string,
  initDisplay: string,
  entriesList: ItemEntry[],
  allKnownFilterGroups: FilterGroup[],
): string {
  if (customTitle && customTitle.trim()) return customTitle.trim();

  const rarityText = getActiveRarityText(fValues, allKnownFilterGroups);
  const activeItem =
    item ||
    (queryText.trim()
      ? entriesList.find(
          (e) =>
            (e.name &&
              e.name.toLowerCase() === queryText.trim().toLowerCase()) ||
            (e.text || e.type).toLowerCase() === queryText.trim().toLowerCase(),
        )
      : null);

  if (activeItem) {
    const isUnique = Boolean(
      activeItem.flags?.unique ||
      (activeItem.name && activeItem.name !== activeItem.type),
    );
    if (isUnique) return activeItem.name || activeItem.text || activeItem.type;
    const baseType = activeItem.type || activeItem.text || "";
    return rarityText ? `${rarityText} ${baseType}`.trim() : baseType;
  }

  for (const [, gVals] of Object.entries(fValues)) {
    for (const [fid, fVal] of Object.entries(gVals)) {
      const isTierKey =
        fid.toLowerCase().includes("tier") ||
        fid.toLowerCase().includes("waystone") ||
        fid.toLowerCase().includes("map_tier");
      if (isTierKey && fVal?.min !== undefined && fVal?.min !== "") {
        return `Waystone (Tier ${fVal.min})`;
      }
    }
  }

  let categoryText = "";
  for (const [gid, gVals] of Object.entries(fValues)) {
    for (const [fid, fVal] of Object.entries(gVals)) {
      if (
        (fid.toLowerCase().includes("category") ||
          fid.toLowerCase().includes("type")) &&
        !fid.toLowerCase().includes("rarity") &&
        fVal?.option
      ) {
        const gDef = allKnownFilterGroups.find((g) => g.id === gid);
        const fDef = gDef?.filters?.find((f) => f.id === fid);
        const opt = fDef?.option?.options?.find((o) => o.id === fVal.option);
        const raw = opt?.text || fVal.option;
        if (raw && raw.toLowerCase() !== "any") categoryText = raw;
      }
    }
  }

  if (rarityText && categoryText) return `${rarityText} ${categoryText}`.trim();
  if (categoryText) return categoryText.trim();
  if (rarityText) return `${rarityText} Item`.trim();

  return initDisplay?.trim() || `${currentRealm.toUpperCase()} Trade Search`;
}
