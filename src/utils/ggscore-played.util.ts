import type { GgscoreMatch } from "../types/ggscore.js";
import { normalizeGgscoreMatch } from "./ggscore-match.util.js";

export interface PlayedMatchSnapshot {
  matchId: string;
  team1Name: string;
  team2Name: string;
  team1Series: number;
  team2Series: number;
  mapsCompleted: number;
  winnerSide?: 1 | 2;
  finished: boolean;
}

function teamTitle(team: { name?: string; title?: string } | undefined): string | undefined {
  return team?.name ?? team?.title;
}

export function parsePlayedMatchSnapshot(
  raw: GgscoreMatch,
  expectedTeam1?: string,
  expectedTeam2?: string,
): PlayedMatchSnapshot | null {
  const normalized = normalizeGgscoreMatch(raw);
  const team1Name = expectedTeam1 ?? normalized.team1Name;
  const team2Name = expectedTeam2 ?? normalized.team2Name;

  let team1Series = 0;
  let team2Series = 0;
  const games = Array.isArray(raw.games) ? raw.games : [];

  for (const game of games) {
    const g = game as {
      map_winner_team?: { name?: string; title?: string };
    };
    const winner = teamTitle(g.map_winner_team);
    if (!winner) continue;
    if (winner.toLowerCase() === team1Name.toLowerCase()) team1Series++;
    else if (winner.toLowerCase() === team2Name.toLowerCase()) team2Series++;
  }

  if (games.length === 0 && raw.score_won !== undefined && raw.score_lose !== undefined) {
    const wonName = teamTitle(raw.team_won);
    const loseName = teamTitle(raw.team_lose);
    const wonScore = Number(raw.score_won);
    const loseScore = Number(raw.score_lose);
    if (wonName?.toLowerCase() === team1Name.toLowerCase()) {
      team1Series = wonScore;
      team2Series = loseScore;
    } else if (wonName?.toLowerCase() === team2Name.toLowerCase()) {
      team1Series = wonScore;
      team2Series = loseScore;
    } else if (loseName?.toLowerCase() === team1Name.toLowerCase()) {
      team1Series = loseScore;
      team2Series = wonScore;
    }
  }

  let winnerSide: 1 | 2 | undefined;
  if (team1Series > team2Series) winnerSide = 1;
  else if (team2Series > team1Series) winnerSide = 2;

  const finished = Boolean(
    raw.played_at &&
      (winnerSide !== undefined || normalized.scoreLabel !== "vs"),
  );

  return {
    matchId: normalized.id,
    team1Name,
    team2Name,
    team1Series,
    team2Series,
    mapsCompleted: Math.max(games.length, team1Series + team2Series),
    winnerSide,
    finished: finished && winnerSide !== undefined,
  };
}

export function findPlayedMatchSnapshot(
  matchId: string,
  played: GgscoreMatch[],
  team1Name?: string,
  team2Name?: string,
): PlayedMatchSnapshot | null {
  const raw = played.find((m) => String(m.id) === matchId);
  if (!raw) return null;
  return parsePlayedMatchSnapshot(raw, team1Name, team2Name);
}
