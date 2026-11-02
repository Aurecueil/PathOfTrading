// src/lib/trade/pricing.ts
import { writable, get, derived, type Readable } from "svelte/store";
import type { League } from "$lib/types/leagues";
import type { Realm } from "$lib/types/leagues";

export const POE1_TARGETS = [
  "chaos",
  "divine",
  "alch",
  "exalted",
  "alt",
  "mirror",
  "chrome",
  "blessed",
  "fusing",
  "jewellers",
  "regal",
  "vaal",
  "chance",
  "annul",
  "aug",
  "regret",
  "scour",
  "transmute",
  "wisdom",
  "fracturing-orb",
  "portal",
  "scrap",
  "whetstone",
  "gcp",
  "bauble",
  "offer",
] as const;

export const POE2_TARGETS = [
  "exalted",
  "greater-exalted-orb",
  "perfect-exalted-orb",
  "divine",
  "chaos",
  "greater-chaos-orb",
  "perfect-chaos-orb",
  "alch",
  "annul",
  "regal",
  "greater-regal-orb",
  "perfect-regal-orb",
  "transmute",
  "greater-orb-of-transmutation",
  "perfect-orb-of-transmutation",
  "aug",
  "greater-orb-of-augmentation",
  "perfect-orb-of-augmentation",
  "chance",
  "vaal",
  "artificers",
  "fracturing-orb",
  "mirror",
  "wisdom",
] as const;

// ---------------------------------------------------------------------------
// Schema Types (matching R2 output on data.aurecueil.uk)
// ---------------------------------------------------------------------------
export interface HWPair {
  h: number;
  w: number;
}

export interface ExchangeRateEntry {
  have: string;
  want: string;
  type: "direct" | "proxy";
  via?: string;
  buy: HWPair;
  sell: HWPair;
  vol: HWPair;
  timestamp?: number;
}

/**
 * [have, want, via, ts, buyH, buyW, sellH, sellW, volH, volW, traded]
 */
export type R2Row = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface R2LeagueData {
  t: number;
  c: string[];
  r: R2Row[];
}

export interface R2GameFile {
  v: 1;
  updated: number;
  leagues: Record<string, R2LeagueData>;
}

export interface R2FileInfo {
  path: string;
  updated: number;
  leagues: Record<string, number>;
}

export interface R2GameIndex {
  current: R2FileInfo;
  archive: R2FileInfo;
}

export interface R2IndexFile {
  v: 1;
  updated: number;
  games: Record<string, R2GameIndex>;
}

/** Map of canonical pair key (`"have/want"` where `have < want`) -> ExchangeRateEntry */
export type ExchangePairMap = Record<string, ExchangeRateEntry>;

export interface LeagueExchangeMaps {
  timestamp: number;
  currencies: string[];
  direct: ExchangePairMap;
  proxy: ExchangePairMap;
}

export interface LeaguePriceData extends LeagueExchangeMaps {
  base: string;
  /** Scalar value of 1 unit of each currency expressed in `base` units (for UI/overrides) */
  rates: Record<string, number>;
}

export type RawPricesStoreMap = Record<
  Realm,
  Record<string, LeagueExchangeMaps>
>;
export type PricesStoreMap = Record<Realm, Record<string, LeaguePriceData>>;
export type OverridesStoreMap = Record<
  Realm,
  Record<string, Record<string, number>>
>;

const OVERRIDES_STORAGE_KEY = "pot.currencyOverrides";
const PRICING_BASE_URL = "https://data.aurecueil.uk";

// Store references injected from tradeStore.ts to avoid circular imports
let leaguesStore: Readable<League[]> | null = null;
let leaguesUnsubscribe: (() => void) | null = null;

// Tracks subscribed realms and the `updated` unix timestamp of each realm's current.json
const subscribedRealms = new Set<Realm>();
const realmRemoteUpdated: Record<Realm, number | null> = {
  pc: null,
  poe2: null,
  xbox: null,
  sony: null,
};

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const preferDirectExchange = writable<boolean>(false);
export const tadedExchangeRatios = writable<boolean>(false);

