import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import {
  getCachedPlayedMatches,
  getCachedUpcomingMatches,
} from "../../services/ggscore-cache.service.js";
import { normalizeGgscoreMatch, uniqueEvents } from "../../utils/ggscore-match.util.js";
import { eventsEmbed } from "../../utils/ggscore-embeds.js";

export const eventsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("events")
    .setDescription("List tournaments and events from cache (no API call)"),
  async execute(interaction) {
    const upcoming = getCachedUpcomingMatches().map(normalizeGgscoreMatch);
    const played = getCachedPlayedMatches().map(normalizeGgscoreMatch);
    const events = uniqueEvents([...upcoming, ...played]);
    await interaction.reply({ embeds: [eventsEmbed(events)] });
  },
};
