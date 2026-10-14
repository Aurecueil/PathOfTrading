// src/lib/types.ts
export interface SearchTile {
  id: string | number;
  x: number;
  y: number;
  w: number;
  h: number;
  realm: "poe" | "poe2" | string;
  league?: string;
  title?: string;
  displayName?: string;
  displayStyle?: TileDisplayStyle;
  disabled?: boolean;
  payload?: any;
  full_payload?: any;
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

export type ToolType =
  | "move"
  | "title"
  | "richtext"
  | "arrow"
  | "box"
  | "circle";
export type ShapeKind = "arrow" | "box" | "circle";

export interface CanvasAnnotation {
  id: number;
  kind: "title" | "richtext" | ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  thickness: number;
  text?: string;
  flipX?: boolean;
  flipY?: boolean;
  autoEdit?: boolean;
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
