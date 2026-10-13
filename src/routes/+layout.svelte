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

  function syncPenaltyDeadlines(payload: FullTelemetryState) {
    const now = Date.now();

    // 1. Search reconciliation
    if (payload.search.retry_after_ms <= 0) {
      searchDeadline = 0;
      searchRemainingMs = 0;
    } else {
      const currentExpected = Math.max(0, searchDeadline - now);
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
    const unreservedCap = Math.max(0, total - reserved);

    const hits = Math.max(0, total - op.available_requests);
    const available = Math.max(0, unreservedCap - hits);
    const used = Math.min(hits, unreservedCap);

    return {
      total,
      unreservedCap,
      available,
      used,
      reserved,
      availablePct: (available / total) * 100,
      usedPct: (used / total) * 100,
      reservedPct: (reserved / total) * 100,
    };
  }

  function sumQueueCounts(realmCounts: Record<string, number> = {}): number {
    return Object.values(realmCounts).reduce((acc, curr) => acc + curr, 0);
  }

  function formatMs(ms: number): string {
    if (ms <= 0) return "0s";
    return ms < 10000
      ? `${(ms / 1000).toFixed(1)}s`
      : `${Math.ceil(ms / 1000)}s`;
  }

  const searchQueueCount = $derived(
    sumQueueCounts(rateState.queue_status?.search),
  );
  const fetchQueueCount = $derived(
    sumQueueCounts(rateState.queue_status?.fetch),
  );

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

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeAllMenus();
    }
  }
</script>

<svelte:window onclick={closeAllMenus} onkeydown={handleKeydown} />

