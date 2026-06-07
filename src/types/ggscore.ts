export type GgscoreCacheKey = "countries" | "matches" | "upcoming_matches";

export interface GgscoreCountry {
  id: number;
  title: string;
  image?: string;
}

export interface GgscoreTeamSide {
  id?: number;
  name: string;
  image?: string;
  country?: GgscoreCountry | string;
  score?: number | string;
}

export interface GgscoreEvent {
  id?: number;
  title?: string;
  name?: string;
}

export interface GgscoreMatch {
  id?: number;
  team1?: GgscoreTeamSide;
  team2?: GgscoreTeamSide;
  teams?: GgscoreTeamSide[];
  winner?: GgscoreTeamSide;
  loser?: GgscoreTeamSide;
  score?: string;
  kind?: string;
  event?: GgscoreEvent | string;
  played_at?: string;
  scheduled_at?: string;
  date?: string;
  online?: boolean;
  location?: string;
  hltv_link?: string;
  hltv_url?: string;
  [key: string]: unknown;
}

export interface GgscorePaginatedResponse<T> {
  data?: T[];
  items?: T[];
  results?: T[];
  matches?: T[];
  countries?: T[];
  total?: number;
  count?: number;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

export type GgscoreSyncScope = "upcoming" | "results" | "countries" | "full";

export interface GgscoreSyncResult {
  scope: GgscoreSyncScope;
  fetched: GgscoreCacheKey[];
  requestsUsed: number;
  requestsRemaining: number;
  errors: string[];
}

export interface GgscoreQuota {
  date: string;
  used: number;
  limit: number;
  remaining: number;
}
