import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { getCachedUpcomingMatches } from "../../services/ggscore-cache.service.js";
import { getGgscoreCache } from "../../storage/db.js";
import { normalizeGgscoreMatch } from "../../utils/ggscore-match.util.js";
import { upcomingMatchesEmbed } from "../../utils/ggscore-embeds.js";

export const matchesCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("matches")
    .setDescription("List upcoming matches from cache (no API call)"),
  async execute(interaction) {
    const cache = getGgscoreCache("upcoming_matches");
    const matches = getCachedUpcomingMatches().map(normalizeGgscoreMatch);
    await interaction.reply({
      embeds: [upcomingMatchesEmbed(matches, cache?.fetchedAt)],
    });
  },
};
