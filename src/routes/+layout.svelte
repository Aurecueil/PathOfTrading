<script lang="ts">
  import { openTabs, closeProject } from "../lib/projects.svelte";
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { initItemData } from "$lib/types/tradeStore";

  let { children } = $props();

  // Menu State
  let fileMenuOpen = $state(false);
  let rateLimiterOpen = $state(false);

  interface OperationTelemetry {
    max_requests: number;
    available_requests: number;
    reserved_requests: Record<string, number>;
    is_rate_limited: boolean;
    retry_after_ms: number;
  }

  interface FullTelemetryState {
    search: OperationTelemetry;
    fetch: OperationTelemetry;
    queue_status: Record<string, Record<string, number>>;
  }

  let rateState = $state<FullTelemetryState>({
    search: {
      max_requests: 12,
      available_requests: 12,
      reserved_requests: { outside: 1 },
      is_rate_limited: false,
      retry_after_ms: 0,
    },
    fetch: {
      max_requests: 12,
      available_requests: 12,
      reserved_requests: { outside: 1 },
      is_rate_limited: false,
      retry_after_ms: 0,
    },
    queue_status: {
      search: {},
      fetch: {},
    },
  });

  // Dynamic countdown states (remaining ms rendered live)
  let searchRemainingMs = $state(0);
  let fetchRemainingMs = $state(0);

  // Target timestamps in UNIX epoch ms
  let searchDeadline = 0;
  let fetchDeadline = 0;

  let countdownInterval: ReturnType<typeof setInterval> | undefined;
  let unlisten: UnlistenFn | undefined;

  /**
   * Reconciles backend retry_after_ms with the local ticking deadline.
   * Tolerates minor timing drift without visual stutter.
   */
  function syncPenaltyDeadlines(payload: FullTelemetryState) {
    const now = Date.now();

    // 1. Search reconciliation
    if (payload.search.retry_after_ms <= 0) {
      searchDeadline = 0;
      searchRemainingMs = 0;
    } else {
      const currentExpected = Math.max(0, searchDeadline - now);
      // Re-anchor if not running or if difference exceeds 250ms drift
      if (
        searchDeadline === 0 ||
        Math.abs(currentExpected - payload.search.retry_after_ms) > 250
      ) {
        searchDeadline = now + payload.search.retry_after_ms;
        searchRemainingMs = payload.search.retry_after_ms;
      }
    }

    // 2. Fetch reconciliation
    if (payload.fetch.retry_after_ms <= 0) {
      fetchDeadline = 0;
      fetchRemainingMs = 0;
    } else {
      const currentExpected = Math.max(0, fetchDeadline - now);
      if (
        fetchDeadline === 0 ||
        Math.abs(currentExpected - payload.fetch.retry_after_ms) > 250
      ) {
        fetchDeadline = now + payload.fetch.retry_after_ms;
        fetchRemainingMs = payload.fetch.retry_after_ms;
      }
    }
  }

  function sumReserved(reservedMap: Record<string, number> = {}): number {
    return Object.values(reservedMap).reduce((acc, curr) => acc + curr, 0);
  }

  function getBarSlots(op: OperationTelemetry) {
    const total = op.max_requests || 12;
    const reserved = Math.min(sumReserved(op.reserved_requests), total);
    const unreservedCap = total - reserved;

    const hits = Math.max(0, total - op.available_requests);
    const available = Math.max(0, unreservedCap - hits);
    const used = Math.min(hits, unreservedCap);

    return {
      availablePct: (available / total) * 100,
      usedPct: (used / total) * 100,
      reservedPct: (reserved / total) * 100,
      availableCount: available,
      totalCount: total,
    };
  }

  function sumQueueCounts(realmCounts: Record<string, number> = {}): number {
    return Object.values(realmCounts).reduce((acc, curr) => acc + curr, 0);
  }

  const searchQueueCount = $derived(
    sumQueueCounts(rateState.queue_status?.search),
  );
  const fetchQueueCount = $derived(
    sumQueueCounts(rateState.queue_status?.fetch),
  );
  const totalQueueCount = $derived(searchQueueCount + fetchQueueCount);

  const searchBar = $derived(getBarSlots(rateState.search));
  const fetchBar = $derived(getBarSlots(rateState.fetch));

  onMount(async () => {
    try {
      initItemData();
      const initial = await invoke<FullTelemetryState>("get_limiter_state");
      if (initial) {
        rateState = { ...initial };
        syncPenaltyDeadlines(initial);
      }
    } catch {
      // Dev mode fallback
    }

    try {
      unlisten = await listen<FullTelemetryState>("limiter-update", (event) => {
        rateState = { ...event.payload };
        syncPenaltyDeadlines(event.payload);
      });
    } catch {
      // Dev mode fallback
    }

    // Smooth 100ms local clock for countdown labels
    countdownInterval = setInterval(() => {
      const now = Date.now();

      if (searchDeadline > 0) {
        searchRemainingMs = Math.max(0, searchDeadline - now);
        if (searchRemainingMs === 0) searchDeadline = 0;
      }

      if (fetchDeadline > 0) {
        fetchRemainingMs = Math.max(0, fetchDeadline - now);
        if (fetchRemainingMs === 0) fetchDeadline = 0;
      }
    }, 100);
  });

  onDestroy(() => {
    if (unlisten) unlisten();
    if (countdownInterval) clearInterval(countdownInterval);
  });

  function toggleFileMenu(event: MouseEvent) {
    event.stopPropagation();
    fileMenuOpen = !fileMenuOpen;
    rateLimiterOpen = false;
  }

  function toggleRateMenu(event: MouseEvent) {
    event.stopPropagation();
    rateLimiterOpen = !rateLimiterOpen;
    fileMenuOpen = false;
  }

  function closeAllMenus() {
    fileMenuOpen = false;
    rateLimiterOpen = false;
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
          <div
            class="dropdown-menu"
            role="presentation"
            onclick={(e) => e.stopPropagation()}
          >
            <button type="button" class="dropdown-item">
              <span>New File</span>
              <kbd>Ctrl+N</kbd>
            </button>
            <button type="button" class="dropdown-item">
              <span>Open...</span>
              <kbd>Ctrl+O</kbd>
            </button>
            <div class="divider"></div>
            <button type="button" class="dropdown-item">
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

  <main class="content">
    {@render children()}
  </main>

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
            <div
              class="ratelimiter-popover"
              role="presentation"
              onclick={(e) => e.stopPropagation()}
            >
              <div class="popover-title">Queue & Limiter Telemetry</div>

              <div class="queue-row">
                <span class="queue-label"
                  >Search ({searchQueueCount} queued):</span
                >
                <span class="queue-details">
                  {#each Object.entries(rateState.queue_status?.search || {}) as [realm, count]}
                    <span class="realm-badge">{realm}: {count}</span>
                  {:else}
                    <span class="queue-empty">idle</span>
                  {/each}
                </span>
              </div>

              <div class="queue-row">
                <span class="queue-label"
                  >Fetch ({fetchQueueCount} queued):</span
                >
                <span class="queue-details">
                  {#each Object.entries(rateState.queue_status?.fetch || {}) as [realm, count]}
                    <span class="realm-badge">{realm}: {count}</span>
                  {:else}
                    <span class="queue-empty">idle</span>
                  {/each}
                </span>
              </div>

              <div class="legend-row">
                <span class="legend-chip legend-available">Available</span>
                <span class="legend-chip legend-unavailable">In Use</span>
                <span class="legend-chip legend-reserved">Reserved</span>
              </div>
            </div>
          {/if}

          <button
            type="button"
            class="ratelimiter"
            class:active={rateLimiterOpen}
            class:has-penalty={searchRemainingMs > 0 || fetchRemainingMs > 0}
            onclick={toggleRateMenu}
          >
            <!-- Search Healthbar Block -->
            <span class="bar-label">S</span>
            {#if searchRemainingMs > 0}
              <span class="penalty-text"
                >{Math.ceil(searchRemainingMs / 1000)}s</span
              >
            {:else}
              <div
                class="healthbar"
                title="Search: {searchBar.availableCount} available / {searchBar.totalCount} total"
              >
                <div
                  class="seg seg-available"
                  style="width: {searchBar.availablePct}%;"
                ></div>
                <div
                  class="seg seg-unavailable"
                  style="width: {searchBar.usedPct}%;"
                ></div>
                <div
                  class="seg seg-reserved"
                  style="width: {searchBar.reservedPct}%;"
                ></div>
              </div>
            {/if}

            <span class="bar-separator">|</span>

            <!-- Fetch Healthbar Block -->
            <span class="bar-label">F</span>
            {#if fetchRemainingMs > 0}
              <span class="penalty-text"
                >{Math.ceil(fetchRemainingMs / 1000)}s</span
              >
            {:else}
              <div
                class="healthbar"
                title="Fetch: {fetchBar.availableCount} available / {fetchBar.totalCount} total"
              >
                <div
                  class="seg seg-available"
                  style="width: {fetchBar.availablePct}%;"
                ></div>
                <div
                  class="seg seg-unavailable"
                  style="width: {fetchBar.usedPct}%;"
                ></div>
                <div
                  class="seg seg-reserved"
                  style="width: {fetchBar.reservedPct}%;"
                ></div>
              </div>
            {/if}

            <span class="queue-count">({totalQueueCount})</span>
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

  .menu-btn,
  .ratelimiter {
    background-color: #000000;
    color: #ffffff;
    border: 1px solid #555555;
    border-radius: 0;
    font-size: 12px;
    font-family: inherit;
    line-height: 1;
    padding: 2px 7px;
    cursor: pointer;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .menu-btn:hover,
  .ratelimiter:hover {
    border-color: #888888;
    background-color: #1a1a1a;
  }

  .menu-btn.active,
  .ratelimiter.active {
    background-color: #333333;
    border-color: #ffffff;
    color: #ffffff;
  }

  .ratelimiter.has-penalty {
    border-color: #d32f2f;
  }

  .bar-label {
    font-weight: 700;
    font-size: 11px;
    color: #cccccc;
  }

  .healthbar {
    width: 48px;
    height: 9px;
    background-color: #1a1a1a;
    display: flex;
    overflow: hidden;
    border: 1px solid #444444;
    box-sizing: border-box;
  }

  .seg {
    height: 100%;
    transition: width 0.08s linear;
  }

  .seg-available {
    background-color: #388e3c;
  }

  .seg-unavailable {
    background-color: #2b2b2b;
  }

  .seg-reserved {
    background-color: #8a8a8a;
  }

  .penalty-text {
    color: #ff5252;
    font-weight: 700;
    font-size: 11px;
    font-family: monospace;
    min-width: 18px;
    text-align: center;
  }

  .bar-separator {
    color: #555555;
  }

  .queue-count {
    color: #aaaaaa;
    font-size: 11px;
  }

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

  .content {
    flex: 1;
    position: relative;
    overflow: hidden;
    background-color: #000000;
    user-select: text;
  }

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

  .ratelimiter-container {
    position: relative;
  }

  .ratelimiter-popover {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
    min-width: 240px;
    background: #000000;
    border: 1px solid #666666;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.9);
    padding: 6px 8px;
    font-size: 12px;
    font-family: monospace;
    z-index: 1200;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .popover-title {
    font-weight: bold;
    color: #aaaaaa;
    border-bottom: 1px solid #333333;
    padding-bottom: 3px;
  }

  .queue-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .queue-label {
    color: #ffffff;
  }

  .queue-details {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-left: 6px;
  }

  .realm-badge {
    background-color: #1f1f1f;
    border: 1px solid #444444;
    padding: 1px 4px;
    font-size: 10px;
    color: #ffb74d;
  }

  .queue-empty {
    color: #666666;
    font-style: italic;
  }

  .legend-row {
    display: flex;
    gap: 8px;
    border-top: 1px solid #222222;
    padding-top: 4px;
    margin-top: 2px;
    font-size: 10px;
  }

  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .legend-chip::before {
    content: "";
    width: 7px;
    height: 7px;
    display: inline-block;
  }

  .legend-available::before {
    background-color: #388e3c;
  }

  .legend-unavailable::before {
    background-color: #2b2b2b;
    border: 1px solid #555555;
  }

  .legend-reserved::before {
    background-color: #8a8a8a;
  }
</style>
