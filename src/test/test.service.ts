import type { ButtonInteraction, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { ChannelType } from "discord.js";
import { getGuildSettings } from "../storage/db.js";
import {
  buildMatchBoardComponents,
  buildMatchBoardEmbed,
  matchBoardHeader,
  parseMatchBoardRevealId,
  revealMatchBoard,
  testMatchToBoard,
} from "../utils/match-board.embed.js";
import { getMatchBoard, registerMatchBoard } from "./board-registry.js";
import {
  graphEmbed,
  oddsEmbed,
  payoutsEmbed,
  predictionsEmbed,
  rankingsEmbed,
  streaksEmbed,
  wagersEmbed,
} from "./betting.embeds.js";
import {
  defaultFinishedMatch,
  defaultGraph,
  defaultLiveMatch,
  defaultOdds,
  defaultPayouts,
  defaultPredictions,
  defaultRankings,
  defaultStreaks,
  defaultUpcomingMatch,
  defaultWagers,
} from "./fixtures.js";
import {
  applyGraphOptions,
  applyMatchOptions,
  applyOddsOptions,
  applyPayoutOptions,
  applyPredictionsOptions,
  applyRankingsOptions,
  applyStreaksOptions,
  applyWagerOptions,
} from "./parse-options.js";

async function resolveTargetChannel(
  interaction: ChatInputCommandInteraction,
): Promise<TextChannel | null> {
  const overrideId = interaction.options.getChannel("channel")?.id;
  if (overrideId && interaction.guild) {
    const channel = await interaction.guild.channels.fetch(overrideId).catch(() => null);
    if (channel?.isTextBased() && !channel.isDMBased()) return channel as TextChannel;
  }

  if (!interaction.guildId) return null;

  const settings = getGuildSettings(interaction.guildId);
  if (!settings?.channelId) return null;

  const channel = await interaction.guild?.channels.fetch(settings.channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return null;
  return channel as TextChannel;
}

async function sendPreview(
  interaction: ChatInputCommandInteraction,
  payload: {
    content?: string;
    embeds: ReturnType<typeof wagersEmbed>[];
    components?: ReturnType<typeof buildMatchBoardComponents>;
  },
): Promise<void> {
  const postPublic = interaction.options.getBoolean("public") ?? false;
  const channel = postPublic ? await resolveTargetChannel(interaction) : null;

  if (channel) {
    await channel.send(payload);
    await interaction.reply({
      content: `Posted test preview in ${channel}.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: payload.content,
    embeds: payload.embeds,
    components: payload.components,
    ephemeral: true,
  });
}

export async function handleTestSubcommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Use `/test` in a server.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case "upcoming": {
      const input = applyMatchOptions(interaction, defaultUpcomingMatch());
      const board = testMatchToBoard(input);
      registerMatchBoard(board);
      await sendPreview(interaction, {
        content: matchBoardHeader(board),
        embeds: [buildMatchBoardEmbed(board)],
        components: buildMatchBoardComponents(board),
      });
      return;
    }
    case "live": {
      const input = applyMatchOptions(interaction, defaultLiveMatch());
      const map = interaction.options.getInteger("map");
      const hideSpoilers = interaction.options.getBoolean("hide_spoilers");
      const mapscore1 = interaction.options.getInteger("mapscore1");
      const mapscore2 = interaction.options.getInteger("mapscore2");
      if (map !== null) input.currentMap = map;
      if (hideSpoilers !== null) input.hideSpoilers = hideSpoilers;
      if (mapscore1 !== null) input.team1.mapScore = mapscore1;
      if (mapscore2 !== null) input.team2.mapScore = mapscore2;
      const board = testMatchToBoard(input);
      registerMatchBoard(board);
      await sendPreview(interaction, {
        content: matchBoardHeader(board),
        embeds: [buildMatchBoardEmbed(board)],
        components: buildMatchBoardComponents(board),
      });
      return;
    }
    case "finished": {
      const input = applyMatchOptions(interaction, defaultFinishedMatch());
      const board = testMatchToBoard(input);
      registerMatchBoard(board);
      await sendPreview(interaction, {
        content: matchBoardHeader(board),
        embeds: [buildMatchBoardEmbed(board)],
        components: buildMatchBoardComponents(board),
      });
      return;
    }
    case "wagers": {
      await sendPreview(interaction, {
        embeds: [wagersEmbed(applyWagerOptions(interaction, defaultWagers()))],
      });
      return;
    }
    case "odds": {
      await sendPreview(interaction, {
        embeds: [oddsEmbed(applyOddsOptions(interaction, defaultOdds()))],
      });
      return;
    }
    case "payouts": {
      await sendPreview(interaction, {
        embeds: [payoutsEmbed(applyPayoutOptions(interaction, defaultPayouts()))],
      });
      return;
    }
    case "rankings": {
      await sendPreview(interaction, {
        embeds: [rankingsEmbed(applyRankingsOptions(interaction, defaultRankings()))],
      });
      return;
    }
    case "streaks": {
      await sendPreview(interaction, {
        embeds: [streaksEmbed(applyStreaksOptions(interaction, defaultStreaks()))],
      });
      return;
    }
    case "predictions": {
      await sendPreview(interaction, {
        embeds: [predictionsEmbed(applyPredictionsOptions(interaction, defaultPredictions()))],
      });
      return;
    }
    case "graph": {
      await sendPreview(interaction, {
        embeds: [graphEmbed(applyGraphOptions(interaction, defaultGraph()))],
      });
      return;
    }
    default:
      await interaction.reply({ content: "Unknown test subcommand.", ephemeral: true });
  }
}

export async function handleMatchBoardButton(interaction: ButtonInteraction): Promise<boolean> {
  const matchId = parseMatchBoardRevealId(interaction.customId);
  if (!matchId) return false;

  const board = getMatchBoard(matchId);
  if (!board) {
    await interaction.reply({
      content: "Board data expired (bot restarted). Run the `/test` command again.",
      ephemeral: true,
    });
    return true;
  }

  await interaction.update(revealMatchBoard(board));
  return true;
}
