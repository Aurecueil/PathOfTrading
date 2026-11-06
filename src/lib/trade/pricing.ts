// src/lib/trade/pricing.ts
import { writable, get, derived, type Readable } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
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
 * [have, want, via, ts, buyH, buyW, sellH, sellW, volH, volW]
 * `via` is always -1 in current files (direct rows only).
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

// Store references injected from tradeStore.ts to avoid circular imports
let leaguesStore: Readable<League[]> | null = null;
let leaguesUnsubscribe: (() => void) | null = null;

// Tracks subscribed realms, in-flight requests, and the `updated` unix timestamp of each realm's current.json
const subscribedRealms = new Set<Realm>();
const fetchingRealms = new Set<Realm>();
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
 * exist in either map.
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
// Proxy trade computation (client-side)
// ---------------------------------------------------------------------------
const DEFAULT_PROXY_CANDIDATES = ["chaos", "divine", "exalted"];
const RUTHLESS_PROXY_CANDIDATES = ["chaos", "divine", "exalted", "alch"];
/** Maximum age (1 day, in seconds) for a direct quote to be considered fresh */
const MAX_DIRECT_AGE = 86400;

type Quote = Pick<ExchangeRateEntry, "buy" | "sell" | "vol" | "timestamp">;

const flipHW = (p: HWPair): HWPair => ({ h: p.w, w: p.h });
const mulHW = (a: HWPair, b: HWPair): HWPair => ({
  h: a.h * b.h,
  w: a.w * b.w,
});
const quoteScore = (q: Quote): number => q.vol.h + q.vol.w;

function isStaleQuote(q: Quote, nowTs: number): boolean {
  return q.timestamp !== undefined && nowTs - q.timestamp > MAX_DIRECT_AGE;
}

/** Direct quote oriented from `have` -> `want` (either alphabetical order). */
function orientQuote(
  direct: ExchangePairMap,
  have: string,
  want: string,
): Quote | undefined {
  const flipped = have > want;
  const e = direct[flipped ? `${want}/${have}` : `${have}/${want}`];
  if (!e) return undefined;
  if (!flipped) return e;
  return {
    buy: flipHW(e.sell),
    sell: flipHW(e.buy),
    vol: flipHW(e.vol),
    timestamp: e.timestamp,
  };
}

/** (larger - smaller) >= 30% of smaller AND larger > smaller + 1 */
function hasBigDiff(a: number, b: number): boolean {
  const smaller = Math.min(a, b);
  const larger = Math.max(a, b);
  return (larger - smaller) * 10 >= smaller * 3 && larger - smaller > 1;
}

/**
 * A proxy is wanted when:
 * 1. there is no direct trade
 * 2. the direct trade is older than 1 day
 * 3. buy and sell ratios differ a lot
 * 4. the avg of buy/sell ratios differs a lot from the traded-volume ratio
 */
function needsProxy(direct: Quote | undefined, nowTs: number): boolean {
  if (!direct || quoteScore(direct) <= 0) return true;
  if (isStaleQuote(direct, nowTs)) return true;

  const useHW = direct.vol.h > direct.vol.w;
  const ratio = (r: HWPair) => (useHW ? r.h / r.w : r.w / r.h);

  const buyR = ratio(direct.buy);
  const sellR = ratio(direct.sell);
  const volR = ratio(direct.vol);

  if (hasBigDiff(buyR, sellR)) return true;
  return hasBigDiff((buyR + sellR) / 2, volR);
}

