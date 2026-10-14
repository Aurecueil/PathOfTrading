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

      // If we are logged in via cookies/tokens but lack a username, trigger background fetch
      if (isLoggedIn && !accountName) {
        invoke<string>("refresh_poetoken_background")
          .then(() => {
            // Re-check status to pick up the newly fetched username
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

  async function handleViewProfile() {
    closeAccountMenu();
    if (!accountName) return;
    const formattedName = accountName.replace("#", "-");
    const profileUrl = `https://www.pathofexile.com/account/view-profile/${encodeURI(formattedName)}`;
    try {
      await invoke("open_external_url", { url: profileUrl });
    } catch (err) {
      window.open(profileUrl, "_blank", "noopener,noreferrer");
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
          {#if tab.name}
            <span>{tab.name}</span>
          {/if}
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
        <span>{accountName || "Account"}</span>
        <span class="chevron">{accountMenuOpen ? "▴" : "▾"}</span>
      </button>

      {#if accountMenuOpen}
        <div class="dropdown-menu account-dropdown" role="presentation">
          <button
            type="button"
            class="dropdown-item"
            disabled={!accountName}
            onclick={handleViewProfile}
          >
            <span>{accountName ? "View Profile" : "Fetching Profile..."}</span>
          </button>
          <div class="divider"></div>
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
  .menubar-row {
    min-height: 28px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    background: #000000;
    border-top: 1px solid #1e1e1e;
    box-sizing: border-box;
  }

  .menu-item-container {
    position: relative;
    flex-shrink: 0;
  }

  .account-container {
    margin-left: auto;
  }

  .menu-btn {
    background-color: #000000;
    color: #ffffff;
    border: 1px solid #555555;
    border-radius: 0;
    font-size: 12px;
    font-family: inherit;
    line-height: 1;
    padding: 3px 8px;
    cursor: pointer;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .menu-btn:hover {
    border-color: #888888;
    background-color: #1a1a1a;
  }

  .menu-btn.active {
    background-color: #252b3d;
    border-color: #3a57e8;
  }

  .account-btn.logged-in {
    border-color: #3b4252;
  }

  .account-dropdown {
    left: auto;
    right: 0;
    min-width: 160px;
  }

  .logout-item {
    color: #f87171;
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background-color: #000000;
    border: 1px solid #555555;
    padding: 2px 6px 2px 7px;
    box-sizing: border-box;
    font-size: 12px;
    line-height: 1;
    flex-shrink: 0;
  }

  .tab.active-tab {
    border-color: #3a57e8;
    background-color: #161b29;
  }

  .tab:hover {
    border-color: #888888;
    background-color: #1a1a1a;
  }

  .tab a {
    color: #ffffff;
    text-decoration: none;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 16px;
  }

  .tab-realm-icon {
    width: 14px;
    height: 14px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .dirty-dot {
    color: #f59e0b;
    font-size: 10px;
  }

  .tab .tab-close-btn {
    background: transparent;
    border: none;
    color: #888888;
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    line-height: 1;
  }

  .tab .tab-close-btn:hover {
    color: #ffffff;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 240px;
    background: #000000;
    border: 1px solid #666666;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.85);
    padding: 2px 0;
    display: flex;
    flex-direction: column;
    z-index: 1100;
  }

  .dropdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    border: none;
    color: #ffffff;
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .dropdown-item:hover:not(:disabled) {
    background: #333333;
  }

  .dropdown-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dropdown-item kbd {
    font-size: 11px;
    color: #aaaaaa;
  }

  .chevron {
    font-size: 11px;
    color: #94a3b8;
  }

  .submenu-panel {
    background: #0f131d;
    border-top: 1px solid #2e364f;
    border-bottom: 1px solid #2e364f;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .submenu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .submenu-label {
    font-size: 11px;
    color: #94a3b8;
  }

  .realm-toggle-group {
    display: flex;
    gap: 4px;
  }

  .realm-opt {
    background: #1a2030;
    border: 1px solid #334155;
    color: #cbd5e1;
    font-size: 11px;
    padding: 2px 8px;
    cursor: pointer;
  }

  .realm-opt.selected {
    background: #1e3a8a;
    border-color: #3b82f6;
    color: #ffffff;
    font-weight: 600;
  }

  .submenu-select {
    background: #1a2030;
    border: 1px solid #334155;
    color: #f8fafc;
    font-size: 11px;
    padding: 3px 6px;
    max-width: 145px;
    outline: none;
  }

  .divider {
    height: 1px;
    background: #444444;
    margin: 2px 0;
  }
</style>
