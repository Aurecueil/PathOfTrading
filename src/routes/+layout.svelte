<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import {
    initItemData,
    leaguesAll,
    initUserSettings,
    initLeaguesData,
  } from "$lib/trade/tradeStore";
  import {
    workspaceState,
    openProject,
    navigateToProjectsHome,
    createNewProject,
    triggerSaveActiveProject,
    requestExitApp,
    showToast,
  } from "$lib/project/projects.svelte";

  import TitleBar from "$lib/settings/color/layout/TitleBar.svelte";
  import MenuTabBar from "$lib/settings/color/layout/MenuTabBar.svelte";
  import WorkspaceModals from "$lib/settings/color/layout/WorkspaceModals.svelte";
  import FooterBar from "$lib/settings/color/layout/FooterBar.svelte";
  import type { Snippet } from "svelte";
  import type { League } from "$lib/types/leagues";
  import { updaterState } from "$lib/update.svelte";

  import { invoke } from "@tauri-apps/api/core";

  const USER_ID_STORAGE_KEY = "app_telemetry_user_id";

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

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  });

  let unlistenWindowClose: UnlistenFn | undefined;

  const isInsideProject = $derived(
    Boolean($page.url.pathname.startsWith("/projects/")),
  );

  const poe1PcLeagues = $derived(
    ($leaguesAll || []).filter((l: League) => l.realm === "pc"),
  );

  onMount(async () => {
    // 1. Critical Priority Phase: Load settings & leagues concurrently
    try {
      await Promise.all([
        initUserSettings(), // already handles stat colors & registers saved hotkey
        initLeaguesData(), // populates league dropdowns & pricing stores immediately
      ]);
    } catch (error) {
      console.error("Failed to load initial settings or leagues:", error);
    }

    // 2. Background Phase: Heavy datasets fire without blocking UI responsiveness
    initItemData().catch((err) => {
      console.error("Failed to initialize heavy item/mod data:", err);
    });

    // 3. Platform setup & update checks
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      unlistenWindowClose = await appWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        await requestExitApp();
      });
    } catch {
      // Browser fallback
    }

    updaterState.checkForUpdates();

    // Example call:
    flushTelemetry([{ timestamp: Date.now(), action: "open" }]);
  });

  onDestroy(() => {
    if (unlistenWindowClose) unlistenWindowClose();
  });

  async function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (workspaceState.importModalOpen) {
        workspaceState.importModalOpen = false;
      }
      if (workspaceState.namePrompt) {
        workspaceState.namePrompt.onCancel();
      }
    }

    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (isInsideProject) {
        const saved = await triggerSaveActiveProject();
        if (saved) showToast("Project saved");
      }
    } else if (isMod && event.key.toLowerCase() === "o") {
      event.preventDefault();
      navigateToProjectsHome();
    } else if (isMod && event.key.toLowerCase() === "n") {
      event.preventDefault();
      const defaultLeague =
        poe1PcLeagues.length > 0 ? String(poe1PcLeagues[0].id) : "Standard";
      const created = await createNewProject({
        name: "",
        realm: "pc",
        league: defaultLeague,
      });
      openProject({
        id: created.id,
        name: created.name,
        realm: created.realm,
      });
    }
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="shell">
  <header class="header-container">
    <TitleBar />
    <MenuTabBar />
  </header>

  <main class="content">
    {@render children()}
  </main>

  <WorkspaceModals />
  <FooterBar />
</div>

<style>
  :global(*) {
    font-family: "Fontin", monospace, sans-serif !important;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  /* Custom WebKit / Chromium Scrollbar Theme */
  :global(*::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  :global(*::-webkit-scrollbar-track) {
    background: #000000;
    border-radius: 0px !important;
  }

  :global(*::-webkit-scrollbar-thumb) {
    background: #555555;
    border-radius: 0px !important;
  }

  :global(*::-webkit-scrollbar-thumb:hover) {
    background: #777777;
  }

  :global(*::-webkit-scrollbar-corner) {
    background: #000000;
    border-radius: 0px !important;
  }

  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    font-family: "Fontin", sans-serif;
    user-select: none;
    background-color: #000000;
  }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: #000000;
    color: #ffffff;
    position: relative;
  }

  .header-container {
    display: flex;
    flex-direction: column;
    background: #000000;
    position: relative;
    z-index: 1000;
    border-bottom: 1px solid #333333;
  }

  .content {
    flex: 1;
    position: relative;
    overflow: hidden;
    background-color: #000000;
    user-select: text;
  }

  /* --- Centered Update Modal & Grayed Out Backdrop --- */
  .update-backdrop {
    position: fixed;
    inset: 0;
    z-index: 3000;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .update-modal {
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    background: #050505;
    border: 1px solid #777777;
    border-radius: 0px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.95);
  }

  .update-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
    border-bottom: 1px solid #333333;
    padding-bottom: 8px;
  }

  .close-btn {
    background: transparent;
    border: 1px solid transparent;
    color: #888888;
    font-size: 13px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    color: #ffffff;
    border-color: #555555;
    background: #111111;
  }

  .update-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: hidden;
  }

  .markdown-notes {
    color: #d3d3d3;
    font-size: 12px;
    max-height: 280px;
    overflow-y: auto;
    line-height: 1.45;
    padding-right: 4px;
    user-select: text;
  }

  .empty-notes {
    color: #777777;
    font-style: italic;
  }

  .markdown-notes :global(h1),
  .markdown-notes :global(h2),
  .markdown-notes :global(h3) {
    color: #ffffff;
    margin: 8px 0 4px 0;
    font-size: 13px;
    border-bottom: 1px solid #222222;
    padding-bottom: 2px;
  }

  .markdown-notes :global(h1:first-child),
  .markdown-notes :global(h2:first-child),
  .markdown-notes :global(h3:first-child) {
    margin-top: 0;
  }

  .markdown-notes :global(ul) {
    margin: 4px 0;
    padding-left: 18px;
  }

  .markdown-notes :global(li) {
    margin-bottom: 3px;
  }

  .markdown-notes :global(code) {
    background: #151515;
    border: 1px solid #333333;
    padding: 1px 4px;
    font-size: 11px;
    color: #e0e0e0;
  }

  .update-progress-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-bar-container {
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    height: 8px;
    width: 100%;
    overflow: hidden;
  }

  .progress-bar {
    background: #ffffff;
    height: 100%;
    transition: width 0.2s ease;
  }

  .progress-text,
  .error-text {
    font-size: 11px;
    color: #888888;
  }

  .error-text {
    color: #ff5555;
  }

  .update-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid #222222;
    padding-top: 10px;
  }

  .pob-button {
    font-family: "Fontin", monospace, sans-serif;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    height: 26px;
    line-height: 1;
    padding: 0 14px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    text-align: center;
    transition:
      background 0.1s ease,
      border-color 0.1s ease;
  }

  .pob-button.primary-button {
    border-color: #b5b5b5;
    background: #141414;
  }

  .pob-button:hover,
  .pob-button:focus {
    background: #1f1f1f;
    border-color: #ffffff;
    color: #ffffff;
    outline: none;
  }
</style>