export const rawPrices = writable<RawPricesStoreMap>({
  pc: {},
  poe2: {},
  xbox: {},
  sony: {},
});
export const priceOverrides = writable<OverridesStoreMap>(
  loadOverridesFromStorage(),
);
export const isRefreshingPrices = writable<boolean>(false);
export const lastPriceUpdate = writable<{
  pc: number | null;
  poe2: number | null;
  xbox: number | null;
  sony: number | null;
}>({
  pc: null,
  poe2: null,
  xbox: null,
  sony: null,
});

// ---------------------------------------------------------------------------
// User-set exchange ratios (one override per pair, with buy / sell / vol slots)
// ---------------------------------------------------------------------------
export type PairSource = "direct" | "proxy";
export type RatioMode = "vol" | "buy" | "sell";

export const LIFETIME_OPTIONS = [
  { id: "1h", label: "Clear after 1 hour", ms: 3_600_000 },
  { id: "2h", label: "Clear after 2 hours", ms: 2 * 3_600_000 },
  { id: "6h", label: "Clear after 6 hours", ms: 6 * 3_600_000 },
  { id: "12h", label: "Clear after 12 hours", ms: 12 * 3_600_000 },
  { id: "1d", label: "Clear after 1 day", ms: 24 * 3_600_000 },
  { id: "2d", label: "Clear after 2 days", ms: 48 * 3_600_000 },
  { id: "4d", label: "Clear after 4 days", ms: 96 * 3_600_000 },
  { id: "1w", label: "Clear after 1 week", ms: 168 * 3_600_000 },
  { id: "never", label: "Never", ms: null },
] as const;
export type LifetimeId = (typeof LIFETIME_OPTIONS)[number]["id"];
export const DEFAULT_LIFETIME: LifetimeId = "1d";

/** h/w follow the ExchangeRateEntry convention (canonical `have/want`, have < want). */
export interface UserRatio {
  h: number;
  w: number;
  lifetime: LifetimeId;
  /** unix ms when this ratio is cleared; null = never */
  expires: number | null;
}
/** One override per pair, with at most one value per mode */
export type UserPairRatios = Partial<Record<RatioMode, UserRatio>>;
/** canonical pair key -> modes */
export type UserLeagueRatios = Record<string, UserPairRatios>;
export type UserRatiosStoreMap = Record<
  Realm,
  Record<string, UserLeagueRatios>
>;

const USER_RATIOS_KEY = "pot.userExchangeRatios.v2";
const RATIO_MODES: RatioMode[] = ["vol", "buy", "sell"];

function lifetimeExpiry(id: LifetimeId, from = Date.now()): number | null {
  const ms = LIFETIME_OPTIONS.find((o) => o.id === id)?.ms ?? null;
  return ms === null ? null : from + ms;
}

function isLive(r: UserRatio | undefined, now = Date.now()): r is UserRatio {
  return !!r && r.h > 0 && r.w > 0 && (r.expires === null || r.expires > now);
}

function pruneUserRatios(
  map: UserRatiosStoreMap,
  now = Date.now(),
): { next: UserRatiosStoreMap; changed: boolean } {
  const next = structuredClone(map);
  let changed = false;
  for (const realm of ["pc", "poe2", "xbox", "sony"] as const) {
    for (const [leagueId, pairs] of Object.entries(next[realm])) {
      for (const [key, modes] of Object.entries(pairs)) {
        for (const m of RATIO_MODES) {
          if (modes[m] && !isLive(modes[m], now)) {
            delete modes[m];
            changed = true;
          }
        }
        if (Object.keys(modes).length === 0) delete pairs[key];
      }
      if (Object.keys(pairs).length === 0) delete next[realm][leagueId];
    }
  }
  return { next, changed };
}

