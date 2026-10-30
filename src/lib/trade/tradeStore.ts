// src/lib/trade/tradeStore.ts
import { writable, get, derived } from "svelte/store";
import { invoke, transformCallback } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { ItemCategory, ItemDataResponse } from "$lib/types/baseItem";
import type { FilterGroup, FilterDataResponse } from "$lib/types/filters";
import type { StatGroup, StatsDataResponse } from "$lib/types/stats";
import type { League, LeagueData } from "$lib/types/leagues";
import type { StaticCategory, StaticDataResponse } from "$lib/types/statics";
import type {
  dataMercenarySkill,
  dataMercenarySupport,
  MercenarySkillsMap,
  MercenarySupportsMap,
} from "$lib/types/mercenary";
import {
  statColorCodingEnabled,
  ensureCrossWindowSync,
  loadStatColorConfigsFromDisk,
} from "./statColors";
import {
  registerPricingStores,
  preferDirectExchange,
  tadedExchangeRatios,
} from "./pricing";
export * from "./pricing";
export * from "./statColors";

// ---------------------------------------------------------------------------
// PoE2 Keyword Types & Stores
// ---------------------------------------------------------------------------
export interface KeywordEntry {
  term: string;
  definition: string;
}

export type KeywordsMap = Record<string, KeywordEntry>;

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

registerPricingStores(leaguesPoe, leaguesPoe2);

// PoE 1 Exclusive Mercenary Stores
export const mercenarySkills = writable<MercenarySkillsMap>({});
export const mercenarySupports = writable<MercenarySupportsMap>({});

// PoE 2 Keywords Store
export const keywords = writable<KeywordsMap>({});

export const isLoading = writable<boolean>(false);
export const loadError = writable<string | null>(null);
export const currentLanguage = writable<string>("EN");

export const authState = writable<boolean>(false);
export const isDev = writable<boolean>(true);
export const showTooltips = writable<boolean>(true);
export { preferDirectExchange, tadedExchangeRatios };
export const compactMercenaryDisplay = writable<boolean>(false);
export const tpHotkey = writable<string>("CommandOrControl+Shift+T");

export async function updateTpHotkey(newHotkey: string): Promise<void> {
  try {
    // The backend argument name is `accelerator`
    await invoke("tp_set_hotkey", { accelerator: newHotkey });

    // Update store only when backend command succeeds
    tpHotkey.set(newHotkey);
  } catch (error) {
    console.error("Failed to register TP hotkey:", error);
    throw error;
  }
}
// Shared Cache Storage bucket with CDN images so "Clear Cache" wipes both
const CACHE_NAME = "app-cdn-images-v1";

const REPOE_LANG_MAP: Record<string, string> = {
  EN: "",
  FR: "French",
  DE: "German",
  JP: "Japanese",
  BR: "Portuguese",
  RU: "Russian",
  ES: "Spanish",
  TH: "Thai",
};

function getRepoeUrl(
  fileName: "mercenary_skills.min.json" | "mercenary_supports.min.json",
  langCode: string,
): string {
  const folder = REPOE_LANG_MAP[langCode.toUpperCase()] ?? "";
  return folder
    ? `https://repoe-fork.github.io/${folder}/${fileName}`
    : `https://repoe-fork.github.io/${fileName}`;
}

function getPoe2KeywordsUrl(): string {
  return `https://repoe-fork.github.io/poe2/keywords.min.json`;
}

/**
 * Fetches JSON from Cache Storage if available; otherwise fetches from network
 * and stores it in `app-cdn-images-v1` for future launches.
 */
