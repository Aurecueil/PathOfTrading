export type Realm = "pc" | "poe2" | "xbox" | "sony";
export const REALM_OPTIONS: Array<{ id: Realm; text: string }> = [
  { id: "pc", text: "PoE" },
  { id: "sony", text: "PoE (sony)" },
  { id: "xbox", text: "PoE (xbox)" },
  { id: "poe2", text: "PoE 2" },
];
export interface League {
  id: string;
  realm: Realm; // pc -> poe, xbox -> poe xbox, sony -> poe sony, poe2 -> poe2
  text: string;
}

export interface LeagueData {
  result: League[];
}
