<!-- src/lib/components/item/ItemStats.svelte -->
<script lang="ts">
  import type { Item, ItemProperty, ItemMod } from "$lib/types/item";
  import ItemModifier from "./ItemModifier.svelte";
  import CdnImage from "$lib/trade/componenets/item/CdnImage.svelte";

  export let item: Item;
  export let realm: string = "poe";

  function getRarityClass(item: Item): string {
    const rarity = (item.rarity || "").toLowerCase();
    if (rarity) return `rarity-${rarity}`;
    switch (item.frameType) {
      case 0:
        return "rarity-normal";
      case 1:
        return "rarity-magic";
      case 2:
        return "rarity-rare";
      case 3:
        return "rarity-unique";
      case 4:
        return "rarity-gem";
      case 5:
        return "rarity-currency";
      default:
        return "rarity-rare";
    }
  }

  function formatProperty(prop: ItemProperty) {
    const parsedValues = (prop.values || []).map(([text, type]) => ({
      text,
      augmented: type === 1,
    }));

    if (prop.displayMode === 3) {
      let templated = prop.name;
      parsedValues.forEach((val, idx) => {
        templated = templated.replace(`{${idx}}`, val.text);
      });
      return { label: templated, values: [], icon: prop.icon };
    }
    return { label: prop.name, values: parsedValues, icon: prop.icon };
  }

  $: enchantMods = item.enchantMods ?? [];
  $: implicitMods = item.implicitMods ?? [];
  $: classifiedMods = (() => {
    const prefixes: Array<string | ItemMod> = [];
    const suffixes: Array<string | ItemMod> = [];
    const others: Array<string | ItemMod> = [];

    (item.explicitMods || []).forEach((mod) => {
      if (typeof mod === "string") {
        others.push(mod);
        return;
      }
      const firstTier = mod.mods?.[0]?.tier?.toUpperCase() || "";
      if (firstTier.startsWith("P")) {
        prefixes.push(mod);
      } else if (firstTier.startsWith("S")) {
        suffixes.push(mod);
      } else {
        others.push(mod);
      }
    });

    return { prefixes, suffixes, others };
  })();

  $: mutatedTag = (() => {
    if (!item.mutated) return null;
    return realm.toLowerCase() === "poe2" ? "CULTIVATED" : "FOULBORN";
  })();
</script>

