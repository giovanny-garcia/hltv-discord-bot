import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import type { GgscoreSyncScope } from "../../types/ggscore.js";
import { getGgscoreCache } from "../../storage/db.js";
import {
  getCachedCountries,
  getCachedPlayedMatches,
  getCachedUpcomingMatches,
  syncGgscoreData,
} from "../../services/ggscore-cache.service.js";
import { getGgscoreClient } from "../../services/ggscore-context.js";
import { GgscoreQuotaExceededError } from "../../services/ggscore.service.js";
import { normalizeGgscoreMatch, uniqueEvents } from "../../utils/ggscore-match.util.js";
import {
  countriesEmbed,
  playedMatchesEmbed,
  quotaEmbed,
  syncResultEmbed,
  upcomingMatchesEmbed,
  ggscoreEventsEmbed,
} from "../../utils/ggscore-embeds.js";

export const ggscoreSyncCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ggscore-sync")
    .setDescription("Fetch fresh data from GGScore (uses daily API quota)")
    .addStringOption((option) =>
      option
        .setName("scope")
        .setDescription("Which datasets to refresh")
        .setRequired(true)
        .addChoices(
          { name: "Upcoming only (1 request)", value: "upcoming" },
          { name: "Results only (1 request)", value: "results" },
          { name: "Countries only (1 request)", value: "countries" },
          { name: "Full sync (3 requests)", value: "full" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const scope = interaction.options.getString("scope", true) as GgscoreSyncScope;

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await syncGgscoreData(getGgscoreClient(), scope);
      await interaction.editReply({ embeds: [syncResultEmbed(result)] });
    } catch (error) {
      if (error instanceof GgscoreQuotaExceededError) {
        await interaction.editReply(
          `Daily quota exhausted (${error.used}/${error.limit}). Commands still work from cache until tomorrow, or upgrade to Premium.`,
        );
        return;
      }
      throw error;
    }
  },
};

export const ggscoreQuotaCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ggscore-quota")
    .setDescription("Show GGScore API usage and cache status"),
  async execute(interaction) {
    const quota = getGgscoreClient().getQuota();
    await interaction.reply({ embeds: [quotaEmbed(quota)], ephemeral: true });
  },
};

export const ggscoreUpcomingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ggscore-upcoming")
    .setDescription("List upcoming matches from GGScore cache (no API call)"),
  async execute(interaction) {
    const cache = getGgscoreCache("upcoming_matches");
    const matches = getCachedUpcomingMatches().map(normalizeGgscoreMatch);
    await interaction.reply({
      embeds: [upcomingMatchesEmbed(matches, cache?.fetchedAt)],
    });
  },
};

export const ggscoreResultsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ggscore-results")
    .setDescription("List recent results from GGScore cache (no API call)"),
  async execute(interaction) {
    const cache = getGgscoreCache("matches");
    const matches = getCachedPlayedMatches().map(normalizeGgscoreMatch);
    await interaction.reply({
      embeds: [playedMatchesEmbed(matches, cache?.fetchedAt)],
    });
  },
};

export const ggscoreCountriesCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ggscore-countries")
    .setDescription("List countries from GGScore cache (no API call)"),
  async execute(interaction) {
    const cache = getGgscoreCache("countries");
    await interaction.reply({
      embeds: [countriesEmbed(getCachedCountries(), cache?.fetchedAt)],
      ephemeral: true,
    });
  },
};

export const ggscoreEventsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ggscore-events")
    .setDescription("List unique events from cached upcoming matches (no API call)"),
  async execute(interaction) {
    const upcoming = getCachedUpcomingMatches().map(normalizeGgscoreMatch);
    const played = getCachedPlayedMatches().map(normalizeGgscoreMatch);
    const events = uniqueEvents([...upcoming, ...played]);
    await interaction.reply({ embeds: [ggscoreEventsEmbed(events)] });
  },
};
