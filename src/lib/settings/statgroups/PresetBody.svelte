<script lang="ts">
  import { get } from "svelte/store";
  import StatGroupsSection from "$lib/trade/components/drawer/StatGroupsSection.svelte";
  import { statsPoe, statsPoe2 } from "$lib/trade/tradeStore";
  import {
    buildCatalog,
    buildStatLookup,
    type CatalogGame,
  } from "$lib/trade/statCatalog";
  import type { PresetStatGroup } from "$lib/trade/statGroupPresets";
  import { trimTrailingEmptyGroup } from "$lib/trade/utilis/tradePayload";

  // Read once on creation; later edits flow out through `onchange`
  export let initialGroups: PresetStatGroup[] = [];
  export let game: CatalogGame = "any";
  export let onchange: (groups: PresetStatGroup[]) => void;

  const lookup = buildStatLookup(get(statsPoe), get(statsPoe2));

  function hydrate(groups: PresetStatGroup[]): any[] {
    return groups.map((g) => ({
      id: g.id,
      type: g.type,
      collapsed: false,
      value: g.value ? { ...g.value } : undefined,
      filters: g.filters.map((f) => {
        const entry = lookup.get(f.id);
        return {
          id: f.id,
          // Fall back to the saved text if the stat no longer exists in either game
          statEntry: entry ?? { id: f.id, text: f.text || f.id, type: "stat" },
          groupLabel: entry?.groupLabel,
          value: { ...(f.value || {}) },
          disabled: false,
        };
      }),
    }));
  }

  function serialize(groups: any[]): PresetStatGroup[] {
    return groups.map((g) => ({
      id: g.id,
      type: g.type,
      ...(g.value && Object.keys(g.value).length
        ? { value: { ...g.value } }
        : {}),
      filters: (g.filters || []).map((f: any) => ({
        id: f.id,
        text: f.statEntry?.text ?? f.id,
        value: { ...(f.value || {}) },
      })),
    }));
  }

  let statGroups: any[] = hydrate(initialGroups);
  let lastJson = JSON.stringify(serialize(statGroups));
  let isAddGroupMenuOpen = false;
  let bodyEl: HTMLDivElement;

  $: catalog = buildCatalog($statsPoe, $statsPoe2, game);
  // "any" keeps every group type available, so use the PoE 1 type list
  $: uiRealm = (game === "poe2" ? "poe2" : "poe") as "poe" | "poe2";

  $: {
    const next = serialize(statGroups);
    const json = JSON.stringify(next);
    if (json !== lastJson) {
      lastJson = json;
      onchange(next);
    }
  }

  function onWindowClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!(bodyEl?.contains(t) && t.closest(".add-group-menu-wrapper"))) {
      isAddGroupMenuOpen = false;
    }
  }
</script>

<svelte:window on:click={onWindowClick} />

<div bind:this={bodyEl}>
  <StatGroupsSection
    bind:statGroups
    bind:isAddGroupMenuOpen
    currentStatCatalog={catalog}
    realm={uiRealm}
    showPresets={false}
    showToggle={false}
    on:deleteGroup={(e) => {
      statGroups = statGroups.filter((g) => g.id !== e.detail);
    }}
    on:addGroup={(e) => {
      statGroups = [
        ...trimTrailingEmptyGroup(statGroups),
        {
          id: `stat_group_${Date.now()}`,
          type: e.detail,
          collapsed: false,
          filters: [],
        },
      ];
    }}
  />
</div>
