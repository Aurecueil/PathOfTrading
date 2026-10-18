// src/lib/trade/utilis/tradePayload.ts
import { get } from "svelte/store";
import {
  filtersPoe,
  filtersPoe2,
  statsPoe,
  statsPoe2,
  itemsPoe,
  itemsPoe2,
  currentLanguage,
} from "$lib/trade/tradeStore";
import type { ItemEntry, ItemCategory } from "$lib/types/baseItem";
import type { FilterGroup, FilterEntry } from "$lib/types/filters";
import type { StatGroup } from "$lib/types/stats";

export interface StatGroupPayloadState {
  id: string;
  type: string;
  collapsed?: boolean;
  disabled?: boolean;
  value?: { min?: any; max?: any };
  filters: Array<{
    id: string;
    statEntry?: any;
    groupLabel?: string;
    value?: any;
    disabled?: boolean;
  }>;
}

function extractStoreArray<T>(storeVal: any): T[] {
  if (!storeVal) return [];
  if (Array.isArray(storeVal)) return storeVal;
  if (Array.isArray(storeVal.result)) return storeVal.result;
  return [];
}

function hasValidOption(opt: any): boolean {
  return opt !== undefined && opt !== null && opt !== "" && opt !== "any";
}

function hasValidNumber(num: any): boolean {
  return num !== undefined && num !== null && num !== "" && !isNaN(Number(num));
}
export function isEmptyStatGroup(g: {
  filters?: any[];
  value?: { min?: any; max?: any };
}): boolean {
  const noFilters = !g.filters?.length;
  const noValue =
    !g.value || (!hasValidNumber(g.value.min) && !hasValidNumber(g.value.max));
  return noFilters && noValue;
}

export function trimTrailingEmptyGroup<
  T extends { filters?: any[]; value?: any },
>(groups: T[]): T[] {
  return groups.length && isEmptyStatGroup(groups[groups.length - 1])
    ? groups.slice(0, -1)
    : groups;
}
/* -------------------------------------------------------------------------- */
/* Item reference code: "<realm>:<language>:<index>"                          */
/*   realm    – realm the item was picked from ("poe" | "poe2")               */
/*   language – language of the catalog the item TEXT belongs to              */
/*   index    – relative position in that realm's flattened item array        */
/*              (same flatten order the filter drawer uses)                   */
/* Stored on full_payload.item_ref (top level, never sent to the trade API).  */
/* -------------------------------------------------------------------------- */

export interface ItemRef {
  realm: "poe" | "poe2";
  language: string;
  index: number;
}

export function formatItemRef(ref: ItemRef): string {
  return `${ref.realm}:${ref.language}:${ref.index}`;
}

export function parseItemRef(code: unknown): ItemRef | null {
  if (!code) return null;
  if (typeof code === "object") {
    const obj = code as Record<string, any>;
    const realm = normalizeRealm(obj.realm);
    const language = String(obj.language ?? "");
    const index = Number(obj.index);
    if (
      (obj.realm === "poe" || obj.realm === "poe2") &&
      Number.isInteger(index) &&
      index >= 0
    ) {
      return { realm, language, index };
    }
    return null;
  }
  if (typeof code !== "string") return null;
  const first = code.indexOf(":");
  const last = code.lastIndexOf(":");
  if (first <= 0 || last <= first) return null;
  const realm = code.slice(0, first);
  const language = code.slice(first + 1, last);
  const index = Number(code.slice(last + 1));
  if (realm !== "poe" && realm !== "poe2") return null;
  if (!Number.isInteger(index) || index < 0) return null;
  return { realm, language, index };
}

function normalizeRealm(realm: string | undefined | null): "poe" | "poe2" {
  return String(realm ?? "").toLowerCase() === "poe2" ? "poe2" : "poe";
}

/** NOTE: assumes `currentLanguage` is a Svelte store holding a string. */
export function getCurrentLanguage(): string {
  return String(get(currentLanguage) ?? "");
}

