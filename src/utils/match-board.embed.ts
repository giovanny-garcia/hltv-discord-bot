import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { TestMatchInput } from "../test/types.js";

export interface MatchBoardTeam {
  name: string;
  /** Discord embed accent — shown via colored badge emoji in the layout. */
  color: number;
  seriesScore: number;
  mapScore?: number;
}

export interface MatchBoardData {
  matchId: string;
  team1: MatchBoardTeam;
  team2: MatchBoardTeam;
  eventName: string;
  format: string;
  phase: "upcoming" | "live" | "finished";
  live: boolean;
  currentMap?: number;
  hideSpoilers: boolean;
  placeholder?: boolean;
  scheduledInMinutes?: number;
  winnerSide?: 1 | 2;
}

const LIVE_COLOR = 0xed4245;
const PLACEHOLDER_COLOR = 0x9b59b6;
const UPCOMING_COLOR = 0x3498db;
const FINISHED_COLOR = 0xf1c40f;
const ZERO_WIDTH = "\u200b";

function colorBadge(color: number): string {
  if (color === 0x3498db) return "🔵";
  if (color === 0xe74c3c) return "🔴";
  if (color === 0xf1c40f) return "🟡";
  if (color === 0x2ecc71) return "🟢";
  if (color === 0xe67e22) return "🟠";
  if (color === 0x9b59b6) return "🟣";
  return "⚪";
}

function spoiler(text: string, hidden: boolean): string {
  return hidden ? `||${text}||` : text;
}

function formatScore(value: number, hidden: boolean): string {
  return spoiler(`**${value}**`, hidden);
}

function embedAccent(data: MatchBoardData): number {
  if (data.placeholder) return PLACEHOLDER_COLOR;
  if (data.phase === "live" || data.live) return LIVE_COLOR;
  if (data.phase === "finished") {
    if (data.winnerSide === 1) return data.team1.color;
    if (data.winnerSide === 2) return data.team2.color;
    return FINISHED_COLOR;
  }
  return UPCOMING_COLOR;
}

function statusLine(data: MatchBoardData): string {
  const parts: string[] = [];

  if (data.placeholder) {
    parts.push("🧪 **PLACEHOLDER / TEST DATA**");
  }

  if (data.phase === "upcoming") {
    parts.push("⏳ **UPCOMING**");
    if (data.scheduledInMinutes !== undefined) {
      parts.push(`starts in **${data.scheduledInMinutes}m**`);
    }
  } else if (data.phase === "live" || data.live) {
    parts.push("🔴 **LIVE**");
  } else if (data.phase === "finished") {
    parts.push("✅ **FINAL**");
    if (data.winnerSide === 1) parts.push(`🏆 **${data.team1.name}** win`);
    if (data.winnerSide === 2) parts.push(`🏆 **${data.team2.name}** win`);
  }

  if (data.currentMap && data.phase === "live") {
    parts.push(`Map **${data.currentMap}** · ${data.format}`);
  } else {
    parts.push(data.format);
  }

  return parts.join(" · ");
}

