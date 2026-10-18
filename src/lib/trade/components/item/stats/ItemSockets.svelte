<!-- src/lib/trade/components/item/stats/ItemSockets.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Item } from "$lib/types/tradeItem";
  import CdnImage from "../CdnImage.svelte";
  import { SHEET_1, SOCKET_SIZE, LINK_H, getBase } from "../socketSprites";
  import type { InlineSocketEntry } from "./inlineSockets";

  export let sockets: InlineSocketEntry[] = [];

  const dispatch = createEventDispatcher<{
    itemhover: { item: Item; rect: DOMRect };
    itemleave: void;
  }>();

  function onEnter(e: Event, socketed: Item | null) {
    if (!socketed) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dispatch("itemhover", { item: socketed, rect });
  }
</script>

{#if sockets.length > 0}
  <div class="sockets-own-line" aria-label="Item sockets">
    <div class="inline-sockets">
      {#each sockets as entry, si (entry.idx)}
        {@const base = getBase(entry.socket)}
        {@const iconSrc = entry.socket.type
          ? (entry.socketed?.socketedIcon ?? entry.socketed?.icon ?? null)
          : null}
        <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
        <span
          class="inline-socket"
          class:has-socketed={entry.socketed !== null}
          role={entry.socketed ? "button" : undefined}
          tabindex={entry.socketed ? 0 : undefined}
          on:mouseenter={(e) => onEnter(e, entry.socketed)}
          on:mouseleave={() => dispatch("itemleave")}
          on:focus={(e) => onEnter(e, entry.socketed)}
          on:blur={() => dispatch("itemleave")}
        >
          <span
            class="inline-box"
            style:width="{base?.size ?? SOCKET_SIZE}px"
            style:height="{base?.size ?? SOCKET_SIZE}px"
            style:transform={base?.fixedScale
              ? `scale(${base.fixedScale})`
              : undefined}
          >
            {#if base}
              <span
                class="isprite"
                style:width="{base.size}px"
                style:height="{base.size}px"
                style:--x="{base.pos[0]}px"
                style:--y="{base.pos[1]}px"
              >
                <CdnImage
                  src={base.sheet}
                  alt=""
                  className="sheet-img"
                  loading="eager"
                />
              </span>
            {:else}
              <span class="inline-ring"></span>
            {/if}

            {#if iconSrc}
              <span class="inline-icon-layer">
                <CdnImage
                  src={iconSrc}
                  alt={entry.socketed?.typeLine || entry.socketed?.name || ""}
                  className="inline-socketed-icon"
                  loading="eager"
                />
              </span>
            {/if}
          </span>
        </span>

        {#if si < sockets.length - 1}
          {@const linked = sockets[si + 1].socket.group === entry.socket.group}
          <span class="inline-gap" class:linked>
            {#if linked}
              <span
                class="isprite inline-link"
                style:width="{LINK_H.w}px"
                style:height="{LINK_H.h}px"
                style:--x="{LINK_H.x}px"
                style:--y="{LINK_H.y}px"
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
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .sockets-own-line {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 44px;
    box-sizing: border-box;
  }
  .inline-sockets {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    padding: 0;
  }
  .inline-socket {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 35px;
    height: 35px;
    outline: none;
  }
  .inline-socket.has-socketed {
    cursor: help;
  }
  .inline-socket.has-socketed:hover .inline-box,
  .inline-socket.has-socketed:focus-visible .inline-box {
    filter: brightness(1.3) drop-shadow(0 0 5px rgba(233, 207, 159, 0.75));
  }
  .inline-box {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center;
  }
  .isprite {
    position: relative;
    display: block;
    flex: none;
    overflow: hidden;
  }
  .isprite :global(img.sheet-img) {
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
  .inline-ring {
    width: 31px;
    height: 31px;
    border-radius: 50%;
    border: 2px solid #5b5b5b;
    background: radial-gradient(circle at 35% 30%, #1d1f26, #07080b 70%);
    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.9);
    box-sizing: border-box;
  }
  .inline-icon-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .inline-icon-layer :global(img.inline-socketed-icon) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7));
  }
  .inline-gap {
    position: relative;
    flex: none;
    width: 20px;
    height: 35px;
  }
  .inline-gap.linked {
    width: 12px;
  }
  .inline-link {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
  }
</style>
