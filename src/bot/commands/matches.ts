import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { fetchMatches } from "../../services/hltv.service.js";
import { matchesListEmbed } from "../../utils/embeds.js";

export const matchesCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("matches")
    .setDescription("List upcoming HLTV matches")
    .addIntegerOption((option) =>
      option
        .setName("stars")
        .setDescription("Minimum star rating (0-5)")
        .setMinValue(0)
        .setMaxValue(5),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const minStars = interaction.options.getInteger("stars") ?? 0;

    try {
      const matches = await fetchMatches();
      await interaction.editReply({ embeds: [matchesListEmbed(matches, minStars)] });
    } catch (error) {
      console.error("Failed to fetch matches:", error);
      await interaction.editReply("Failed to fetch matches from HLTV. Try again later.");
    }
  },
};
