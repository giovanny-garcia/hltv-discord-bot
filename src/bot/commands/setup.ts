import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import { getGuildSettings, upsertGuildSettings } from "../../storage/db.js";

export const setupCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure announcement and betting channels")
    .addChannelOption((option) =>
      option
        .setName("announcements")
        .setDescription("Match announcement channel")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName("betting")
        .setDescription("Channel for wager messages")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const announcements = interaction.options.getChannel("announcements", true);
    const betting = interaction.options.getChannel("betting", true);

    upsertGuildSettings(interaction.guildId, announcements.id, {
      bettingChannelId: betting.id,
    });

    await interaction.reply({
      content: [
        "Server configured:",
        `• Announcements → ${announcements}`,
        `• Betting → ${betting}`,
        "",
        "Next steps:",
        "1. Run `/sync scope:full` once (uses your 3 daily API calls)",
        "2. Run `/events track` to pick which tournaments get announced",
        "3. Run `/betting open` to start wagers in the betting channel",
      ].join("\n"),
    });
  },
};
