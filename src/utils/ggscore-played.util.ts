import type { GgscoreMatch } from "../types/ggscore.js";
import { normalizeGgscoreMatch } from "./ggscore-match.util.js";

export type PlayingSide = "T" | "CT";

export interface LiveMapState {
  mapIndex: number;
  mapName?: string;
  team1MapScore?: number;
  team2MapScore?: number;
  team1Side?: PlayingSide;
  team2Side?: PlayingSide;
  inProgress: boolean;
}

export interface PlayedMapResult {
  name?: string;
  team1Rounds?: number;
  team2Rounds?: number;
  winnerSide?: 1 | 2;
  live?: boolean;
}

export interface PlayedMatchSnapshot {
  matchId: string;
  team1Name: string;
  team2Name: string;
  team1Series: number;
  team2Series: number;
  mapsCompleted: number;
  lastCompletedMapName?: string;
  winnerSide?: 1 | 2;
  finished: boolean;
  liveMap?: LiveMapState;
  maps: PlayedMapResult[];
}

function teamTitle(team: { name?: string; title?: string } | undefined): string | undefined {
  return team?.name ?? team?.title;
}

function namesMatch(a: string | undefined, b: string): boolean {
  return a?.toLowerCase() === b.toLowerCase();
}

function readNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function readMapName(game: Record<string, unknown>): string | undefined {
  const map = game.map;
  if (map && typeof map === "object") {
    const record = map as Record<string, unknown>;
    const label = record.name ?? record.title ?? record.map_name;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  for (const key of ["map_name", "map_title", "title", "name"] as const) {
    const value = game[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function teamFromUnknown(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "object") {
    return teamTitle(value as { name?: string; title?: string });
  }
  return undefined;
}

function readGameScores(
  game: Record<string, unknown>,
  team1Name: string,
  team2Name: string,
): { team1?: number; team2?: number } {
  const direct1 =
    readNumber(game.team1_score) ??
    readNumber(game.score_team1) ??
    readNumber(game.team_won_score);
  const direct2 =
    readNumber(game.team2_score) ??
    readNumber(game.score_team2) ??
    readNumber(game.team_lose_score);

  if (direct1 !== undefined && direct2 !== undefined) {
    return { team1: direct1, team2: direct2 };
  }

  const score1 = readNumber(game.score1) ?? readNumber(game.score_1);
  const score2 = readNumber(game.score2) ?? readNumber(game.score_2);
  if (score1 !== undefined && score2 !== undefined) {
    return { team1: score1, team2: score2 };
  }

  const won = readNumber(game.score_won);
  const lost = readNumber(game.score_lose);
  const wonTeam = teamFromUnknown(game.team_won ?? game.winner_team);
  const lostTeam = teamFromUnknown(game.team_lose ?? game.loser_team);

  if (won !== undefined && lost !== undefined && wonTeam && lostTeam) {
    if (namesMatch(wonTeam, team1Name)) return { team1: won, team2: lost };
    if (namesMatch(wonTeam, team2Name)) return { team1: lost, team2: won };
  }

  const team1Obj = game.team1;
  const team2Obj = game.team2;
  const team1 = teamFromUnknown(team1Obj);
  const team2 = teamFromUnknown(team2Obj);
  const team1Score =
    team1Obj && typeof team1Obj === "object"
      ? readNumber((team1Obj as { score?: unknown }).score)
      : undefined;
  const team2Score =
    team2Obj && typeof team2Obj === "object"
      ? readNumber((team2Obj as { score?: unknown }).score)
      : undefined;
  if (team1 && team2 && team1Score !== undefined && team2Score !== undefined) {
    if (namesMatch(team1, team1Name)) return { team1: team1Score, team2: team2Score };
    if (namesMatch(team1, team2Name)) return { team1: team2Score, team2: team1Score };
  }

  return {};
}

function readGameSides(
  game: Record<string, unknown>,
  team1Name: string,
  team2Name: string,
): { team1?: PlayingSide; team2?: PlayingSide } {
  const explicit1 = game.team1_side ?? game.side_team1;
  const explicit2 = game.team2_side ?? game.side_team2;
  if (typeof explicit1 === "string" && typeof explicit2 === "string") {
    const side1 = normalizeSide(explicit1);
    const side2 = normalizeSide(explicit2);
    if (side1 && side2) return { team1: side1, team2: side2 };
  }

  const ctTeam = teamFromUnknown(
    game.team_ct ?? game.ct_team ?? game.counter_terrorists ?? game.ct,
  );
  const tTeam = teamFromUnknown(game.team_t ?? game.t_team ?? game.terrorists ?? game.t);

  let team1Side: PlayingSide | undefined;
  let team2Side: PlayingSide | undefined;

  if (ctTeam && namesMatch(ctTeam, team1Name)) team1Side = "CT";
  if (ctTeam && namesMatch(ctTeam, team2Name)) team2Side = "CT";
  if (tTeam && namesMatch(tTeam, team1Name)) team1Side = "T";
  if (tTeam && namesMatch(tTeam, team2Name)) team2Side = "T";

  if (team1Side && !team2Side) team2Side = team1Side === "CT" ? "T" : "CT";
  if (team2Side && !team1Side) team1Side = team2Side === "CT" ? "T" : "CT";

  return { team1: team1Side, team2: team2Side };
}

function normalizeSide(value: string): PlayingSide | undefined {
  const upper = value.trim().toUpperCase();
  if (upper === "CT" || upper.includes("COUNTER")) return "CT";
  if (upper === "T" || upper.includes("TERROR")) return "T";
  return undefined;
}

function parseMapResults(
  games: Record<string, unknown>[],
  team1Name: string,
  team2Name: string,
): PlayedMapResult[] {
  const maps: PlayedMapResult[] = [];
  for (const game of games) {
    const winner = teamTitle(
      game.map_winner_team as { name?: string; title?: string } | undefined,
    );
    const scores = readGameScores(game, team1Name, team2Name);
    const name = readMapName(game);
    const hasScores = scores.team1 !== undefined || scores.team2 !== undefined;

    let winnerSide: 1 | 2 | undefined;
    if (winner && namesMatch(winner, team1Name)) winnerSide = 1;
    else if (winner && namesMatch(winner, team2Name)) winnerSide = 2;

    if (!winner && !hasScores && !name) continue;

    maps.push({
      name,
      team1Rounds: scores.team1,
      team2Rounds: scores.team2,
      winnerSide,
      live: !winner && hasScores,
    });
  }
  return maps;
}

function parseLiveMapState(
  games: Record<string, unknown>[],
  team1Name: string,
  team2Name: string,
  finished: boolean,
): LiveMapState | undefined {
  if (games.length === 0 || finished) return undefined;

  let inProgressIndex = -1;
  for (let i = games.length - 1; i >= 0; i--) {
    const game = games[i];
    const winner = teamTitle(
      game.map_winner_team as { name?: string; title?: string } | undefined,
    );
    const scores = readGameScores(game, team1Name, team2Name);
    const hasScores = scores.team1 !== undefined || scores.team2 !== undefined;

    if (!winner && hasScores) {
      inProgressIndex = i;
      break;
    }
  }

  if (inProgressIndex < 0) {
    const nextIndex = games.filter((game) =>
      teamTitle(game.map_winner_team as { name?: string; title?: string } | undefined),
    ).length;
    return {
      mapIndex: nextIndex + 1,
      inProgress: false,
    };
  }

  const game = games[inProgressIndex];
  const scores = readGameScores(game, team1Name, team2Name);
  const sides = readGameSides(game, team1Name, team2Name);

  return {
    mapIndex: inProgressIndex + 1,
    mapName: readMapName(game),
    team1MapScore: scores.team1,
    team2MapScore: scores.team2,
    team1Side: sides.team1,
    team2Side: sides.team2,
    inProgress: true,
  };
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
  const games = (Array.isArray(raw.games) ? raw.games : []) as Record<string, unknown>[];

  for (const game of games) {
    const winner = teamTitle(
      game.map_winner_team as { name?: string; title?: string } | undefined,
    );
    if (!winner) continue;
    if (namesMatch(winner, team1Name)) team1Series++;
    else if (namesMatch(winner, team2Name)) team2Series++;
  }

  if (games.length === 0 && raw.score_won !== undefined && raw.score_lose !== undefined) {
    const wonName = teamTitle(raw.team_won);
    const loseName = teamTitle(raw.team_lose);
    const wonScore = Number(raw.score_won);
    const loseScore = Number(raw.score_lose);
    if (wonName && namesMatch(wonName, team1Name)) {
      team1Series = wonScore;
      team2Series = loseScore;
    } else if (wonName && namesMatch(wonName, team2Name)) {
      team1Series = loseScore;
      team2Series = wonScore;
    } else if (loseName && namesMatch(loseName, team1Name)) {
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

  const mapsCompleted = Math.max(
    games.filter((game) =>
      teamTitle(game.map_winner_team as { name?: string; title?: string } | undefined),
    ).length,
    team1Series + team2Series,
  );
  const lastCompletedMapName =
    mapsCompleted > 0 ? readMapName(games[mapsCompleted - 1] as Record<string, unknown>) : undefined;
  const liveMap = parseLiveMapState(
    games,
    team1Name,
    team2Name,
    finished && winnerSide !== undefined,
  );

  return {
    matchId: normalized.id,
    team1Name,
    team2Name,
    team1Series,
    team2Series,
    mapsCompleted,
    lastCompletedMapName,
    winnerSide,
    finished: finished && winnerSide !== undefined,
    liveMap,
    maps: parseMapResults(games, team1Name, team2Name),
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
