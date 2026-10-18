<!-- src/lib/trade/components/drawer/StatColorText.svelte -->
<script lang="ts">
  import {
    statColorCodingEnabled,
    statColorMatcher,
    colorize,
  } from "$lib/trade/tradeStore";

  export let text: string = "";
  export let className: string = "";

  // Re-runs whenever the text, the master toggle, or any rule/toggle changes
  $: segments = $statColorCodingEnabled
    ? colorize(text, $statColorMatcher)
    : [];
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
