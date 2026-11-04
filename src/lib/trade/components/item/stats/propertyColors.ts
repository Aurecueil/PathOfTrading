// src/lib/trade/components/item/stats/propertyColors.ts
// Resolves the numeric "value type" (2nd tuple element of ItemProperty.values)
// into a CSS colour. FILL IN the maps below; unknown indexes fall back to DEFAULT.

export const DEFAULT_PROPERTY_COLOR = "#7f7f7f";

// PoE1 value types (placeholder values - adjust freely)
const POE1_COLORS: Record<number, string> = {
  0: "#ffffff", // --colour-value-default
  1: "#8888FF", // --colour-augmented
  2: "rgb(210, 0, 0)", // --colour-unmet
  3: "rgb(255, 255, 255)", // --colour-physical-damage
  4: "rgb(150, 0, 0)", // --colour-fire-damage
  5: "rgb(54, 100, 146)", // --colour-cold-damage
  6: "rgb(255, 215, 0)", // --colour-lightning-damage
  7: "rgb(208, 32, 144)", // --colour-chaos-damage
  10: "rgb(175, 96, 37)", // --colour-unique
  15: "#5a5a5a", // --colour-unreachable
  18: "rgb(170, 158, 130)", // --colour-currency
  19: "rgb(255, 255, 255)", // --colour-reward-quantity
  20: "rgb(14, 186, 255)", // --colour-divination
  21: "rgb(181, 168, 144)", // --colour-sanctum-boon
  22: "rgb(160, 109, 202)", // --colour-sanctum-curse
  23: "rgb(171, 139, 173)", // --colour-sanctum-pact
  24: "#7f7f7f", // --colour-grey
  30: "rgb(219, 152, 50)", // --colour-deepwater-special-area
};
const fake: Record<number, string> = {
  17: "rgb(180, 180, 255)", // --colour-crafted
  18: "rgb(255, 111, 38)", // --colour-scourged
  19: "rgb(255, 115, 57)", // --colour-crucible-mod
  20: "#a29162", // --colour-sanctified
  22: "rgb(200, 200, 200)", // --colour-rarity-normal
  23: "rgb(255, 255, 119)", // --colour-rarity-rare
  24: "rgb(136, 136, 255)", // --colour-rarity-magic
  25: "rgb(27, 162, 155)", // --colour-rarity-gem
  26: "rgb(170, 158, 130)", // --colour-rarity-currency
  27: "rgb(175, 96, 37)", // --colour-rarity-unique
  28: "rgb(74, 230, 58)", // --colour-rarity-quest
  29: "rgb(181, 75, 255)", // --colour-rarity-prophecy
  30: "rgb(130, 173, 106)", // --colour-rarity-relic
  31: "rgb(219, 207, 173)", // --colour-rarity-necropolis
  32: "rgb(163, 132, 154)", // --colour-rarity-breach-gem
  33: "rgb(186, 172, 133)", // --colour-rarity-sentinel
};
// PoE2 value types (placeholder values - adjust freely)
const POE2_COLORS: Record<number, string> = {
  // in case poe2 uses different mapping some day
};

export function resolvePropertyColor(
  index: number,
  isPoe2: boolean = false,
): string {
  // const map = isPoe2 ? POE2_COLORS : POE1_COLORS;
  return POE1_COLORS[index] ?? DEFAULT_PROPERTY_COLOR;
}
