// src/lib/trade/components/item/stats/statsUtils.ts
import type { Item } from "$lib/types/tradeItem";

export const CDN_BASE = "https://web.poecdn.com";

export type KeywordSegment =
  | { type: "text"; text: string }
  | { type: "keyword"; key: string; display: string };

const NUMERIC_RANGE_RE = /^[+-]?\d+(?:\.\d+)?(?:[-+][+-]?\d+(?:\.\d+)?)*$/;

/**
 * Splits text into plain text and bracketed `[keyword|display]` or `[keyword]` segments.
 * Ignores numeric roll ranges like `[10-20]` or `[5-10+12-18]`.
 */
export function parseKeywordSegments(text: string): KeywordSegment[] {
  if (!text) return [];
  const segments: KeywordSegment[] = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const inner = match[1];

    // Keep numeric roll ranges (e.g., [10-20]) as plain text
    if (!inner.includes("|") && NUMERIC_RANGE_RE.test(inner.trim())) {
      continue;
    }

    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        text: text.slice(lastIndex, match.index),
      });
    }

    const pipeIdx = inner.indexOf("|");
    if (pipeIdx !== -1) {
      const key = inner.slice(0, pipeIdx).trim();
      const display = inner.slice(pipeIdx + 1).trim();
      segments.push({
        type: "keyword",
        key: key || display,
        display: display || key,
      });
    } else {
      const val = inner.trim();
      segments.push({
        type: "keyword",
        key: val,
        display: val,
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      text: text.slice(lastIndex),
    });
  }

  return segments;
}

export function cleanBracketText(text: string): string {
  if (!text) return "";
  return text.replace(/\[([^\]]+)\]/g, (full, inner: string) => {
    if (!inner.includes("|") && NUMERIC_RANGE_RE.test(inner.trim())) {
      return full;
    }
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
