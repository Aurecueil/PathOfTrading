// src/lib/trade/pricing.ts
import { writable, get, derived, type Readable } from "svelte/store";
import type { League } from "$lib/types/leagues";

export type GameRealm = "poe" | "poe2";

export const POE1_TARGETS = [
  "chaos",
  "exalted",
  "divine",
  "mirror",
  "blessed",
  "chrome",
  "gcp",
  "jewellers",
  "scour",
  "regret",
  "fusing",
  "chance",
  "alt",
  "alch",
  "regal",
  "vaal",
] as const;

export const POE2_TARGETS = [
  "aug",
  "transmute",
  "exalted",
  "regal",
  "chaos",
  "vaal",
  "alch",
  "divine",
  "annul",
  "mirror",
] as const;

export interface LeaguePriceData {
  timestamp: number;
  base: string;
  rates: Record<string, number>;
}

export type PricesStoreMap = Record<GameRealm, Record<string, LeaguePriceData>>;
export type OverridesStoreMap = Record<
  GameRealm,
  Record<string, Record<string, number>>
>;

const OVERRIDES_STORAGE_KEY = "pot.currencyOverrides";
const PRICING_BASE_URL =
  "https://raw.githubusercontent.com/Aurecueil/poe.ninja.prices/main";

// Store references injected from tradeStore.ts to avoid circular imports
let poeLeaguesStore: Readable<League[]> | null = null;
let poe2LeaguesStore: Readable<League[]> | null = null;

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const rawPrices = writable<PricesStoreMap>({ poe: {}, poe2: {} });
export const priceOverrides = writable<OverridesStoreMap>(
  loadOverridesFromStorage(),
);
export const isRefreshingPrices = writable<boolean>(false);
export const lastPriceUpdate = writable<{
  poe: number | null;
  poe2: number | null;
}>({
  poe: null,
  poe2: null,
});

export const effectivePrices = derived(
  [rawPrices, priceOverrides],
  ([$raw, $overrides]): PricesStoreMap => {
    const result: PricesStoreMap = { poe: {}, poe2: {} };

    for (const realm of ["poe", "poe2"] as const) {
      const leagues = new Set([
        ...Object.keys($raw[realm] || {}),
        ...Object.keys($overrides[realm] || {}),
      ]);

      for (const leagueId of leagues) {
        const rawLeague = $raw[realm]?.[leagueId];
        const userOverrides = $overrides[realm]?.[leagueId] ?? {};

        result[realm][leagueId] = {
          timestamp: rawLeague?.timestamp ?? Math.floor(Date.now() / 1000),
          base: rawLeague?.base ?? "chaos",
          rates: {
            ...(rawLeague?.rates ?? {}),
            ...userOverrides,
          },
        };
      }
    }

    return result;
  },
);

// ---------------------------------------------------------------------------
// Overrides Persistence
// ---------------------------------------------------------------------------
function loadOverridesFromStorage(): OverridesStoreMap {
  if (typeof window === "undefined") return { poe: {}, poe2: {} };
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return { poe: {}, poe2: {} };
    const parsed = JSON.parse(raw);
    return {
      poe: parsed.poe ?? {},
      poe2: parsed.poe2 ?? {},
    };
  } catch {
    return { poe: {}, poe2: {} };
  }
}

function saveOverridesToStorage(data: OverridesStoreMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

priceOverrides.subscribe(saveOverridesToStorage);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === OVERRIDES_STORAGE_KEY) {
      priceOverrides.set(loadOverridesFromStorage());
    }
  });
}

export function setCurrencyOverride(
  realm: GameRealm,
  leagueId: string,
  currency: string,
  value: number | null,
): void {
  priceOverrides.update((state) => {
    const next = { ...state, [realm]: { ...state[realm] } };
    const leagueMap = { ...(next[realm][leagueId] ?? {}) };

    if (value === null || Number.isNaN(value) || value <= 0) {
      delete leagueMap[currency];
    } else {
      leagueMap[currency] = value;
    }

    next[realm][leagueId] = leagueMap;
    return next;
  });
}

