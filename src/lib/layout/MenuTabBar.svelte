<!-- src/lib/layout/MenuTabBar.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import {
    openTabs,
    workspaceState,
    openProject,
    openSettingsTab,
    closeProject,
    navigateToProjectsHome,
    createNewProject,
    triggerSaveActiveProject,
    getActiveSharePayload,
    encodeSharePayloadToCode,
    updateActiveProjectDefaults,
    showToast,
  } from "$lib/project/projects.svelte";
  import { leaguesPoe, leaguesPoe2 } from "$lib/trade/tradeStore";

  let fileMenuOpen = $state(false);
  let realmLeagueExpanded = $state(false);
  let menuContainerEl: HTMLDivElement | null = null;

  // Account state
  let accountMenuOpen = $state(false);
  let accountContainerEl: HTMLDivElement | null = null;
  let isLoggedIn = $state(false);
  let accountName = $state<string | null>(null);

  const currentPathname = $derived($page.url.pathname);
  const isInsideProject = $derived(
    Boolean(currentPathname.startsWith("/projects/")),
  );
  const isInsideSettings = $derived(
    Boolean(currentPathname.startsWith("/settings")),
  );

  // Filter PoE 1 leagues to PC realm
  const poe1PcLeagues = $derived(
    ($leaguesPoe || []).filter((l: any) => {
      const r = String(l.realm ?? l.realms ?? "").toLowerCase();
      return r === "pc";
    }),
  );

  const poe2Leagues = $derived($leaguesPoe2 || []);

  const availableProjectLeagues = $derived(
    workspaceState.activeProjectRealm === "poe2" ? poe2Leagues : poe1PcLeagues,
  );

  async function refreshAuthStatus() {
    try {
      const status = await invoke<{
        logged_in: boolean;
        username: string | null;
      }>("get_poe_auth_status");
      isLoggedIn = status.logged_in;
      accountName = status.username;

      if (isLoggedIn && !accountName) {
        invoke<string>("refresh_poetoken_background")
          .then(() => {
            invoke<{ logged_in: boolean; username: string | null }>(
              "get_poe_auth_status",
            )
              .then((updated) => {
                isLoggedIn = updated.logged_in;
                accountName = updated.username;
              })
              .catch(() => {});
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("Failed to check PoE auth status:", err);
    }
  }

  onMount(() => {
    refreshAuthStatus();

    const unlistenSuccess = listen("poe_auth_success", () => {
      refreshAuthStatus();
      showToast("Logged in to Path of Exile");
    });

    const unlistenLogout = listen("poe_auth_logout", () => {
      isLoggedIn = false;
      accountName = null;
      accountMenuOpen = false;
    });

    return () => {
      unlistenSuccess.then((fn) => fn());
      unlistenLogout.then((fn) => fn());
    };
  });

  function closeFileMenu() {
    fileMenuOpen = false;
    realmLeagueExpanded = false;
  }

  function closeAccountMenu() {
    accountMenuOpen = false;
  }

  function handleWindowClick(e: MouseEvent) {
    const target = e.target as Node;
    if (fileMenuOpen && menuContainerEl && !menuContainerEl.contains(target)) {
      closeFileMenu();
    }
    if (
      accountMenuOpen &&
      accountContainerEl &&
      !accountContainerEl.contains(target)
    ) {
      closeAccountMenu();
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (fileMenuOpen) closeFileMenu();
      if (accountMenuOpen) closeAccountMenu();
    }
  }

  async function handleLoginClick() {
    try {
      await invoke("open_poe_login");
    } catch (err) {
      console.error("Failed to open PoE login window:", err);
      showToast("Failed to open login window");
    }
  }

  async function handleLogoutClick() {
    closeAccountMenu();
    try {
      await invoke("logout_poe");
      isLoggedIn = false;
      accountName = null;
      showToast("Logged out of Path of Exile");
    } catch (err) {
      console.error("Failed to log out:", err);
      showToast("Failed to log out");
    }
  }

  function handleMenuRealmChange(nextRealm: "poe" | "poe2") {
    const list = nextRealm === "poe2" ? poe2Leagues : poe1PcLeagues;
    let nextLeague = workspaceState.activeProjectLeague;
    if (
      list.length > 0 &&
      !list.some((l: any) => String(l.id) === nextLeague)
    ) {
      nextLeague = String(list[0].id);
    }
    updateActiveProjectDefaults(nextRealm, nextLeague);
  }

  function handleMenuLeagueChange(e: Event) {
    const nextLeague = (e.currentTarget as HTMLSelectElement).value;
    updateActiveProjectDefaults(workspaceState.activeProjectRealm, nextLeague);
  }

  async function handleNewProjectMenu() {
    closeFileMenu();
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

  function handleOpenProjectsPage() {
    closeFileMenu();
    navigateToProjectsHome();
  }

  function handleOpenSettingsMenu() {
    closeFileMenu();
    openSettingsTab();
  }

  async function handleSaveMenu() {
    closeFileMenu();
    const saved = await triggerSaveActiveProject();
    if (saved) showToast("Project saved");
  }

  function openImportModal(mode: "elements" | "new-project") {
    closeFileMenu();
    workspaceState.importModalMode = mode;
    workspaceState.importModalOpen = true;
  }

  async function handleCopyProjectShareCode(onlySelected: boolean = false) {
    closeFileMenu();
    const payload = getActiveSharePayload(onlySelected);
    if (!payload || !payload.items.length) {
      showToast(
        onlySelected
          ? "No elements selected to copy"
          : "Project has no elements to export",
      );
      return;
    }
    try {
      const code = await encodeSharePayloadToCode(payload);
      await navigator.clipboard.writeText(code);
      showToast(
        onlySelected
          ? `Copied share code for ${payload.items.length} selected item(s)`
          : `Copied share code for project (${payload.items.length} items + camera)`,
      );
    } catch (err) {
      console.error("Failed to copy share code:", err);
      showToast("Failed to generate share code");
    }
  }

  function handleTabClick(
    e: MouseEvent,
    tab: { id: string; name: string; realm?: string; isSettings?: boolean },
  ) {
    e.preventDefault();
    if (tab.isSettings) {
      if (isInsideSettings) return;
      openSettingsTab();
      return;
    }
    if (workspaceState.activeProjectId === tab.id && isInsideProject) return;
    openProject(tab);
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="menubar-row">
  <div class="menu-item-container" bind:this={menuContainerEl}>
    <button
      type="button"
      class="menu-btn"
      class:active={fileMenuOpen}
      aria-expanded={fileMenuOpen}
      onclick={() => {
        fileMenuOpen = !fileMenuOpen;
        if (fileMenuOpen) closeAccountMenu();
        if (!fileMenuOpen) realmLeagueExpanded = false;
      }}
    >
      File
    </button>

    {#if fileMenuOpen}
      <div class="dropdown-menu" role="presentation">
        <button
          type="button"
          class="dropdown-item"
          onclick={handleNewProjectMenu}
        >
          <span>New Project</span>
          <kbd>Ctrl+N</kbd>
        </button>
        <button
          type="button"
          class="dropdown-item"
          onclick={handleOpenProjectsPage}
        >
          <span>Project Selection...</span>
          <kbd>Ctrl+O</kbd>
        </button>
        <div class="divider"></div>
        <button
          type="button"
          class="dropdown-item"
          disabled={!isInsideProject}
          onclick={handleSaveMenu}
        >
          <span>Save Project</span>
          <kbd>Ctrl+S</kbd>
        </button>

        <button
          type="button"
          class="dropdown-item expandable-trigger"
          disabled={!isInsideProject}
          onclick={() => (realmLeagueExpanded = !realmLeagueExpanded)}
        >
          <span>Project Realm / League</span>
          <span class="chevron">{realmLeagueExpanded ? "▾" : "▸"}</span>
        </button>

        {#if realmLeagueExpanded && isInsideProject}
          <div class="submenu-panel">
            <div class="submenu-row">
              <span class="submenu-label">Realm</span>
              <div class="realm-toggle-group">
                <button
                  type="button"
                  class="realm-opt"
                  class:selected={workspaceState.activeProjectRealm !== "poe2"}
                  onclick={() => handleMenuRealmChange("poe")}
                >
                  PoE 1
                </button>
                <button
                  type="button"
                  class="realm-opt"
                  class:selected={workspaceState.activeProjectRealm === "poe2"}
                  onclick={() => handleMenuRealmChange("poe2")}
                >
                  PoE 2
                </button>
              </div>
            </div>

            <div class="submenu-row">
              <span class="submenu-label">League</span>
              <select
                class="submenu-select"
                value={workspaceState.activeProjectLeague}
                onchange={handleMenuLeagueChange}
              >
                {#if availableProjectLeagues.length === 0}
                  <option value={workspaceState.activeProjectLeague}>
                    {workspaceState.activeProjectLeague || "Standard"}
                  </option>
                {:else}
                  {#each availableProjectLeagues as l (l.id)}
                    <option value={String(l.id)}>
                      {l.text || l.id}
                    </option>
                  {/each}
                {/if}
              </select>
            </div>
          </div>
        {/if}

        <div class="divider"></div>
        <button
          type="button"
          class="dropdown-item"
          disabled={!isInsideProject}
          onclick={() => openImportModal("elements")}
        >
          <span>Import Elements from Code...</span>
        </button>
        <button
          type="button"
          class="dropdown-item"
          onclick={() => openImportModal("new-project")}
        >
          <span>Import Project from Code...</span>
        </button>
        <div class="divider"></div>
        <button
          type="button"
          class="dropdown-item"
          disabled={!isInsideProject}
          onclick={() => handleCopyProjectShareCode(false)}
        >
          <span>Copy Project Share Code</span>
        </button>
        <button
          type="button"
          class="dropdown-item"
          disabled={!isInsideProject}
          onclick={() => handleCopyProjectShareCode(true)}
        >
          <span>Copy Selected Elements Code</span>
        </button>
        <div class="divider"></div>
        <button
          type="button"
          class="dropdown-item"
          onclick={handleOpenSettingsMenu}
        >
          <span>Settings</span>
        </button>
      </div>
    {/if}
  </div>

  <nav class="tabs">
    {#each openTabs as tab (tab.id)}
      <div
        class="tab"
        class:active-tab={(tab.isSettings && isInsideSettings) ||
          (!tab.isSettings &&
            isInsideProject &&
            workspaceState.activeProjectId === tab.id)}
      >
        <a
          href={tab.isSettings ? "/settings" : `/projects/${tab.id}`}
          onclick={(e) => handleTabClick(e, tab)}
        >
          {#if !tab.isSettings}
            <img
              src={tab.realm?.toLowerCase() === "poe2"
                ? "/poe2.png"
                : "/poe.png"}
              alt={tab.realm || "poe"}
              class="tab-realm-icon"
            />
          {/if}
          <span>{tab.name?.trim() || "New Project"}</span>
          {#if tab.dirty && !tab.isSettings}
            <span class="dirty-dot" title="Unsaved changes">●</span>
          {/if}
        </a>
        <button
          class="tab-close-btn"
          type="button"
          title="Close tab"
          onclick={(e) => {
            e.stopPropagation();
            closeProject(tab.id, currentPathname);
          }}>×</button
        >
      </div>
    {/each}
  </nav>

  <!-- Top-Right Account Button -->
  <div
    class="menu-item-container account-container"
    bind:this={accountContainerEl}
  >
    {#if !isLoggedIn}
      <button
        type="button"
        class="menu-btn account-btn"
        onclick={handleLoginClick}
      >
        Log In
      </button>
    {:else}
      <button
        type="button"
        class="menu-btn account-btn logged-in"
        class:active={accountMenuOpen}
        aria-expanded={accountMenuOpen}
        onclick={() => {
          accountMenuOpen = !accountMenuOpen;
          if (accountMenuOpen) closeFileMenu();
        }}
      >
        <span>{accountName || "Logged In"}</span>
        <span class="chevron">{accountMenuOpen ? "▴" : "▾"}</span>
      </button>

      {#if accountMenuOpen}
        <div class="dropdown-menu account-dropdown" role="presentation">
          <button
            type="button"
            class="dropdown-item logout-item"
            onclick={handleLogoutClick}
          >
            <span>Log Out</span>
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  :global(*) {
    font-family: "Fontin", sans-serif !important;
    box-sizing: border-box;
  }

  .menubar-row {
    min-height: 28px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    background: #040608;
    border-bottom: 1px solid #777777;
    box-sizing: border-box;
    font-family: "Fontin", sans-serif;
    font-size: 12px;
  }

  .menu-item-container {
    position: relative;
    flex-shrink: 0;
  }

  .account-container {
    margin-left: auto;
  }

  /* Base Trigger Buttons & Tabs */
  .menu-btn,
  .tab {
    font-family: "Fontin", sans-serif !important;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 2px 8px;
    background-color: #050505;
    border: 1px solid #777777;
    border-radius: 0px;
    color: #d3d3d3;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    box-sizing: border-box;
    flex-shrink: 0;
    text-decoration: none;
    font-weight: normal;
  }

  .menu-btn:hover,
  .tab:hover {
    background-color: #111111;
    border-color: #aaaaaa;
    color: #ffffff;
  }

  .menu-btn.active,
  .tab.active-tab {
    background-color: #2a2a2a;
    border-color: #aaaaaa;
    color: #ffffff;
    font-weight: normal;
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  .tabs::-webkit-scrollbar {
    height: 4px;
  }

  .tabs::-webkit-scrollbar-track {
    background: #000000;
  }

  .tabs::-webkit-scrollbar-thumb {
    background: #555555;
    border-radius: 0px;
  }

  .tab a {
    color: inherit;
    text-decoration: none;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .tab-realm-icon {
    width: 14px;
    height: 14px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .dirty-dot {
    color: #ff5555;
    font-size: 10px;
  }

  .tab .tab-close-btn {
    background: transparent;
    border: none;
    color: #888888;
    cursor: pointer;
    padding: 0 0 0 2px;
    font-size: 13px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }

  .tab .tab-close-btn:hover {
    color: #ff5555;
  }

  /* --------------------------------------------------------------------------
     Expanded Child Dropdown Menu (1px Solid White Border)
     -------------------------------------------------------------------------- */
  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 240px;
    background: #000000 !important;
    border: 1px solid #ffffff !important;
    border-radius: 0px !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.95);
    padding: 2px 0 !important;
    display: flex;
    flex-direction: column;
    z-index: 1100;
  }

  .dropdown-menu.account-dropdown {
    left: auto;
    right: 0;
    min-width: 160px;
  }

  /* Child Option Items */
  .dropdown-item {
    font-family: monospace, "Fontin", sans-serif !important;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #000000 !important;
    border: none !important;
    border-radius: 0px !important;
    color: #9a9a9a !important;
    padding: 1px 4px !important;
    font-size: 12px !important;
    line-height: 1.15 !important;
    cursor: pointer;
    text-align: left;
  }

  .dropdown-item:hover:not(:disabled),
  .dropdown-item:focus:not(:disabled) {
    background: #545454 !important;
    color: #ffffff !important;
  }

  .dropdown-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dropdown-item kbd {
    font-family: monospace, sans-serif !important;
    font-size: 11px;
    color: #888888;
  }

  .chevron {
    font-size: 11px;
    color: #888888;
  }

  .submenu-panel {
    background: #050505;
    border-top: 1px solid #777777;
    border-bottom: 1px solid #777777;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .submenu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .submenu-label {
    font-size: 11px;
    color: #888888;
  }

  .realm-toggle-group {
    display: flex;
    gap: 4px;
  }

  .realm-opt {
    font-family: "Fontin", sans-serif;
    background: #000000;
    border: 1px solid #777777;
    border-radius: 0px;
    color: #d3d3d3;
    font-size: 11px;
    padding: 1px 6px;
    cursor: pointer;
  }

  .realm-opt.selected {
    background: #2a2a2a;
    border-color: #aaaaaa;
    color: #ffffff;
    font-weight: bold;
  }

  .submenu-select {
    font-family: monospace, sans-serif !important;
    background: #000000 !important;
    border: 1px solid #777777 !important;
    border-radius: 0px !important;
    color: #ffffff !important;
    font-size: 11px !important;
    padding: 1px 4px !important;
    width: 145px;
    flex-shrink: 0;
    outline: none;
  }

  .submenu-select option {
    background: #000000 !important;
    color: #ffffff !important;
  }

  .divider {
    height: 1px;
    background: #777777;
    margin: 2px 0;
  }

  .logout-item {
    color: #ff6666 !important;
  }

  .logout-item:hover:not(:disabled) {
    background: #545454 !important;
    color: #ff6666 !important;
  }
</style>