function loadUserRatios(): UserRatiosStoreMap {
  const empty: UserRatiosStoreMap = { pc: {}, poe2: {}, xbox: {}, sony: {} };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(USER_RATIOS_KEY);
    if (!raw) return empty;
    const p = JSON.parse(raw);
    return pruneUserRatios({
      pc: p.pc ?? {},
      poe2: p.poe2 ?? {},
      xbox: p.xbox ?? {},
      sony: p.sony ?? {},
    }).next;
  } catch {
    return empty;
  }
}

export const userRatios = writable<UserRatiosStoreMap>(loadUserRatios());

userRatios.subscribe((data) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USER_RATIOS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
});

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === USER_RATIOS_KEY) userRatios.set(loadUserRatios());
  });
  // Clear expired ratios while the app is open
  setInterval(() => {
    const { next, changed } = pruneUserRatios(get(userRatios));
    if (changed) userRatios.set(next);
  }, 15_000);
}

function mutateUserRatios(fn: (draft: UserRatiosStoreMap) => void) {
  userRatios.update((s) => {
    const draft = structuredClone(s);
    fn(draft);
    return pruneUserRatios(draft).next;
  });
}

/** Pair key + which slot (vol / buy / sell) a `from -> to` row maps to. */
export function ratioModeFor(from: string, to: string, useTradedVol: boolean) {
  const { key, flipped } = makePairKey(from, to);
  const mode: RatioMode = useTradedVol ? "vol" : flipped ? "sell" : "buy";
  return { key, flipped, mode };
}

/** Sets "1 `from` = `mult` `to`" as the user ratio. Existing lifetime is kept. */
export function setUserMultiplier(
  realm: Realm,
  leagueId: string,
  from: string,
  to: string,
  mult: number,
  useTradedVol: boolean,
  lifetime?: LifetimeId,
): void {
  if (!leagueId || !Number.isFinite(mult) || mult <= 0) return;
  const { key, flipped, mode } = ratioModeFor(from, to, useTradedVol);
  // multiplier = flipped ? h / w : w / h
  const hw = flipped ? { h: mult, w: 1 } : { h: 1, w: mult };
  mutateUserRatios((d) => {
    const league = (d[realm][leagueId] ??= {});
    const pair = (league[key] ??= {});
    const lt = lifetime ?? pair[mode]?.lifetime ?? DEFAULT_LIFETIME;
    pair[mode] = { ...hw, lifetime: lt, expires: lifetimeExpiry(lt) };
  });
}

export function clearUserMultiplier(
  realm: Realm,
  leagueId: string,
  from: string,
  to: string,
  useTradedVol: boolean,
): void {
  const { key, mode } = ratioModeFor(from, to, useTradedVol);
  mutateUserRatios((d) => {
    delete d[realm][leagueId]?.[key]?.[mode];
  });
}

export function setUserLifetime(
  realm: Realm,
  leagueId: string,
  from: string,
  to: string,
  useTradedVol: boolean,
  lifetime: LifetimeId,
): void {
  const { key, mode } = ratioModeFor(from, to, useTradedVol);
  mutateUserRatios((d) => {
    const r = d[realm][leagueId]?.[key]?.[mode];
    if (r) {
      r.lifetime = lifetime;
      r.expires = lifetimeExpiry(lifetime);
    }
  });
}

/**
 * Multiplier for one displayed row. A user ratio (shared by direct and proxy)
 * wins over the market entry of the given source.
 */
export function getSourceRowMultiplier(
  maps: LeagueExchangeMaps | undefined,
  user: UserLeagueRatios | undefined,
  source: PairSource,
  from: string,
  to: string,
  useTradedVol: boolean,
): {
  mult: number | null;
  custom: UserRatio | null;
  entry: ExchangeRateEntry | undefined;
} {
  const { key, flipped, mode } = ratioModeFor(from, to, useTradedVol);
  const entry = maps?.[source][key];
  const custom = user?.[key]?.[mode];
  if (isLive(custom)) {
    return {
      mult: flipped ? custom.h / custom.w : custom.w / custom.h,
      custom,
      entry,
    };
  }
  return {
    mult: entry ? getPairMultiplier(entry, flipped, useTradedVol) : null,
    custom: null,
    entry,
  };
}

