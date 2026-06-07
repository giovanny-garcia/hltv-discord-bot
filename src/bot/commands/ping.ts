import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check if the bot is online"),
  async execute(interaction) {
    await interaction.reply({ content: "Pong! CS2 tracker is online.", ephemeral: true });
  },
};
