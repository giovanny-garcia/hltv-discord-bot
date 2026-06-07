import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { getCachedPlayedMatches } from "../../services/ggscore-cache.service.js";
import { getGgscoreCache } from "../../storage/db.js";
import { normalizeGgscoreMatch } from "../../utils/ggscore-match.util.js";
import { playedMatchesEmbed } from "../../utils/ggscore-embeds.js";

export const resultsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("results")
    .setDescription("List recent match results from cache (no API call)"),
  async execute(interaction) {
    const cache = getGgscoreCache("matches");
    const matches = getCachedPlayedMatches().map(normalizeGgscoreMatch);
    await interaction.reply({
      embeds: [playedMatchesEmbed(matches, cache?.fetchedAt)],
    });
  },
};
