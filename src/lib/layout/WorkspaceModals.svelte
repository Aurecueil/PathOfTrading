<!-- src/lib/layout/WorkspaceModals.svelte -->
<script lang="ts">
  import { page } from "$app/stores";
  import {
    workspaceState,
    openProject,
    createNewProject,
    triggerImportElementsIntoActive,
    decodeSharePayloadFromCode,
    showToast,
  } from "$lib/project/projects.svelte";

  let codeInput = $state("");
  let newProjectNameInput = $state("");
  let codeError = $state("");
  let promptNameValue = $state("");

  const isInsideProject = $derived(
    Boolean($page.url.pathname.startsWith("/projects/")),
  );

  // Reset modal inputs when opened
  $effect(() => {
    if (workspaceState.importModalOpen) {
      codeInput = "";
      newProjectNameInput = "";
      codeError = "";
    }
  });

  $effect(() => {
    if (workspaceState.namePrompt) {
      promptNameValue = workspaceState.namePrompt.initialName || "";
    }
  });

  async function submitImportCodeModal() {
    codeError = "";
    try {
      const decoded = await decodeSharePayloadFromCode(codeInput);
      if (!decoded.items || !decoded.items.length) {
        codeError = "No tiles or canvas items found in this code.";
        return;
      }

      if (workspaceState.importModalMode === "elements" && isInsideProject) {
        triggerImportElementsIntoActive(decoded.items);
        workspaceState.importModalOpen = false;
        showToast(`Imported ${decoded.items.length} item(s) into project`);
      } else {
        const created = await createNewProject({
          name: newProjectNameInput.trim(),
          realm: decoded.realm || "pc",
          league: decoded.league || "Standard",
          camera: decoded.camera,
          initialItems: decoded.items,
        });
        workspaceState.importModalOpen = false;
        openProject({
          id: created.id,
          name: created.name,
          realm: created.realm,
        });
        showToast("Imported project from code");
      }
    } catch (err: any) {
      codeError = err?.message || String(err);
    }
  }
</script>

