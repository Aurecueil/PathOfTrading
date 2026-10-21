<script lang="ts">
  import { tick } from "svelte";
  import { base } from "$app/paths";
  import {
    updatePresets,
    type StatGroupPreset,
    type PresetGame,
    type PresetStatGroup,
  } from "$lib/trade/statGroupPresets";
  import PresetBody from "./PresetBody.svelte";

  let {
    preset,
    open,
    fresh,
    canMoveUp,
    canMoveDown,
    ontoggle,
    onmove,
  }: {
    preset: StatGroupPreset;
    open: boolean;
    fresh: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    ontoggle: () => void;
    onmove: (delta: -1 | 1) => void;
  } = $props();

  const GAMES: { id: PresetGame; label: string }[] = [
    { id: "any", label: "Any game" },
    { id: "poe", label: "PoE 1" },
    { id: "poe2", label: "PoE 2" },
  ];

  let armed = $state(false);
  let rootEl = $state<HTMLDivElement>();

  const groupCount = $derived(preset.groups.length);
  const statCount = $derived(
    preset.groups.reduce((n, g) => n + (g.filters?.length ?? 0), 0),
  );
  const logoSrc = $derived(
    preset.game === "poe" || preset.game === "poe2"
      ? `${base}/${preset.game}.png`
      : null,
  );
  const logoAlt = $derived(preset.game === "poe2" ? "PoE 2" : "PoE 1");

  // Keep the freshly opened card in view (the previously open one collapses above it)
  $effect(() => {
    if (open && rootEl) {
      tick().then(() =>
        rootEl?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
    }
  });

  function focusSel(el: HTMLInputElement, shouldFocus: boolean) {
    if (shouldFocus) {
      el.focus();
      el.select();
    }
  }

  function patch(fn: (p: StatGroupPreset) => void) {
    updatePresets((d) => {
      const p = d.find((x) => x.id === preset.id);
      if (p) fn(p);
    });
  }

  function rename(e: Event) {
    const name =
      (e.currentTarget as HTMLInputElement).value.trim() || "Untitled";
    if (name !== preset.name) patch((p) => (p.name = name));
  }
  function nameKeys(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
  }
  function setGame(e: Event) {
    const game = (e.currentTarget as HTMLSelectElement).value as PresetGame;
    patch((p) => (p.game = game));
  }
  function saveGroups(groups: PresetStatGroup[]) {
    patch((p) => (p.groups = groups));
  }
  function remove(e: MouseEvent) {
    e.stopPropagation();
    if (!armed) {
      armed = true;
      setTimeout(() => (armed = false), 2500);
      return;
    }
    updatePresets((d) => {
      const i = d.findIndex((x) => x.id === preset.id);
      if (i >= 0) d.splice(i, 1);
    });
  }
  function move(e: MouseEvent, delta: -1 | 1) {
    e.stopPropagation();
    onmove(delta);
  }
  function headKey(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      ontoggle();
    }
  }
  const stop = (e: Event) => e.stopPropagation();
</script>

<div class="sp-card" class:open bind:this={rootEl}>
  <div
    class="sp-head"
    role="button"
    tabindex="0"
    aria-expanded={open}
    onclick={ontoggle}
    onkeydown={headKey}
  >
    <span class="sp-chev">{open ? "▾" : "▸"}</span>

    {#if open}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <input
        class="sp-name-input"
        value={preset.name}
        placeholder="Preset name"
        use:focusSel={fresh}
        onclick={stop}
        onchange={rename}
        onkeydown={nameKeys}
      />

      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <select
        class="sp-game"
        title="Which game's stats can be added"
        value={preset.game}
        onclick={stop}
        onkeydown={stop}
        onchange={setGame}
      >
        {#each GAMES as g}
          <option value={g.id}>{g.label}</option>
        {/each}
      </select>
    {:else}
      {#if logoSrc}
        <img
          class="sp-logo"
          src={logoSrc}
          alt={logoAlt}
          title={logoAlt}
          width="16"
          height="16"
          onerror={(e) =>
            ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
      {/if}
      <span class="sp-name">{preset.name || "Untitled"}</span>
      <span class="sp-meta">
        {groupCount} group{groupCount === 1 ? "" : "s"} · {statCount} stat{statCount ===
        1
          ? ""
          : "s"}
      </span>
    {/if}

    <span class="sp-actions">
      <button
        type="button"
        class="sp-icon"
        title="Move up"
        aria-label="Move preset up"
        disabled={!canMoveUp}
        onclick={(e) => move(e, -1)}>▲</button
      >
      <button
        type="button"
        class="sp-icon"
        title="Move down"
        aria-label="Move preset down"
        disabled={!canMoveDown}
        onclick={(e) => move(e, 1)}>▼</button
      >
      <button
        type="button"
        class="sp-icon danger"
        class:armed
        title="Delete preset"
        aria-label="Delete preset"
        onclick={remove}
      >
        {armed ? "Sure?" : "✕"}
      </button>
    </span>
  </div>

  {#if open}
    <div class="sp-body">
      <PresetBody
        initialGroups={preset.groups}
        game={preset.game}
        onchange={saveGroups}
      />
    </div>
  {/if}
</div>

<style>
  .sp-card {
    background: #050505;
    border: 1px solid #555555;
    border-left: 3px solid #555555;
    transition:
      border-color 0.1s ease,
      background 0.1s ease;
  }
  .sp-card:hover,
  .sp-card.open {
    border-color: #ffffff;
  }

  .sp-head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 6px 0 8px;
    cursor: pointer;
    user-select: none;
    font-size: 13px;
  }
  .sp-head:hover {
    background: #0d0d0d;
  }
  .sp-head:focus-visible {
    outline: 1px solid #ffffff;
    outline-offset: -2px;
  }
  .sp-card.open .sp-head {
    background: #0a0a0a;
    border-bottom: 1px solid #333333;
  }

  .sp-chev {
    width: 14px;
    flex-shrink: 0;
    text-align: center;
    color: #888888;
    font-size: 11px;
  }
  .sp-head:hover .sp-chev {
    color: #ffffff;
  }

  .sp-logo {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .sp-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: bold;
    color: #ffffff;
  }
  .sp-meta {
    flex-shrink: 0;
    color: #777777;
    font-size: 11px;
    white-space: nowrap;
  }

  .sp-name-input,
  .sp-game {
    height: 24px;
    padding: 0 6px;
    background: #000000;
    color: #ffffff;
    border: 1px solid #7f7f7f;
    border-radius: 0;
    font-size: 12px;
    outline: none;
    min-width: 0;
  }
  .sp-name-input {
    flex: 0 1 260px;
    font-weight: bold;
  }
  .sp-game {
    flex: 0 0 auto;
    cursor: pointer;
  }
  .sp-name-input:hover,
  .sp-name-input:focus,
  .sp-game:hover,
  .sp-game:focus {
    border-color: #ffffff;
  }

  .sp-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    margin-left: auto;
    flex-shrink: 0;
  }
  .sp-icon {
    height: 22px;
    min-width: 22px;
    padding: 0 4px;
    background: transparent;
    border: none;
    color: #777777;
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
  }
  .sp-icon:hover:not(:disabled) {
    color: #ffffff;
  }
  .sp-icon:disabled {
    opacity: 0.25;
    cursor: default;
  }
  .sp-icon.danger:hover,
  .sp-icon.danger.armed {
    color: #ff4444;
  }

  /* Content sits directly under the header, no indent */
  .sp-body {
    padding: 8px;
    background: #000000;
  }
</style>
