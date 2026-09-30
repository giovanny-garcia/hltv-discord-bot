import type { MatchBoardData, MatchBoardTeam } from "../utils/match-board.embed.js";

export type LifecycleBoardExtras = Partial<Omit<MatchBoardData, "team1" | "team2">> & {
  team1?: Partial<MatchBoardTeam>;
  team2?: Partial<MatchBoardTeam>;
};

export type LifecycleStatus =
  | "scheduled"
  | "betting_open"
  | "live"
  | "finished";

export interface MatchLifecycleSession {
  id: number;
  guildId: string;
  matchId: string;
  team1Name: string;
  team2Name: string;
  eventName?: string;
  format?: string;
  scheduledAt: number;
  status: LifecycleStatus;
  marketId?: number;
  boardChannelId?: string;
  boardMessageId?: string;
  mapsAnnounced: number;
  team1Series: number;
  team2Series: number;
  winnerSide?: 1 | 2;
  hideSpoilers: boolean;
  bettingOpenSent: boolean;
  morningAnnounceSent: boolean;
  matchStartSent: boolean;
  bettingLockSent: boolean;
  matchFinishSent: boolean;
  boardJson?: string;
  createdAt: number;
}

export function lifecycleBoardFromSession(
  session: MatchLifecycleSession,
  phase: MatchBoardData["phase"],
  extras?: LifecycleBoardExtras,
): MatchBoardData {
  const { team1: extraTeam1, team2: extraTeam2, ...rest } = extras ?? {};

  return {
    matchId: session.matchId,
    team1: {
      name: session.team1Name,
      color: 0x3498db,
      seriesScore: session.team1Series,
      ...extraTeam1,
    },
    team2: {
      name: session.team2Name,
      color: 0xe74c3c,
      seriesScore: session.team2Series,
      ...extraTeam2,
    },
    eventName: session.eventName ?? "Event TBA",
    format: session.format ?? "TBA",
    phase,
    live: phase === "live" || phase === "between_maps",
    hideSpoilers: false,
    placeholder: false,
    winnerSide: session.winnerSide,
    ...rest,
  };
}
