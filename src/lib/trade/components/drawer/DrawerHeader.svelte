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
  <button type="button" class="close-btn" on:click={() => dispatch("close")}
    >✕</button
  >
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    border-bottom: 1px solid #777777;
    background: #050505;
    flex-shrink: 0;
    height: 36px;
    box-sizing: border-box;
  }

  .title-area {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    margin-right: 0.5rem;
  }

  .title-area h3 {
    margin: 0;
    font-family: "Fontin", monospace, sans-serif;
    font-size: 16px;
    color: #e0e0e0;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title-input {
    font-family: "Fontin", monospace, sans-serif;
    font-size: 12px;
    line-height: 1.15;
    height: 22px;
    background: #000000;
    border: 1px solid #7f7f7f;
    border-radius: 0px;
    color: #ffffff;
    padding: 0 4px;
    outline: none;
    width: 260px;
    box-sizing: border-box;
  }

  .title-input:hover,
  .title-input:focus {
    border-color: #ffffff;
  }

  /* Borderless ✕ close button */
  .close-btn {
    font-family: "Fontin", monospace, sans-serif;
    background: transparent;
    border: none;
    border-radius: 0px;
    color: #888888;
    cursor: pointer;
    font-size: 12px;
    padding: 0 4px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: #ff5555;
    background: transparent;
  }
</style>
