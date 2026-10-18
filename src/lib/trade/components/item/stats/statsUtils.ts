// src/lib/trade/components/item/stats/statsUtils.ts
import type { Item } from "$lib/types/tradeItem";

export const CDN_BASE = "https://web.poecdn.com";

export function cleanBracketText(text: string): string {
  if (!text) return "";
  return text.replace(/\[([^\]]+)\]/g, (_, inner: string) => {
    const parts = inner.split("|");
    return parts[parts.length - 1];
  });
}

export function normalizeModHash(hash?: string): string {
  if (!hash) return "";
  return hash.startsWith("stat.") ? hash.slice(5) : hash;
}

export function getRarityClass(it: Item): string {
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
