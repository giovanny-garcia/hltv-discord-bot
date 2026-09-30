import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import type { GgscoreSyncScope } from "../../types/ggscore.js";
import { syncGgscoreData } from "../../services/ggscore-cache.service.js";
import { getGgscoreClient } from "../../services/ggscore-context.js";
import { GgscoreQuotaExceededError } from "../../services/ggscore.service.js";
import {
  checkManualHeavySync,
  explainManualHeavySyncBlock,
  isHeavySyncScope,
  recordManualHeavySync,
} from "../../services/ggscore-sync-guard.js";
import { syncResultEmbed } from "../../utils/ggscore-embeds.js";

export const syncCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Fetch fresh GGScore data. Upcoming and full syncs are capped")
    .addStringOption((option) =>
      option
        .setName("scope")
        .setDescription("Which datasets to refresh")
        .setRequired(true)
        .addChoices(
          { name: "Upcoming (capped pages, leaves a reserve)", value: "upcoming" },
          { name: "Results only (1 request, can use the reserve)", value: "results" },
          { name: "Countries only (1 request, can use the reserve)", value: "countries" },
          { name: "Full (capped pages, then 1 results call)", value: "full" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const scope = interaction.options.getString("scope", true) as GgscoreSyncScope;

    if (isHeavySyncScope(scope)) {
      const gate = checkManualHeavySync();
      if (!gate.ok) {
        await interaction.reply({
          content: explainManualHeavySyncBlock(gate),
          ephemeral: true,
        });
        return;
      }
      recordManualHeavySync();
    }

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
