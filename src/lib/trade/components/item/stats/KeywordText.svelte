<!-- src/lib/trade/components/item/stats/KeywordText.svelte -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    keywords,
    showTooltips,
    type KeywordEntry,
  } from "$lib/trade/tradeStore";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import KeywordTooltip from "./KeywordTooltip.svelte";
  import { parseKeywordSegments } from "./statsUtils";

  export let text: string = "";
  export let useColorCoding: boolean = false;
  export let depth: number = 0;

  $: segments = parseKeywordSegments(text);

  // Case-insensitive lookup map for fallback matching
  $: lowerMap = (() => {
    const map = new Map<string, KeywordEntry>();
    for (const [k, v] of Object.entries($keywords)) {
      map.set(k.toLowerCase(), v);
    }
    return map;
  })();

  function resolveKeyword(key: string, display: string): KeywordEntry | null {
    if (!key) return null;
    const direct =
      $keywords[key] ??
      lowerMap.get(key.toLowerCase()) ??
      $keywords[display] ??
      lowerMap.get(display.toLowerCase());

    if (direct && (direct.term || direct.definition)) {
      return {
        term: direct.term || display,
        definition: direct.definition || "",
      };
    }
    return null;
  }

  let activeTip: {
    term: string;
    definition: string;
    x: number;
    y: number;
  } | null = null;

  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(() => {
      activeTip = null;
    }, 120);
  }

  // Immediately dismiss any open tooltip if showTooltips is toggled off
  $: if (!$showTooltips && activeTip) {
    cancelClose();
    activeTip = null;
  }

  function handleEnter(e: MouseEvent, key: string, display: string) {
    if (!$showTooltips) return;
    const entry = resolveKeyword(key, display);
    if (!entry) return;
    cancelClose();
    activeTip = {
      term: entry.term,
      definition: entry.definition,
      x: e.clientX,
      y: e.clientY,
    };
  }

  function handleLeave() {
    if (!$showTooltips) return;
    scheduleClose();
  }

  onDestroy(() => {
    cancelClose();
  });
</script>

{#each segments as seg}
  {@const textContent = seg.type === "keyword" ? seg.display : seg.text}
  {#if seg.type === "keyword" && $showTooltips}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <span
      class="kw-token"
      class:has-def={Boolean(resolveKeyword(seg.key, seg.display))}
      on:mouseenter={(e) => handleEnter(e, seg.key, seg.display)}
      on:mouseleave={handleLeave}
    >
      {#if useColorCoding}
        <StatColorText text={textContent} />
      {:else}
        {textContent}
      {/if}
    </span>
  {:else}
    {#if useColorCoding}
      <StatColorText text={textContent} />
    {:else}
      {textContent}
    {/if}
  {/if}
{/each}

{#if $showTooltips && activeTip && depth < 6}
  <KeywordTooltip
    term={activeTip.term}
    definition={activeTip.definition}
    x={activeTip.x}
    y={activeTip.y}
    {depth}
    on:tooltipenter={cancelClose}
    on:tooltipleave={scheduleClose}
  />
{/if}

<style>
  .kw-token {
    text-decoration: underline;
    text-decoration-color: currentColor;
    text-underline-offset: 2px;
    text-decoration-thickness: 1px;
  }

  .kw-token.has-def {
    cursor: help;
    text-decoration-style: solid;
  }
</style>
