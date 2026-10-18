<!-- src/lib/trade/components/item/stats/ItemProperties.svelte -->
<script lang="ts">
  import type { Item } from "$lib/types/tradeItem";
  import CdnImage from "../CdnImage.svelte";
  import StatColorText from "$lib/trade/components/drawer/StatColorText.svelte";
  import SpecialProp from "./SpecialProp.svelte";
  import ItemSockets from "./ItemSockets.svelte";
  import {
    buildKpiStats,
    buildRequirementEntries,
    groupProperties,
  } from "./propertyGroups";
  import { getInlineSockets } from "./inlineSockets";

  export let item: Item;
  export let effectiveMode: string = "full";

  $: isCompact = effectiveMode === "compact";
  $: isFull = effectiveMode === "full";

  $: ilvl = item.ilvl || item.itemLevel || 0;
  $: kpiStats = buildKpiStats(item);
  $: groupedProps = groupProperties(item, isCompact);
  $: requirementEntries = buildRequirementEntries(item);
  $: sockets = getInlineSockets(item, effectiveMode);

  $: hasMetaReqQualityLine =
    ilvl > 0 ||
    requirementEntries.length > 0 ||
    groupedProps.qualityProp !== null;

  $: hasContent =
    kpiStats.length > 0 ||
    groupedProps.defenceLine.length > 0 ||
    groupedProps.weaponRateLine.length > 0 ||
    groupedProps.singleLines.length > 0 ||
    groupedProps.specialLines.length > 0 ||
    hasMetaReqQualityLine ||
    sockets.length > 0;
</script>

