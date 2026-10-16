// src/lib/trade/utilis/tradePayload.ts
import { get } from "svelte/store";
import {
  filtersPoe,
  filtersPoe2,
  statsPoe,
  statsPoe2,
} from "$lib/trade/tradeStore";
import type { ItemEntry } from "$lib/types/baseItem";
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
 */
export function buildRegularPayload(
  fullPayload: any,
  realm: "poe" | "poe2" | string = "poe",
): any {
  const normalizedRealm = realm?.toLowerCase() === "poe2" ? "poe2" : "poe";
  const base = fullPayload ? JSON.parse(JSON.stringify(fullPayload)) : {};
  const baseQuery: any = { ...(base.query || {}) };

  if (!baseQuery.status) {
    baseQuery.status = { option: "securable" };
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
      fullToSearchGroupIndexMap.set(fullIdx, searchStats.length);
      const searchGrp: any = {
        type: gType,
        filters: activeFiltersList,
      };

      if (
        ["count", "weight", "weight2", "crucible", "mercenary"].includes(
          gType,
        ) &&
        g.value &&
        typeof g.value === "object"
      ) {
        const valObj: any = {};
        if (hasValidNumber(g.value.min)) valObj.min = Number(g.value.min);
        if (hasValidNumber(g.value.max)) valObj.max = Number(g.value.max);
        if (Object.keys(valObj).length > 0) {
          searchGrp.value = valObj;
        }
      }

      searchStats.push(searchGrp);
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

  if (selectedItem) {
    if (selectedItem.name) baseQuery.name = selectedItem.name;
    else delete baseQuery.name;

    if (selectedItem.disc) {
      baseQuery.type = {
        option: selectedItem.type,
        discriminator: selectedItem.disc,
      };
    } else {
      baseQuery.type = selectedItem.type;
    }
  } else {
    delete baseQuery.name;
    delete baseQuery.type;
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

  const full_payload = {
    ...base,
    query: {
      ...baseQuery,
      stats: fullStats,
      ...(Object.keys(fullFilters).length > 0 ? { filters: fullFilters } : {}),
    },
    sort: fullSortObj,
  };
  if (fullStats.length === 0) delete full_payload.query.stats;
  if (Object.keys(fullFilters).length === 0) delete full_payload.query.filters;

  const payload = buildRegularPayload(full_payload, realm);

  return { payload, full_payload };
}
