<script lang="ts">
  import {
    mutateCustom,
    findNode,
    removeNode,
    moveNode,
    isGroup,
    createGroup,
    createRule,
    toggleDefault,
    disabledIdsStore,
    DEFAULT_RULE_NAME,
    type StatColorNode,
    type StatColorRule,
  } from "$lib/trade/tradeStore";
  import { treeUi } from "./treeState.svelte";
  import KeywordEditor from "./KeywordEditor.svelte";
  import AddRow from "./AddRow.svelte";
  import CustomNode from "./CustomNode.svelte";

  let { node }: { node: StatColorNode } = $props();

  // Expanded = on, collapsed = off (same as defaults)
  const on = $derived(!$disabledIdsStore.includes(node.id));
  let renaming = $state(false);

  $effect(() => {
    if (treeUi.focusId === node.id) {
      renaming = true;
      treeUi.focusId = null;
    }
  });

  function focusSelect(el: HTMLInputElement) {
    el.focus();
    el.select();
  }

  function patch(
    p: Partial<Pick<StatColorRule, "name" | "color" | "keywords">>,
    coalesce?: string,
  ) {
    mutateCustom((d) => {
      const hit = findNode(d, node.id);
      if (hit) Object.assign(hit.list[hit.index], p);
    }, coalesce);
  }

  function setKeywords(next: string[]) {
    const prev = (node as StatColorRule).keywords;
    const added = next.find((k) => !prev.includes(k));
    // A rule still called "New rule" takes the first keyword typed as its name
    patch(
      added && node.name === DEFAULT_RULE_NAME
        ? { keywords: next, name: added }
        : { keywords: next },
    );
  }

  function addChild(kind: "rule" | "group") {
    const child = kind === "rule" ? createRule() : createGroup();
    mutateCustom((d) => {
      const hit = findNode(d, node.id);
      const t = hit?.list[hit.index];
      if (t && isGroup(t)) t.elements.push(child);
    });
    treeUi.focusId = child.id;
  }

  const remove = () => mutateCustom((d) => removeNode(d, node.id));
  const move = (dir: -1 | 1) => mutateCustom((d) => moveNode(d, node.id, dir));
  const toggle = () => toggleDefault(node.id);

  function commitName(e: Event) {
    if (!renaming) return;
    const el = e.currentTarget as HTMLInputElement;
    renaming = false;
    const name = el.value.trim() || "Untitled";
    if (name !== node.name) patch({ name });
  }
  function nameKeys(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
    if (e.key === "Escape") renaming = false;
  }
  function headKey(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
</script>

{#snippet nameField(cls: string)}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <input
    class="st-input {cls}"
    value={node.name}
    use:focusSelect
    onclick={(e) => e.stopPropagation()}
    onblur={commitName}
    onkeydown={nameKeys}
  />
{/snippet}

{#if isGroup(node)}
  <div>
    <div
      class="tn-ghead"
      class:tn-off={!on}
      role="button"
      tabindex="0"
      onclick={toggle}
      onkeydown={headKey}
    >
      <span class="tn-chev">{on ? "▾" : "▸"}</span>
      {#if renaming}
        {@render nameField("tn-gname-input")}
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="tn-gname"
          title="Double-click to rename"
          onclick={(e) => e.stopPropagation()}
          ondblclick={stop(() => (renaming = true))}>{node.name}</span
        >
      {/if}
      <span class="tn-actions">
        <button
          type="button"
          class="pb-icon"
          title="Move up"
          onclick={stop(() => move(-1))}>▲</button
        >
        <button
          type="button"
          class="pb-icon"
          title="Move down"
          onclick={stop(() => move(1))}>▼</button
        >
        <button
          type="button"
          class="pb-icon danger"
          title="Delete group (Ctrl+Z to undo)"
          onclick={stop(remove)}>✕</button
        >
      </span>
    </div>

    {#if on}
      <div class="tn-gbody">
        {#each node.elements as child (child.id)}
          <CustomNode node={child} />
        {/each}
        <AddRow onadd={addChild} />
      </div>
    {/if}
  </div>
{:else}
  <div class="tn-rule" class:open={on}>
    <div
      class="tn-rhead"
      class:tn-off={!on}
      role="button"
      tabindex="0"
      onclick={toggle}
      onkeydown={headKey}
    >
      <span class="tn-chev">{on ? "▾" : "▸"}</span>

      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="tn-swatch"
        style="background:{node.color}"
        title="Click to change color"
        onclick={(e) => e.stopPropagation()}
      >
        <input
          type="color"
          value={node.color}
          oninput={(e) =>
            patch({ color: e.currentTarget.value }, `color:${node.id}`)}
        />
      </span>

      {#if renaming}
        {@render nameField("tn-rname-input")}
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="tn-rname"
          style="color:{node.color}"
          title="Double-click to rename"
          onclick={(e) => e.stopPropagation()}
          ondblclick={stop(() => (renaming = true))}>{node.name}</span
        >
      {/if}

      <span class="tn-actions">
        <button
          type="button"
          class="pb-icon"
          title="Move up"
          onclick={stop(() => move(-1))}>▲</button
        >
        <button
          type="button"
          class="pb-icon"
          title="Move down"
          onclick={stop(() => move(1))}>▼</button
        >
        <button
          type="button"
          class="pb-icon danger"
          title="Delete rule (Ctrl+Z to undo)"
          onclick={stop(remove)}>✕</button
        >
      </span>
    </div>

    {#if on}
      <div class="tn-rbody">
        <KeywordEditor
          keywords={node.keywords}
          color={node.color}
          onchange={setKeywords}
        />
      </div>
    {/if}
  </div>
{/if}
