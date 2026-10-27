<!-- src/lib/layout/FooterBar.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";

  interface RuleTelemetry {
    id: string; // "account" | "ip1" | "ip2" ...
    kind: "account" | "ip";
    max: number;
    window_secs: number;
    used: number;
    reserved_free: number;
    available: number;
    penalty_ms: number;
    next_slot_ms: number;
  }

  interface OperationTelemetry {
    rules: RuleTelemetry[];
    reserved_requests: Record<string, number[]>;
    is_rate_limited: boolean;
    retry_after_ms: number;
    next_available_ms: number;
  }

  interface FullTelemetryState {
    search: OperationTelemetry;
    fetch: OperationTelemetry;
    queue_status: Record<string, Record<string, number>>;
    cf_paused: boolean;
  }

  const emptyOp = (): OperationTelemetry => ({
    rules: [],
    reserved_requests: {},
    is_rate_limited: false,
    retry_after_ms: 0,
    next_available_ms: 0,
  });

  let rateLimiterOpen = $state(false);
  let containerEl: HTMLDivElement | null = null;

  let rateState = $state<FullTelemetryState>({
    search: emptyOp(),
    fetch: emptyOp(),
    queue_status: { search: {}, fetch: {} },
    cf_paused: false,
  });

  // Countdowns: the backend sends relative ms; we interpolate locally from the
  // moment the payload arrived.
  let receivedAt = $state(Date.now());
  let nowTick = $state(Date.now());

  let unlisten: UnlistenFn | undefined;

  function applyState(p: FullTelemetryState) {
    rateState = { ...p };
    receivedAt = Date.now();
    nowTick = receivedAt;
  }

  function remaining(ms: number): number {
    if (ms <= 0) return 0;
    return Math.max(0, ms - (nowTick - receivedAt));
  }

  const anyCountdown = $derived(
    [rateState.search, rateState.fetch].some(
      (op) =>
        op.next_available_ms > 0 ||
        op.retry_after_ms > 0 ||
        op.rules.some((r) => r.penalty_ms > 0 || r.next_slot_ms > 0),
    ),
  );

  // Only tick while something is actually counting down
  $effect(() => {
    if (!anyCountdown) return;
    const id = setInterval(() => {
      nowTick = Date.now();
    }, 100);
    return () => clearInterval(id);
  });

  function formatMs(ms: number): string {
    if (ms <= 0) return "0s";
    if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
    const s = Math.ceil(ms / 1000);
    if (s < 120) return `${s}s`;
    if (s < 7200) return `${Math.ceil(s / 60)}m`;
    return `${Math.ceil(s / 3600)}h`;
  }

  function windowLabel(secs: number): string {
    if (secs >= 3600 && secs % 3600 === 0) return `${secs / 3600}h`;
    if (secs >= 60 && secs % 60 === 0) return `${secs / 60}m`;
    return `${secs}s`;
  }

  function ruleLabel(r: RuleTelemetry): string {
    return `${r.kind === "account" ? "Acc" : "IP"} ${windowLabel(r.window_secs)}`;
  }

  function pct(r: RuleTelemetry) {
    const m = Math.max(1, r.max);
    return {
      avail: (r.available / m) * 100,
      used: (r.used / m) * 100,
      reserved: (r.reserved_free / m) * 100,
    };
  }

  // The limit that is closest to being full (penalised rules count as full)
  function fill(r: RuleTelemetry): number {
    // If a rule has an active penalty or next slot delay, push it to the absolute top of criticality
    if (r.penalty_ms > 0 || r.next_slot_ms > 0) {
      return -1;
    }
    // Otherwise, the score is simply the flat available count (lower = more critical)
    return r.available;
  }

  function criticalRule(op: OperationTelemetry): RuleTelemetry | null {
    if (!op.rules || op.rules.length === 0) return null;
    return op.rules.reduce((a, b) => {
      const scoreA = fill(a);
      const scoreB = fill(b);
      // Pick the one with the lower score (fewer available / penalized)
      return scoreB < scoreA ? b : a;
    });
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

  const searchCrit = $derived(criticalRule(rateState.search));
  const fetchCrit = $derived(criticalRule(rateState.fetch));

  const miniBars = $derived([
    {
      key: "search",
      name: "Search",
      op: rateState.search,
      crit: searchCrit,
    },
    {
      key: "fetch",
      name: "Fetch",
      op: rateState.fetch,
      crit: fetchCrit,
    },
  ]);

  const columns = $derived([
    {
      key: "search",
      title: "Search API",
      op: rateState.search,
      queue: rateState.queue_status?.search ?? {},
      queued: searchQueueCount,
    },
    {
      key: "fetch",
      title: "Fetch API",
      op: rateState.fetch,
      queue: rateState.queue_status?.fetch ?? {},
      queued: fetchQueueCount,
    },
  ]);

  const hasPenalty = $derived(
    remaining(rateState.search.retry_after_ms) > 0 ||
      remaining(rateState.fetch.retry_after_ms) > 0,
  );

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
      if (initial) applyState(initial);
    } catch {
      // Dev mode fallback
    }

    try {
      unlisten = await listen<FullTelemetryState>("limiter-update", (event) => {
        applyState(event.payload);
      });
    } catch {
      // Dev mode fallback
    }
  });

  onDestroy(() => {
    if (unlisten) unlisten();
  });
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

