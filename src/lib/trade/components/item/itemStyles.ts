// src/lib/trade/components/item/itemStyles.ts
import type { Item } from "$lib/types/tradeItem";

export const CORRUPTED_TINT = "#d2000033";

export interface ItemStyle {
  title_font_color: string;
  title_bar_color: string;
  title_line_color: string;
  side_bar_color: string;
  body_tint_color: string;
}

export const FOIL_GRADIENTS: Record<number, string> = {
  1: "linear-gradient(180deg,#9739fda3,#f7b8ff)", // amethyst
  2: "linear-gradient(180deg,#6cff47a3,#045a52)", // verdant
  3: "linear-gradient(180deg,#ff477ad4,#fdb6b6)", // ruby
  4: "linear-gradient(180deg,#47ffeea3,#2779f5d9)", // cobalt
  5: "linear-gradient(180deg,#ffbe47a3,#6d27f5a1)", // sunset
  6: "linear-gradient(180deg,#ffea55c7,#f5a327d1)", // aureate
  7: "linear-gradient(180deg,#ff22aaa3,#fad4ff)", // g1
  8: "linear-gradient(180deg,#a8050594,#5e5e5e36)", // g2
  9: "linear-gradient(180deg,#346e00ab,#c17aff)", // g3
  10: "linear-gradient(180deg,#fffb3aa3,#6a2f1df2)", // g4
  11: "linear-gradient(180deg,#b8e9a9d6,#e53f55a1)", // g5
  12: "linear-gradient(180deg,#53d6ffc7,#582a7ad1)", // g6
};
export function getFoilGradient(
  frameTypeId?: string | null,
  foilVariation: number | null = 0,
): string | null {
  if (String(frameTypeId ?? "").toLowerCase() !== "supporterfoil") return null;
  const raw = Number(foilVariation ?? 0);
  return FOIL_GRADIENTS[Number.isFinite(raw) ? raw : 0] ?? null;
}
export const ITEM_STYLES: Record<string, ItemStyle> = {
  normal: {
    title_font_color: "#C8C8C8",
    title_bar_color: "#30302F",
    title_line_color: "#94929C",
    side_bar_color: "#94929C",
    body_tint_color: "#242423",
  },
  magic: {
    title_font_color: "#8888FF",
    title_bar_color: "#8888ff3d",
    title_line_color: "#8888ff61",
    side_bar_color: "#8888ff",
    body_tint_color: "#8888ff12",
  },
  rare: {
    title_font_color: "#ffff77",
    title_bar_color: "#ffff773d",
    title_line_color: "#ffff7761",
    side_bar_color: "#ffff77",
    body_tint_color: "#ffff7712",
  },
  unique: {
    title_font_color: "#AE6025",
    title_bar_color: "#af60253d",
    title_line_color: "#af602561",
    side_bar_color: "#af6025",
    body_tint_color: "#af602512",
  },
  gem: {
    title_font_color: "#1BA29B",
    title_bar_color: "#173533",
    title_line_color: "#173533",
    side_bar_color: "#408073",
    body_tint_color: "#16181E",
  },
  currency: {
    title_font_color: "#A2957C",
    title_bar_color: "#2D281A",
    title_line_color: "#9A8866",
    side_bar_color: "#8D7847",
    body_tint_color: "#302A1A",
  },
  divinationcard: {
    title_font_color: "#0ebaff",
    title_bar_color: "#0ebaff3d",
    title_line_color: "#0ebaff61",
    side_bar_color: "#0ebaff",
    body_tint_color: "#0ebaff12",
  },
  foil: {
    title_font_color: "#7fb064",
    title_bar_color: "#302820",
    title_line_color: "#af602561",
    side_bar_color: "#af6025",
    body_tint_color: "#af602512",
  },
  runicnormal: {
    title_font_color: "#C8C8C8",
    title_bar_color: "#30302F",
    title_line_color: "#62CBF7",
    side_bar_color: "#94929C",
    body_tint_color: "#4eacf02d",
  },
  runicmagic: {
    title_font_color: "#8888FF",
    title_bar_color: "#8888ff3d",
    title_line_color: "#62CBF7",
    side_bar_color: "#8888ff",
    body_tint_color: "#4eacf02d",
  },
  runicrare: {
    title_font_color: "#ffff77",
    title_bar_color: "#ffff773d",
    title_line_color: "#62CBF7",
    side_bar_color: "#ffff77",
    body_tint_color: "#4eacf02d",
  },
  runicunique: {
    title_font_color: "#AE6025",
    title_bar_color: "#af60253d",
    title_line_color: "#62CBF7",
    side_bar_color: "#af6025",
    body_tint_color: "#4eacf02d",
  },
};
const FOIL_BASE: ItemStyle = {
  title_font_color: ITEM_STYLES.foil.title_font_color, // font from regular foil
  title_bar_color: ITEM_STYLES.foil.title_bar_color,
  title_line_color: ITEM_STYLES.foil.title_line_color,
  side_bar_color: ITEM_STYLES.unique.side_bar_color, // sidebar from unique
  body_tint_color: ITEM_STYLES.unique.body_tint_color, // tint from unique
};

export interface StyleVarOptions {
  corrupted?: boolean; // corrupted or double corrupted
  titleBg?: string | null; // foil gradient; falls back to title_bar_color
}

/** The first style in the map, used when a frameTypeId isn't known. */
export const DEFAULT_STYLE: ItemStyle = Object.values(ITEM_STYLES)[0];

export function resolveItemStyle(
  frameTypeId?: string | null,
  foilVariation: number | null = 0,
): ItemStyle {
  const frameId = String(frameTypeId ?? "").toLowerCase();
  if (!frameId) return DEFAULT_STYLE;

  if (frameId === "supporterfoil") {
    const raw = Number(foilVariation ?? 0);
    const v = Number.isFinite(raw) ? raw : 0;
    return FOIL_BASE;
  }

  return ITEM_STYLES[frameId] ?? DEFAULT_STYLE;
}

/** "r, g, b" from #rgb / #rgba / #rrggbb / #rrggbbaa / rgb() / rgba(). Used for --rc-rgb. */
function toRgbTriplet(c: string): string {
  const s = c.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }
  const m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  return m ? `${m[1]}, ${m[2]}, ${m[3]}` : "127, 127, 127";
}

export function styleToCssVars(
  s: ItemStyle,
  styleType: number,
  opts: StyleVarOptions = {},
): string {
  const accent = styleType === 1 ? s.title_font_color : s.side_bar_color;
  return [
    `--title-font-color:${s.title_font_color}`,
    `--title-bar-color:${s.title_bar_color}`,
    `--title-bar-bg:${opts.titleBg ?? s.title_bar_color}`,
    `--title-line-color:${s.title_line_color}`,
    `--side-bar-color:${s.side_bar_color}`,
    `--body-tint-color:${opts.corrupted ? CORRUPTED_TINT : s.body_tint_color}`,
    `--rc:${accent}`,
    `--rc-rgb:${toRgbTriplet(accent)}`,
  ].join(";");
}
