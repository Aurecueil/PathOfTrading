// src/lib/project/projects.svelte.ts
import { goto } from "$app/navigation";
import { invoke } from "@tauri-apps/api/core";
import type {
  CameraState,
  CanvasAnnotation,
  ProjectIndexEntry,
  ProjectItem,
  SavedProject,
  SavedSearchTile,
  SearchTile,
  ShareCodePayload,
} from "$lib/types/types";

export const SETTINGS_TAB_ID = "__settings__";

export interface ProjectTab {
  id: string;
  name: string;
  realm?: string;
  dirty?: boolean;
  isSettings?: boolean;
}

export interface UnsavedPromptState {
  projectId: string;
  projectName: string;
  onSave: () => Promise<void>;
  onDiscard: () => Promise<void>;
  onCancel: () => void;
}

export interface NamePromptState {
  initialName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export const openTabs = $state<ProjectTab[]>([]);
export const projectIndex = $state<ProjectIndexEntry[]>([]);

/**
 * Stores camera positions per project ID for projects opened during this session.
 */
const sessionCameras = new Map<string, CameraState>();

/**
 * Holds newly created unnamed projects in memory before their first save.
 */
const inMemoryDraftProjects = new Map<string, SavedProject>();

export function getSessionCamera(projectId: string): CameraState | undefined {
  const cam = sessionCameras.get(projectId);
  return cam ? { ...cam } : undefined;
}

export function setSessionCamera(projectId: string, cam: CameraState) {
  if (!projectId) return;
  sessionCameras.set(projectId, {
    scale: cam.scale,
    offsetX: cam.offsetX,
    offsetY: cam.offsetY,
  });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(msg: string) {
  workspaceState.toastMessage = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    workspaceState.toastMessage = null;
  }, 2600);
}

export const workspaceState = $state<{
  activeProjectId: string | null;
  activeProjectRealm: string;
  activeProjectLeague: string;
  unsavedPrompt: UnsavedPromptState | null;
  namePrompt: NamePromptState | null;
  importModalOpen: boolean;
  importModalMode: "elements" | "new-project";
  toastMessage: string | null;
}>({
  activeProjectId: null,
  activeProjectRealm: "poe",
  activeProjectLeague: "Standard",
  unsavedPrompt: null,
  namePrompt: null,
  importModalOpen: false,
  importModalMode: "elements",
  toastMessage: null,
});

/**
 * Prompts the user to name an unnamed project before saving.
 */
export function requestProjectName(): Promise<string | null> {
  return new Promise((resolve) => {
    workspaceState.namePrompt = {
      initialName: "",
      onConfirm: (enteredName: string) => {
        const trimmed = enteredName.trim();
        if (!trimmed) return;
        workspaceState.namePrompt = null;
        resolve(trimmed);
      },
      onCancel: () => {
        workspaceState.namePrompt = null;
        resolve(null);
      },
    };
  });
}

// Active canvas hooks registered by src/routes/projects/[id]/+page.svelte
let activeSaveHandler: (() => Promise<boolean>) | null = null;
let activeImportElementsHandler: ((items: ProjectItem[]) => void) | null = null;
let activeExportPayloadHandler: (
  onlySelected: boolean,
) => ShareCodePayload | null = () => null;
let activeSetDefaultsHandler: ((realm: string, league: string) => void) | null =
  null;

export function registerCanvasHandlers(handlers: {
  save: () => Promise<boolean>;
  importElements: (items: ProjectItem[]) => void;
  exportPayload: (onlySelected: boolean) => ShareCodePayload;
  setProjectDefaults: (realm: string, league: string) => void;
}) {
  activeSaveHandler = handlers.save;
  activeImportElementsHandler = handlers.importElements;
  activeExportPayloadHandler = handlers.exportPayload;
  activeSetDefaultsHandler = handlers.setProjectDefaults;
}

export function unregisterCanvasHandlers() {
  activeSaveHandler = null;
  activeImportElementsHandler = null;
  activeExportPayloadHandler = () => null;
  activeSetDefaultsHandler = null;
}

