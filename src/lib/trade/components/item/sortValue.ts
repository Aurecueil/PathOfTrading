// src/lib/searchTile/sortValue.ts
import type { TradeFetchResult } from "$lib/types/tradeItem";

/**
 * Returns the WHOLE value of the field the payload sorts by, untouched.
 * e.g. sort { price: "asc" } -> entry.listing.price
 *      { amount: 55, currency: "divine", type: "~b/o" }
 * No parsing, no averaging, no calculation: the consumer decides what to do.
 */
export function extractSortValue(
  entry: TradeFetchResult | null,
  payload: any,
): any {
  if (!entry) return null;

  const sortObj = payload?.sort;
  const field =
    sortObj && typeof sortObj === "object"
      ? Object.keys(sortObj)[0] || "price"
      : "price";

  const listing: any = entry.listing;
  const item: any = entry.item;

  if (listing && field in listing) return listing[field];
  if (item?.extended && field in item.extended) return item.extended[field];
  if (item && field in item) return item[field];
  if ((entry as any)[field] !== undefined) return (entry as any)[field];

  // Mod-like field (e.g. "statgroup.0", "stat.explicit.stat_123"):
  // return the matching mod entry as is.
  const wanted = field.startsWith("stat.") ? field.slice(5) : field;
  const lists = [
    item?.pseudoMods,
    item?.implicitMods,
    item?.explicitMods,
    item?.enchantMods,
    item?.runeMods,
    item?.scourgeMods,
    item?.bondedMods,
    item?.crucibleMods,
    item?.veiledMods,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    const found = list.find(
      (m: any) =>
        m &&
        typeof m === "object" &&
        typeof m.hash === "string" &&
        (m.hash.startsWith("stat.") ? m.hash.slice(5) : m.hash) === wanted,
    );
    if (found) return found;
  }

  return null;
}