/** Used by conversion: a live user ratio wins over direct/proxy data. */
function resolveUserMultiplier(
  user: UserLeagueRatios | undefined,
  from: string,
  to: string,
  useTradedVol: boolean,
): number | null {
  if (!user) return null;
  const { key, flipped, mode } = ratioModeFor(from, to, useTradedVol);
  const r = user[key]?.[mode];
  return isLive(r) ? (flipped ? r.h / r.w : r.w / r.h) : null;
}

// ---------------------------------------------------------------------------
// Pair Lookup & Ratio Math
// ---------------------------------------------------------------------------
export function makePairKey(
  currA: string,
  currB: string,
): { key: string; flipped: boolean } {
  const a = currA.toLowerCase();
  const b = currB.toLowerCase();
  return a < b
    ? { key: `${a}/${b}`, flipped: false }
    : { key: `${b}/${a}`, flipped: true };
}

/**
 * Selects the appropriate ExchangeRateEntry between `direct` and `proxy` maps.
 * If both are available for the pair, `preferDirect` determines which one is used.
 */
export function selectPairEntry(
  leagueMaps: LeagueExchangeMaps,
  currA: string,
  currB: string,
  preferDirect: boolean,
): { entry: ExchangeRateEntry; flipped: boolean } | null {
  const { key, flipped } = makePairKey(currA, currB);
  const directEntry = leagueMaps.direct[key];
  const proxyEntry = leagueMaps.proxy[key];

  if (directEntry && proxyEntry) {
    return { entry: preferDirect ? directEntry : proxyEntry, flipped };
  }
  const chosen = directEntry ?? proxyEntry;
  return chosen ? { entry: chosen, flipped } : null;
}

/**
 * Computes how many units of `toCurr` you get per 1 unit of `fromCurr` (`want / have`).
 *
 * - If `useTradedVol` (`tadedExchangeRatios`) is true: uses `vol` ratio (`vol.w / vol.h`).
 * - If `useTradedVol` is false: uses `buy`/`sell` fields:
 *   - Canonical direction (`from = have`, `to = want`): buying `want` with `have` -> `buy.w / buy.h`.
 *   - Flipped direction (`from = want`, `to = have`): selling `want` for `have` -> `sell.h / sell.w`.
 */
export function getPairMultiplier(
  entry: ExchangeRateEntry,
  flipped: boolean,
  useTradedVol: boolean,
): number | null {
  if (useTradedVol) {
    const { h, w } = entry.vol;
    if (!h || !w || h <= 0 || w <= 0) return null;
    return flipped ? h / w : w / h;
  }

  if (!flipped) {
    const { h, w } = entry.buy;
    if (!h || !w || h <= 0 || w <= 0) return null;
    return w / h;
  } else {
    const { h, w } = entry.sell;
    if (!h || !w || h <= 0 || w <= 0) return null;
    return h / w;
  }
}

/**
 * Resolves the conversion multiplier from `fromCurr` -> `toCurr` strictly from
 * the league's `direct` and `proxy` maps. Returns `null` if the pair does not
 * exist in the R2 JSON file.
 */
function resolvePairMultiplier(
  leagueMaps: LeagueExchangeMaps,
  fromCurr: string,
  toCurr: string,
  preferDirect: boolean,
  useTradedVol: boolean,
  userPairs?: UserLeagueRatios,
): number | null {
  const a = fromCurr.toLowerCase();
  const b = toCurr.toLowerCase();

  if (a === b) {
    return leagueMaps.currencies.includes(a) ? 1 : null;
  }

  // User-set ratios take priority over direct and proxy market data
  const userMult = resolveUserMultiplier(userPairs, a, b, useTradedVol);
  if (userMult !== null) return userMult;

  const selected = selectPairEntry(leagueMaps, a, b, preferDirect);
  if (!selected) return null;

  const mult = getPairMultiplier(
    selected.entry,
    selected.flipped,
    useTradedVol,
  );
  return mult !== null && mult > 0 ? mult : null;
}

