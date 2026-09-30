import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { PlayingSide } from "./ggscore-played.util.js";
import { teamBadge } from "./team-mark.js";
import type { TestMatchInput } from "../test/types.js";

export interface MatchBoardTeam {
  name: string;
  color: number;
  seriesScore: number;
  mapScore?: number;
  playingSide?: PlayingSide;
}

export interface MatchBoardMap {
  name: string;
  team1Rounds?: number;
  team2Rounds?: number;
  winnerSide?: 1 | 2;
  live?: boolean;
}

export interface MatchBoardData {
  matchId: string;
  team1: MatchBoardTeam;
  team2: MatchBoardTeam;
  eventName: string;
  format: string;
  phase: "upcoming" | "live" | "between_maps" | "finished";
  live: boolean;
  currentMap?: number;
  currentMapName?: string;
  maps?: MatchBoardMap[];
  hideSpoilers: boolean;
  spoilersRevealed?: boolean;
  placeholder?: boolean;
  scheduledInMinutes?: number;
  winnerSide?: 1 | 2;
}

const LIVE_COLOR = 0xed4245;
const PLACEHOLDER_COLOR = 0x9b59b6;
const UPCOMING_COLOR = 0x3498db;
const FINISHED_COLOR = 0xf1c40f;
const LIVE_MAP_COLOR = 0xf39c12;
const COL = 14;

function shownNumber(value: number | undefined, hidden: boolean): string {
  if (hidden) return "??";
  return String(value ?? 0);
}

function glyphWidth(codePoint: number): number {
  if (codePoint === 0x200d || codePoint === 0xfe0f || codePoint === 0xfe0e) return 0;
  if (codePoint > 0xffff) return 2;
  if (codePoint >= 0x2600 && codePoint <= 0x27bf) return 2;
  if (codePoint >= 0x2b00 && codePoint <= 0x2bff) return 2;
  if (codePoint >= 0x2190 && codePoint <= 0x21ff) return 2;
  return 1;
}

function textWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += glyphWidth(char.codePointAt(0) ?? 0);
  }
  return width;
}

function fit(text: string, width: number, align: "left" | "right"): string {
  let out = "";
  let used = 0;
  for (const char of text) {
    const size = glyphWidth(char.codePointAt(0) ?? 0);
    if (used + size > width) break;
    out += char;
    used += size;
  }
  const pad = " ".repeat(Math.max(0, width - used));
  return align === "right" ? pad + out : out + pad;
}

function statCell(label: string, value: string): string {
  const valueWidth = textWidth(value);
  const room = Math.max(1, COL - valueWidth - 1);
  return `${fit(label, room, "left")} ${fit(value, valueWidth, "left")}`;
}

function splitRow(left: string, right: string): string {
  return `${fit(left, COL, "left")} │ ${fit(right, COL, "left")}`;
}

function scoreRow(left: string, right: string): string {
  return `${fit(left, COL, "right")} │ ${fit(right, COL, "left")}`;
}

function bannerRule(): string {
  return `${"─".repeat(COL + 1)}┼${"─".repeat(COL + 1)}`;
}

function teamHeading(name: string, won: boolean): string {
  const badge = teamBadge(name);
  const heading = `${badge.mark} ${badge.label}`;
  return won ? `${heading} ✓` : heading;
}

function scoreboardBanner(data: MatchBoardData): string {
  const hidden = data.hideSpoilers;
  const live = data.phase === "live";
  const lines: string[] = [
    splitRow(
      teamHeading(data.team1.name, data.phase === "finished" && !hidden && data.winnerSide === 1),
      teamHeading(data.team2.name, data.phase === "finished" && !hidden && data.winnerSide === 2),
    ),
  ];

  if (live && (data.team1.playingSide || data.team2.playingSide)) {
    lines.push(
      splitRow(
        statCell("Side", data.team1.playingSide ?? "—"),
        statCell("Side", data.team2.playingSide ?? "—"),
      ),
    );
  }

  if (live) {
    lines.push(
      splitRow(
        statCell("Rounds", shownNumber(data.team1.mapScore, hidden)),
        statCell("Rounds", shownNumber(data.team2.mapScore, hidden)),
      ),
    );
  }

  lines.push(
    splitRow(
      statCell("Maps", shownNumber(data.team1.seriesScore, hidden)),
      statCell("Maps", shownNumber(data.team2.seriesScore, hidden)),
    ),
  );

  const maps = data.maps ?? [];
  if (maps.length > 0) {
    lines.push(bannerRule());
    for (const map of maps) {
      const title = map.live ? `${map.name}  ·  live` : map.name;
      const left = shownNumber(map.team1Rounds, hidden);
      const right = shownNumber(map.team2Rounds, hidden);
      lines.push(fit(title, COL * 2 + 3, "left"));
      lines.push(scoreRow(left, right));
    }
  }

  return lines.join("\n");
}

function phaseBanner(data: MatchBoardData): string {
  const mapTitle =
    data.currentMapName ?? (data.currentMap ? `Map ${data.currentMap}` : "Map");

  if (data.phase === "upcoming") {
    const when =
      data.scheduledInMinutes !== undefined
        ? `Starts in ${data.scheduledInMinutes} min`
        : "Start time TBA";
    return `${when}  ·  ${data.format}`;
  }
  if (data.phase === "live") {
    return `LIVE  ·  ${mapTitle}  ·  ${data.format}`;
  }
  if (data.phase === "between_maps") {
    return `MAP BREAK  ·  ${mapTitle} done  ·  ${data.format}`;
  }
  const winner =
    data.winnerSide === 1
      ? teamBadge(data.team1.name).label
      : data.winnerSide === 2
        ? teamBadge(data.team2.name).label
        : "Final";
  return `FINAL  ·  ${winner}  ·  ${data.format}`;
}

