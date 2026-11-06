import { invoke } from "@tauri-apps/api/core";
import { writable, get } from "svelte/store";

const USER_ID_STORAGE_KEY = "app_telemetry_user_id";
const TELEMETRY_LEVEL_STORAGE_KEY = "app_telemetry_level";

/** 0 = None, 1 = Basic, null = not chosen yet */
export type TelemetryLevel = 0 | 1;

function readStoredLevel(): TelemetryLevel | null {
  try {
    const raw = localStorage.getItem(TELEMETRY_LEVEL_STORAGE_KEY);
    if (raw === "0") return 0;
    if (raw === "1") return 1;
  } catch {
    /* ignore */
  }
  return null;
}

export const telemetryLevel = writable<TelemetryLevel | null>(
  readStoredLevel(),
);

export function setTelemetryLevel(level: TelemetryLevel) {
  try {
    localStorage.setItem(TELEMETRY_LEVEL_STORAGE_KEY, String(level));
  } catch (err) {
    console.error("Failed to persist telemetry level:", err);
  }
  telemetryLevel.set(level);
}

export function getOrCreateUserId(): string {
  let uid = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem(USER_ID_STORAGE_KEY, uid);
  }
  return uid;
}

export interface TelemetryEvent {
  timestamp: number;
  action: string;
}

export async function flushTelemetry(events: TelemetryEvent[]) {
  // Only send when the user explicitly opted in to "Basic"
  if (get(telemetryLevel) !== 1) return;

  const userId = getOrCreateUserId();
  try {
    await invoke("send_telemetry", {
      userId,
      events,
    });
  } catch (err) {
    console.error("Failed to send telemetry:", err);
  }
}
