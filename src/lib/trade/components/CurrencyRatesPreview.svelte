<!-- src/lib/components/CurrencyRatesPreview.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import type { LeagueData } from "$lib/types/leagues";
  import {
    leaguesPoe,
    leaguesPoe2,
    rawPrices,
    priceOverrides,
    effectivePrices,
    isRefreshingPrices,
    POE1_TARGETS,
    POE2_TARGETS,
    setCurrencyOverride,
    clearLeagueOverrides,
    refreshRealmPrices,
    buildNormalizedPair,
    getValidLeagues,
    type GameRealm,
  } from "$lib/trade/tradeStore";

  export let selectedRealm: GameRealm = "poe";
  export let selectedLeague: string = "";

  // Ensure leagues are loaded even if this component is opened in a separate window
  onMount(async () => {
    if ($leaguesPoe.length === 0) {
      try {
        const res = await invoke<LeagueData>("load_league_data", {
          realm: "poe",
        });
        if (res?.result) leaguesPoe.set(res.result);
      } catch (e) {
        console.warn("Failed to load PoE1 leagues in preview:", e);
      }
    }
    if ($leaguesPoe2.length === 0) {
      try {
        const res = await invoke<LeagueData>("load_league_data", {
          realm: "poe2",
        });
        if (res?.result) leaguesPoe2.set(res.result);
      } catch (e) {
        console.warn("Failed to load PoE2 leagues in preview:", e);
      }
    }
  });

  $: availableLeagues = getValidLeagues(
    selectedRealm === "poe" ? $leaguesPoe : $leaguesPoe2,
    selectedRealm,
  );

  // Select the first valid league whenever availableLeagues updates or realm switches
  $: if (
    availableLeagues.length > 0 &&
    !availableLeagues.some((l) => l.id === selectedLeague)
  ) {
    selectedLeague = availableLeagues[0].id;
  }

  // Trigger a price fetch if the selected league has no data yet
  $: if (
    selectedLeague &&
    availableLeagues.length > 0 &&
    !$rawPrices[selectedRealm]?.[selectedLeague] &&
    !$isRefreshingPrices
  ) {
    refreshRealmPrices(selectedRealm, availableLeagues);
  }

  $: targets = selectedRealm === "poe" ? POE1_TARGETS : POE2_TARGETS;
  $: leagueData = $effectivePrices[selectedRealm]?.[selectedLeague];
  $: rawLeagueData = $rawPrices[selectedRealm]?.[selectedLeague];
  $: userLeagueOverrides =
    $priceOverrides[selectedRealm]?.[selectedLeague] ?? {};

  $: baseCurrency = leagueData?.base?.toLowerCase() ?? "chaos";
  $: rates = leagueData?.rates ?? {};

  // Headline benchmark: base to divine (or to chaos if divine is base)
  $: headlineTarget = baseCurrency === "divine" ? "chaos" : "divine";
  $: headlinePair = leagueData
    ? buildNormalizedPair(baseCurrency, headlineTarget, rates, baseCurrency)
    : null;

  // Ratio list for all available target currencies against base currency
  $: currencyRows = targets
    .filter((c) => c !== baseCurrency && rates[c] !== undefined && rates[c] > 0)
    .map((currency) => ({
      currency,
      pair: buildNormalizedPair(currency, baseCurrency, rates, baseCurrency),
      rawRate: rawLeagueData?.rates?.[currency],
      effectiveRate: rates[currency],
      isOverridden: userLeagueOverrides[currency] !== undefined,
    }));

  $: missingCurrencies = targets.filter(
    (c) => c !== baseCurrency && (rates[c] === undefined || rates[c] <= 0),
  );

  function handleOverrideChange(currency: string, event: Event) {
    const input = (event.target as HTMLInputElement).value.trim();
    if (input === "") {
      setCurrencyOverride(selectedRealm, selectedLeague, currency, null);
      return;
    }
    const parsed = parseFloat(input);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setCurrencyOverride(selectedRealm, selectedLeague, currency, parsed);
    }
  }
</script>

