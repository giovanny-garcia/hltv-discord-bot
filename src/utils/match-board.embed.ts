import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import type { TestMatchInput } from "../test/types.js";

export interface MatchBoardTeam {
  name: string;
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
  phase: "upcoming" | "live" | "between_maps" | "finished";
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

function buildUpcomingEmbed(data: MatchBoardData): EmbedBuilder {
  const badge1 = colorBadge(data.team1.color);
  const badge2 = colorBadge(data.team2.color);

  const timing =
    data.scheduledInMinutes !== undefined
      ? `Starts in **${data.scheduledInMinutes} min**`
      : "Start time TBA";

  const embed = new EmbedBuilder()
    .setColor(embedAccent(data))
    .setTitle(`${data.team1.name} vs ${data.team2.name}`)
    .setDescription(
      [
        data.placeholder ? "🧪 *Placeholder test data*" : null,
        `🏆 **${data.eventName}**`,
        `${timing} · **${data.format}**`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .addFields(
      {
        name: `${badge1} ${data.team1.name}`,
        value: " ",
        inline: true,
      },
      {
        name: ZERO_WIDTH,
        value: "**vs**",
        inline: true,
      },
      {
        name: `${data.team2.name} ${badge2}`,
        value: " ",
        inline: true,
      },
      {
        name: ZERO_WIDTH,
        value: "💬 Wagers open — locks a few minutes after match start",
        inline: false,
      },
    )
    .setTimestamp(new Date());

  if (data.placeholder) {
    embed.setFooter({ text: `TEST · ${data.matchId} · /test upcoming` });
  }

  return embed;
}

function buildLiveEmbed(data: MatchBoardData): EmbedBuilder {
  const badge1 = colorBadge(data.team1.color);
  const badge2 = colorBadge(data.team2.color);
  const hidden = data.hideSpoilers;

  const team1Value = [
    spoiler(`Series **${data.team1.seriesScore}**`, hidden),
    data.team1.mapScore !== undefined
      ? spoiler(`Map **${data.team1.mapScore}**`, hidden)
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const team2Value = [
    spoiler(`Series **${data.team2.seriesScore}**`, hidden),
    data.team2.mapScore !== undefined
      ? spoiler(`Map **${data.team2.mapScore}**`, hidden)
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const centerValue = [
    "**LIVE**",
    data.currentMap ? `Map ${data.currentMap}` : null,
    data.format,
  ]
    .filter(Boolean)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(embedAccent(data))
    .setTitle(`${data.team1.name} vs ${data.team2.name}`)
    .setDescription(
      [
        data.placeholder ? "🧪 *Placeholder test data*" : null,
        `🏆 **${data.eventName}**`,
        hidden
          ? "*Scores hidden — tap blur or use **Show spoilers** below*"
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .addFields(
      { name: `${badge1} ${data.team1.name}`, value: team1Value, inline: true },
      { name: ZERO_WIDTH, value: centerValue, inline: true },
      { name: `${data.team2.name} ${badge2}`, value: team2Value, inline: true },
    )
    .setTimestamp(new Date());

  if (data.placeholder) {
    embed.setFooter({ text: `TEST · ${data.matchId} · /test live` });
  }

  return embed;
}

function buildBetweenMapsEmbed(data: MatchBoardData): EmbedBuilder {
  const badge1 = colorBadge(data.team1.color);
  const badge2 = colorBadge(data.team2.color);
  const hidden = data.hideSpoilers;
  const mapLabel = data.currentMap ? `Map ${data.currentMap}` : "Map";

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(`${data.team1.name} vs ${data.team2.name}`)
    .setDescription(
      [
        `🏆 **${data.eventName}**`,
        `**${mapLabel} complete** · **${data.format}**`,
        hidden
          ? "*Series score hidden — tap **Show spoilers** when you're ready*"
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .addFields(
      {
        name: `${badge1} ${data.team1.name}`,
        value: spoiler(`Series **${data.team1.seriesScore}**`, hidden),
        inline: true,
      },
      { name: ZERO_WIDTH, value: "**BREAK**", inline: true },
      {
        name: `${data.team2.name} ${badge2}`,
        value: spoiler(`Series **${data.team2.seriesScore}**`, hidden),
        inline: true,
      },
    )
    .setTimestamp(new Date());

  return embed;
}

function buildFinishedEmbed(data: MatchBoardData): EmbedBuilder {
  if (data.hideSpoilers) {
    const embed = new EmbedBuilder()
      .setColor(FINISHED_COLOR)
      .setTitle(`${data.team1.name} vs ${data.team2.name}`)
      .setDescription(
        [
          `🏆 **${data.eventName}**`,
          `**${data.format}** · Match complete`,
          "",
          "Results are hidden to avoid spoilers.",
          "Tap **Show spoilers** below when you're ready.",
        ].join("\n"),
      )
      .setTimestamp(new Date());
    return embed;
  }

  const badge1 = colorBadge(data.team1.color);
  const badge2 = colorBadge(data.team2.color);
  const team1Won = data.winnerSide === 1;
  const team2Won = data.winnerSide === 2;

  const embed = new EmbedBuilder()
    .setColor(embedAccent(data))
    .setTitle(`${data.team1.name} vs ${data.team2.name}`)
    .setDescription(
      [
        data.placeholder ? "🧪 *Placeholder test data*" : null,
        `🏆 **${data.eventName}**`,
        `**${data.format}** · Final`,
      ].join("\n"),
    )
    .addFields(
      {
        name: `${badge1} ${data.team1.name}${team1Won ? " 🏆" : ""}`,
        value: `**${data.team1.seriesScore}**`,
        inline: true,
      },
      { name: ZERO_WIDTH, value: "**FINAL**", inline: true },
      {
        name: `${data.team2.name} ${badge2}${team2Won ? " 🏆" : ""}`,
        value: `**${data.team2.seriesScore}**`,
        inline: true,
      },
      {
        name: "Series",
        value: `**${data.team1.seriesScore} – ${data.team2.seriesScore}**`,
        inline: false,
      },
    )
    .setTimestamp(new Date());

  if (data.placeholder) {
    embed.setFooter({ text: `TEST · ${data.matchId} · /test finished` });
  }

  return embed;
}

export function buildMatchBoardEmbed(data: MatchBoardData): EmbedBuilder {
  switch (data.phase) {
    case "upcoming":
      return buildUpcomingEmbed(data);
    case "live":
      return buildLiveEmbed(data);
    case "between_maps":
      return buildBetweenMapsEmbed(data);
    case "finished":
      return buildFinishedEmbed(data);
  }
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
  const spoilerPhases = data.phase === "live" || data.phase === "between_maps" || data.phase === "finished";
  if (!spoilerPhases || !data.hideSpoilers) return [];

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
  team1: { name: "Team Alpha", color: 0x3498db, seriesScore: 1, mapScore: 12 },
  team2: { name: "Team Beta", color: 0xe74c3c, seriesScore: 0, mapScore: 9 },
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
