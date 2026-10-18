import { writable } from "svelte/store";
import { invoke } from "@tauri-apps/api/core"; // For Tauri v2 (`@tauri-apps/api/tauri` in v1)
import type { ItemCategory, ItemDataResponse } from "$lib/types/baseItem";
import type { FilterGroup, FilterDataResponse } from "$lib/types/filters";
import type { StatGroup, StatsDataResponse } from "$lib/types/stats";
import type { League, LeagueData } from "$lib/types/leagues";
import type { StaticCategory, StaticDataResponse } from "$lib/types/statics";

export const itemsPoe = writable<ItemCategory[]>([]);
export const itemsPoe2 = writable<ItemCategory[]>([]);
export const filtersPoe = writable<FilterGroup[]>([]);
export const filtersPoe2 = writable<FilterGroup[]>([]);
export const statsPoe = writable<StatGroup[]>([]);
export const statsPoe2 = writable<StatGroup[]>([]);
export const leaguesPoe = writable<League[]>([]);
export const leaguesPoe2 = writable<League[]>([]);
export const staticsPoe = writable<StaticCategory[]>([]);
export const staticsPoe2 = writable<StaticCategory[]>([]);
export const isLoading = writable<boolean>(false);
export const loadError = writable<string | null>(null);

export async function initItemData(): Promise<void> {
  isLoading.set(true);
  loadError.set(null);

  try {
    const [
      poeItems,
      poe2Items,
      poeFilters,
      poe2Filters,
      poeStats,
      poe2Stats,
      PoeLeague,
      poe2Leagues,
      poeStatics,
      poe2Statics,
    ] = await Promise.allSettled([
      invoke<ItemDataResponse>("load_item_data", { realm: "poe" }),
      invoke<ItemDataResponse>("load_item_data", { realm: "poe2" }),
      invoke<FilterDataResponse>("load_filters_data", { realm: "poe" }),
      invoke<FilterDataResponse>("load_filters_data", { realm: "poe2" }),
      invoke<StatsDataResponse>("load_stats_data", { realm: "poe" }),
      invoke<StatsDataResponse>("load_stats_data", { realm: "poe2" }),
      invoke<LeagueData>("load_league_data", { realm: "poe" }),
      invoke<LeagueData>("load_league_data", { realm: "poe2" }),
      invoke<StaticDataResponse>("load_static_data", { realm: "poe" }),
      invoke<StaticDataResponse>("load_static_data", { realm: "poe2" }),
    ]);

    const errors: string[] = [];

    if (poeItems.status === "fulfilled") itemsPoe.set(poeItems.value.result);
    else errors.push(`PoE items: ${poeItems.reason}`);

    if (poe2Items.status === "fulfilled") itemsPoe2.set(poe2Items.value.result);
    else errors.push(`PoE2 items: ${poe2Items.reason}`);

    if (poeFilters.status === "fulfilled")
      filtersPoe.set(poeFilters.value.result);
    else errors.push(`PoE filters: ${poeFilters.reason}`);

    if (poe2Filters.status === "fulfilled")
      filtersPoe2.set(poe2Filters.value.result);
    else errors.push(`PoE2 filters: ${poe2Filters.reason}`);

    if (poeStats.status === "fulfilled") statsPoe.set(poeStats.value.result);
    else errors.push(`PoE Stats: ${poeStats.reason}`);

    if (poe2Stats.status === "fulfilled") statsPoe2.set(poe2Stats.value.result);
    else errors.push(`PoE2 Stats: ${poe2Stats.reason}`);

    if (PoeLeague.status === "fulfilled")
      leaguesPoe.set(PoeLeague.value.result);
    else errors.push(`PoE Stats: ${PoeLeague.reason}`);

    if (poe2Leagues.status === "fulfilled")
      leaguesPoe2.set(poe2Leagues.value.result);
    else errors.push(`PoE2 Stats: ${poe2Leagues.reason}`);

    if (poeStatics.status === "fulfilled")
      staticsPoe.set(poeStatics.value.result);
    else errors.push(`PoE Statics: ${poeStatics.reason}`);

    if (poe2Statics.status === "fulfilled")
      staticsPoe2.set(poe2Statics.value.result);
    else errors.push(`PoE2 Statics: ${poe2Statics.reason}`);

    if (errors.length > 0) {
      loadError.set(errors.join(" | "));
    }
  } catch (err) {
    loadError.set(typeof err === "string" ? err : "Failed to load static data");
  } finally {
    isLoading.set(false);
  }
}

export const statColorCodingEnabled = writable<boolean>(true);

