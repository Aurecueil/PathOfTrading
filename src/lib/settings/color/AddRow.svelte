<script lang="ts">
  let { onadd }: { onadd: (kind: "rule" | "group") => void } = $props();
</script>

<div class="add-row">
  <button type="button" class="add-btn" onclick={() => onadd("rule")}
    >+ Rule</button
  >
  <button type="button" class="add-btn" onclick={() => onadd("group")}
    >+ Group</button
  >
</div>
