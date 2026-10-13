export interface StatOption {
  id: number;
  text: string;
}

export interface StatOptionContainer {
  options: StatOption[];
}

export interface StatEntry {
  id: string;
  text: string;
  type: string;
  option?: StatOptionContainer;
}

export interface StatGroup {
  id: string;
  label: string;
  entries: StatEntry[];
}

export interface StatsDataResponse {
  result: StatGroup[];
}