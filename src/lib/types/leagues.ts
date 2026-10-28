export interface League {
  id: string;
  realm: string;
  text: string;
}

export interface LeagueData {
  result: League[];
}
