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

export const STAT_KEYWORD_COLORS: Array<{ keywords: string[]; color: string }> =
  [
    // Multi-word phrases first so they match before single words
    { keywords: ["energy shield"], color: "#7EEBEB" },
    { keywords: ["evasion rating"], color: "#30EB6E" },
    { keywords: ["fire"], color: "#AB6921" },
    { keywords: ["cold"], color: "#3B65A5" },
    { keywords: ["lightning", "lighting"], color: "#A09D42" },
    { keywords: ["chaos"], color: "#C01E85" },
    { keywords: ["strength"], color: "#CF4A2D" },
    { keywords: ["dexterity"], color: "#65E465" },
    { keywords: ["intelligence", "inteligence"], color: "#6868EB" },
    { keywords: ["life"], color: "#CF4A2D" },
    { keywords: ["mana"], color: "#6868EB" },
    { keywords: ["spirit"], color: "#EBEB6E" },
  ];