/** Flattened item entries of a realm, in the same order as the drawer's `allItemEntries`. */
export function getRealmItemEntries(realm: string): ItemEntry[] {
  const cats = extractStoreArray<ItemCategory>(
    normalizeRealm(realm) === "poe2" ? get(itemsPoe2) : get(itemsPoe),
  );
  return cats.flatMap((cat) => cat.entries || []);
}

export function findItemIndex(entries: ItemEntry[], item: ItemEntry): number {
  const direct = entries.indexOf(item);
  if (direct >= 0) return direct;
  return entries.findIndex(
    (e) =>
      e.name === item.name &&
      e.type === item.type &&
      (e.disc || undefined) === (item.disc || undefined),
  );
}

export function findEntryIndexByQuery(
  entries: ItemEntry[],
  query: any,
): number {
  const name = query?.name;
  const type = query?.type;
  const targetType = typeof type === "object" ? type?.option : type;
  const targetDisc = typeof type === "object" ? type?.discriminator : undefined;
  return entries.findIndex((e) => {
    const matchName = name ? e.name === name : !e.name;
    const matchType = e.type === targetType;
    const matchDisc = targetDisc ? e.disc === targetDisc : !e.disc;
    return matchName && matchType && matchDisc;
  });
}

function applyEntryToQuery(query: any, entry: ItemEntry) {
  if (entry.name) query.name = entry.name;
  else delete query.name;

  if (entry.disc) {
    query.type = { option: entry.type, discriminator: entry.disc };
  } else {
    query.type = entry.type;
  }
}

/** True when a catalog entry has exactly the item text currently stored in the query. */
function entryMatchesQueryText(entry: ItemEntry, query: any): boolean {
  const type = query?.type;
  const targetType = typeof type === "object" ? type?.option : type;
  return (
    (entry.name || undefined) === (query?.name || undefined) &&
    entry.type === targetType
  );
}

function clearItemFromQuery(query: any) {
  delete query.name;
  delete query.type;
}

/**
 * True when the item code saved on a full_payload was made for a different realm
 * than `realm`, or in a different language than the global `currentLanguage`.
 */
export function isItemRefStale(
  fullPayload: any,
  realm: string,
  language: string = getCurrentLanguage(),
): boolean {
  const ref = parseItemRef(fullPayload?.item_ref);
  if (!ref) return false;
  return ref.realm !== normalizeRealm(realm) || ref.language !== language;
}

/**
 * Re-resolves the item stored in a full_payload for a target realm + language.
 *
 *  - same realm, same language           -> ensure it exists in current catalog, else clear
 *  - same realm, different language      -> refetch entry by relative position (ref.index)
 *  - different realm, same language      -> match unique item by name, else clear
 *  - different realm, different language -> find item at ref.index in ref.realm's array;
 *                                           if unique, get its name and match by name in
 *                                           targetRealm's array, else clear
 *  - legacy payload without item_ref     -> attach a ref if found in current catalog, else clear
 *
 * Does nothing while required item catalogs are not loaded yet.
 *
 * `opts.catalogReady`: the caller knows the catalogs have been re-fetched for
 * `language`, so "entry text still equals the old text" no longer means
 * "catalog is stale" (it can simply be an item whose name is identical in
 * both languages). Skips the wait-for-catalog checks.
 */
