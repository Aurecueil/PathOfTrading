export interface SearchTile {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  displayName?: string;
  realm: "poe" | "poe2";
  league: string;
  layoutMode: "list" | "grid";
  loading: boolean;
  searchId?: string;
  results: string[];
  fetchedItems: PoETradeItemEntry[];
  payload?: any;
  fullPayload?: any;
  sort?: any;
}

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
