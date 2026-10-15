export interface StaticEntry {
  id: string;
  text: string;
  image?: string | null;
  pseudo?: boolean | null;
  subtext?: string | null;
  description?: string | null;
}

export interface StaticCategory {
  id: string;
  label: string | null;
  entries: StaticEntry[];
}

export interface StaticDataResponse {
  result: StaticCategory[];
}