export function updateActiveProjectDefaults(realm: string, league: string) {
  workspaceState.activeProjectRealm = realm;
  workspaceState.activeProjectLeague = league;
  const activeTab = openTabs.find(
    (t) => t.id === workspaceState.activeProjectId,
  );
  if (activeTab) {
    activeTab.realm = realm;
  }
  if (activeSetDefaultsHandler) {
    activeSetDefaultsHandler(realm, league);
  }
}

export function isAnnotationItem(item: ProjectItem): item is CanvasAnnotation {
  return "kind" in item && typeof (item as CanvasAnnotation).kind === "string";
}

export function serializeTileForSave(tile: SearchTile): SavedSearchTile {
  const payloadClone = JSON.parse(
    JSON.stringify(
      tile.full_payload ??
        tile.payload ?? {
          query: {
            status: { option: "securable" },
            stats: [{ type: "and", filters: [] }],
          },
          sort: { price: "asc" },
        },
    ),
  );

  return {
    x: tile.x,
    y: tile.y,
    w: tile.w,
    h: tile.h,
    realm: tile.realm || "poe",
    league: tile.league || "Standard",
    title: tile.displayName?.trim() || tile.title?.trim() || "",
    disabled: Boolean(tile.disabled),
    full_payload: payloadClone,
    mode: tile.mode ?? "regular",
  };
}

export function serializeAnnotationForSave(
  ann: CanvasAnnotation,
): CanvasAnnotation {
  return {
    id: ann.id,
    kind: ann.kind,
    x: ann.x,
    y: ann.y,
    w: ann.w,
    h: ann.h,
    color: ann.color,
    thickness: ann.thickness,
    text: ann.text,
    flipX: ann.flipX,
    flipY: ann.flipY,
  };
}

export function setProjectDirty(id: string, dirty: boolean) {
  const tab = openTabs.find((t) => t.id === id);
  if (tab && !tab.isSettings) {
    tab.dirty = dirty;
  }
}

export function isProjectDirty(id: string | null): boolean {
  if (!id) return false;
  return Boolean(openTabs.find((t) => t.id === id)?.dirty);
}

export function hasAnyDirtyProject(): ProjectTab | undefined {
  return openTabs.find((t) => !t.isSettings && t.dirty);
}

export function runWithUnsavedGuard(
  targetProjectId: string | null,
  proceed: () => void | Promise<void>,
) {
  const tab = targetProjectId
    ? openTabs.find((t) => t.id === targetProjectId && !t.isSettings)
    : undefined;

  if (!tab || !tab.dirty) {
    proceed();
    return;
  }

  workspaceState.unsavedPrompt = {
    projectId: tab.id,
    projectName: tab.name,
    onSave: async () => {
      workspaceState.unsavedPrompt = null;
      if (
        workspaceState.activeProjectId === tab.id &&
        activeSaveHandler !== null
      ) {
        const ok = await activeSaveHandler();
        if (!ok) return;
      }
      tab.dirty = false;
      await proceed();
    },
    onDiscard: async () => {
      workspaceState.unsavedPrompt = null;
      tab.dirty = false;
      inMemoryDraftProjects.delete(tab.id);
      await proceed();
    },
    onCancel: () => {
      workspaceState.unsavedPrompt = null;
    },
  };
}

export function openProject(project: {
  id: string;
  name: string;
  realm?: string;
}) {
  const proceed = () => {
    const existing = openTabs.find((tab) => tab.id === project.id);
    if (!existing) {
      openTabs.push({
        id: project.id,
        name: project.name,
        realm: project.realm || "poe",
        dirty: false,
      });
    } else {
      existing.name = project.name;
      if (project.realm) existing.realm = project.realm;
    }
    goto(`/projects/${project.id}`);
  };

  if (
    workspaceState.activeProjectId &&
    workspaceState.activeProjectId !== project.id
  ) {
    runWithUnsavedGuard(workspaceState.activeProjectId, proceed);
  } else {
    proceed();
  }
}

export function openSettingsTab() {
  const proceed = () => {
    if (!openTabs.some((t) => t.id === SETTINGS_TAB_ID)) {
      openTabs.push({
        id: SETTINGS_TAB_ID,
        name: "Settings",
        dirty: false,
        isSettings: true,
      });
    }
    workspaceState.activeProjectId = null;
    goto("/settings");
  };

  if (workspaceState.activeProjectId) {
    runWithUnsavedGuard(workspaceState.activeProjectId, proceed);
  } else {
    proceed();
  }
}

