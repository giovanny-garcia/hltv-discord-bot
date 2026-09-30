import type { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
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
  testPreviewHeader,
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

const DEFAULT_PUBLIC_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TestPreviewItem {
  label: string;
  content?: string;
  embed: EmbedBuilder;
}

function buildAllTestPreviews(): TestPreviewItem[] {
  const upcoming = testMatchToBoard({
    ...defaultUpcomingMatch(),
    matchId: "test-all-upcoming",
  });
  const live = testMatchToBoard({
    ...defaultLiveMatch(),
    matchId: "test-all-live",
  });
  const finished = testMatchToBoard({
    ...defaultFinishedMatch(),
    matchId: "test-all-finished",
  });

  return [
    { label: "upcoming", embed: buildMatchBoardEmbed(upcoming) },
    { label: "live", content: matchBoardHeader(live), embed: buildMatchBoardEmbed(live) },
    { label: "finished", content: matchBoardHeader(finished), embed: buildMatchBoardEmbed(finished) },
    { label: "wagers", embed: wagersEmbed(defaultWagers()) },
    { label: "odds", embed: oddsEmbed(defaultOdds()) },
    { label: "payouts", embed: payoutsEmbed(defaultPayouts()) },
    { label: "rankings", embed: rankingsEmbed(defaultRankings()) },
    { label: "streaks", embed: streaksEmbed(defaultStreaks()) },
    { label: "predictions", embed: predictionsEmbed(defaultPredictions()) },
    { label: "graph", embed: graphEmbed(defaultGraph()) },
  ];
}

async function handleTestAll(interaction: ChatInputCommandInteraction): Promise<void> {
  const previews = buildAllTestPreviews();
  const postPublic = interaction.options.getBoolean("public") ?? false;
  const delayMs = interaction.options.getInteger("delay_ms") ?? DEFAULT_PUBLIC_DELAY_MS;

  if (postPublic) {
    const channel = await resolveTargetChannel(interaction);
    if (!channel) {
      await interaction.reply({
        content: "Public mode needs `/subscribe` or a `channel` option.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    for (let i = 0; i < previews.length; i++) {
      const preview = previews[i];
      await channel.send({
        content: preview.content,
        embeds: [preview.embed],
      });

      if (i < previews.length - 1) {
        await sleep(delayMs);
      }
    }

    await interaction.editReply({
      content: `Posted **${previews.length}** test previews to ${channel} (~${delayMs}ms apart).`,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply({
    content:
      "🧪 **All test previews** — one bundled message below (scroll through embeds). Use `/test all public:true` to post paced messages in-channel.",
    embeds: previews.map((preview) => preview.embed),
  });
}

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
        content: testPreviewHeader("Wager pool"),
        embeds: [wagersEmbed(applyWagerOptions(interaction, defaultWagers()))],
      });
      return;
    }
    case "odds": {
      await sendPreview(interaction, {
        content: testPreviewHeader("Market odds"),
        embeds: [oddsEmbed(applyOddsOptions(interaction, defaultOdds()))],
      });
      return;
    }
    case "payouts": {
      await sendPreview(interaction, {
        content: testPreviewHeader("Map payout"),
        embeds: [payoutsEmbed(applyPayoutOptions(interaction, defaultPayouts()))],
      });
      return;
    }
    case "rankings": {
      await sendPreview(interaction, {
        content: testPreviewHeader("Leaderboard"),
        embeds: [rankingsEmbed(applyRankingsOptions(interaction, defaultRankings()))],
      });
      return;
    }
    case "streaks": {
      await sendPreview(interaction, {
        content: testPreviewHeader("Prediction streaks"),
        embeds: [streaksEmbed(applyStreaksOptions(interaction, defaultStreaks()))],
      });
      return;
    }
    case "predictions": {
      await sendPreview(interaction, {
        content: testPreviewHeader("Event predictions"),
        embeds: [predictionsEmbed(applyPredictionsOptions(interaction, defaultPredictions()))],
      });
      return;
    }
    case "graph": {
      await sendPreview(interaction, {
        content: testPreviewHeader("Balance graph"),
        embeds: [graphEmbed(applyGraphOptions(interaction, defaultGraph()))],
      });
      return;
    }
    case "all": {
      await handleTestAll(interaction);
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