<div class="pricing-panel">
  <div class="pricing-header">
    <div class="selectors">
      <select bind:value={selectedRealm}>
        <option value="poe">Path of Exile 1</option>
        <option value="poe2">Path of Exile 2</option>
      </select>

      <select
        bind:value={selectedLeague}
        disabled={availableLeagues.length === 0}
      >
        {#if availableLeagues.length === 0}
          <option value="">No leagues loaded</option>
        {:else}
          {#each availableLeagues as league (league.id)}
            <option value={league.id}>{league.text || league.id}</option>
          {/each}
        {/if}
      </select>
    </div>

    <div class="actions">
      <button
        type="button"
        disabled={$isRefreshingPrices || availableLeagues.length === 0}
        on:click={() => refreshRealmPrices(selectedRealm, availableLeagues)}
      >
        {$isRefreshingPrices ? "Refreshing..." : "Refresh"}
      </button>
      {#if Object.keys(userLeagueOverrides).length > 0}
        <button
          type="button"
          class="reset-btn"
          on:click={() => clearLeagueOverrides(selectedRealm, selectedLeague)}
        >
          Reset Overrides
        </button>
      {/if}
    </div>
  </div>

  {#if !leagueData}
    <p class="empty-state">
      {$isRefreshingPrices
        ? "Fetching latest currency rates..."
        : `No pricing data available for ${selectedLeague || "this league"}.`}
    </p>
  {:else}
    {#if headlinePair}
      <div class="headline-card">
        <span class="headline-label"
          >Benchmark Ratio (Base: {baseCurrency.toUpperCase()})</span
        >
        <div class="headline-value">
          <strong>{headlinePair.leftAmount} {headlinePair.leftCurrency}</strong>
          <span>=</span>
          <strong
            >{headlinePair.rightAmount} {headlinePair.rightCurrency}</strong
          >
        </div>
      </div>
    {/if}

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Currency</th>
            <th>Normalized Ratio (vs {baseCurrency})</th>
            <th>Base Value (1 unit in {baseCurrency})</th>
          </tr>
        </thead>
        <tbody>
          {#each currencyRows as row (row.currency)}
            <tr class:overridden={row.isOverridden}>
              <td class="curr-name">{row.currency}</td>
              <td class="ratio-cell">
                {#if row.pair}
                  <span class="high-side">1 {row.pair.leftCurrency}</span>
                  <span class="eq">=</span>
                  <span class="low-side"
                    >{row.pair.rightAmount} {row.pair.rightCurrency}</span
                  >
                {:else}
                  <span>N/A</span>
                {/if}
              </td>
              <td class="override-cell">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder={row.rawRate !== undefined
                    ? String(row.rawRate)
                    : "Missing"}
                  value={userLeagueOverrides[row.currency] ?? ""}
                  on:change={(e) => handleOverrideChange(row.currency, e)}
                />
                {#if row.isOverridden}
                  <button
                    type="button"
                    class="clear-single"
                    title="Revert to poe.ninja rate ({row.rawRate ?? 'none'})"
                    on:click={() =>
                      setCurrencyOverride(
                        selectedRealm,
                        selectedLeague,
                        row.currency,
                        null,
                      )}
                  >
                    ✕
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if missingCurrencies.length > 0}
      <details class="missing-section">
        <summary
          >Missing Currencies ({missingCurrencies.length}) — Click to set manual
          rates</summary
        >
        <div class="missing-grid">
          {#each missingCurrencies as curr (curr)}
            <div class="missing-item">
              <span>{curr}</span>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Set in {baseCurrency}"
                on:change={(e) => handleOverrideChange(curr, e)}
              />
            </div>
          {/each}
        </div>
      </details>
    {/if}
  {/if}
</div>

<style>
  .pricing-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #141418;
    color: #e4e4e7;
    border: 1px solid #27272a;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .pricing-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .selectors,
  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  select,
  input,
  button {
    background: #1f1f23;
    color: #e4e4e7;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    padding: 0.35rem 0.5rem;
    font-size: 0.8125rem;
  }

  button:disabled,
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:not(:disabled) {
    cursor: pointer;
  }

  button:not(:disabled):hover {
    background: #27272a;
  }

  .reset-btn {
    border-color: #7f1d1d;
    color: #fca5a5;
  }

  .headline-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.75rem;
    background: #1c1c22;
    border: 1px solid #3f3f46;
    border-radius: 4px;
  }

  .headline-label {
    color: #a1a1aa;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .headline-value {
    display: flex;
    gap: 0.4rem;
    font-size: 0.95rem;
    color: #fbbf24;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  th,
  td {
    padding: 0.45rem 0.5rem;
    border-bottom: 1px solid #27272a;
  }

  th {
    color: #a1a1aa;
    font-weight: 600;
    font-size: 0.75rem;
  }

  tr.overridden {
    background: rgba(251, 191, 36, 0.06);
  }

  .curr-name {
    font-weight: 600;
    text-transform: capitalize;
  }

  .ratio-cell {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .high-side {
    color: #f4f4f5;
    font-weight: 600;
  }

  .eq {
    color: #71717a;
  }

  .low-side {
    color: #38bdf8;
  }

  .override-cell {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .override-cell input {
    width: 110px;
  }

  .clear-single {
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
    color: #f87171;
  }

  .missing-section {
    font-size: 0.8rem;
    color: #a1a1aa;
  }

  .missing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .missing-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
    background: #1c1c22;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
  }

  .missing-item input {
    width: 90px;
  }

  .empty-state {
    color: #a1a1aa;
    text-align: center;
    padding: 1rem 0;
  }
</style>