function getDefaultBase(realm: Realm, currencies: string[]): string {
  if (currencies.includes("chaos")) return "chaos";
  if (realm === "poe2" && currencies.includes("exalted")) return "exalted";
  return currencies[0] ?? "chaos";
}

function buildBaseRatesMap(
  leagueMaps: LeagueExchangeMaps,
  base: string,
  preferDirect: boolean,
  useTradedVol: boolean,
  userPairs?: UserLeagueRatios,
): Record<string, number> {
  const rates: Record<string, number> = {};
  if (leagueMaps.currencies.includes(base)) {
    rates[base] = 1;
  }

  for (const curr of leagueMaps.currencies) {
    const key = curr.toLowerCase();
    if (key === base) continue;
    const mult = resolvePairMultiplier(
      leagueMaps,
      key,
      base,
      preferDirect,
      useTradedVol,
      userPairs,
    );
    if (mult !== null && Number.isFinite(mult) && mult > 0) {
      rates[key] = mult;
    }
  }
  return rates;
}

export const effectivePrices = derived(
  [
    rawPrices,
    priceOverrides,
    preferDirectExchange,
    tadedExchangeRatios,
    userRatios,
  ],
  ([$raw, $overrides, $preferDirect, $useTradedVol, $user]): PricesStoreMap => {
    const result: PricesStoreMap = { pc: {}, poe2: {}, xbox: {}, sony: {} };

    for (const realm of ["pc", "poe2", "xbox", "sony"] as const) {
      for (const [leagueId, rawLeague] of Object.entries($raw[realm] || {})) {
        if (!rawLeague) continue;

        const userOverrides = $overrides[realm]?.[leagueId] ?? {};
        const currencies = rawLeague.currencies;
        const base = getDefaultBase(realm, currencies);
        const computedRates = buildBaseRatesMap(
          rawLeague,
          base,
          $preferDirect,
          $useTradedVol,
          $user[realm]?.[leagueId],
        );

        result[realm][leagueId] = {
          timestamp: rawLeague.timestamp,
          base,
          currencies,
          direct: rawLeague.direct,
          proxy: rawLeague.proxy,
          rates: {
            ...computedRates,
            ...userOverrides,
          },
        };
      }
    }

    return result;
  },
);

let pricingRev = 0;
/** Ticks whenever anything convertCurrency() reads changes. Reference it in reactive statements. */
export const pricingRevision = derived(
  [
    rawPrices,
    priceOverrides,
    preferDirectExchange,
    tadedExchangeRatios,
    userRatios,
  ],
  () => ++pricingRev,
);

// ---------------------------------------------------------------------------
// Overrides Persistence
// ---------------------------------------------------------------------------
function loadOverridesFromStorage(): OverridesStoreMap {
  if (typeof window === "undefined")
    return { pc: {}, poe2: {}, xbox: {}, sony: {} };
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return { pc: {}, poe2: {}, xbox: {}, sony: {} };
    const parsed = JSON.parse(raw);
    return {
      pc: parsed.pc ?? parsed.poe ?? {},
      poe2: parsed.poe2 ?? {},
      xbox: parsed.xbox ?? {},
      sony: parsed.sony ?? {},
    };
  } catch {
    return { pc: {}, poe2: {}, xbox: {}, sony: {} };
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
  realm: Realm,
  leagueId: string,
  currency: string,
  value: number | null,
): void {
  priceOverrides.update((state) => {
    const next = { ...state, [realm]: { ...state[realm] } };
    const leagueMap = { ...(next[realm][leagueId] ?? {}) };
    const key = currency.toLowerCase();

    if (value === null || Number.isNaN(value) || value <= 0) {
      delete leagueMap[key];
    } else {
      leagueMap[key] = value;
    }

    next[realm][leagueId] = leagueMap;
    return next;
  });
}

