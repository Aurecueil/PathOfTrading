<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let title: string = "";
  export let computedDisplayName: string = "";
  export let isEditingTitle: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();
</script>

<div class="header">
  <div class="title-area">
    {#if isEditingTitle}
      <!-- svelte-ignore a11y-autofocus -->
      <input
        type="text"
        class="title-input"
        bind:value={title}
        placeholder="Custom title..."
        on:blur={() => (isEditingTitle = false)}
        on:keydown={(e) => e.key === "Enter" && (isEditingTitle = false)}
        autofocus
      />
    {:else}
      <h3
        on:dblclick={() => (isEditingTitle = true)}
        title="Double click to rename"
      >
        {computedDisplayName}
      </h3>
    {/if}
  </div>
  <button type="button" class="close-btn" on:click={() => dispatch("close")}>✕</button>
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid #232838;
    background: #14161f;
    flex-shrink: 0;
  }
  .title-area {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    margin-right: 0.75rem;
  }
  .title-area h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #e2e8f0;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title-input {
    background: #232838;
    border: 1px solid #3b82f6;
    color: #fff;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
    outline: none;
    width: 260px;
  }
  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 1.15rem;
    padding: 0.2rem 0.4rem;
  }
</style>