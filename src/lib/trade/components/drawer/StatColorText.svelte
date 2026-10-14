<!-- src/lib/trade/components/drawer/StatColorText.svelte -->
<script lang="ts">
  import {
    statColorCodingEnabled,
    STAT_KEYWORD_COLORS,
  } from "$lib/trade/tradeStore";

  export let text: string = "";
  export let mode: "full" | "words" = "full";
  export let className: string = "";

  interface TextSegment {
    text: string;
    color: string | null;
  }

  const keywordToColor = new Map<string, string>();
  const allKeywords: string[] = [];

  for (const entry of STAT_KEYWORD_COLORS) {
    for (const kw of entry.keywords) {
      const lower = kw.toLowerCase();
      keywordToColor.set(lower, entry.color);
      allKeywords.push(lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
  }

  // Sort longest first so "energy shield" and "evasion rating" match first
  allKeywords.sort((a, b) => b.length - a.length);
  const patternString = `\\b(${allKeywords.join("|")})\\b`;

  function getFirstMatchColor(input: string, enabled: boolean): string | null {
    if (!enabled || !input) return null;
    const match = new RegExp(patternString, "i").exec(input);
    if (!match) return null;
    return keywordToColor.get(match[0].toLowerCase()) ?? null;
  }

  function splitIntoSegments(input: string, enabled: boolean): TextSegment[] {
    if (!enabled || !input) return [];
    const regex = new RegExp(patternString, "gi");
    const segments: TextSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          text: input.slice(lastIndex, match.index),
          color: null,
        });
      }
      const matchedWord = match[0];
      segments.push({
        text: matchedWord,
        color: keywordToColor.get(matchedWord.toLowerCase()) ?? null,
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < input.length) {
      segments.push({
        text: input.slice(lastIndex),
        color: null,
      });
    }

    return segments;
  }

  $: fullColor =
    mode === "full" ? getFirstMatchColor(text, $statColorCodingEnabled) : null;

  $: segments =
    mode === "words" ? splitIntoSegments(text, $statColorCodingEnabled) : [];
</script>

{#if !$statColorCodingEnabled}
  <span class={className}>{text}</span>
{:else if mode === "full"}
  <span
    class={className}
    style={fullColor ? `color: ${fullColor} !important;` : undefined}
  >
    {text}
  </span>
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
