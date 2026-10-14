export interface SearchTile {
  id: string | number;
  x: number;
  y: number;
  w: number;
  h: number;
  realm: "poe" | "poe2" | string;
  league?: string;
  displayName?: string;
  displayStyle?: TileDisplayStyle;
  payload?: any;
  searchId?: string;
  results: string[];
  loading?: boolean;
}

export type TileDisplayStyle = "auto" | "full" | "compact" | "minimal";
export type ResolvedDisplayStyle = "full" | "compact" | "minimal";

export interface PoETradeItemEntry {
  id: string;
  listing: {
    price?: {
      amount: number;
      currency: string;
    };
    account?: {
      name: string;
      online?: boolean;
    };
  };
  item: {
    name: string;
    typeLine: string;
    icon?: string;
    ilvl?: number;
    explicitMods?: string[];
  };
}

export interface FormSubmitData {
  title: string;
  displayName?: string;
  realm: "poe" | "poe2";
  league: string;
  payload: any;
  full_payload: any;
}

export interface SortOptionItem {
  id: string;
  category: "group" | "filter" | "stat";
  label: string;
  tag?: string;
}
