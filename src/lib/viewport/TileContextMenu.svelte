<!-- src/lib/TileContextMenu.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { leaguesAll } from "$lib/trade/tradeStore";
  import { type Realm, type League, REALM_OPTIONS } from "$lib/types/leagues";

  export let x: number;
  export let y: number;
  export let targetCount: number = 1;
  export let allDisabled: boolean = false;
  export let realm: Realm = "pc";
  export let league: string = "";

  const dispatch = createEventDispatcher<{
    toggledisable: void;
    applyrealmleague: { realm: Realm; league: string };
  }>();

  // Filter leagues for the currently selected realm
  $: availableLeagues = ($leaguesAll || []).filter(
    (l: League) => l.realm === realm,
  );

  // Default selected league to the first available option when changing realms or when invalid
  $: if (
    availableLeagues.length > 0 &&
    !availableLeagues.some((l) => l.id === league)
  ) {
    league = availableLeagues[0].id;
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
    class="cm-btn"
    on:click={() => dispatch("toggledisable")}
  >
    {allDisabled ? "Enable Search" : "Disable Search"}
  </button>

  <div class="cm-divider"></div>

  <div class="cm-section">
    <label>
      <span>Realm</span>
      <select bind:value={realm}>
        {#each REALM_OPTIONS as opt (opt.id)}
          <option value={opt.id}>{opt.text}</option>
        {/each}
      </select>
    </label>

    <label>
      <span>League</span>
      {#if availableLeagues.length > 0}
        <select bind:value={league}>
          {#each availableLeagues as lg (lg.id)}
            <option value={lg.id}>{lg.text || lg.id}</option>
          {/each}
        </select>
      {:else}
        <input type="text" bind:value={league} placeholder="Enter league..." />
      {/if}
    </label>

    <button
      type="button"
      class="cm-btn"
      on:click={() => dispatch("applyrealmleague", { realm, league })}
    >
      Apply Realm &amp; League
    </button>
  </div>
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 200;
    width: 260px;
    box-sizing: border-box;
    background-color: #040608;
    border: 1px solid #7f7f7f;
    border-radius: 0;
    padding: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #d3d3d3;
    font-family: "Fontin", monospace, sans-serif;
    user-select: none;
  }

  .cm-header {
    font-size: 18px;
    line-height: 1.1;
    color: #ffffff;
    padding: 2px 2px 6px;
    border-bottom: 1px solid #7f7f7f;
  }

  .cm-divider {
    height: 1px;
    background: #7f7f7f;
    opacity: 0.5;
  }

  .cm-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cm-section label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 16px;
    color: #9a9a9a;
  }

  .cm-section select,
  .cm-section input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 18px;
    height: 28px;
    line-height: 1;
    width: 100%;
    box-sizing: border-box;
    background-color: #000000;
    border: 2px solid #7f7f7f;
    border-radius: 0;
    color: #ffffff;
    padding: 0 8px;
    outline: none;
  }

  .cm-section select {
    cursor: pointer;
  }

  .cm-section select:hover,
  .cm-section select:focus,
  .cm-section input:hover,
  .cm-section input:focus {
    border-color: #ffffff;
  }

  .cm-section select option {
    background-color: #000000;
    color: #9a9a9a;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 18px;
  }

  .cm-section select option:checked {
    color: #ffffff;
  }

  .cm-btn {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 18px;
    height: 28px;
    line-height: 1;
    width: 100%;
    padding: 0 8px;
    border-radius: 0;
    cursor: pointer;
    border: 2px solid #7f7f7f;
    background-color: #000000;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    transition: border-color 0.1s ease;
  }

  .cm-btn:hover,
  .cm-btn:focus-visible {
    border-color: #ffffff;
    outline: none;
  }
</style>
