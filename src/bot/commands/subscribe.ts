import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { BotCommand } from "../client.js";
import { getGuildSettings, removeGuildSettings, updateGuildSettings, upsertGuildSettings, getTrackedEvents } from "../../storage/db.js";
import { settingsEmbed } from "../../utils/embeds.js";

export const subscribeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("subscribe")
    .setDescription("Set the channel for CS2 match announcements")
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
      content: `Subscribed to match announcements in ${channel}. Track events with \`/events track\` — nothing is announced until you pick tournaments.`,
    });
  },
};

export const unsubscribeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unsubscribe")
    .setDescription("Stop match announcements for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const removed = removeGuildSettings(interaction.guildId);
    await interaction.reply({
      content: removed
        ? "Unsubscribed from match announcements."
        : "This server was not subscribed.",
      ephemeral: true,
    });
  },
};

export const settingsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("View or update announcement settings")
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

    const matches = interaction.options.getBoolean("matches");
    const matchReminder = interaction.options.getInteger("match_reminder");

    const hasUpdates = matches !== null || matchReminder !== null;

    if (!hasUpdates) {
      await interaction.reply({
        embeds: [
          settingsEmbed({
            ...existing,
            trackedEventCount: getTrackedEvents(interaction.guildId).length,
          }),
        ],
        ephemeral: true,
      });
      return;
    }

    const updated = updateGuildSettings(interaction.guildId, {
      announceMatches: matches ?? undefined,
      matchReminderMinutes: matchReminder ?? undefined,
    });

    if (!updated) {
      await interaction.reply({
        content: "Failed to update settings.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        settingsEmbed({
          ...updated,
          trackedEventCount: getTrackedEvents(interaction.guildId).length,
        }),
      ],
    });
  },
};
