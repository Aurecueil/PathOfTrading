import type { ItemEntry } from "$lib/types/items";
import type { FilterGroup } from "$lib/types/filters";

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
  const searchStats: any[] = [];
  const fullStats: any[] = [];
  const fullGroupIndexMap = new Map<string, number>();
  const searchGroupIndexMap = new Map<string, number>();

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

    if (!isGroupDisabled) {
      const activeFiltersList = fullFiltersList.filter((f) => !f.disabled);
      if (activeFiltersList.length > 0 || g.type === "and") {
        searchGroupIndexMap.set(g.id, searchStats.length);
        const searchGrp: any = { type: g.type, filters: activeFiltersList };
        if (Object.keys(valObj).length > 0) searchGrp.value = valObj;
        searchStats.push(searchGrp);
      }
    }
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
  const searchFilters: Record<string, any> = {};

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
        if (!val) continue;

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
    if (isVisibleRightNow && hasFilterValues) {
      searchFilters[groupId] = {
        disabled: false,
        filters: groupFiltersPayload,
      };
    }
  }

  // Build the sort definition based on sortKey
  let fullSortObj: Record<string, "asc" | "desc"> = {};
  let searchSortObj: Record<string, "asc" | "desc"> = {};

  if (sortKey.startsWith("group:")) {
    const gId = sortKey.replace("group:", "");
    const fullIdx = fullGroupIndexMap.get(gId);
    const searchIdx = searchGroupIndexMap.get(gId);

    fullSortObj =
      fullIdx !== undefined
        ? { [`statgroup.${fullIdx}`]: sortDirection }
        : { price: sortDirection };

    searchSortObj =
      searchIdx !== undefined
        ? { [`statgroup.${searchIdx}`]: sortDirection }
        : { price: sortDirection };
  } else if (sortKey.startsWith("stat:")) {
    const sId = sortKey.replace("stat:", "");
    fullSortObj = { [`stat.${sId}`]: sortDirection };
    searchSortObj = { [`stat.${sId}`]: sortDirection };
  } else if (sortKey.startsWith("filter:")) {
    const fId = sortKey.replace("filter:", "");
    fullSortObj = { [fId]: sortDirection };
    searchSortObj = { [fId]: sortDirection };
  } else {
    fullSortObj = { price: sortDirection };
    searchSortObj = { price: sortDirection };
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

  const payload = {
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
  if (Object.keys(searchFilters).length === 0) delete payload.query.filters;

  return { payload, full_payload };
}
