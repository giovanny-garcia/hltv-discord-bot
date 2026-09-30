export const DEFAULT_TEAM1 = "Team Alpha";
export const DEFAULT_TEAM2 = "Team Beta";
export const DEFAULT_EVENT = "Placeholder Invitational 2026";
export const DEFAULT_FORMAT = "BO3";
export const TEAM1_COLOR = 0x3498db;
export const TEAM2_COLOR = 0xe74c3c;

export function defaultUpcomingMatch(
  overrides: Partial<import("./types.js").TestMatchInput> = {},
): import("./types.js").TestMatchInput {
  const base = {
    matchId: `test-${Date.now()}`,
    team1: { name: DEFAULT_TEAM1, color: TEAM1_COLOR, seriesScore: 0 },
    team2: { name: DEFAULT_TEAM2, color: TEAM2_COLOR, seriesScore: 0 },
    eventName: DEFAULT_EVENT,
    format: DEFAULT_FORMAT,
    phase: "upcoming" as const,
    hideSpoilers: false,
    scheduledInMinutes: 90,
  };
  return {
    ...base,
    ...overrides,
    team1: { ...base.team1, ...overrides.team1 },
    team2: { ...base.team2, ...overrides.team2 },
  };
}

export function defaultLiveMatch(
  overrides: Partial<import("./types.js").TestMatchInput> = {},
): import("./types.js").TestMatchInput {
  const base = {
    matchId: `test-${Date.now()}`,
    team1: { name: DEFAULT_TEAM1, color: TEAM1_COLOR, seriesScore: 1, mapScore: 12 },
    team2: { name: DEFAULT_TEAM2, color: TEAM2_COLOR, seriesScore: 0, mapScore: 9 },
    eventName: DEFAULT_EVENT,
    format: DEFAULT_FORMAT,
    phase: "live" as const,
    currentMap: 2,
    hideSpoilers: true,
  };
  return {
    ...base,
    ...overrides,
    team1: { ...base.team1, ...overrides.team1 },
    team2: { ...base.team2, ...overrides.team2 },
  };
}

export function defaultFinishedMatch(
  overrides: Partial<import("./types.js").TestMatchInput> = {},
): import("./types.js").TestMatchInput {
  const base = {
    matchId: `test-${Date.now()}`,
    team1: { name: DEFAULT_TEAM1, color: TEAM1_COLOR, seriesScore: 2 },
    team2: { name: DEFAULT_TEAM2, color: TEAM2_COLOR, seriesScore: 1 },
    eventName: DEFAULT_EVENT,
    format: DEFAULT_FORMAT,
    phase: "finished" as const,
    hideSpoilers: false,
    winnerSide: 1 as const,
  };
  return {
    ...base,
    ...overrides,
    team1: { ...base.team1, ...overrides.team1 },
    team2: { ...base.team2, ...overrides.team2 },
  };
}

export function defaultWagers(
  overrides: Partial<import("./types.js").TestWagerInput> = {},
): import("./types.js").TestWagerInput {
  return {
    eventName: DEFAULT_EVENT,
    team1Name: DEFAULT_TEAM1,
    team2Name: DEFAULT_TEAM2,
    totalPool: 48_500,
    team1Pool: 31_200,
    team2Pool: 17_300,
    betCount: 42,
    locksInMinutes: 25,
    ...overrides,
  };
}

export function defaultOdds(
  overrides: Partial<import("./types.js").TestOddsInput> = {},
): import("./types.js").TestOddsInput {
  return {
    team1Name: DEFAULT_TEAM1,
    team2Name: DEFAULT_TEAM2,
    team1Odds: 1.64,
    team2Odds: 2.35,
    team1ImpliedPct: 58.9,
    team2ImpliedPct: 41.1,
    ...overrides,
  };
}

export function defaultPayouts(
  overrides: Partial<import("./types.js").TestPayoutInput> = {},
): import("./types.js").TestPayoutInput {
  return {
    eventName: DEFAULT_EVENT,
    marketLabel: "Map 2 winner",
    winnerName: DEFAULT_TEAM1,
    totalPaid: 31_200,
    entries: [
      { username: "Alice", wagered: 500, payout: 820, profit: 320 },
      { username: "Bob", wagered: 1000, payout: 1640, profit: 640 },
      { username: "Charlie", wagered: 250, payout: 410, profit: 160 },
    ],
    ...overrides,
  };
}

export function defaultRankings(
  overrides: Partial<import("./types.js").TestRankingsInput> = {},
): import("./types.js").TestRankingsInput {
  return {
    title: "Betting leaderboard",
    entries: [
      { rank: 1, username: "Alice", balance: 12_450, delta: 820, winRate: 68 },
      { rank: 2, username: "Bob", balance: 9_880, delta: 640, winRate: 61 },
      { rank: 3, username: "Charlie", balance: 7_120, delta: -250, winRate: 54 },
      { rank: 4, username: "Diana", balance: 5_900, delta: 120, winRate: 52 },
      { rank: 5, username: "Eve", balance: 4_100, delta: -80, winRate: 48 },
    ],
    ...overrides,
  };
}

export function defaultStreaks(
  overrides: Partial<import("./types.js").TestStreaksInput> = {},
): import("./types.js").TestStreaksInput {
  return {
    entries: [
      { username: "Alice", streak: 5, type: "win", best: 8 },
      { username: "Bob", streak: 3, type: "win", best: 6 },
      { username: "Charlie", streak: 4, type: "loss", best: 7 },
      { username: "Diana", streak: 2, type: "win", best: 4 },
    ],
    ...overrides,
  };
}

export function defaultPredictions(
  overrides: Partial<import("./types.js").TestPredictionsInput> = {},
): import("./types.js").TestPredictionsInput {
  return {
    eventName: DEFAULT_EVENT,
    entries: [
      { username: "Alice", correct: 14, total: 18, profit: 2340 },
      { username: "Bob", correct: 12, total: 17, profit: 1890 },
      { username: "Diana", correct: 11, total: 16, profit: 980 },
      { username: "Charlie", correct: 8, total: 15, profit: -420 },
    ],
    ...overrides,
  };
}

export function defaultGraph(
  overrides: Partial<import("./types.js").TestGraphInput> = {},
): import("./types.js").TestGraphInput {
  return {
    title: "Balance over time",
    metric: "Credits",
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    values: [1000, 1120, 1080, 1350, 1280, 1520, 1680],
    ...overrides,
  };
}