export interface StatColorRule {
  keywords: string[];
  color: string;
}

export const STAT_KEYWORD_COLORS: StatColorRule[] = [
  // defences
  { keywords: ["energy shield", "es"], color: "#7EEBEB" },
  { keywords: ["evasion", "evasion rating", "ev"], color: "#30EB6E" },
  { keywords: ["armour", "ar"], color: "#e75e3f" },
  {
    keywords: ["attack damage", "attacks", "attack modifiers", "attack"],
    color: "#DA814D",
  },
  {
    keywords: [
      "global defences",
      "base defence percentile",
      "defences modifiers",
      "defence modifiers",
      "defences",
    ],
    color: "#A88F67",
  },

  //elements
  {
    keywords: [
      "fire resistance",
      "fire damage",
      "fire spell skills",
      "fire skills",
      "fire gems",
      "fire modifiers",
      "extra fire",
      "fire",
    ],
    color: "#AB6921",
  },
  {
    keywords: [
      "cold resistance",
      "cold damage",
      "cold spell skills",
      "cold skills",
      "cold gems",
      "cold modifiers",
      "extra cold",
      "cold",
    ],
    color: "#3B65A5",
  },
  {
    keywords: [
      "lightning resistance",
      "lightning damage",
      "lightning spell skills",
      "lightning skills",
      "lightning gems",
      "lightning modifiers",
      "extra lightning",
      "lightning",
    ],
    color: "#A09D42",
  },
  {
    keywords: [
      "chaos resistance",
      "chaos damage",
      "chaos spell skills",
      "chaos skills",
      "chaos gems",
      "chaos modifiers",
      "extra chaos",
      "chaos",
    ],
    color: "#C01E85",
  },
  {
    keywords: [
      "physical resistance",
      "physical damage",
      "physical spell skills",
      "physical skills",
      "physical gems",
      "physical modifiers",
      "extra physical",
      "physical",
      "pdps",
    ],
    color: "#C79D93",
  },

  //atributes
  { keywords: ["strength", "str"], color: "#CF4A2D" },
  { keywords: ["dexterity", "dex"], color: "#65E465" },
  { keywords: ["intelligence", "int"], color: "#6868EB" },

  //basic
  { keywords: ["life"], color: "#CF4A2D" },
  { keywords: ["mana"], color: "#6868EB" },
  { keywords: ["spirit"], color: "#EBEB6E" },
  { keywords: ["dps"], color: "#E22626" },
  {
    keywords: [
      "global critical strike change",
      "critical strike change",
      "global critical strike multiplier",
      "critical strike multiplier",
      "critical hit chance",
      "critical spell damage bonus",
      "critical damage bonus",
      "critical hits",
      "critical hit",
      "critical modifiers",
      "critical",
    ],
    color: "#B2A7D6",
  },
  {
    keywords: [
      "cast speed",
      "action speed",
      "attack speed",
      "speed modifiers",
      "movement speed",
      "attacks per second",
    ],
    color: "#CFEEA5",
  },

  {
    keywords: [
      "crafted modifiers",
      "crafted prefix modifiers",
      "crafted suffix modifiers",
    ],
    color: "#FFFFFF",
  },
  //league
  {
    keywords: [
      "kurgal",
      "amanamu",
      "ulaman",
      "kulemak",
      "tecrod",
      "abyss",
      "abysses",
      "abyssal pits",
      "abyssal depths",
      "abyssal",
      "unrevealed modifiers",
      "unrevealed prefix modifiers",
      "unrevealed suffix modifiers",
      "unrevealed",
      "desecrated modifiers",
      "desecrated prefix modifiers",
      "desecrated suffix modifiers",
      "desecrated",
    ],
    color: "#72A90A",
  },
  {
    keywords: ["ritual"],
    color: "#810914",
  },
];

// In $lib/trade/tradeStore.ts
export const currentLanguage = writable<string>("EN");

export async function initUserSettings(): Promise<void> {
  try {
    const [settings, lang] = await Promise.allSettled([
      invoke<{ colorCoding: boolean }>("get_user_settings"),
      invoke<string>("get_language"),
    ]);

    if (
      settings.status === "fulfilled" &&
      typeof settings.value?.colorCoding === "boolean"
    ) {
      statColorCodingEnabled.set(settings.value.colorCoding);
    }
    if (lang.status === "fulfilled" && lang.value) {
      currentLanguage.set(lang.value);
    }
  } catch (err) {
    console.error("Failed to load user settings:", err);
  }
}

export const displayTiers = writable<boolean>(false);
export const displayRune = writable<boolean>(true);
