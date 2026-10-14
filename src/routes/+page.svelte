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
    decodeSharePayloadFromCode,
    workspaceState,
  } from "$lib/project/projects.svelte";
  import { leaguesPoe, leaguesPoe2 } from "$lib/trade/tradeStore";
  import type { ProjectIndexEntry, SavedProject } from "$lib/types/types";

  let loading = $state(true);
  let searchQuery = $state("");
  let newProjectName = $state("");
  let newProjectRealm = $state<"poe" | "poe2">("poe");
  let newProjectLeague = $state("");

  let shareCodeInput = $state("");
  let importCodeProjectName = $state("");
  let importError = $state("");
  let showCodePanel = $state(false);
  let editingId = $state<string | null>(null);
  let editingName = $state("");
  let statusMsg = $state<string | null>(null);

  let fileInputEl: HTMLInputElement | null = null;

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

  // Ensure selected league defaults to first available option when switching realm
  $effect(() => {
    if (
      availableLeagues.length > 0 &&
      !availableLeagues.some((l: any) => String(l.id) === newProjectLeague)
    ) {
      newProjectLeague = String(availableLeagues[0].id);
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

  function notify(msg: string) {
    statusMsg = msg;
    setTimeout(() => {
      if (statusMsg === msg) statusMsg = null;
    }, 3500);
  }

  async function handleCreateProject(e: Event) {
    e.preventDefault();
    const created = await createNewProject({
      name: newProjectName.trim(),
      realm: newProjectRealm,
      league: newProjectLeague || "Standard",
    });
    newProjectName = "";
    openProject({
      id: created.id,
      name: created.name,
      realm: created.realm,
    });
  }

  async function handleImportFromCode(e: Event) {
    e.preventDefault();
    importError = "";
    try {
      const decoded = await decodeSharePayloadFromCode(shareCodeInput);
      const created = await createNewProject({
        name: importCodeProjectName.trim(),
        realm: decoded.realm || newProjectRealm,
        league: decoded.league || newProjectLeague || "Standard",
        camera: decoded.camera,
        initialItems: decoded.items,
      });
      shareCodeInput = "";
      importCodeProjectName = "";
      showCodePanel = false;
      openProject({
        id: created.id,
        name: created.name,
        realm: created.realm,
      });
    } catch (err: any) {
      importError = err?.message || String(err);
    }
  }

  async function handleFileSelected(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    importError = "";
    try {
      const text = await file.text();
      let items: any[] = [];
      let importedName = file.name.replace(/\.(pot|json|txt)$/i, "");
      let importedRealm = newProjectRealm;
      let importedLeague = newProjectLeague || "Standard";
      let importedCamera = undefined;

      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && Array.isArray(parsed.items)) {
          items = parsed.items;
          if (typeof parsed.name === "string") importedName = parsed.name;
          if (parsed.realm) importedRealm = parsed.realm;
          if (parsed.league) importedLeague = parsed.league;
          if (parsed.camera) importedCamera = parsed.camera;
        } else {
          throw new Error("Unrecognized project file format.");
        }
      } catch {
        const decoded = await decodeSharePayloadFromCode(text);
        items = decoded.items;
        if (decoded.realm) importedRealm = decoded.realm as "poe" | "poe2";
        if (decoded.league) importedLeague = decoded.league;
        if (decoded.camera) importedCamera = decoded.camera;
      }

      const created = await createNewProject({
        name: importedName,
        realm: importedRealm,
        league: importedLeague,
        camera: importedCamera,
        initialItems: items,
      });
      openProject({
        id: created.id,
        name: created.name,
        realm: created.realm,
      });
    } catch (err: any) {
      importError = `File import failed: ${err?.message || String(err)}`;
    } finally {
      input.value = "";
    }
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
      notify(`Copied share code for "${entry.name}"`);
    } catch (err) {
      console.error(err);
      notify("Failed to copy share code");
    }
  }

  async function handleExportPotFile(entry: ProjectIndexEntry, e: MouseEvent) {
    e.stopPropagation();
    try {
      const savedPath = await exportProjectToDisk(entry.id);
      if (savedPath) {
        notify(`Exported to ${savedPath}`);
      }
    } catch (err: any) {
      console.error(err);
      notify(`Failed to export file: ${err?.message || err}`);
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
      notify(`Renamed to "${trimmed}"`);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(entry: ProjectIndexEntry, e: MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete project "${entry.name}" permanently?`)) return;
    await deleteProjectFromBackend(entry.id);
    notify(`Deleted "${entry.name}"`);
  }

  function formatTimestamp(ms: number): string {
    if (!ms) return "Unknown";
    return new Date(ms).toLocaleString();
  }
</script>

<div class="hub-wrapper">
  <div class="hub-container">
    <header class="hub-header">
      <div>
        <h1>Path of Trading Projects</h1>
        <p class="subtitle">
          Select a recent workspace, create a new project with default realm &
          league, or import from file / code.
        </p>
      </div>

      <div class="header-buttons">
        <input
          type="file"
          accept=".pot,.json,.txt"
          bind:this={fileInputEl}
          onchange={handleFileSelected}
          style="display: none;"
        />
        <button
          type="button"
          class="btn-outline"
          onclick={() => fileInputEl?.click()}
        >
          Import File (.pot)
        </button>
        <button
          type="button"
          class="btn-outline"
          onclick={() => (showCodePanel = !showCodePanel)}
        >
          {showCodePanel ? "Hide Code Import" : "Import from Code"}
        </button>
      </div>
    </header>

    {#if statusMsg}
      <div class="status-banner">{statusMsg}</div>
    {/if}

    {#if importError}
      <div class="error-banner">{importError}</div>
    {/if}

    {#if showCodePanel}
      <form class="code-import-panel" onsubmit={handleImportFromCode}>
        <div class="code-panel-row">
          <input
            type="text"
            class="text-input"
            bind:value={importCodeProjectName}
            placeholder="Project Name (optional)"
          />
          <button type="submit" class="btn-primary">
            Create Project from Code
          </button>
        </div>
        <textarea
          class="code-textarea"
          rows="3"
          bind:value={shareCodeInput}
          placeholder="Paste compressed Base64 project code here..."
          required
        ></textarea>
      </form>
    {/if}

    <section class="create-bar">
      <form class="create-form" onsubmit={handleCreateProject}>
        <input
          type="text"
          class="text-input create-input"
          bind:value={newProjectName}
          placeholder="New project name (optional)"
        />

        <select
          class="select-input"
          bind:value={newProjectRealm}
          title="Default Project Realm"
        >
          <option value="poe">PoE 1</option>
          <option value="poe2">PoE 2</option>
        </select>

        <select
          class="select-input league-select"
          bind:value={newProjectLeague}
          title="Default Project League"
        >
          {#if availableLeagues.length === 0}
            <option value="Standard">Standard</option>
          {:else}
            {#each availableLeagues as l (l.id)}
              <option value={String(l.id)}>{l.text || l.id}</option>
            {/each}
          {/if}
        </select>

        <button type="submit" class="btn-primary">+ New Project</button>
      </form>

      <input
        type="search"
        class="text-input filter-input"
        bind:value={searchQuery}
        placeholder="Filter projects..."
      />
    </section>

    <section class="project-list-section">
      {#if loading}
        <div class="empty-state">Loading projects from disk...</div>
      {:else if filteredProjects.length === 0}
        <div class="empty-state">
          {#if projectIndex.length === 0}
            No saved projects yet. Create a project above or import one from a
            .pot file or share code.
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
              onclick={() =>
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

                <div class="project-meta">
                  <span>{entry.tile_count} Search Tile(s)</span>
                  <span>•</span>
                  <span>{entry.annotation_count} Annotation(s)</span>
                  <span>•</span>
                  <span>Updated {formatTimestamp(entry.updated_at)}</span>
                </div>
              </div>

              <div class="card-actions" onclick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  class="card-btn"
                  title="Rename project"
                  onclick={(e) => startRename(entry, e)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  class="card-btn"
                  title="Copy Zlib+Base64 share code"
                  onclick={(e) => handleCopyShareCode(entry, e)}
                >
                  Copy Code
                </button>
                <button
                  type="button"
                  class="card-btn"
                  title="Export .pot file"
                  onclick={(e) => handleExportPotFile(entry, e)}
                >
                  Export
                </button>
                <button
                  type="button"
                  class="card-btn danger"
                  title="Delete project"
                  onclick={(e) => handleDelete(entry, e)}
                >
                  Delete
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Promotional Banner underneath the Project List -->
    <section class="promo-banner-section">
      <button
        type="button"
        class="promo-banner-btn"
        title="Open pathofexile.com/purchase in your browser"
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

<style>
  .hub-wrapper {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    background: radial-gradient(circle at top, #171c2b 0%, #0d1017 100%);
    padding: 2.2rem 1.5rem;
    color: #e2e8f0;
  }

  .hub-container {
    max-width: 940px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .hub-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
    border-bottom: 1px solid #262f45;
    padding-bottom: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.45rem;
    color: #f8fafc;
  }

  .subtitle {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .header-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .status-banner {
    background: rgba(37, 99, 235, 0.18);
    border: 1px solid #3b82f6;
    color: #bfdbfe;
    padding: 0.55rem 0.85rem;
    border-radius: 6px;
    font-size: 0.82rem;
  }

  .error-banner {
    background: rgba(127, 29, 29, 0.3);
    border: 1px solid #ef4444;
    color: #fecaca;
    padding: 0.55rem 0.85rem;
    border-radius: 6px;
    font-size: 0.82rem;
  }

  .code-import-panel {
    background: #131824;
    border: 1px solid #2e3a59;
    border-radius: 8px;
    padding: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .code-panel-row {
    display: flex;
    gap: 0.6rem;
  }

  .code-textarea {
    background: #0b0e16;
    border: 1px solid #28324e;
    border-radius: 6px;
    color: #e2e8f0;
    padding: 0.6rem;
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
    resize: vertical;
  }

  .create-bar {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .create-form {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    min-width: 320px;
    flex-wrap: wrap;
  }

  .text-input,
  .select-input {
    background: #111520;
    border: 1px solid #2b344b;
    color: #f8fafc;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    outline: none;
  }

  .text-input:focus,
  .select-input:focus {
    border-color: #3a57e8;
  }

  .league-select {
    min-width: 140px;
  }

  .create-input {
    flex: 1;
    min-width: 180px;
  }

  .filter-input {
    width: 200px;
  }

  .btn-primary {
    background: #2563eb;
    border: 1px solid #3b82f6;
    color: #ffffff;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-primary:hover {
    background: #1d4ed8;
  }

  .btn-outline {
    background: #161b29;
    border: 1px solid #334155;
    color: #cbd5e1;
    padding: 0.48rem 0.85rem;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .btn-outline:hover {
    border-color: #64748b;
    background: #1e2538;
  }

  .project-grid {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .project-card {
    background: #131722;
    border: 1px solid #262f45;
    border-radius: 8px;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
    transition:
      border-color 0.14s ease,
      background-color 0.14s ease;
  }

  .project-card:hover {
    border-color: #3a57e8;
    background: #171d2c;
  }

  .card-main {
    display: flex;
    flex-direction: column;
    gap: 0.32rem;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .project-realm-icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .league-tag {
    font-size: 0.65rem;
    background: #1e293b;
    color: #93c5fd;
    border: 1px solid #334155;
    padding: 1px 6px;
    border-radius: 3px;
  }

  .project-name {
    font-size: 0.96rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .rename-input {
    background: #0b0e16;
    border: 1px solid #3a57e8;
    color: #ffffff;
    font-size: 0.92rem;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .project-meta {
    display: flex;
    gap: 0.45rem;
    font-size: 0.75rem;
    color: #94a3b8;
    flex-wrap: wrap;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .card-btn {
    background: #1e2536;
    border: 1px solid #334155;
    color: #cbd5e1;
    font-size: 0.74rem;
    padding: 0.28rem 0.55rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .card-btn:hover {
    background: #2b354d;
    color: #ffffff;
  }

  .card-btn.danger:hover {
    background: #7f1d1d;
    border-color: #dc2626;
    color: #fecaca;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    background: rgba(19, 23, 34, 0.6);
    border: 1px dashed #2e3852;
    border-radius: 8px;
    color: #94a3b8;
    font-size: 0.88rem;
  }

  .promo-banner-section {
    margin-top: 0.5rem;
    display: flex;
    justify-content: center;
  }

  .promo-banner-btn {
    padding: 0;
    background: transparent;
    border: 1px solid #262f45;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    width: 100%;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease;
  }

  .promo-banner-btn:hover {
    border-color: #3a57e8;
  }

  .promo-banner-img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
  }
</style>
