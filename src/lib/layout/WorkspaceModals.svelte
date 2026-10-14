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
          realm: decoded.realm || "poe",
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
  <div class="toast-banner">{workspaceState.toastMessage}</div>
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
      <h3 class="modal-title">Name Your Project</h3>
      <p class="modal-desc">
        Please enter a name for this project before saving.
      </p>
      <label class="modal-label">
        <span>Project Name</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="modal-input"
          bind:value={promptNameValue}
          placeholder="Enter project name..."
          autofocus
          required
        />
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
      <h3 class="modal-title">
        {workspaceState.importModalMode === "elements"
          ? "Import Elements into Current Project"
          : "Import New Project from Share Code"}
      </h3>
      <p class="modal-desc">
        Paste a Base64 + zlib compressed share code below.
      </p>

      {#if workspaceState.importModalMode === "new-project"}
        <label class="modal-label">
          <span>Project Name (optional)</span>
          <input
            type="text"
            class="modal-input"
            bind:value={newProjectNameInput}
            placeholder="Leave blank for unnamed project"
          />
        </label>
      {/if}

      <label class="modal-label">
        <span>Share Code (Zlib + Base64)</span>
        <textarea
          class="modal-textarea"
          rows="5"
          bind:value={codeInput}
          placeholder="eJxL..."
        ></textarea>
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
      <h3 id="unsaved-heading" class="modal-title">
        This Project has Unsaved changes
      </h3>
      <p class="modal-desc">
        Do you want to save the changes you made to
        <strong
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
    background: #1e293b;
    border: 1px solid #3a57e8;
    color: #f8fafc;
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 2500;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-card {
    width: 440px;
    max-width: 92vw;
    background: #12151e;
    border: 1px solid #2e364f;
    border-radius: 6px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.75);
  }

  .modal-title {
    margin: 0;
    font-size: 15px;
    color: #f1f5f9;
  }

  .modal-desc {
    margin: 0;
    font-size: 12.5px;
    color: #94a3b8;
    line-height: 1.45;
  }

  .modal-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #cbd5e1;
  }

  .modal-input,
  .modal-textarea {
    background: #0b0d13;
    border: 1px solid #2c344b;
    color: #f8fafc;
    border-radius: 4px;
    padding: 7px 9px;
    font-size: 12px;
    font-family: ui-monospace, monospace;
    outline: none;
  }

  .modal-input:focus,
  .modal-textarea:focus {
    border-color: #3a57e8;
  }

  .modal-error {
    color: #f87171;
    font-size: 12px;
    background: rgba(127, 29, 29, 0.25);
    border: 1px solid #7f1d1d;
    padding: 6px 8px;
    border-radius: 4px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .btn-primary {
    background: #2563eb;
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-danger {
    background: #7f1d1d;
    border-color: #b91c1c;
    color: #fecaca;
  }

  .btn-danger:hover {
    background: #991b1b;
  }

  .btn-secondary {
    background: #1e2433;
    border-color: #334155;
    color: #cbd5e1;
  }

  .btn-secondary:hover {
    background: #2b3346;
  }
</style>
