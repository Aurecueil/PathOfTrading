// src/lib/trade/components/item/itemStyles.ts
import type { Item } from "$lib/types/tradeItem";

/* ================================================================== */
/* Tints                                                              */
/* ================================================================== */
export const CORRUPTED_TINT = "#bc313133";
export const RUNIC_TINT = "#4eacf02d";

/* ================================================================== */
/* Frame styles                                                       */
/* ================================================================== */
export interface ItemStyle {
  title_font_color: string;
  title_bar_color: string;
  title_line_color: string;
  side_bar_color: string;
  body_tint_color: string;
}

const normal: ItemStyle = {
  title_font_color: "#C8C8C8",
  title_bar_color: "#30302F",
  title_line_color: "#94929C",
  side_bar_color: "#94929C",
  body_tint_color: "#242423",
};
const magic: ItemStyle = {
  title_font_color: "#8888FF",
  title_bar_color: "#8888ff3d",
  title_line_color: "#8888ff61",
  side_bar_color: "#8888ff",
  body_tint_color: "#8888ff12",
};
const rare: ItemStyle = {
  title_font_color: "#ffff77",
  title_bar_color: "#ffff773d",
  title_line_color: "#ffff7761",
  side_bar_color: "#ffff77",
  body_tint_color: "#ffff7712",
};
const unique: ItemStyle = {
  title_font_color: "#AE6025",
  title_bar_color: "#af60253d",
  title_line_color: "#af602561",
  side_bar_color: "#af6025",
  body_tint_color: "#af61252c",
};

export const ITEM_STYLES: Record<string, ItemStyle> = {
  normal,
  magic,
  rare,
  unique,
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
  viscera: {
    title_font_color: "#8FA0C2",
    title_bar_color: "#3c2a19",
    title_line_color: "#6B523D",
    side_bar_color: "#5A4533",
    body_tint_color: "#1A120E",
  },
  runicnormal: normal,
  runicmagic: magic,
  runicrare: rare,
  runicunique: { ...unique, body_tint_color: "#af602512" },
};

export const DEFAULT_STYLE: ItemStyle = normal;

/** Supporter foil: foil title colours, unique side bar / tint. */
const SUPPORTER_FOIL_STYLE: ItemStyle = {
  ...ITEM_STYLES.foil,
  side_bar_color: unique.side_bar_color,
  body_tint_color: unique.body_tint_color,
};

export function isSupporterFoil(
  frameTypeId?: string | null,
  frameType?: number | null,
): boolean {
  return (
    String(frameTypeId ?? "").toLowerCase() === "supporterfoil" ||
    frameType === 9
  );
}

export function isRunicFrame(frameTypeId?: string | null): boolean {
  return String(frameTypeId ?? "")
    .toLowerCase()
    .startsWith("runic");
}

export function resolveItemStyle(frameTypeId?: string | null): ItemStyle {
  const id = String(frameTypeId ?? "").toLowerCase();
  if (!id) return DEFAULT_STYLE;
  if (id === "supporterfoil") return SUPPORTER_FOIL_STYLE;
  return ITEM_STYLES[id] ?? DEFAULT_STYLE;
}

/** Left tint comes from the item's `rarity` (Normal/Magic/Rare/Unique). */
const RARITIES = new Set(["normal", "magic", "rare", "unique"]);
export function resolveRarityTint(rarity?: string | null): string | null {
  const r = String(rarity ?? "").toLowerCase();
  return RARITIES.has(r) ? ITEM_STYLES[r].body_tint_color : null;
}

/** Rarity first; if the item has none, the frame style's tint. */
export function resolveLeftTint(
  rarity?: string | null,
  frameTypeId?: string | null,
): string {
  return (
    resolveRarityTint(rarity) ?? resolveItemStyle(frameTypeId).body_tint_color
  );
}

