<script lang="ts">
  import "$lib/settings/settings.css";
  import { isLoading, statKeywordColorsStore } from "$lib/trade/tradeStore";
  import BasicTab from "$lib/settings/BasicTab.svelte";
  import StatGroupsTab from "$lib/settings/StatGroupsTab.svelte";
  import ColorCodingTab from "$lib/settings/ColorCodingTab.svelte";

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
</script>

<div class="settings-page">
  <section class="settings-shell">
    <header class="st-header">
      <h2>Settings</h2>
      <div class="st-header-right">
        {#if status}<span class="st-status">{status}</span>{/if}
        {#if $isLoading}
          <span class="st-status muted" role="status">Fetching trade data…</span
          >
        {/if}
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