export function clearLeagueOverrides(realm: Realm, leagueId: string): void {
  priceOverrides.update((state) => {
    const next = { ...state, [realm]: { ...state[realm] } };
    delete next[realm][leagueId];
    return next;
  });
}

// ---------------------------------------------------------------------------
// League Filtering & Deduplication
// ---------------------------------------------------------------------------
const ALL_REALMS = ["poe2", "pc", "xbox", "sony"] as const;

/** League.realm (API value) -> Realm used by the pricing files */
const LEAGUE_REALM_MAP: Record<string, Realm> = {
  pc: "pc",
  xbox: "xbox",
  sony: "sony",
  poe2: "poe2",
};

export function leagueToRealm(league: League): Realm | null {
  return LEAGUE_REALM_MAP[league?.realm?.toLowerCase()] ?? null;
}

/** Leagues of one realm from a merged list, deduplicated by id. */
export function getValidLeagues(
  leagues: League[] | undefined | null,
  realm: Realm,
): League[] {
  if (!Array.isArray(leagues) || leagues.length === 0) return [];

  const seen = new Set<string>();
  const unique: League[] = [];

  for (const league of leagues) {
    if (!league?.id || leagueToRealm(league) !== realm) continue;
    if (seen.has(league.id)) continue;
    seen.add(league.id);
    unique.push(league);
  }
  return unique;
}

// ---------------------------------------------------------------------------
// R2 Parsing, Fetching & Minute-Aligned Scheduler
// ---------------------------------------------------------------------------
function parseR2League(raw: R2LeagueData): LeagueExchangeMaps | null {
  if (!raw || !Array.isArray(raw.c) || !Array.isArray(raw.r)) return null;

  const direct: ExchangePairMap = {};
  const proxy: ExchangePairMap = {};
  const currencies = raw.c.map((c) => c.toLowerCase());
  const currencySet = new Set<string>(currencies);

  for (const row of raw.r) {
    if (!Array.isArray(row) || row.length < 10) continue;
    const [hi, wi, viaIdx, ts, buyH, buyW, sellH, sellW, volH, volW] = row;

    const haveRaw = currencies[hi];
    const wantRaw = currencies[wi];
    if (!haveRaw || !wantRaw) continue;

    const via = viaIdx >= 0 ? currencies[viaIdx] : undefined;
    const isProxy = viaIdx >= 0;

    const flipped = haveRaw > wantRaw;
    const have = flipped ? wantRaw : haveRaw;
    const want = flipped ? haveRaw : wantRaw;
    const key = `${have}/${want}`;

    const entry: ExchangeRateEntry = {
      have,
      want,
      type: isProxy ? "proxy" : "direct",
      ...(via ? { via } : {}),
      buy: flipped ? { h: sellW, w: sellH } : { h: buyH, w: buyW },
      sell: flipped ? { h: buyW, w: buyH } : { h: sellH, w: sellW },
      vol: flipped ? { h: volW, w: volH } : { h: volH, w: volW },
      timestamp: ts,
    };

    if (isProxy) {
      proxy[key] = entry;
    } else {
      direct[key] = entry;
    }
  }

  return {
    timestamp:
      typeof raw.t === "number" ? raw.t : Math.floor(Date.now() / 1000),
    currencies: Array.from(currencySet).sort(),
    direct,
    proxy,
  };
}

function parseR2GameFile(
  file: R2GameFile,
): Record<string, LeagueExchangeMaps> | null {
  if (!file || typeof file.leagues !== "object" || !file.leagues) return null;
  const out: Record<string, LeagueExchangeMaps> = {};
  for (const [leagueId, leagueData] of Object.entries(file.leagues)) {
    const parsed = parseR2League(leagueData);
    if (parsed) out[leagueId] = parsed;
  }
  return out;
}

