export const STARTING_BALANCE = 1000;
export const MIN_BET = 10;

export type BetMarketStatus = "open" | "locked" | "settled";

export type BetSide = 1 | 2;

export interface UserBalance {
  guildId: string;
  userId: string;
  balance: number;
  totalWon: number;
  totalLost: number;
  betsWon: number;
  betsLost: number;
}

export interface BetMarket {
  id: number;
  guildId: string;
  matchId: string;
  team1Name: string;
  team2Name: string;
  eventName?: string;
  format?: string;
  status: BetMarketStatus;
  channelId: string;
  messageId: string;
  winnerSide?: BetSide;
  createdAt: number;
  lockedAt?: number;
}

export interface UserBet {
  marketId: number;
  guildId: string;
  userId: string;
  side: BetSide;
  amount: number;
  payout: number;
  status: "active" | "won" | "lost" | "refunded";
  updatedAt: number;
}

export interface MarketPoolSummary {
  team1Pool: number;
  team2Pool: number;
  totalPool: number;
  betCount: number;
}