export function navigateToProjectsHome() {
  runWithUnsavedGuard(workspaceState.activeProjectId, () => {
    workspaceState.activeProjectId = null;
    goto("/");
  });
}

export function closeProject(id: string, currentPathname: string = "") {
  if (id === SETTINGS_TAB_ID) {
    const idx = openTabs.findIndex((t) => t.id === SETTINGS_TAB_ID);
    if (idx !== -1) openTabs.splice(idx, 1);
    if (currentPathname.startsWith("/settings")) {
      const nextTab = openTabs[idx] ?? openTabs[idx - 1];
      if (nextTab) {
        goto(nextTab.isSettings ? "/settings" : `/projects/${nextTab.id}`);
      } else {
        goto("/");
      }
    }
    return;
  }

  runWithUnsavedGuard(id, () => {
    const index = openTabs.findIndex((tab) => tab.id === id);
    if (index === -1) return;

    const wasActive = workspaceState.activeProjectId === id;
    openTabs.splice(index, 1);
    sessionCameras.delete(id);
    inMemoryDraftProjects.delete(id);

    if (wasActive) {
      const nextTab = openTabs[index] ?? openTabs[index - 1];
      if (nextTab) {
        if (nextTab.isSettings) {
          workspaceState.activeProjectId = null;
          goto("/settings");
        } else {
          goto(`/projects/${nextTab.id}`);
        }
      } else {
        workspaceState.activeProjectId = null;
        goto("/");
      }
    }
  });
}

export async function requestExitApp() {
  const dirtyTab =
    openTabs.find(
      (t) =>
        t.id === workspaceState.activeProjectId && t.dirty && !t.isSettings,
    ) ?? hasAnyDirtyProject();

  const performExit = async () => {
    try {
      await invoke("exit_app");
    } catch {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().destroy();
      } catch {
        window.close();
      }
    }
  };

  if (dirtyTab) {
    runWithUnsavedGuard(dirtyTab.id, performExit);
  } else {
    await performExit();
  }
}

export async function triggerSaveActiveProject(): Promise<boolean> {
  if (activeSaveHandler) {
    return await activeSaveHandler();
  }
  return false;
}

export function triggerImportElementsIntoActive(items: ProjectItem[]) {
  if (activeImportElementsHandler) {
    activeImportElementsHandler(items);
  }
}

export function getActiveSharePayload(
  onlySelected: boolean = false,
): ShareCodePayload | null {
  return activeExportPayloadHandler(onlySelected);
}

// ============================================================================
// Rust Backend Persistence + Browser Dev Fallback
// ============================================================================

const LS_INDEX_KEY = "poe_canvas_project_index";
const LS_PROJECT_PREFIX = "poe_canvas_project_";

export async function fetchProjectIndex(): Promise<ProjectIndexEntry[]> {
  try {
    const list = await invoke<ProjectIndexEntry[]>("load_project_index");
    projectIndex.splice(0, projectIndex.length, ...list);
    return list;
  } catch {
    const raw = localStorage.getItem(LS_INDEX_KEY);
    const list: ProjectIndexEntry[] = raw ? JSON.parse(raw) : [];
    list.sort((a, b) => b.updated_at - a.updated_at);
    projectIndex.splice(0, projectIndex.length, ...list);
    return list;
  }
}

export async function loadProjectFromBackend(
  id: string,
): Promise<SavedProject> {
  if (inMemoryDraftProjects.has(id)) {
    return inMemoryDraftProjects.get(id)!;
  }
  try {
    return await invoke<SavedProject>("load_project", { id });
  } catch {
    const raw = localStorage.getItem(`${LS_PROJECT_PREFIX}${id}`);
    if (raw) {
      return JSON.parse(raw);
    }
    throw new Error(`Project '${id}' not found`);
  }
}

