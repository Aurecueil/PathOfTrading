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

  import SettingsOverlay from "$lib/settings/SettingsOverlay.svelte";

  import TitleBar from "$lib/layout/TitleBar.svelte";
  import MenuTabBar from "$lib/layout/MenuTabBar.svelte";
  import WorkspaceModals from "$lib/layout/WorkspaceModals.svelte";
  import FooterBar from "$lib/layout/FooterBar.svelte";
  import type { Snippet } from "svelte";

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
    ($leaguesPoe || []).filter((l: any) => {
      const r = String(l.realm ?? l.realms ?? "").toLowerCase();
      return r === "pc";
    }),
  );

  onMount(async () => {
    try {
      initItemData();
      initUserSettings();
      loadStatColorConfigsFromDisk();
    } catch (error) {
      // Dev mode fallback
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

  <SettingsOverlay />
  <main class="content">
    {@render children()}
  </main>

  <WorkspaceModals />
  <FooterBar />
</div>

<style>
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
  /* src/app.css */
  @font-face {
    font-family: "Fontin";
    src: url("/fontin-regular-webfont.woff") format("woff");
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  /* Apply it globally */
  :root {
    font-family: "Fontin", sans-serif;
  }
</style>
