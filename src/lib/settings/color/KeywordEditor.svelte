<script lang="ts">
  import { normKw } from "$lib/trade/tradeStore";

  let {
    keywords,
    color,
    onchange,
  }: { keywords: string[]; color: string; onchange: (next: string[]) => void } =
    $props();

  let draft = $state("");

  function commit() {
    const parts = draft.split(",").map(normKw).filter(Boolean);
    draft = "";
    if (!parts.length) return;
    const next = [...keywords];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onchange(next);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  }
</script>

<input
  class="kw-input"
  bind:value={draft}
  {onkeydown}
  onblur={commit}
  placeholder="+ Add keyword (Enter to add, commas add several)"
  autocomplete="off"
/>

{#if keywords.length}
  <div class="kw-list" style="--c:{color}">
    {#each keywords as kw (kw)}
      <span class="pb-chip">
        {kw}
        <button
          type="button"
          class="pb-chip-x"
          aria-label="Remove {kw}"
          onclick={() => onchange(keywords.filter((k) => k !== kw))}>✕</button
        >
      </span>
    {/each}
  </div>
{/if}
