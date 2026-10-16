<!-- src/lib/trade/components/item/ItemSockets.svelte -->
<script lang="ts">
  import type { Item, ItemSocket } from "$lib/types/tradeItem";
  import ItemStats from "$lib/trade/components/item/ItemStats.svelte";
  import CdnImage from "./CdnImage.svelte";
  import {
    SHEET_1,
    SOCKET_SIZE,
    LINK_H,
    LINK_V,
    getBase,
  } from "./socketSprites";
  import type { Sprite } from "./socketSprites";

  export let sockets: ItemSocket[] = [];
  export let socketedItems: Item[] = [];
  export let w: number = 1;
  export let h: number = 1;
  export let realm: string = "poe";
  /** Rendered width (px) of the item image; the socket grid is laid out on it. */
  export let gridWidth: number = 0;

  interface Cell {
    idx: number;
    col: number;
    row: number;
    group: number;
    item: Item | null;
    base: Sprite | null;
    iconSrc: string | null;
  }

  $: nonGemSockets = sockets
    .map((socket, idx) => ({ socket, idx }))
    .filter(({ socket }) => (socket.type || "").toLowerCase() !== "gem")
    .slice(0, 6);

  $: socketCount = nonGemSockets.length;

  // 1 -> 1x1, 2 -> 2x1, 3-4 -> 2x2, 5-6 -> 2x3
  $: ({ cols, rows } = (() => {
    if (socketCount <= 1) return { cols: 1, rows: 1 };
    if (socketCount === 2) return { cols: 2, rows: 1 };
    if (socketCount <= 4) return { cols: 2, rows: 2 };
    return { cols: 2, rows: 3 };
  })());

  // Sockets keep a fixed size; the grid only decides POSITIONS.
  // The grid is always a SQUARE: width = rendered image width, height = width
  // (never smaller than what the sockets themselves need).
  $: side = Math.max(gridWidth, cols * SOCKET_SIZE, rows * SOCKET_SIZE);

  const boxSize = (c: Cell) => c.base?.size ?? SOCKET_SIZE;

  function place(i: number, c: number): { col: number; row: number } {
    if (c === 1) return { col: 0, row: i };
    const row = Math.floor(i / 2);
    const pos = i % 2;
    return { col: row % 2 === 0 ? pos : 1 - pos, row };
  }

  $: cells = nonGemSockets.map(({ socket, idx }, i): Cell => {
    const { col, row } = place(i, cols);
    const item = socketedItems.find((it) => it.socket === idx) ?? null;
    const isPoe2 = Boolean(socket.type);
    return {
      idx,
      col,
      row,
      group: socket.group,
      item,
      base: getBase(socket),
      iconSrc: isPoe2 ? (item?.socketedIcon ?? item?.icon ?? null) : null,
    };
  });

  $: links = cells.slice(0, -1).flatMap((a, i) => {
    const b = cells[i + 1];
    if (a.group !== b.group) return [];
    return [
      {
        x: ((a.col + b.col + 1) / 2 / cols) * 100,
        y: ((a.row + b.row + 1) / 2 / rows) * 100,
        horizontal: a.row === b.row,
      },
    ];
  });

  const TIP_W = 360;
  let hovered: { item: Item; left: number; top: number } | null = null;

  function showTip(e: Event, item: Item | null) {
    if (!item) return;
    const rect = (e.currentTarget as HTMLElement)
      .querySelector(".box")!
      .getBoundingClientRect();
    let left = rect.right + 8;
    if (left + TIP_W > window.innerWidth - 8) {
      left = Math.max(8, rect.left - TIP_W - 8);
    }
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 320));
    hovered = { item, left, top };
  }

  function hideTip() {
    hovered = null;
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

<div class="sockets-overlay">
  <div class="sockets-grid" style:width="{side}px" style:height="{side}px">
    {#each links as link}
      <span class="link-pos" style:left="{link.x}%" style:top="{link.y}%">
        {#if link.horizontal}
          <span
            class="sprite"
            style="width:{LINK_H.w}px;height:{LINK_H.h}px;--x:{LINK_H.x}px;--y:{LINK_H.y}px"
          >
            <CdnImage
              src={SHEET_1}
              alt=""
              className="sheet-img"
              loading="eager"
            />
          </span>
        {:else}
          <span
            class="sprite"
            style="width:{LINK_V.w}px;height:{LINK_V.h}px;--x:{LINK_V.x}px;--y:{LINK_V.y}px"
          >
            <CdnImage
              src={SHEET_1}
              alt=""
              className="sheet-img"
              loading="eager"
            />
          </span>
        {/if}
      </span>
    {/each}

    {#each cells as cell (cell.idx)}
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <div
        class="slot"
        class:has-item={cell.item !== null}
        style:left="{(cell.col / cols) * 100}%"
        style:top="{(cell.row / rows) * 100}%"
        style:width="{100 / cols}%"
        style:height="{100 / rows}%"
        role={cell.item ? "button" : undefined}
        tabindex={cell.item ? 0 : undefined}
        aria-label={cell.item?.typeLine || cell.item?.name || undefined}
        on:mouseenter={(e) => showTip(e, cell.item)}
        on:mouseleave={hideTip}
        on:focus={(e) => showTip(e, cell.item)}
        on:blur={hideTip}
      >
        <div
          class="box"
          style:width="{boxSize(cell)}px"
          style:height="{boxSize(cell)}px"
          style:transform={cell.base?.fixedScale
            ? `scale(${cell.base.fixedScale})`
            : undefined}
        >
          {#if cell.base}
            <span
              class="sprite"
              style:width="{cell.base.size}px"
              style:height="{cell.base.size}px"
              style:--x="{cell.base.pos[0]}px"
              style:--y="{cell.base.pos[1]}px"
            >
              <CdnImage
                src={cell.base.sheet}
                alt=""
                className="sheet-img"
                loading="eager"
              />
            </span>
          {:else}
            <span class="ring"></span>
          {/if}

          {#if cell.iconSrc}
            <span class="icon-layer">
              <CdnImage
                src={cell.iconSrc}
                alt={cell.item?.typeLine || cell.item?.name || ""}
                className="socketed-icon"
                loading="eager"
              />
            </span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

{#if hovered}
  <div
    class="socket-tooltip"
    use:portal
    style:left="{hovered.left}px"
    style:top="{hovered.top}px"
    style:width="{TIP_W}px"
  >
    <ItemStats
      item={hovered.item}
      {realm}
      styleMode="compact"
      isTooltip={true}
      tileWidth={TIP_W}
    />
  </div>
{/if}

<style>
  .sockets-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  /* Square grid (height === width) centered on the item; sockets inside never scale. */
  .sockets-grid {
    position: relative;
    flex-shrink: 0;
  }

  .slot {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    outline: none;
  }

  .slot.has-item {
    pointer-events: auto;
    cursor: help;
  }
  .slot.has-item:hover .box,
  .slot.has-item:focus-visible .box {
    filter: brightness(1.3) drop-shadow(0 0 5px rgba(233, 207, 159, 0.75));
  }
  .slot.has-item:focus-visible .box {
    outline: 1px dotted #e9cf9f;
    outline-offset: 2px;
  }

  .box {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center;
  }

  .sprite {
    position: relative;
    display: block;
    flex: none;
    overflow: hidden;
  }
  .sprite :global(img.sheet-img) {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: auto !important;
    height: auto !important;
    max-width: none !important;
    max-height: none !important;
    filter: none !important;
    pointer-events: none;
  }

  .ring {
    width: 31px;
    height: 31px;
    border-radius: 50%;
    border: 2px solid #5b5b5b;
    background: radial-gradient(circle at 35% 30%, #1d1f26, #07080b 70%);
    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.9);
    box-sizing: border-box;
  }

  .icon-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-layer :global(img.socketed-icon) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
  }

  .link-pos {
    position: absolute;
    display: block;
    z-index: 2;
    transform: translate(-50%, -50%);
    transform-origin: center;
  }

  .socket-tooltip {
    position: fixed;
    z-index: 100000;
    max-height: 80vh;
    overflow-y: auto;
    box-sizing: border-box;
    padding: 0.55rem 0.65rem;
    background: rgba(4, 5, 7, 0.97);
    border: 1px solid #3a3326;
    border-top: 2px solid #8a6a2e;
    border-radius: 0;
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.8),
      0 0 0 1px #000;
    pointer-events: none;
    scrollbar-width: thin;
  }
</style>
