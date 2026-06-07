import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { getCachedCountries } from "../../services/ggscore-cache.service.js";
import { getGgscoreCache } from "../../storage/db.js";
import { countriesEmbed } from "../../utils/ggscore-embeds.js";

export const countriesCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("countries")
    .setDescription("List countries from cache (no API call)"),
  async execute(interaction) {
    const cache = getGgscoreCache("countries");
    await interaction.reply({
      embeds: [countriesEmbed(getCachedCountries(), cache?.fetchedAt)],
      ephemeral: true,
    });
  },
};
