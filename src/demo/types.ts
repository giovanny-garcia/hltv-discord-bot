import type { BetSide } from "../types/betting.js";
import type { PlayingSide } from "../utils/ggscore-played.util.js";

export const DEMO_STARTING_BALANCE = 1000;
export const DEMO_MIN_BET = 10;
export const DEMO_MAP_WIN_SCORE = 13;
export const DEMO_SERIES_WIN = 2;
export const DEFAULT_DEMO_TICK_MS = 1000;
export const DEMO_ROUNDS_PER_TICK = 2;
/** Wall-clock time the demo market stays open, independent of how fast scores tick. */
export const DEMO_BETTING_OPEN_MS = 6000;

export function demoBettingOpenTicks(tickIntervalMs: number): number {
  return Math.max(2, Math.round(DEMO_BETTING_OPEN_MS / tickIntervalMs));
}

export type DemoPhase = "betting_open" | "live" | "between_maps" | "finished" | "stopped";
export type DemoBettingStatus = "open" | "locked" | "settled";

export interface DemoMapResult {
  name: string;
  team1Rounds: number;
  team2Rounds: number;
  winnerSide: BetSide;
}

export interface DemoSlipEntry {
  userId: string;
  side: BetSide;
  amount: number;
  payout: number;
  displayName?: string;
  simulated?: boolean;
}

export interface DemoSession {
  guildId: string;
  matchId: string;
  team1Name: string;
  team2Name: string;
  tickIntervalMs: number;
  phase: DemoPhase;
  phaseTick: number;
  currentMap: number;
  currentMapName?: string;
  team1MapScore: number;
  team2MapScore: number;
  team1Side?: PlayingSide;
  team2Side?: PlayingSide;
  spoilersRevealed: boolean;
  team1Series: number;
  team2Series: number;
  completedMaps: DemoMapResult[];
  /** How many synthetic wagers to drip in while betting is open. */
  simTarget: number;
  /** Ticks to stay in betting_open before the match goes live. */
  bettingOpenTicks: number;
  winnerSide?: BetSide;
  hideSpoilers: boolean;
  boardChannelId?: string;
  boardMessageId?: string;
  bettingChannelId?: string;
  bettingMessageId?: string;
  bettingStatus: DemoBettingStatus;
  settledSlip?: DemoSlipEntry[];
}

export interface DemoBet {
  userId: string;
  side: BetSide;
  amount: number;
  displayName?: string;
  simulated?: boolean;
}

export interface DemoPoolSummary {
  team1Pool: number;
  team2Pool: number;
  totalPool: number;
  betCount: number;
}

export function demoMatchId(guildId: string): string {
  return `demo-${guildId}`;
}

export function isDemoMatchId(matchId: string): boolean {
  return matchId.startsWith("demo-");
}
