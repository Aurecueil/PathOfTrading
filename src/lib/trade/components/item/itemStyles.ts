// src/lib/trade/components/item/itemStyles.ts
export const CORRUPTED_TINT = "#bc313133";
export const RUNIC_TINT = "#4eacf02d";

export interface ItemStyle {
  title_font_color: string;
  title_bar_color: string;
  title_line_color: string;
  side_bar_color: string;
  body_tint_color: string;
}

export const FOIL_GRADIENTS: Record<number, string> = {
  1: "linear-gradient(180deg, #9739fda3, #f7b8ff)", // amethyst
  2: "linear-gradient(180deg, #6cff47a3, #045a52)", // verdant
  3: "linear-gradient(180deg, #ff477ad4, #fdb6b6)", // ruby
  4: "linear-gradient(180deg, #47ffeea3, #2779f5d9)", // cobalt
  5: "linear-gradient(180deg, #ffbe47a3, #6d27f5a1)", // sunset
  6: "linear-gradient(180deg, #ffea55c7, #f5a327d1)", // aureate
  7: "linear-gradient(180deg, #ff22aaa3, #fad4ff)", // g1
  8: "linear-gradient(180deg, #a8050594, #5e5e5e36)", // g2
  9: "linear-gradient(180deg, #346e00ab, #c17aff)", // g3
  10: "linear-gradient(180deg, #fffb3aa3, #6a2f1df2)", // g4
  11: "linear-gradient(180deg, #b8e9a9d6, #e53f55a1)", // g5
  12: "linear-gradient(180deg, #53d6ffc7, #582a7ad1)", // g6
};

export function getFoilGradient(
  frameTypeId?: string | null,
  foilVariation: number | null = 0,
): string | null {
  if (String(frameTypeId ?? "").toLowerCase() !== "supporterfoil") return null;
  const raw = Number(foilVariation ?? 0);
  return FOIL_GRADIENTS[Number.isFinite(raw) ? raw : 0] ?? null;
}

export function isRunicFrame(frameTypeId?: string | null): boolean {
  return String(frameTypeId ?? "")
    .toLowerCase()
    .startsWith("runic");
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
    body_tint_color: "#af61252c",
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
    title_line_color: "#94929C",
    side_bar_color: "#94929C",
    body_tint_color: "#242423",
  },
  runicmagic: {
    title_font_color: "#8888FF",
    title_bar_color: "#8888ff3d",
    title_line_color: "#8888ff61",
    side_bar_color: "#8888ff",
    body_tint_color: "#8888ff12",
  },
  runicrare: {
    title_font_color: "#ffff77",
    title_bar_color: "#ffff773d",
    title_line_color: "#ffff7761",
    side_bar_color: "#ffff77",
    body_tint_color: "#ffff7712",
  },
  runicunique: {
    title_font_color: "#AE6025",
    title_bar_color: "#af60253d",
    title_line_color: "#af602561",
    side_bar_color: "#af6025",
    body_tint_color: "#af602512",
  },
};
/** Left tint comes from the item's `rarity` field (Normal/Magic/Rare/Unique) */
export function resolveRarityTint(rarity?: string | null): string | null {
  const r = String(rarity ?? "").toLowerCase();
  return r === "normal" || r === "magic" || r === "rare" || r === "unique"
    ? ITEM_STYLES[r].body_tint_color
    : null;
}
const FOIL_BASE: ItemStyle = {
  title_font_color: ITEM_STYLES.foil.title_font_color,
  title_bar_color: ITEM_STYLES.foil.title_bar_color,
  title_line_color: ITEM_STYLES.foil.title_line_color,
  side_bar_color: ITEM_STYLES.unique.side_bar_color,
  body_tint_color: ITEM_STYLES.unique.body_tint_color,
};

export const DEFAULT_STYLE: ItemStyle = ITEM_STYLES.normal;

export function resolveItemStyle(frameTypeId?: string | null): ItemStyle {
  const frameId = String(frameTypeId ?? "").toLowerCase();
  if (!frameId) return DEFAULT_STYLE;
  if (frameId === "supporterfoil") return FOIL_BASE;
  return ITEM_STYLES[frameId] ?? DEFAULT_STYLE;
}