{#if workspaceState.toastMessage}
  <div class="toast-banner" role="status" aria-live="polite">
    {workspaceState.toastMessage}
  </div>
{/if}

<!-- Name Project Prompt Modal (Shown when saving a project with name === "") -->
{#if workspaceState.namePrompt}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={workspaceState.namePrompt.onCancel}
  >
    <form
      class="modal-card"
      onsubmit={(e) => {
        e.preventDefault();
        workspaceState.namePrompt?.onConfirm(promptNameValue);
      }}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h3 class="modal-title">Name Your Project</h3>
        <button
          type="button"
          class="modal-close-btn"
          onclick={workspaceState.namePrompt.onCancel}
          title="Close"
        >
          ✕
        </button>
      </div>
      <p class="modal-desc">
        Please enter a name for this project before saving.
      </p>
      <label class="modal-label">
        <span>Project Name</span>
        <div class="input-wrapper">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            class="modal-input"
            class:is-modified={promptNameValue.trim().length > 0}
            bind:value={promptNameValue}
            placeholder="Enter project name..."
            autocomplete="off"
            autofocus
            required
          />
          {#if promptNameValue.length > 0}
            <button
              type="button"
              class="clear-input-btn"
              onmousedown={(e) => {
                e.preventDefault();
                promptNameValue = "";
              }}
              title="Clear"
              aria-label="Clear project name"
            >
              ✕
            </button>
          {/if}
        </div>
      </label>
      <div class="modal-actions">
        <button
          type="button"
          class="btn-secondary"
          onclick={workspaceState.namePrompt.onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn-primary"
          disabled={!promptNameValue.trim()}
        >
          Save Project
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- Import Elements / Project From Code Modal -->
{#if workspaceState.importModalOpen}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={() => (workspaceState.importModalOpen = false)}
  >
    <div
      class="modal-card"
      role="dialog"
      aria-label="Import from Code"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h3 class="modal-title">
          {workspaceState.importModalMode === "elements"
            ? "Import Elements into Current Project"
            : "Import New Project from Share Code"}
        </h3>
        <button
          type="button"
          class="modal-close-btn"
          onclick={() => (workspaceState.importModalOpen = false)}
          title="Close"
        >
          ✕
        </button>
      </div>

      {#if workspaceState.importModalMode === "new-project"}
        <label class="modal-label">
          <span>Project Name</span>
          <div class="input-wrapper">
            <input
              type="text"
              class="modal-input"
              class:is-modified={newProjectNameInput.trim().length > 0}
              bind:value={newProjectNameInput}
              placeholder="Leave blank for unnamed project"
              autocomplete="off"
            />
            {#if newProjectNameInput.length > 0}
              <button
                type="button"
                class="clear-input-btn"
                onmousedown={(e) => {
                  e.preventDefault();
                  newProjectNameInput = "";
                }}
                title="Clear"
                aria-label="Clear project name"
              >
                ✕
              </button>
            {/if}
          </div>
        </label>
      {/if}

      <label class="modal-label">
        <span>Code:</span>
        <textarea
          class="modal-textarea"
          class:is-modified={codeInput.trim().length > 0}
          rows="5"
          bind:value={codeInput}
          placeholder="paste code here..."></textarea>
      </label>

      {#if codeError}
        <div class="modal-error">{codeError}</div>
      {/if}

      <div class="modal-actions">
        <button
          type="button"
          class="btn-secondary"
          onclick={() => (workspaceState.importModalOpen = false)}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-primary"
          onclick={submitImportCodeModal}
        >
          {workspaceState.importModalMode === "elements"
            ? "Insert into Canvas"
            : "Create & Open Project"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Unsaved Changes Guard Modal -->
{#if workspaceState.unsavedPrompt}
  <div class="modal-backdrop" role="presentation">
    <div
      class="modal-card unsaved-card"
      role="alertdialog"
      aria-labelledby="unsaved-heading"
    >
      <div class="modal-header">
        <h3 id="unsaved-heading" class="modal-title warning-title">
          This Project has Unsaved changes
        </h3>
      </div>
      <p class="modal-desc">
        Do you want to save the changes you made to
        <strong class="highlight-name"
          >"{workspaceState.unsavedPrompt.projectName ||
            "Untitled Project"}"</strong
        > before leaving?
      </p>
      <div class="modal-actions">
        <button
          type="button"
          class="btn-primary"
          onclick={workspaceState.unsavedPrompt.onSave}
        >
          Save
        </button>
        <button
          type="button"
          class="btn-danger"
          onclick={workspaceState.unsavedPrompt.onDiscard}
        >
          Don't Save
        </button>
        <button
          type="button"
          class="btn-secondary"
          onclick={workspaceState.unsavedPrompt.onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .toast-banner {
    position: fixed;
    bottom: 36px;
    left: 50%;
    transform: translateX(-50%);
    background: #000000;
    border: 1px solid #ffffff;
    color: #ffffff;
    padding: 5px 12px;
    border-radius: 0px;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.2;
    z-index: 2500;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    pointer-events: none;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    font-family: "Fontin", monospace, sans-serif;
  }

  .modal-card {
    width: 420px;
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

  .modal-title.warning-title {
    color: #ff5555;
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

  .modal-desc {
    margin: 0;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    color: #d3d3d3;
    line-height: 1.4;
  }

  .highlight-name {
    color: #ffffff;
  }

  .modal-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 11px;
    color: #d3d3d3;
  }

  .input-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
  }

  .modal-input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    height: 26px;
    width: 100%;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 1.5rem 0 6px;
    outline: none;
    box-sizing: border-box;
  }

  .modal-textarea {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.25;
    width: 100%;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 6px;
    outline: none;
    resize: vertical;
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: #555555 #000000;
  }

  .modal-textarea::-webkit-scrollbar {
    width: 6px;
  }
  .modal-textarea::-webkit-scrollbar-track {
    background: #000000;
  }
  .modal-textarea::-webkit-scrollbar-thumb {
    background: #555555;
  }

  .modal-input:hover,
  .modal-input:focus,
  .modal-input.is-modified,
  .modal-textarea:hover,
  .modal-textarea:focus,
  .modal-textarea.is-modified {
    border-color: #ffffff;
  }

  .clear-input-btn {
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

  .clear-input-btn:hover {
    color: #ffffff;
  }

  .modal-error {
    font-family: "Fontin", monospace, sans-serif;
    color: #ff6666;
    font-size: 11px;
    background: #1a0000;
    border: 1px solid #ff3333;
    padding: 4px 6px;
    border-radius: 0px;
    line-height: 1.3;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
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
    background: #000000;
    border: 1px solid #ffffff;
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled),
  .btn-primary:focus:not(:disabled) {
    background: #111111;
    border-color: #ffffff;
    color: #ffffff;
    outline: none;
  }

  .btn-primary:disabled {
    opacity: 0.45;
    border-color: #555555;
    color: #888888;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #000000;
    border: 1px solid #7f7f7f;
    color: #d3d3d3;
  }

  .btn-secondary:hover,
  .btn-secondary:focus {
    background: #111111;
    border-color: #ffffff;
    color: #ffffff;
    outline: none;
  }

  .btn-danger {
    background: #000000;
    border: 1px solid #777777;
    color: #ff6666;
  }

  .btn-danger:hover,
  .btn-danger:focus {
    background: #330000;
    border-color: #ff3333;
    color: #ff3333;
    outline: none;
  }
</style>
