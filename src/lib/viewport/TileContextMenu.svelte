<!-- src/lib/TileContextMenu.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { leaguesPoe, leaguesPoe2 } from "$lib/trade/tradeStore";

  export let x: number;
  export let y: number;
  export let targetCount: number = 1;
  export let allDisabled: boolean = false;
  export let realm: string = "poe";
  export let league: string = "";

  const dispatch = createEventDispatcher<{
    toggledisable: void;
    applyrealmleague: { realm: string; league: string };
  }>();

  // Filter PoE 1 leagues to only ones with realm/realms === "pc"
  $: poe1PcLeagues = ($leaguesPoe || []).filter((l: any) => {
    const r = String(l.realm ?? l.realms ?? "").toLowerCase();
    return r === "pc";
  });

  $: poe2Leagues = $leaguesPoe2 || [];

  $: availableLeagues = realm === "poe2" ? poe2Leagues : poe1PcLeagues;

  // Ensure selected league defaults to first available option when switching realm
  $: if (
    availableLeagues.length > 0 &&
    !availableLeagues.some((l) => String(l.id) === league)
  ) {
    league = String(availableLeagues[0].id);
  }
</script>

<div
  class="context-menu"
  style:left="{x}px"
  style:top="{y}px"
  on:pointerdown|stopPropagation
  on:contextmenu|preventDefault|stopPropagation
>
  <div class="cm-header">
    {targetCount > 1 ? `${targetCount} Tiles Selected` : "Tile Options"}
  </div>

  <button
    type="button"
    class="cm-item"
    on:click={() => dispatch("toggledisable")}
  >
    {#if allDisabled}
      ✅ Enable Search
    {:else}
      🚫 Disable Search
    {/if}
  </button>

  <div class="cm-divider"></div>

  <div class="cm-section">
    <label>
      <span>Realm</span>
      <select bind:value={realm}>
        <option value="poe">PoE 1</option>
        <option value="poe2">PoE 2</option>
      </select>
    </label>

    <label>
      <span>League</span>
      {#if availableLeagues.length > 0}
        <select bind:value={league}>
          {#each availableLeagues as lg (lg.id)}
            <option value={String(lg.id)}>{lg.text || lg.id}</option>
          {/each}
        </select>
      {:else}
        <input type="text" bind:value={league} placeholder="Enter league..." />
      {/if}
    </label>

    <button
      type="button"
      class="cm-apply-btn"
      on:click={() => dispatch("applyrealmleague", { realm, league })}
    >
      Apply Realm & League
    </button>
  </div>
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 200;
    width: 220px;
    background: #1b1f2a;
    border: 1px solid #333b4d;
    border-radius: 8px;
    padding: 0.45rem;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.65);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .cm-header {
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    padding: 0.2rem 0.4rem;
    text-transform: uppercase;
  }
  .cm-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background: #252b3b;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.42rem 0.55rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .cm-item:hover {
    background: #3b4257;
  }
  .cm-divider {
    height: 1px;
    background: #2e3444;
    margin: 0.15rem 0;
  }
  .cm-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.2rem;
  }
  .cm-section label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.72rem;
    color: #cbd5e1;
  }
  .cm-section select,
  .cm-section input {
    background: #12151c;
    color: #e2e8f0;
    border: 1px solid #334155;
    border-radius: 4px;
    padding: 0.3rem;
    font-size: 0.78rem;
    outline: none;
  }
  .cm-apply-btn {
    background: #3a57e8;
    color: #fff;
    border: none;
    border-radius: 4px;
    width: 100%;
    padding: 0.42rem;
    font-size: 0.78rem;
    margin-top: 0.15rem;
    cursor: pointer;
  }
  .cm-apply-btn:hover {
    background: #2d45c5;
  }
</style>
