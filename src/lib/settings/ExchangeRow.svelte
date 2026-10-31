<script lang="ts">
  import CdnImage from "$lib/trade/components/item/CdnImage.svelte";
  import ExchangeInputs from "$lib/settings/ExchangeInputs.svelte";
  import {
    LIFETIME_OPTIONS,
    type LifetimeId,
    type UserRatio,
  } from "$lib/trade/tradeStore";

  type Line = {
    id: string;
    arrow: string;
    left: number | null;
    right: number | null;
    custom: UserRatio | null;
    age: string;
    viaIcon?: string | null;
    viaName?: string;
  };

  let {
    leftIcon,
    leftName,
    rightIcon,
    rightName,
    rows,
    onCommit,
    onLifetime,
  }: {
    leftIcon?: string | null;
    leftName: string;
    rightIcon?: string | null;
    rightName: string;
    rows: Line[];
    onCommit: (rowId: string, l: number | null, r: number | null) => void;
    onLifetime: (rowId: string, id: LifetimeId) => void;
  } = $props();

  const total = $derived(Math.max(rows.length, 1));
</script>

<div class="ex-row">
  <div
    class="ex-cur ex-cur-left"
    style="grid-column: 1; grid-row: 1 / span {total};"
  >
    <span>{leftName}</span>
    {#if leftIcon}
      <CdnImage
        src={leftIcon}
        alt={leftName}
        className="ex-icon"
        loading="lazy"
      />
    {/if}
  </div>

  <div
    class="ex-cur ex-cur-right"
    style="grid-column: 3; grid-row: 1 / span {total};"
  >
    {#if rightIcon}
      <CdnImage
        src={rightIcon}
        alt={rightName}
        className="ex-icon"
        loading="lazy"
      />
    {/if}
    <span>{rightName}</span>
  </div>

  {#each rows as row, i (row.id)}
    <ExchangeInputs
      gridRow={i + 1}
      arrow={row.arrow}
      left={row.left}
      right={row.right}
      custom={row.custom}
      viaIcon={row.viaIcon}
      viaName={row.viaName}
      onCommit={(l, r) => onCommit(row.id, l, r)}
    />

    <div class="ex-end" style="grid-column: 4; grid-row: {i + 1};">
      {#if row.custom}
        <select
          class="st-select ex-life"
          aria-label="Custom ratio lifetime"
          onchange={(e) =>
            onLifetime(row.id, e.currentTarget.value as LifetimeId)}
        >
          {#each LIFETIME_OPTIONS as o}
            <option value={o.id} selected={o.id === row.custom.lifetime}>
              {o.label}
            </option>
          {/each}
        </select>
        <button
          type="button"
          class="st-btn ex-reset"
          aria-label="Remove custom ratio"
          onclick={() => onCommit(row.id, null, null)}>✕</button
        >
      {:else if row.age}
        <span class="ex-age">{row.age}</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ex-row {
    display: grid;
    grid-template-columns:
      minmax(90px, 1fr) max-content minmax(90px, 1fr)
      minmax(0, 210px);
    column-gap: 8px;
    row-gap: 4px;
    align-items: center;
    padding: 2px 0;
  }
  .ex-cur {
    display: flex;
    align-items: center;
    align-self: center;
    gap: 6px;
    min-width: 0;
    font-size: 13px;
  }
  .ex-cur span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ex-cur-left {
    justify-content: flex-end;
    text-align: right;
  }
  .ex-cur-right {
    justify-content: flex-start;
  }
  .ex-row :global(.ex-icon) {
    width: 24px;
    height: 24px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .ex-end {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
  }
  .ex-age {
    font-size: 12px;
    opacity: 0.6;
  }
  .ex-life {
    max-width: 150px;
    min-width: 0;
    font-size: 12px;
  }
  .ex-reset {
    padding: 2px 6px;
    flex: none;
  }
</style>
