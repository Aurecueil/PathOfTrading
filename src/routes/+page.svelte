<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    projectIndex,
    fetchProjectIndex,
    openProject,
    createNewProject,
    loadProjectFromBackend,
    saveProjectToBackend,
    deleteProjectFromBackend,
    exportProjectToDisk,
    openExternalUrl,
    encodeSharePayloadToCode,
    workspaceState,
  } from "$lib/project/projects.svelte";
  import { leaguesPoe, leaguesPoe2 } from "$lib/trade/tradeStore";
  import type { ProjectIndexEntry, SavedProject } from "$lib/types/types";

  let loading = $state(true);
  let searchQuery = $state("");
  let newProjectRealm = $state<"poe" | "poe2">("poe");
  let newProjectLeague = $state("");

  let openHeaderDropdown = $state<"realm" | "league" | null>(null);

  let editingId = $state<string | null>(null);
  let editingName = $state("");
  let confirmingDeleteEntry = $state<ProjectIndexEntry | null>(null);

  const REALM_OPTIONS: Array<{ id: "poe" | "poe2"; text: string }> = [
    { id: "poe", text: "PoE 1" },
    { id: "poe2", text: "PoE 2" },
  ];

  // Filter PoE 1 leagues to only ones with realm/realms === "pc"
  const poe1PcLeagues = $derived(
    ($leaguesPoe || []).filter((l: any) => {
      const r = String(l.realm ?? l.realms ?? "").toLowerCase();
      return r === "pc";
    }),
  );

  const poe2Leagues = $derived($leaguesPoe2 || []);

  const availableLeagues = $derived(
    newProjectRealm === "poe2" ? poe2Leagues : poe1PcLeagues,
  );

  const activeRealmLabel = $derived(
    REALM_OPTIONS.find((r) => r.id === newProjectRealm)?.text || "PoE 1",
  );

  const activeLeagueLabel = $derived.by(() => {
    if (availableLeagues.length === 0) return newProjectLeague || "Standard";
    const found = availableLeagues.find(
      (l: any) => String(l.id) === newProjectLeague,
    );
    return found
      ? found.text || String(found.id)
      : newProjectLeague || "Standard";
  });

  // Ensure selected league defaults to first available option when switching realm
  $effect(() => {
    if (
      availableLeagues.length > 0 &&
      !availableLeagues.some((l: any) => String(l.id) === newProjectLeague)
    ) {
      newProjectLeague = String(availableLeagues[0].id);
    } else if (availableLeagues.length === 0 && !newProjectLeague) {
      newProjectLeague = "Standard";
    }
  });

  const filteredProjects = $derived(
    projectIndex.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    ),
  );

  onMount(async () => {
    workspaceState.activeProjectId = null;
    loading = true;
    await fetchProjectIndex();
    loading = false;
  });

  async function handleCreateProject() {
    const created = await createNewProject({
      name: "",
      realm: newProjectRealm,
      league: newProjectLeague || "Standard",
    });
    openProject({
      id: created.id,
      name: created.name,
      realm: created.realm,
    });
  }

  async function handleCopyShareCode(entry: ProjectIndexEntry, e: MouseEvent) {
    e.stopPropagation();
    try {
      const proj = await loadProjectFromBackend(entry.id);
      const code = await encodeSharePayloadToCode({
        camera: proj.camera,
        realm: proj.realm,
        league: proj.league,
        items: proj.items,
      });
      await navigator.clipboard.writeText(code);
    } catch (err) {
      console.error("Failed to copy share code", err);
    }
  }

  async function handleExportPotFile(entry: ProjectIndexEntry, e: MouseEvent) {
    e.stopPropagation();
    try {
      await exportProjectToDisk(entry.id);
    } catch (err: any) {
      console.error("Failed to export file:", err);
    }
  }

  function startRename(entry: ProjectIndexEntry, e: MouseEvent) {
    e.stopPropagation();
    editingId = entry.id;
    editingName = entry.name;
  }

  async function commitRename(entry: ProjectIndexEntry) {
    if (editingId !== entry.id) return;
    const trimmed = editingName.trim();
    editingId = null;
    if (!trimmed || trimmed === entry.name) return;

    try {
      const proj: SavedProject = await loadProjectFromBackend(entry.id);
      proj.name = trimmed;
      await saveProjectToBackend(proj);
    } catch (err) {
      console.error("Failed to rename project:", err);
    }
  }

  async function handleDeleteClick(entry: ProjectIndexEntry, e: MouseEvent) {
    e.stopPropagation();
    // Ctrl+Click or Cmd+Click deletes immediately without prompt
    if (e.ctrlKey || e.metaKey) {
      await deleteProjectFromBackend(entry.id);
      return;
    }
    // Otherwise open custom styled confirmation prompt
    confirmingDeleteEntry = entry;
  }

  async function confirmDelete() {
    if (!confirmingDeleteEntry) return;
    const targetId = confirmingDeleteEntry.id;
    confirmingDeleteEntry = null;
    await deleteProjectFromBackend(targetId);
  }

  function handleWindowClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".custom-dropdown-wrapper")) {
      openHeaderDropdown = null;
    }
  }

  function handleWindowKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && openHeaderDropdown) {
      openHeaderDropdown = null;
      e.preventDefault();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeyDown} />

