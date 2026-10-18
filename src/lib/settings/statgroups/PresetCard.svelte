<script lang="ts">
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
    ontoggle,
  }: {
    preset: StatGroupPreset;
    open: boolean;
    fresh: boolean;
    ontoggle: () => void;
  } = $props();

  const GAMES: { id: PresetGame; label: string }[] = [
    { id: "any", label: "Any game" },
    { id: "poe", label: "PoE 1" },
    { id: "poe2", label: "PoE 2" },
  ];

  let armed = $state(false);

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
  function headKey(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      ontoggle();
    }
  }
  const stop = (e: Event) => e.stopPropagation();
</script>

<div>
  <div
    class="tn-ghead"
    role="button"
    tabindex="0"
    onclick={ontoggle}
    onkeydown={headKey}
  >
    <span class="tn-chev">{open ? "▾" : "▸"}</span>

    {#if open}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <input
        class="st-input tn-gname-input"
        value={preset.name}
        use:focusSel={fresh}
        onclick={stop}
        onchange={rename}
        onkeydown={nameKeys}
      />
    {:else}
      <span class="tn-gname">{preset.name || "Untitled"}</span>
    {/if}

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <select
      class="st-select"
      style="height:24px;flex:0 0 auto"
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

    <span class="tn-actions">
      <button
        type="button"
        class="pb-icon danger"
        title="Delete preset"
        style={armed ? "color:#ff3333" : ""}
        onclick={remove}
      >
        {armed ? "Sure?" : "✕"}
      </button>
    </span>
  </div>

  {#if open}
    <div class="tn-gbody">
      <PresetBody
        initialGroups={preset.groups}
        game={preset.game}
        onchange={saveGroups}
      />
    </div>
  {/if}
</div>
