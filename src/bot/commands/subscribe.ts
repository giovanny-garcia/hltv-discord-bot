import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import { getGuildSettings, removeGuildSettings, updateGuildSettings, upsertGuildSettings } from "../../storage/db.js";

export const subscribeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("subscribe")
    .setDescription("Set the channel for HLTV announcements")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Announcement channel")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const channel = interaction.options.getChannel("channel", true);
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    upsertGuildSettings(interaction.guildId, channel.id);
    await interaction.reply({
      content: `Subscribed to HLTV announcements in ${channel}. Use \`/settings\` to configure filters.`,
    });
  },
};

export const unsubscribeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unsubscribe")
    .setDescription("Stop HLTV announcements for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const removed = removeGuildSettings(interaction.guildId);
    await interaction.reply({
      content: removed
        ? "Unsubscribed from HLTV announcements."
        : "This server was not subscribed.",
      ephemeral: true,
    });
  },
};

export const settingsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("View or update announcement settings")
    .addIntegerOption((option) =>
      option
        .setName("stars")
        .setDescription("Minimum match star rating (0-5)")
        .setMinValue(0)
        .setMaxValue(5),
    )
    .addBooleanOption((option) =>
      option.setName("featured").setDescription("Only announce featured tournaments"),
    )
    .addBooleanOption((option) =>
      option.setName("tournaments").setDescription("Enable or disable tournament announcements"),
    )
    .addBooleanOption((option) =>
      option.setName("matches").setDescription("Enable or disable match announcements"),
    )
    .addIntegerOption((option) =>
      option
        .setName("match_reminder")
        .setDescription("Minutes before match start to send reminder")
        .setMinValue(5)
        .setMaxValue(180),
    )
    .addIntegerOption((option) =>
      option
        .setName("tournament_reminder")
        .setDescription("Hours before tournament start to send reminder")
        .setMinValue(1)
        .setMaxValue(168),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const existing = getGuildSettings(interaction.guildId);
    if (!existing) {
      await interaction.reply({
        content: "This server is not subscribed. Run `/subscribe` first.",
        ephemeral: true,
      });
      return;
    }

    const stars = interaction.options.getInteger("stars");
    const featured = interaction.options.getBoolean("featured");
    const tournaments = interaction.options.getBoolean("tournaments");
    const matches = interaction.options.getBoolean("matches");
    const matchReminder = interaction.options.getInteger("match_reminder");
    const tournamentReminder = interaction.options.getInteger("tournament_reminder");

    const hasUpdates =
      stars !== null ||
      featured !== null ||
      tournaments !== null ||
      matches !== null ||
      matchReminder !== null ||
      tournamentReminder !== null;

    if (!hasUpdates) {
      const { settingsEmbed } = await import("../../utils/embeds.js");
      await interaction.reply({ embeds: [settingsEmbed(existing)], ephemeral: true });
      return;
    }

    const updated = updateGuildSettings(interaction.guildId, {
      minMatchStars: stars ?? undefined,
      featuredOnly: featured ?? undefined,
      announceTournaments: tournaments ?? undefined,
      announceMatches: matches ?? undefined,
      matchReminderMinutes: matchReminder ?? undefined,
      tournamentReminderHours: tournamentReminder ?? undefined,
    });

    if (!updated) {
      await interaction.reply({
        content: "Failed to update settings.",
        ephemeral: true,
      });
      return;
    }

    const { settingsEmbed } = await import("../../utils/embeds.js");
    await interaction.reply({ embeds: [settingsEmbed(updated)] });
  },
};
