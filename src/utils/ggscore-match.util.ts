import type { GgscoreMatch } from "../types/ggscore.js";

export interface NormalizedGgscoreMatch {
  id: string;
  team1Name: string;
  team2Name: string;
  scoreLabel: string;
  eventName?: string;
  kind?: string;
  scheduledAt?: number;
  playedAt?: number;
  online?: boolean;
  location?: string;
  matchLink?: string;
  stars: number;
  live: boolean;
}

function readTeam(match: GgscoreMatch, index: 0 | 1): { name: string; score?: number | string } {
  if (match.team1 && match.team2) {
    const team = index === 0 ? match.team1 : match.team2;
    return { name: team.name, score: team.score };
  }

  if (match.teams?.[index]) {
    const team = match.teams[index];
    return { name: team.name, score: team.score };
  }

  if (index === 0 && match.winner) return { name: match.winner.name, score: match.winner.score };
  if (index === 1 && match.loser) return { name: match.loser.name, score: match.loser.score };

  return { name: "TBD" };
}

function parseScoreLabel(match: GgscoreMatch, team1Score?: number | string, team2Score?: number | string): string {
  if (typeof match.score === "string" && match.score.trim()) return match.score;
  if (team1Score !== undefined && team2Score !== undefined) return `${team1Score}:${team2Score}`;
  return "vs";
}

function parseDateMs(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

function eventName(match: GgscoreMatch): string | undefined {
  if (!match.event) return undefined;
  if (typeof match.event === "string") return match.event;
  return match.event.title ?? match.event.name;
}

export function normalizeGgscoreMatch(match: GgscoreMatch): NormalizedGgscoreMatch {
  const team1 = readTeam(match, 0);
  const team2 = readTeam(match, 1);
  const externalLink = match.hltv_link ?? match.hltv_url;
  const id =
    match.id !== undefined
      ? String(match.id)
      : externalLink ?? `${team1.name}-${team2.name}-${match.scheduled_at ?? match.played_at ?? "unknown"}`;

  const scheduledAt = parseDateMs(match.scheduled_at ?? match.date);
  const playedAt = parseDateMs(match.played_at ?? match.date);

  return {
    id,
    team1Name: team1.name,
    team2Name: team2.name,
    scoreLabel: parseScoreLabel(match, team1.score, team2.score),
    eventName: eventName(match),
    kind: match.kind,
    scheduledAt,
    playedAt,
    online: match.online,
    location: match.location,
    matchLink: typeof externalLink === "string" ? externalLink : undefined,
    stars: 0,
    live: false,
  };
}

export function matchLabel(normalized: NormalizedGgscoreMatch): string {
  return `${normalized.team1Name} vs ${normalized.team2Name}`;
}

export function matchUrl(normalized: NormalizedGgscoreMatch): string | undefined {
  return normalized.matchLink;
}

export function formatTimestamp(unixSeconds?: number): string {
  if (!unixSeconds) return "TBA";
  return `<t:${unixSeconds}:F> (<t:${unixSeconds}:R>)`;
}

export function isUpcoming(normalized: NormalizedGgscoreMatch): boolean {
  if (!normalized.scheduledAt) return true;
  return normalized.scheduledAt * 1000 > Date.now();
}

export function isStartingSoon(normalized: NormalizedGgscoreMatch, minutes: number): boolean {
  if (!normalized.scheduledAt) return false;
  const startMs = normalized.scheduledAt * 1000;
  const now = Date.now();
  return startMs > now && startMs - now <= minutes * 60_000;
}

export function uniqueEvents(matches: NormalizedGgscoreMatch[]): string[] {
  const events = new Set<string>();
  for (const match of matches) {
    if (match.eventName) events.add(match.eventName);
  }
  return [...events].sort((a, b) => a.localeCompare(b));
}
