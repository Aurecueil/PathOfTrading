export interface FilterOptionEntry {
  id: string | null;
  text: string;
}

export interface KnownItem {
  uniques: boolean;
  cards?: boolean;
  currency?: boolean;
}

export interface FilterOptionContainer {
  options?: FilterOptionEntry[];
  knownItem?: KnownItem;
}

export interface FilterInput {
  placeholder: string;
}

export interface FilterEntry {
  id: string;
  text?: string;
  tip?: string;
  option?: FilterOptionContainer;
  input?: FilterInput;
  fullSpan?: boolean;
  halfSpan?: boolean;
  minMax?: boolean;
  sockets?: boolean;
}

export interface FilterGroup {
  id: string;
  title?: string;
  hidden?: boolean;
  filters: FilterEntry[];
}

export interface FilterDataResponse {
  result: FilterGroup[];
}