function headerColor(data: MatchBoardData): number {
  if (data.phase === "between_maps") return LIVE_MAP_COLOR;
  if (data.placeholder) return PLACEHOLDER_COLOR;
  if (data.phase === "live" || data.live) return LIVE_COLOR;
  if (data.phase === "finished") return FINISHED_COLOR;
  return UPCOMING_COLOR;
}

function headerFooter(data: MatchBoardData): string {
  if (data.phase === "upcoming") {
    return data.placeholder
      ? "Test card · betting locks when the match goes live"
      : "Betting locks when the match goes live";
  }
  if (data.phase === "live") {
    return data.placeholder
      ? "Test card · rounds update on this message"
      : "Rounds update on this message";
  }
  if (data.phase === "between_maps") return "Map break · series score is maps won";
  return "Final series score";
}

function buildScoreboardEmbed(data: MatchBoardData): EmbedBuilder {
  const hiddenFinal = data.hideSpoilers && data.placeholder && data.phase === "finished";
  const description = hiddenFinal
    ? ["FINAL", "", "Result hidden.", "Tap **Show spoilers** on this card."].join("\n")
    : [phaseBanner(data), "", "```", scoreboardBanner(data), "```"].join("\n");

  return new EmbedBuilder()
    .setColor(headerColor(data))
    .setTitle(data.eventName)
    .setDescription(description)
    .setFooter({ text: headerFooter(data) });
}

/** One scoreboard card. Team stats share a banner; each map is a titled row under the line. */
export function buildMatchBoardEmbeds(data: MatchBoardData): EmbedBuilder[] {
  return [buildScoreboardEmbed(data)];
}

export function matchBoardHeader(data: MatchBoardData): string | undefined {
  if (data.phase === "live" || data.live) {
    return data.placeholder ? "🔴 **LIVE** · `placeholder`" : "🔴 **LIVE**";
  }
  if (data.phase === "between_maps") {
    return "⏸️ **Map break**";
  }
  if (data.phase === "upcoming") {
    return undefined;
  }
  if (data.phase === "finished") {
    return data.placeholder ? "✅ **FINAL** · `placeholder`" : "✅ **FINAL**";
  }
  return undefined;
}

export function testMatchToBoard(input: TestMatchInput): MatchBoardData {
  const maps = [...(input.maps ?? [])];
  if (input.phase === "live" && input.currentMapName && !maps.some((map) => map.live)) {
    maps.push({
      name: input.currentMapName,
      team1Rounds: input.team1.mapScore,
      team2Rounds: input.team2.mapScore,
      live: true,
    });
  }

  return {
    matchId: input.matchId,
    team1: { ...input.team1 },
    team2: { ...input.team2 },
    eventName: input.eventName,
    format: input.format,
    phase: input.phase,
    live: input.phase === "live",
    currentMap: input.currentMap,
    currentMapName: input.currentMapName,
    maps: maps.length > 0 ? maps : undefined,
    hideSpoilers: input.hideSpoilers,
    placeholder: true,
    scheduledInMinutes: input.scheduledInMinutes,
    winnerSide: input.winnerSide,
  };
}

export function buildMatchBoardComponents(
  data: MatchBoardData,
): ActionRowBuilder<ButtonBuilder>[] {
  if (!data.placeholder) return [];

  const spoilerPhases =
    data.phase === "live" || data.phase === "between_maps" || data.phase === "finished";
  if (!spoilerPhases || !data.hideSpoilers || data.spoilersRevealed) return [];

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`matchboard:reveal:${data.matchId}`)
      .setLabel("Show spoilers")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("👁️"),
  );

  return [row];
}

export const PLACEHOLDER_MATCH_BOARD: MatchBoardData = {
  matchId: "test-0001",
  team1: { name: "Vitality", color: 0xf1c40f, seriesScore: 1, mapScore: 12, playingSide: "CT" },
  team2: { name: "NAVI", color: 0xf1c40f, seriesScore: 0, mapScore: 9, playingSide: "T" },
  eventName: "Placeholder Invitational 2026",
  format: "BO3",
  phase: "live",
  live: true,
  currentMap: 2,
  currentMapName: "Mirage",
  maps: [
    { name: "Inferno", team1Rounds: 13, team2Rounds: 9, winnerSide: 1 },
    { name: "Mirage", team1Rounds: 12, team2Rounds: 9, live: true },
  ],
  hideSpoilers: true,
  placeholder: true,
};

export function revealMatchBoard(data: MatchBoardData): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const revealed = {
    ...data,
    hideSpoilers: false,
    spoilersRevealed: true,
  };
  return {
    embeds: buildMatchBoardEmbeds(revealed),
    components: [],
  };
}

export function matchBoardRevealId(matchId: string): string {
  return `matchboard:reveal:${matchId}`;
}

export function parseMatchBoardRevealId(customId: string): string | null {
  if (!customId.startsWith("matchboard:reveal:")) return null;
  return customId.slice("matchboard:reveal:".length) || null;
}

export function boardShouldHideSpoilers(
  sessionHideSpoilers: boolean,
  spoilersRevealed?: boolean,
): boolean {
  if (spoilersRevealed) return false;
  return sessionHideSpoilers;
}
