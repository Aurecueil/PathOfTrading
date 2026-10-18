<script lang="ts">
  import {
    mutateCustom,
    createGroup,
    createRule,
    type StatColorNode,
  } from "$lib/trade/tradeStore";
  import { treeUi } from "./treeState.svelte";
  import CustomNode from "./CustomNode.svelte";
  import AddRow from "./AddRow.svelte";

  let { nodes }: { nodes: StatColorNode[] } = $props();

  function add(kind: "rule" | "group") {
    const n = kind === "rule" ? createRule() : createGroup();
    mutateCustom((d) => d.push(n));
    treeUi.focusId = n.id;
  }
</script>

<div class="tn-list">
  {#each nodes as node (node.id)}
    <CustomNode {node} />
  {/each}
  <AddRow onadd={add} />
</div>
