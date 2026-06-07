import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { getGgscoreClient } from "../../services/ggscore-context.js";
import { quotaEmbed } from "../../utils/ggscore-embeds.js";

export const quotaCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("quota")
    .setDescription("Show GGScore API usage and cache status"),
  async execute(interaction) {
    const quota = getGgscoreClient().getQuota();
    await interaction.reply({ embeds: [quotaEmbed(quota)], ephemeral: true });
  },
};