<div class="hub-wrapper">
  <div class="hub-container">
    <!-- Header with Icon + Title (Left) and Realm / League / New Project (Right) -->
    <header class="pob-groupbox hub-header">
      <div class="header-left">
        <img src="/favicon.png" alt="Icon" class="header-icon" />
        <h1>Path of Trading</h1>
      </div>

      <div class="header-right">
        <!-- Realm Custom Combobox Dropdown -->
        <div class="custom-dropdown-wrapper realm-dropdown">
          <button
            type="button"
            class="custom-dropdown-trigger"
            title="Default Project Realm"
            aria-label="Default Project Realm"
            aria-expanded={openHeaderDropdown === "realm"}
            onclick={() =>
              (openHeaderDropdown =
                openHeaderDropdown === "realm" ? null : "realm")}
          >
            <span class="trigger-label">{activeRealmLabel}</span>
            <span class="trigger-arrow">▾</span>
          </button>
          {#if openHeaderDropdown === "realm"}
            <ul class="dropdown" onwheel={(e) => e.stopPropagation()}>
              {#each REALM_OPTIONS as rOpt (rOpt.id)}
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <li
                  class:selected={rOpt.id === newProjectRealm}
                  onmousedown={(e) => {
                    e.preventDefault();
                    newProjectRealm = rOpt.id;
                    openHeaderDropdown = null;
                  }}
                >
                  {rOpt.text}
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <!-- League Custom Combobox Dropdown -->
        <div class="custom-dropdown-wrapper league-dropdown">
          <button
            type="button"
            class="custom-dropdown-trigger"
            title="Default Project League"
            aria-label="Default Project League"
            aria-expanded={openHeaderDropdown === "league"}
            onclick={() =>
              (openHeaderDropdown =
                openHeaderDropdown === "league" ? null : "league")}
          >
            <span class="trigger-label">{activeLeagueLabel}</span>
            <span class="trigger-arrow">▾</span>
          </button>
          {#if openHeaderDropdown === "league"}
            <ul class="dropdown" onwheel={(e) => e.stopPropagation()}>
              {#if availableLeagues.length === 0}
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <li
                  class:selected={newProjectLeague === "Standard"}
                  onmousedown={(e) => {
                    e.preventDefault();
                    newProjectLeague = "Standard";
                    openHeaderDropdown = null;
                  }}
                >
                  Standard
                </li>
              {:else}
                {#each availableLeagues as l (l.id)}
                  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                  <li
                    class:selected={String(l.id) === newProjectLeague}
                    onmousedown={(e) => {
                      e.preventDefault();
                      newProjectLeague = String(l.id);
                      openHeaderDropdown = null;
                    }}
                  >
                    {l.text || l.id}
                  </li>
                {/each}
              {/if}
            </ul>
          {/if}
        </div>

        <button
          type="button"
          class="pob-button btn-primary"
          onclick={handleCreateProject}
        >
          + New Project
        </button>
      </div>
    </header>

    <!-- Standalone Filter Box matching Combobox Input Styling -->
    <div class="filter-input-wrapper">
      <input
        type="text"
        class="text-input standalone-filter"
        class:is-modified={searchQuery.trim().length > 0}
        bind:value={searchQuery}
        placeholder="Filter projects..."
        autocomplete="off"
      />
      {#if searchQuery.length > 0}
        <button
          type="button"
          class="clear-filter-btn"
          onmousedown={(e) => {
            e.preventDefault();
            searchQuery = "";
          }}
          title="Clear"
          aria-label="Clear filter"
        >
          ✕
        </button>
      {/if}
    </div>

    <!-- Flexible Static/Scrollable Projects Box -->
    <section class="pob-groupbox all-projects-box">
      {#if loading}
        <div class="empty-state">Loading projects from disk...</div>
      {:else if filteredProjects.length === 0}
        <div class="empty-state">
          {#if projectIndex.length === 0}
            No saved projects yet. Create a project above.
          {:else}
            No projects match "{searchQuery}".
          {/if}
        </div>
      {:else}
        <div class="project-grid">
          {#each filteredProjects as entry (entry.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="project-card"
              ondblclick={() =>
                openProject({
                  id: entry.id,
                  name: entry.name,
                  realm: entry.realm,
                })}
            >
              <div class="card-main">
                <div class="title-row">
                  <img
                    src={entry.realm?.toLowerCase() === "poe2"
                      ? "/poe2.png"
                      : "/poe.png"}
                    alt={entry.realm || "poe"}
                    class="project-realm-icon"
                  />
                  {#if entry.league}
                    <span class="league-tag">{entry.league}</span>
                  {/if}
                  {#if editingId === entry.id}
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                      type="text"
                      class="rename-input"
                      bind:value={editingName}
                      autofocus
                      onclick={(e) => e.stopPropagation()}
                      ondblclick={(e) => e.stopPropagation()}
                      onblur={() => commitRename(entry)}
                      onkeydown={(e) => {
                        if (e.key === "Enter") commitRename(entry);
                        if (e.key === "Escape") editingId = null;
                      }}
                    />
                  {:else}
                    <span class="project-name">{entry.name}</span>
                  {/if}
                </div>
              </div>

              <div
                class="card-actions"
                onclick={(e) => e.stopPropagation()}
                ondblclick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  class="pob-button card-btn"
                  title="Rename project"
                  onclick={(e) => startRename(entry, e)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  class="pob-button card-btn"
                  title="Copy Zlib+Base64 share code"
                  onclick={(e) => handleCopyShareCode(entry, e)}
                >
                  Copy Code
                </button>
                <button
                  type="button"
                  class="pob-button card-btn"
                  title="Export .pot file"
                  onclick={(e) => handleExportPotFile(entry, e)}
                >
                  Export
                </button>
                <button
                  type="button"
                  class="pob-button card-btn danger"
                  title="Delete project (Ctrl+Click to bypass confirmation)"
                  onclick={(e) => handleDeleteClick(entry, e)}
                >
                  Delete
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Promotional Banner Anchored to Bottom -->
    <section class="promo-banner-section">
      <button
        type="button"
        class="promo-banner-btn"
        onclick={() => openExternalUrl("https://www.pathofexile.com/purchase")}
      >
        <img
          src="/FullNews_EN.jpg"
          alt="Path of Exile Supporter Packs"
          class="promo-banner-img"
        />
      </button>
    </section>
  </div>
</div>

<!-- Custom Styled Deletion Confirmation Modal -->
{#if confirmingDeleteEntry}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => (confirmingDeleteEntry = null)}>
    <div class="pob-groupbox modal-box" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">Confirm Deletion</div>
      <p class="modal-text">
        Are you sure you want to delete project <strong class="highlight-name"
          >"{confirmingDeleteEntry.name}"</strong
        > permanently?
      </p>
      <div class="modal-actions">
        <button
          type="button"
          class="pob-button card-btn danger"
          onclick={confirmDelete}
        >
          Delete
        </button>
        <button
          type="button"
          class="pob-button card-btn"
          onclick={() => (confirmingDeleteEntry = null)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

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

  /* --------------------------------------------------------------------------
     Child Popover / Dropdown Menu Overrides (1px White Border matching Drawer)
     -------------------------------------------------------------------------- */
  :global(.combobox-dropdown),
  :global(.autocomplete-dropdown),
  :global(.dropdown-menu),
  :global(.popover-menu),
  :global(.select-dropdown),
  :global(.dropdown) {
    background: #000000 !important;
    border: 1px solid #ffffff !important;
    border-radius: 0px !important;
    padding: 1px 0 !important;
    z-index: 1000 !important;
    box-sizing: border-box !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85) !important;
  }

  :global(.combobox-option),
  :global(.autocomplete-option),
  :global(.dropdown-item),
  :global(.option-row),
  :global(.dropdown li) {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 12px !important;
    color: #9a9a9a !important;
    background: #000000 !important;
    padding: 1px 4px !important;
    line-height: 1.15 !important;
    cursor: pointer !important;
    border-radius: 0px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  :global(.combobox-option.selected),
  :global(.combobox-option[aria-selected="true"]),
  :global(.autocomplete-option.selected),
  :global(.dropdown-item.selected),
  :global(.dropdown li.selected) {
    background: #000000 !important;
    color: #ffffff !important;
  }

  :global(.combobox-option:hover),
  :global(.combobox-option:focus),
  :global(.autocomplete-option:hover),
  :global(.autocomplete-option:focus),
  :global(.dropdown-item:hover),
  :global(.dropdown-item:focus),
  :global(.option-row:hover),
  :global(.dropdown li:hover),
  :global(.dropdown li.highlighted) {
    background: #545454 !important;
    color: #ffffff !important;
  }

  .hub-wrapper {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background-color: #040608;
    padding: 1rem;
    color: #d3d3d3;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 13px;
    line-height: 1.2;
  }

  .hub-container {
    max-width: 940px;
    height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Fieldset / Groupbox Layout */
  .pob-groupbox {
    border: 1px solid #777777;
    border-radius: 0px;
    padding: 6px 8px;
    background-color: #050505;
    margin: 0;
  }

  /* Header */
  .hub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  h1 {
    margin: 0;
    font-size: 21px;
    font-weight: bold;
    color: #e0e0e0;
    line-height: 1;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* Unified Combobox Dropdown Triggers */
  .custom-dropdown-wrapper {
    position: relative;
    display: flex;
    min-width: 0;
  }

  .realm-dropdown {
    width: 80px;
  }

  .league-dropdown {
    min-width: 140px;
  }

  .custom-dropdown-trigger {
    font-family: "Fontin", monospace, sans-serif !important;
    font-size: 12px !important;
    height: 26px !important;
    line-height: 1.15 !important;
    background-color: #000000 !important;
    border: 1px solid #7f7f7f !important;
    border-radius: 0px !important;
    color: #ffffff !important;
    padding: 0 6px !important;
    outline: none;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    cursor: pointer;
    text-align: left;
  }

  .custom-dropdown-trigger:hover,
  .custom-dropdown-trigger:focus,
  .custom-dropdown-trigger[aria-expanded="true"] {
    border-color: #ffffff !important;
  }

  .trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 auto;
    min-width: 0;
  }

  .trigger-arrow {
    color: #888888;
    font-size: 10px;
    flex-shrink: 0;
  }

  .custom-dropdown-trigger:hover .trigger-arrow {
    color: #ffffff;
  }

  .custom-dropdown-wrapper .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    min-width: 100%;
    max-height: 260px;
    overflow-y: auto;
    overscroll-behavior: contain;
    margin: 2px 0 0 0;
    list-style: none;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  /* Standalone Filter Input Wrapper */
  .filter-input-wrapper {
    position: relative;
    width: 100%;
    flex-shrink: 0;
  }

  .standalone-filter {
    width: 100%;
    padding-right: 1.5rem !important;
  }

  .clear-filter-btn {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #888888;
    cursor: pointer;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    line-height: 1;
    padding: 2px 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-filter-btn:hover {
    color: #ffffff;
  }

  /* Inputs & Controls */
  .text-input {
    font-family: "Fontin", monospace, sans-serif;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    height: 26px;
    line-height: 1.15;
    padding: 0 6px;
    font-size: 12px;
    outline: none;
  }

  .text-input:hover,
  .text-input:focus,
  .text-input.is-modified {
    border-color: #ffffff;
  }

  /* Buttons */
  .pob-button {
    font-family: "Fontin", monospace, sans-serif;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    height: 26px;
    line-height: 1;
    padding: 0 10px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    text-align: center;
    font-weight: normal;
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

  /* Primary "+ New Project" Button */
  .btn-primary {
    background: #000000;
    border: 1px solid #7f7f7f;
    color: #ffffff;
    font-weight: normal;
  }

  .btn-primary:hover,
  .btn-primary:focus {
    background: #111111;
    border-color: #ffffff;
    color: #ffffff;
  }

  /* Projects Container Box */
  .all-projects-box {
    background-color: #000000;
    flex: 1;
    min-height: 100px;
    overflow-y: auto;
    padding: 0px;
  }

  .project-grid {
    display: flex;
    flex-direction: column;
    gap: 0px;
  }

  /* Project Tile */
  .project-card {
    background: #050505;
    border: 1px solid #777777;
    border-radius: 0px;
    padding: 4px 8px;
    margin: 0px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    cursor: pointer;
  }

  .project-card:hover {
    background: #111111;
    border-color: #ffffff;
  }

  .card-main {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .project-realm-icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .league-tag {
    font-size: 11px;
    background: #000000;
    color: #ffffff;
    border: 1px solid #777777;
    padding: 1px 5px;
    border-radius: 0px;
  }

  .project-name {
    font-size: 13px;
    color: #e0e0e0;
  }

  .rename-input {
    background: #000000;
    border: 1px solid #ffffff;
    color: #ffffff;
    font-size: 12px;
    height: 22px;
    padding: 0 4px;
    border-radius: 0px;
    outline: none;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .card-btn {
    background: #000000;
    height: 22px;
    padding: 0 6px;
    font-size: 11px;
    font-weight: normal;
  }

  .card-btn.danger {
    color: #ff6666;
  }

  .card-btn.danger:hover {
    background: #330000;
    border-color: #ff3333;
    color: #ff3333;
  }

  .empty-state {
    text-align: center;
    padding: 2rem 1rem;
    background: #000000;
    color: #888888;
    font-size: 12px;
  }

  /* Anchored to Page Bottom */
  .promo-banner-section {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
  }

  .promo-banner-btn {
    padding: 0;
    background: transparent;
    border: 1px solid #777777;
    border-radius: 0px;
    overflow: hidden;
    cursor: pointer;
    width: 100%;
  }

  .promo-banner-btn:hover {
    border-color: #ffffff;
  }

  .promo-banner-img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
  }

  /* Custom Confirmation Modal Styling */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-box {
    width: 380px;
    max-width: 90vw;
    background: #050505;
    border: 1px solid #777777;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.9);
  }

  .modal-header {
    font-size: 14px;
    font-weight: bold;
    color: #ff5555;
    border-bottom: 1px solid #333333;
    padding-bottom: 4px;
  }

  .modal-text {
    margin: 0;
    font-size: 12px;
    color: #d3d3d3;
    line-height: 1.4;
  }

  .highlight-name {
    color: #ffffff;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;
  }
</style>