<div class="stats-container">
  <!-- Top Header Banner -->
  <div class="item-header-banner {getRarityClass(item)}">
    {#if item.name}
      <span class="item-title-name">{item.name}</span>
    {/if}
    <span class="item-title-base">{item.typeLine || item.baseType}</span>
  </div>

  <!-- Properties (Supports prop.icon via CDN fetch) -->
  {#if item.properties && item.properties.length > 0}
    <div class="stat-group properties-group">
      {#each item.properties as prop}
        {@const formatted = formatProperty(prop)}
        <div class="centered-stat-line">
          {#if formatted.icon}
            <CdnImage src={formatted.icon} alt="" className="prop-icon" />
          {/if}
          {#if formatted.values.length > 0}
            <span class="label">{formatted.label}: </span>
            {#each formatted.values as val, vi}
              <span class:augmented={val.augmented}>{val.text}</span>{vi <
              formatted.values.length - 1
                ? ", "
                : ""}
            {/each}
          {:else}
            <span>{formatted.label}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Ilvl & Requirements -->
  <div class="stat-group meta-req-group">
    {#if item.ilvl}
      <span>Item Level: <strong>{item.ilvl}</strong></span>
    {/if}
    {#if item.requirements && item.requirements.length > 0}
      <span>
        Requires
        {#each item.requirements as req, ri}
          {req.name} <strong>{req.values[0]?.[0]}</strong>{ri <
          item.requirements.length - 1
            ? ", "
            : ""}
        {/each}
      </span>
    {/if}
  </div>

  <!-- Enchant Mods -->
  {#if enchantMods.length > 0}
    <div class="separator-line" />
    <div class="stat-group">
      {#each enchantMods as mod}
        <ItemModifier {mod} category="enchant" />
      {/each}
    </div>
  {/if}

  <!-- Implicit Mods -->
  {#if implicitMods.length > 0}
    <div class="separator-line" />
    <div class="stat-group">
      {#each implicitMods as mod}
        <ItemModifier {mod} category="implicit" />
      {/each}
    </div>
  {/if}

  <!-- Explicit Mods -->
  {#if classifiedMods.prefixes.length > 0 || classifiedMods.suffixes.length > 0 || classifiedMods.others.length > 0}
    <div class="separator-line" />
    <div class="stat-group">
      {#each classifiedMods.prefixes as mod}
        <ItemModifier {mod} category="prefix" />
      {/each}
      {#each classifiedMods.suffixes as mod}
        <ItemModifier {mod} category="suffix" />
      {/each}
      {#each classifiedMods.others as mod}
        <ItemModifier {mod} category="generic" />
      {/each}
    </div>
  {/if}

  <!-- Mercenary Skills (PoE2) -->
  {#if item.mercenarySkills && item.mercenarySkills.length > 0}
    <div class="separator-line" />
    <div class="stat-group mercenary-group">
      {#each item.mercenarySkills as skill}
        <div class="mercenary-skill-line">
          <CdnImage src={skill.icon} alt={skill.name} className="skill-icon" />
          <span class="skill-name">{skill.name}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Bottom Status Tags -->
  <div class="bottom-tags-container">
    {#if item.identified === false}
      <span class="status-tag tag-unidentified">UNIDENTIFIED</span>
    {/if}
    {#if item.corrupted}
      <span class="status-tag tag-corrupted">CORRUPTED</span>
    {/if}
    {#if mutatedTag}
      <span class="status-tag tag-mutated">{mutatedTag}</span>
    {/if}
  </div>
</div>

<style>
  .stats-container {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: 100%;
  }

  .item-header-banner {
    background: #141822;
    border: 1px solid #283042;
    border-radius: 3px;
    padding: 0.3rem 0.6rem;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item-title-name {
    font-weight: 700;
    margin-right: 0.35rem;
  }
  .item-title-base {
    opacity: 0.95;
  }

  /* Rarities */
  .rarity-normal {
    color: #c8c8c8;
    border-color: #3b4252;
  }
  .rarity-magic {
    color: #8888ff;
    border-color: #373b6b;
  }
  .rarity-rare {
    color: #f5ee89;
    border-color: #6d6531;
  }
  .rarity-unique {
    color: #af6025;
    border-color: #6e3a17;
  }
  .rarity-gem {
    color: #1aa29b;
    border-color: #17524e;
  }
  .rarity-currency {
    color: #aa9e82;
    border-color: #4b453a;
  }

  .stat-group {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    width: 100%;
  }

  .centered-stat-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    color: #94a3b8;
    font-size: 0.74rem;
  }
  .centered-stat-line .label {
    color: #64748b;
  }
  .augmented {
    color: #8888ff;
  }

  :global(.prop-icon) {
    width: 14px;
    height: 14px;
    object-fit: contain;
    vertical-align: middle;
  }

  .meta-req-group {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.6rem;
    color: #64748b;
    font-size: 0.71rem;
  }
  .meta-req-group strong {
    color: #cbd5e1;
  }

  .mercenary-skill-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  :global(.skill-icon) {
    width: 18px;
    height: 18px;
    border-radius: 2px;
  }

  .skill-name {
    color: #cbd5e1;
    font-size: 0.74rem;
  }

  .separator-line {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      #283042 20%,
      #283042 80%,
      transparent
    );
    margin: 0.15rem 0;
  }

  .bottom-tags-container {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.25rem;
  }
  .status-tag {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    letter-spacing: 0.5px;
  }
  .tag-unidentified {
    color: #eab308;
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.3);
  }
  .tag-corrupted {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
  .tag-mutated {
    color: #d946ef;
    background: rgba(217, 70, 239, 0.12);
    border: 1px solid rgba(217, 70, 239, 0.35);
  }
</style>
