<script lang="ts">
  import { openTabs, closeProject } from "../lib/projects.svelte";
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core"; // If using Tauri v1: "@tauri-apps/api/tauri"
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { initItemData } from "$lib/types/tradeStore";

  let { children } = $props();

  // Menu State
  let fileMenuOpen = $state(false);

  // Rate Limiter State
  interface LimiterStatus {
    max: number;
    window_secs: number;
    current_count: number;
    penalty_seconds_left: number;
    queued_ids: number[];
  }

  interface FullLimiterState {
    search: LimiterStatus;
    fetch: LimiterStatus;
  }

  let rateLimiterOpen = $state(false);
  let rateState = $state<FullLimiterState>({
    search: {
      max: 0,
      window_secs: 0,
      current_count: 0,
      penalty_seconds_left: 0,
      queued_ids: [],
    },
    fetch: {
      max: 0,
      window_secs: 0,
      current_count: 0,
      penalty_seconds_left: 0,
      queued_ids: [],
    },
  });

  let unlisten: UnlistenFn | undefined;
  let timerInterval: ReturnType<typeof setInterval>;

  onMount(async () => {
    // 1. Initial snapshot fetch from Tauri
    try {
      initItemData();
      rateState = await invoke<FullLimiterState>("get_limiter_state");
    } catch {
      // Ignored if called during non-tauri dev previews
    }

    // 2. Listen to live updates from Rust worker
    try {
      unlisten = await listen<FullLimiterState>("limiter-update", (event) => {
        rateState = event.payload;
      });
    } catch {
      // Dev mode fallback
    }

    // 3. UI-side 1s tick countdown for penalties
    timerInterval = setInterval(() => {
      if (rateState.search.penalty_seconds_left > 0)
        rateState.search.penalty_seconds_left--;
      if (rateState.fetch.penalty_seconds_left > 0)
        rateState.fetch.penalty_seconds_left--;
    }, 1000);
  });

  onDestroy(() => {
    if (unlisten) unlisten();
    clearInterval(timerInterval);
  });

  function toggleFileMenu(event: MouseEvent) {
    event.stopPropagation();
    fileMenuOpen = !fileMenuOpen;
  }

  function toggleRateMenu(event: MouseEvent) {
    event.stopPropagation();
    rateLimiterOpen = !rateLimiterOpen;
  }

  function closeAllMenus() {
    fileMenuOpen = false;
    rateLimiterOpen = false;
  }

  function handleAction(actionName: string) {
    closeAllMenus();
    console.log(`Action triggered: ${actionName}`);
  }
</script>

<svelte:window onclick={closeAllMenus} />

