// src/lib/trade/components/item/stats/inlineSockets.ts
import type { Item, ItemSocket } from "$lib/types/tradeItem";

export interface InlineSocketEntry {
  socket: ItemSocket;
  idx: number;
  socketed: Item | null;
}

export function getInlineSockets(
  item: Item,
  mode: "minimal" | "compact" | "full" | string,
): InlineSocketEntry[] {
  const rawSockets = item.sockets || [];
  const socketedList = item.socketedItems || [];

  const fromGemSockets = (): InlineSocketEntry[] =>
    (item.gemSockets || []).map((col, idx) => ({
      socket: { group: idx, sColour: (col as any) || "W", type: "gem" },
      idx,
      socketed: null,
    }));

  if (mode === "compact") {
    if (rawSockets.length > 0) {
      return rawSockets.map((socket, idx) => ({
        socket,
        idx,
        socketed: socketedList.find((it) => it.socket === idx) ?? null,
      }));
    }
    return item.gemSockets && item.gemSockets.length > 0
      ? fromGemSockets()
      : [];
  }

  const gemTyped = rawSockets
    .map((socket, idx) => ({ socket, idx }))
    .filter(({ socket }) => (socket.type || "").toLowerCase() === "gem");

  if (gemTyped.length > 0) {
    return gemTyped.map(({ socket, idx }) => ({
      socket,
      idx,
      socketed: socketedList.find((it) => it.socket === idx) ?? null,
    }));
  }

  return item.gemSockets && item.gemSockets.length > 0 ? fromGemSockets() : [];
}
