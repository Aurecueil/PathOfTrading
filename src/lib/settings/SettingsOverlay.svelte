<!-- src/lib/settings/SettingsOverlay.svelte -->
<script lang="ts">
  import "$lib/settings/settings.css";
  import { isLoading } from "$lib/trade/tradeStore";
  import BasicTab from "$lib/settings/BasicTab.svelte";
  import StatGroupsTab from "$lib/settings/StatGroupsTab.svelte";
  import ColorCodingTab from "$lib/settings/ColorCodingTab.svelte";
  import {
    settingsOverlay,
    closeSettings,
  } from "$lib/settings/settingsState.svelte";

  type Category = "basic" | "stat-groups" | "color-coding";
  let active = $state<Category>("basic");

  let status = $state("");
  let statusTimer: ReturnType<typeof setTimeout>;
  function setStatus(message: string) {
    status = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status = ""), 3500);
  }

  const categories: { id: Category; label: string }[] = [
    { id: "basic", label: "Basic" },
    { id: "stat-groups", label: "Stat Groups" },
    { id: "color-coding", label: "Color Coding" },
  ];

  function handleBackdropMouseDown(e: MouseEvent) {
    // Only close when the press starts on the backdrop itself, so dragging
    // a text selection out of an input doesn't dismiss the overlay.
    if (e.target === e.currentTarget) closeSettings();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && settingsOverlay.open && !e.defaultPrevented) {
      closeSettings();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if settingsOverlay.open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="settings-backdrop" onmousedown={handleBackdropMouseDown}>
    <div
      class="settings-overlay-card settings-page"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <section class="settings-shell">
        <header class="st-header">
          <h2>Settings</h2>
          <div class="st-header-right">
            {#if status}<span class="st-status">{status}</span>{/if}
            {#if $isLoading}
              <span class="st-status muted" role="status"
                >Fetching trade data…</span
              >
            {/if}
            <button
              type="button"
              class="overlay-close-btn"
              title="Close (Esc)"
              aria-label="Close settings"
              onclick={closeSettings}
            >
              ✕
            </button>
          </div>
        </header>

        <div class="st-layout">
          <nav class="st-nav">
            {#each categories as c}
              <button
                type="button"
                class="st-nav-item"
                class:active={active === c.id}
                onclick={() => (active = c.id)}
              >
                {c.label}
              </button>
            {/each}
          </nav>

          <main class="st-content">
            {#if active === "basic"}
              <BasicTab onStatus={setStatus} />
            {:else if active === "stat-groups"}
              <StatGroupsTab />
            {:else}
              <ColorCodingTab onStatus={setStatus} />
            {/if}
          </main>
        </div>
      </section>
    </div>
  </div>
{/if}

<style>
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1800; /* above menu dropdowns (1100), below login modal (2000) */
    padding: 24px;
  }

  .settings-overlay-card {
    /* cancel .settings-page's full-page layout */
    position: relative;
    inset: auto;
    padding: 0;
    background: #050505;

    width: min(1000px, 100%);
    height: min(680px, 100%);
    border: 1px solid #777777;
    border-radius: 0px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.9);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Make the existing settings shell fill the card instead of the page */
  .settings-overlay-card :global(.settings-shell) {
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: none;
    height: 100%;
    margin: 0;
  }

  .overlay-close-btn {
    background: transparent;
    border: none;
    border-radius: 0px;
    color: #888888;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 2px 6px;
    margin-left: 6px;
  }

  .overlay-close-btn:hover {
    color: #ff5555;
  }
</style>