<div class="shell">
  <header class="header-bar">
    <div class="menu-group">
      <div class="menu-item-container">
        <button
          type="button"
          class="menu-btn"
          class:active={fileMenuOpen}
          onclick={toggleFileMenu}
        >
          File
        </button>

        {#if fileMenuOpen}
          <div class="dropdown-menu">
            <button
              type="button"
              class="dropdown-item"
              onclick={() => handleAction("new")}
            >
              <span>New File</span>
              <kbd>Ctrl+N</kbd>
            </button>
            <button
              type="button"
              class="dropdown-item"
              onclick={() => handleAction("open")}
            >
              <span>Open...</span>
              <kbd>Ctrl+O</kbd>
            </button>
            <div class="divider"></div>
            <button
              type="button"
              class="dropdown-item"
              onclick={() => handleAction("save")}
            >
              <span>Save</span>
              <kbd>Ctrl+S</kbd>
            </button>
          </div>
        {/if}
      </div>
    </div>
    <nav class="tabs">
      {#each openTabs as tab (tab.id)}
        <div class="tab">
          <a href="/projects/{tab.id}">{tab.name}</a>
          <button
            class="tab-close-btn"
            type="button"
            onclick={() => closeProject(tab.id)}>×</button
          >
        </div>
      {/each}
    </nav>
  </header>

  <!-- Route content -->
  <main class="content">
    {@render children()}
  </main>

  <!-- Footer with Rate Limiter -->
  <footer>
    <div class="footer">
      <div class="disclaimer">
        This product isn't affiliated with or endorsed by Grinding Gear Games in
        any way.
      </div>

      <div class="footer-actions">
        <div class="divider-horizontal"></div>

        <div class="ratelimiter-container">
          {#if rateLimiterOpen}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="ratelimiter-popover"
              onclick={(e) => e.stopPropagation()}
            >
              <div class="popover-title">Queue Inspector</div>

              <div class="queue-row">
                <span class="queue-label"
                  >Search ({rateState.search.queued_ids.length} awaiting):</span
                >
                <span class="queue-ids">
                  {rateState.search.queued_ids.length > 0
                    ? rateState.search.queued_ids.join(", ")
                    : "none"}
                </span>
              </div>

              <div class="queue-row">
                <span class="queue-label"
                  >Fetch ({rateState.fetch.queued_ids.length} awaiting):</span
                >
                <span class="queue-ids">
                  {rateState.fetch.queued_ids.length > 0
                    ? rateState.fetch.queued_ids.join(", ")
                    : "none"}
                </span>
              </div>
            </div>
          {/if}

          <button
            type="button"
            class="ratelimiter"
            class:active={rateLimiterOpen}
            class:has-penalty={rateState.search.penalty_seconds_left > 0 ||
              rateState.fetch.penalty_seconds_left > 0}
            onclick={toggleRateMenu}
          >
            Ratelimit:
            <!-- Search state -->
            {#if rateState.search.penalty_seconds_left > 0}
              <span class="penalty-text"
                >Search: {rateState.search.penalty_seconds_left}s</span
              >
            {:else}
              <span
                >S: {rateState.search.current_count}/{rateState.search.max ||
                  0}</span
              >
            {/if}

            <span class="bar-separator">|</span>

            <!-- Fetch state -->
            {#if rateState.fetch.penalty_seconds_left > 0}
              <span class="penalty-text"
                >Fetch: {rateState.fetch.penalty_seconds_left}s</span
              >
            {:else}
              <span
                >F: {rateState.fetch.current_count}/{rateState.fetch.max ||
                  0}</span
              >
            {/if}

            <span class="queue-count"
              >({rateState.search.queued_ids.length +
                rateState.fetch.queued_ids.length})</span
            >
          </button>
        </div>
      </div>
    </div>
  </footer>
</div>

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial,
      sans-serif;
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

  /* Header & Navigation Bar */
  .header-bar {
    min-height: 28px;
    background: #000000;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    padding: 3px 4px;
    box-sizing: border-box;
    position: relative;
    z-index: 1000;
    border-bottom: 1px solid #333333;
  }

  .menu-group {
    display: flex;
    align-items: center;
  }

  .menu-item-container {
    position: relative;
  }

  /* Classic PoB Buttons */
  .menu-btn,
  .ratelimiter {
    background-color: #000000;
    color: #ffffff;
    border: 1px solid #555555;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    line-height: 1;
    padding: 3px 8px;
    cursor: pointer;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .menu-btn:hover,
  .ratelimiter:hover {
    border-color: #888888;
    background-color: #1a1a1a;
  }

  .menu-btn.active,
  .ratelimiter.active {
    background-color: #4a4a4a;
    border-color: #ffffff;
    color: #ffffff;
  }

  .ratelimiter.has-penalty {
    border-color: #d32f2f;
  }

  .penalty-text {
    color: #ff5252;
    font-weight: 600;
  }

  .bar-separator {
    color: #555555;
  }

  .queue-count {
    color: #aaaaaa;
    font-size: 11px;
  }

  /* Tabs container & items */
  .tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 2px;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background-color: #000000;
    border: 1px solid #555555;
    border-radius: 0;
    padding: 2px 6px 2px 8px;
    box-sizing: border-box;
    font-size: 13px;
    line-height: 1;
  }

  .tab:hover {
    border-color: #888888;
    background-color: #1a1a1a;
  }

  .tab a {
    color: #ffffff;
    text-decoration: none;
    font-size: 13px;
    font-family: inherit;
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

  /* Dropdown styling */
  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 170px;
    background: #000000;
    border: 1px solid #666666;
    border-radius: 0;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.8);
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
    border-radius: 0;
    color: #ffffff;
    padding: 4px 10px;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
  }

  .dropdown-item:hover {
    background: #333333;
    color: #ffffff;
  }

  .dropdown-item kbd {
    font-size: 11px;
    color: #aaaaaa;
    background: transparent;
    padding: 0;
  }

  .divider {
    height: 1px;
    background: #444444;
    margin: 2px 0;
  }

  /* Main routed content */
  /* Main routed content */
  .content {
    flex: 1;
    position: relative; /* establishes coordinate space for .viewport */
    overflow: hidden; /* prevents page scrollbars */
    background-color: #000000;
    user-select: text;
  }

  /* Footer */
  footer {
    border-top: 1px solid #333333;
    background: #000000;
    position: relative;
    z-index: 900;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0.5rem;
    width: 100%;
    box-sizing: border-box;
    height: 26px;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .divider-horizontal {
    width: 1px;
    height: 14px;
    background-color: #444444;
  }

  .disclaimer {
    font-size: 10px;
    color: #666666;
  }

  /* Rate Limiter Popover */
  .ratelimiter-container {
    position: relative;
  }

  .ratelimiter-popover {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
    min-width: 220px;
    background: #000000;
    border: 1px solid #666666;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.9);
    padding: 6px 8px;
    font-size: 12px;
    font-family: monospace;
    z-index: 1200;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .popover-title {
    font-weight: bold;
    color: #aaaaaa;
    border-bottom: 1px solid #333333;
    padding-bottom: 3px;
    margin-bottom: 2px;
  }

  .queue-row {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .queue-label {
    color: #ffffff;
  }

  .queue-ids {
    color: #ffb74d;
    padding-left: 6px;
    word-break: break-all;
  }
</style>