async function fetchCachedJson<T>(url: string): Promise<T> {
  let cache: Cache | null = null;

  if (typeof window !== "undefined" && "caches" in window) {
    try {
      cache = await caches.open(CACHE_NAME);
      const cachedRes = await cache.match(url);
      if (cachedRes) {
        return (await cachedRes.json()) as T;
      }
    } catch (err) {
      console.warn("Cache Storage lookup failed:", err);
      cache = null;
    }
  }

  // Fallback to network request (GitHub Pages supports CORS natively)
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when fetching ${url}`);
  }

  if (cache) {
    try {
      await cache.put(url, response.clone());
    } catch (err) {
      console.warn("Failed to cache JSON response:", err);
    }
  }

  return (await response.json()) as T;
}

export async function initItemData(): Promise<void> {
  isLoading.set(true);
  loadError.set(null);

  try {
    // Resolve active language so RePoE URLs match the selected language
    let lang = get(currentLanguage);
    try {
      const backendLang = await invoke<string>("get_language");
      if (backendLang) {
        lang = backendLang;
        currentLanguage.set(backendLang);
      }
    } catch {
      // Fallback to currentLanguage store value
    }

    const skillsUrl = getRepoeUrl("mercenary_skills.min.json", lang);
    const supportsUrl = getRepoeUrl("mercenary_supports.min.json", lang);
    const keywordsUrl = getPoe2KeywordsUrl();

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
      mercSkills,
      mercSupports,
      keywordsData,
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
      fetchCachedJson<MercenarySkillsMap>(skillsUrl),
      fetchCachedJson<MercenarySupportsMap>(supportsUrl),
      fetchCachedJson<KeywordsMap>(keywordsUrl),
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
    else errors.push(`PoE Leagues: ${PoeLeague.reason}`);

    if (poe2Leagues.status === "fulfilled")
      leaguesPoe2.set(poe2Leagues.value.result);
    else errors.push(`PoE2 Leagues: ${poe2Leagues.reason}`);

    if (poeStatics.status === "fulfilled")
      staticsPoe.set(poeStatics.value.result);
    else errors.push(`PoE Statics: ${poeStatics.reason}`);

    if (poe2Statics.status === "fulfilled")
      staticsPoe2.set(poe2Statics.value.result);
    else errors.push(`PoE2 Statics: ${poe2Statics.reason}`);

    if (mercSkills.status === "fulfilled")
      mercenarySkills.set(mercSkills.value);
    else errors.push(`PoE Mercenary Skills: ${mercSkills.reason}`);

    if (mercSupports.status === "fulfilled")
      mercenarySupports.set(mercSupports.value);
    else errors.push(`PoE Mercenary Supports: ${mercSupports.reason}`);

    if (keywordsData.status === "fulfilled") keywords.set(keywordsData.value);
    else errors.push(`PoE2 Keywords: ${keywordsData.reason}`);

    if (errors.length > 0) {
      loadError.set(errors.join(" | "));
    }
  } catch (err) {
    loadError.set(typeof err === "string" ? err : "Failed to load static data");
  } finally {
    isLoading.set(false);
  }
}

export const mercenarySkillsByHash = derived(mercenarySkills, ($skills) => {
  const map = new Map<number, dataMercenarySkill>();
  for (const skill of Object.values($skills)) {
    if (typeof skill.hash === "number") {
      map.set(skill.hash, skill);
    }
  }
  return map;
});

export const mercenarySupportsByHash = derived(
  mercenarySupports,
  ($supports) => {
    const map = new Map<number, dataMercenarySupport>();
    for (const sup of Object.values($supports)) {
      if (typeof sup.hash === "number") {
        map.set(sup.hash, sup);
      }
    }
    return map;
  },
);

export async function initUserSettings(): Promise<void> {
  await ensureCrossWindowSync();

  const [settings, lang] = await Promise.allSettled([
    invoke<{ colorCoding: boolean }>("get_user_settings"),
    invoke<string>("get_language"),
    loadStatColorConfigsFromDisk(false),
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
}

// ---------------------------------------------------------------------------
// UI-only settings, persisted to disk via webview storage (not stored in Rust)
// ---------------------------------------------------------------------------
const UI_SETTINGS_KEY = "pot.uiSettings";

type UiSettings = {
  displayTiers?: boolean;
  displayRune?: boolean;
  canvasBgPath?: string;
  canvasBgOpacity?: number;
};

function readUiSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as UiSettings) : {};
  } catch {
    return {};
  }
}

const initialUi = readUiSettings();

// Always display modifier tiers (if on, displayTiers is true)
export const displayTiers = writable<boolean>(
  typeof initialUi.displayTiers === "boolean" ? initialUi.displayTiers : false,
);

// Hide socketable modifiers (if hidden, displayRune is false)
export const displayRune = writable<boolean>(
  typeof initialUi.displayRune === "boolean" ? initialUi.displayRune : true,
);
export const canvasBgPath = writable<string>(
  typeof initialUi.canvasBgPath === "string" ? initialUi.canvasBgPath : "",
);

// Static canvas background opacity (0.0 to 1.0)
export const canvasBgOpacity = writable<number>(
  typeof initialUi.canvasBgOpacity === "number"
    ? initialUi.canvasBgOpacity
    : 0.35,
);
function persistUiSettings() {
  try {
    localStorage.setItem(
      UI_SETTINGS_KEY,
      JSON.stringify({
        displayTiers: get(displayTiers),
        displayRune: get(displayRune),
      }),
    );
  } catch {
    /* storage unavailable, ignore */
  }
}

displayTiers.subscribe(persistUiSettings);
displayRune.subscribe(persistUiSettings);
canvasBgPath.subscribe(persistUiSettings);
canvasBgOpacity.subscribe(persistUiSettings);

// Keep other app windows in sync (the "storage" event only fires in other windows)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== UI_SETTINGS_KEY) return;
    const next = readUiSettings();
    if (typeof next.displayTiers === "boolean")
      displayTiers.set(next.displayTiers);
    if (typeof next.displayRune === "boolean")
      displayRune.set(next.displayRune);
    if (typeof next.canvasBgPath === "string")
      canvasBgPath.set(next.canvasBgPath);
    if (typeof next.canvasBgOpacity === "number")
      canvasBgOpacity.set(next.canvasBgOpacity);
  });
}
