export interface ItemFlags {
  unique?: boolean;
}

export interface ItemEntry {
  type: string;
  text?: string;
  name?: string;
  disc?: string;
  flags?: ItemFlags;
}

export interface ItemCategory {
  id: string;
  label: string;
  entries: ItemEntry[];
}

export interface ItemDataResponse {
  result: ItemCategory[];
}
