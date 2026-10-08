import { writable } from "svelte/store";
import { invoke } from "@tauri-apps/api/core"; // For Tauri v2 (`@tauri-apps/api/tauri` in v1)
import type { ItemCategory, ItemDataResponse } from "$lib/types/items";
import type { FilterGroup, FilterDataResponse } from "$lib/types/filters";

export const itemsPoe = writable<ItemCategory[]>([]);
export const itemsPoe2 = writable<ItemCategory[]>([]);
export const filtersPoe = writable<FilterGroup[]>([]);
export const filtersPoe2 = writable<FilterGroup[]>([]);
export const isLoading = writable<boolean>(false);
export const loadError = writable<string | null>(null);

export async function initItemData(): Promise<void> {
  isLoading.set(true);
  loadError.set(null);

  try {
    const [poeItems, poe2Items, poeFilters, poe2Filters] =
      await Promise.allSettled([
        invoke<ItemDataResponse>("load_item_data", { realm: "poe" }),
        invoke<ItemDataResponse>("load_item_data", { realm: "poe2" }),
        invoke<FilterDataResponse>("load_filters_data", { realm: "poe" }),
        invoke<FilterDataResponse>("load_filters_data", { realm: "poe2" }),
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

    if (errors.length > 0) {
      loadError.set(errors.join(" | "));
    }
  } catch (err) {
    loadError.set(typeof err === "string" ? err : "Failed to load static data");
  } finally {
    isLoading.set(false);
  }
}