/* ================================================================== */
/* Supporter foil                                                     */
/* ================================================================== */
/** [top, bottom] stop of every foil gradient (alpha included). Single source of truth. */
const FOIL_STOPS: Record<number, [string, string]> = {
  1: ["#9739fda3", "#f7b8ff"], // amethyst
  2: ["#6cff47a3", "#045a52"], // verdant
  3: ["#ff477ad4", "#fdb6b6"], // ruby
  4: ["#47ffeea3", "#2779f5d9"], // cobalt
  5: ["#ffbe47a3", "#6d27f5a1"], // sunset
  6: ["#ffea55c7", "#f5a327d1"], // aureate
  7: ["#ff22aaa3", "#fad4ff"], // g1
  8: ["#a8050594", "#5e5e5e36"], // g2
  9: ["#346e00ab", "#c17aff"], // g3
  10: ["#fffb3aa3", "#6a2f1df2"], // g4
  11: ["#b8e9a9d6", "#e53f55a1"], // g5
  12: ["#53d6ffc7", "#582a7ad1"], // g6
};

export const FOIL_GRADIENTS: Record<number, string> = Object.fromEntries(
  Object.entries(FOIL_STOPS).map(([k, [a, b]]) => [
    Number(k),
    `linear-gradient(180deg, ${a}, ${b})`,
  ]),
) as Record<number, string>;

export function getFoilGradient(
  frameTypeId?: string | null,
  foilVariation: number | null = 0,
): string | null {
  if (String(frameTypeId ?? "").toLowerCase() !== "supporterfoil") return null;
  return FOIL_GRADIENTS[Number(foilVariation ?? 0)] ?? null;
}

/** [line 1, line 2] colours straight from the gradient stops; null if not a supporter foil. */
export function getFoilColors(
  frameTypeId?: string | null,
  foilVariation: number | null = 0,
  frameType?: number | null,
): [string, string] | null {
  if (!isSupporterFoil(frameTypeId, frameType)) return null;
  const stops = FOIL_STOPS[Number(foilVariation ?? 0)];
  const fb = ITEM_STYLES.foil.title_font_color;
  return stops ? [stops[0], stops[1]] : [fb, fb];
}

/** CSS vars, still used by the minimal-mode foil rules. */
export function getFoilTitleVars(
  frameTypeId?: string | null,
  foilVariation: number | null = 0,
  frameType?: number | null,
): string {
  const c = getFoilColors(frameTypeId, foilVariation, frameType);
  return c ? `--foil-c1: ${c[0]}; --foil-c2: ${c[1]};` : "";
}

/* ================================================================== */
/* Header art                                                         */
/* ================================================================== */
const CDN = "https://web.poecdn.com/protected/image/item";
const V_BASE = 1709582916256;
const V_RELIC2 = 1742523473552;
const V_RUNIC = 1777507982778;
const V_STRAWMAN = 1792542404183;

type Keys = [left: string, right: string, middle: string];
interface HeaderArt {
  file: string;
  v: number;
  keys: Keys;
  size?: number; // px height the art is scaled to (PoE 2 only)
}
interface HeaderSet {
  single: HeaderArt;
  double?: HeaderArt;
}
const art = (
  file: string,
  v: number,
  keys: Keys,
  size?: number,
): HeaderArt => ({ file, v, keys, size });

const RELIC2: HeaderSet = {
  single: art(
    "header-relic",
    V_RELIC2,
    [
      "eLRRNZAOKrK5jF8Y2SF3Lw",
      "Zloh7-1KlqDxDjQdK-nibQ",
      "QH7gwzBDamSgJYEhCYYa7g",
    ],
    29,
  ),
  double: art(
    "header-double-relic",
    V_RELIC2,
    [
      "FYMGa7CrowT_fAWqcf3M-g",
      "Yrlkt73O6Ty19plaLH6t6g",
      "xKW2HY2WawlIK5ruLOHKcw",
    ],
    46,
  ),
};

