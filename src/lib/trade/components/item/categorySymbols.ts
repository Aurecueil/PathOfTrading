// src/lib/searchTile/categorySymbols.ts
import type { Item } from "$lib/types/tradeItem";

export interface CategorySymbol {
  key: string;
  label: string;
  url: string;
}

type Sym = CategorySymbol & { test: (it: Item) => boolean };

const SYM = (file: string) =>
  `https://web.poecdn.com/protected/image/item/${file}`;

const flag = (it: Item, k: string) =>
  Boolean(it.influences?.[k]) ||
  Boolean((it as unknown as Record<string, unknown>)[k]);

const POE1_SYMBOLS: Sym[] = [
  {
    key: "shaper",
    label: "Shaper",
    url: SYM(
      "popup/shaper-symbol.png?v=1709582916256&key=PQH0ATL4n268OngTnsQ0MQ",
    ),
    test: (i) => flag(i, "shaper"),
  },
  {
    key: "elder",
    label: "Elder",
    url: SYM(
      "popup/elder-symbol.png?v=1709582916256&key=YS6Fsnxyuc8gpqfPz_mykw",
    ),
    test: (i) => flag(i, "elder"),
  },
  {
    key: "crusader",
    label: "Crusader",
    url: SYM(
      "popup/crusader-symbol.png?v=1709582916256&key=dcLGV7cDJf-dulB8P_Q-yQ",
    ),
    test: (i) => flag(i, "crusader"),
  },
  {
    key: "redeemer",
    label: "Redeemer",
    url: SYM(
      "popup/redeemer-symbol.png?v=1709582916256&key=nEc-TPctqwszY696cmlaZQ",
    ),
    test: (i) => flag(i, "redeemer"),
  },
  {
    key: "hunter",
    label: "Hunter",
    url: SYM(
      "popup/hunter-symbol.png?v=1709582916256&key=x7-F-t4jlxzMd1eJOUSafA",
    ),
    test: (i) => flag(i, "hunter"),
  },
  {
    key: "warlord",
    label: "Warlord",
    url: SYM(
      "popup/warlord-symbol.png?v=1709582916256&key=76scs3jk3FrVGOLHdM5AuA",
    ),
    test: (i) => flag(i, "warlord"),
  },
  {
    key: "searing",
    label: "Searing Exarch",
    url: SYM(
      "popup/searing-symbol.png?v=1709582916256&key=iiOWJvWHj8-0bH0e28X7Xw",
    ),
    test: (i) => flag(i, "searing"),
  },
  {
    key: "tangled",
    label: "Eater of Worlds",
    url: SYM(
      "popup/tangled-symbol.png?v=1709582916256&key=b-SVlhPy2jy-UJSTBaV2Cw",
    ),
    test: (i) => flag(i, "tangled"),
  },
  {
    key: "veiled",
    label: "Veiled",
    url: SYM(
      "popup/veiled-symbol.png?v=1709582916256&key=FQrrJgHpP4bo1Im-sOGTcA",
    ),
    test: (i) => Boolean(i.veiled),
  },
  {
    key: "fractured",
    label: "Fractured",
    url: SYM(
      "popup/fractured-symbol.png?v=1709582916256&key=fM_bl3SW2hozdEIw5vh4GA",
    ),
    test: (i) => Boolean(i.fractured),
  },
  {
    key: "synthetic",
    label: "Synthesised",
    url: SYM(
      "popup/synthetic-symbol.png?v=1709582916256&key=CUVu3Zqxrzd1CwWcIH-6xg",
    ),
    test: (i) => Boolean(i.synthesised),
  },
  {
    key: "replica",
    label: "Replica",
    url: SYM(
      "popup/experimented-symbol.png?v=1709582916256&key=dWh87tRCnnyVEMYjjf6RbQ",
    ),
    test: (i) => Boolean(i.replica),
  },
  {
    key: "memory",
    label: "Memory",
    url: SYM(
      "popup/memory-symbol.png?v=1747803259967&key=4CDrYIxVWDUKPLGXGOhO3g",
    ),
    test: (i) => Boolean(i.memoryItem),
  },
  {
    key: "breach",
    label: "Mutated",
    url: SYM(
      "popup/breach-symbol.png?v=1759709093664&key=R8ypjmI1TuM6RE_WWWHxiw",
    ),
    test: (i) => Boolean(i.mutated),
  },
  {
    key: "vestigial",
    label: "Vestigial",
    url: SYM(
      "popup/vestigial-symbol.png?v=1783395650713&key=-YB_ZzmxB0qautKiuSQ1CQ",
    ),
    test: (i) => Boolean(i.vestigial),
  },
];

const POE2_SYMBOLS: Sym[] = [
  {
    key: "desecrated",
    label: "Desecrated",
    url: SYM(
      "popup2/desecrated-symbol.png?v=1754628199421&key=hgK5C6v-SqzlKR0q0MrYDg",
    ),
    test: (i) => Boolean(i.desecrated),
  },
  {
    key: "vaal",
    label: "Mutated",
    url: SYM(
      "popup2/vaal-symbol.png?v=1764542264625&key=6qnhCPxsLIuTvtF8K_8R8A",
    ),
    test: (i) => Boolean(i.mutated),
  },
];

export function getCategorySymbols(
  item: Item,
  isPoe2: boolean,
): CategorySymbol[] {
  return (isPoe2 ? POE2_SYMBOLS : POE1_SYMBOLS)
    .filter((s) => s.test(item))
    .map(({ key, label, url }) => ({ key, label, url }));
}
