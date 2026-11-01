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
    closeProject,
    navigateToProjectsHome,
    createNewProject,
    triggerSaveActiveProject,
    getActiveSharePayload,
    encodeSharePayloadToCode,
    updateActiveProjectDefaults,
    showToast,
    openExternalUrl,
  } from "$lib/project/projects.svelte";
  import { leaguesAll } from "$lib/trade/tradeStore";
  import type { League, Realm } from "$lib/types/leagues";
  import SettingsOverlay from "$lib/settings/SettingsOverlay.svelte";
  import { openSettings } from "$lib/settings/settingsState.svelte";
  import { authState } from "$lib/trade/tradeStore";
  import { t } from "$lib/translation/text";

  const LOGIN_NOTICE_DELAY_SECS = 5;

  let fileMenuOpen = $state(false);
  let realmLeagueExpanded = $state(false);
  let menuContainerEl: HTMLDivElement | null = null;

  // Account state
  let accountMenuOpen = $state(false);
  let accountContainerEl: HTMLDivElement | null = null;
  let isLoggedIn = $state(false);
  let accountName = $state<string | null>(null);
  let loginModalOpen = $state(false);
  let proceedCountdown = $state(0);
  let sessionExpiredOpen = $state(false);

  const currentPathname = $derived($page.url.pathname);
  const isInsideProject = $derived(
    Boolean(currentPathname.startsWith("/projects/")),
  );

  const availableProjectLeagues = $derived(
    ($leaguesAll || []).filter(
      (l: League) => l.realm === workspaceState.activeProjectRealm,
    ),
  );
  // "Proceed & Login" is locked for a few seconds each time the notice opens
  $effect(() => {
    if (!loginModalOpen) return;
    proceedCountdown = LOGIN_NOTICE_DELAY_SECS;
    const id = setInterval(() => {
      proceedCountdown = Math.max(0, proceedCountdown - 1);
      if (proceedCountdown === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  });

  async function refreshAuthStatus() {
    try {
      const status = await invoke<{
        logged_in: boolean;
        username: string | null;
      }>("get_poe_auth_status");
      isLoggedIn = status.logged_in;
      accountName = status.username;

      authState.set(status.logged_in);

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

  // The backend ends the session when Cloudflare blocks it (refresh or fetch) and sets a
  // flag, so the popup also appears if the event fired before this component mounted.
  async function checkSessionExpired() {
    try {
      const expired = await invoke<boolean>("consume_session_expired");
      if (expired) {
        isLoggedIn = false;
        accountName = null;
        closeFileMenu();
        closeAccountMenu();
        loginModalOpen = false;
        sessionExpiredOpen = true;
      }
    } catch (err) {
      console.error("Failed to check session expiry:", err);
    }
  }

  onMount(() => {
    refreshAuthStatus();
    checkSessionExpired();

    const unlistenSuccess = listen("poe_auth_success", () => {
      refreshAuthStatus();
      sessionExpiredOpen = false;
      showToast("Logged in to Path of Exile");
    });

    const unlistenLogout = listen("poe_auth_logout", () => {
      isLoggedIn = false;
      accountName = null;
      accountMenuOpen = false;
      authState.set(false);
    });

    const unlistenExpired = listen("poe_session_expired", () => {
      checkSessionExpired();
    });

    return () => {
      unlistenSuccess.then((fn) => fn());
      unlistenLogout.then((fn) => fn());
      unlistenExpired.then((fn) => fn());
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
      if (loginModalOpen) loginModalOpen = false;
      if (sessionExpiredOpen) sessionExpiredOpen = false;
    }
  }

  function handleLoginClick() {
    loginModalOpen = true;
  }

  async function startLogin() {
    try {
      await invoke("open_poe_login");
    } catch (err) {
      console.error("Failed to open PoE login window:", err);
      showToast("Failed to open login window");
    }
  }

  // Regular login: only after the notice timer has run out
  async function confirmLogin() {
    if (proceedCountdown > 0) return;
    loginModalOpen = false;
    await startLogin();
  }

  // Login from the "session ended" popup: skips the regular notice
  async function reloginFromExpired() {
    sessionExpiredOpen = false;
    await startLogin();
  }

  async function handleLogoutClick() {
    closeAccountMenu();
    try {
      await invoke("logout_poe");
      isLoggedIn = false;
      accountName = null;
      showToast("Logged out of Path of Exile");
      authState.set(false);
    } catch (err) {
      console.error("Failed to log out:", err);
      showToast("Failed to log out");
    }
  }

  function handleMenuRealmChange(nextRealm: "pc" | "poe2" | "xbox" | "sony") {
    const list = ($leaguesAll || []).filter(
      (l: League) => l.realm === nextRealm,
    );
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
      availableProjectLeagues.length > 0
        ? String(availableProjectLeagues[0].id)
        : "Standard";
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

  function handleOpenProjectsPage() {
    closeFileMenu();
    navigateToProjectsHome();
  }

  function handleOpenSettingsMenu() {
    closeFileMenu();
    openSettings();
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
    tab: { id: string; name: string; realm: Realm },
  ) {
    e.preventDefault();
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
      {$t("file")}
    </button>

    {#if fileMenuOpen}
      <div class="dropdown-menu" role="presentation">
        <button
          type="button"
          class="dropdown-item"
          onclick={handleNewProjectMenu}
        >
          <span>{$t("new_project")}</span>
          <kbd>Ctrl+N</kbd>
        </button>
        <button
          type="button"
          class="dropdown-item"
          onclick={handleOpenProjectsPage}
        >
          <span>{$t("prject_selection")}</span>
          <kbd>Ctrl+O</kbd>
        </button>
        <div class="divider"></div>
        <button
          type="button"
          class="dropdown-item"
          disabled={!isInsideProject}
          onclick={handleSaveMenu}
        >
          <span>{$t("save_project")}</span>
          <kbd>Ctrl+S</kbd>
        </button>

        <button
          type="button"
          class="dropdown-item expandable-trigger"
          disabled={!isInsideProject}
          onclick={() => (realmLeagueExpanded = !realmLeagueExpanded)}
        >
          <span>{$t("project_realm_league")}</span>
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
                  class:selected={workspaceState.activeProjectRealm === "pc"}
                  onclick={() => handleMenuRealmChange("pc")}
                >
                  PoE
                </button>
                <button
                  type="button"
                  class="realm-opt"
                  class:selected={workspaceState.activeProjectRealm === "xbox"}
                  onclick={() => handleMenuRealmChange("xbox")}
                >
                  PoE (xbox)
                </button>
                <button
                  type="button"
                  class="realm-opt"
                  class:selected={workspaceState.activeProjectRealm === "sony"}
                  onclick={() => handleMenuRealmChange("sony")}
                >
                  PoE (sony)
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
          <span>{$t("import_elements_from_code")}</span>
        </button>
        <button
          type="button"
          class="dropdown-item"
          onclick={() => openImportModal("new-project")}
        >
          <span>{$t("import_project_from_code")}</span>
        </button>
        <div class="divider"></div>
        <button
          type="button"
          class="dropdown-item"
          disabled={!isInsideProject}
          onclick={() => handleCopyProjectShareCode(false)}
        >
          <span>{$t("copy_project_code")}</span>
        </button>
        <button
          type="button"
          class="dropdown-item"
          disabled={!isInsideProject}
          onclick={() => handleCopyProjectShareCode(true)}
        >
          <span>{$t("copy_selected_elements_code")}</span>
        </button>
        <div class="divider"></div>
        <button
          type="button"
          class="dropdown-item"
          onclick={handleOpenSettingsMenu}
        >
          <span>{$t("settings")}</span>
        </button>
      </div>
    {/if}
  </div>

  <nav class="tabs">
    <!-- .filter is a safety net in case an old settings tab is restored from a saved session -->
    {#each openTabs.filter((t) => !t.isSettings) as tab (tab.id)}
      <div
        class="tab"
        class:active-tab={isInsideProject &&
          workspaceState.activeProjectId === tab.id}
      >
        <a href={`/projects/${tab.id}`} onclick={(e) => handleTabClick(e, tab)}>
          <img
            src={`/${encodeURIComponent(tab.realm.toLowerCase())}.png`}
            alt={tab.realm || "pc"}
            class="tab-realm-icon"
          />
          <span>{tab.name?.trim() || "New Project"}</span>
          {#if tab.dirty}
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

<!-- Settings overlay (opened via File > Settings) -->
<SettingsOverlay />

<!-- Notice Modal for Login -->
{#if loginModalOpen}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={() => (loginModalOpen = false)}
  >
    <div
      class="modal-card"
      role="dialog"
      aria-label="Login Notice"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h3 class="modal-title">Notice</h3>
        <button
          type="button"
          class="modal-close-btn"
          onclick={() => (loginModalOpen = false)}
          title="Close"
        >
          ✕
        </button>
      </div>

      <div class="modal-content">
        <h4>TOU-unsafety</h4>
        <p>
          Login works by allowing you to login in webview and then pulling
          authentication from it. This break <a
            href="https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy"
            target="_blank"
            rel="noreferrer"
            onclick={(e) => {
              e.preventDefault();
              openExternalUrl(
                "https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy",
              );
            }}>GGG ToU</a
          > section 7i.
        </p>
        <p class="small-text">You use the login feature at your own risk.</p>
        <p class="small-text">
          Login is only required to use "Live Search" and "Teleport to hideout".
        </p>

        <h4>Data Safety</h4>
        <p>
          All you data is kept locally. You can verify truthfulness of this
          claim by checking <a
            href="https://github.com/Aurecueil/PathOfTrading"
            target="_blank"
            rel="noreferrer"
            onclick={(e) => {
              e.preventDefault();
              openExternalUrl("https://github.com/Aurecueil/PathOfTrading");
            }}>source code.</a
          >
        </p>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="btn-secondary"
          onclick={() => (loginModalOpen = false)}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-primary"
          disabled={proceedCountdown > 0}
          onclick={confirmLogin}
        >
          {proceedCountdown > 0
            ? `Proceed & Login (${proceedCountdown})`
            : "Proceed & Login"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Session ended (Cloudflare blocked the session and it was logged out) -->
{#if sessionExpiredOpen}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={() => (sessionExpiredOpen = false)}
  >
    <div
      class="modal-card"
      role="dialog"
      aria-label="Session ended"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h3 class="modal-title">Session ended</h3>
        <button
          type="button"
          class="modal-close-btn"
          onclick={() => (sessionExpiredOpen = false)}
          title="Close"
        >
          ✕
        </button>
      </div>

      <div class="modal-content">
        <p>Your session has ended, you need to relogin.</p>
        <p class="small-text">
          Until then, searches keep working without an account.
        </p>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="btn-secondary"
          onclick={() => (sessionExpiredOpen = false)}
        >
          Close
        </button>
        <button type="button" class="btn-primary" onclick={reloginFromExpired}>
          Log In
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(*) {
    font-family: "Fontin", monospace, sans-serif !important;
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
    font-family: "Fontin", monospace, sans-serif;
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
    font-family: "Fontin", monospace, sans-serif !important;
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
    border-color: #ffffff;
    color: #ffffff;
  }

  .menu-btn.active,
  .tab.active-tab {
    background-color: #2a2a2a;
    border-color: #ffffff;
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
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    padding: 1px 0 !important;
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
    font-family: "Fontin", monospace, sans-serif !important;
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
    font-family: "Fontin", monospace, sans-serif !important;
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
    font-family: "Fontin", monospace, sans-serif;
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
    border-color: #ffffff;
    color: #ffffff;
    font-weight: bold;
  }

  .submenu-select {
    font-family: "Fontin", monospace, sans-serif !important;
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

  /* Notice Modal Styles matching WorkspaceModals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-card {
    width: 440px;
    max-width: 92vw;
    background: #050505;
    border: 1px solid #777777;
    border-radius: 0px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.9);
    color: #d3d3d3;
    box-sizing: border-box;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid #333333;
    padding-bottom: 4px;
  }

  .modal-title {
    margin: 0;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #e0e0e0;
    line-height: 1.2;
  }

  .modal-close-btn {
    font-family: "Fontin", monospace, sans-serif;
    background: transparent;
    border: none;
    border-radius: 0px;
    color: #888888;
    cursor: pointer;
    font-size: 12px;
    padding: 0 4px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close-btn:hover {
    color: #ff5555;
    background: transparent;
  }

  .modal-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: #d3d3d3;
    line-height: 1.4;
  }

  .modal-content h4 {
    margin: 4px 0 0 0;
    font-size: 13px;
    color: #ffffff;
    font-weight: bold;
  }

  .modal-content p {
    margin: 0;
  }

  .modal-content a {
    color: #66b2ff;
    text-decoration: underline;
  }

  .modal-content a:hover {
    color: #99ccff;
  }

  .modal-content .small-text {
    font-size: 11px;
    color: #9a9a9a;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;
  }

  .btn-primary,
  .btn-secondary {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    height: 26px;
    line-height: 1;
    padding: 0 10px;
    border-radius: 0px;
    font-weight: normal;
    cursor: pointer;
    background: #000000;
    border: 1px solid #7f7f7f;
    color: #ffffff;
    white-space: nowrap;
    transition:
      background 0.1s ease,
      border-color 0.1s ease,
      color 0.1s ease;
  }

  .btn-primary {
    border-color: #ffffff;
  }

  .btn-primary:hover:not(:disabled),
  .btn-primary:focus:not(:disabled) {
    background: #111111;
    border-color: #ffffff;
    color: #ffffff;
    outline: none;
  }

  .btn-primary:disabled {
    opacity: 0.4;
    border-color: #7f7f7f;
    cursor: not-allowed;
  }

  .btn-secondary:hover,
  .btn-secondary:focus {
    background: #111111;
    border-color: #ffffff;
    color: #ffffff;
    outline: none;
  }
</style>