export async function saveProjectToBackend(
  project: SavedProject,
): Promise<ProjectIndexEntry> {
  inMemoryDraftProjects.delete(project.id);
  try {
    const entry = await invoke<ProjectIndexEntry>("save_project", { project });
    await fetchProjectIndex();
    const tab = openTabs.find((t) => t.id === project.id);
    if (tab) {
      tab.name = project.name;
      tab.realm = project.realm;
      tab.dirty = false;
    }
    return entry;
  } catch {
    const now = Date.now();
    const saved: SavedProject = { ...project, updated_at: now };
    localStorage.setItem(
      `${LS_PROJECT_PREFIX}${project.id}`,
      JSON.stringify(saved),
    );

    let tile_count = 0;
    let annotation_count = 0;
    for (const item of project.items) {
      if (isAnnotationItem(item)) annotation_count++;
      else tile_count++;
    }

    const entry: ProjectIndexEntry = {
      id: project.id,
      name: project.name,
      realm: project.realm || "poe",
      league: project.league || "Standard",
      updated_at: now,
      tile_count,
      annotation_count,
    };

    const existingIdx = projectIndex.findIndex((p) => p.id === project.id);
    if (existingIdx !== -1) {
      projectIndex[existingIdx] = entry;
    } else {
      projectIndex.unshift(entry);
    }
    projectIndex.sort((a, b) => b.updated_at - a.updated_at);
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify(projectIndex));

    const tab = openTabs.find((t) => t.id === project.id);
    if (tab) {
      tab.name = project.name;
      tab.realm = project.realm;
      tab.dirty = false;
    }
    return entry;
  }
}

export async function exportProjectToDisk(id: string): Promise<string | null> {
  try {
    return await invoke<string | null>("export_project_file", { id });
  } catch {
    const proj = await loadProjectFromBackend(id);
    const blob = new Blob([JSON.stringify(proj, null, 2)], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = `${proj.name.replace(/[^a-z0-9-_]/gi, "_") || "project"}.pot`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return filename;
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    await invoke("open_external_url", { url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function deleteProjectFromBackend(id: string): Promise<void> {
  inMemoryDraftProjects.delete(id);
  try {
    await invoke("delete_project", { id });
  } catch {
    localStorage.removeItem(`${LS_PROJECT_PREFIX}${id}`);
    const filtered = projectIndex.filter((p) => p.id !== id);
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify(filtered));
  }
  const tabIdx = openTabs.findIndex((t) => t.id === id);
  if (tabIdx !== -1) {
    openTabs.splice(tabIdx, 1);
  }
  sessionCameras.delete(id);
  await fetchProjectIndex();
}

export async function createNewProject(options: {
  name?: string;
  realm?: string;
  league?: string;
  camera?: CameraState;
  initialItems?: ProjectItem[];
}): Promise<SavedProject> {
  const id = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const name = (options.name ?? "").trim();
  const realm = options.realm || "poe";
  const league = options.league || "Standard";
  const camera: CameraState = options.camera ?? {
    scale: 0.7,
    offsetX: 0,
    offsetY: 0,
  };

  const project: SavedProject = {
    id,
    name,
    realm,
    league,
    camera,
    updated_at: Date.now(),
    items: [],
  };

  sessionCameras.set(id, { ...camera });

  if (name.length > 0) {
    await saveProjectToBackend(project);
  } else {
    // Keep unnamed project in memory until user saves and names it
    inMemoryDraftProjects.set(id, project);
  }
  return project;
}

// ============================================================================
// Zlib + Base64 Share Code Encoding / Decoding (Includes Camera + Items)
// ============================================================================

export async function encodeSharePayloadToCode(
  payload: ShareCodePayload,
): Promise<string> {
  try {
    return await invoke<string>("encode_project_code", { payload });
  } catch {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    writer.write(jsonBytes);
    writer.close();
    const compressedBuffer = await new Response(cs.readable).arrayBuffer();
    const bytes = new Uint8Array(compressedBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export async function decodeSharePayloadFromCode(
  code: string,
): Promise<ShareCodePayload> {
  const cleaned = code.trim();
  if (!cleaned) {
    throw new Error("Share code cannot be empty.");
  }

  try {
    return await invoke<ShareCodePayload>("decode_project_code", {
      code: cleaned,
    });
  } catch {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
    const jsonStr = new TextDecoder().decode(decompressedBuffer);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return { items: parsed };
    }
    if (parsed && Array.isArray(parsed.items)) {
      return {
        camera: parsed.camera,
        realm: parsed.realm,
        league: parsed.league,
        items: parsed.items,
      };
    }
    throw new Error("Invalid share code payload.");
  }
}