function computeProxies(
  direct: ExchangePairMap,
  currencies: string[],
  leagueId: string,
  nowTs: number,
): ExchangePairMap {
  const proxy: ExchangePairMap = {};
  const candidates = leagueId.toLowerCase().includes("ruthless")
    ? RUTHLESS_PROXY_CANDIDATES
    : DEFAULT_PROXY_CANDIDATES;
  const sorted = [...currencies].sort();

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const have = sorted[i];
      const want = sorted[j];
      const key = `${have}/${want}`;
      const d = direct[key];
      if (!needsProxy(d, nowTs)) continue;

      // Best route by combined volume, using only fresh direct legs
      let best:
        | { via: string; l1: Quote; l2: Quote; score: number }
        | undefined;
      for (const via of candidates) {
        if (via === have || via === want || !currencies.includes(via)) continue;
        const l1 = orientQuote(direct, have, via);
        const l2 = orientQuote(direct, via, want);
        if (!l1 || !l2) continue;
        if (quoteScore(l1) <= 0 || quoteScore(l2) <= 0) continue;
        if (isStaleQuote(l1, nowTs) || isStaleQuote(l2, nowTs)) continue;

        const score = quoteScore(l1) + quoteScore(l2);
        if (!best || score > best.score) best = { via, l1, l2, score };
      }
      if (!best) continue;

      // A fresh direct trade is only replaced if the proxy has more volume
      if (d && !isStaleQuote(d, nowTs) && best.score <= quoteScore(d)) continue;

      proxy[key] = {
        have,
        want,
        type: "proxy",
        via: best.via,
        buy: mulHW(best.l1.buy, best.l2.buy),
        sell: mulHW(best.l1.sell, best.l2.sell),
        vol: mulHW(best.l1.vol, best.l2.vol),
        timestamp: Math.min(
          best.l1.timestamp ?? nowTs,
          best.l2.timestamp ?? nowTs,
        ),
      };
    }
  }
  return proxy;
}

// ---------------------------------------------------------------------------
// R2 Parsing, Rust-Backed Fetching & Minute-Aligned Scheduler
// ---------------------------------------------------------------------------
function parseR2League(
  raw: R2LeagueData,
  leagueId: string,
): LeagueExchangeMaps | null {
  if (!raw || !Array.isArray(raw.c) || !Array.isArray(raw.r)) return null;

  const direct: ExchangePairMap = {};
  const currencies = raw.c.map((c) => c.toLowerCase());

  for (const row of raw.r) {
    if (!Array.isArray(row) || row.length < 10) continue;
    const [hi, wi, viaIdx, ts, buyH, buyW, sellH, sellW, volH, volW] = row;
    if (viaIdx >= 0) continue; // legacy proxy rows: always recomputed below

    const haveRaw = currencies[hi];
    const wantRaw = currencies[wi];
    if (!haveRaw || !wantRaw) continue;

    const flipped = haveRaw > wantRaw;
    const have = flipped ? wantRaw : haveRaw;
    const want = flipped ? haveRaw : wantRaw;

    direct[`${have}/${want}`] = {
      have,
      want,
      type: "direct",
      buy: flipped ? { h: sellW, w: sellH } : { h: buyH, w: buyW },
      sell: flipped ? { h: buyW, w: buyH } : { h: sellH, w: sellW },
      vol: flipped ? { h: volW, w: volH } : { h: volH, w: volW },
      timestamp: ts,
    };
  }

  const timestamp =
    typeof raw.t === "number" ? raw.t : Math.floor(Date.now() / 1000);
  const sortedCurrencies = Array.from(new Set(currencies)).sort();

  return {
    timestamp,
    currencies: sortedCurrencies,
    direct,
    proxy: computeProxies(direct, sortedCurrencies, leagueId, timestamp),
  };
}

function parseR2GameFile(
  file: R2GameFile,
): Record<string, LeagueExchangeMaps> | null {
  if (!file || typeof file.leagues !== "object" || !file.leagues) return null;
  const out: Record<string, LeagueExchangeMaps> = {};
  for (const [leagueId, leagueData] of Object.entries(file.leagues)) {
    const parsed = parseR2League(leagueData, leagueId);
    if (parsed) out[leagueId] = parsed;
  }
  return out;
}

/**
 * Calls the Rust backend to pull raw `index.json` text and parses it in the frontend.
 */
async function fetchIndexFile(): Promise<R2IndexFile | null> {
  try {
    const rawJson = await invoke<string>("fetch_pricing_index");
    return JSON.parse(rawJson) as R2IndexFile;
  } catch (err) {
    console.warn("[Pricing] Failed to fetch index.json via Rust:", err);
    return null;
  }
}

/**
 * Calls the Rust backend to pull raw `{realm}/current.json` text and parses it in the frontend.
 */
