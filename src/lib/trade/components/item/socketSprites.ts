// src/lib/trade/components/item/socketSprites.ts
// Shared socket sprite data (used by ItemSockets overlay and ItemStats inline line)
import type { ItemSocket } from "$lib/types/tradeItem";

export const SHEET_1 =
  "/protected/image/gen/socket.png?v=1791178103574&key=mf1B3nj-F9flN8KRLcBQ8A";
export const SHEET_2 =
  "/protected/image/gen/socket2.png?v=1791178103674&key=bOOTV3VD4QQrcQMzHLZ1RA";
export const SHEET_GEM =
  "/protected/image/item/popup2/socket.png?v=1733391800174&key=4FpK7CNQARaLzQ2u33OhBg";

export type Pos = [number, number];
export type Attr = "S" | "D" | "I" | "G";

export const EMPTY: Record<"S" | "D" | "I", Pos> = {
  S: [-140, -35],
  D: [-70, -105],
  I: [-105, -35],
};

export const FILLED: Record<Attr, Pos> = {
  S: [-72, -37],
  D: [-37, -37],
  I: [-2, -37],
  G: [-140, -70],
};

export const DELVE: Pos = [-37, -2];
export const ABYSS: Pos = [-37, -72];

export const POE2_EMPTY: Record<string, Pos> = {
  rune: [0, -248],
  jewel: [0, -62],
  gem: [0, 0],
};

/** Fixed on-screen socket size (never scaled) */
export const SOCKET_SIZE = 35;

/** Link (chain) sprites on SHEET_1 */
export const LINK_H = { w: 38, h: 15, x: -175, y: 0 };
export const LINK_V = { w: 15, h: 38, x: -175, y: -15 };

export interface Sprite {
  sheet: string;
  size: number;
  pos: Pos;
  fixedScale?: number;
}

export function toAttr(socket: ItemSocket): Attr | "DV" | "A" {
  const attr = (socket.attr || "").toUpperCase();
  const col = (socket.sColour || "").toUpperCase();
  if (attr === "DV" || col === "DV") return "DV";
  if (attr === "A" || col === "A") return "A";
  if (attr === "S" || attr === "D" || attr === "I" || attr === "G") {
    return attr;
  }
  switch (col) {
    case "R":
      return "S";
    case "G":
      return "D";
    case "B":
      return "I";
    default:
      return "G";
  }
}

export function getBase(socket: ItemSocket): Sprite | null {
  const type = (socket.type || "").toString().toLowerCase();
  if (type) {
    const pos = POE2_EMPTY[type];
    if (pos) {
      if (type === "gem") {
        // SHEET_GEM assets are 72px; fixed scale renders them at ~35px
        return { sheet: SHEET_GEM, size: 72, pos, fixedScale: 35 / 72 };
      }
      // SHEET_2 sprites are 62px @2x assets; fixed 0.56 scale renders them at a constant ~35px
      return { sheet: SHEET_2, size: 62, pos, fixedScale: 0.56 };
    }
    return null;
  }
  const a = toAttr(socket);
  if (a === "DV") return { sheet: SHEET_1, size: 31, pos: DELVE };
  if (a === "A") return { sheet: SHEET_1, size: 31, pos: ABYSS };
  if (a === "S" || a === "D" || a === "I") {
    return { sheet: SHEET_1, size: 35, pos: EMPTY[a] };
  }
  return { sheet: SHEET_1, size: 35, pos: FILLED.G };
}
