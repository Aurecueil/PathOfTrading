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

// Global toggle for stat color coding (true = enabled, false = disabled)
export const statColorCodingEnabled = writable<boolean>(true);
export interface StatColorRule {
  partial?: string[];
  literal?: string[];
  color: string;
}

export const STAT_KEYWORD_COLORS: StatColorRule[] = [
  // Multi-word phrases first so they match before single words
  {
    partial: ["increased energy shield", "to energy shield"],
    literal: ["energy shield", "es"],
    color: "#7EEBEB",
  },
  {
    partial: ["increased evasion rating", "to evasion rating"],
    literal: ["evasion rating", "ev"],
    color: "#30EB6E",
  },
  {
    partial: ["increased armour", "to armour"],
    literal: ["armour", "ar"],
    color: "#e75e3f",
  },
  {
    partial: [
      "fire resistance",
      "fire damage",
      "fire gems",
      "level of all fire",
    ],
    literal: [],
    color: "#AB6921",
  },
  {
    partial: [
      "cold resistance",
      "cold damage",
      "cold gems",
      "level of all cold",
    ],
    literal: [],
    color: "#3B65A5",
  },
  {
    partial: [
      "lightning resistance",
      "lightning damage",
      "lightning gems",
      "level of all lightning",
    ],
    literal: [],
    color: "#A09D42",
  },
  {
    partial: [
      "chaos resistance",
      "chaos damage",
      "chaos gems",
      "level of all chaos",
    ],
    literal: [],
    color: "#C01E85",
  },
  {
    partial: [
      "physical resistance",
      "physical damage",
      "physical gems",
      "level of all physical",
    ],
    literal: [],
    color: "#B9B9B9",
  },
  { partial: ["strength"], literal: [], color: "#CF4A2D" },
  { partial: ["dexterity"], literal: [], color: "#65E465" },
  { partial: ["intelligence", "inteligence"], literal: [], color: "#6868EB" },
  {
    partial: ["to life", "increased life", "maximum life"],
    literal: [],
    color: "#CF4A2D",
  },
  {
    partial: ["to mana", "increased mana", "maximum mana"],
    literal: [],
    color: "#6868EB",
  },
  { partial: ["to spirit", "increased spirit"], literal: [], color: "#EBEB6E" },
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
