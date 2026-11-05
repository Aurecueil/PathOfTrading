<!-- stats/GemTabs.svelte -->
<script lang="ts">
  import type { GemTab } from "$lib/types/tradeItem";
  import ItemModifier from "../ItemModifier.svelte";
  import PropertyLine from "./PropertyLine.svelte";
  import KeywordText from "./KeywordText.svelte";
  import { isRenderableProp } from "./propertyGroups";

  export let tabs: GemTab[] = [];
  export let realm: string = "poe";
  export let compact: boolean = false;

  type Page = NonNullable<GemTab["pages"]>[number];
  interface Entry {
    label: string;
    pages: Page[];
  }

  let active = 0;
  let sub = 0;

  $: isPoe2 = (realm || "").toLowerCase() === "poe2";

  $: entries = ((): Entry[] => {
    const real = tabs.filter((t) => (t.pages?.length ?? 0) > 0);
    // Single main tab: its pages become the tabs
    if (real.length === 1) {
      const t = real[0];
      return t.pages!.map((p) => ({
        label: p.skillName || t.name,
        pages: [p],
      }));
    }
    return real.map((t) => ({ label: t.name, pages: t.pages! }));
  })();

  $: if (active >= entries.length) active = 0;
  $: entry = entries[active];
  $: if (entry && sub >= entry.pages.length) sub = 0;
  $: page = entry?.pages[sub];

  function selectTab(i: number) {
    active = i;
    sub = 0;
  }
</script>

{#if entries.length > 0}
  <div class="gem-tabs">
    {#if entries.length > 1}
      <div class="tab-bar" role="tablist">
        {#each entries as e, i}
          <button
            type="button"
            role="tab"
            class="tab-btn"
            class:active={i === active}
            aria-selected={i === active}
            on:click|stopPropagation={() => selectTab(i)}>{e.label}</button
          >
        {/each}
      </div>
    {/if}

    {#if entry && entry.pages.length > 1}
      <div class="tab-bar sub" role="tablist">
        {#each entry.pages as p, i}
          <button
            type="button"
            role="tab"
            class="tab-btn"
            class:active={i === sub}
            aria-selected={i === sub}
            on:click|stopPropagation={() => (sub = i)}
            >{p.skillName || `#${i + 1}`}</button
          >
        {/each}
      </div>
    {/if}

    {#if page}
      <div class="tab-page" role="tabpanel">
        {#if page.description}
          <div class="page-descr"><KeywordText text={page.description} /></div>
        {/if}
        {#each (page.properties ?? []).filter(isRenderableProp) as p}
          <div class="page-prop"><PropertyLine prop={p} {isPoe2} /></div>
        {/each}
        {#each page.stats ?? [] as stat}
          <ItemModifier mod={stat} {realm} category="generic" {compact} />
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
    gap: 3px;
  }
  .tab-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.1rem 0.2rem;
  }
  .tab-bar.sub .tab-btn {
    font-size: 0.82rem;
    opacity: 0.85;
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
    transition:
      color 0.12s ease,
      border-color 0.12s ease;
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
  .tab-page {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
  }
  .page-descr {
    color: #1ba274; /* same as sec-descr-text */
    font-size: 0.92rem;
    line-height: 1.25;
    text-align: center;
    padding: 0 0.5rem 2px;
    white-space: pre-line;
  }
  .page-prop {
    display: flex;
    justify-content: center;
  }
</style>
