import { writable, get } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

export type PresetGame = "any" | "poe" | "poe2";

export interface PresetStat {
  id: string;
  text: string;
  value: Record<string, any>;
}
export interface PresetStatGroup {
  id: string;
  type: string;
  value?: { min?: any; max?: any };
  filters: PresetStat[];
}
export interface StatGroupPreset {
  id: string;
  name: string;
  game: PresetGame;
  groups: PresetStatGroup[];
}

export const statGroupPresetsStore = writable<StatGroupPreset[]>([]);
export const statGroupPresetsError = writable<string | null>(null);

const instanceId = crypto.randomUUID();
let loaded = false;
let listening = false;

async function listenOnce() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  try {
    await listen<{ source?: string }>("stat-group-presets-updated", (e) => {
      if (e.payload?.source !== instanceId) void loadStatGroupPresets();
    });
  } catch {
    // Non-Tauri fallback
  }
}

export async function loadStatGroupPresets(): Promise<void> {
  await listenOnce();
  try {
    const list = await invoke<StatGroupPreset[]>("get_stat_group_presets");
    statGroupPresetsStore.set(list ?? []);
    statGroupPresetsError.set(null);
    loaded = true;
  } catch (err) {
    console.error("Failed to load stat group presets:", err);
    statGroupPresetsError.set(`Failed to load stat group presets: ${err}`);
  }
}

export async function ensureStatGroupPresets(): Promise<void> {
  if (!loaded) await loadStatGroupPresets();
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function persist(): Promise<void> {
  try {
    await invoke("save_stat_group_presets", {
      presets: get(statGroupPresetsStore),
    });
    statGroupPresetsError.set(null);
    await emit("stat-group-presets-updated", { source: instanceId }).catch(
      () => {},
    );
  } catch (err) {
    statGroupPresetsError.set(`Failed to save stat group presets: ${err}`);
  }
}

/** Mutate a cloned draft, publish it immediately, save debounced. */
export function updatePresets(fn: (draft: StatGroupPreset[]) => void): void {
  const draft = structuredClone(get(statGroupPresetsStore));
  fn(draft);
  statGroupPresetsStore.set(draft);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void persist();
  }, 250);
}

export async function flushStatGroupPresets(): Promise<void> {
  if (saveTimer === undefined) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  await persist();
}

export const createPreset = (): StatGroupPreset => ({
  id: crypto.randomUUID(),
  name: "New preset",
  game: "any",
  groups: [{ id: `stat_group_${Date.now()}`, type: "and", filters: [] }],
});
