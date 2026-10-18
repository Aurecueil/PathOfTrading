import type { StatEntry, StatGroup } from "$lib/types/stats";

export type GameRealm = "poe" | "poe2";
export type CatalogGame = "any" | GameRealm;
export type CatalogEntry = StatEntry & {
  realms: GameRealm[];
  groupLabel: string;
};

const asArray = (v: any): StatGroup[] =>
  Array.isArray(v) ? v : Array.isArray(v?.result) ? v.result : [];

/**
 * Stat catalog for a game filter. Entries carry `realms` (which games have them).
 * "any" and "poe2" show the PoE 2 text for shared stats, "poe" shows the PoE 1 text.
 */
export function buildCatalog(
  poeRaw: any,
  poe2Raw: any,
  game: CatalogGame,
): StatGroup[] {
  const poe = asArray(poeRaw);
  const poe2 = asArray(poe2Raw);

  const realms = new Map<string, Set<GameRealm>>();
  const mark = (groups: StatGroup[], r: GameRealm) => {
    for (const g of groups)
      for (const e of g.entries ?? []) {
        const set = realms.get(e.id);
        if (set) set.add(r);
        else realms.set(e.id, new Set([r]));
      }
  };
  mark(poe, "poe");
  mark(poe2, "poe2");

  const sources: StatGroup[][] =
    game === "poe" ? [poe] : game === "poe2" ? [poe2] : [poe2, poe]; // earlier source wins on shared ids

  const out = new Map<string, StatGroup>();
  const seen = new Set<string>();
  for (const groups of sources) {
    for (const g of groups) {
      let target = out.get(g.id);
      if (!target) {
        target = { ...g, entries: [] };
        out.set(g.id, target);
      }
      for (const e of g.entries ?? []) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        (target.entries as any[]).push({
          ...e,
          realms: [...(realms.get(e.id) ?? [])],
        });
      }
    }
  }
  return [...out.values()];
}

/** id → entry (with groupLabel) over every known stat, for resolving saved ids. */
export function buildStatLookup(
  poeRaw: any,
  poe2Raw: any,
): Map<string, CatalogEntry> {
  const map = new Map<string, CatalogEntry>();
  for (const g of buildCatalog(poeRaw, poe2Raw, "any"))
    for (const e of g.entries ?? [])
      map.set(e.id, { ...(e as any), groupLabel: g.label || g.id });
  return map;
}
