<!-- src/lib/components/item/ItemSockets.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Item, ItemSocket } from "$lib/types/tradeItem";
  import ItemStats from "$lib/trade/components/item/ItemStats.svelte";
  import CdnImage from "./CdnImage.svelte";

  export let sockets: ItemSocket[] = [];
  export let socketedItems: Item[] = [];
  /** item size in inventory cells (max 2 x 3) */
  export let w: number = 1;
  export let h: number = 1;
  export let realm: string = "poe";

  const dispatch = createEventDispatcher<{
    gems: Array<{ url: string; item: Item }>;
  }>();

  // Sprite sheets are drawn through CdnImage (host prefix + cache), cropped
  // by a fixed-size overflow:hidden box and shifted with the sprite offset.
  const SHEET_1 =
    "/protected/image/gen/socket.png?v=1791178103574&key=mf1B3nj-F9flN8KRLcBQ8A";
  const SHEET_2 =
    "/protected/image/gen/socket2.png?v=1791178103674&key=bOOTV3VD4QQrcQMzHLZ1RA";

  type Pos = [number, number];
  type Attr = "S" | "D" | "I" | "G";

  const EMPTY: Record<"S" | "D" | "I", Pos> = {
    S: [-140, -35],
    D: [-70, -105],
    I: [-105, -35],
  };
  const FILLED: Record<Attr, Pos> = {
    S: [-72, -37],
    D: [-37, -37],
    I: [-2, -37],
    G: [-142, -72],
  };
  const SUPPORT: Record<Attr, Pos> = {
    S: [-72, -142],
    D: [-2, -142],
    I: [-142, -107],
    G: [-107, -142],
  };
  const DELVE: Pos = [-37, -2];
  const ABYSS: Pos = [-37, -72];
  // socket2.png - poe2 empty sockets (62px)
  const POE2_EMPTY: Record<string, Pos> = {
    rune: [0, -248],
    jewel: [0, -62],
  };

  /** Base size every socket is laid out in; scaled to the grid slot. */
  const BASE = 33;
  const FILL_RATIO = 0.68;

  interface Sprite {
    sheet: string;
    size: number;
    pos: Pos;
  }

  interface Cell {
    idx: number; // index in the original sockets array (matches item.socket)
    col: number;
    row: number;
    group: number;
    item: Item | null;
    base: Sprite | null; // null => ring fallback
    iconSrc: string | null; // drawn over the base socket
  }

  // overlay size -> scale so a socket fills its grid slot
  let ow = 0;
  let oh = 0;

  $: cols = Math.min(Math.max(Math.floor(w) || 1, 1), 2);
  $: rows = Math.min(Math.max(Math.floor(h) || 1, 1), 3);
  $: capacity = cols * rows;
  $: cellSize = ow > 0 && oh > 0 ? Math.min(ow / cols, oh / rows) : BASE;
  $: linkScale = (cellSize / BASE) * FILL_RATIO;
  // each socket box is as big as its sprite, then scaled to fill the slot
  const boxSize = (c: Cell) => c.base?.size ?? BASE;
  const socketScale = (c: Cell, cs: number) => (cs / boxSize(c)) * FILL_RATIO;

  // 1 2 / 4 3 / 5 6   (1-wide: top to bottom)
  function place(i: number): { col: number; row: number } {
    if (cols === 1) return { col: 0, row: i };
    const row = Math.floor(i / 2);
    const pos = i % 2;
    return { col: row % 2 === 0 ? pos : 1 - pos, row };
  }

  function toAttr(socket: ItemSocket): Attr | "DV" | "A" {
    const attr = (socket.attr || "").toUpperCase();
    const col = (socket.sColour || "").toUpperCase();
    if (attr === "DV" || col === "DV") return "DV";
    if (attr === "A" || col === "A") return "A";
    if (attr === "S" || attr === "D" || attr === "I" || attr === "G") {
      return attr;
    }
    switch (col) {
      case "R":
        return "S";
      case "G":
        return "D";
      case "B":
        return "I";
      default:
        return "G";
    }
  }

  function getBase(socket: ItemSocket, item: Item | null): Sprite | null {
    const type = (socket.type || "").toString().toLowerCase();

    // PoE2 (base socket is always drawn, item goes on top)
    if (type) {
      const pos = POE2_EMPTY[type];
      return pos ? { sheet: SHEET_2, size: 62, pos } : null;
    }

    // PoE1
    const a = toAttr(socket);
    if (a === "DV") return { sheet: SHEET_1, size: 31, pos: DELVE };
    if (a === "A") return { sheet: SHEET_1, size: 31, pos: ABYSS };
    // Always the empty-socket sprite for str / dex / int. G (white) has no
    // empty sprite, so it falls back to the general one below.
    if (a === "S" || a === "D" || a === "I") {
      return { sheet: SHEET_1, size: 35, pos: EMPTY[a] };
    }
    return { sheet: SHEET_1, size: 31, pos: FILLED.G };
  }

  $: cells = sockets
    .map((socket, idx) => ({ socket, idx }))
    .filter(({ socket }) => (socket.type || "").toLowerCase() !== "gem")
    .slice(0, capacity)
    .map(({ socket, idx }, i): Cell => {
      const { col, row } = place(i);
      const item = socketedItems.find((it) => it.socket === idx) ?? null;
      const isPoe2 = Boolean(socket.type);
      return {
        idx,
        col,
        row,
        group: socket.group,
        item,
        base: getBase(socket, item),
        iconSrc: isPoe2 ? (item?.socketedIcon ?? null) : null,
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

  // Items with no "socket" are skill gems; hand their icon back to the row.
  $: gems = socketedItems
    .filter(
      (it) => (it.socket === undefined || it.socket === null) && it.gemSkill,
    )
    .map((it) => ({ url: it.gemSkill as string, item: it }));
  $: dispatch("gems", gems);

  // Tooltip (portaled to <body> so tile overflow/transform can't clip it)
  const TIP_W = 340;
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

<div class="sockets-overlay" bind:clientWidth={ow} bind:clientHeight={oh}>
  {#each links as link}
    <span
      class="link-pos"
      style:left="{link.x}%"
      style:top="{link.y}%"
      style:transform="translate(-50%, -50%) scale({linkScale})"
    >
      {#if link.horizontal}
        <span class="sprite" style="width:38px;height:15px;--x:-175px;--y:0px">
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
          style="width:15px;height:38px;--x:-175px;--y:-15px"
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
        style:transform="scale({socketScale(cell, cellSize)})"
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

{#if hovered}
  <div
    class="socket-tooltip"
    use:portal
    style:left="{hovered.left}px"
    style:top="{hovered.top}px"
    style:width="{TIP_W}px"
  >
    <ItemStats item={hovered.item} {realm} styleMode="full" tileWidth={TIP_W} />
  </div>
{/if}

<style>
  .sockets-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }

  /* one grid slot; the socket box is centered in it */
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

  /* cropped sprite window */
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

  /* fallback for socket types without a sprite */
  .ring {
    width: 28px;
    height: 28px;
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
    transform-origin: center;
  }

  .socket-tooltip {
    position: fixed;
    z-index: 100000;
    max-height: 80vh;
    overflow-y: auto;
    box-sizing: border-box;
    padding: 0.55rem 0.6rem;
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