export function migrateItemRef(
  fullPayload: any,
  realm: string,
  language: string = getCurrentLanguage(),
  opts: { catalogReady?: boolean } = {},
): { payload: any; changed: boolean } {
  const unchanged = { payload: fullPayload, changed: false };
  if (!fullPayload || typeof fullPayload !== "object") return unchanged;

  const targetRealm = normalizeRealm(realm);
  const entries = getRealmItemEntries(targetRealm);
  if (entries.length === 0) return unchanged;

  const ref = parseItemRef(fullPayload.item_ref);
  const hasItem = Boolean(fullPayload.query?.name || fullPayload.query?.type);
  if (!ref && !hasItem) return unchanged;

  const next = JSON.parse(JSON.stringify(fullPayload));
  next.query = next.query || {};

  // Legacy payload (saved before item_ref existed): verify in current catalog and attach ref, else clear.
  if (!ref) {
    const idx = findEntryIndexByQuery(entries, next.query);
    if (idx >= 0) {
      applyEntryToQuery(next.query, entries[idx]);
      next.item_ref = formatItemRef({
        realm: targetRealm,
        language,
        index: idx,
      });
    } else {
      clearItemFromQuery(next.query);
      delete next.item_ref;
    }
    return { payload: next, changed: true };
  }

  // 1. Same realm + same language: ensure item exists in current catalog, else clear.
  if (ref.realm === targetRealm && ref.language === language) {
    let idx = findEntryIndexByQuery(entries, next.query);

    // The ref says "current language" but the stored text isn't in the catalog.
    // That happens when the ref was stamped with a language before the catalog
    // (or the project) was actually switched, e.g. the language setting is applied
    // late after a reload. The index is still valid across languages, so adopt the
    // entry at that position if it is the same kind of item (named/unnamed, disc).
    if (idx < 0 && ref.index >= 0 && ref.index < entries.length) {
      const cand = entries[ref.index];
      const q = next.query;
      const qDisc =
        typeof q?.type === "object" ? q.type?.discriminator : undefined;
      if (
        cand &&
        Boolean(cand.name) === Boolean(q?.name) &&
        Boolean(cand.disc) === Boolean(qDisc)
      ) {
        idx = ref.index;
      }
    }

    if (idx >= 0) {
      const before = JSON.stringify([next.query?.name, next.query?.type]);
      applyEntryToQuery(next.query, entries[idx]);
      const after = JSON.stringify([next.query?.name, next.query?.type]);
      const expectedRef = formatItemRef({
        realm: targetRealm,
        language,
        index: idx,
      });
      if (next.item_ref !== expectedRef || before !== after) {
        next.item_ref = expectedRef;
        return { payload: next, changed: true };
      }
      return unchanged;
    }

    // Does not exist in current catalog -> clear
    clearItemFromQuery(next.query);
    delete next.item_ref;
    return { payload: next, changed: true };
  }

  let entry: ItemEntry | null = null;
  let index = -1;

  if (ref.realm === targetRealm && ref.language !== language) {
    // 2. Same realm, different language: take item with same index in array.
    index = ref.index;
    entry = index >= 0 && index < entries.length ? entries[index] : null;

    // `currentLanguage` flips BEFORE the item catalog is re-fetched. If the entry
    // at this position still has the old text, the catalog is still the old
    // language: do nothing now and retry once the new catalog is in the store.
    if (
      !opts.catalogReady &&
      entry &&
      entryMatchesQueryText(entry, next.query)
    ) {
      return unchanged;
    }
  } else if (ref.realm !== targetRealm && ref.language === language) {
    // 3. Different realm, same language: match by finding item with same name (uniques only), else clear.
    const name = next.query.name;
    if (name) {
      index = entries.findIndex(
        (e) => Boolean(e.flags?.unique) && e.name === name,
      );
      entry = index >= 0 ? entries[index] : null;
    }
  } else {
    // 4. Both language and realm are different:
    // Find in array matching ref.realm item index; if not unique clear field,
    // if unique, get name and in current realm try to match by that name, if can't, clear.
    const sourceEntries = getRealmItemEntries(ref.realm);
    if (sourceEntries.length === 0) return unchanged;

    const sourceItem =
      ref.index >= 0 && ref.index < sourceEntries.length
        ? sourceEntries[ref.index]
        : null;

    if (sourceItem && sourceItem.flags?.unique && sourceItem.name) {
      // If source catalog hasn't updated to the new language yet and matches old query text, wait
      if (!opts.catalogReady && entryMatchesQueryText(sourceItem, next.query)) {
        return unchanged;
      }

      index = entries.findIndex(
        (e) => Boolean(e.flags?.unique) && e.name === sourceItem.name,
      );
      entry = index >= 0 ? entries[index] : null;
    }
  }

  if (entry && index >= 0) {
    applyEntryToQuery(next.query, entry);
    next.item_ref = formatItemRef({ realm: targetRealm, language, index });
  } else {
    clearItemFromQuery(next.query);
    delete next.item_ref;
  }

  return { payload: next, changed: true };
}

