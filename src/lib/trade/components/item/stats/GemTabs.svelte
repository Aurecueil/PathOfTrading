<!-- src/lib/trade/components/item/stats/GemTabs.svelte -->
<script lang="ts">
  import type { GemTab } from "$lib/types/tradeItem";
  import ItemModifier from "../ItemModifier.svelte";
  import PropertyLine from "./PropertyLine.svelte";
  import { isRenderableProp } from "./propertyGroups";

  export let tabs: GemTab[] = [];
  export let realm: string = "poe";
  export let compact: boolean = false;

  let active = 0;
  $: if (active >= tabs.length) active = 0;
  $: tab = tabs[active];
  $: isPoe2 = (realm || "").toLowerCase() === "poe2";
</script>

{#if tabs.length > 0}
  <div class="gem-tabs">
    <div class="tab-bar" role="tablist">
      {#each tabs as t, i}
        <button
          type="button"
          role="tab"
          class="tab-btn"
          class:active={i === active}
          aria-selected={i === active}
          on:click|stopPropagation={() => (active = i)}
        >
          {t.name}
        </button>
      {/each}
    </div>

    {#if tab}
      <div class="tab-body" role="tabpanel">
        {#each tab.pages ?? [] as page}
          <div class="tab-page">
            {#if (tab.pages?.length ?? 0) > 1 && page.skillName}
              <div class="page-name">{page.skillName}</div>
            {/if}
            {#each (page.properties ?? []).filter(isRenderableProp) as p}
              <div class="page-prop"><PropertyLine prop={p} {isPoe2} /></div>
            {/each}
            {#each page.stats ?? [] as stat}
              <ItemModifier mod={stat} {realm} category="generic" {compact} />
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .gem-tabs {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 2px;
  }
  .tab-bar {
    display: flex;
    justify-content: center;
    gap: 0.2rem;
  }
  .tab-btn {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 1px 10px 2px;
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.2;
    color: #8b95a5;
    cursor: pointer;
    transition: color 0.12s ease, border-color 0.12s ease;
  }
  .tab-btn:hover {
    color: #cbd5e1;
  }
  .tab-btn:focus-visible {
    outline: 1px solid var(--rc, #6588ff);
    outline-offset: 1px;
  }
  .tab-btn.active {
    color: #e9cf9f;
    border-bottom-color: var(--rc, #6588ff);
  }
  .tab-body,
  .tab-page {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
  }
  .page-name {
    font-size: 0.9rem;
    font-weight: 700;
    color: #b8b09c;
    text-align: center;
  }
  .page-prop {
    display: flex;
    justify-content: center;
  }
</style>