async function fetchIndexFile(): Promise<R2IndexFile | null> {
  try {
    const res = await fetch(`${PRICING_BASE_URL}/index.json?_=${Date.now()}`);
    if (!res.ok) return null;
    return (await res.json()) as R2IndexFile;
  } catch (err) {
    console.warn("[Pricing] Failed to fetch index.json:", err);
    return null;
  }
}

async function fetchRealmCurrentFile(realm: Realm): Promise<R2GameFile | null> {
  try {
    const res = await fetch(
      `${PRICING_BASE_URL}/${realm}/current.json?_=${Date.now()}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as R2GameFile;
  } catch (err) {
    console.warn(`[Pricing] Failed to fetch ${realm}/current.json:`, err);
    return null;
  }
}

let refreshInFlight: Promise<void> | null = null;

/**
 * Fetches `current.json` from R2 for the target realms (defaults to all subscribed realms).
 * When `onlyIfChanged` is true (used by the hourly scheduler), checks `index.json` first
 * and skips fetching any `current.json` whose `updated` timestamp has not changed.
 */
export function refreshAllPrices(
  _overrideLeagues?: League[],
  options?: { realms?: Realm[]; onlyIfChanged?: boolean },
): Promise<void> {
  const targetRealms = (options?.realms ?? Array.from(subscribedRealms)).filter(
    (r) => subscribedRealms.has(r),
  );

  if (targetRealms.length === 0) return Promise.resolve();

  const run = async () => {
    isRefreshingPrices.set(true);
    try {
      let realmsToFetch = [...targetRealms];

      if (options?.onlyIfChanged) {
        const index = await fetchIndexFile();
        if (index?.games) {
          realmsToFetch = targetRealms.filter((realm) => {
            const remoteUpdated = index.games[realm]?.current?.updated;
            const localUpdated = realmRemoteUpdated[realm];
            // Fetch if we have never fetched this realm or if remote timestamp is newer/different
            return (
              localUpdated === null ||
              typeof remoteUpdated !== "number" ||
              remoteUpdated !== localUpdated
            );
          });
        }
      }

      if (realmsToFetch.length === 0) return;

      const results = await Promise.allSettled(
        realmsToFetch.map(async (realm) => ({
          realm,
          file: await fetchRealmCurrentFile(realm),
        })),
      );

      const touched = new Set<Realm>();
      rawPrices.update((current) => {
        const next: RawPricesStoreMap = {
          pc: { ...current.pc },
          poe2: { ...current.poe2 },
          xbox: { ...current.xbox },
          sony: { ...current.sony },
        };

        for (const res of results) {
          if (res.status === "fulfilled" && res.value.file) {
            const { realm, file } = res.value;
            const parsedLeagues = parseR2GameFile(file);
            if (parsedLeagues) {
              next[realm] = parsedLeagues;
              realmRemoteUpdated[realm] = file.updated;
              touched.add(realm);
            }
          }
        }

        return next;
      });

      if (touched.size > 0) {
        const ts = Date.now();
        lastPriceUpdate.update((u) => {
          const n = { ...u };
          for (const r of touched) n[r] = ts;
          return n;
        });
      }
    } finally {
      isRefreshingPrices.set(false);
    }
  };

  const nextPromise = refreshInFlight ? refreshInFlight.then(run, run) : run();
  const tracked = nextPromise.finally(() => {
    if (refreshInFlight === tracked) refreshInFlight = null;
  });
  refreshInFlight = tracked;

  return tracked;
}

let updateTimer: ReturnType<typeof setTimeout> | null = null;
let schedulerInitialized = false;
const UPDATE_MINUTE = 4; // R2 worker cron runs at :02; client checks at :04

function getMsUntilNextUpdate(): number {
  const now = new Date();
  let minsToAdd = UPDATE_MINUTE - now.getMinutes();
  if (minsToAdd <= 0) minsToAdd += 60;
  return (
    minsToAdd * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds() + 2000
  );
}

function scheduleUpdate() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(async () => {
    await refreshAllPrices(undefined, { onlyIfChanged: true });
    scheduleUpdate();
  }, getMsUntilNextUpdate());
}

/**
 * Connects the merged league store and subscribes to the specified realms.
 * Can be called multiple times; realms that are already subscribed are ignored.
 */
export function registerPricingStores(
  leagues: Readable<League[]>,
  realms: Realm[] = [...ALL_REALMS],
): void {
  const newlyAdded: Realm[] = [];
  for (const r of realms) {
    if (ALL_REALMS.includes(r) && !subscribedRealms.has(r)) {
      subscribedRealms.add(r);
      newlyAdded.push(r);
    }
  }

  if (leaguesStore !== leagues) {
    leaguesStore = leagues;
    leaguesUnsubscribe?.();
    leaguesUnsubscribe = leagues.subscribe((list) => {
      if (list.length === 0) return;
      const raw = get(rawPrices);
      const missingRealms = Array.from(subscribedRealms).filter(
        (r) =>
          realmRemoteUpdated[r] === null &&
          Object.keys(raw[r]).length === 0 &&
          getValidLeagues(list, r).length > 0,
      );
      if (missingRealms.length > 0) {
        refreshAllPrices(list, { realms: missingRealms });
      }
    });
  }

  if (newlyAdded.length > 0) {
    const raw = get(rawPrices);
    const toFetchNow = newlyAdded.filter(
      (r) => realmRemoteUpdated[r] === null && Object.keys(raw[r]).length === 0,
    );
    if (toFetchNow.length > 0) {
      refreshAllPrices(undefined, { realms: toFetchNow });
    }
  }

  if (!schedulerInitialized) {
    schedulerInitialized = true;
    scheduleUpdate();
  }
}

// ---------------------------------------------------------------------------
// Global Currency Conversion Function & Preview Helper
// ---------------------------------------------------------------------------
export function convertCurrency(
  amount: number,
  currencyA: string,
  currencyB: string,
  leagueId: string,
  realm: Realm,
): number {
  if (!Number.isFinite(amount)) return -9;

  // Require that a JSON file was actually fetched from R2 for this league
  const rawLeague = get(rawPrices)[realm]?.[leagueId];
  if (!rawLeague) return -9;

  const keyA = currencyA.toLowerCase();
  const keyB = currencyB.toLowerCase();

  if (keyA === keyB) {
    return rawLeague.currencies.includes(keyA)
      ? Math.round(amount * 10) / 10
      : -9;
  }

  const userOverrides = get(priceOverrides)[realm]?.[leagueId];
  const hasOverride =
    userOverrides !== undefined &&
    (userOverrides[keyA] !== undefined || userOverrides[keyB] !== undefined);

  // 1. If the user has overridden either currency, compute using overrides + base rates
  if (hasOverride) {
    const leagueData = get(effectivePrices)[realm]?.[leagueId];
    if (!leagueData) return -9;

    const rateA = leagueData.rates[keyA];
    const rateB = leagueData.rates[keyB];

    if (
      typeof rateA !== "number" ||
      typeof rateB !== "number" ||
      rateA <= 0 ||
      rateB <= 0
    ) {
      return -9;
    }

    const rawConverted = (amount * rateA) / rateB;
    return Math.round(rawConverted * 10) / 10;
  }

  // 2. Otherwise, require an explicit pair entry (`direct` or `proxy`) in the R2 JSON
  const preferDirect = get(preferDirectExchange);
  const useTradedVol = get(tadedExchangeRatios);
  const mult = resolvePairMultiplier(
    rawLeague,
    keyA,
    keyB,
    preferDirect,
    useTradedVol,
    get(userRatios)[realm]?.[leagueId],
  );

  if (mult === null || !Number.isFinite(mult) || mult <= 0) {
    return -9;
  }

  return Math.round(amount * mult * 10) / 10;
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