<div class="shell">
  <header class="header-bar">
    <div class="menu-group">
      <div class="menu-item-container">
        <button
          type="button"
          class="menu-btn"
          class:active={fileMenuOpen}
          aria-expanded={fileMenuOpen}
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
              role="dialog"
              aria-label="Rate Limiter Status"
              onclick={(e) => e.stopPropagation()}
            >
              <header class="popover-header">
                <span class="popover-title">Rate Limiter Telemetry</span>
                {#if searchRemainingMs > 0 || fetchRemainingMs > 0}
                  <span class="popover-pill is-penalized">Rate Limited</span>
                {/if}
              </header>

              <div class="telemetry-grid">
                <!-- Search Metric -->
                <div class="op-card" class:penalized={searchRemainingMs > 0}>
                  <div class="op-header">
                    <span class="op-name">Search API</span>
                    {#if searchRemainingMs > 0}
                      <span class="penalty-tag"
                        >cooldown: {formatMs(searchRemainingMs)}</span
                      >
                    {:else}
                      <span class="op-counts"
                        >{searchBar.available} / {searchBar.unreservedCap}</span
                      >
                    {/if}
                  </div>

                  <div class="bar-pip-track">
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

                  <div class="op-subtext">
                    <span>Used: {searchBar.used}</span>
                    <span>Reserved: {searchBar.reserved}</span>
                    <span>Queued: {searchQueueCount}</span>
                  </div>
                </div>

                <!-- Fetch Metric -->
                <div class="op-card" class:penalized={fetchRemainingMs > 0}>
                  <div class="op-header">
                    <span class="op-name">Fetch API</span>
                    {#if fetchRemainingMs > 0}
                      <span class="penalty-tag"
                        >cooldown: {formatMs(fetchRemainingMs)}</span
                      >
                    {:else}
                      <span class="op-counts"
                        >{fetchBar.available} / {fetchBar.unreservedCap}</span
                      >
                    {/if}
                  </div>

                  <div class="bar-pip-track">
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

                  <div class="op-subtext">
                    <span>Used: {fetchBar.used}</span>
                    <span>Reserved: {fetchBar.reserved}</span>
                    <span>Queued: {fetchQueueCount}</span>
                  </div>
                </div>
              </div>

              <!-- Queues -->
              <div class="queue-section">
                <div class="queue-header">Active Queues</div>

                <div class="queue-row">
                  <span class="queue-label">Search ({searchQueueCount}):</span>
                  <div class="queue-badges">
                    {#each Object.entries(rateState.queue_status?.search || {}) as [realm, count]}
                      <span class="realm-badge"
                        >{realm}
                        <strong class="badge-num">{count}</strong></span
                      >
                    {:else}
                      <span class="queue-empty">idle</span>
                    {/each}
                  </div>
                </div>

                <div class="queue-row">
                  <span class="queue-label">Fetch ({fetchQueueCount}):</span>
                  <div class="queue-badges">
                    {#each Object.entries(rateState.queue_status?.fetch || {}) as [realm, count]}
                      <span class="realm-badge"
                        >{realm}
                        <strong class="badge-num">{count}</strong></span
                      >
                    {:else}
                      <span class="queue-empty">idle</span>
                    {/each}
                  </div>
                </div>
              </div>

              <!-- Legend -->
              <div class="legend-row">
                <span class="legend-chip legend-available">Available</span>
                <span class="legend-chip legend-unavailable">In Use</span>
                <span class="legend-chip legend-reserved">Reserved</span>
              </div>
            </div>
          {/if}

          <!-- Footer Trigger Button -->
          <button
            type="button"
            class="ratelimiter-btn"
            class:active={rateLimiterOpen}
            class:has-penalty={searchRemainingMs > 0 || fetchRemainingMs > 0}
            aria-expanded={rateLimiterOpen}
            aria-haspopup="dialog"
            onclick={toggleRateMenu}
          >
            <!-- Search Bar Unit -->
            <div
              class="bar-unit"
              title="Search: {searchBar.available} / {searchBar.unreservedCap} (Max: {searchBar.total}, Reserved: {searchBar.reserved})"
            >
              <div class="segment-track">
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

              <div class="bar-overlay">
                {#if searchRemainingMs > 0}
                  <span class="penalty-overlay-text"
                    >{formatMs(searchRemainingMs)}</span
                  >
                {:else}
                  <span class="count-overlay-text"
                    >{searchBar.available}/{searchBar.unreservedCap}</span
                  >
                {/if}
              </div>
            </div>

            <!-- Fetch Bar Unit -->
            <div
              class="bar-unit"
              title="Fetch: {fetchBar.available} / {fetchBar.unreservedCap} (Max: {fetchBar.total}, Reserved: {fetchBar.reserved})"
            >
              <div class="segment-track">
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

              <div class="bar-overlay">
                {#if fetchRemainingMs > 0}
                  <span class="penalty-overlay-text"
                    >{formatMs(fetchRemainingMs)}</span
                  >
                {:else}
                  <span class="count-overlay-text"
                    >{fetchBar.available}/{fetchBar.unreservedCap}</span
                  >
                {/if}
              </div>
            </div>
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

  .menu-btn {
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
  }

  .menu-btn:hover {
    border-color: #888888;
    background-color: #1a1a1a;
  }

  .menu-btn.active {
    background-color: #333333;
    border-color: #ffffff;
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
    height: 26px;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 0.5rem;
    padding-right: 0;
    width: 100%;
    box-sizing: border-box;
    height: 100%;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    height: 100%;
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

  /* Ratelimiter Footer Full Height Widget */
  .ratelimiter-container {
    position: relative;
    height: 100%;
    display: flex;
    align-items: stretch;
  }

  .ratelimiter-btn {
    display: flex;
    align-items: stretch;
    height: 100%;
    gap: 4px;
    background: transparent;
    border: none;
    border-left: 1px solid #333333;
    padding: 3px 4px; /* 3px vertical padding */
    cursor: pointer;
    box-sizing: border-box;
    outline: none;
    transition: background-color 0.15s;
  }

  .ratelimiter-btn:hover {
    background-color: #161616;
  }

  .ratelimiter-btn.active {
    background-color: #242424;
  }

  .ratelimiter-btn.has-penalty {
    animation: border-alert 1.4s infinite ease-in-out;
  }

  @keyframes border-alert {
    0%,
    100% {
      background-color: rgba(211, 47, 47, 0.15);
    }
    50% {
      background-color: rgba(255, 82, 82, 0.3);
    }
  }

  /* Distinct Bar Units */
  .bar-unit {
    position: relative;
    width: 82px;
    height: 100%;
    background-color: #111111;
    border: 1px solid #2e2e2e;
    overflow: hidden;
    display: flex;
    box-sizing: border-box;
  }

  /* Main Segment Track */
  .segment-track {
    flex: 1;
    display: flex;
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1;
  }

  .seg {
    height: 100%;
    transition: width 0.12s ease-out;
  }
  .seg-available {
    background-color: #2e7d32;
  }
  .seg-unavailable {
    background-color: #1f1f1f;
  }
  .seg-reserved {
    background-color: #616161;
  }

  /* Overlay Count Text */
  .bar-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    pointer-events: none;
  }

  .count-overlay-text {
    font-size: 10px;
    font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #ffffff;
    text-shadow:
      0 1px 3px rgba(0, 0, 0, 0.95),
      0 0 2px rgba(0, 0, 0, 0.9);
    letter-spacing: -0.2px;
  }

  .penalty-overlay-text {
    font-size: 10px;
    font-weight: 800;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #ff5252;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  }

  /* Ratelimiter Popover */
  .ratelimiter-popover {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
    width: 275px;
    background: #0d0d0d;
    border: 1px solid #444444;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.9);
    padding: 10px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 1200;
  }

  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #222222;
    padding-bottom: 6px;
  }

  .popover-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888888;
  }

  .popover-pill {
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 700;
    padding: 1px 5px;
  }

  .popover-pill.is-penalized {
    background: #2e0808;
    color: #ef5350;
    border: 1px solid #c62828;
  }

  .telemetry-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .op-card {
    background: #141414;
    border: 1px solid #2a2a2a;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .op-card.penalized {
    border-color: #7f1d1d;
    background: #180d0d;
  }

  .op-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }

  .op-name {
    font-weight: 600;
    color: #d4d4d4;
  }

  .op-counts {
    color: #888888;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .penalty-tag {
    color: #ef5350;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .bar-pip-track {
    height: 6px;
    background: #000000;
    display: flex;
    border: 1px solid #222222;
    overflow: hidden;
  }

  .op-subtext {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #666666;
  }

  .queue-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-top: 1px solid #1f1f1f;
    padding-top: 6px;
  }

  .queue-header {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    color: #666666;
  }

  .queue-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }

  .queue-label {
    color: #999999;
  }

  .queue-badges {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .realm-badge {
    background: #1c1917;
    border: 1px solid #443722;
    color: #f59e0b;
    font-size: 10px;
    padding: 0 4px;
    display: inline-flex;
    gap: 3px;
  }

  .badge-num {
    color: #ffffff;
  }

  .queue-empty {
    color: #444444;
    font-style: italic;
    font-size: 10px;
  }

  .legend-row {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #1f1f1f;
    padding-top: 6px;
    font-size: 9px;
    color: #777777;
  }

  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .legend-chip::before {
    content: "";
    width: 6px;
    height: 6px;
    display: block;
  }

  .legend-available::before {
    background-color: #2e7d32;
  }
  .legend-unavailable::before {
    background-color: #222222;
    border: 1px solid #444444;
  }
  .legend-reserved::before {
    background-color: #616161;
  }
</style>