const HEADERS_POE2: Record<string, HeaderSet> = {
  magic: {
    single: art(
      "header-magic",
      V_BASE,
      [
        "o3_dFKQzRKG62y6uHCs7jQ",
        "Z4fOOCC3bnyTIZvSCJZSqw",
        "23gaDOOaTXEb7bKEt0GMfA",
      ],
      29,
    ),
  },
  rare: {
    single: art(
      "header-rare",
      V_BASE,
      [
        "I3T2vXAWpNnedfwkMVK3ZA",
        "ZGQJNEchUOjMqm8UcnXedQ",
        "CEBfM9Dbz-I9nhXZKUalGA",
      ],
      29,
    ),
    double: art(
      "header-double-rare",
      V_BASE,
      [
        "GlFK9dDlo33Cw3Ak7P5MnA",
        "rXqdxbUkuIkWyVJPJVY9cQ",
        "yJGcA667EzDzrPzd1_9-vg",
      ],
      46,
    ),
  },
  unique: {
    single: art("header-unique", V_BASE, [
      "LfcfpM0Zj_hf2IAdg7W3ww",
      "Ur5K4jb1yTYY_CKF5m-9PQ",
      "sPiOBadbuA6zqLIJTgQ6HQ",
    ]),
    double: art("header-double-unique", V_BASE, [
      "qrl8M2m852PSVfYgs7nT9g",
      "o1T64-ZQYCasntgXT_L8SA",
      "wxQkVW4aTky07SUpkACvSA",
    ]),
  },
  supporterfoil: RELIC2,
  relic: RELIC2,
  runicnormal: {
    single: art(
      "header-runic-normal",
      V_RUNIC,
      [
        "wyDKbvlQxYQSZbLnbeQSlA",
        "RVs7zd7-wR2x8jDnCqwUTg",
        "_TK6dhTaRkq4uUYxIECtBg",
      ],
      29,
    ),
  },
  runicmagic: {
    single: art(
      "header-runic-magic",
      V_RUNIC,
      [
        "hAVTb9XOLd43qSk9A66Cew",
        "awv_SNEo7ENRZ23bibGC_g",
        "BXhh4sBOTeuBcK20PaRzwg",
      ],
      29,
    ),
  },
  runicrare: {
    single: art(
      "header-runic-rare",
      V_RUNIC,
      [
        "yTs6E7z43PhylMGGPqYbIg",
        "DgsHCpdADp7-ta5BuTJunQ",
        "rZYc2n0Hu1NIXNoD3_nbIA",
      ],
      29,
    ),
    double: art(
      "header-double-runic-rare",
      V_RUNIC,
      [
        "JVw2kypI6Np55WG9asiK2A",
        "6a1jv2cbsz8TRjOC-myOdQ",
        "LB4kNA9FoTr8FgaHC9ozvQ",
      ],
      46,
    ),
  },
  runicunique: {
    single: art(
      "header-runic-unique",
      V_RUNIC,
      [
        "uQmEmFotr2GEu30Kqh3G9A",
        "eX6xLzvlo8dqwca2-OLwoA",
        "EJBMyiE6EBpl9rpvdJ6Cgw",
      ],
      29,
    ),
    double: art(
      "header-double-runic-unique",
      V_RUNIC,
      [
        "Pn8wBLG515yxWwrxM_vw-A",
        "SPNmClgwmKjsPHYlzdnuPw",
        "pDWuRNbFXX8ed4f4VLL49g",
      ],
      46,
    ),
  },
  runicrelic: {
    single: art(
      "header-runic-relic",
      V_RUNIC,
      [
        "pIHNgUBhiDYUir03lj9tGQ",
        "-VI8d6ZFhebEunBYAjedSw",
        "BR5wipDeCqNvPUd6Ll21FA",
      ],
      29,
    ),
    double: art(
      "header-double-runic-relic",
      V_RUNIC,
      [
        "cJKFmxuJ1cvghqUkY7HZHA",
        "_FtGBIRfk1p0QaSp2A6Lyw",
        "GgX1OtWJJC2pGDvDvV8uiA",
      ],
      46,
    ),
  },
  sentinel: {
    single: art(
      "header-sentinel",
      V_RUNIC,
      [
        "6Mg2COvT2XXv4a4shVhY7w",
        "pxPIWOtol-iSxWFBIa_g3A",
        "-9Xe2vpyeqEKyP3daPqNDQ",
      ],
      29,
    ),
  },
  gem: {
    single: art(
      "header-gem",
      V_BASE,
      [
        "tsyUWDR5c5mkpo9XuTWrWw",
        "EbvhZRjkXpQGeGnykCZ3aw",
        "cbR_jjI0yENCTeDCXbm8-w",
      ],
      29,
    ),
  },
  currency: {
    single: art(
      "header-currency",
      V_BASE,
      [
        "7qq3c91Y-hFlkX5KCFUn9A",
        "S6hXs3dduboIaBwUUnwNCw",
        "pY3IJTa71gwI0gYQbYjApA",
      ],
      29,
    ),
  },
};
const DEFAULT_POE2: HeaderSet = {
  single: art(
    "header-normal",
    V_BASE,
    [
      "bRxHEyXQX_lD_K8cBxkp_A",
      "HviWVYf7VEXctz2vGG9d6A",
      "ZGjsa2Ou6Fe2cIvZsoNeyw",
    ],
    29,
  ),
};

