<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import {
    initItemData,
    leaguesPoe,
    initUserSettings,
    loadStatColorConfigsFromDisk,
    updateTpHotkey,
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

  import TitleBar from "$lib/layout/TitleBar.svelte";
  import MenuTabBar from "$lib/layout/MenuTabBar.svelte";
  import WorkspaceModals from "$lib/layout/WorkspaceModals.svelte";
  import FooterBar from "$lib/layout/FooterBar.svelte";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  // --- Auto-Updater State ---
  let updateAvailable = $state(false);
  let updateVersion = $state("");
  let updateBody = $state("");
  let isUpdating = $state(false);
  let updateProgress = $state(0);
  let updateError = $state("");
  let updateDownloaded = $state(false);
  let updaterModule: any = null;

  async function checkForUpdates() {
    try {
      updaterModule = await import("@tauri-apps/plugin-updater");
      const update = await updaterModule.check();

      if (update) {
        updateAvailable = true;
        updateVersion = update.version;
        updateBody = update.body || "";
      }
    } catch (e) {
      console.error("Failed to check for updates:", e);
    }
  }

  async function downloadAndInstallUpdate() {
    if (!updaterModule) return;
    try {
      isUpdating = true;
      updateError = "";
      const update = await updaterModule.check();
      if (!update) return;

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              updateProgress = Math.round((downloaded / contentLength) * 100);
            }
            break;
          case "Finished":
            updateDownloaded = true;
            break;
        }
      });

      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e: any) {
      console.error("Failed to install update:", e);
      updateError = e?.message || "Failed to install update.";
      isUpdating = false;
    }
  }
  // --------------------------

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
    ($leaguesPoe || []).filter((l: any) => {
      const r = String(l.realm ?? l.realms ?? "").toLowerCase();
      return r === "pc";
    }),
  );

  onMount(async () => {
    try {
      initItemData();
      initUserSettings();
      updateTpHotkey("CommandOrControl+Shift+T");
      loadStatColorConfigsFromDisk();
    } catch (error) {
      console.error("Failed to initialize item data:", error);
    }

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

    checkForUpdates();
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
        realm: "poe",
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

  <!-- Update Available Popover Box -->
  {#if updateAvailable}
    <div class="update-banner">
      <div class="update-header">
        <span>Update Available ({updateVersion})</span>
      </div>
      <div class="update-info">
        {#if updateBody}
          <div class="update-notes">{updateBody}</div>
        {/if}
        {#if isUpdating}
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: {updateProgress}%"></div>
          </div>
          <span class="progress-text">
            {updateDownloaded
              ? "Restarting..."
              : `Downloading... ${updateProgress}%`}
          </span>
        {/if}
        {#if updateError}
          <span class="error-text">{updateError}</span>
        {/if}
      </div>
      <div class="update-actions">
        {#if !isUpdating}
          <button class="pob-button" onclick={downloadAndInstallUpdate}
            >Update Now</button
          >
          <button class="pob-button" onclick={() => (updateAvailable = false)}
            >Later</button
          >
        {/if}
      </div>
    </div>
  {/if}

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

  /* --- Update Banner Matching Overall Styling --- */
  .update-banner {
    position: absolute;
    bottom: 35px;
    right: 15px;
    z-index: 2000;
    width: 320px;
    background: #050505;
    border: 1px solid #777777;
    border-radius: 0px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.9);
  }

  .update-banner:hover {
    border-color: #ffffff;
  }

  .update-header {
    font-size: 13px;
    font-weight: bold;
    color: #ffffff;
    border-bottom: 1px solid #333333;
    padding-bottom: 4px;
  }

  .update-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .update-notes {
    margin: 0;
    color: #d3d3d3;
    font-size: 12px;
    max-height: 80px;
    overflow-y: auto;
    white-space: pre-wrap;
    line-height: 1.3;
  }

  .progress-bar-container {
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    height: 8px;
    width: 100%;
    overflow: hidden;
    margin-top: 4px;
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
    gap: 6px;
    margin-top: 2px;
  }

  /* Reusing your .pob-button style rules */
  .pob-button {
    font-family: "Fontin", monospace, sans-serif;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    height: 24px;
    line-height: 1;
    padding: 0 10px;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    text-align: center;
    transition:
      background 0.1s ease,
      border-color 0.1s ease;
  }

  .pob-button:hover,
  .pob-button:focus {
    background: #111111;
    border-color: #ffffff;
    color: #ffffff;
    outline: none;
  }
</style>
