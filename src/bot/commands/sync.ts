import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import type { GgscoreSyncScope } from "../../types/ggscore.js";
import { syncGgscoreData } from "../../services/ggscore-cache.service.js";
import { getGgscoreClient } from "../../services/ggscore-context.js";
import { GgscoreQuotaExceededError } from "../../services/ggscore.service.js";
import { syncResultEmbed } from "../../utils/ggscore-embeds.js";

export const syncCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("sync")
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
