<!-- src/lib/trade/components/drawer/StatColorText.svelte -->
<script context="module" lang="ts">
  import { STAT_KEYWORD_COLORS } from "$lib/trade/tradeStore";

  interface TextSegment {
    text: string;
    color: string | null;
  }

  const keywordToColor = new Map<string, string>();

  for (const rule of STAT_KEYWORD_COLORS) {
    for (const kw of rule.keywords) {
      const key = kw.trim().toLowerCase();
      if (key && !keywordToColor.has(key)) {
        keywordToColor.set(key, rule.color);
      }
    }
  }

  // Longest first so "fire damage"-style phrases win over shorter keywords
  const escaped = [...keywordToColor.keys()]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const keywordRegex =
    escaped.length > 0
      ? new RegExp(`\\b(${escaped.join("|")})\\b`, "gi")
      : null;

  function splitIntoSegments(input: string): TextSegment[] {
    if (!input) return [];
    if (!keywordRegex) return [{ text: input, color: null }];

    const segments: TextSegment[] = [];
    let lastIndex = 0;

    // matchAll clones the regex, so no shared lastIndex state
    for (const match of input.matchAll(keywordRegex)) {
      const start = match.index ?? 0;
      if (start > lastIndex) {
        segments.push({ text: input.slice(lastIndex, start), color: null });
      }
      segments.push({
        text: match[0],
        color: keywordToColor.get(match[0].toLowerCase()) ?? null,
      });
      lastIndex = start + match[0].length;
    }

    if (lastIndex < input.length) {
      segments.push({ text: input.slice(lastIndex), color: null });
    }
    return segments;
  }
</script>

<script lang="ts">
  import { statColorCodingEnabled } from "$lib/trade/tradeStore";

  export let text: string = "";
  export let className: string = "";

  $: segments = $statColorCodingEnabled ? splitIntoSegments(text) : [];
</script>

{#if !$statColorCodingEnabled}
  <span class={className}>{text}</span>
{:else}
  <span class={className}>
    {#each segments as seg}
      {#if seg.color}
        <span style="color: {seg.color} !important;">{seg.text}</span>
      {:else}
        {seg.text}
      {/if}
    {/each}
  </span>
{/if}