export function getStyledHeaderBg(
  frameTypeId?: string | null,
  double: boolean = false,
  isPoe2: boolean = false,
): string {
  const type = String(frameTypeId ?? "").toLowerCase();

  if (isPoe2) {
    if (type === "magic") {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-magic-left.png?v=1709582916256&key=o3_dFKQzRKG62y6uHCs7jQ") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-magic-right.png?v=1709582916256&key=Z4fOOCC3bnyTIZvSCJZSqw") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-magic-middle.png?v=1709582916256&key=23gaDOOaTXEb7bKEt0GMfA") top center/29px auto repeat-x`,
      ].join(", ");
    }
    if (type === "rare") {
      if (double) {
        return [
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-rare-left.png?v=1709582916256&key=GlFK9dDlo33Cw3Ak7P5MnA") top left/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-rare-right.png?v=1709582916256&key=rXqdxbUkuIkWyVJPJVY9cQ") top right/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-rare-middle.png?v=1709582916256&key=yJGcA667EzDzrPzd1_9-vg") top center/46px auto repeat-x`,
        ].join(", ");
      }
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-rare-left.png?v=1709582916256&key=I3T2vXAWpNnedfwkMVK3ZA") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-rare-right.png?v=1709582916256&key=ZGQJNEchUOjMqm8UcnXedQ") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-rare-middle.png?v=1709582916256&key=CEBfM9Dbz-I9nhXZKUalGA") top center/29px auto repeat-x`,
      ].join(", ");
    }
    if (type === "unique") {
      if (double) {
        return [
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-unique-left.png?v=1709582916256&key=qrl8M2m852PSVfYgs7nT9g") top left no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-unique-right.png?v=1709582916256&key=o1T64-ZQYCasntgXT_L8SA") top right no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-unique-middle.png?v=1709582916256&key=wxQkVW4aTky07SUpkACvSA") top center repeat-x`,
        ].join(", ");
      }
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-unique-left.png?v=1709582916256&key=LfcfpM0Zj_hf2IAdg7W3ww") top left no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-unique-right.png?v=1709582916256&key=Ur5K4jb1yTYY_CKF5m-9PQ") top right no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-unique-middle.png?v=1709582916256&key=sPiOBadbuA6zqLIJTgQ6HQ") top center repeat-x`,
      ].join(", ");
    }
    if (type === "supporterfoil" || type === "relic") {
      if (double) {
        return [
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-relic-left.png?v=1742523473552&key=FYMGa7CrowT_fAWqcf3M-g") top left/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-relic-right.png?v=1742523473552&key=Yrlkt73O6Ty19plaLH6t6g") top right/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-relic-middle.png?v=1742523473552&key=xKW2HY2WawlIK5ruLOHKcw") top center/46px auto repeat-x`,
        ].join(", ");
      }
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-relic-left.png?v=1742523473552&key=eLRRNZAOKrK5jF8Y2SF3Lw") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-relic-right.png?v=1742523473552&key=Zloh7-1KlqDxDjQdK-nibQ") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-relic-middle.png?v=1742523473552&key=QH7gwzBDamSgJYEhCYYa7g") top center/29px auto repeat-x`,
      ].join(", ");
    }
    if (type === "runicnormal") {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-normal-left.png?v=1777507982778&key=wyDKbvlQxYQSZbLnbeQSlA") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-normal-right.png?v=1777507982778&key=RVs7zd7-wR2x8jDnCqwUTg") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-normal-middle.png?v=1777507982778&key=_TK6dhTaRkq4uUYxIECtBg") top center/29px auto repeat-x`,
      ].join(", ");
    }
    if (type === "runicmagic") {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-magic-left.png?v=1777507982778&key=hAVTb9XOLd43qSk9A66Cew") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-magic-right.png?v=1777507982778&key=awv_SNEo7ENRZ23bibGC_g") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-magic-middle.png?v=1777507982778&key=BXhh4sBOTeuBcK20PaRzwg") top center/29px auto repeat-x`,
      ].join(", ");
    }
    if (type === "runicrare") {
      if (double) {
        return [
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-rare-left.png?v=1777507982778&key=JVw2kypI6Np55WG9asiK2A") top left/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-rare-right.png?v=1777507982778&key=6a1jv2cbsz8TRjOC-myOdQ") top right/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-rare-middle.png?v=1777507982778&key=LB4kNA9FoTr8FgaHC9ozvQ") top center/46px auto repeat-x`,
        ].join(", ");
      }
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-rare-left.png?v=1777507982778&key=yTs6E7z43PhylMGGPqYbIg") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-rare-right.png?v=1777507982778&key=DgsHCpdADp7-ta5BuTJunQ") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-rare-middle.png?v=1777507982778&key=rZYc2n0Hu1NIXNoD3_nbIA") top center/29px auto repeat-x`,
      ].join(", ");
    }
    if (type === "runicunique") {
      if (double) {
        return [
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-unique-left.png?v=1777507982778&key=Pn8wBLG515yxWwrxM_vw-A") top left/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-unique-right.png?v=1777507982778&key=SPNmClgwmKjsPHYlzdnuPw") top right/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-unique-middle.png?v=1777507982778&key=pDWuRNbFXX8ed4f4VLL49g") top center/46px auto repeat-x`,
        ].join(", ");
      }
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-unique-left.png?v=1777507982778&key=uQmEmFotr2GEu30Kqh3G9A") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-unique-right.png?v=1777507982778&key=eX6xLzvlo8dqwca2-OLwoA") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-unique-middle.png?v=1777507982778&key=EJBMyiE6EBpl9rpvdJ6Cgw") top center/29px auto repeat-x`,
      ].join(", ");
    }
    if (type === "runicrelic") {
      if (double) {
        return [
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-relic-left.png?v=1777507982778&key=cJKFmxuJ1cvghqUkY7HZHA") top left/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-relic-right.png?v=1777507982778&key=_FtGBIRfk1p0QaSp2A6Lyw") top right/46px auto no-repeat`,
          `url("https://web.poecdn.com/protected/image/item/popup2/header-double-runic-relic-middle.png?v=1777507982778&key=GgX1OtWJJC2pGDvDvV8uiA") top center/46px auto repeat-x`,
        ].join(", ");
      }
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-relic-left.png?v=1777507982778&key=pIHNgUBhiDYUir03lj9tGQ") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-relic-right.png?v=1777507982778&key=-VI8d6ZFhebEunBYAjedSw") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-runic-relic-middle.png?v=1777507982778&key=BR5wipDeCqNvPUd6Ll21FA") top center/29px auto repeat-x`,
      ].join(", ");
    }

    if (type === "sentinel") {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-sentinel-left.png?v=1777507982778&key=6Mg2COvT2XXv4a4shVhY7w") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-sentinel-right.png?v=1777507982778&key=pxPIWOtol-iSxWFBIa_g3A") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-sentinel-middle.png?v=1777507982778&key=-9Xe2vpyeqEKyP3daPqNDQ") top center/29px auto repeat-x`,
      ].join(", ");
    }

    if (type === "gem") {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-gem-left.png?v=1709582916256&key=tsyUWDR5c5mkpo9XuTWrWw") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-gem-right.png?v=1709582916256&key=EbvhZRjkXpQGeGnykCZ3aw") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-gem-middle.png?v=1709582916256&key=cbR_jjI0yENCTeDCXbm8-w") top center/29px auto repeat-x`,
      ].join(", ");
    }

    if (type === "currency") {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup2/header-currency-left.png?v=1709582916256&key=7qq3c91Y-hFlkX5KCFUn9A") top left/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-currency-right.png?v=1709582916256&key=S6hXs3dduboIaBwUUnwNCw") top right/29px auto no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup2/header-currency-middle.png?v=1709582916256&key=pY3IJTa71gwI0gYQbYjApA") top center/29px auto repeat-x`,
      ].join(", ");
    }

    // Default PoE 2 Normal
    return [
      `url("https://web.poecdn.com/protected/image/item/popup2/header-normal-left.png?v=1709582916256&key=bRxHEyXQX_lD_K8cBxkp_A") top left/29px auto no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup2/header-normal-right.png?v=1709582916256&key=HviWVYf7VEXctz2vGG9d6A") top right/29px auto no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup2/header-normal-middle.png?v=1709582916256&key=ZGjsa2Ou6Fe2cIvZsoNeyw") top center/29px auto repeat-x`,
    ].join(", ");
  }

  if (type === "magic") {
    return [
      `url("https://web.poecdn.com/protected/image/item/popup/header-magic-left.png?v=1709582916256&key=70xZDYjvxOk-Dy0ubVnmDQ") top left no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-magic-right.png?v=1709582916256&key=Ns5zBHC-Iiy7UlkZJ8Mqug") top right no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-magic-middle.png?v=1709582916256&key=FFR-bQYccIWgM7HdwCnSDw") top center repeat-x`,
    ].join(", ");
  }
  if (type === "rare") {
    if (double) {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-rare-left.png?v=1709582916256&key=7fOI1NQk5oFidrmivWNAqw") top left no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-rare-right.png?v=1709582916256&key=0DQ30sqHO9eanQuL1NTpNQ") top right no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-rare-middle.png?v=1709582916256&key=Hzon14Iy53cgwlmBET_yqw") top center repeat-x`,
      ].join(", ");
    }
    return [
      `url("https://web.poecdn.com/protected/image/item/popup/header-rare-left.png?v=1709582916256&key=KgDLjLOcAYP3e061vylrSg") top left no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-rare-right.png?v=1709582916256&key=gAvlu2XH9IYKUJDQpZbVVQ") top right no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-rare-middle.png?v=1709582916256&key=tTNH6Y8qTQozyum923VNoQ") top center repeat-x`,
    ].join(", ");
  }
  if (type === "unique") {
    if (double) {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-unique-left.png?v=1709582916256&key=wWot3i-c3fi9mITi48Vl9g") top left no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-unique-right.png?v=1709582916256&key=-dfCEOleavUZZdgllVgSsQ") top right no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-unique-middle.png?v=1709582916256&key=eZIr40k4fczlgGEz5heqLA") top center repeat-x`,
      ].join(", ");
    }
    return [
      `url("https://web.poecdn.com/protected/image/item/popup/header-unique-left.png?v=1709582916256&key=Io4Xtj7OPIZ2cINiEqrYBw") top left no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-unique-right.png?v=1709582916256&key=FOkvOp5-3oW0rgZW0yk3cw") top right no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-unique-middle.png?v=1709582916256&key=jFFYVSyMDfxGNiBlvOgPmw") top center repeat-x`,
    ].join(", ");
  }
  if (type === "foil") {
    if (double) {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-relic-left.png?v=1709582916256&key=PUK6IFm3hE8Z44O7MkywBA") top left no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-relic-right.png?v=1709582916256&key=lJOFpLwcJrs3gMMSEN1JMA") top right no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-relic-middle.png?v=1709582916256&key=TEtSZ05l67LhIlkLpl6NkQ") top center repeat-x`,
      ].join(", ");
    }
    return [
      `url("https://web.poecdn.com/protected/image/item/popup/header-relic-left.png?v=1709582916256&key=kfzr3Cf-2NO1XJ2OrgRFfg") top left no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-relic-right.png?v=1709582916256&key=7TwAuAFXBdi7u8cGui8wMA") top right no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-relic-middle.png?v=1709582916256&key=L7mSm5mlok_neoblj2okbg") top center repeat-x`,
    ].join(", ");
  }
  if (type === "supporterfoil") {
    if (double) {
      return [
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-supporter-foil-left.png?v=1709582916256&key=Srs3vUIokkxoAutHkZ74gg") top left no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-supporter-foil-right.png?v=1709582916256&key=TIONk32YLtVFvS2bxYL6dg") top right no-repeat`,
        `url("https://web.poecdn.com/protected/image/item/popup/header-double-supporter-foil-middle.png?v=1709582916256&key=6YL2su2rtRv9g46Dny2OSg") top center repeat-x`,
      ].join(", ");
    }
    return [
      `url("https://web.poecdn.com/protected/image/item/popup/header-supporter-foil-left.png?v=1709582916256&key=k32gMRMG6PWn_1p-Ix5sow") top left no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-supporter-foil-right.png?v=1709582916256&key=C-B_2BDJBM1ZMi_rgqa2mw") top right no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-supporter-foil-middle.png?v=1709582916256&key=uz-laapu479imRcBv4ch6g") top center repeat-x`,
    ].join(", ");
  }

  if (type === "gem") {
    return [
      `url("https://web.poecdn.com/protected/image/item/popup/header-gem-left.png?v=1709582916256&key=Msuu9QQfzbXDh3eQrPQwUA") top left no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-gem-right.png?v=1709582916256&key=3hhgiyMDfG_8GThSuPE8Ew") top right no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-gem-middle.png?v=1709582916256&key=h184nSfQVwyEK6NT6Gaa0Q") top center repeat-x`,
    ].join(", ");
  }

  if (type === "currency") {
    return [
      `url("https://web.poecdn.com/protected/image/item/popup/header-currency-left.png?v=1709582916256&key=oeBVoVugHT2j8plEd7sTEA") top left no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-currency-right.png?v=1709582916256&key=MxuOpkj5D8XEXXwp0i6wQQ") top right no-repeat`,
      `url("https://web.poecdn.com/protected/image/item/popup/header-currency-middle.png?v=1709582916256&key=wlP-xE52TcaH6Bcoj6ke2Q") top center repeat-x`,
    ].join(", ");
  }

  // Default PoE 1 Normal
  return [
    `url("https://web.poecdn.com/protected/image/item/popup/header-normal-left.png?v=1709582916256&key=LCTuNK-HvMIA0Nuij8tZow") top left no-repeat`,
    `url("https://web.poecdn.com/protected/image/item/popup/header-normal-right.png?v=1709582916256&key=DwLfH4yfGrGtAnoUBj4eSQ") top right no-repeat`,
    `url("https://web.poecdn.com/protected/image/item/popup/header-normal-middle.png?v=1709582916256&key=mwhrNsoM49XtomPe-u3dmw") top center repeat-x`,
  ].join(", ");
}
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
  styledHeaderBg?: string | null;
  tint?: string | null; // rarity tint
}

export function styleToCssVars(
  s: ItemStyle,
  styleType: number,
  opts: StyleVarOptions = {},
): string {
  const isStyled = styleType === 1;
  const accent = isStyled ? s.title_font_color : s.side_bar_color;
  const leftTint = opts.corrupted
    ? CORRUPTED_TINT
    : (opts.tint ?? s.body_tint_color);
  //const leftTint = s.body_tint_color; //opts.corrupted ? CORRUPTED_TINT : s.body_tint_color;
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
