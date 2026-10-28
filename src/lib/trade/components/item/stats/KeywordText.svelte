<!-- src/lib/trade/components/item/stats/KeywordText.svelte -->
<script context="module" lang="ts">
  import { derived } from "svelte/store";
  import { keywords, type KeywordEntry } from "$lib/trade/tradeStore";

  // Derived store computed ONCE globally whenever `keywords` updates
  const keywordLookup = derived(keywords, ($kw) => {
    const raw = $kw || {};
    const entries = Object.entries(raw);
    const loaded = entries.length > 0;

    const lowerMap = new Map<string, KeywordEntry>();
    for (const [k, v] of entries) {
      lowerMap.set(k.toLowerCase(), v);
    }

    function resolve(key: string, display: string): KeywordEntry | null {
      if (!key) return null;
      const direct =
        raw[key] ??
        lowerMap.get(key.toLowerCase()) ??
        raw[display] ??
        lowerMap.get(display.toLowerCase());

      if (direct && (direct.term || direct.definition)) {
        return {
          term: direct.term || display,
          definition: direct.definition || "",
        };
      }
      return null;
    }

    return { loaded, resolve };
  });
</script>

<script lang="ts">
  import { showTooltips } from "$lib/trade/tradeStore";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import KeywordTooltip from "./KeywordTooltip.svelte";
  import { parseKeywordSegments } from "./statsUtils";

  export let text: string = "";
  export let useColorCoding: boolean = false;
  export let depth: number = 0;

  $: keywordsLoaded = $keywordLookup.loaded;

  // Pre-resolve keyword entries only when `text` or `$keywordLookup` changes,
  // NOT when `$showTooltips` toggles.
  $: resolvedSegments = parseKeywordSegments(text).map((seg) => {
    if (seg.type === "keyword") {
      return {
        ...seg,
        entry: $keywordLookup.resolve(seg.key, seg.display),
      };
    }
    return seg;
  });

  let hoveredTarget: {
    key: string;
    display: string;
    x: number;
    y: number;
  } | null = null;

  let isHoveringKeyword = false;
  let isPinned = false;

  // Reactively compute the active tooltip so it updates live when $keywordLookup loads in
  $: activeTip = (() => {
    if (!$showTooltips || !hoveredTarget) return null;

    if (!$keywordLookup.loaded) {
      return {
        term: hoveredTarget.display,
        definition: "Loading...",
        x: hoveredTarget.x,
        y: hoveredTarget.y,
      };
    }

    const entry = $keywordLookup.resolve(
      hoveredTarget.key,
      hoveredTarget.display,
    );
    if (!entry) return null;

    return {
      term: entry.term,
      definition: entry.definition,
      x: hoveredTarget.x,
      y: hoveredTarget.y,
    };
  })();

  // If data loads in and the hovered keyword has no definition, clear pin state
  $: if (hoveredTarget && keywordsLoaded && !activeTip) {
    isPinned = false;
  }

  // Immediately dismiss any open tooltip if showTooltips is toggled off
  $: if (!$showTooltips && hoveredTarget) {
    hoveredTarget = null;
    isPinned = false;
    isHoveringKeyword = false;
  }

  function handleEnter(
    e: MouseEvent,
    key: string,
    display: string,
    entry: KeywordEntry | null,
  ) {
    if (!$showTooltips) return;
    // If keywords have already loaded and this token has no definition, ignore
    if (keywordsLoaded && !entry) return;

    isHoveringKeyword = true;
    hoveredTarget = {
      key,
      display,
      x: e.clientX,
      y: e.clientY,
    };
  }

  function handleLeave() {
    isHoveringKeyword = false;
    if (!isPinned) {
      hoveredTarget = null;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Only pin if tooltip is currently open and this is a fresh Alt press (not pre-held repeat)
    if (e.key === "Alt" && !e.repeat && activeTip) {
      isPinned = true;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === "Alt" && isPinned) {
      isPinned = false;
      if (!isHoveringKeyword) {
        hoveredTarget = null;
      }
    }
  }

  function handleWindowBlur() {
    if (isPinned) {
      isPinned = false;
      if (!isHoveringKeyword) {
        hoveredTarget = null;
      }
    }
  }
</script>

<svelte:window
  on:keydown={handleKeyDown}
  on:keyup={handleKeyUp}
  on:blur={handleWindowBlur}
/>

{#each resolvedSegments as seg}
  {#if seg.type === "keyword"}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <span
      class="kw-token"
      class:enabled={$showTooltips}
      class:has-def={$showTooltips && (!keywordsLoaded || Boolean(seg.entry))}
      on:mouseenter={(e) => handleEnter(e, seg.key, seg.display, seg.entry)}
      on:mouseleave={handleLeave}
    >
      {#if useColorCoding}
        <StatColorText text={seg.display} />
      {:else}
        {seg.display}
      {/if}
    </span>
  {:else if useColorCoding}
    <StatColorText text={seg.text} />
  {:else}
    {seg.text}
  {/if}
{/each}

{#if $showTooltips && activeTip && depth < 6}
  <KeywordTooltip
    term={activeTip.term}
    definition={activeTip.definition}
    x={activeTip.x}
    y={activeTip.y}
    {depth}
    pinned={isPinned}
  />
{/if}

<style>
  .kw-token.enabled {
    text-decoration: underline;
    text-decoration-color: currentColor;
    text-underline-offset: 2px;
    text-decoration-thickness: 1px;
  }

  .kw-token.enabled.has-def {
    cursor: help;
    text-decoration-style: solid;
  }
</style>
