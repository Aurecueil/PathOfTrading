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
export const staticsPoe = writable<StaticCategory[]>([]);
export const staticsPoe2 = writable<StaticCategory[]>([]);
const leaguesPoe = writable<League[]>([]);
const leaguesPoe2 = writable<League[]>([]);
export const leaguesAll = derived(
  [leaguesPoe, leaguesPoe2],
  ([$leaguesPoe, $leaguesPoe2]) => [...$leaguesPoe, ...$leaguesPoe2],
);

registerPricingStores(leaguesAll);

// PoE 1 Exclusive Mercenary Stores
export const mercenarySkills = writable<MercenarySkillsMap>({});
export const mercenarySupports = writable<MercenarySupportsMap>({});

// PoE 2 Keywords Store
export const keywords = writable<KeywordsMap>({});

export const isLoading = writable<boolean>(false);
export const loadError = writable<string | null>(null);
export const currentLanguage = writable<string>("EN");

export const authState = writable<boolean>(false);
export const isDev = writable<boolean>(false);
export { preferDirectExchange, tadedExchangeRatios };

// ---------------------------------------------------------------------------
// UI-only settings, persisted to disk via webview storage
// ---------------------------------------------------------------------------
const UI_SETTINGS_KEY = "pot.uiSettings";

type UiSettings = {
  displayTiers?: boolean;
  displayRune?: boolean;
  canvasBgPath?: string;
  canvasBgOpacity?: number;
  showTooltips?: boolean;
  preferDirectExchange?: boolean;
  tadedExchangeRatios?: unknown;
  compactMercenaryDisplay?: boolean;
  tpHotkey?: string;
};

function readUiSettings(): UiSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as UiSettings) : {};
  } catch {
    return {};
  }
}

const initialUi = readUiSettings();

// Hydrate imported pricing stores if saved values exist
if (typeof initialUi.preferDirectExchange === "boolean") {
  preferDirectExchange.set(initialUi.preferDirectExchange);
}
if (initialUi.tadedExchangeRatios !== undefined) {
  tadedExchangeRatios.set(initialUi.tadedExchangeRatios as any);
}

export const showTooltips = writable<boolean>(
  typeof initialUi.showTooltips === "boolean" ? initialUi.showTooltips : true,
);
export const compactMercenaryDisplay = writable<boolean>(
  typeof initialUi.compactMercenaryDisplay === "boolean"
    ? initialUi.compactMercenaryDisplay
    : false,
);
export const tpHotkey = writable<string>(
  typeof initialUi.tpHotkey === "string" && initialUi.tpHotkey.trim() !== ""
    ? initialUi.tpHotkey
    : "CommandOrControl+Shift+T",
);

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
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      UI_SETTINGS_KEY,
      JSON.stringify({
        displayTiers: get(displayTiers),
        displayRune: get(displayRune),
        canvasBgPath: get(canvasBgPath),
        canvasBgOpacity: get(canvasBgOpacity),
        showTooltips: get(showTooltips),
        preferDirectExchange: get(preferDirectExchange),
        tadedExchangeRatios: get(tadedExchangeRatios),
        compactMercenaryDisplay: get(compactMercenaryDisplay),
        tpHotkey: get(tpHotkey),
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
showTooltips.subscribe(persistUiSettings);
preferDirectExchange.subscribe(persistUiSettings);
tadedExchangeRatios.subscribe(persistUiSettings);
compactMercenaryDisplay.subscribe(persistUiSettings);
tpHotkey.subscribe(persistUiSettings);

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
    if (typeof next.showTooltips === "boolean")
      showTooltips.set(next.showTooltips);
    if (typeof next.preferDirectExchange === "boolean")
      preferDirectExchange.set(next.preferDirectExchange);
    if (next.tadedExchangeRatios !== undefined)
      tadedExchangeRatios.set(next.tadedExchangeRatios as any);
    if (typeof next.compactMercenaryDisplay === "boolean")
      compactMercenaryDisplay.set(next.compactMercenaryDisplay);
    if (typeof next.tpHotkey === "string") tpHotkey.set(next.tpHotkey);
  });
}

