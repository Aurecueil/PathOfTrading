export interface SearchTile {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  displayName?: string;
  realm: "poe" | "poe2";
  layoutMode: "list" | "grid";
  loading: boolean;
  searchId?: string;
  results: string[];
  fetchedItems: PoETradeItemEntry[];
  payload?: any;
  fullPayload?: any;
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
  payload: any;
  full_payload: any;
  sort?: string;
}