/**
 * Builds a map of GroupID -> Map<FilterID, FilterDef> across a list of FilterGroups.
 * Avoids `.find()` collisions when PoE1 and PoE2 share group IDs like `misc_filters`.
 */
function buildFilterDefinitionsMap(
  groups: FilterGroup[],
): Map<string, Map<string, FilterEntry>> {
  const map = new Map<string, Map<string, FilterEntry>>();
  for (const g of groups) {
    if (!g || !g.id || g.id === "status_filters") continue;
    let fMap = map.get(g.id);
    if (!fMap) {
      fMap = new Map<string, FilterEntry>();
      map.set(g.id, fMap);
    }
    if (Array.isArray(g.filters)) {
      for (const f of g.filters) {
        if (f && f.id && !fMap.has(f.id)) {
          fMap.set(f.id, f);
        }
      }
    }
  }
  return map;
}

/**
 * Converts a saved `full_payload` and `realm` into an executable regular search `payload`.
 * Strips any disabled groups, disabled filters/stats, or entries not belonging to `realm`.
 * The item (name/type) is re-resolved for `realm` and dropped if it does not
 * exist in that realm's item catalog.
 */
export function buildRegularPayload(
  fullPayload: any,
  realm: "poe" | "poe2" | string = "poe",
): any {
  const normalizedRealm = normalizeRealm(realm);

  // Make sure the item matches the target realm / current language first.
  const resolved = migrateItemRef(fullPayload, normalizedRealm).payload;
  const base = resolved ? JSON.parse(JSON.stringify(resolved)) : {};
  delete base.item_ref; // internal only, never sent to the trade API

  const baseQuery: any = { ...(base.query || {}) };

  if (!baseQuery.status) {
    baseQuery.status = { option: "securable" };
  }

  // Ensure the item (name/type) exists in the current realm's catalog, otherwise clear it.
  if (baseQuery.name || baseQuery.type) {
    const realmItems = getRealmItemEntries(normalizedRealm);
    if (
      realmItems.length > 0 &&
      findEntryIndexByQuery(realmItems, baseQuery) < 0
    ) {
      clearItemFromQuery(baseQuery);
    }
  }

  const realmFilterGroups = extractStoreArray<FilterGroup>(
    normalizedRealm === "poe2" ? get(filtersPoe2) : get(filtersPoe),
  );
  const validRealmGroupFilterMap =
    realmFilterGroups.length > 0
      ? buildFilterDefinitionsMap(realmFilterGroups)
      : null;

  const realmStatCatalog = extractStoreArray<StatGroup>(
    normalizedRealm === "poe2" ? get(statsPoe2) : get(statsPoe),
  );
  const validRealmStatIds =
    realmStatCatalog.length > 0
      ? new Set(
          realmStatCatalog.flatMap((g) => (g.entries || []).map((e) => e.id)),
        )
      : null;

  // 1. Build active stats & track index mapping from full_payload stats -> regular payload stats
  const rawStats: any[] = Array.isArray(baseQuery.stats) ? baseQuery.stats : [];
  const searchStats: any[] = [];
  const fullToSearchGroupIndexMap = new Map<number, number>();

  const MERGEABLE = new Set(["and", "not", "if", "crucible", "mercenary"]);
  const mergedIndexByType = new Map<string, number>();

  for (let fullIdx = 0; fullIdx < rawStats.length; fullIdx++) {
    const g = rawStats[fullIdx];
    if (!g || typeof g !== "object") continue;

    const gType = g.type || "and";
    const isPoe2Restricted =
      normalizedRealm === "poe2" &&
      (gType === "crucible" || gType === "mercenary");
    const isGroupDisabled = Boolean(
      g.disabled || g.collapsed || isPoe2Restricted,
    );

    if (isGroupDisabled) continue;

    const rawFilters = Array.isArray(g.filters) ? g.filters : [];
    const activeFiltersList = rawFilters
      .filter((f: any) => {
        if (!f || !f.id || f.disabled) return false;
        if (validRealmStatIds && !validRealmStatIds.has(f.id)) return false;
        return true;
      })
      .map((f: any) => {
        const fil: any = { id: f.id };
        const fVal: any = {};
        if (hasValidOption(f.value?.option)) {
          const numOpt = Number(f.value.option);
          fVal.option = isNaN(numOpt) ? f.value.option : numOpt;
        }
        if (hasValidNumber(f.value?.min)) {
          fVal.min = Number(f.value.min);
        }
        if (hasValidNumber(f.value?.max)) {
          fVal.max = Number(f.value.max);
        }
        if (
          (gType === "weight" || gType === "weight2") &&
          hasValidNumber(f.value?.weight)
        ) {
          fVal.weight = Number(f.value.weight);
        }
        if (Object.keys(fVal).length > 0) {
          fil.value = fVal;
        }
        fil.disabled = false;
        return fil;
      });

    if (activeFiltersList.length > 0 || gType === "and") {
      // value only applies to these types
      let valObj: any = undefined;
      if (
        ["count", "weight", "weight2", "crucible", "mercenary"].includes(
          gType,
        ) &&
        g.value &&
        typeof g.value === "object"
      ) {
        const v: any = {};
        if (hasValidNumber(g.value.min)) v.min = Number(g.value.min);
        if (hasValidNumber(g.value.max)) v.max = Number(g.value.max);
        if (Object.keys(v).length > 0) valObj = v;
      }

      const existingIdx = MERGEABLE.has(gType)
        ? mergedIndexByType.get(gType)
        : undefined;

      if (existingIdx !== undefined) {
        // merge into the first group of this type
        const target = searchStats[existingIdx];
        target.filters.push(...activeFiltersList);
        if (valObj && !target.value) target.value = valObj;
        fullToSearchGroupIndexMap.set(fullIdx, existingIdx);
      } else {
        fullToSearchGroupIndexMap.set(fullIdx, searchStats.length);
        if (MERGEABLE.has(gType))
          mergedIndexByType.set(gType, searchStats.length);
        const searchGrp: any = { type: gType, filters: activeFiltersList };
        if (valObj) searchGrp.value = valObj;
        searchStats.push(searchGrp);
      }
    }
  }

  // 2. Build active filter groups (strip disabled groups, disabled filters, and non-realm filters)
  const rawFiltersObj =
    baseQuery.filters && typeof baseQuery.filters === "object"
      ? baseQuery.filters
      : {};
  const searchFilters: Record<string, any> = {};

  for (const [groupId, gData] of Object.entries(
    rawFiltersObj as Record<string, any>,
  )) {
    if (groupId === "status_filters") continue;
    if (!gData || typeof gData !== "object" || gData.disabled) continue;

    const validGroupFilters = validRealmGroupFilterMap?.get(groupId);
    if (validRealmGroupFilterMap && !validGroupFilters) continue;

    const rawGroupFilters =
      gData.filters && typeof gData.filters === "object" ? gData.filters : {};
    const activeGroupFilters: Record<string, any> = {};

    for (const [filterId, fObj] of Object.entries(
      rawGroupFilters as Record<string, any>,
    )) {
      if (!fObj || typeof fObj !== "object") continue;
      // Strip if explicitly disabled in full_payload
      if (fObj.disabled) continue;
      // Strip if this specific filter ID does not exist in the current realm's group
      if (validGroupFilters && !validGroupFilters.has(filterId)) continue;

      const cleanEntry: Record<string, any> = {};
      for (const [k, v] of Object.entries(fObj)) {
        if (k === "disabled") continue;
        if (v !== undefined && v !== null && v !== "") {
          cleanEntry[k] = v;
        }
      }

      if (Object.keys(cleanEntry).length > 0) {
        activeGroupFilters[filterId] = cleanEntry;
      }
    }

    if (Object.keys(activeGroupFilters).length > 0) {
      searchFilters[groupId] = {
        disabled: false,
        filters: activeGroupFilters,
      };
    }
  }

  // 3. Resolve sort object, remapping statgroup indices or falling back if stat isn't in realm
  let searchSortObj: Record<string, "asc" | "desc"> = { price: "asc" };
  if (base.sort && typeof base.sort === "object") {
    const [sField, sDir] = Object.entries(base.sort)[0] || [];
    if (sField) {
      const dir: "asc" | "desc" =
        String(sDir).toLowerCase() === "desc" ? "desc" : "asc";
      if (sField.startsWith("statgroup.")) {
        const fullIdx = parseInt(sField.replace("statgroup.", ""), 10);
        const searchIdx = fullToSearchGroupIndexMap.get(fullIdx);
        searchSortObj =
          searchIdx !== undefined
            ? { [`statgroup.${searchIdx}`]: dir }
            : { price: dir };
      } else if (sField.startsWith("stat.")) {
        const statId = sField.replace("stat.", "");
        const isStatValid = !validRealmStatIds || validRealmStatIds.has(statId);
        searchSortObj = isStatValid ? { [sField]: dir } : { price: dir };
      } else {
        searchSortObj = { [sField]: dir };
      }
    }
  }

  const payload: any = {
    ...base,
    query: {
      ...baseQuery,
      stats:
        searchStats.length > 0 ? searchStats : [{ type: "and", filters: [] }],
      ...(Object.keys(searchFilters).length > 0
        ? { filters: searchFilters }
        : {}),
    },
    sort: searchSortObj,
  };

  if (Object.keys(searchFilters).length === 0) {
    delete payload.query.filters;
  }

  return payload;
}