export function clearLeagueOverrides(realm: GameRealm, leagueId: string): void {
  priceOverrides.update((state) => {
    const next = { ...state, [realm]: { ...state[realm] } };
    delete next[realm][leagueId];
    return next;
  });
}

// ---------------------------------------------------------------------------
// League Filtering & Deduplication
// ---------------------------------------------------------------------------
/**
 * Safely extracts the realm string from a League object regardless of whether
 * the backend serializes it as `realms` or `realm`, or as an array.
 */
function getLeagueRealmValue(league: League): string {
  const anyLeague = league as unknown as Record<string, unknown>;
  const raw = anyLeague.realms ?? anyLeague.realm;

  if (typeof raw === "string") return raw.toLowerCase();
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0]).toLowerCase();
  return "";
}

export function isSupportedPoe1League(league: League): boolean {
  // Strictly allow only PC realm leagues using the updated property name
  if (league.realm && league.realm !== "pc") return false;

  const id = (league.id || "").toLowerCase();
  const text = (league.text || "").toLowerCase();

  // Exclude Ruthless leagues
  if (id.includes("ruthless") || text.includes("ruthless")) return false;

  return true;
}

export function getValidLeagues(
  leagues: League[] | undefined | null,
  realm: GameRealm,
): League[] {
  if (!Array.isArray(leagues) || leagues.length === 0) return [];

  const filtered =
    realm === "poe"
      ? leagues.filter(isSupportedPoe1League)
      : leagues.filter(
          (l) => !l.realm || l.realm === "pc" || l.realm === "poe2",
        );

  // Deduplicate by league.id so Svelte {#each} blocks never hit duplicate keys
  const seen = new Set<string>();
  const unique: League[] = [];

  for (const league of filtered) {
    if (!league?.id || seen.has(league.id)) continue;
    seen.add(league.id);
    unique.push(league);
  }

  return unique;
}
// ---------------------------------------------------------------------------
// Fetching & Minute-Aligned Scheduler
// ---------------------------------------------------------------------------
async function fetchSingleLeaguePrices(
  realm: GameRealm,
  leagueId: string,
): Promise<LeaguePriceData | null> {
  const encodedLeague = encodeURIComponent(leagueId);
  const url = `${PRICING_BASE_URL}/${realm}/${encodedLeague}.json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as LeaguePriceData;
    if (!data || typeof data.rates !== "object") return null;
    return data;
  } catch (err) {
    console.warn(`[Pricing] Failed to fetch ${realm}/${leagueId}:`, err);
    return null;
  }
}

export async function refreshRealmPrices(
  realm: GameRealm,
  overrideLeagues?: League[],
): Promise<void> {
  const rawList =
    overrideLeagues ??
    (realm === "poe"
      ? poeLeaguesStore
        ? get(poeLeaguesStore)
        : []
      : poe2LeaguesStore
        ? get(poe2LeaguesStore)
        : []);

  const targetLeagues = getValidLeagues(rawList, realm);
  if (targetLeagues.length === 0) return;

  isRefreshingPrices.set(true);
  try {
    const results = await Promise.allSettled(
      targetLeagues.map(async (l) => ({
        id: l.id,
        data: await fetchSingleLeaguePrices(realm, l.id),
      })),
    );

    rawPrices.update((current) => {
      const nextRealmMap = { ...current[realm] };
      for (const res of results) {
        if (res.status === "fulfilled" && res.value.data) {
          nextRealmMap[res.value.id] = res.value.data;
        }
      }
      return { ...current, [realm]: nextRealmMap };
    });

    lastPriceUpdate.update((u) => ({ ...u, [realm]: Date.now() }));
  } finally {
    isRefreshingPrices.set(false);
  }
}

let poe1Timer: ReturnType<typeof setTimeout> | null = null;
let poe2Timer: ReturnType<typeof setTimeout> | null = null;
let schedulerInitialized = false;

function getMsUntilNextMinuteMark(targetMinutes: number[]): number {
  const now = new Date();
  const currentMin = now.getMinutes();
  const currentSec = now.getSeconds();
  const currentMs = now.getMilliseconds();

  const nextMin = targetMinutes.find((m) => m > currentMin);
  const minsToAdd =
    nextMin !== undefined
      ? nextMin - currentMin
      : 60 - currentMin + targetMinutes[0];

  return minsToAdd * 60_000 - currentSec * 1000 - currentMs + 2000;
}

function scheduleRealmUpdate(realm: GameRealm, targetMinutes: number[]) {
  const delay = getMsUntilNextMinuteMark(targetMinutes);

  const timer = setTimeout(async () => {
    await refreshRealmPrices(realm);
    scheduleRealmUpdate(realm, targetMinutes);
  }, delay);

  if (realm === "poe") {
    if (poe1Timer) clearTimeout(poe1Timer);
    poe1Timer = timer;
  } else {
    if (poe2Timer) clearTimeout(poe2Timer);
    poe2Timer = timer;
  }
}

/**
 * Connects the league stores and starts the pricing fetch + cron schedules.
 */
export function registerPricingStores(
  poeStore: Readable<League[]>,
  poe2Store: Readable<League[]>,
): void {
  poeLeaguesStore = poeStore;
  poe2LeaguesStore = poe2Store;

  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // Automatically fetch as soon as leagues populate
  poeStore.subscribe((leagues) => {
    if (leagues.length > 0 && Object.keys(get(rawPrices).poe).length === 0) {
      refreshRealmPrices("poe", leagues);
    }
  });

  poe2Store.subscribe((leagues) => {
    if (leagues.length > 0 && Object.keys(get(rawPrices).poe2).length === 0) {
      refreshRealmPrices("poe2", leagues);
    }
  });

  scheduleRealmUpdate("poe", [2, 17, 32, 47]);
  scheduleRealmUpdate("poe2", [9]);
}

// ---------------------------------------------------------------------------
// Global Currency Conversion Function & Preview Helper
// ---------------------------------------------------------------------------
export function convertCurrency(
  amount: number,
  currencyA: string,
  currencyB: string,
  leagueId: string,
  realm: GameRealm,
): number {
  if (!Number.isFinite(amount)) return -9;

  const prices = get(effectivePrices);
  const leagueData = prices[realm]?.[leagueId];
  if (!leagueData || !leagueData.rates) return -9;

  const keyA = currencyA.toLowerCase();
  const keyB = currencyB.toLowerCase();

  const rateA =
    leagueData.rates[keyA] ??
    (leagueData.base?.toLowerCase() === keyA ? 1 : undefined);
  const rateB =
    leagueData.rates[keyB] ??
    (leagueData.base?.toLowerCase() === keyB ? 1 : undefined);

  if (
    typeof rateA !== "number" ||
    typeof rateB !== "number" ||
    rateA <= 0 ||
    rateB <= 0
  ) {
    return -9;
  }

  if (keyA === keyB) {
    return Math.round(amount * 10) / 10;
  }

  const rawConverted = (amount * rateA) / rateB;
  return Math.round(rawConverted * 10) / 10;
}

export interface RatioPreviewPair {
  leftCurrency: string;
  leftAmount: number;
  rightCurrency: string;
  rightAmount: number;
}

export function buildNormalizedPair(
  curr1: string,
  curr2: string,
  rates: Record<string, number>,
  baseKey: string,
): RatioPreviewPair | null {
  const r1 = rates[curr1] ?? (curr1 === baseKey ? 1 : undefined);
  const r2 = rates[curr2] ?? (curr2 === baseKey ? 1 : undefined);

  if (typeof r1 !== "number" || typeof r2 !== "number" || r1 <= 0 || r2 <= 0) {
    return null;
  }

  if (r1 >= r2) {
    return {
      leftCurrency: curr1,
      leftAmount: 1,
      rightCurrency: curr2,
      rightAmount: Math.round((r1 / r2) * 10) / 10,
    };
  } else {
    return {
      leftCurrency: curr2,
      leftAmount: 1,
      rightCurrency: curr1,
      rightAmount: Math.round((r2 / r1) * 10) / 10,
    };
  }
}
