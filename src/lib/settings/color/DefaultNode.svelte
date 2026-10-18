<script lang="ts">
  import {
    disabledIdsStore,
    toggleDefault,
    copyRuleToCustom,
    keywordKey,
    isGroup,
    type StatColorNode,
  } from "$lib/trade/tradeStore";
  import { treeUi } from "./treeState.svelte";
  import DefaultNode from "./DefaultNode.svelte";

  let { node }: { node: StatColorNode } = $props();

  const disabled = $derived(new Set($disabledIdsStore));
  const on = $derived(!disabled.has(node.id));

  function copy(e: MouseEvent) {
    e.stopPropagation();
    if (isGroup(node)) return;
    const id = copyRuleToCustom({
      ...node,
      keywords: node.keywords.filter(
        (k) => !disabled.has(keywordKey(node.id, k)),
      ),
    });
    treeUi.view = "custom";
    treeUi.focusId = id;
  }

  function headKey(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDefault(node.id);
    }
  }
</script>

{#if isGroup(node)}
  <div>
    <div
      class="tn-ghead"
      class:tn-off={!on}
      role="button"
      tabindex="0"
      title={on ? "Click to disable this group" : "Click to enable this group"}
      onclick={() => toggleDefault(node.id)}
      onkeydown={headKey}
    >
      <span class="tn-chev">{on ? "▾" : "▸"}</span>
      <span class="tn-gname">{node.name}</span>
    </div>

    {#if on}
      <div class="tn-gbody">
        {#each node.elements as child (child.id)}
          <DefaultNode node={child} />
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="tn-rule" class:open={on} style="--c:{node.color}">
    <div
      class="tn-rhead"
      class:tn-off={!on}
      role="button"
      tabindex="0"
      title={on ? "Click to disable this rule" : "Click to enable this rule"}
      onclick={() => toggleDefault(node.id)}
      onkeydown={headKey}
    >
      <span class="tn-chev">{on ? "▾" : "▸"}</span>
      <span class="tn-swatch" style="background:{node.color}"></span>
      <span class="tn-rname" style="color:{node.color}">{node.name}</span>
      <span class="tn-actions">
        <button
          type="button"
          class="st-btn small hover-only pb-icon"
          style="color:#fff"
          title="Make an editable copy in Custom"
          onclick={copy}
        >
          Copy to custom
        </button>
      </span>
    </div>

    {#if on}
      <div class="tn-chips">
        {#each node.keywords as kw (kw)}
          {@const key = keywordKey(node.id, kw)}
          <button
            type="button"
            class="pb-chip"
            class:off={disabled.has(key)}
            title={disabled.has(key) ? `Enable “${kw}”` : `Disable “${kw}”`}
            onclick={() => toggleDefault(key)}
          >
            {kw}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
