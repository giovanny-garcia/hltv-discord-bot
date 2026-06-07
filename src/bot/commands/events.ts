import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../client.js";
import { fetchEvents } from "../../services/hltv.service.js";
import { eventsListEmbed } from "../../utils/embeds.js";

export const eventsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("events")
    .setDescription("List upcoming HLTV tournaments"),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const events = await fetchEvents();
      await interaction.editReply({ embeds: [eventsListEmbed(events)] });
    } catch (error) {
      console.error("Failed to fetch events:", error);
      await interaction.editReply("Failed to fetch events from HLTV. Try again later.");
    }
  },
};