{#snippet segs(r: RuleTelemetry)}
  {@const p = pct(r)}
  <div class="seg seg-available" style="width: {p.avail}%;"></div>
  <div class="seg seg-unavailable" style="width: {p.used}%;"></div>
  <div class="seg seg-reserved" style="width: {p.reserved}%;"></div>
{/snippet}

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
              <span class="popover-pills">
                {#if rateState.cf_paused}
                  <span class="popover-pill is-cf">Cloudflare check</span>
                {/if}
                {#if hasPenalty}
                  <span class="popover-pill is-penalized">Penalty</span>
                {/if}
              </span>
            </header>

            <div class="columns">
              {#each columns as col (col.key)}
                {@const next = remaining(col.op.next_available_ms)}
                {@const pen = remaining(col.op.retry_after_ms)}
                <div class="op-card" class:penalized={pen > 0}>
                  <div class="op-header">
                    <span class="op-name">{col.title}</span>
                    {#if next > 0}
                      <span class="next-badge wait"
                        >next in {formatMs(next)}</span
                      >
                    {:else}
                      <span class="next-badge ready">ready</span>
                    {/if}
                  </div>

                  <div class="rule-list">
                    {#each col.op.rules as r (r.id)}
                      {@const rPen = remaining(r.penalty_ms)}
                      {@const rNext = remaining(r.next_slot_ms)}
                      <div
                        class="rule-row"
                        class:penalized={rPen > 0}
                        class:blocked={rNext > 0}
                        title="{ruleLabel(
                          r,
                        )}: used {r.used}/{r.max}, reserved free {r.reserved_free}, available {r.available}"
                      >
                        <span class="rule-label">{ruleLabel(r)}</span>
                        <div class="bar-pip-track">
                          {@render segs(r)}
                        </div>
                        <span class="rule-count">
                          {#if rPen > 0}
                            <span class="penalty-tag">ban {formatMs(rPen)}</span
                            >
                          {:else if rNext > 0}
                            <span class="next-tag">+{formatMs(rNext)}</span>
                          {:else}
                            {r.available}/{r.max}
                          {/if}
                        </span>
                      </div>
                    {:else}
                      <span class="queue-empty">no data yet</span>
                    {/each}
                  </div>

                  <div class="queue-row">
                    <span class="queue-label">Queued ({col.queued}):</span>
                    <div class="queue-badges">
                      {#each Object.entries(col.queue) as [realm, count]}
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
              {/each}
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
          class:has-penalty={hasPenalty || rateState.cf_paused}
          aria-expanded={rateLimiterOpen}
          aria-haspopup="dialog"
          onclick={() => (rateLimiterOpen = !rateLimiterOpen)}
        >
          {#each miniBars as b (b.key)}
            {@const next = remaining(b.op.next_available_ms)}
            <div
              class="bar-unit"
              title="{b.name}{b.crit
                ? ` · ${ruleLabel(b.crit)}: ${b.crit.available}/${b.crit.max}`
                : ''} · {next > 0
                ? `next request in ${formatMs(next)}`
                : 'ready'}"
            >
              <div class="segment-track">
                {#if b.crit}
                  {@render segs(b.crit)}
                {/if}
              </div>

              <div class="bar-overlay">
                {#if next > 0}
                  <span class="penalty-overlay-text">{formatMs(next)}</span>
                {:else if b.crit}
                  <span class="count-overlay-text"
                    >{b.crit.available}/{b.crit.max}</span
                  >
                {:else}
                  <span class="count-overlay-text">–</span>
                {/if}
              </div>
            </div>
          {/each}
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
    width: 460px;
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

  .popover-pills {
    display: flex;
    gap: 4px;
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

  .popover-pill.is-cf {
    background: #2e2308;
    color: #ffb300;
    border: 1px solid #b27d00;
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .op-card {
    background: #000000;
    border: 1px solid #777777;
    border-radius: 0px;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
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

  .next-badge {
    font-size: 10px;
    font-weight: bold;
    font-family: "Fontin", monospace, sans-serif;
  }
  .next-badge.ready {
    color: #66bb6a;
  }
  .next-badge.wait {
    color: #ffb300;
  }

  .rule-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rule-row {
    display: grid;
    grid-template-columns: 44px 1fr 56px;
    align-items: center;
    gap: 5px;
    font-size: 10px;
  }

  .rule-label {
    color: #aaaaaa;
    white-space: nowrap;
  }

  .rule-count {
    text-align: right;
    color: #888888;
    font-family: "Fontin", monospace, sans-serif;
    white-space: nowrap;
  }

  .rule-row.blocked .rule-label {
    color: #ffb300;
  }
  .rule-row.penalized .rule-label {
    color: #ff5252;
  }

  .penalty-tag {
    color: #ff5252;
    font-weight: bold;
  }

  .next-tag {
    color: #ffb300;
    font-weight: bold;
  }

  .bar-pip-track {
    height: 6px;
    background: #000000;
    display: flex;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    overflow: hidden;
  }

  .queue-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    border-top: 1px solid #333333;
    padding-top: 4px;
  }

  .queue-label {
    color: #aaaaaa;
    white-space: nowrap;
  }

  .queue-badges {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: flex-end;
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