{#if hasContent}
  <div class="top-stats-block" class:compact={isCompact}>
    <!-- Exception 1: DPS, pDPS, eDPS in one line -->
    {#if kpiStats.length > 0}
      <div class="prop-line">
        {#each kpiStats as kpi}
          <span class="prop-item">
            <span class="label">
              <StatColorText text={kpi.label} />:
            </span>
            <strong class:augmented={kpi.augmented}>{kpi.value}</strong>
          </span>
        {/each}
      </div>
    {/if}

    <!-- Exception 2: Evasion Rating, Energy Shield, Armour in one line -->
    {#if groupedProps.defenceLine.length > 0}
      <div class="prop-line">
        {#each groupedProps.defenceLine as formatted}
          <span class="prop-item">
            {#if isFull && formatted.icon}
              <CdnImage src={formatted.icon} alt="" className="prop-icon" />
            {/if}
            <span class="label"><StatColorText text={formatted.label} />:</span>
            {#each formatted.values as val, vi}
              <strong style="color: {val.color}"
                ><StatColorText text={val.text} />{vi <
                formatted.values.length - 1
                  ? ","
                  : ""}</strong
              >
            {/each}
          </span>
        {/each}
      </div>
    {/if}

    <!-- Regular properties: exactly ONE per line -->
    {#each groupedProps.singleLines as formatted}
      <div class="prop-line">
        <span class="prop-item">
          {#if isFull && formatted.icon}
            <CdnImage src={formatted.icon} alt="" className="prop-icon" />
          {/if}
          {#if formatted.values.length > 0}
            <span class="label">
              {#if formatted.label.toLowerCase().includes("damage")}
                {@const parts = formatted.label.split(/(damage)/i)}
                {#each parts as part}
                  {#if part.toLowerCase() === "damage"}
                    <span style="color: #E22626;">{part}</span>
                  {:else}
                    <StatColorText text={part} />
                  {/if}
                {/each}
              {:else}
                <StatColorText text={formatted.label} />
              {/if}
              :</span
            >
            {#each formatted.values as val, vi}
              <strong style="color: {val.color}"
                ><StatColorText text={val.text} />{vi <
                formatted.values.length - 1
                  ? ","
                  : ""}</strong
              >
            {/each}
          {:else}
            <span class="prop-tag-only">
              {#if formatted.label.toLowerCase().includes("damage")}
                {@const parts = formatted.label.split(/(damage)/i)}
                {#each parts as part}
                  {#if part.toLowerCase() === "damage"}
                    <span style="color: #E22626;">{part}</span>
                  {:else}
                    <StatColorText text={part} />
                  {/if}
                {/each}
              {:else}
                <StatColorText text={formatted.label} />
              {/if}
            </span>
          {/if}
        </span>
      </div>
    {/each}
    <!-- Special styled properties: Memory Strands (99), Intangibility (110) -->
    {#each groupedProps.specialLines as sp}
      <div class="prop-line">
        <SpecialProp
          kind={sp.special ?? "memory"}
          label={sp.label}
          values={sp.values}
        />
      </div>
    {/each}

    <!-- Exception 3: Attacks per Second, Critical Hit/Strike Chance, Reload Time -->
    {#if groupedProps.weaponRateLine.length > 0}
      <div class="prop-line">
        {#each groupedProps.weaponRateLine as formatted}
          <span class="prop-item">
            {#if isFull && formatted.icon}
              <CdnImage src={formatted.icon} alt="" className="prop-icon" />
            {/if}
            <span class="label"><StatColorText text={formatted.label} />:</span>
            {#each formatted.values as val, vi}
              <strong style="color: {val.color}"
                ><StatColorText text={val.text} />{vi <
                formatted.values.length - 1
                  ? ","
                  : ""}</strong
              >
            {/each}
          </span>
        {/each}
      </div>
    {/if}

    <!-- Exception 4: Item Level, Requirements, Quality: ONE line (never wraps) -->
    {#if hasMetaReqQualityLine}
      <div class="prop-line meta-req-line">
        {#if ilvl > 0}
          <span class="prop-item">
            <span class="label">Item Level:</span>
            <strong>{ilvl}</strong>
          </span>
        {/if}

        {#if requirementEntries.length > 0}
          <span class="prop-item">
            <span class="label">Requires:</span>
            {#each requirementEntries as req, ri}
              <span class="req-entry">
                {#if req.name}<span class="label"
                    ><StatColorText text={req.name} /></span
                  >{/if}
                {#if req.value}<strong
                    ><StatColorText text={req.value} />{ri <
                    requirementEntries.length - 1
                      ? ","
                      : ""}</strong
                  >{/if}
              </span>
            {/each}
          </span>
        {/if}

        {#if groupedProps.qualityProp}
          <span class="prop-item">
            <span class="label"
              ><StatColorText text={groupedProps.qualityProp.label} />:</span
            >
            {#each groupedProps.qualityProp.values as val, vi}
              <strong style="color: {val.color}"
                ><StatColorText text={val.text} />{vi <
                groupedProps.qualityProp.values.length - 1
                  ? ","
                  : ""}</strong
              >
            {/each}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Sockets on their own line -->
    <ItemSockets {sockets} on:itemhover on:itemleave />
  </div>
{/if}

<style>
  .top-stats-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.12rem;
    width: 100%;
  }
  .prop-line {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    column-gap: 0.9rem;
    row-gap: 0.08rem;
    width: 100%;
    text-align: center;
  }
  /* Item level + requirements + quality never wrap onto another line */
  .prop-line.meta-req-line {
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow: hidden;
  }
  .prop-item {
    display: inline-flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    gap: 0.32rem;
    font-size: 0.95rem;
    line-height: 1.22;
    color: #cbd5e1;
  }
  .top-stats-block.compact .prop-item {
    font-size: 0.9rem;
  }
  .req-entry {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .prop-item .label {
    color: #8b9bb4;
  }
  .prop-item strong {
    font-weight: 600;
    color: #f1f5f9;
  }
  .prop-item strong.augmented {
    color: #6588ff;
  }
  .prop-tag-only {
    color: #94a3b8;
  }
  :global(.prop-icon) {
    width: 15px;
    height: 15px;
    object-fit: contain;
  }
</style>