const HEADERS_POE1: Record<string, HeaderSet> = {
  magic: {
    single: art("header-magic", V_BASE, [
      "70xZDYjvxOk-Dy0ubVnmDQ",
      "Ns5zBHC-Iiy7UlkZJ8Mqug",
      "FFR-bQYccIWgM7HdwCnSDw",
    ]),
  },
  viscera: {
    single: art(
      "viscera/header-viscera",
      V_STRAWMAN,
      [
        "24dgTltoLtddTtyez8c9rg",
        "duYYKvRZYvixnSFEwBCmpw",
        "X_MRKJky_pMbbyRRpeAakg",
      ],
      45,
    ),
  },
  rare: {
    single: art("header-rare", V_BASE, [
      "KgDLjLOcAYP3e061vylrSg",
      "gAvlu2XH9IYKUJDQpZbVVQ",
      "tTNH6Y8qTQozyum923VNoQ",
    ]),
    double: art("header-double-rare", V_BASE, [
      "7fOI1NQk5oFidrmivWNAqw",
      "0DQ30sqHO9eanQuL1NTpNQ",
      "Hzon14Iy53cgwlmBET_yqw",
    ]),
  },
  unique: {
    single: art("header-unique", V_BASE, [
      "Io4Xtj7OPIZ2cINiEqrYBw",
      "FOkvOp5-3oW0rgZW0yk3cw",
      "jFFYVSyMDfxGNiBlvOgPmw",
    ]),
    double: art("header-double-unique", V_BASE, [
      "wWot3i-c3fi9mITi48Vl9g",
      "-dfCEOleavUZZdgllVgSsQ",
      "eZIr40k4fczlgGEz5heqLA",
    ]),
  },
  foil: {
    single: art("header-relic", V_BASE, [
      "kfzr3Cf-2NO1XJ2OrgRFfg",
      "7TwAuAFXBdi7u8cGui8wMA",
      "L7mSm5mlok_neoblj2okbg",
    ]),
    double: art("header-double-relic", V_BASE, [
      "PUK6IFm3hE8Z44O7MkywBA",
      "lJOFpLwcJrs3gMMSEN1JMA",
      "TEtSZ05l67LhIlkLpl6NkQ",
    ]),
  },
  supporterfoil: {
    single: art("header-supporter-foil", V_BASE, [
      "k32gMRMG6PWn_1p-Ix5sow",
      "C-B_2BDJBM1ZMi_rgqa2mw",
      "uz-laapu479imRcBv4ch6g",
    ]),
    double: art("header-double-supporter-foil", V_BASE, [
      "Srs3vUIokkxoAutHkZ74gg",
      "TIONk32YLtVFvS2bxYL6dg",
      "6YL2su2rtRv9g46Dny2OSg",
    ]),
  },
  gem: {
    single: art("header-gem", V_BASE, [
      "Msuu9QQfzbXDh3eQrPQwUA",
      "3hhgiyMDfG_8GThSuPE8Ew",
      "h184nSfQVwyEK6NT6Gaa0Q",
    ]),
  },
  currency: {
    single: art("header-currency", V_BASE, [
      "oeBVoVugHT2j8plEd7sTEA",
      "MxuOpkj5D8XEXXwp0i6wQQ",
      "wlP-xE52TcaH6Bcoj6ke2Q",
    ]),
  },
};
const DEFAULT_POE1: HeaderSet = {
  single: art("header-normal", V_BASE, [
    "LCTuNK-HvMIA0Nuij8tZow",
    "DwLfH4yfGrGtAnoUBj4eSQ",
    "mwhrNsoM49XtomPe-u3dmw",
  ]),
};

