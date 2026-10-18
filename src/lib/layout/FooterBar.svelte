<!-- src/lib/layout/FooterBar.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";

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

  let rateLimiterOpen = $state(false);
  let containerEl: HTMLDivElement | null = null;

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

  let searchRemainingMs = $state(0);
  let fetchRemainingMs = $state(0);
  let searchDeadline = 0;
  let fetchDeadline = 0;

  let countdownInterval: ReturnType<typeof setInterval> | undefined;
  let unlisten: UnlistenFn | undefined;

  function syncPenaltyDeadlines(payload: FullTelemetryState) {
    const now = Date.now();

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

  function handleWindowClick(e: MouseEvent) {
    if (
      rateLimiterOpen &&
      containerEl &&
      !containerEl.contains(e.target as Node)
    ) {
      rateLimiterOpen = false;
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && rateLimiterOpen) {
      rateLimiterOpen = false;
    }
  }

  onMount(async () => {
    try {
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
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<footer>
  <div class="footer">
    <div class="disclaimer">
      This product isn't affiliated with or endorsed by Grinding Gear Games in
      any way.
    </div>

    <div class="footer-actions">
      <div class="ratelimiter-container" bind:this={containerEl}>
        {#if rateLimiterOpen}
          <div
            class="ratelimiter-popover"
            role="dialog"
            aria-label="Rate Limiter Status"
          >
            <header class="popover-header">
              <span class="popover-title">Rate Limiter Telemetry</span>
              {#if searchRemainingMs > 0 || fetchRemainingMs > 0}
                <span class="popover-pill is-penalized">Rate Limited</span>
              {/if}
            </header>

            <div class="telemetry-grid">
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

            <div class="legend-row">
              <span class="legend-chip legend-available">Available</span>
              <span class="legend-chip legend-unavailable">In Use</span>
              <span class="legend-chip legend-reserved">Reserved</span>
            </div>
          </div>
        {/if}

        <button
          type="button"
          class="ratelimiter-btn"
          class:active={rateLimiterOpen}
          class:has-penalty={searchRemainingMs > 0 || fetchRemainingMs > 0}
          aria-expanded={rateLimiterOpen}
          aria-haspopup="dialog"
          onclick={() => (rateLimiterOpen = !rateLimiterOpen)}
        >
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

<style>
  footer {
    border-top: 1px solid #777777;
    background: #000000;
    position: relative;
    z-index: 900;
    height: 26px;
    font-family: "Fontin", monospace, sans-serif;
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

  .disclaimer {
    font-size: 10px;
    color: #888888;
  }

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
    border-left: 1px solid #777777;
    padding: 2px 4px;
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
      background-color: rgba(211, 47, 47, 0.2);
    }
    50% {
      background-color: rgba(255, 82, 82, 0.4);
    }
  }

  .bar-unit {
    position: relative;
    width: 82px;
    height: 100%;
    background-color: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    overflow: hidden;
    display: flex;
    box-sizing: border-box;
  }

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
    font-weight: bold;
    font-family: "Fontin", monospace, sans-serif;
    color: #ffffff;
    text-shadow:
      0 1px 3px rgba(0, 0, 0, 0.95),
      0 0 2px rgba(0, 0, 0, 0.9);
  }

  .penalty-overlay-text {
    font-size: 10px;
    font-weight: bold;
    font-family: "Fontin", monospace, sans-serif;
    color: #ff5252;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  }

  .ratelimiter-popover {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 2px;
    width: 275px;
    background: #050505;
    border: 1px solid #ffffff;
    border-radius: 0px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1200;
  }

  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333333;
    padding-bottom: 4px;
  }

  .popover-title {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: #888888;
  }

  .popover-pill {
    font-size: 9px;
    text-transform: uppercase;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 0px;
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
    background: #000000;
    border: 1px solid #777777;
    border-radius: 0px;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .op-card.penalized {
    border-color: #ff3333;
    background: #1a0000;
  }

  .op-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }

  .op-name {
    font-weight: bold;
    color: #ffffff;
  }

  .op-counts {
    color: #888888;
    font-family: "Fontin", monospace, sans-serif;
  }

  .penalty-tag {
    color: #ff5252;
    font-weight: bold;
    font-family: "Fontin", monospace, sans-serif;
  }

  .bar-pip-track {
    height: 6px;
    background: #000000;
    display: flex;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    overflow: hidden;
  }

  .op-subtext {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #888888;
  }

  .queue-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-top: 1px solid #333333;
    padding-top: 6px;
  }

  .queue-header {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: bold;
    color: #888888;
  }

  .queue-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }

  .queue-label {
    color: #aaaaaa;
  }

  .queue-badges {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .realm-badge {
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #e6c200;
    font-size: 10px;
    padding: 0 4px;
    display: inline-flex;
    gap: 3px;
  }

  .badge-num {
    color: #ffffff;
  }

  .queue-empty {
    color: #666666;
    font-style: italic;
    font-size: 10px;
  }

  .legend-row {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #333333;
    padding-top: 6px;
    font-size: 9px;
    color: #888888;
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
    border-radius: 0px;
  }

  .legend-available::before {
    background-color: #2e7d32;
  }
  .legend-unavailable::before {
    background-color: #1f1f1f;
    border: 1px solid #7f7f7f;
  }
  .legend-reserved::before {
    background-color: #616161;
  }
</style>
