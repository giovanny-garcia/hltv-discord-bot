import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import { getGuildSettings } from "../../storage/db.js";
import { placeholderMatchAnnounceEmbed } from "../../utils/ggscore-embeds.js";

export const testAnnounceCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("test-announce")
    .setDescription("Post a placeholder match announcement (for layout testing)")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Override channel (defaults to subscribed announcement channel)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const settings = getGuildSettings(interaction.guildId);
    const override = interaction.options.getChannel("channel");
    const channelId = override?.id ?? settings?.channelId;

    if (!channelId) {
      await interaction.reply({
        content: "No announcement channel set. Run `/subscribe` first, or pass a `channel` option.",
        ephemeral: true,
      });
      return;
    }

    const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      await interaction.reply({
        content: "Could not send to that channel. Check bot permissions (View Channel, Send Messages, Embed Links).",
        ephemeral: true,
      });
      return;
    }

    await channel.send({ embeds: [placeholderMatchAnnounceEmbed()] });

    await interaction.reply({
      content: `Posted placeholder announcement in ${channel}.`,
      ephemeral: true,
    });
  },
};
