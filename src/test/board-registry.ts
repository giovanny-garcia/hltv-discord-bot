import type { MatchBoardData } from "../utils/match-board.embed.js";

const boards = new Map<string, MatchBoardData>();

export function registerMatchBoard(data: MatchBoardData): void {
  boards.set(data.matchId, structuredClone(data));
}

export function getMatchBoard(matchId: string): MatchBoardData | undefined {
  const board = boards.get(matchId);
  return board ? structuredClone(board) : undefined;
}

export function clearMatchBoard(matchId: string): void {
  boards.delete(matchId);
}
