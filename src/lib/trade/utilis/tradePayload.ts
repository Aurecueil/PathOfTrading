// src/lib/trade/utilis/tradePayload.ts
import { get } from "svelte/store";
import {
  filtersPoe,
  filtersPoe2,
  statsPoe,
  statsPoe2,
} from "$lib/trade/tradeStore";
import type { ItemEntry } from "$lib/types/baseItem";
import type { FilterGroup } from "$lib/types/filters";
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

/**
 * Converts a saved `full_payload` and `realm` into an executable regular search `payload`.
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
  const validRealmGroupIds =
    realmFilterGroups.length > 0
      ? new Set(
          realmFilterGroups
            .filter((g) => g.id !== "status_filters")
            .map((g) => g.id),
        )
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

  // Build active stats & track index mapping from full_payload stats -> regular payload stats
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
    const isGroupDisabled = Boolean(g.disabled || isPoe2Restricted);

    if (!isGroupDisabled) {
      const rawFilters = Array.isArray(g.filters) ? g.filters : [];
      const activeFiltersList = rawFilters
        .filter((f: any) => {
          if (!f || f.disabled) return false;
          if (validRealmStatIds && !validRealmStatIds.has(f.id)) return false;
          return true;
        })
        .map((f: any) => {
          const fil: any = { id: f.id };
          const fVal: any = {};
          if (
            f.value?.option !== undefined &&
            f.value?.option !== null &&
            f.value?.option !== ""
          ) {
            fVal.option = Number(f.value.option);
          }
          if (f.value?.min !== undefined && f.value?.min !== "") {
            fVal.min = Number(f.value.min);
          }
          if (f.value?.max !== undefined && f.value?.max !== "") {
            fVal.max = Number(f.value.max);
          }
          if (
            (gType === "weight" || gType === "weight2") &&
            f.value?.weight !== undefined &&
            f.value?.weight !== ""
          ) {
            fVal.weight = Number(f.value.weight);
          }
          fil.value = fVal;
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
          if (g.value.min !== undefined && g.value.min !== "") {
            valObj.min = Number(g.value.min);
          }
          if (g.value.max !== undefined && g.value.max !== "") {
            valObj.max = Number(g.value.max);
          }
          if (Object.keys(valObj).length > 0) {
            searchGrp.value = valObj;
          }
        }

        searchStats.push(searchGrp);
      }
    }
  }

  // Build active filter groups
  const rawFiltersObj =
    baseQuery.filters && typeof baseQuery.filters === "object"
      ? baseQuery.filters
      : {};
  const searchFilters: Record<string, any> = {};

  for (const [groupId, gData] of Object.entries(
    rawFiltersObj as Record<string, any>,
  )) {
    if (groupId === "status_filters") continue;
    if (validRealmGroupIds && !validRealmGroupIds.has(groupId)) continue;
    if (!gData || typeof gData !== "object" || gData.disabled) continue;

    const groupFiltersPayload =
      gData.filters && typeof gData.filters === "object" ? gData.filters : {};
    if (Object.keys(groupFiltersPayload).length > 0) {
      searchFilters[groupId] = {
        disabled: false,
        filters: groupFiltersPayload,
      };
    }
  }

  // Resolve sort object, remapping statgroup indices if needed
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
  const fullStats: any[] = [];
  const fullGroupIndexMap = new Map<string, number>();

  for (const g of statGroups) {
    const isPoe2Restricted =
      realm === "poe2" && (g.type === "crucible" || g.type === "mercenary");
    const isGroupDisabled = Boolean(g.collapsed || isPoe2Restricted);

    const valObj: any = {};
    if (
      ["count", "weight", "weight2", "crucible", "mercenary"].includes(
        g.type,
      ) &&
      g.value
    ) {
      if (g.value.min !== undefined && g.value.min !== "")
        valObj.min = Number(g.value.min);
      if (g.value.max !== undefined && g.value.max !== "")
        valObj.max = Number(g.value.max);
    }

    const fullFiltersList = g.filters.map((f) => {
      const fil: any = { id: f.id };
      const fVal: any = {};
      if (
        f.value?.option !== undefined &&
        f.value?.option !== null &&
        f.value?.option !== ""
      ) {
        fVal.option = Number(f.value.option);
      }
      if (f.value?.min !== undefined && f.value?.min !== "")
        fVal.min = Number(f.value.min);
      if (f.value?.max !== undefined && f.value?.max !== "")
        fVal.max = Number(f.value.max);
      if (
        (g.type === "weight" || g.type === "weight2") &&
        f.value?.weight !== undefined &&
        f.value?.weight !== ""
      ) {
        fVal.weight = Number(f.value.weight);
      }
      fil.value = fVal;
      fil.disabled = Boolean(f.disabled);
      return fil;
    });

    fullGroupIndexMap.set(g.id, fullStats.length);
    const fullGrp: any = {
      type: g.type,
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

  const currentRealmGroupIds = new Set(renderedFilterGroups.map((g) => g.id));
  const allGroupIds = new Set<string>([
    ...Object.keys(filterValues),
    ...(initialPayload?.query?.filters
      ? Object.keys(initialPayload.query.filters)
      : []),
  ]);

  const fullFilters: Record<string, any> = {};

  for (const groupId of allGroupIds) {
    if (groupId === "status_filters") continue;

    const isCurrentRealm = currentRealmGroupIds.has(groupId);
    const isExpanded = !groupCollapsed[groupId];
    const isVisibleRightNow = isCurrentRealm && isExpanded;
    const groupState = filterValues[groupId] || {};
    const groupFiltersPayload: Record<string, any> = {};

    if (initialPayload?.query?.filters?.[groupId]?.filters) {
      Object.assign(
        groupFiltersPayload,
        JSON.parse(
          JSON.stringify(initialPayload.query.filters[groupId].filters),
        ),
      );
    }

    const groupDef = allKnownFilterGroups.find((g) => g.id === groupId);
    if (groupDef && Array.isArray(groupDef.filters)) {
      for (const fDef of groupDef.filters) {
        const val = groupState[fDef.id];
        if (!val) {
          delete groupFiltersPayload[fDef.id];
          continue;
        }

        const entryPayload: Record<string, any> = {};
        if (
          fDef.option &&
          val.option !== undefined &&
          val.option !== null &&
          val.option !== ""
        ) {
          entryPayload.option = val.option;
        }
        if (
          fDef.input &&
          typeof val.input === "string" &&
          val.input.trim() !== ""
        ) {
          entryPayload.input = val.input.trim();
        }
        if (fDef.minMax) {
          if (
            val.min !== undefined &&
            val.min !== "" &&
            !isNaN(Number(val.min))
          ) {
            entryPayload.min = Number(val.min);
          }
          if (
            val.max !== undefined &&
            val.max !== "" &&
            !isNaN(Number(val.max))
          ) {
            entryPayload.max = Number(val.max);
          }
        }
        if (fDef.sockets) {
          for (const s of ["r", "g", "b", "w"] as const) {
            if (
              val[s] !== undefined &&
              val[s] !== "" &&
              !isNaN(Number(val[s]))
            ) {
              entryPayload[s] = Number(val[s]);
            }
          }
        }
        if (Object.keys(entryPayload).length > 0) {
          groupFiltersPayload[fDef.id] = entryPayload;
        } else {
          delete groupFiltersPayload[fDef.id];
        }
      }
    }

    const hasFilterValues = Object.keys(groupFiltersPayload).length > 0;
    if (hasFilterValues || isVisibleRightNow) {
      fullFilters[groupId] = {
        disabled: !isVisibleRightNow,
        filters: groupFiltersPayload,
      };
    }
  }

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
