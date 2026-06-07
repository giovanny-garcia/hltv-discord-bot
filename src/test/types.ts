export interface TestTeamInput {
  name: string;
  color: number;
  seriesScore: number;
  mapScore?: number;
}

export interface TestMatchInput {
  matchId: string;
  team1: TestTeamInput;
  team2: TestTeamInput;
  eventName: string;
  format: string;
  phase: "upcoming" | "live" | "finished";
  currentMap?: number;
  hideSpoilers: boolean;
  scheduledInMinutes?: number;
  winnerSide?: 1 | 2;
}

export interface TestWagerInput {
  eventName: string;
  team1Name: string;
  team2Name: string;
  totalPool: number;
  team1Pool: number;
  team2Pool: number;
  betCount: number;
  locksInMinutes: number;
}

export interface TestOddsInput {
  team1Name: string;
  team2Name: string;
  team1Odds: number;
  team2Odds: number;
  team1ImpliedPct: number;
  team2ImpliedPct: number;
}

export interface TestPayoutEntry {
  username: string;
  wagered: number;
  payout: number;
  profit: number;
}

export interface TestPayoutInput {
  eventName: string;
  marketLabel: string;
  winnerName: string;
  totalPaid: number;
  entries: TestPayoutEntry[];
}

export interface TestRankingEntry {
  rank: number;
  username: string;
  balance: number;
  delta: number;
  winRate: number;
}

export interface TestRankingsInput {
  title: string;
  entries: TestRankingEntry[];
}

export interface TestStreakEntry {
  username: string;
  streak: number;
  type: "win" | "loss";
  best: number;
}

export interface TestStreaksInput {
  entries: TestStreakEntry[];
}

export interface TestPredictionEntry {
  username: string;
  correct: number;
  total: number;
  profit: number;
}

export interface TestPredictionsInput {
  eventName: string;
  entries: TestPredictionEntry[];
}

export interface TestGraphInput {
  title: string;
  metric: string;
  labels: string[];
  values: number[];
}
