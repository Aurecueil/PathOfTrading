<!-- src/lib/components/item/ItemSockets.svelte -->
<script lang="ts">
  import type { ItemSocket } from "$lib/types/item";

  export let sockets: ItemSocket[] = [];

  // Snake grid:
  // 1 (0,0)  2 (0,1)
  // 4 (1,0)  3 (1,1)
  // 5 (2,0)  6 (2,1)
  const SOCKET_COORDS = [
    { x: 16, y: 16 }, // Socket 1
    { x: 44, y: 16 }, // Socket 2
    { x: 44, y: 48 }, // Socket 3
    { x: 16, y: 48 }, // Socket 4
    { x: 16, y: 80 }, // Socket 5
    { x: 44, y: 80 }, // Socket 6
  ];

  function getSocketFill(socket: ItemSocket): string {
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
        return "#1e1b4b";
      default:
        return "#94a3b8";
    }
  }

  $: links = (() => {
    if (!sockets || sockets.length <= 1) return [];
    const res: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < sockets.length - 1; i++) {
      if (
        sockets[i].group === sockets[i + 1].group &&
        SOCKET_COORDS[i] &&
        SOCKET_COORDS[i + 1]
      ) {
        res.push({
          x1: SOCKET_COORDS[i].x,
          y1: SOCKET_COORDS[i].y,
          x2: SOCKET_COORDS[i + 1].x,
          y2: SOCKET_COORDS[i + 1].y,
        });
      }
    }
    return res;
  })();
</script>

<svg
  class="sockets-overlay"
  viewBox="0 0 60 96"
  preserveAspectRatio="xMidYMid meet"
>
  {#each links as link}
    <line
      x1={link.x1}
      y1={link.y1}
      x2={link.x2}
      y2={link.y2}
      class="socket-link-shadow"
    />
    <line
      x1={link.x1}
      y1={link.y1}
      x2={link.x2}
      y2={link.y2}
      class="socket-link-core"
    />
  {/each}

  {#each sockets as socket, idx}
    {#if SOCKET_COORDS[idx]}
      <circle
        cx={SOCKET_COORDS[idx].x}
        cy={SOCKET_COORDS[idx].y}
        r="8"
        class="socket-outer"
      />
      <circle
        cx={SOCKET_COORDS[idx].x}
        cy={SOCKET_COORDS[idx].y}
        r="6"
        fill={getSocketFill(socket)}
        class="socket-inner"
      />
    {/if}
  {/each}
</svg>

<style>
  .sockets-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }
  .socket-link-shadow {
    stroke: #000;
    stroke-width: 6;
    stroke-linecap: round;
  }
  .socket-link-core {
    stroke: #c29d5b;
    stroke-width: 3;
    stroke-linecap: round;
  }
  .socket-outer {
    fill: #090a0f;
    stroke: #475569;
    stroke-width: 1.8;
  }
  .socket-inner {
    stroke: #0f172a;
    stroke-width: 1;
  }
</style>
