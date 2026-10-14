<!-- src/lib/components/item/ItemStats.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type {
    Item,
    ItemProperty,
    ItemMod,
    ItemSocket,
  } from "$lib/types/tradeItem";
  import type { ResolvedDisplayStyle } from "$lib/types/types";
  import ItemModifier from "./ItemModifier.svelte";
  import CdnImage from "./CdnImage.svelte";

  export let item: Item;
  export let realm: string = "poe";
  export let styleMode: ResolvedDisplayStyle = "full";
  export let tileWidth: number = 600;

  let showBondedMods = false;

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

  function getSocketColor(socket: ItemSocket): string {
    const col = (
      socket.sColour ||
      socket.type ||
      socket.attr ||
      "w"
    ).toLowerCase();
    switch (col) {
      case "r":
      case "ruby":
        return "#ef4444";
      case "g":
      case "emerald":
        return "#22c55e";
      case "b":
      case "sapphire":
        return "#3b82f6";
      case "w":
      case "gem":
        return "#f8fafc";
      case "a":
      case "abyssal":
        return "#6366f1";
      default:
        return "#94a3b8";
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

  function isBondedImplicit(mod: string | ItemMod): boolean {
    const raw = typeof mod === "string" ? mod : mod.description || "";
    if (typeof mod !== "string" && mod.domain === "bonded") return true;
    return /\[[^\]]*Bonded\]/i.test(raw);
  }

  $: runeMods = item.runeMods ?? [];
  $: enchantMods = item.enchantMods ?? [];

  // Split implicitMods into regular implicits and bonded implicits ([ShamanOnlyMods|Bonded])
  $: separatedImplicits = (() => {
    const regular: Array<string | ItemMod> = [];
    const bonded: Array<string | ItemMod> = [...(item.bondedMods || [])];

    (item.implicitMods || []).forEach((mod) => {
      if (isBondedImplicit(mod)) {
        bonded.push(mod);
      } else {
        regular.push(mod);
      }
    });

    return { regular, bonded };
  })();

  $: classifiedExplicits = (() => {
    const prefixes: Array<{ mod: string | ItemMod; cat: "prefix" }> = [];
    const suffixes: Array<{ mod: string | ItemMod; cat: "suffix" }> = [];
    const others: Array<{ mod: string | ItemMod; cat: "generic" }> = [];

    (item.explicitMods || []).forEach((mod) => {
      if (typeof mod === "string") {
        others.push({ mod, cat: "generic" });
        return;
      }
      const firstTier = mod.mods?.[0]?.tier?.toUpperCase() || "";
      if (firstTier.startsWith("P")) {
        prefixes.push({ mod, cat: "prefix" });
      } else if (firstTier.startsWith("S")) {
        suffixes.push({ mod, cat: "suffix" });
      } else {
        others.push({ mod, cat: "generic" });
      }
    });

    return [...prefixes, ...suffixes, ...others];
  })();

  $: mutatedTag = (() => {
    if (!item.mutated) return null;
    return realm.toLowerCase() === "poe2" ? "CULTIVATED" : "FOULBORN";
  })();
</script>

{#if styleMode === "minimal"}
  <!-- MINIMAL VIEW: Full flag names, no dropdown, no mod count, no DPS -->
  <div class="minimal-stats">
    <div class="min-title-line {getRarityClass(item)}">
      {#if item.name}
        <span class="min-name">{item.name}</span>
      {/if}
      <span class="min-base">{item.typeLine || item.baseType}</span>
    </div>

    <div class="min-badges">
      {#if item.ilvl}
        <span class="meta-pill">iLvl {item.ilvl}</span>
      {/if}
      {#if item.identified === false}
        <span class="status-tag tag-unidentified">UNIDENTIFIED</span>
      {/if}
      {#if item.fractured}
        <span class="status-tag tag-fractured">FRACTURED</span>
      {/if}
      {#if item.sanctified}
        <span class="status-tag tag-sanctified">SANCTIFIED</span>
      {/if}
      {#if item.corrupted}
        <span class="status-tag tag-corrupted">CORRUPTED</span>
      {/if}
      {#if mutatedTag}
        <span class="status-tag tag-mutated">{mutatedTag}</span>
      {/if}
    </div>
  </div>
{:else}
  <!-- COMPACT & FULL VIEW -->
  <div class="stats-container mode-{styleMode}">
    <!-- Top Header Banner -->
    <div class="item-header-banner {getRarityClass(item)}">
      <div class="header-titles">
        {#if item.name}
          <span class="item-title-name">{item.name}</span>
        {/if}
        <span class="item-title-base">{item.typeLine || item.baseType}</span>
      </div>

      <!-- Small inline sockets indicator in Compact mode -->
      {#if styleMode === "compact" && item.sockets && item.sockets.length > 0}
        <div class="inline-sockets" title="{item.sockets.length} Sockets">
          {#each item.sockets as sock, si}
            {#if si > 0 && item.sockets[si - 1].group === sock.group}
              <span class="inline-socket-link"></span>
            {/if}
            <span
              class="inline-socket-dot"
              style:background={getSocketColor(sock)}
            ></span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Wrapped Properties Grid -->
    {#if item.properties && item.properties.length > 0}
      <div class="properties-wrap-grid">
        {#each item.properties as prop}
          {@const formatted = formatProperty(prop)}
          <div class="prop-chip">
            {#if styleMode === "full" && formatted.icon}
              <CdnImage src={formatted.icon} alt="" className="prop-icon" />
            {/if}
            {#if formatted.values.length > 0}
              <span class="label">{formatted.label}:</span>
              {#each formatted.values as val, vi}
                <strong class:augmented={val.augmented}>{val.text}</strong>{vi <
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
    {#if item.ilvl || (item.requirements && item.requirements.length > 0)}
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
    {/if}

    <!-- Rune & Enchant Mods -->
    {#if runeMods.length > 0 || enchantMods.length > 0}
      <div class="separator-line" />
      <div class="stat-group">
        {#each runeMods as mod}
          <ItemModifier
            {mod}
            {realm}
            category="rune"
            compact={styleMode === "compact"}
          />
        {/each}
        {#each enchantMods as mod}
          <ItemModifier
            {mod}
            {realm}
            category="enchant"
            compact={styleMode === "compact"}
          />
        {/each}
      </div>
    {/if}

    <!-- Implicit & Bonded Mods (with small side toggle for Bonded) -->
    {#if separatedImplicits.regular.length > 0 || separatedImplicits.bonded.length > 0}
      <div class="separator-line" />
      <div class="stat-group implicit-section">
        {#if separatedImplicits.bonded.length > 0}
          <button
            type="button"
            class="btn-side-bonded"
            class:active={showBondedMods}
            title={showBondedMods
              ? "Hide Bonded Modifiers"
              : "Show Bonded Modifiers"}
            on:click|stopPropagation={() => (showBondedMods = !showBondedMods)}
          >
            {showBondedMods
              ? "Hide Bonded"
              : `+${separatedImplicits.bonded.length} Bonded`}
          </button>
        {/if}

        {#each separatedImplicits.regular as mod}
          <ItemModifier
            {mod}
            {realm}
            category="implicit"
            compact={styleMode === "compact"}
          />
        {/each}

        {#if showBondedMods}
          {#each separatedImplicits.bonded as bMod}
            <ItemModifier
              mod={bMod}
              {realm}
              category="bonded"
              compact={styleMode === "compact"}
            />
          {/each}
        {/if}
      </div>
    {/if}

    <!-- Explicit Mods -->
    {#if classifiedExplicits.length > 0}
      <div class="separator-line" />
      <div class="stat-group">
        {#each classifiedExplicits as entry}
          <ItemModifier
            mod={entry.mod}
            {realm}
            category={entry.cat}
            compact={styleMode === "compact"}
          />
        {/each}
      </div>
    {/if}

    <!-- Mercenary Skills (PoE2) -->
    {#if item.mercenarySkills && item.mercenarySkills.length > 0}
      <div class="separator-line" />
      <div class="stat-group mercenary-group">
        {#each item.mercenarySkills as skill}
          <div class="mercenary-skill-line">
            {#if styleMode === "full"}
              <CdnImage
                src={skill.icon}
                alt={skill.name}
                className="skill-icon"
              />
            {/if}
            <span class="skill-name">{skill.name}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Bottom Status Tags -->
    {#if item.identified === false || item.corrupted || item.sanctified || item.fractured || mutatedTag}
      <div class="bottom-tags-container">
        {#if item.identified === false}
          <span class="status-tag tag-unidentified">UNIDENTIFIED</span>
        {/if}
        {#if item.fractured}
          <span class="status-tag tag-fractured">FRACTURED</span>
        {/if}
        {#if item.sanctified}
          <span class="status-tag tag-sanctified">SANCTIFIED</span>
        {/if}
        {#if item.corrupted}
          <span class="status-tag tag-corrupted">CORRUPTED</span>
        {/if}
        {#if mutatedTag}
          <span class="status-tag tag-mutated">{mutatedTag}</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Minimal Mode */
  .minimal-stats {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .min-title-line {
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .min-name {
    font-weight: 700;
    margin-right: 0.3rem;
  }
  .min-badges {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .meta-pill {
    font-size: 0.64rem;
    background: #161c28;
    border: 1px solid #263044;
    color: #94a3b8;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: ui-monospace, monospace;
  }

  /* Full & Compact Modes */
  .stats-container {
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
    width: 100%;
  }
  .stats-container.mode-compact {
    gap: 0.18rem;
  }

  .item-header-banner {
    background: #141822;
    border: 1px solid #283042;
    border-radius: 4px;
    padding: 0.28rem 1.8rem 0.28rem 0.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    overflow: hidden;
  }
  .mode-compact .item-header-banner {
    justify-content: space-between;
    padding: 0.2rem 1.8rem 0.2rem 0.45rem;
    font-size: 0.76rem;
  }
  .header-titles {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item-title-name {
    font-weight: 700;
    margin-right: 0.35rem;
  }

  /* Inline Sockets in Compact Header */
  .inline-sockets {
    display: inline-flex;
    align-items: center;
    background: #090c12;
    border: 1px solid #263044;
    padding: 2px 5px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .inline-socket-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.7);
    display: inline-block;
  }
  .inline-socket-link {
    width: 5px;
    height: 2px;
    background: #c29d5b;
    display: inline-block;
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

  /* Wrapped Properties Grid */
  .properties-wrap-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0.2rem 0.45rem;
    padding: 0.1rem 0.2rem;
  }
  .prop-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    font-size: 0.72rem;
    color: #cbd5e1;
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid #1e2638;
    padding: 1px 6px;
    border-radius: 3px;
  }
  .mode-compact .prop-chip {
    font-size: 0.67rem;
    padding: 0px 4px;
  }
  .prop-chip .label {
    color: #64748b;
  }
  .prop-chip strong {
    font-weight: 600;
    color: #e2e8f0;
  }
  .prop-chip strong.augmented {
    color: #7dd3fc;
  }

  :global(.prop-icon) {
    width: 13px;
    height: 13px;
    object-fit: contain;
  }

  .stat-group {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    width: 100%;
  }
  .implicit-section {
    position: relative;
    min-height: 1.3rem;
    justify-content: center;
  }

  /* Small Bonded Toggle on the Right Side */
  .btn-side-bonded {
    position: absolute;
    right: 2px;
    top: 1px;
    z-index: 10;
    background: rgba(15, 23, 42, 0.9);
    border: 1px solid rgba(45, 212, 191, 0.35);
    color: #5eead4;
    font-size: 0.58rem;
    font-weight: 600;
    line-height: 1;
    padding: 2px 5px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-side-bonded:hover,
  .btn-side-bonded.active {
    background: rgba(20, 184, 166, 0.22);
    border-color: #2dd4bf;
  }

  .meta-req-group {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.6rem;
    color: #64748b;
    font-size: 0.7rem;
  }
  .mode-compact .meta-req-group {
    font-size: 0.66rem;
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
    font-size: 0.73rem;
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
    margin: 0.08rem 0;
  }
  .bottom-tags-container {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.1rem;
  }
  .status-tag {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    letter-spacing: 0.4px;
  }
  .tag-unidentified,
  .tag-fractured {
    color: #eab308;
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.3);
  }
  .tag-sanctified {
    color: #facc15;
    background: rgba(250, 204, 21, 0.14);
    border: 1px solid rgba(250, 204, 21, 0.45);
    box-shadow: 0 0 6px rgba(250, 204, 21, 0.15);
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
