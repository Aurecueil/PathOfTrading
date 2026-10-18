<!-- src/lib/trade/components/item/stats/GrantedSkills.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Item } from "$lib/types/tradeItem";
  import CdnImage from "../CdnImage.svelte";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import type { ExtractedSkill } from "./extractSkills";

  export let skills: ExtractedSkill[] = [];

  const dispatch = createEventDispatcher<{
    itemhover: { item: Item; rect: DOMRect };
    itemleave: void;
  }>();

  function onEnter(e: Event, tooltipItem: Item | null) {
    if (!tooltipItem) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dispatch("itemhover", { item: tooltipItem, rect });
  }
</script>

<div class="granted-skills-group">
  {#each skills as sk}
    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
    <div
      class="granted-skill-row"
      class:has-tooltip={sk.tooltipItem !== null}
      role={sk.tooltipItem ? "button" : undefined}
      tabindex={sk.tooltipItem ? 0 : undefined}
      on:mouseenter={(e) => onEnter(e, sk.tooltipItem)}
      on:mouseleave={() => dispatch("itemleave")}
      on:focus={(e) => onEnter(e, sk.tooltipItem)}
      on:blur={() => dispatch("itemleave")}
    >
      {#if sk.icon}
        <CdnImage src={sk.icon} alt={sk.label} className="granted-skill-icon" />
      {/if}
      <span class="granted-skill-text">
        <StatColorText text={sk.label} />
      </span>
    </div>
  {/each}
</div>

<style>
  .granted-skills-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    width: 100%;
  }
  .granted-skill-row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 1px 6px;
    color: #6588ff;
    font-size: 19px;
    line-height: 1.22;
  }
  .granted-skill-row.has-tooltip {
    cursor: help;
  }
  .granted-skill-row.has-tooltip:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  :global(.granted-skill-icon) {
    width: 22px;
    height: 22px;
    object-fit: contain;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 0;
    background: #05070a;
    flex-shrink: 0;
  }
</style>
