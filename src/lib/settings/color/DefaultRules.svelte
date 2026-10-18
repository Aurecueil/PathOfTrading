<script lang="ts">
  import type { StatColorNode } from "$lib/trade/tradeStore";
  import DefaultNode from "./DefaultNode.svelte";

  let { nodes }: { nodes: StatColorNode[] } = $props();
</script>

<div class="tn-list">
  {#each nodes as node (node.id)}
    <DefaultNode {node} />
  {/each}
</div>