const SIDES = [
  ["left", "top left", "no-repeat"],
  ["right", "top right", "no-repeat"],
  ["middle", "top center", "repeat-x"],
] as const;

function headerLayers(dir: string, a: HeaderArt): string {
  const size = a.size ? `/${a.size}px auto` : "";
  return SIDES.map(
    ([side, pos, repeat], i) =>
      `url("${CDN}/${dir}/${a.file}-${side}.png?v=${a.v}&key=${a.keys[i]}") ${pos}${size} ${repeat}`,
  ).join(", ");
}

const headerCache = new Map<string, string>();

export function getStyledHeaderBg(
  frameTypeId?: string | null,
  double: boolean = false,
  isPoe2: boolean = false,
): string {
  const type = String(frameTypeId ?? "").toLowerCase();
  const cacheKey = `${isPoe2 ? 2 : 1}|${type}|${double ? 1 : 0}`;
  const hit = headerCache.get(cacheKey);
  if (hit) return hit;

  const table = isPoe2 ? HEADERS_POE2 : HEADERS_POE1;
  const set = table[type] ?? (isPoe2 ? DEFAULT_POE2 : DEFAULT_POE1);
  const result = headerLayers(
    isPoe2 ? "popup2" : "popup",
    double && set.double ? set.double : set.single,
  );
  headerCache.set(cacheKey, result);
  return result;
}

/* ================================================================== */
/* CSS variables                                                      */
/* ================================================================== */
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

export interface StyleVarOptions {
  corrupted?: boolean;
  runic?: boolean;
  foilGradient?: string | null;
  /** left tint override (usually resolveLeftTint) */
  tint?: string | null;
}

export function styleToCssVars(
  s: ItemStyle,
  styleType: number,
  opts: StyleVarOptions = {},
): string {
  const accent = styleType === 1 ? s.title_font_color : s.side_bar_color;
  const leftTint = opts.corrupted
    ? CORRUPTED_TINT
    : (opts.tint ?? s.body_tint_color);
  const rightTint = opts.runic ? RUNIC_TINT : "transparent";

  return [
    `--title-font-color: ${s.title_font_color}`,
    `--title-bar-bg: ${s.title_bar_color}`,
    `--title-line-color: ${s.title_line_color}`,
    `--side-bar-color: ${s.side_bar_color}`,
    `--left-tint: ${leftTint}`,
    `--right-tint: ${rightTint}`,
    `--foil-overlay: ${opts.foilGradient ?? "none"}`,
    `--rc: ${accent}`,
    `--rc-rgb: ${toRgbTriplet(accent)}`,
  ].join("; ");
}

/* ================================================================== */
/* One call for the row and the tooltip                               */
/* ================================================================== */
export function buildItemVisuals(
  item: Item | undefined | null,
  realm: string,
  styleType: number,
  double: boolean,
) {
  const it = (item ?? {}) as any;
  const foil = isSupporterFoil(it.frameTypeId, it.frameType);
  // frameType 9 without a frameTypeId must behave exactly like "supporterfoil"
  const frameId = foil
    ? "supporterfoil"
    : String(it.frameTypeId ?? it.frameType ?? "");
  const foilVariation = Number(it.foilVariation ?? 0);
  const isPoe2 = (it.realm || realm || "").toLowerCase() === "poe2";
  const isCorrupted = !!(it.corrupted || it.doubleCorrupted);
  const foilGradient = getFoilGradient(frameId, foilVariation);

  return {
    isPoe2,
    isCorrupted,
    foilGradient,
    foilTitleVars: getFoilTitleVars(frameId, foilVariation),
    headerBg: getStyledHeaderBg(frameId, double, isPoe2),
    styleVars: styleToCssVars(resolveItemStyle(frameId), styleType, {
      corrupted: isCorrupted,
      runic: isRunicFrame(frameId),
      foilGradient,
      tint: resolveLeftTint(it.rarity, frameId),
    }),
    foilColors: getFoilColors(frameId, foilVariation),
  };
}