export async function updateTpHotkey(newHotkey: string): Promise<void> {
  try {
    // The backend argument name is `accelerator`
    await invoke("tp_set_hotkey", { accelerator: newHotkey });

    // Update store only when backend command succeeds (triggers localStorage persistence)
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
export const isLeaguesLoading = writable<boolean>(false);
export const leaguesError = writable<string | null>(null);

/**
 * Loads PoE & PoE2 leagues first to unblock critical UI flows immediately.
 */
export async function initLeaguesData(): Promise<void> {
  isLeaguesLoading.set(true);
  leaguesError.set(null);

  try {
    const [poeLeaguesResult, poe2LeaguesResult] = await Promise.allSettled([
      invoke<LeagueData>("load_league_data", { realm: "pc" }),
      invoke<LeagueData>("load_league_data", { realm: "poe2" }),
    ]);

    const errors: string[] = [];

    if (poeLeaguesResult.status === "fulfilled") {
      leaguesPoe.set(poeLeaguesResult.value.result);
    } else {
      errors.push(`PoE Leagues: ${poeLeaguesResult.reason}`);
    }

    if (poe2LeaguesResult.status === "fulfilled") {
      leaguesPoe2.set(poe2LeaguesResult.value.result);
    } else {
      errors.push(`PoE2 Leagues: ${poe2LeaguesResult.reason}`);
    }

    if (errors.length > 0) {
      leaguesError.set(errors.join(" | "));
    }
  } catch (err) {
    leaguesError.set(typeof err === "string" ? err : "Failed to load leagues");
  } finally {
    isLeaguesLoading.set(false);
  }
}
export async function initItemData(): Promise<void> {
  isLoading.set(true);
  loadError.set(null);

  try {
    // 1. Fetch language concurrently with assets instead of awaiting it first
    const langPromise = invoke<string>("get_language")
      .then((backendLang) => {
        if (backendLang) currentLanguage.set(backendLang);
        return backendLang;
      })
      .catch(() => get(currentLanguage));

    // 2. Resolve URLs dynamically inside fetch promises
    const mercSkillsPromise = langPromise.then((lang) =>
      fetchCachedJson<MercenarySkillsMap>(
        getRepoeUrl("mercenary_skills.min.json", lang),
      ),
    );
    const mercSupportsPromise = langPromise.then((lang) =>
      fetchCachedJson<MercenarySupportsMap>(
        getRepoeUrl("mercenary_supports.min.json", lang),
      ),
    );
    const keywordsPromise = fetchCachedJson<KeywordsMap>(getPoe2KeywordsUrl());

    // 3. Fire remaining heavy IPCs (Leagues are excluded)
    const [
      poeItems,
      poe2Items,
      poeFilters,
      poe2Filters,
      poeStats,
      poe2Stats,
      poeStatics,
      poe2Statics,
      mercSkills,
      mercSupports,
      keywordsData,
    ] = await Promise.allSettled([
      invoke<ItemDataResponse>("load_item_data", { realm: "pc" }),
      invoke<ItemDataResponse>("load_item_data", { realm: "poe2" }),
      invoke<FilterDataResponse>("load_filters_data", { realm: "pc" }),
      invoke<FilterDataResponse>("load_filters_data", { realm: "poe2" }),
      invoke<StatsDataResponse>("load_stats_data", { realm: "pc" }),
      invoke<StatsDataResponse>("load_stats_data", { realm: "poe2" }),
      invoke<StaticDataResponse>("load_static_data", { realm: "pc" }),
      invoke<StaticDataResponse>("load_static_data", { realm: "poe2" }),
      mercSkillsPromise,
      mercSupportsPromise,
      keywordsPromise,
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

  const savedHotkey = get(tpHotkey);

  const [settings, lang] = await Promise.allSettled([
    invoke<{ colorCoding: boolean }>("get_user_settings"),
    invoke<string>("get_language"),
    loadStatColorConfigsFromDisk(false),
    invoke("tp_set_hotkey", { accelerator: savedHotkey }),
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
