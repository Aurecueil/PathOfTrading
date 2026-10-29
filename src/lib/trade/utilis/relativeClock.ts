// src/lib/trade/stores/relativeClock.ts
import { readable } from "svelte/store";

type Entry = { nextChangeAt: number };

const entries = new Set<Entry>();
let timer: ReturnType<typeof setTimeout> | null = null;
let setNow: (v: number) => void = () => {};

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (entries.size === 0) return;

  let soonest = Infinity;
  for (const e of entries) soonest = Math.min(soonest, e.nextChangeAt);

  const delay = Math.max(250, soonest - Date.now()); // floor avoids spin
  timer = setTimeout(() => {
    setNow(Date.now());
    schedule();
  }, delay);
}

export const clock = readable(Date.now(), (set) => {
  setNow = set;
  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
});

export function register(entry: Entry) {
  entries.add(entry);
  schedule();
  return () => {
    entries.delete(entry);
    schedule();
  };
}

export function update(entry: Entry) {
  schedule();
}