export function buildMatchBoardEmbed(data: MatchBoardData): EmbedBuilder {
  const badge1 = colorBadge(data.team1.color);
  const badge2 = colorBadge(data.team2.color);
  const hidden = data.hideSpoilers;

  const showMapScores = data.phase === "live" && data.team1.mapScore !== undefined;

  const team1Block = [
    `${badge1} **${data.team1.name.toUpperCase()}**`,
    formatScore(data.team1.seriesScore, hidden),
    showMapScores && data.team1.mapScore !== undefined
      ? `Map: ${spoiler(String(data.team1.mapScore), hidden)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const team2Block = [
    `${badge2} **${data.team2.name.toUpperCase()}**`,
    formatScore(data.team2.seriesScore, hidden),
    showMapScores && data.team2.mapScore !== undefined
      ? `Map: ${spoiler(String(data.team2.mapScore), hidden)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const seriesLine = spoiler(
    `Series **${data.team1.seriesScore} – ${data.team2.seriesScore}**`,
    hidden,
  );

  const embed = new EmbedBuilder()
    .setColor(embedAccent(data))
    .setTitle(`${data.team1.name}  vs  ${data.team2.name}`)
    .setDescription(
      [
        statusLine(data),
        "",
        `🏆 ${data.eventName}`,
        "",
        data.phase === "upcoming"
          ? "*Betting open — wagers lock before match start.*"
          : data.hideSpoilers
            ? "*Scores hidden — tap blurred text or use **Show spoilers** below.*"
            : "*Spoilers visible.*",
      ].join("\n"),
    )
    .addFields(
      {
        name: `${badge1} ${data.team1.name}`,
        value: team1Block,
        inline: true,
      },
      {
        name: ZERO_WIDTH,
        value: "⚔️\n**VS**",
        inline: true,
      },
      {
        name: `${data.team2.name} ${badge2}`,
        value: team2Block,
        inline: true,
      },
      {
        name: "Series",
        value: seriesLine,
        inline: false,
      },
    )
    .setTimestamp(new Date());

  if (data.placeholder) {
    embed.setFooter({
      text: `TEST · match ${data.matchId} · /test · not real data`,
    });
  }

  return embed;
}

export function matchBoardHeader(data: MatchBoardData): string | undefined {
  if (data.phase === "live" || data.live) {
    return data.placeholder
      ? "🔴 **LIVE** · `PLACEHOLDER` — not a real match"
      : "🔴 **LIVE**";
  }
  if (data.phase === "upcoming") {
    return data.placeholder
      ? "⏳ **UPCOMING** · `PLACEHOLDER` — not a real match"
      : "⏳ **UPCOMING**";
  }
  if (data.phase === "finished") {
    return data.placeholder
      ? "✅ **FINAL** · `PLACEHOLDER` — not a real match"
      : "✅ **FINAL**";
  }
  return undefined;
}

export function testMatchToBoard(input: TestMatchInput): MatchBoardData {
  return {
    matchId: input.matchId,
    team1: { ...input.team1 },
    team2: { ...input.team2 },
    eventName: input.eventName,
    format: input.format,
    phase: input.phase,
    live: input.phase === "live",
    currentMap: input.currentMap,
    hideSpoilers: input.hideSpoilers,
    placeholder: true,
    scheduledInMinutes: input.scheduledInMinutes,
    winnerSide: input.winnerSide,
  };
}

export function buildMatchBoardComponents(
  data: MatchBoardData,
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (data.hideSpoilers) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`matchboard:reveal:${data.matchId}`)
        .setLabel("Show spoilers")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("👁️"),
    );
    return [row];
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`matchboard:revealed:${data.matchId}`)
      .setLabel("Spoilers shown")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  return [row];
}

export const PLACEHOLDER_MATCH_BOARD: MatchBoardData = {
  matchId: "test-0001",
  team1: {
    name: "Team Alpha",
    color: 0x3498db,
    seriesScore: 1,
    mapScore: 12,
  },
  team2: {
    name: "Team Beta",
    color: 0xe74c3c,
    seriesScore: 0,
    mapScore: 9,
  },
  eventName: "Placeholder Invitational 2026",
  format: "BO3",
  phase: "live",
  live: true,
  currentMap: 2,
  hideSpoilers: true,
  placeholder: true,
};

export function revealMatchBoard(data: MatchBoardData): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const revealed = { ...data, hideSpoilers: false };
  return {
    embeds: [buildMatchBoardEmbed(revealed)],
    components: buildMatchBoardComponents(revealed),
  };
}

export function matchBoardRevealId(matchId: string): string {
  return `matchboard:reveal:${matchId}`;
}

export function parseMatchBoardRevealId(customId: string): string | null {
  if (!customId.startsWith("matchboard:reveal:")) return null;
  return customId.slice("matchboard:reveal:".length) || null;
}