async function fetchRealmCurrentFile(realm: Realm): Promise<R2GameFile | null> {
  try {
    const rawJson = await invoke<string>("fetch_realm_pricing", { realm });
    return JSON.parse(rawJson) as R2GameFile;
  } catch (err) {
    console.warn(
      `[Pricing] Failed to fetch ${realm}/current.json via Rust:`,
      err,
    );
    return null;
  }
}

function isRealmAlreadyFetched(realm: Realm): boolean {
  return (
    realmRemoteUpdated[realm] !== null ||
    Object.keys(get(rawPrices)[realm] || {}).length > 0
  );
}

let refreshInFlight: Promise<void> | null = null;

/**
 * Subscribes passed-down realms and fetches `current.json` from Rust/R2.
 * - Avoids redundant fetches: if a realm has already been fetched (or is currently being fetched),
 *   it is skipped unless `onlyIfChanged` (cron job) detects a newer timestamp or `force` is true.
 */
export function refreshAllPrices(
  _overrideLeagues?: League[],
  options?: { realms?: Realm[]; onlyIfChanged?: boolean; force?: boolean },
): Promise<void> {
  // Subscribe only passed-down realms if provided
  if (options?.realms) {
    for (const r of options.realms) {
      if (ALL_REALMS.includes(r)) {
        subscribedRealms.add(r);
      }
    }
  }

  const requestedRealms = options?.realms
    ? options.realms.filter((r) => subscribedRealms.has(r))
    : Array.from(subscribedRealms);

  if (requestedRealms.length === 0) return Promise.resolve();

  const run = async () => {
    isRefreshingPrices.set(true);
    try {
      // Filter out any realms that are currently mid-fetch
      const candidates = requestedRealms.filter((r) => !fetchingRealms.has(r));
      if (candidates.length === 0) return;

      let realmsToFetch: Realm[] = [];

      if (options?.onlyIfChanged) {
        // Cron path: check index.json and only fetch if never fetched or remote timestamp changed
        const index = await fetchIndexFile();
        if (index?.games) {
          realmsToFetch = candidates.filter((realm) => {
            const remoteUpdated = index.games[realm]?.current?.updated;
            const localUpdated = realmRemoteUpdated[realm];
            return (
              localUpdated === null ||
              typeof remoteUpdated !== "number" ||
              remoteUpdated !== localUpdated
            );
          });
        } else {
          // If index.json failed, only attempt realms that have never been fetched
          realmsToFetch = candidates.filter((r) => !isRealmAlreadyFetched(r));
        }
      } else if (options?.force) {
        realmsToFetch = [...candidates];
      } else {
        // Standard path: only fetch realms that haven't been fetched yet
        realmsToFetch = candidates.filter((r) => !isRealmAlreadyFetched(r));
      }

      if (realmsToFetch.length === 0) return;

      for (const r of realmsToFetch) fetchingRealms.add(r);

      try {
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
        for (const r of realmsToFetch) fetchingRealms.delete(r);
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
 * Connects the merged league store and subscribes to the specified realms via `refreshAllPrices`.
 * Can be called multiple times; realms that were already fetched will not be re-fetched.
 */
export function registerPricingStores(
  leagues: Readable<League[]>,
  realms: Realm[] = [...ALL_REALMS],
): void {
  const validRealms = realms.filter((r) => ALL_REALMS.includes(r));

  if (validRealms.length > 0) {
    refreshAllPrices(undefined, { realms: validRealms });
  }

  if (leaguesStore !== leagues) {
    leaguesStore = leagues;
    leaguesUnsubscribe?.();
    leaguesUnsubscribe = leagues.subscribe((list) => {
      if (list.length === 0) return;
      const missingRealms = Array.from(subscribedRealms).filter(
        (r) =>
          !isRealmAlreadyFetched(r) &&
          !fetchingRealms.has(r) &&
          getValidLeagues(list, r).length > 0,
      );
      if (missingRealms.length > 0) {
        refreshAllPrices(list, { realms: missingRealms });
      }
    });
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

  // 2. Otherwise, require an explicit pair entry (`direct` or computed `proxy`)
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