/**
 * Builds both `full_payload` (retaining ALL values across realms, marking collapsed or
 * out-of-realm items as `disabled: true`) and `payload` (stripped for the active search).
 *
 * `itemLanguage` is the language the selected item's TEXT is in (the language of the
 * catalog it was picked from). It can lag behind `currentLanguage` while the item
 * catalog is being re-fetched; stamping `currentLanguage` there would mislabel old text.
 */
export function buildPayloads(params: {
  initialPayload: any;
  statGroups: StatGroupPayloadState[];
  realm: "poe" | "poe2";
  statusOption: string;
  selectedItem: ItemEntry | null;
  filterValues: Record<string, Record<string, any>>;
  groupCollapsed: Record<string, boolean>;
  renderedFilterGroups: FilterGroup[];
  allKnownFilterGroups: FilterGroup[];
  sortKey: string;
  sortDirection: "asc" | "desc";
  itemLanguage?: string;
  /** Ref currently held by the form; kept when the item can't be resolved in the loaded catalog. */
  itemRef?: string | null;
}): { payload: any; full_payload: any } {
  const {
    initialPayload,
    statGroups,
    realm,
    statusOption,
    selectedItem,
    filterValues,
    groupCollapsed,
    renderedFilterGroups,
    allKnownFilterGroups,
    sortKey,
    sortDirection,
    itemLanguage,
    itemRef,
  } = params;

  const base = initialPayload ? JSON.parse(JSON.stringify(initialPayload)) : {};

  const realmStatCatalog = extractStoreArray<StatGroup>(
    realm === "poe2" ? get(statsPoe2) : get(statsPoe),
  );
  const validRealmStatIds =
    realmStatCatalog.length > 0
      ? new Set(
          realmStatCatalog.flatMap((g) => (g.entries || []).map((e) => e.id)),
        )
      : null;

  // 1. Build fullStats (keep all groups & filters, disable collapsed or out-of-realm)
  const fullStats: any[] = [];
  const fullGroupIndexMap = new Map<string, number>();

  for (const g of statGroups) {
    const isPoe2Restricted =
      realm === "poe2" && (g.type === "crucible" || g.type === "mercenary");
    const isGroupDisabled = Boolean(
      g.collapsed || g.disabled || isPoe2Restricted,
    );

    const valObj: any = {};
    if (
      ["count", "weight", "weight2", "crucible", "mercenary"].includes(
        g.type,
      ) &&
      g.value
    ) {
      if (hasValidNumber(g.value.min)) valObj.min = Number(g.value.min);
      if (hasValidNumber(g.value.max)) valObj.max = Number(g.value.max);
    }

    const fullFiltersList = g.filters.map((f) => {
      const fil: any = { id: f.id };
      const fVal: any = {};
      if (hasValidOption(f.value?.option)) {
        const numOpt = Number(f.value.option);
        fVal.option = isNaN(numOpt) ? f.value.option : numOpt;
      }
      if (hasValidNumber(f.value?.min)) fVal.min = Number(f.value.min);
      if (hasValidNumber(f.value?.max)) fVal.max = Number(f.value.max);
      if (
        (g.type === "weight" || g.type === "weight2") &&
        hasValidNumber(f.value?.weight)
      ) {
        fVal.weight = Number(f.value.weight);
      }
      fil.value = fVal;

      const isOutOfRealm = Boolean(
        validRealmStatIds && !validRealmStatIds.has(f.id),
      );
      fil.disabled = Boolean(f.disabled || isOutOfRealm);
      return fil;
    });

    fullGroupIndexMap.set(g.id, fullStats.length);
    const fullGrp: any = {
      type: g.type,
      collapsed: Boolean(g.collapsed),
      disabled: isGroupDisabled,
      filters: fullFiltersList,
    };
    if (Object.keys(valObj).length > 0) fullGrp.value = valObj;
    fullStats.push(fullGrp);
  }

  const baseQuery: any = { ...(base.query || {}) };
  if (statusOption) baseQuery.status = { option: statusOption };

  // Unique item code: realm + language + relative position in the realm's item array
  let itemRefCode: string | null = null;
  const realmEntries = getRealmItemEntries(realm);
  if (selectedItem) {
    const idx = findItemIndex(realmEntries, selectedItem);
    if (idx >= 0) {
      const matchedEntry = realmEntries[idx];
      applyEntryToQuery(baseQuery, matchedEntry);
      itemRefCode = formatItemRef({
        realm,
        language: itemLanguage ?? getCurrentLanguage(),
        index: idx,
      });
    } else {
      // Not resolvable in the loaded catalog (catalog empty, still the old language,
      // or already the new language while selectedItem is the old-language object).
      // Do NOT clear: keep the text and the existing ref so migrateItemRef can
      // re-resolve it by index once the catalog/language settle.
      applyEntryToQuery(baseQuery, selectedItem);
      const keep = itemRef ?? base.item_ref;
      if (keep) itemRefCode = keep;
    }
  } else {
    clearItemFromQuery(baseQuery);
  }

  // 2. Build fullFilters (merge PoE1 + PoE2 filter definitions properly)
  const currentRealmMap = buildFilterDefinitionsMap(renderedFilterGroups);
  const allKnownMap = buildFilterDefinitionsMap(allKnownFilterGroups);

  const allGroupIds = new Set<string>([
    ...Object.keys(filterValues),
    ...Array.from(allKnownMap.keys()),
    ...(initialPayload?.query?.filters
      ? Object.keys(initialPayload.query.filters)
      : []),
  ]);

  const fullFilters: Record<string, any> = {};

  for (const groupId of allGroupIds) {
    if (groupId === "status_filters") continue;

    const currentRealmGroupFilters = currentRealmMap.get(groupId);
    const isGroupInCurrentRealm = Boolean(currentRealmGroupFilters);
    const isCollapsed = Boolean(groupCollapsed[groupId]);
    const isGroupDisabled = !isGroupInCurrentRealm || isCollapsed;

    const groupState = filterValues[groupId] || {};
    const initialGroupFilters =
      initialPayload?.query?.filters?.[groupId]?.filters || {};
    const knownGroupFilters = allKnownMap.get(groupId);

    const allFilterIdsInGroup = new Set<string>([
      ...Object.keys(initialGroupFilters),
      ...Object.keys(groupState),
      ...(knownGroupFilters ? Array.from(knownGroupFilters.keys()) : []),
    ]);

    const groupFiltersPayload: Record<string, any> = {};

    for (const filterId of allFilterIdsInGroup) {
      const fDef =
        currentRealmGroupFilters?.get(filterId) ??
        knownGroupFilters?.get(filterId);
      const isFilterInCurrentRealm = Boolean(
        currentRealmGroupFilters?.has(filterId),
      );

      // Prefer user state in `filterValues` if any key exists; otherwise fall back to `initialGroupFilters`
      const stateVal = groupState[filterId];
      const hasStateKeys =
        stateVal &&
        typeof stateVal === "object" &&
        Object.keys(stateVal).length > 0;
      const rawSource = hasStateKeys
        ? stateVal
        : isFilterInCurrentRealm && stateVal !== undefined
          ? stateVal
          : initialGroupFilters[filterId];

      if (!rawSource || typeof rawSource !== "object") continue;

      const entryPayload: Record<string, any> = {};

      if (fDef) {
        if (fDef.option && hasValidOption(rawSource.option)) {
          entryPayload.option = String(rawSource.option);
        }
        if (
          fDef.input &&
          typeof rawSource.input === "string" &&
          rawSource.input.trim() !== ""
        ) {
          entryPayload.input = rawSource.input.trim();
        }
        if (fDef.minMax) {
          if (hasValidNumber(rawSource.min)) {
            entryPayload.min = Number(rawSource.min);
          }
          if (hasValidNumber(rawSource.max)) {
            entryPayload.max = Number(rawSource.max);
          }
        }
        if (fDef.sockets) {
          for (const s of ["r", "g", "b", "w"] as const) {
            if (hasValidNumber(rawSource[s])) {
              entryPayload[s] = Number(rawSource[s]);
            }
          }
        }
      } else {
        // Catalogs haven't loaded yet or unknown filter: preserve existing values verbatim
        for (const [k, v] of Object.entries(rawSource)) {
          if (k === "disabled") continue;
          if (v !== undefined && v !== null && v !== "") {
            entryPayload[k] = v;
          }
        }
      }

      if (Object.keys(entryPayload).length > 0) {
        if (!isFilterInCurrentRealm) {
          entryPayload.disabled = true;
        }
        groupFiltersPayload[filterId] = entryPayload;
      }
    }

    const hasFilterValues = Object.keys(groupFiltersPayload).length > 0;
    if (hasFilterValues || (isGroupInCurrentRealm && !isCollapsed)) {
      fullFilters[groupId] = {
        disabled: isGroupDisabled,
        filters: groupFiltersPayload,
      };
    }
  }

  // 3. Resolve Sort
  let fullSortObj: Record<string, "asc" | "desc"> = {};

  if (sortKey.startsWith("group:")) {
    const gId = sortKey.replace("group:", "");
    const fullIdx = fullGroupIndexMap.get(gId);

    fullSortObj =
      fullIdx !== undefined
        ? { [`statgroup.${fullIdx}`]: sortDirection }
        : { price: sortDirection };
  } else if (sortKey.startsWith("stat:")) {
    const sId = sortKey.replace("stat:", "");
    fullSortObj = { [`stat.${sId}`]: sortDirection };
  } else if (sortKey.startsWith("filter:")) {
    const fId = sortKey.replace("filter:", "");
    fullSortObj = { [fId]: sortDirection };
  } else {
    fullSortObj = { price: sortDirection };
  }

  const full_payload: any = {
    ...base,
    query: {
      ...baseQuery,
      stats: fullStats,
      ...(Object.keys(fullFilters).length > 0 ? { filters: fullFilters } : {}),
    },
    sort: fullSortObj,
  };
  if (itemRefCode) full_payload.item_ref = itemRefCode;
  else delete full_payload.item_ref;

  if (fullStats.length === 0) delete full_payload.query.stats;
  if (Object.keys(fullFilters).length === 0) delete full_payload.query.filters;

  const payload = buildRegularPayload(full_payload, realm);

  return { payload, full_payload };
}
